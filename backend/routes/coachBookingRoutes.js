
const express = require('express');

const {
    isValidDateOnly
} = require('../helpers/bookingHelpers');

// ======================================================
// COACH BOOKING ROUTES
// ======================================================

function createCoachBookingRouter({
    db,
    authenticateToken,
    authenticateActiveCoach
}) {

    const router = express.Router();

    // ==================================================
    // COACH - GET UPCOMING CONFIRMED SESSIONS
    // FROM ALL GYM LOCATIONS
    // ==================================================

    router.get(
        '/coach/bookings/upcoming',
        authenticateToken,
        authenticateActiveCoach,

        (req, res) => {

            const coachId = Number(req.coach?.id);

            if (
                !Number.isSafeInteger(coachId) ||
                coachId <= 0
            ) {
                return res.status(403).json({
                    success: false,
                    message: 'Coach profile is unavailable.'
                });
            }

            // Get current date and time in Malaysia.

            const dateParts = Object.fromEntries(
                new Intl.DateTimeFormat('en-GB', {
                    timeZone: 'Asia/Kuala_Lumpur',
                    hourCycle: 'h23',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                })
                .formatToParts(new Date())
                .filter(part => part.type !== 'literal')
                .map(part => [part.type, part.value])
            );

            const today =
                `${dateParts.year}-${dateParts.month}-${dateParts.day}`;

            const currentTime =
                `${dateParts.hour}:${dateParts.minute}:00`;

            // ==========================================
            // SELECT UPCOMING BOOKINGS
            // ==========================================

            const sql = `
                SELECT
                    cb.id AS booking_id,

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
                    cb.status,

                    u.full_name AS client_name,
                    g.name AS gym_name

                FROM coach_bookings cb

                INNER JOIN users u
                    ON u.id = cb.user_id

                INNER JOIN gyms g
                    ON g.id = cb.gym_id

                WHERE cb.coach_id = ?

                AND cb.status = 'confirmed'

                AND (
                    cb.session_date > ?

                    OR (
                        cb.session_date = ?
                        AND cb.end_time > ?
                    )
                )

                ORDER BY
                    cb.session_date ASC,
                    cb.start_time ASC,
                    cb.id ASC

                LIMIT 6
            `;

            db.query(
                sql,
                [
                    coachId,
                    today,
                    today,
                    currentTime
                ],

                (error, rows) => {

                    if (error) {
                        console.error(
                            'Upcoming coach bookings:',
                            error
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                'Unable to load upcoming coaching sessions.'
                        });
                    }

                    return res.json({
                        success: true,

                        count: rows.length,

                        bookings: rows.map(row => ({
                            bookingId: row.booking_id,

                            sessionDate: row.session_date,

                            startTime: row.start_time,

                            endTime: row.end_time,

                            durationMinutes: Number(
                                row.session_duration_minutes || 0
                            ),

                            clientName: row.client_name,

                            gymName: row.gym_name,

                            status: row.status
                        }))
                    });
                }
            );
        }
    );

    // ==================================================
    // COACH - GET REAL BOOKINGS FOR SELECTED GYM
    // AND SELECTED DATE RANGE
    // ==================================================

    router.get(
        '/coach/bookings',

        authenticateToken,
        authenticateActiveCoach,

        (req, res) => {

            const coachId = Number(
                req.coach.id
            );

            const gymId = Number(
                req.query.gymId
            );

            const startDate = String(
                req.query.startDate || ''
            ).trim();

            const endDate = String(
                req.query.endDate || ''
            ).trim();

            // ==========================================
            // VALIDATE GYM
            // ==========================================

            if (
                !Number.isInteger(gymId) ||
                gymId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid gym ID.'
                });
            }

            // ==========================================
            // VALIDATE DATE RANGE
            // ==========================================

            if (
                !isValidDateOnly(startDate) ||
                !isValidDateOnly(endDate)
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'A valid booking date range is required.'
                });
            }

            if (endDate < startDate) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid booking date range.'
                });
            }

            // ==========================================
            // EXPIRE OLD PAYMENT HOLDS
            // ==========================================

            db.query(
                `
                UPDATE coach_bookings

                SET status = 'expired'

                WHERE coach_id = ?

                AND status = 'pending_payment'

                AND hold_expires_at IS NOT NULL

                AND hold_expires_at <= NOW()
                `,
                [coachId],

                (expireError) => {

                    if (expireError) {
                        console.error(
                            'Expire coach booking holds:',
                            expireError
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                'Unable to refresh coach bookings.'
                        });
                    }

                    // ==================================
                    // LOAD COACH BOOKINGS
                    // ==================================

                    db.query(
                        `
                        SELECT
                            cb.id,
                            cb.user_id,
                            cb.coach_id,
                            cb.gym_id,

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
                            cb.status,
                            cb.payment_status,

                            DATE_FORMAT(
                                cb.hold_expires_at,
                                '%Y-%m-%d %H:%i:%s'
                            ) AS hold_expires_at,

                            UNIX_TIMESTAMP(
                                cb.hold_expires_at
                            ) AS hold_expires_at_unix,

                            u.full_name AS client_name,
                            g.name AS gym_name

                        FROM coach_bookings cb

                        INNER JOIN users u
                            ON u.id = cb.user_id

                        INNER JOIN gyms g
                            ON g.id = cb.gym_id

                        WHERE cb.coach_id = ?

                        AND cb.gym_id = ?

                        AND cb.session_date
                            BETWEEN ? AND ?

                        AND (
                            cb.status IN (
                                'confirmed',
                                'completed'
                            )

                            OR (
                                cb.status = 'pending_payment'

                                AND cb.hold_expires_at
                                    IS NOT NULL

                                AND cb.hold_expires_at
                                    > NOW()
                            )
                        )

                        ORDER BY
                            cb.session_date ASC,
                            cb.start_time ASC
                        `,
                        [
                            coachId,
                            gymId,
                            startDate,
                            endDate
                        ],

                        (bookingError, bookings) => {

                            if (bookingError) {
                                console.error(
                                    'Load coach bookings:',
                                    bookingError
                                );

                                return res.status(500).json({
                                    success: false,
                                    message:
                                        'Unable to load coach bookings.'
                                });
                            }

                            return res.json({
                                success: true,

                                count: bookings.length,

                                bookings: bookings.map(
                                    booking => ({
                                        bookingId: booking.id,

                                        userId: booking.user_id,

                                        clientName:
                                            booking.client_name,

                                        coachId: booking.coach_id,

                                        gymId: booking.gym_id,

                                        gymName: booking.gym_name,

                                        sessionDate:
                                            booking.session_date,

                                        startTime:
                                            booking.start_time,

                                        endTime:
                                            booking.end_time,

                                        durationMinutes: Number(
                                            booking.session_duration_minutes || 0
                                        ),

                                        amount: Number(
                                            booking.amount || 0
                                        ),

                                        currency:
                                            booking.currency || 'MYR',

                                        status: booking.status,

                                        paymentStatus:
                                            booking.payment_status,

                                        holdExpiresAt:
                                            booking.hold_expires_at,

                                        holdExpiresAtUnix:
                                            booking.hold_expires_at_unix !== null
                                                ? Number(
                                                    booking.hold_expires_at_unix
                                                )
                                                : null
                                    })
                                )
                            });
                        }
                    );
                }
            );
        }
    );

    // ==================================================
    // USER - GET OWN BOOKINGS AND BOOKING HISTORY
    // ==================================================

    router.get(
        '/bookings/my',

        authenticateToken,

        (req, res) => {

            // ==========================================
            // ONLY NORMAL USERS
            // ==========================================

            if (
                !req.user ||
                req.user.role !== 'user'
            ) {
                return res.status(403).json({
                    success: false,
                    message:
                        'Only user accounts can view their bookings.'
                });
            }

            // ==========================================
            // GET LOGGED-IN USER ID
            // ==========================================

            const userId = Number(
                req.user.id
            );

            if (
                !Number.isInteger(userId) ||
                userId <= 0
            ) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid user session.'
                });
            }

            // ==========================================
            // SQL QUERY
            // ==========================================

            const sql = `
                SELECT

                    cb.id AS booking_id,

                    cb.coach_id,
                    cb.gym_id,

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

                    cb.status,
                    cb.payment_status,

                    UNIX_TIMESTAMP(
                        cb.hold_expires_at
                    ) AS hold_expires_at_unix,

                    CASE
                        WHEN cb.stripe_checkout_session_id IS NULL
                            THEN 1

                        ELSE (
                            SELECT COUNT(*)

                            FROM coach_bookings linked

                            WHERE linked.user_id = cb.user_id

                            AND linked.stripe_checkout_session_id =
                                cb.stripe_checkout_session_id

                            AND linked.status = 'pending_payment'
                        )

                    END AS linked_pending_count,

                    coach_user.full_name AS coach_name,
                    g.name AS gym_name

                FROM coach_bookings cb

                INNER JOIN coach_profiles cp
                    ON cp.id = cb.coach_id

                INNER JOIN users coach_user
                    ON coach_user.id = cp.user_id

                INNER JOIN gyms g
                    ON g.id = cb.gym_id

                WHERE cb.user_id = ?

                ORDER BY
                    cb.session_date DESC,
                    cb.start_time DESC,
                    cb.id DESC
            `;

            // ==========================================
            // EXECUTE QUERY
            // ==========================================

            db.query(
                sql,
                [userId],

                (error, rows) => {

                    if (error) {
                        console.error(
                            'Load user coach bookings:',
                            error
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                'Unable to load your bookings.'
                        });
                    }

                    return res.json({
                        success: true,

                        count: rows.length,

                        bookings: rows.map(
                            booking => ({
                                bookingId:
                                    booking.booking_id,

                                coachId:
                                    booking.coach_id,

                                coachName:
                                    booking.coach_name,

                                gymId:
                                    booking.gym_id,

                                gymName:
                                    booking.gym_name,

                                sessionDate:
                                    booking.session_date,

                                startTime:
                                    booking.start_time,

                                endTime:
                                    booking.end_time,

                                durationMinutes:
                                    Number(
                                        booking.session_duration_minutes || 0
                                    ),

                                amount:
                                    Number(
                                        booking.amount || 0
                                    ),

                                currency:
                                    booking.currency || 'MYR',

                                status:
                                    booking.status,

                                paymentStatus:
                                    booking.payment_status,

                                holdExpiresAtUnix:
                                    booking.hold_expires_at_unix === null
                                        ? null
                                        : Number(
                                            booking.hold_expires_at_unix
                                        ),

                                linkedPendingCount:
                                    Number(
                                        booking.linked_pending_count || 1
                                    )
                            })
                        )
                    });
                }
            );
        }
    );

    return router;
}

// ======================================================
// EXPORT
// ======================================================

module.exports = createCoachBookingRouter;
