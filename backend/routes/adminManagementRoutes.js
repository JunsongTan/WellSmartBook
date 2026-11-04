
const express = require('express');
const bcrypt = require('bcryptjs');

const {
    isStrongPassword,
    PASSWORD_MESSAGE
} = require('../helpers/passwordPolicy');

// ======================================================
// WELLSMARTBOOK - ADMIN MANAGEMENT
//
// GET  /api/admin/admins
// POST /api/admin/admins
// ======================================================

function createAdminManagementRouter({
    db,
    authenticateToken
}) {

    const router = express.Router();

    // ==================================================
    // VERIFY ACTIVE ADMINISTRATOR
    // ==================================================

    function requireActiveAdmin(req, res, next) {

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
                message: 'Administrator access required.'
            });
        }

        // Verify against MySQL, not only the JWT.

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

            (error, rows) => {

                if (error) {

                    console.error(
                        'Verify administrator:',
                        error
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            'Unable to verify administrator access.'
                    });
                }

                if (!rows?.length) {

                    return res.status(403).json({
                        success: false,
                        message:
                            'Administrator access has been revoked.'
                    });
                }

                next();
            }
        );
    }

    // ==================================================
    // LIST ALL ADMINISTRATORS
    //
    // GET /api/admin/admins
    // ==================================================

    router.get(
        '/admin/admins',
        authenticateToken,
        requireActiveAdmin,

        (req, res) => {

            db.query(
                `
                SELECT
                    id,
                    username,
                    is_active
                FROM users
                WHERE role = 'admin'
                ORDER BY id DESC
                `,

                (error, rows) => {

                    if (error) {

                        console.error(
                            'List administrators:',
                            error
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                'Unable to load administrators.'
                        });
                    }

                    const admins = (rows || []).map(
                        account => ({

                            id: Number(account.id),

                            username:
                                account.username,

                            role: 'admin',

                            isActive:
                                Number(account.is_active) === 1
                        })
                    );

                    return res.json({
                        success: true,
                        admins
                    });
                }
            );
        }
    );

    // ==================================================
    // CREATE ADMINISTRATOR
    //
    // POST /api/admin/admins
    //
    // Body:
    // {
    //     username: "...",
    //     password: "..."
    // }
    // ==================================================

    router.post(
        '/admin/admins',
        authenticateToken,
        requireActiveAdmin,

        (req, res) => {

            // ==========================================
            // GET INPUTS
            // ==========================================

            const username =
                typeof req.body?.username === 'string'
                    ? req.body.username
                        .trim()
                        .toLowerCase()
                    : '';

            const password =
                req.body?.password;

            // ==========================================
            // VALIDATE USERNAME
            //
            // 3-32 characters
            // Lowercase letters, numbers, underscores
            // Must start with a letter
            // ==========================================

            if (
                !/^[a-z][a-z0-9_]{2,31}$/.test(username)
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        'Username must contain 3–32 characters, start with a letter, and use only lowercase letters, numbers or underscores.'
                });
            }

            // ==========================================
            // VALIDATE STRONG PASSWORD
            // ==========================================

            if (!isStrongPassword(password)) {

                return res.status(400).json({
                    success: false,
                    message: PASSWORD_MESSAGE
                });
            }

            // ==========================================
            // GENERATE INTERNAL DATABASE EMAIL
            //
            // Admin does not enter an email address.
            // ==========================================

            const internalEmail =
                `${username}@admins.wellsmartbook.invalid`;

            // ==========================================
            // CHECK UNIQUE USERNAME ACROSS ALL ROLES
            // ==========================================

            db.query(
                `
                SELECT id
                FROM users
                
                WHERE (role = 'admin' AND LOWER(username) = ?)
                OR LOWER(email) = ?
                LIMIT 1
                `,
                [
                    username,
                    internalEmail
                ],

                async (lookupError, existing) => {

                    if (lookupError) {

                        console.error(
                            'Check admin username:',
                            lookupError
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                'Unable to check administrator username.'
                        });
                    }

                    if (existing?.length) {

                        return res.status(409).json({
                            success: false,
                            message:
                                'Username is already taken.'
                        });
                    }

                    try {

                        // ==============================
                        // HASH PASSWORD
                        // ==============================

                        const passwordHash =
                            await bcrypt.hash(
                                password,
                                12
                            );

                        // ==============================
                        // INSERT ADMIN
                        // ==============================

                        db.query(
                            `
                            INSERT INTO users
                            (
                                username,
                                full_name,
                                email,
                                password_hash,
                                role,
                                is_active
                            )

                            VALUES
                            (
                                ?,
                                ?,
                                ?,
                                ?,
                                'admin',
                                1
                            )
                            `,

                            [
                                username,
                                username,
                                internalEmail,
                                passwordHash
                            ],

                            (insertError, result) => {

                                if (insertError) {

                                    // Handle duplicate
                                    // database entries.

                                    if (
                                        insertError.code ===
                                        'ER_DUP_ENTRY'
                                    ) {

                                        return res.status(409).json({
                                            success: false,
                                            message:
                                                'Username is already taken.'
                                        });
                                    }

                                    console.error(
                                        'Create administrator:',
                                        insertError
                                    );

                                    return res.status(500).json({
                                        success: false,
                                        message:
                                            'Unable to create administrator.'
                                    });
                                }

                                // ======================
                                // SUCCESS RESPONSE
                                //
                                // Never return password
                                // or password hash.
                                // ======================

                                return res.status(201).json({

                                    success: true,

                                    message:
                                        'Administrator created successfully.',

                                    admin: {

                                        id: Number(
                                            result.insertId
                                        ),

                                        username,

                                        role: 'admin',

                                        isActive: true
                                    }
                                });
                            }
                        );

                    } catch (error) {

                        console.error(
                            'Hash administrator password:',
                            error
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                'Unable to create administrator.'
                        });
                    }
                }
            );
        }
    );

    // ==================================================
    // RETURN ROUTER
    // ==================================================

    return router;
}

// ======================================================
// EXPORT
// ======================================================

module.exports = createAdminManagementRouter;
