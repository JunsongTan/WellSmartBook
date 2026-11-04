
const express = require('express');

// ======================================================
// PENDING PAYMENT ACTIONS
// ======================================================

function createPendingPaymentActionsRouter({
    bookingPool,
    stripe,
    authenticateToken
}) {

    const router = express.Router();


    // ==================================================
    // USER - CANCEL PENDING BOOKING
    // ==================================================

    router.post(
        '/bookings/:bookingId/cancel-pending',
        authenticateToken,

        async (req, res) => {

            if (
                !req.user ||
                req.user.role !== 'user'
            ) {
                return res.status(403).json({
                    success: false,
                    message: 'Only users can cancel their booking holds.'
                });
            }

            const bookingId =
                Number(req.params.bookingId);

            const userId =
                Number(req.user.id);

            if (
                !Number.isSafeInteger(bookingId) ||
                bookingId <= 0 ||
                !Number.isSafeInteger(userId) ||
                userId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid booking or user ID.'
                });
            }

            let connection;

            try {

                connection =
                    await bookingPool
                        .promise()
                        .getConnection();

                await connection.beginTransaction();


                // ==========================================
                // CHECK BOOKING OWNER
                // ==========================================

                const [lookup] =
                    await connection.query(
                        `
                        SELECT coach_id
                        FROM coach_bookings
                        WHERE id = ?
                        AND user_id = ?
                        LIMIT 1
                        `,
                        [bookingId, userId]
                    );

                if (!lookup.length) {

                    await connection.rollback();

                    return res.status(404).json({
                        success: false,
                        message: 'Booking not found.'
                    });
                }


                // ==========================================
                // LOCK COACH
                // ==========================================

                const [coaches] =
                    await connection.query(
                        `
                        SELECT id
                        FROM coach_profiles
                        WHERE id = ?
                        FOR UPDATE
                        `,
                        [lookup[0].coach_id]
                    );

                if (!coaches.length) {

                    await connection.rollback();

                    return res.status(409).json({
                        success: false,
                        message: 'Coach is no longer available.'
                    });
                }


                // ==========================================
                // READ BOOKING PAYMENT SESSION
                // ==========================================

                const [targetRows] =
                    await connection.query(
                        `
                        SELECT
                            id,
                            status,
                            payment_status,
                            stripe_checkout_session_id

                        FROM coach_bookings

                        WHERE id = ?
                        AND user_id = ?
                        `,
                        [bookingId, userId]
                    );

                const target = targetRows[0];

                if (
                    !target ||
                    target.status !== 'pending_payment' ||
                    target.payment_status === 'paid'
                ) {

                    await connection.rollback();

                    return res.status(409).json({
                        success: false,
                        message:
                            'This booking is no longer awaiting payment. Refresh your bookings.'
                    });
                }


                const sessionId =
                    target.stripe_checkout_session_id;

                let group = [];


                // ==========================================
                // EXISTING STRIPE PAYMENT SESSION
                // ==========================================

                if (sessionId) {

                    const [linked] =
                        await connection.query(
                            `
                            SELECT
                                id,
                                status,
                                payment_status

                            FROM coach_bookings

                            WHERE user_id = ?
                            AND stripe_checkout_session_id = ?

                            ORDER BY id ASC
                            FOR UPDATE
                            `,
                            [userId, sessionId]
                        );

                    if (
                        linked.some(row =>
                            row.status !== 'pending_payment' ||
                            row.payment_status === 'paid'
                        )
                    ) {

                        await connection.rollback();

                        return res.status(409).json({
                            success: false,
                            message:
                                'A booking in this payment group has changed status. Refresh first.'
                        });
                    }

                    group = linked;

                    if (
                        !group.some(
                            row => Number(row.id) === bookingId
                        )
                    ) {

                        await connection.rollback();

                        return res.status(409).json({
                            success: false,
                            message:
                                'Booking changed while cancelling. Refresh first.'
                        });
                    }

                    if (!stripe) {

                        await connection.rollback();

                        return res.status(503).json({
                            success: false,
                            message: 'Stripe is not configured.'
                        });
                    }


                    // Check Stripe before cancelling.
                    // Never cancel a completed payment.

                    const session =
                        await stripe.checkout.sessions.retrieve(
                            sessionId
                        );

                    if (
                        session.status === 'complete' ||
                        session.payment_status === 'paid'
                    ) {

                        await connection.rollback();

                        return res.status(409).json({
                            success: false,
                            message:
                                'Payment has already completed. Refresh your bookings.'
                        });
                    }


                    // Expire the Stripe Checkout first.
                    // This prevents payment after slots
                    // have been released.

                    if (session.status === 'open') {

                        await stripe.checkout.sessions.expire(
                            sessionId
                        );

                    } else if (session.status !== 'expired') {

                        await connection.rollback();

                        return res.status(409).json({
                            success: false,
                            message:
                                'Cannot cancel this Stripe session in its current state.'
                        });
                    }

                } else {

                    // ======================================
                    // NO STRIPE SESSION CREATED YET
                    // ======================================

                    const [locked] =
                        await connection.query(
                            `
                            SELECT
                                id,
                                status,
                                payment_status

                            FROM coach_bookings

                            WHERE id = ?
                            AND user_id = ?

                            FOR UPDATE
                            `,
                            [bookingId, userId]
                        );

                    if (
                        !locked.length ||
                        locked[0].status !== 'pending_payment' ||
                        locked[0].payment_status === 'paid'
                    ) {

                        await connection.rollback();

                        return res.status(409).json({
                            success: false,
                            message:
                                'Booking changed while cancelling. Refresh first.'
                        });
                    }

                    group = locked;
                }


                // ==========================================
                // CANCEL RESERVED BOOKINGS
                // ==========================================

                const ids =
                    group.map(row => Number(row.id));

                const placeholders =
                    ids.map(() => '?').join(',');

                const [result] =
                    await connection.query(
                        `
                        UPDATE coach_bookings

                        SET
                            status = 'cancelled',

                            payment_status = CASE
                                WHEN payment_status = 'pending'
                                    THEN 'unpaid'
                                ELSE payment_status
                            END

                        WHERE user_id = ?
                        AND status = 'pending_payment'
                        AND id IN (${placeholders})
                        `,
                        [userId, ...ids]
                    );

                if (result.affectedRows !== ids.length) {

                    throw new Error(
                        'Booking status changed while cancelling.'
                    );
                }

                await connection.commit();


                return res.json({

                    success: true,

                    count: ids.length,

                    cancelledBookingIds: ids,

                    message:
                        ids.length > 1
                            ? `${ids.length} linked pending bookings were cancelled.`
                            : 'Pending booking cancelled.'
                });

            } catch (error) {

                if (connection) {

                    try {
                        await connection.rollback();
                    } catch (rollbackError) {
                        console.error(
                            'Booking cancellation rollback:',
                            rollbackError
                        );
                    }
                }

                console.error(
                    'Cancel pending booking:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        'Unable to cancel the pending booking. Refresh and try again.'
                });

            } finally {

                if (connection) {
                    connection.release();
                }
            }
        }
    );


    return router;
}


// ======================================================
// EXPORT
// ======================================================

module.exports =
    createPendingPaymentActionsRouter;
