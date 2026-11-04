
const express = require('express');
const bcrypt = require('bcryptjs');

const {
    isStrongPassword,
    PASSWORD_MESSAGE
} = require('../helpers/passwordPolicy');

// ======================================================
// WELLSMARTBOOK - ADMIN ACCOUNT SETTINGS
//
// GET   /api/admin/settings
// PATCH /api/admin/settings/password
// ======================================================

function createAdminSettingsRouter({
    db,
    authenticateToken
}) {

    const router = express.Router();

    // ==================================================
    // DATABASE QUERY HELPER
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
    // VERIFY ACTIVE ADMINISTRATOR
    // ==================================================

    async function requireActiveAdmin(req, res, next) {

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

        try {

            const rows = await query(
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

            if (!rows.length) {

                return res.status(403).json({
                    success: false,
                    message:
                        'Administrator access has been revoked.'
                });
            }

            next();

        } catch (error) {

            console.error(
                'Admin settings access check:',
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    'Unable to verify administrator access.'
            });
        }
    }

    // ==================================================
    // GET CURRENT ADMIN ACCOUNT INFORMATION
    //
    // GET /api/admin/settings
    // ==================================================

    router.get(
        '/admin/settings',

        authenticateToken,
        requireActiveAdmin,

        async (req, res) => {

            try {

                const rows = await query(
                    `
                    SELECT
                        id,
                        username,
                        full_name,
                        role,
                        is_active
                    FROM users
                    WHERE id = ?
                      AND role = 'admin'
                      AND is_active = 1
                    LIMIT 1
                    `,
                    [Number(req.user.id)]
                );

                if (!rows.length) {

                    return res.status(403).json({
                        success: false,
                        message:
                            'Administrator account is unavailable.'
                    });
                }

                const admin = rows[0];

                return res.json({

                    success: true,

                    admin: {
                        id: Number(admin.id),

                        username:
                            admin.username,

                        fullName:
                            admin.full_name ||
                            admin.username,

                        role:
                            admin.role,

                        isActive:
                            Number(admin.is_active) === 1
                    }
                });

            } catch (error) {

                console.error(
                    'Load admin settings:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        'Unable to load administrator settings.'
                });
            }
        }
    );

    // ==================================================
    // CHANGE ADMIN PASSWORD
    //
    // PATCH /api/admin/settings/password
    //
    // Body:
    // {
    //     currentPassword: "...",
    //     newPassword: "..."
    // }
    // ==================================================

    router.patch(
        '/admin/settings/password',

        authenticateToken,
        requireActiveAdmin,

        async (req, res) => {

            const currentPassword =
                req.body?.currentPassword;

            const newPassword =
                req.body?.newPassword;

            // ==========================================
            // VALIDATE CURRENT PASSWORD INPUT
            // ==========================================

            if (
                typeof currentPassword !== 'string' ||
                currentPassword.length === 0 ||
                currentPassword.length > 256
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        'Enter your current password.'
                });
            }

            // ==========================================
            // VALIDATE NEW PASSWORD STRENGTH
            // ==========================================

            if (!isStrongPassword(newPassword)) {

                return res.status(400).json({
                    success: false,
                    message: PASSWORD_MESSAGE
                });
            }

            try {

                const adminId = Number(req.user.id);

                // ======================================
                // LOAD CURRENT PASSWORD HASH
                // ======================================

                const rows = await query(
                    `
                    SELECT password_hash
                    FROM users
                    WHERE id = ?
                      AND role = 'admin'
                      AND is_active = 1
                    LIMIT 1
                    `,
                    [adminId]
                );

                if (!rows.length) {

                    return res.status(403).json({
                        success: false,
                        message:
                            'Administrator account is unavailable.'
                    });
                }

                const oldHash =
                    rows[0].password_hash;

                // ======================================
                // VERIFY CURRENT PASSWORD
                // ======================================

                const matches = await bcrypt.compare(
                    currentPassword,
                    oldHash
                );

                if (!matches) {

                    return res.status(401).json({
                        success: false,
                        message:
                            'Current password is incorrect.'
                    });
                }

                // ======================================
                // PREVENT REUSING CURRENT PASSWORD
                // ======================================

                const isSamePassword =
                    await bcrypt.compare(
                        newPassword,
                        oldHash
                    );

                if (isSamePassword) {

                    return res.status(400).json({
                        success: false,
                        message:
                            'Choose a password different from your current password.'
                    });
                }

                // ======================================
                // HASH NEW PASSWORD
                // ======================================

                const newHash =
                    await bcrypt.hash(
                        newPassword,
                        12
                    );

                // ======================================
                // UPDATE PASSWORD IN MYSQL
                //
                // Compare old hash to prevent overwriting
                // a concurrent password change.
                // ======================================

                const result = await query(
                    `
                    UPDATE users
                    SET password_hash = ?
                    WHERE id = ?
                      AND role = 'admin'
                      AND is_active = 1
                      AND password_hash = ?
                    `,
                    [
                        newHash,
                        adminId,
                        oldHash
                    ]
                );

                if (result.affectedRows !== 1) {

                    return res.status(409).json({
                        success: false,
                        message:
                            'Account was updated elsewhere. Sign in again and retry.'
                    });
                }

                // ======================================
                // SUCCESS
                // ======================================

                return res.json({
                    success: true,
                    message:
                        'Password changed successfully. Please sign in again.'
                });

            } catch (error) {

                console.error(
                    'Change admin password:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        'Unable to change administrator password.'
                });
            }
        }
    );

    return router;
}

// ======================================================
// EXPORT
// ======================================================

module.exports =
    createAdminSettingsRouter;
