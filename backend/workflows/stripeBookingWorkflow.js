
const {
    getStripeBookingIds
} = require('../helpers/stripeHelpers');

const {
    sendBookingConfirmationEmail
} = require('../helpers/bookingEmailHelpers');

// ======================================================
// STRIPE BOOKING WORKFLOW
// ======================================================

function createStripeBookingWorkflow({
    bookingPool,
    transporter
}) {

    // ==================================================
    // CONFIRM A PAID CHECKOUT SESSION
    // ==================================================

    async function confirmStripeBooking(session) {

        if (
            !session ||
            !session.id ||
            session.payment_status !== 'paid'
        ) {
            throw new Error('Stripe session is not paid.');
        }

        const bookingIds = getStripeBookingIds(session);

        if (bookingIds.length === 0) {
            throw new Error(
                'Stripe session has no valid booking ID.'
            );
        }

        const placeholders =
            bookingIds.map(() => '?').join(',');

        const bookingDb =
            await bookingPool.promise().getConnection();

        let transactionStarted = false;
        let emailBookings = [];

        try {

            await bookingDb.beginTransaction();
            transactionStarted = true;

            // ==========================================
            // LOOK UP COACH IDS
            // ==========================================

            const [lookupRows] = await bookingDb.query(
                `
                SELECT id, coach_id
                FROM coach_bookings
                WHERE id IN (${placeholders})
                ORDER BY id ASC
                `,
                bookingIds
            );

            if (lookupRows.length !== bookingIds.length) {
                throw new Error(
                    'One or more Stripe bookings were not found.'
                );
            }

            const coachIds = [...new Set(
                lookupRows.map(
                    row => Number(row.coach_id)
                )
            )].sort((a, b) => a - b);

            const coachPlaceholders =
                coachIds.map(() => '?').join(',');

            // ==========================================
            // LOCK COACH PROFILES
            // ==========================================

            const [coachRows] = await bookingDb.query(
                `
                SELECT id
                FROM coach_profiles
                WHERE id IN (${coachPlaceholders})
                ORDER BY id ASC
                FOR UPDATE
                `,
                coachIds
            );

            if (coachRows.length !== coachIds.length) {
                throw new Error(
                    'One or more coaches were not found.'
                );
            }

            // ==========================================
            // LOCK BOOKING ROWS
            // ==========================================

            const [lockedBookings] = await bookingDb.query(
                `
                SELECT
                    id,
                    status,
                    payment_status,
                    stripe_checkout_session_id

                FROM coach_bookings

                WHERE id IN (${placeholders})

                ORDER BY id ASC
                FOR UPDATE
                `,
                bookingIds
            );

            if (lockedBookings.length !== bookingIds.length) {
                throw new Error(
                    'One or more Stripe bookings disappeared during confirmation.'
                );
            }

            // ==========================================
            // VERIFY STRIPE SESSION OWNERSHIP
            // ==========================================

            const allSessionIdsMatch =
                lockedBookings.every(
                    booking =>
                        booking.stripe_checkout_session_id ===
                        session.id
                );

            if (!allSessionIdsMatch) {

                console.error(
                    'STRIPE PAYMENT REVIEW REQUIRED: Session mismatch',
                    {
                        sessionId: session.id,
                        bookingIds
                    }
                );

                throw new Error(
                    'Stripe Checkout does not match the booking payment session.'
                );
            }

            // ==========================================
            // PREVENT DUPLICATE WEBHOOK CONFIRMATION
            // ==========================================

            const alreadyConfirmed =
                lockedBookings.every(
                    booking =>
                        booking.status === 'confirmed' &&
                        booking.payment_status === 'paid'
                );

            if (alreadyConfirmed) {

                await bookingDb.commit();
                transactionStarted = false;

                return;
            }

            // ==========================================
            // CHECK ALL BOOKINGS ARE STILL PENDING
            //
            // Cancelled or expired bookings must never
            // become confirmed again.
            // ==========================================

            const allStillPending =
                lockedBookings.every(
                    booking =>
                        booking.status === 'pending_payment' &&
                        ['unpaid', 'pending'].includes(
                            booking.payment_status
                        )
                );

            if (!allStillPending) {

                console.error(
                    'STRIPE PAYMENT REVIEW REQUIRED: Paid session has non-pending bookings',
                    {
                        sessionId: session.id,
                        bookingIds,
                        states: lockedBookings.map(
                            row => ({
                                id: row.id,
                                status: row.status,
                                paymentStatus: row.payment_status
                            })
                        )
                    }
                );

                throw new Error(
                    'Paid Stripe session conflicts with booking state; manual payment review required.'
                );
            }

            // ==========================================
            // CONFIRM ALL PAID BOOKINGS
            // ==========================================

            const [updateResult] = await bookingDb.query(
                `
                UPDATE coach_bookings

                SET
                    status = 'confirmed',

                    payment_status = 'paid',

                    stripe_checkout_session_id = ?,

                    stripe_payment_intent_id = ?,

                    hold_expires_at = NULL

                WHERE id IN (${placeholders})

                AND stripe_checkout_session_id = ?

                AND status = 'pending_payment'

                AND payment_status IN (
                    'unpaid',
                    'pending'
                )
                `,
                [
                    session.id,

                    typeof session.payment_intent === 'string'
                        ? session.payment_intent
                        : null,

                    ...bookingIds,

                    session.id
                ]
            );

            if (
                updateResult.affectedRows !==
                bookingIds.length
            ) {
                throw new Error(
                    'Some booking statuses changed during payment confirmation.'
                );
            }

            // ==========================================
            // LOAD BOOKING DETAILS FOR EMAIL
            // ==========================================

            const [details] = await bookingDb.query(
                `
                SELECT

                    cb.id,

                    DATE_FORMAT(
                        cb.session_date,
                        '%Y-%m-%d'
                    ) AS session_date,

                    TIME_FORMAT(
                        cb.start_time,
                        '%H:%i'
                    ) AS start_time,

                    TIME_FORMAT(
                        cb.end_time,
                        '%H:%i'
                    ) AS end_time,

                    cb.session_duration_minutes,

                    cb.amount,
                    cb.currency,

                    customer.full_name AS client_name,

                    customer.username,

                    customer.email AS client_email,

                    coach_user.full_name AS coach_name,

                    g.name AS gym_name,

                    CONCAT_WS(
                        ', ',
                        NULLIF(g.address_line1, ''),
                        NULLIF(g.address_line2, ''),
                        NULLIF(g.city, ''),
                        NULLIF(g.state, ''),
                        NULLIF(g.postcode, ''),
                        NULLIF(g.country, '')
                    ) AS gym_address

                FROM coach_bookings cb

                INNER JOIN users customer
                    ON customer.id = cb.user_id

                INNER JOIN coach_profiles cp
                    ON cp.id = cb.coach_id

                INNER JOIN users coach_user
                    ON coach_user.id = cp.user_id

                INNER JOIN gyms g
                    ON g.id = cb.gym_id

                WHERE cb.id IN (${placeholders})

                ORDER BY
                    cb.session_date ASC,
                    cb.start_time ASC
                `,
                bookingIds
            );

            emailBookings = details;

            // ==========================================
            // COMMIT CONFIRMED BOOKINGS
            // ==========================================

            await bookingDb.commit();
            transactionStarted = false;

            console.log(
                `✅ Stripe booking(s) confirmed: ${bookingIds.join(', ')}`
            );

        } catch (error) {

            if (transactionStarted) {

                try {
                    await bookingDb.rollback();
                } catch (rollbackError) {
                    console.error(
                        'Stripe confirmation rollback:',
                        rollbackError
                    );
                }
            }

            throw error;

        } finally {

            bookingDb.release();
        }

        // ==============================================
        // EMAIL FAILURE MUST NOT REVERSE PAYMENT
        // ==============================================

        try {

            await sendBookingConfirmationEmail(
                transporter,
                emailBookings,
                session
            );

            console.log(
                `✅ Confirmation email sent: ${bookingIds.join(', ')}`
            );

        } catch (emailError) {

            console.error(
                'Payment confirmation email failed:',
                emailError
            );
        }
    }

    // ==================================================
    // EXPIRE UNPAID STRIPE CHECKOUT SESSION
    // ==================================================

    async function expireStripeBooking(session) {

        const bookingIds =
            getStripeBookingIds(session);

        if (bookingIds.length === 0) {
            return;
        }

        const placeholders =
            bookingIds.map(() => '?').join(',');

        // Only unpaid, pending bookings belonging
        // to this Stripe session may expire.
        // Cancelled and confirmed rows remain unchanged.

        await bookingPool.promise().query(
            `
            UPDATE coach_bookings

            SET
                status = 'expired',

                payment_status = 'unpaid'

            WHERE id IN (${placeholders})

            AND stripe_checkout_session_id = ?

            AND status = 'pending_payment'

            AND payment_status IN (
                'unpaid',
                'pending'
            )
            `,
            [
                ...bookingIds,
                session.id
            ]
        );

        console.log(
            `ℹ Stripe checkout expired: ${bookingIds.join(', ')}`
        );
    }

    // ==================================================
    // EXPORT WORKFLOW FUNCTIONS
    // ==================================================

    return {
        confirmStripeBooking,
        expireStripeBooking
    };
}

module.exports = createStripeBookingWorkflow;
