
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


const {
    isStrongPassword,
    PASSWORD_MESSAGE
} = require('../helpers/passwordPolicy');


const {
    otpStore,
    verifiedEmails
} = require('./authState');


// ======================================================
// WELLSMARTBOOK AUTHENTICATION ROUTES
// USER + COACH + ADMIN
// ======================================================

function createAuthRouter({
    db,
    transporter,
    normalizeDateOnly,
    calculateAge,
    calculatePersonalTargets,
    normalizeAllergies,
    formatUserForClient
}) {

    const router = express.Router();

    // ==================================================
    // SEND OTP
    // ==================================================

    router.post('/send-otp', async (req, res) => {

        const email = String(
            req.body.email || ''
        ).trim().toLowerCase();

        const purpose = String(
            req.body.purpose || 'user_registration'
        ).trim().toLowerCase();

        const allowedPurposes = [
            'user_registration',
            'coach_registration'
        ];

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required.'
            });
        }

        if (!allowedPurposes.includes(purpose)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification purpose.'
            });
        }

        const otpKey = `${purpose}:${email}`;

        db.query(
            `
            SELECT id
            FROM users
            WHERE email = ?
            LIMIT 1
            `,
            [email],

            async (databaseError, existingUsers) => {

                if (databaseError) {
                    console.error(
                        'OTP email lookup:',
                        databaseError
                    );

                    return res.status(500).json({
                        success: false,
                        message: 'Unable to check email.'
                    });
                }

                if (existingUsers.length > 0) {
                    return res.status(409).json({
                        success: false,
                        message: 'This email is already registered.'
                    });
                }

                // ======================================
                // GENERATE OTP
                // ======================================

                const otp = Math.floor(
                    100000 + Math.random() * 900000
                ).toString();

                otpStore.set(otpKey, {
                    otp,
                    expiresAt: Date.now() + 5 * 60 * 1000
                });

                verifiedEmails.delete(otpKey);

                const emailTypeLabel =
                    purpose === 'coach_registration'
                        ? 'Coach Registration'
                        : 'User Registration';

                try {

                    const mailInfo =
                        await transporter.sendMail({

                            from:
                                `"WellSmartBook" <${process.env.EMAIL_USER}>`,

                            to: email,

                            subject:
                                `WellSmartBook - ${emailTypeLabel} Verification Code`,

                            text:
                                `Your WellSmartBook ${emailTypeLabel} verification code is ${otp}. This code expires in 5 minutes.`,

                            html: `
                                <div style="
                                    font-family: Arial, sans-serif;
                                    padding: 24px;
                                    background: #f8fafc;
                                ">
                                    <div style="
                                        max-width: 520px;
                                        margin: auto;
                                        background: white;
                                        padding: 28px;
                                        border-radius: 12px;
                                        border: 1px solid #e2e8f0;
                                    ">
                                        <h2 style="
                                            color: #0759d9;
                                            margin-top: 0;
                                        ">
                                            WellSmartBook
                                        </h2>

                                        <p>
                                            ${emailTypeLabel}
                                        </p>

                                        <p>
                                            Your email verification code is:
                                        </p>

                                        <div style="
                                            margin: 24px 0;
                                            padding: 18px;
                                            background: #eff6ff;
                                            border-radius: 10px;
                                            text-align: center;
                                        ">
                                            <strong style="
                                                font-size: 32px;
                                                letter-spacing: 6px;
                                                color: #0759d9;
                                            ">
                                                ${otp}
                                            </strong>
                                        </div>

                                        <p>
                                            This code expires in 5 minutes.
                                        </p>

                                        <p style="
                                            color: #64748b;
                                            font-size: 12px;
                                        ">
                                            If you did not request this code,
                                            you can ignore this email.
                                        </p>
                                    </div>
                                </div>
                            `
                        });

                    console.log(
                        '======================================='
                    );

                    console.log('OTP EMAIL RESULT');
                    console.log('Purpose:', purpose);
                    console.log('To:', email);
                    console.log('Message ID:', mailInfo.messageId);
                    console.log('Accepted:', mailInfo.accepted);
                    console.log('Rejected:', mailInfo.rejected);
                    console.log('SMTP response:', mailInfo.response);

                    console.log(
                        '======================================='
                    );

                    if (
                        !Array.isArray(mailInfo.accepted) ||
                        mailInfo.accepted.length === 0
                    ) {

                        otpStore.delete(otpKey);

                        return res.status(502).json({
                            success: false,
                            message:
                                'The email server did not accept the verification email.'
                        });
                    }

                    return res.json({
                        success: true,
                        message: 'OTP sent successfully!'
                    });

                } catch (emailError) {

                    otpStore.delete(otpKey);

                    console.error(
                        'SEND OTP EMAIL ERROR:',
                        emailError
                    );

                    return res.status(500).json({
                        success: false,
                        message: 'Failed to send OTP email.'
                    });
                }
            }
        );
    });

    // ==================================================
    // VERIFY OTP
    // ==================================================

    router.post('/verify-otp', (req, res) => {

        const email = String(
            req.body.email || ''
        ).trim().toLowerCase();

        const otp = String(
            req.body.otp || ''
        ).trim();

        const purpose = String(
            req.body.purpose || 'user_registration'
        ).trim().toLowerCase();

        const allowedPurposes = [
            'user_registration',
            'coach_registration'
        ];

        if (!allowedPurposes.includes(purpose)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification purpose.'
            });
        }

        const otpKey = `${purpose}:${email}`;

        const stored = otpStore.get(otpKey);

        if (!stored) {
            return res.status(400).json({
                success: false,
                message:
                    'No verification code was requested.'
            });
        }

        if (Date.now() > stored.expiresAt) {

            otpStore.delete(otpKey);

            return res.status(400).json({
                success: false,
                message:
                    'Verification code has expired.'
            });
        }

        if (stored.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid verification code.'
            });
        }

        otpStore.delete(otpKey);

        // Email remains verified for one hour.

        verifiedEmails.set(
            otpKey,
            Date.now() + 60 * 60 * 1000
        );

        return res.json({
            success: true,
            message: 'Email verified successfully!'
        });
    });

    // ==================================================
    // REGISTER NORMAL USER
    // ==================================================

    router.post('/register', async (req, res) => {

        const {
            username,
            email,
            password,
            fullName,
            dateOfBirth,
            gender,
            profilePicture,
            height,
            weight,
            activityLevel,
            primaryGoal,
            targetWeight,
            goalPace,
            exerciseDaysPerWeek,
            exerciseMinutes,
            dietaryPreference,
            allergies,
            mealsPerDay,
            cookingTimePreference
        } = req.body;

        const normalizedEmail = String(
            email || ''
        ).trim().toLowerCase();

        const normalizedUsername = String(
            username || ''
        ).trim();

        const normalizedFullName = String(
            fullName || ''
        ).trim();

        // ==============================================
        // VALIDATE REQUIRED FIELDS
        // ==============================================

        if (
            !normalizedUsername ||
            !normalizedEmail ||
            !password ||
            !normalizedFullName
        ) {
            return res.status(400).json({
                message:
                    'Username, email, password and full name are required.'
            });
        }

        // ==============================================
        // VALIDATE EMAIL VERIFICATION
        // ==============================================

        const verificationKey =
            `user_registration:${normalizedEmail}`;

        const verifiedUntil =
            verifiedEmails.get(verificationKey);

        if (
            !verifiedUntil ||
            Date.now() > verifiedUntil
        ) {
            return res.status(400).json({
                message: 'Please verify your email first.'
            });
        }
        
        // ======================================================
        // VALIDATE USER REGISTRATION PASSWORD
        // ======================================================

        if (!isStrongPassword(password)) {

            return res.status(400).json({
                success: false,
                message: PASSWORD_MESSAGE
            });
        }


        // ==============================================
        // VALIDATE GENDER
        // ==============================================

        if (!['Male', 'Female'].includes(gender)) {

            return res.status(400).json({
                message:
                    'Please select Male or Female for energy calculation.'
            });
        }

        // ==============================================
        // VALIDATE AGE
        // ==============================================

        if (calculateAge(dateOfBirth) < 18) {

            return res.status(400).json({
                message:
                    'Personalized adult calorie targets require age 18 or above.'
            });
        }

        // ==============================================
        // PREPARE PERSONAL INFORMATION
        // ==============================================

        const numericHeight = Number(height);
        const numericWeight = Number(weight);

        let finalTargetWeight =
            Number(targetWeight);

        let finalGoalPace = goalPace;

        if (primaryGoal === 'Maintain Weight') {

            finalTargetWeight = numericWeight;
            finalGoalPace = 'Maintain';
        }

        let targets;

        try {

            targets = calculatePersonalTargets({
                gender,
                dateOfBirth,
                height: numericHeight,
                weight: numericWeight,
                activityLevel,
                primaryGoal,
                goalPace: finalGoalPace
            });

        } catch (error) {

            return res.status(400).json({
                message: error.message
            });
        }

        // ==============================================
        // CHECK DUPLICATE USERNAME OR EMAIL
        // ==============================================

        db.query(
            `
            SELECT id
            FROM users
            WHERE LOWER(email) = ?
            LIMIT 1
            `,
            [
                normalizedEmail
            ],

            async (lookupError, results) => {

                if (lookupError) {
                    return res.status(500).json({
                        message:
                            'Unable to check existing account.'
                    });
                }

                if (results.length > 0) {
                    return res.status(409).json({
                        message:
                            'This email is already registered.'
                    });
                }

                // ======================================
                // HASH PASSWORD
                // ======================================

                try {

                    const passwordHash =
                        await bcrypt.hash(password, 10);

                    // ==================================
                    // INSERT NORMAL USER
                    // ==================================

                    db.query(
                        `
                        INSERT INTO users
                        (
                            username,
                            email,
                            password_hash,
                            role,
                            full_name,
                            date_of_birth,
                            gender,
                            profile_picture,
                            height,
                            weight,
                            activity_level,
                            primary_goal,
                            target_weight,
                            goal_pace,
                            exercise_days_per_week,
                            exercise_minutes,
                            dietary_preference,
                            allergies,
                            meals_per_day,
                            cooking_time_preference,
                            bmi,
                            bmr,
                            tdee,
                            daily_calorie_target,
                            protein_target,
                            carbs_target,
                            fat_target
                        )

                        VALUES
                        (
                            ?, ?, ?, 'user',
                            ?, ?, ?, ?,
                            ?, ?, ?, ?, ?, ?,
                            ?, ?, ?, ?, ?, ?,
                            ?, ?, ?, ?, ?, ?, ?
                        )
                        `,
                        [
                            normalizedUsername,
                            normalizedEmail,
                            passwordHash,

                            normalizedFullName,
                            normalizeDateOnly(dateOfBirth),
                            gender,
                            profilePicture || null,

                            numericHeight,
                            numericWeight,
                            activityLevel,
                            primaryGoal,
                            finalTargetWeight,
                            finalGoalPace,

                            Number(exerciseDaysPerWeek || 0),
                            Number(exerciseMinutes || 0),

                            dietaryPreference,

                            JSON.stringify(
                                normalizeAllergies(allergies)
                            ),

                            Number(mealsPerDay || 3),
                            cookingTimePreference,

                            targets.bmi,
                            targets.bmr,
                            targets.tdee,
                            targets.dailyCalorieTarget,
                            targets.proteinTarget,
                            targets.carbsTarget,
                            targets.fatTarget
                        ],

                        (insertError, result) => {

                            if (insertError) {

                                console.error(insertError);

                                return res.status(500).json({
                                    message: insertError.message
                                });
                            }

                            verifiedEmails.delete(
                                verificationKey
                            );

                            return res.status(201).json({
                                success: true,
                                userId: result.insertId,
                                personalizedTargets: targets
                            });
                        }
                    );

                } catch (hashError) {

                    console.error(
                        'Registration password hashing:',
                        hashError
                    );

                    return res.status(500).json({
                        message:
                            'Unable to complete registration.'
                    });
                }
            }
        );
    });

    // ======================================================
    // SHARED LOGIN
    //
    // USER  -> EMAIL + PASSWORD
    // COACH -> EMAIL + PASSWORD
    // ADMIN -> USERNAME + PASSWORD
    //
    // POST /api/login
    // ======================================================

    router.post('/login', (req, res) => {

        // ==============================================
        // GET EMAIL OR ADMIN USERNAME
        // ==============================================

        const identifier = String(
            req.body?.login ??
            req.body?.email ??
            ''
        ).trim().toLowerCase();

        const password = req.body?.password;

        // ==============================================
        // VALIDATE LOGIN DETAILS
        // ==============================================

        if (
            !identifier ||
            identifier.length > 190 ||
            typeof password !== 'string' ||
            !password ||
            password.length > 256
        ) {

            return res.status(400).json({
                success: false,
                message:
                    'Please enter a valid email/username and password.'
            });
        }

        // ==============================================
        // IDENTIFY LOGIN TYPE
        // ==============================================

        const isEmailLogin =
            identifier.includes('@');

        // ==============================================
        // EMAIL LOGIN:
        // NORMAL USERS AND COACHES ONLY
        //
        // USERNAME LOGIN:
        // ADMINISTRATORS ONLY
        // ==============================================

        const sql = isEmailLogin

            ? `
              SELECT *
              FROM users
              WHERE email = ?
                AND (
                    role IN ('user', 'coach')
                    OR role IS NULL
                )
              LIMIT 1
              `

            : `
              SELECT *
              FROM users
              WHERE username = ?
                AND role = 'admin'
              LIMIT 1
              `;

        db.query(
            sql,
            [identifier],

            async (error, rows) => {

                // ======================================
                // MYSQL ERROR
                // ======================================

                if (error) {

                    console.error(
                        'Shared login lookup:',
                        error
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            'Unable to log in right now.'
                    });
                }

                // ======================================
                // ACCOUNT NOT FOUND
                // ======================================

                if (!rows?.length) {

                    return res.status(401).json({
                        success: false,
                        message:
                            'Invalid login or password.'
                    });
                }

                const user = rows[0];

                try {

                    // ==================================
                    // VERIFY PASSWORD
                    // ==================================

                    const matches =
                        await bcrypt.compare(
                            password,
                            user.password_hash
                        );

                    if (!matches) {

                        return res.status(401).json({
                            success: false,
                            message:
                                'Invalid login or password.'
                        });
                    }
                    
                    // ======================================================
                    // BLOCK DISABLED ACCOUNT LOGIN
                    // ======================================================

                    if (Number(user.is_active) !== 1) {

                        return res.status(403).json({
                            success: false,
                            message:
                                'This account has been disabled. Contact the administrator.'
                        });
                    }


                    // ==================================
                    // ADMIN LOGIN
                    // ==================================

                    if (user.role === 'admin') {

                        // Check whether the administrator
                        // is still using the temporary
                        // local development password.

                        const temporaryPassword =
                            await bcrypt.compare(
                                'admin',
                                user.password_hash
                            );

                        // ==============================
                        // TEMPORARY ADMIN PASSWORD
                        // ==============================

                        if (temporaryPassword) {

                            if (
                                process.env.NODE_ENV ===
                                'production'
                            ) {

                                return res.status(403).json({
                                    success: false,
                                    message:
                                        'Temporary admin login is disabled in production.'
                                });
                            }

                            // No full access token is issued.

                            return res.json({
                                success: true,

                                requiresPasswordChange: true,

                                message:
                                    'Change your temporary admin password before continuing.',

                                user: {
                                    id: user.id,
                                    username: user.username,
                                    role: 'admin'
                                }
                            });
                        }

                        // ==============================
                        // ADMIN JWT
                        // ==============================

                        const token = jwt.sign(
                            {
                                id: user.id,
                                role: 'admin',
                                name: user.username
                            },

                            process.env.JWT_SECRET,

                            {
                                expiresIn: '2h'
                            }
                        );

                        // ==============================
                        // ADMIN LOGIN RESPONSE
                        // ==============================

                        return res.json({
                            success: true,

                            requiresPasswordChange: false,

                            token,

                            user: {
                                id: user.id,
                                username: user.username,

                                fullName:
                                    user.full_name ||
                                    user.username,

                                role: 'admin'
                            }
                        });
                    }

                    // ==================================
                    // NORMAL USER / COACH LOGIN
                    // ==================================

                    const token = jwt.sign(
                        {
                            id: user.id,

                            role:
                                user.role || 'user',

                            name:
                                user.full_name
                        },

                        process.env.JWT_SECRET,

                        {
                            expiresIn: '1d'
                        }
                    );

                    // ==================================
                    // NORMAL LOGIN RESPONSE
                    // ==================================

                    return res.json({
                        success: true,

                        token,

                        requiresPasswordChange: false,

                        user: {
                            ...formatUserForClient(user),

                            role:
                                user.role || 'user'
                        }
                    });

                } catch (authError) {

                    console.error(
                        'Shared login authentication:',
                        authError
                    );

                    return res.status(500).json({
                        success: false,
                        message:
                            'Unable to log in right now.'
                    });
                }
            }
        );
    });

    // ======================================================
    // ONE-TIME ADMIN PASSWORD ACTIVATION
    //
    // POST /api/admin/activate-password
    //
    // DEVELOPMENT ONLY
    // ======================================================

    router.post(
        '/admin/activate-password',
        (req, res) => {

            // ==========================================
            // PREVENT DEVELOPMENT ACTIVATION
            // IN PRODUCTION
            // ==========================================

            if (
                process.env.NODE_ENV === 'production'
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        'Development account activation is disabled in production.'
                });
            }

            // ==========================================
            // GET DETAILS
            // ==========================================

            const username = String(
                req.body?.username || ''
            ).trim().toLowerCase();

            const currentPassword =
                req.body?.currentPassword;

            const newPassword =
                req.body?.newPassword;

            // ==========================================
            // VALIDATE STRONG PASSWORD
            // ==========================================

            
            const validNewPassword =
                isStrongPassword(newPassword) &&
                newPassword !== 'admin';


            if (
                !username ||
                username.length > 100 ||
                typeof currentPassword !== 'string' ||
                currentPassword.length > 256 ||
                !validNewPassword
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        'New password needs 12+ characters, uppercase, lowercase, a number, and a symbol.'
                });
            }

            // ==========================================
            // FIND ADMIN ACCOUNT
            // ==========================================

            db.query(
                `
                SELECT id, password_hash
                FROM users
                WHERE username = ?
                  AND role = 'admin'
                LIMIT 1
                `,
                [username],

                async (error, rows) => {

                    if (error) {

                        console.error(
                            'Admin activation lookup:',
                            error
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                'Unable to update password.'
                        });
                    }

                    if (!rows?.length) {

                        return res.status(401).json({
                            success: false,
                            message:
                                'Invalid administrator credentials.'
                        });
                    }

                    try {

                        const user = rows[0];

                        // ==============================
                        // VERIFY CURRENT PASSWORD
                        // ==============================

                        const currentMatches =
                            await bcrypt.compare(
                                currentPassword,
                                user.password_hash
                            );

                        // ==============================
                        // VERIFY TEMPORARY PASSWORD
                        // ==============================

                        const isTemporary =
                            await bcrypt.compare(
                                'admin',
                                user.password_hash
                            );

                        if (
                            !currentMatches ||
                            !isTemporary
                        ) {

                            return res.status(401).json({
                                success: false,
                                message:
                                    'Invalid administrator credentials or password already changed.'
                            });
                        }

                        // ==============================
                        // HASH NEW PASSWORD
                        // ==============================

                        const newHash =
                            await bcrypt.hash(
                                newPassword,
                                12
                            );

                        // ==============================
                        // UPDATE MYSQL
                        // ==============================

                        db.query(
                            `
                            UPDATE users

                            SET password_hash = ?

                            WHERE id = ?
                              AND role = 'admin'
                              AND password_hash = ?
                            `,
                            [
                                newHash,
                                user.id,
                                user.password_hash
                            ],

                            (updateError, result) => {

                                if (updateError) {

                                    console.error(
                                        'Activate admin password:',
                                        updateError
                                    );

                                    return res.status(500).json({
                                        success: false,
                                        message:
                                            'Unable to update password.'
                                    });
                                }

                                if (
                                    result.affectedRows !== 1
                                ) {

                                    return res.status(409).json({
                                        success: false,
                                        message:
                                            'Account changed. Please retry login.'
                                    });
                                }

                                // ======================
                                // SUCCESS
                                // ======================

                                return res.json({
                                    success: true,
                                    message:
                                        'Password updated. Log in with the new password.'
                                });
                            }
                        );

                    } catch (activationError) {

                        console.error(
                            'Admin activation:',
                            activationError
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                'Unable to update password.'
                        });
                    }
                }
            );
        }
    );

    // ======================================================
    // RETURN ROUTER
    // ======================================================

    return router;
}

// ======================================================
// EXPORT
// ======================================================

module.exports = createAuthRouter;
