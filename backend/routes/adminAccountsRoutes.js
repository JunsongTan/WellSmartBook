
const express = require('express');

// ======================================================
// WELLSMARTBOOK - ADMIN ACCOUNT MANAGEMENT
// READ-ONLY ACCOUNT LIST
//
// GET /api/admin/accounts
// ======================================================

function createAdminAccountsRouter({
    db,
    authenticateToken
}) {

    const router = express.Router();

    // ==================================================
    // GET USERS AND COACHES
    // ==================================================

    router.get(
        '/admin/accounts',
        authenticateToken,

        (req, res) => {

            // ==========================================
            // VERIFY ADMINISTRATOR JWT
            // ==========================================

            const adminId = Number(req.user?.id);

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
            // GET SEARCH AND FILTER PARAMETERS
            // ==========================================

            const role = String(
                req.query.role ?? 'all'
            ).trim().toLowerCase();

            const search = String(
                req.query.search ?? ''
            ).trim();

            const page = Number(
                req.query.page ?? 1
            );

            const limit = Number(
                req.query.limit ?? 10
            );

            // ==========================================
            // VALIDATE ROLE FILTER
            // ==========================================

            if (
                !['all', 'user', 'coach'].includes(role)
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        'Role must be all, user, or coach.'
                });
            }

            // ==========================================
            // VALIDATE SEARCH LENGTH
            // ==========================================

            if (search.length > 100) {

                return res.status(400).json({
                    success: false,
                    message:
                        'Search must contain 100 characters or fewer.'
                });
            }

            // ==========================================
            // VALIDATE PAGINATION
            // ==========================================

            if (
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
                        'Invalid page or limit.'
                });
            }

            const offset = (page - 1) * limit;

            // ==========================================
            // VERIFY ADMIN EXISTS IN MYSQL
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
                            'Admin accounts authorization:',
                            authError
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                'Unable to verify administrator access.'
                        });
                    }

                    if (!adminRows?.length) {

                        return res.status(403).json({
                            success: false,
                            message:
                                'Administrator access has been revoked.'
                        });
                    }

                    // ==================================
                    // BUILD SEARCH AND FILTER SQL
                    // ==================================

                    let whereClause = `
                        WHERE role IN ('user', 'coach')
                    `;

                    const whereParams = [];

                    // ==================================
                    // FILTER BY ACCOUNT ROLE
                    // ==================================

                    if (role !== 'all') {

                        whereClause += `
                            AND role = ?
                        `;

                        whereParams.push(role);
                    }

                    // ==================================
                    // SEARCH NAME, USERNAME OR EMAIL
                    // ==================================

                    if (search) {

                        // Escape SQL LIKE wildcards.

                        const escaped = search.replace(
                            /[!%_]/g,
                            '!$&'
                        );

                        const likeTerm = `%${escaped}%`;

                        whereClause += `
                            AND (
                                username LIKE ? ESCAPE '!'
                                OR full_name LIKE ? ESCAPE '!'
                                OR email LIKE ? ESCAPE '!'
                            )
                        `;

                        whereParams.push(
                            likeTerm,
                            likeTerm,
                            likeTerm
                        );
                    }

                    // ==================================
                    // COUNT MATCHING ACCOUNTS
                    // ==================================

                    const countSql = `
                        SELECT COUNT(*) AS total
                        FROM users
                        ${whereClause}
                    `;

                    db.query(
                        countSql,
                        whereParams,

                        (countError, countRows) => {

                            if (countError) {

                                console.error(
                                    'Admin accounts count:',
                                    countError
                                );

                                return res.status(500).json({
                                    success: false,
                                    message:
                                        'Unable to load account list.'
                                });
                            }

                            const total = Number(
                                countRows?.[0]?.total ?? 0
                            );

                            // ==========================
                            // LOAD CURRENT PAGE
                            // ==========================

                            const listSql = `
                                SELECT
                                    id,
                                    username,
                                    full_name,
                                    email,
                                    role,
                                    is_active
                                FROM users
                                ${whereClause}
                                ORDER BY id DESC
                                LIMIT ? OFFSET ?
                            `;

                            // ==========================
                            // EXECUTE SQL
                            // ==========================

                            db.query(
                                listSql,

                                [
                                    ...whereParams,
                                    limit,
                                    offset
                                ],

                                (listError, rows) => {

                                    if (listError) {

                                        console.error(
                                            'Admin accounts list:',
                                            listError
                                        );

                                        return res.status(500).json({
                                            success: false,
                                            message:
                                                'Unable to load account list.'
                                        });
                                    }

                                    // ==================
                                    // FORMAT ACCOUNTS
                                    // ==================

                                    const accounts = (
                                        rows || []
                                    ).map(account => ({

                                        id: Number(
                                            account.id
                                        ),

                                        username:
                                            account.username || '',

                                        fullName:
                                            account.full_name || '',

                                        email:
                                            account.email || '',

                                        role:
                                            account.role,
                                        
                                        isActive:
                                            Number(account.is_active) === 1
                                            
                                    }));

                                    // ==================
                                    // RESPONSE
                                    // ==================

                                    return res.json({

                                        success: true,

                                        accounts,

                                        pagination: {

                                            page,

                                            limit,

                                            total,

                                            totalPages:
                                                Math.ceil(
                                                    total / limit
                                                )
                                        }
                                    });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
    
    // ==================================================
    // ADMIN - ENABLE / DISABLE USER OR COACH
    //
    // PATCH /api/admin/accounts/:id/status
    // Body: { isActive: true } or { isActive: false }
    // ==================================================

    router.patch(
        '/admin/accounts/:id/status',
        authenticateToken,
        (req, res) => {

            const adminId = Number(req.user?.id);
            const accountId = Number(req.params.id);
            const desired = req.body?.isActive;

            // ==========================================
            // VERIFY ADMINISTRATOR ROLE
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
                    message: 'Administrator access required.'
                });
            }

            // ==========================================
            // VALIDATE TARGET ACCOUNT
            // ==========================================

            if (
                !Number.isSafeInteger(accountId) ||
                accountId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid account ID.'
                });
            }

            if (typeof desired !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    message: 'isActive must be true or false.'
                });
            }

            // ==========================================
            // VERIFY ADMIN IS STILL ACTIVE
            // ==========================================

            db.query(
                `
                SELECT id
                FROM users
                WHERE id = ?
                  AND role = 'admin'
                  AND is_active = 1
                LIMIT 1
                `,
                [adminId],

                (adminError, admins) => {

                    if (adminError) {
                        console.error(
                            'Admin status authorization:',
                            adminError
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                'Unable to verify administrator.'
                        });
                    }

                    if (!admins?.length) {
                        return res.status(403).json({
                            success: false,
                            message:
                                'Administrator access has been revoked.'
                        });
                    }

                    // ==================================
                    // FIND USER OR COACH ONLY
                    // ==================================

                    db.query(
                        `
                        SELECT
                            id,
                            username,
                            role,
                            is_active
                        FROM users
                        WHERE id = ?
                          AND role IN ('user', 'coach')
                        LIMIT 1
                        `,
                        [accountId],

                        (lookupError, rows) => {

                            if (lookupError) {
                                console.error(
                                    'Account status lookup:',
                                    lookupError
                                );

                                return res.status(500).json({
                                    success: false,
                                    message:
                                        'Unable to find account.'
                                });
                            }

                            const account = rows?.[0];

                            if (!account) {
                                return res.status(404).json({
                                    success: false,
                                    message:
                                        'User or coach account not found.'
                                });
                            }

                            const previousValue =
                                Number(account.is_active) === 1;

                            const resultAccount = {
                                id: Number(account.id),
                                username: account.username,
                                role: account.role,
                                isActive: desired
                            };

                            // ==========================
                            // ALREADY HAS THIS STATUS
                            // ==========================

                            if (previousValue === desired) {
                                return res.json({
                                    success: true,
                                    changed: false,
                                    account: resultAccount,
                                    message:
                                        'Account already has this status.'
                                });
                            }

                            // ==========================
                            // UPDATE STATUS IN MYSQL
                            // ==========================

                            db.query(
                                `
                                UPDATE users
                                SET is_active = ?
                                WHERE id = ?
                                  AND role IN ('user', 'coach')
                                  AND is_active = ?
                                `,
                                [
                                    desired ? 1 : 0,
                                    accountId,
                                    previousValue ? 1 : 0
                                ],

                                (updateError, result) => {

                                    if (updateError) {
                                        console.error(
                                            'Account status update:',
                                            updateError
                                        );

                                        return res.status(500).json({
                                            success: false,
                                            message:
                                                'Unable to update account status.'
                                        });
                                    }

                                    if (
                                        result.affectedRows !== 1
                                    ) {
                                        return res.status(409).json({
                                            success: false,
                                            message:
                                                'Account status changed. Refresh and try again.'
                                        });
                                    }

                                    return res.json({
                                        success: true,
                                        changed: true,
                                        account: resultAccount,
                                        message: desired
                                            ? 'Account enabled successfully.'
                                            : 'Account disabled successfully.'
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

// ======================================================
// EXPORT
// ======================================================

module.exports = createAdminAccountsRouter;
