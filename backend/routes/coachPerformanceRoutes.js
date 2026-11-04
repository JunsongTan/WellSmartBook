
const express = require('express');

// ======================================================
// COACH PERFORMANCE - REAL MYSQL BOOKING DATA
// ======================================================

function dateKey(date) {
    return [
        date.getUTCFullYear(),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0')
    ].join('-');
}

function malaysiaNow() {
    const parts = Object.fromEntries(
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
            .filter(item => item.type !== 'literal')
            .map(item => [item.type, item.value])
    );

    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        today: `${parts.year}-${parts.month}-${parts.day}`,
        time: `${parts.hour}:${parts.minute}:00`
    };
}

function createCoachPerformanceRouter({
    db,
    authenticateToken,
    authenticateActiveCoach
}) {
    const router = express.Router();

    router.get(
        '/coach/performance',
        authenticateToken,
        authenticateActiveCoach,
        (req, res) => {
            const coachId = Number(req.coach?.id);

            if (!Number.isSafeInteger(coachId) || coachId <= 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Coach profile is unavailable.'
                });
            }

            const now = malaysiaNow();

            const localDate = new Date(
                Date.UTC(now.year, now.month - 1, now.day)
            );

            const monday = new Date(localDate);

            monday.setUTCDate(
                localDate.getUTCDate() -
                ((localDate.getUTCDay() + 6) % 7)
            );

            const nextMonday = new Date(monday);

            nextMonday.setUTCDate(
                monday.getUTCDate() + 7
            );

            const startMonth =
                `${now.year}-${String(now.month).padStart(2, '0')}-01`;

            const nextMonth = dateKey(
                new Date(Date.UTC(now.year, now.month, 1))
            );

            const firstChartMonth = new Date(
                Date.UTC(now.year, now.month - 6, 1)
            );

            const chartStart = dateKey(firstChartMonth);

            // ==========================================
            // 1. COACH PERFORMANCE SUMMARY
            // ==========================================

            const summarySql = `
                SELECT
                    COUNT(DISTINCT CASE
                        WHEN status IN ('confirmed', 'completed')
                        THEN user_id
                    END) AS unique_clients,

                    SUM(CASE
                        WHEN status IN ('confirmed', 'completed')
                         AND session_date >= ?
                         AND session_date < ?
                        THEN 1 ELSE 0
                    END) AS sessions_this_week,

                    SUM(CASE
                        WHEN status = 'confirmed'
                         AND session_date = ?
                         AND end_time > ?
                        THEN 1 ELSE 0
                    END) AS upcoming_today,

                    SUM(CASE
                        WHEN status = 'completed'
                        THEN 1 ELSE 0
                    END) AS completed_all_time,

                    SUM(CASE
                        WHEN status IN ('confirmed', 'completed')
                         AND session_date >= ?
                         AND session_date < ?
                         AND payment_status = 'paid'
                        THEN amount ELSE 0
                    END) AS paid_value_this_month

                FROM coach_bookings
                WHERE coach_id = ?
            `;

            const summaryValues = [
                dateKey(monday),
                dateKey(nextMonday),
                now.today,
                now.time,
                startMonth,
                nextMonth,
                coachId
            ];

            db.query(
                summarySql,
                summaryValues,
                (summaryError, summaryRows) => {

                    if (summaryError) {
                        console.error(
                            'Coach performance summary:',
                            summaryError
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                'Unable to load coach performance.'
                        });
                    }

                    // ==================================
                    // 2. LAST SIX MONTHS CHART DATA
                    // ==================================

                    const chartSql = `
                        SELECT
                            DATE_FORMAT(
                                session_date,
                                '%Y-%m'
                            ) AS month_key,

                            COUNT(*) AS session_count,

                            COALESCE(SUM(CASE
                                WHEN payment_status = 'paid'
                                THEN amount ELSE 0
                            END), 0) AS paid_session_value

                        FROM coach_bookings

                        WHERE coach_id = ?

                        AND status IN (
                            'confirmed',
                            'completed'
                        )

                        AND session_date >= ?
                        AND session_date < ?

                        GROUP BY
                            DATE_FORMAT(session_date, '%Y-%m')

                        ORDER BY month_key ASC
                    `;

                    db.query(
                        chartSql,
                        [coachId, chartStart, nextMonth],
                        (chartError, chartRows) => {

                            if (chartError) {
                                console.error(
                                    'Coach performance chart:',
                                    chartError
                                );

                                return res.status(500).json({
                                    success: false,
                                    message:
                                        'Unable to load performance chart.'
                                });
                            }

                            // ==========================
                            // 3. RECENT COACH SESSIONS
                            // ==========================

                            const recentSql = `
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

                                    u.full_name AS client_name,
                                    g.name AS gym_name,

                                    cb.status,
                                    cb.payment_status,
                                    cb.amount

                                FROM coach_bookings cb

                                INNER JOIN users u
                                    ON u.id = cb.user_id

                                INNER JOIN gyms g
                                    ON g.id = cb.gym_id

                                WHERE cb.coach_id = ?

                                AND cb.status IN (
                                    'confirmed',
                                    'completed'
                                )

                                AND cb.session_date <= ?

                                ORDER BY
                                    cb.session_date DESC,
                                    cb.start_time DESC,
                                    cb.id DESC

                                LIMIT 8
                            `;

                            db.query(
                                recentSql,
                                [coachId, now.today],
                                (recentError, recentRows) => {

                                    if (recentError) {
                                        console.error(
                                            'Recent coach sessions:',
                                            recentError
                                        );

                                        return res.status(500).json({
                                            success: false,
                                            message:
                                                'Unable to load recent sessions.'
                                        });
                                    }

                                    const summary =
                                        summaryRows[0] || {};

                                    const chartByMonth = new Map(
                                        chartRows.map(row => [
                                            row.month_key,
                                            row
                                        ])
                                    );

                                    // Fill months that have no bookings
                                    // with zero values.

                                    const monthly = Array.from(
                                        { length: 6 },
                                        (_, i) => {

                                            const monthDate = new Date(
                                                Date.UTC(
                                                    firstChartMonth.getUTCFullYear(),
                                                    firstChartMonth.getUTCMonth() + i,
                                                    1
                                                )
                                            );

                                            const key =
                                                dateKey(monthDate).slice(0, 7);

                                            const found =
                                                chartByMonth.get(key);

                                            return {
                                                month: key,

                                                sessions: Number(
                                                    found?.session_count || 0
                                                ),

                                                paidSessionValue: Number(
                                                    found?.paid_session_value || 0
                                                )
                                            };
                                        }
                                    );

                                    // ======================
                                    // SEND RESPONSE
                                    // ======================

                                    return res.json({
                                        success: true,

                                        period: {
                                            month:
                                                startMonth.slice(0, 7),

                                            timezone:
                                                'Asia/Kuala_Lumpur'
                                        },

                                        summary: {
                                            sessionsThisWeek: Number(
                                                summary.sessions_this_week || 0
                                            ),

                                            uniqueClients: Number(
                                                summary.unique_clients || 0
                                            ),

                                            upcomingToday: Number(
                                                summary.upcoming_today || 0
                                            ),

                                            completedAllTime: Number(
                                                summary.completed_all_time || 0
                                            ),

                                            paidSessionValueThisMonth: Number(
                                                summary.paid_value_this_month || 0
                                            )
                                        },

                                        monthly,

                                        recentSessions:
                                            recentRows.map(row => ({
                                                bookingId:
                                                    row.booking_id,

                                                sessionDate:
                                                    row.session_date,

                                                startTime:
                                                    row.start_time,

                                                clientName:
                                                    row.client_name,

                                                gymName:
                                                    row.gym_name,

                                                status:
                                                    row.status,

                                                paymentStatus:
                                                    row.payment_status,

                                                amount: Number(
                                                    row.amount || 0
                                                )
                                            }))
                                    });
                                }
                            );
                        }
                    );
                }
            );
        }
    );

    return router;
}

module.exports = createCoachPerformanceRouter;
