
const express = require('express');

// ======================================================
// WELLSMARTBOOK - ADMIN BOOKING TRANSACTIONS
// Read only: no changes to bookings or Stripe payments.
// ======================================================

function createAdminBookingTransactionsRouter({
    db,
    authenticateToken
}) {

    const router = express.Router();

    // ==================================================
    // MYSQL QUERY HELPER
    // ==================================================

    function query(sql, params = []) {

        return new Promise((resolve, reject) => {

            db.query(sql, params, (error, results) => {

                if (error) {
                    return reject(error);
                }

                resolve(results);
            });
        });
    }

    // ==================================================
    // ADMIN - GET BOOKING TRANSACTIONS
    //
    // GET /api/admin/booking-transactions
    // ==================================================

    router.get(
        '/admin/booking-transactions',

        authenticateToken,

        async (req, res) => {

            const adminId = Number(req.user?.id);

            // ==========================================
            // CHECK ADMIN ROLE
            // ==========================================

            if (
                req.user?.role !== 'admin' ||
                req.user?.purpose ===
                    'admin_password_change' ||
                !Number.isSafeInteger(adminId) ||
                adminId <= 0
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        'Administrator access required.'
                });
            }

            // ==========================================
            // GET SEARCH AND FILTER VALUES
            // ==========================================

            const search = String(
                req.query.search ?? ''
            ).trim();

            const status = String(
                req.query.status ?? 'all'
            ).trim().toLowerCase();

            const paymentStatus = String(
                req.query.paymentStatus ?? 'all'
            ).trim().toLowerCase();

            const page = Number(
                req.query.page ?? 1
            );

            const limit = Number(
                req.query.limit ?? 10
            );

            // ==========================================
            // ALLOWED BOOKING STATUSES
            // ==========================================

            const allowedStatuses = [
                'all',
                'pending_payment',
                'confirmed',
                'completed',
                'cancelled',
                'expired'
            ];

            // ==========================================
            // ALLOWED PAYMENT STATUSES
            // ==========================================

            const allowedPaymentStatuses = [
                'all',
                'unpaid',
                'pending',
                'paid'
            ];

            // ==========================================
            // VALIDATE FILTERS
            // ==========================================

            if (
                search.length > 100 ||
                !allowedStatuses.includes(status) ||
                !allowedPaymentStatuses.includes(
                    paymentStatus
                ) ||
                !Number.isSafeInteger(page) ||
                page < 1 ||
                page > 10000 ||
                !Number.isSafeInteger(limit) ||
                limit < 1 ||
                limit > 50
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid search, status, payment status, page or limit.'
                });
            }

            try {

                // ======================================
                // VERIFY ACTIVE ADMIN IN MYSQL
                // ======================================

                const adminRows = await query(
                    `
                    SELECT id
                    FROM users
                    WHERE id = ?
                      AND role = 'admin'
                      AND is_active = 1
                    LIMIT 1
                    `,
                    [adminId]
                );

                if (!adminRows.length) {

                    return res.status(403).json({
                        success: false,
                        message:
                            'Administrator access has been revoked.'
                    });
                }

                // ======================================
                // OVERALL BOOKING STATISTICS
                //
                // Not affected by search filters.
                // ======================================

                const summaryRows = await query(
                    `
                    SELECT

                        COUNT(*)
                            AS total_bookings,

                        COALESCE(
                            SUM(status = 'confirmed'),
                            0
                        ) AS confirmed_bookings,

                        COALESCE(
                            SUM(status = 'completed'),
                            0
                        ) AS completed_bookings,

                        COALESCE(
                            SUM(status = 'pending_payment'),
                            0
                        ) AS pending_bookings,

                        COALESCE(
                            SUM(status = 'cancelled'),
                            0
                        ) AS cancelled_bookings,

                        COALESCE(
                            SUM(status = 'expired'),
                            0
                        ) AS expired_bookings,

                        COALESCE(
                            SUM(payment_status = 'paid'),
                            0
                        ) AS paid_bookings

                    FROM coach_bookings
                    `
                );

                // ======================================
                // PAID TOTALS BY CURRENCY
                //
                // Do not mix MYR and other currencies.
                // ======================================

                const paidCurrencyRows = await query(
                    `
                    SELECT

                        currency,

                        COUNT(*) AS paid_count,

                        COALESCE(
                            SUM(amount),
                            0
                        ) AS paid_amount

                    FROM coach_bookings

                    WHERE payment_status = 'paid'

                    GROUP BY currency

                    ORDER BY currency ASC
                    `
                );

                // ======================================
                // BUILD FILTERED QUERY
                // ======================================

                let whereSql = 'WHERE 1 = 1';

                const params = [];

                // ======================================
                // BOOKING STATUS FILTER
                // ======================================

                if (status !== 'all') {

                    whereSql +=
                        ' AND cb.status = ?';

                    params.push(status);
                }

                // ======================================
                // PAYMENT STATUS FILTER
                // ======================================

                if (paymentStatus !== 'all') {

                    whereSql +=
                        ' AND cb.payment_status = ?';

                    params.push(paymentStatus);
                }

                // ======================================
                // SEARCH CUSTOMER / COACH / GYM
                // ======================================

                if (search) {

                    // Escape special LIKE characters.

                    const escaped = search.replace(
                        /[!%_]/g,
                        '!$&'
                    );

                    const keyword =
                        `%${escaped}%`;

                    whereSql += `
                        AND (
                            customer.full_name
                                LIKE ? ESCAPE '!'

                            OR customer.email
                                LIKE ? ESCAPE '!'

                            OR coach_user.full_name
                                LIKE ? ESCAPE '!'

                            OR g.name
                                LIKE ? ESCAPE '!'
                        )
                    `;

                    params.push(
                        keyword,
                        keyword,
                        keyword,
                        keyword
                    );
                }

                // ======================================
                // JOIN BOOKING RELATED TABLES
                // ======================================

                const joins = `
                    FROM coach_bookings cb

                    LEFT JOIN users customer
                        ON customer.id = cb.user_id

                    LEFT JOIN coach_profiles cp
                        ON cp.id = cb.coach_id

                    LEFT JOIN users coach_user
                        ON coach_user.id = cp.user_id

                    LEFT JOIN gyms g
                        ON g.id = cb.gym_id
                `;

                // ======================================
                // COUNT MATCHING BOOKINGS
                // ======================================

                const countRows = await query(
                    `
                    SELECT COUNT(*) AS total

                    ${joins}

                    ${whereSql}
                    `,
                    params
                );

                const total = Number(
                    countRows[0]?.total ?? 0
                );

                const offset =
                    (page - 1) * limit;

                // ======================================
                // FETCH BOOKING TRANSACTIONS
                // ======================================

                const rows = await query(
                    `
                    SELECT

                        cb.id AS booking_id,

                        cb.user_id,
                        cb.coach_id,
                        cb.gym_id,

                        customer.full_name
                            AS customer_name,

                        customer.email
                            AS customer_email,

                        coach_user.full_name
                            AS coach_name,

                        g.name
                            AS gym_name,

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
                        cb.payment_status

                    ${joins}

                    ${whereSql}

                    ORDER BY
                        cb.session_date DESC,
                        cb.start_time DESC,
                        cb.id DESC

                    LIMIT ? OFFSET ?
                    `,
                    [
                        ...params,
                        limit,
                        offset
                    ]
                );

                // ======================================
                // FORMAT BOOKING SUMMARY
                // ======================================

                const s = summaryRows[0] || {};

                // ======================================
                // SUCCESS RESPONSE
                // ======================================

                return res.json({

                    success: true,

                    summary: {

                        totalBookings:
                            Number(
                                s.total_bookings ?? 0
                            ),

                        confirmedBookings:
                            Number(
                                s.confirmed_bookings ?? 0
                            ),

                        completedBookings:
                            Number(
                                s.completed_bookings ?? 0
                            ),

                        pendingBookings:
                            Number(
                                s.pending_bookings ?? 0
                            ),

                        cancelledBookings:
                            Number(
                                s.cancelled_bookings ?? 0
                            ),

                        expiredBookings:
                            Number(
                                s.expired_bookings ?? 0
                            ),

                        paidBookings:
                            Number(
                                s.paid_bookings ?? 0
                            ),

                        paidTotalsByCurrency:
                            paidCurrencyRows.map(
                                row => ({

                                    currency:
                                        row.currency || 'MYR',

                                    bookingCount:
                                        Number(
                                            row.paid_count ?? 0
                                        ),

                                    amount:
                                        Number(
                                            row.paid_amount ?? 0
                                        )
                                })
                            )
                    },

                    pagination: {

                        page,

                        limit,

                        total,

                        totalPages:
                            Math.ceil(total / limit)
                    },

                    bookings: rows.map(
                        row => ({

                            bookingId:
                                Number(row.booking_id),

                            userId:
                                Number(row.user_id),

                            coachId:
                                Number(row.coach_id),

                            gymId:
                                Number(row.gym_id),

                            customerName:
                                row.customer_name ||
                                'Unknown user',

                            customerEmail:
                                row.customer_email || '',

                            coachName:
                                row.coach_name ||
                                'Unknown coach',

                            gymName:
                                row.gym_name ||
                                'Unknown gym',

                            sessionDate:
                                row.session_date,

                            startTime:
                                row.start_time,

                            endTime:
                                row.end_time,

                            durationMinutes:
                                Number(
                                    row.session_duration_minutes ?? 0
                                ),

                            amount:
                                Number(row.amount ?? 0),

                            currency:
                                row.currency || 'MYR',

                            status:
                                row.status,

                            paymentStatus:
                                row.payment_status

                        })
                    )

                });

            } catch (error) {

                console.error(
                    'Admin booking transactions:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        'Unable to load booking transactions.'
                });
            }
        }
    );

    return router;
}

// ======================================================
// EXPORT ROUTER
// ======================================================

module.exports =
    createAdminBookingTransactionsRouter;
