
const express = require('express');

// ======================================================
// WELLSMARTBOOK - ADMIN DASHBOARD API
// ======================================================

function createAdminDashboardRouter({
    db,
    authenticateToken
}) {

    const router = express.Router();

    // ==================================================
    // ADMIN - GET DASHBOARD STATISTICS
    //
    // GET /api/admin/dashboard
    // ==================================================

    router.get(
        '/admin/dashboard',
        authenticateToken,

        (req, res) => {

            // ==========================================
            // VERIFY JWT ADMIN ROLE
            // ==========================================

            const adminId = Number(req.user?.id);

            if (
                req.user?.role !== 'admin' ||
                !Number.isSafeInteger(adminId) ||
                adminId <= 0
            ) {

                return res.status(403).json({
                    success: false,
                    message: 'Administrator access required.'
                });
            }

            // ==========================================
            // VERIFY ADMIN STILL EXISTS IN MYSQL
            // ==========================================

            db.query(
                `
                SELECT id
                FROM users
                WHERE id = ?
                  AND role = 'admin'
                LIMIT 1
                `,
                [adminId],

                (authError, adminRows) => {

                    if (authError) {

                        console.error(
                            'Admin authorization:',
                            authError
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                'Unable to verify administrator access.'
                        });
                    }

                    if (!adminRows.length) {

                        return res.status(403).json({
                            success: false,
                            message:
                                'Administrator access has been revoked.'
                        });
                    }

                    // ==================================
                    // CALCULATE REAL DASHBOARD COUNTS
                    // ==================================

                    const summarySql = `
                        SELECT

                            (
                                SELECT COUNT(*)
                                FROM users
                                WHERE role = 'user'
                            ) AS total_users,

                            (
                                SELECT COUNT(*)
                                FROM users
                                WHERE role = 'coach'
                            ) AS total_coaches,

                            (
                                SELECT COUNT(*)
                                FROM gyms
                            ) AS registered_gyms,

                            (
                                SELECT COUNT(*)
                                FROM coach_bookings
                            ) AS total_bookings
                    `;

                    // ==================================
                    // EXECUTE MYSQL QUERY
                    // ==================================

                    db.query(
                        summarySql,

                        (summaryError, rows) => {

                            if (summaryError) {

                                console.error(
                                    'Admin dashboard summary:',
                                    summaryError
                                );

                                return res.status(500).json({
                                    success: false,
                                    message:
                                        'Unable to load admin dashboard statistics.'
                                });
                            }

                            const row = rows[0] || {};

                            // ==========================
                            // SEND STATISTICS TO FRONTEND
                            // ==========================

                            return res.json({
                                success: true,

                                summary: {

                                    totalUsers: Number(
                                        row.total_users || 0
                                    ),

                                    totalCoaches: Number(
                                        row.total_coaches || 0
                                    ),

                                    registeredGyms: Number(
                                        row.registered_gyms || 0
                                    ),

                                    totalBookings: Number(
                                        row.total_bookings || 0
                                    )
                                }
                            });
                        }
                    );
                }
            );
        }
    );

    return router;
}

// ======================================================
// EXPORT ROUTER
// ======================================================

module.exports = createAdminDashboardRouter;
