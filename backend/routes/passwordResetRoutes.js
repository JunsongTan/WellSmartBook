const express = require('express');
const crypto = require('crypto');


const bcrypt = require('bcryptjs');

const {
    isStrongPassword,
    PASSWORD_MESSAGE
} = require('../helpers/passwordPolicy');

// ======================================================
// FORGOT PASSWORD - REQUEST EMAIL OTP
// Step 2.11.1C
// ======================================================

const SUCCESS_MESSAGE =
    'If this email belongs to an eligible account, a password reset code will be sent.';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS_PER_IP = 5;

// Basic single-server request limiting.
const rateLimits = new Map();

function isRateLimited(ip) {
    const now = Date.now();
    const key = String(ip || 'unknown');

    if (rateLimits.size > 5000) {
        for (const [address, record] of rateLimits) {
            if (record.expiresAt <= now) {
                rateLimits.delete(address);
            }
        }
    }

    const current = rateLimits.get(key);

    if (!current || current.expiresAt <= now) {
        rateLimits.set(key, {
            count: 1,
            expiresAt: now + WINDOW_MS
        });

        return false;
    }

    current.count += 1;

    return current.count > MAX_REQUESTS_PER_IP;
}

// ======================================================
// HASH OTP WITH SERVER SECRET
// The raw OTP will never be stored in MySQL.
// ======================================================

function getOtpHash(userId, otp, secret) {
    return crypto.createHmac('sha256', secret)
        .update(`${userId}:${otp}`, 'utf8')
        .digest('hex');
}

// ======================================================
// CREATE ROUTER
// ======================================================

function createPasswordResetRouter({
    bookingPool,
    transporter
}) {
    const router = express.Router();

    router.post(
        '/forgot-password/request-otp',
        async (req, res) => {

            // ==========================================
            // REQUEST RATE LIMIT
            // ==========================================

            if (isRateLimited(req.ip)) {
                return res.status(429).json({
                    success: false,
                    message:
                        'Too many requests. Please try again later.'
                });
            }

            // ==========================================
            // NORMALIZE EMAIL
            // ==========================================

            const email =
                typeof req.body?.email === 'string'
                    ? req.body.email.trim().toLowerCase()
                    : '';

            if (
                email.length > 100 ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Enter a valid email address.'
                });
            }

            // ==========================================
            // CHECK BACKEND CONFIGURATION
            // ==========================================

            const secret =
                process.env.PASSWORD_RESET_OTP_SECRET;

            if (!secret || secret.length < 32) {
                console.error(
                    '[Forgot password] OTP secret is not configured.'
                );

                return res.status(503).json({
                    success: false,
                    message:
                        'Password reset is temporarily unavailable.'
                });
            }

            if (
                !bookingPool ||
                typeof bookingPool.promise !== 'function' ||
                !transporter ||
                typeof transporter.sendMail !== 'function'
            ) {
                console.error(
                    '[Forgot password] Database or mailer unavailable.'
                );

                return res.status(503).json({
                    success: false,
                    message:
                        'Password reset is temporarily unavailable.'
                });
            }

            // Do not reveal whether an email is registered.
            const reply = () => res.json({
                success: true,
                message: SUCCESS_MESSAGE
            });

            const pool = bookingPool.promise();

            let userId;
            let otp;
            let otpHash;

            try {

                // ======================================
                // FIND USER OR COACH
                //
                // Admins and disabled accounts
                // are not eligible here.
                // ======================================

                const [accounts] = await pool.query(
                    `
                    SELECT id
                    FROM users
                    WHERE email = ?
                      AND is_active = 1
                      AND (
                          role IN ('user', 'coach')
                          OR role IS NULL
                      )
                    LIMIT 1
                    `,
                    [email]
                );

                if (accounts.length === 0) {
                    return reply();
                }

                userId = Number(accounts[0].id);

                // ======================================
                // GENERATE SECURE 6-DIGIT OTP
                // ======================================

                otp = crypto.randomInt(0, 1000000)
                    .toString()
                    .padStart(6, '0');

                otpHash = getOtpHash(
                    userId,
                    otp,
                    secret
                );

                // ======================================
                // SAVE OTP AND ENFORCE 60-SECOND
                // RESEND COOLDOWN
                // ======================================

                const conn = await pool.getConnection();

                let cooldown = false;

                try {
                    await conn.beginTransaction();

                    const [existing] = await conn.query(
                        `
                        SELECT
                            id,
                            (
                                last_sent_at_utc >
                                UTC_TIMESTAMP() -
                                INTERVAL 60 SECOND
                            ) AS is_cooling_down
                        FROM password_reset_otps
                        WHERE user_id = ?
                        FOR UPDATE
                        `,
                        [userId]
                    );

                    if (existing.length > 0) {

                        if (
                            Number(
                                existing[0].is_cooling_down
                            ) === 1
                        ) {
                            cooldown = true;

                        } else {

                            await conn.query(
                                `
                                UPDATE password_reset_otps
                                SET
                                    otp_hash = ?,
                                    otp_expires_at_utc =
                                        UTC_TIMESTAMP() +
                                        INTERVAL 10 MINUTE,
                                    attempts = 0,
                                    verified_at_utc = NULL,
                                    reset_token_hash = NULL,
                                    reset_expires_at_utc = NULL,
                                    last_sent_at_utc =
                                        UTC_TIMESTAMP()
                                WHERE user_id = ?
                                `,
                                [otpHash, userId]
                            );
                        }

                    } else {

                        await conn.query(
                            `
                            INSERT INTO password_reset_otps
                            (
                                user_id,
                                otp_hash,
                                otp_expires_at_utc,
                                attempts,
                                last_sent_at_utc
                            )
                            VALUES
                            (
                                ?,
                                ?,
                                UTC_TIMESTAMP() +
                                    INTERVAL 10 MINUTE,
                                0,
                                UTC_TIMESTAMP()
                            )
                            `,
                            [userId, otpHash]
                        );
                    }

                    await conn.commit();

                } catch (error) {

                    try {
                        await conn.rollback();
                    } catch (_) {
                        // Preserve original database error.
                    }

                    throw error;

                } finally {
                    conn.release();
                }

                // Don't send another email during cooldown.
                if (cooldown) {
                    return reply();
                }

                // ======================================
                // SEND OTP THROUGH EXISTING GMAIL
                // ======================================

                try {
                    const result =
                        await transporter.sendMail({

                            from:
                                `"WellSmartBook" <${process.env.EMAIL_USER}>`,

                            to: email,

                            subject:
                                'WellSmartBook - Password Reset OTP',

                            text:
                                `Your WellSmartBook password reset code is ${otp}.\n` +
                                'This code expires in 10 minutes.\n' +
                                'If you did not request a password reset, ignore this email.',

                            html: `
                                <div style="
                                    font-family: Arial, sans-serif;
                                    max-width: 480px;
                                    margin: auto;
                                    padding: 24px;
                                ">
                                    <h2 style="color:#0759df">
                                        WellSmartBook
                                    </h2>

                                    <h3>
                                        Password Reset Verification
                                    </h3>

                                    <p>
                                        Use this one-time code to
                                        reset your password:
                                    </p>

                                    <p style="
                                        font-size:32px;
                                        font-weight:bold;
                                        letter-spacing:8px;
                                    ">
                                        ${otp}
                                    </p>

                                    <p>
                                        This code expires in
                                        <strong>10 minutes</strong>.
                                    </p>

                                    <p>
                                        If you did not request this,
                                        ignore this email.
                                    </p>
                                </div>
                            `
                        });

                    const accepted = (
                        result.accepted || []
                    ).some(address =>
                        String(address).toLowerCase() === email
                    );

                    if (!accepted) {
                        throw new Error(
                            'SMTP did not accept the recipient.'
                        );
                    }

                    console.log(
                        '[Forgot password] OTP email accepted for an eligible account.'
                    );

                } catch (mailError) {

                    console.error(
                        '[Forgot password] OTP email failed:',
                        mailError.message
                    );

                    // Invalidate the code if sending fails.
                    await pool.query(
                        `
                        UPDATE password_reset_otps
                        SET otp_expires_at_utc =
                            UTC_TIMESTAMP() -
                            INTERVAL 1 SECOND
                        WHERE user_id = ?
                          AND otp_hash = ?
                        `,
                        [userId, otpHash]
                    ).catch(error => {
                        console.error(
                            '[Forgot password] Invalidation failed:',
                            error.message
                        );
                    });
                }

                return reply();

            } catch (error) {

                // Concurrent requests may encounter
                // the unique user_id constraint.
                if (error.code === 'ER_DUP_ENTRY') {
                    return reply();
                }

                console.error(
                    '[Forgot password] Request failed:',
                    error.message
                );

                return res.status(503).json({
                    success: false,
                    message:
                        'Password reset is temporarily unavailable.'
                });
            }
        }
    );
    
    // ======================================================
    // FORGOT PASSWORD - VERIFY THE SIX-DIGIT OTP
    // Step 2.11.1D
    // ======================================================

    const verifyRateLimits = new Map();

    router.post('/forgot-password/verify-otp', async (req, res) => {
        const invalidMessage = 'Invalid or expired verification code. Request a new code if necessary.';
        const ip = String(req.ip || 'unknown');
        const now = Date.now();
        const windowMs = 15 * 60 * 1000;
        const currentLimit = verifyRateLimits.get(ip);

        if (verifyRateLimits.size > 5000) {
            for (const [address, record] of verifyRateLimits) {
                if (record.expiresAt <= now) verifyRateLimits.delete(address);
            }
        }

        if (!currentLimit || currentLimit.expiresAt <= now) {
            verifyRateLimits.set(ip, { count: 1, expiresAt: now + windowMs });
        } else {
            currentLimit.count += 1;
            if (currentLimit.count > 20) {
                return res.status(429).json({
                    success: false,
                    message: 'Too many verification attempts. Please try again later.'
                });
            }
        }

        const email = typeof req.body?.email === 'string'
            ? req.body.email.trim().toLowerCase()
            : '';

        const otp = typeof req.body?.otp === 'string'
            ? req.body.otp.trim()
            : '';

        if (email.length > 100 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            !/^\d{6}$/.test(otp)) {
            return res.status(400).json({
                success: false,
                message: 'Enter a valid email and six-digit OTP.'
            });
        }

        const secret = process.env.PASSWORD_RESET_OTP_SECRET;

        if (!secret || secret.length < 32 ||
            !bookingPool || typeof bookingPool.promise !== 'function') {
            console.error('[Forgot password] Verification configuration unavailable.');
            return res.status(503).json({
                success: false,
                message: 'Password verification is temporarily unavailable.'
            });
        }

        const pool = bookingPool.promise();
        let conn;

        try {
            const [accounts] = await pool.query(
                `SELECT id FROM users
                 WHERE email = ? AND is_active = 1
                   AND (role IN ('user', 'coach') OR role IS NULL)
                 LIMIT 1`,
                [email]
            );

            if (accounts.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: invalidMessage
                });
            }

            const userId = Number(accounts[0].id);
            conn = await pool.getConnection();
            await conn.beginTransaction();

            // Lock the OTP record during verification.
            const [records] = await conn.query(
                `SELECT otp_hash, attempts, verified_at_utc,
                        (otp_expires_at_utc > UTC_TIMESTAMP()) AS is_valid
                 FROM password_reset_otps
                 WHERE user_id = ? FOR UPDATE`,
                [userId]
            );

            const record = records[0];
            const blocked = !record ||
                Number(record.is_valid) !== 1 ||
                Number(record.attempts) >= 5 ||
                record.verified_at_utc !== null;

            if (blocked) {
                await conn.commit();
                return res.status(400).json({
                    success: false,
                    message: invalidMessage
                });
            }

            // Compare the OTP securely.
            const expected = getOtpHash(userId, otp, secret);
            const stored = String(record.otp_hash || '');
            const validHash = /^[0-9a-f]{64}$/i.test(stored);

            const matches = validHash && crypto.timingSafeEqual(
                Buffer.from(expected, 'hex'),
                Buffer.from(stored, 'hex')
            );

            // Incorrect OTP: increase the attempt count.
            if (!matches) {
                const newAttempts = Number(record.attempts) + 1;

                await conn.query(
                    `UPDATE password_reset_otps
                     SET attempts = ?,
                         otp_expires_at_utc = IF(
                             ? >= 5,
                             UTC_TIMESTAMP() - INTERVAL 1 SECOND,
                             otp_expires_at_utc
                         )
                     WHERE user_id = ?`,
                    [newAttempts, newAttempts, userId]
                );

                await conn.commit();

                return res.status(400).json({
                    success: false,
                    message: invalidMessage
                });
            }

            // Correct OTP: issue a temporary reset authorization.
            // Only its SHA-256 hash is stored in MySQL.
            const resetToken = crypto.randomBytes(32).toString('hex');

            const resetTokenHash = crypto.createHash('sha256')
                .update(resetToken, 'utf8')
                .digest('hex');

            await conn.query(
                `UPDATE password_reset_otps
                 SET verified_at_utc = UTC_TIMESTAMP(),
                     otp_expires_at_utc = UTC_TIMESTAMP() - INTERVAL 1 SECOND,
                     reset_token_hash = ?,
                     reset_expires_at_utc = UTC_TIMESTAMP() + INTERVAL 10 MINUTE
                 WHERE user_id = ?`,
                [resetTokenHash, userId]
            );

            await conn.commit();

            return res.json({
                success: true,
                message: 'OTP verified. You can now set a new password.',
                resetToken
            });

        } catch (error) {
            if (conn) {
                try { await conn.rollback(); } catch (_) {}
            }

            console.error(
                '[Forgot password] OTP verification failed:',
                error.message
            );

            return res.status(503).json({
                success: false,
                message: 'Password verification is temporarily unavailable.'
            });

        } finally {
            if (conn) conn.release();
        }
    });
    
    // ======================================================
    // STEP 2.11.1E - SET NEW PASSWORD AFTER OTP VERIFICATION
    // ======================================================

    const resetRateLimits = new Map();

    router.post('/forgot-password/reset-password', async (req, res) => {
        const ip = String(req.ip || 'unknown');
        const now = Date.now();
        const windowMs = 15 * 60 * 1000;

        // Limit repeated reset attempts from one IP.
        if (resetRateLimits.size > 5000) {
            for (const [key, value] of resetRateLimits) {
                if (value.expiresAt <= now) {
                    resetRateLimits.delete(key);
                }
            }
        }

        const previous = resetRateLimits.get(ip);

        if (!previous || previous.expiresAt <= now) {
            resetRateLimits.set(ip, {
                count: 1,
                expiresAt: now + windowMs
            });
        } else {
            previous.count += 1;

            if (previous.count > 10) {
                return res.status(429).json({
                    success: false,
                    message: 'Too many reset attempts. Please try again later.'
                });
            }
        }

        const email = typeof req.body?.email === 'string'
            ? req.body.email.trim().toLowerCase()
            : '';

        const resetToken = req.body?.resetToken;
        const newPassword = req.body?.newPassword;
        const confirmPassword = req.body?.confirmPassword;

        // ==============================================
        // VALIDATE EMAIL AND TEMPORARY RESET TOKEN
        // ==============================================

        if (
            email.length > 100 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            typeof resetToken !== 'string' ||
            !/^[0-9a-f]{64}$/i.test(resetToken)
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired password reset authorization.'
            });
        }

        // ==============================================
        // VALIDATE NEW PASSWORD
        // SAME RULES AS USER AND COACH REGISTRATION
        // ==============================================

        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({
                success: false,
                message: PASSWORD_MESSAGE
            });
        }

        if (
            typeof confirmPassword !== 'string' ||
            newPassword !== confirmPassword
        ) {
            return res.status(400).json({
                success: false,
                message: 'New password and confirmation do not match.'
            });
        }

        if (
            !bookingPool ||
            typeof bookingPool.promise !== 'function'
        ) {
            return res.status(503).json({
                success: false,
                message: 'Password reset is temporarily unavailable.'
            });
        }

        // SHA-256 of the submitted temporary token.
        const submittedHash = crypto.createHash('sha256')
            .update(resetToken, 'utf8')
            .digest();

        let conn;

        try {
            conn = await bookingPool.promise().getConnection();

            await conn.beginTransaction();

            // ==========================================
            // LOCK ACCOUNT AND RESET RECORD
            //
            // Prevents the same token being used twice
            // during simultaneous reset requests.
            // ==========================================

            const [rows] = await conn.query(
                `
                SELECT
                    u.id,
                    u.password_hash,
                    p.reset_token_hash,
                    p.verified_at_utc,

                    (
                        p.reset_expires_at_utc >
                        UTC_TIMESTAMP()
                    ) AS token_valid

                FROM users AS u

                INNER JOIN password_reset_otps AS p
                    ON p.user_id = u.id

                WHERE u.email = ?
                  AND u.is_active = 1
                  AND (
                      u.role IN ('user', 'coach')
                      OR u.role IS NULL
                  )

                LIMIT 1
                FOR UPDATE
                `,
                [email]
            );

            const account = rows[0];

            const storedHash = String(
                account?.reset_token_hash || ''
            );

            const storedHashValid =
                /^[0-9a-f]{64}$/i.test(storedHash);

            // ==========================================
            // VERIFY TEMPORARY RESET AUTHORIZATION
            // ==========================================

            const authorized = Boolean(
                account &&
                account.verified_at_utc !== null &&
                Number(account.token_valid) === 1 &&
                storedHashValid &&
                crypto.timingSafeEqual(
                    submittedHash,
                    Buffer.from(storedHash, 'hex')
                )
            );

            if (!authorized) {
                await conn.rollback();

                return res.status(400).json({
                    success: false,
                    message: 'Invalid or expired password reset authorization.'
                });
            }

            // ==========================================
            // PREVENT REUSING CURRENT PASSWORD
            // ==========================================

            const samePassword = await bcrypt.compare(
                newPassword,
                account.password_hash
            );

            if (samePassword) {
                await conn.rollback();

                return res.status(400).json({
                    success: false,
                    message: 'Choose a password different from your current password.'
                });
            }

            // ==========================================
            // HASH THE NEW PASSWORD
            // ==========================================

            const passwordHash = await bcrypt.hash(
                newPassword,
                12
            );

            // ==========================================
            // UPDATE USER OR COACH PASSWORD
            // ==========================================

            await conn.query(
                `
                UPDATE users
                SET password_hash = ?
                WHERE id = ?
                `,
                [
                    passwordHash,
                    account.id
                ]
            );

            // ==========================================
            // INVALIDATE OTP AND RESET TOKEN
            //
            // The token cannot be reused.
            // ==========================================

            await conn.query(
                `
                UPDATE password_reset_otps

                SET
                    reset_token_hash = NULL,
                    reset_expires_at_utc = NULL,
                    verified_at_utc = NULL,

                    otp_expires_at_utc =
                        UTC_TIMESTAMP() -
                        INTERVAL 1 SECOND

                WHERE user_id = ?
                `,
                [account.id]
            );

            // Both database changes succeed together.
            await conn.commit();

            return res.json({
                success: true,
                message: 'Password reset successfully. Please log in with your new password.'
            });

        } catch (error) {
            if (conn) {
                try {
                    await conn.rollback();
                } catch (_) {
                    // Keep original error.
                }
            }

            console.error(
                '[Forgot password] Password reset failed:',
                error.message
            );

            return res.status(503).json({
                success: false,
                message: 'Password reset is temporarily unavailable.'
            });

        } finally {
            if (conn) {
                conn.release();
            }
        }
    });



    return router;
}

module.exports = createPasswordResetRouter;
