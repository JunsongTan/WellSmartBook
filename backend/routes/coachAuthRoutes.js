const express = require('express');
const bcrypt = require('bcryptjs');


module.exports = function createCoachAuthRoutes({
    db,
    verifiedEmails,
    authenticateToken
}) {

    const router =
        express.Router();


    // ==================================================
    // ACTIVE COACH MIDDLEWARE
    //
    // Admin can later block a coach simply by setting:
    //
    // coach_profiles.is_active = 0
    //
    // Any protected coach API using this middleware
    // immediately becomes unavailable to that coach.
    // ==================================================

    function authenticateActiveCoach(
        req,
        res,
        next
    ) {

        if (
            !req.user ||
            req.user.role !== 'coach'
        ) {

            return res
                .status(403)
                .json({
                    success: false,

                    message:
                        'Coach account required.'
                });
        }


        db.query(
            `
            SELECT

                cp.*,

                u.username,
                u.email,
                u.full_name,
                u.profile_picture,
                u.role

            FROM coach_profiles cp

            INNER JOIN users u
                ON u.id = cp.user_id

            WHERE cp.user_id = ?

            LIMIT 1
            `,
            [
                req.user.id
            ],

            (
                error,
                results
            ) => {

                if (error) {

                    console.error(
                        'Coach authentication error:',
                        error
                    );


                    return res
                        .status(500)
                        .json({
                            success: false,

                            message:
                                'Unable to verify coach account.'
                        });
                }


                if (
                    results.length === 0
                ) {

                    return res
                        .status(403)
                        .json({
                            success: false,

                            message:
                                'Coach profile not found.'
                        });
                }


                const coach =
                    results[0];


                // ======================================
                // ADMIN BLOCK
                // ======================================

                if (
                    Number(
                        coach.is_active
                    ) !== 1
                ) {

                    return res
                        .status(403)
                        .json({
                            success: false,

                            code:
                                'COACH_BLOCKED',

                            message:
                                'Your coach account has been disabled by WellSmartBook administration.'
                        });
                }


                // We currently register coaches as
                // approved automatically.
                //
                // Keep this check because it allows
                // future Admin moderation.

                if (
                    coach.approval_status ===
                    'rejected'
                ) {

                    return res
                        .status(403)
                        .json({
                            success: false,

                            code:
                                'COACH_REJECTED',

                            message:
                                coach.rejection_reason ||
                                'Your coach account is currently unavailable.'
                        });
                }


                req.coach =
                    coach;


                next();
            }
        );
    }


    // ==================================================
    // REGISTER COACH
    // ==================================================

    router.post(
        '/register-coach',

        async (
            req,
            res
        ) => {

            const {
                username,
                email,
                password,
                fullName,

                phone,
                specialization,
                bio,
                yearsExperience,

                serviceArea,

                addressLine1,
                addressLine2,

                city,
                state,
                postcode,
                country,

                defaultSessionPrice
            } =
                req.body;


            // ==========================================
            // NORMALISE
            // ==========================================

            const normalizedEmail =
                String(
                    email || ''
                )
                    .trim()
                    .toLowerCase();


            const normalizedUsername =
                String(
                    username || ''
                ).trim();


            const normalizedFullName =
                String(
                    fullName || ''
                ).trim();


            const normalizedPhone =
                String(
                    phone || ''
                ).trim();


            const normalizedSpecialization =
                String(
                    specialization || ''
                ).trim();


            const normalizedAddressLine1 =
                String(
                    addressLine1 || ''
                ).trim();


            const normalizedCity =
                String(
                    city || ''
                ).trim();


            const normalizedState =
                String(
                    state || ''
                ).trim();


            const normalizedCountry =
                String(
                    country ||
                    'Malaysia'
                ).trim();


            // ==========================================
            // REQUIRED FIELDS
            // ==========================================

            if (
                !normalizedUsername ||
                !normalizedEmail ||
                !password ||
                !normalizedFullName ||
                !normalizedPhone ||
                !normalizedSpecialization ||
                !normalizedAddressLine1 ||
                !normalizedCity ||
                !normalizedState
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Please complete all required coach registration information.'
                    });
            }


            // ==========================================
            // USERNAME
            // ==========================================

            if (
                normalizedUsername.length <
                3
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Username must contain at least 3 characters.'
                    });
            }


            // ==========================================
            // PASSWORD
            // ==========================================

            if (
                !/^(?=.*[A-Z])(?=.*\d).{8,}$/
                    .test(
                        password
                    )
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Password must contain at least 8 characters, one uppercase letter and one number.'
                    });
            }


            // ==========================================
            // OTP VERIFICATION
            // ==========================================

            const verifiedUntil =
                verifiedEmails.get(
                    normalizedEmail
                );


            if (
                !verifiedUntil ||
                Date.now() >
                verifiedUntil
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Please verify your email before registering.'
                    });
            }


            // ==========================================
            // EXPERIENCE
            // ==========================================

            const numericExperience =
                Number(
                    yearsExperience ||
                    0
                );


            if (
                !Number.isInteger(
                    numericExperience
                ) ||
                numericExperience < 0 ||
                numericExperience > 70
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Years of experience must be between 0 and 70.'
                    });
            }


            // ==========================================
            // SESSION PRICE
            // ==========================================

            const numericPrice =
                Number(
                    defaultSessionPrice ||
                    0
                );


            if (
                !Number.isFinite(
                    numericPrice
                ) ||
                numericPrice < 0 ||
                numericPrice > 10000
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Please enter a valid session price.'
                    });
            }


            // ==========================================
            // DUPLICATE ACCOUNT
            // ==========================================

            db.query(
                `
                SELECT id

                FROM users

                WHERE email = ?
                   OR username = ?

                LIMIT 1
                `,
                [
                    normalizedEmail,
                    normalizedUsername
                ],

                async (
                    lookupError,
                    existingUsers
                ) => {

                    if (
                        lookupError
                    ) {

                        console.error(
                            'Coach duplicate lookup:',
                            lookupError
                        );


                        return res
                            .status(500)
                            .json({
                                success: false,

                                message:
                                    'Unable to validate coach account.'
                            });
                    }


                    if (
                        existingUsers.length >
                        0
                    ) {

                        return res
                            .status(409)
                            .json({
                                success: false,

                                message:
                                    'Email or username is already registered.'
                            });
                    }


                    try {

                        const passwordHash =
                            await bcrypt.hash(
                                password,
                                10
                            );


                        // ==================================
                        // BEGIN DATABASE TRANSACTION
                        // ==================================

                        db.beginTransaction(
                            (
                                transactionError
                            ) => {

                                if (
                                    transactionError
                                ) {

                                    console.error(
                                        'Coach transaction:',
                                        transactionError
                                    );


                                    return res
                                        .status(500)
                                        .json({
                                            success: false,

                                            message:
                                                'Unable to start coach registration.'
                                        });
                                }


                                // ==========================
                                // CREATE USER LOGIN
                                // ==========================

                                db.query(
                                    `
                                    INSERT INTO users
                                    (
                                        username,
                                        email,
                                        password_hash,
                                        role,
                                        full_name
                                    )

                                    VALUES
                                    (
                                        ?,
                                        ?,
                                        ?,
                                        'coach',
                                        ?
                                    )
                                    `,
                                    [
                                        normalizedUsername,
                                        normalizedEmail,
                                        passwordHash,
                                        normalizedFullName
                                    ],

                                    (
                                        userInsertError,
                                        userResult
                                    ) => {

                                        if (
                                            userInsertError
                                        ) {

                                            return db.rollback(
                                                () => {

                                                    console.error(
                                                        'Coach user insert:',
                                                        userInsertError
                                                    );


                                                    return res
                                                        .status(500)
                                                        .json({
                                                            success: false,

                                                            message:
                                                                'Unable to create coach login account.'
                                                        });
                                                }
                                            );
                                        }


                                        const newUserId =
                                            userResult.insertId;


                                        // ======================
                                        // CREATE COACH PROFILE
                                        // ======================

                                        db.query(
                                            `
                                            INSERT INTO coach_profiles
                                            (
                                                user_id,

                                                phone,
                                                specialization,
                                                bio,
                                                years_experience,

                                                service_area,

                                                address_line1,
                                                address_line2,

                                                city,
                                                state,
                                                postcode,
                                                country,

                                                default_session_price,
                                                currency,

                                                approval_status,
                                                rejection_reason,

                                                is_active
                                            )

                                            VALUES
                                            (
                                                ?,

                                                ?,
                                                ?,
                                                ?,
                                                ?,

                                                ?,

                                                ?,
                                                ?,

                                                ?,
                                                ?,
                                                ?,
                                                ?,

                                                ?,
                                                'MYR',

                                                'approved',
                                                NULL,

                                                1
                                            )
                                            `,
                                            [
                                                newUserId,

                                                normalizedPhone,

                                                normalizedSpecialization,

                                                bio
                                                    ? String(
                                                        bio
                                                    ).trim()
                                                    : null,

                                                numericExperience,

                                                serviceArea
                                                    ? String(
                                                        serviceArea
                                                    ).trim()
                                                    : null,

                                                normalizedAddressLine1,

                                                addressLine2
                                                    ? String(
                                                        addressLine2
                                                    ).trim()
                                                    : null,

                                                normalizedCity,

                                                normalizedState,

                                                postcode
                                                    ? String(
                                                        postcode
                                                    ).trim()
                                                    : null,

                                                normalizedCountry,

                                                numericPrice
                                            ],

                                            (
                                                coachInsertError,
                                                coachResult
                                            ) => {

                                                if (
                                                    coachInsertError
                                                ) {

                                                    return db.rollback(
                                                        () => {

                                                            console.error(
                                                                'Coach profile insert:',
                                                                coachInsertError
                                                            );


                                                            return res
                                                                .status(500)
                                                                .json({
                                                                    success: false,

                                                                    message:
                                                                        'Unable to create coach profile.'
                                                                });
                                                        }
                                                    );
                                                }


                                                // ==================
                                                // COMMIT
                                                // ==================

                                                db.commit(
                                                    (
                                                        commitError
                                                    ) => {

                                                        if (
                                                            commitError
                                                        ) {

                                                            return db.rollback(
                                                                () => {

                                                                    console.error(
                                                                        'Coach commit:',
                                                                        commitError
                                                                    );


                                                                    return res
                                                                        .status(500)
                                                                        .json({
                                                                            success: false,

                                                                            message:
                                                                                'Unable to complete coach registration.'
                                                                        });
                                                                }
                                                            );
                                                        }


                                                        verifiedEmails.delete(
                                                            normalizedEmail
                                                        );


                                                        return res
                                                            .status(201)
                                                            .json({
                                                                success: true,

                                                                message:
                                                                    'Coach account created successfully.',

                                                                userId:
                                                                    newUserId,

                                                                coachId:
                                                                    coachResult.insertId,

                                                                role:
                                                                    'coach'
                                                            });
                                                    }
                                                );
                                            }
                                        );
                                    }
                                );
                            }
                        );

                    } catch (
                        error
                    ) {

                        console.error(
                            'Register coach:',
                            error
                        );


                        return res
                            .status(500)
                            .json({
                                success: false,

                                message:
                                    'Unable to create coach account.'
                            });
                    }
                }
            );
        }
    );


    // ==================================================
    // CURRENT COACH PROFILE
    // ==================================================

    router.get(
        '/coach/profile',

        authenticateToken,
        authenticateActiveCoach,

        (
            req,
            res
        ) => {

            const coach =
                req.coach;


            return res.json({
                success: true,

                coach: {

                    id:
                        coach.id,

                    userId:
                        coach.user_id,

                    username:
                        coach.username,

                    fullName:
                        coach.full_name,

                    email:
                        coach.email,

                    profilePicture:
                        coach.profile_picture,

                    phone:
                        coach.phone,

                    specialization:
                        coach.specialization,

                    bio:
                        coach.bio,

                    yearsExperience:
                        Number(
                            coach.years_experience ||
                            0
                        ),

                    serviceArea:
                        coach.service_area,

                    address: {

                        line1:
                            coach.address_line1,

                        line2:
                            coach.address_line2,

                        city:
                            coach.city,

                        state:
                            coach.state,

                        postcode:
                            coach.postcode,

                        country:
                            coach.country
                    },

                    latitude:
                        coach.latitude !==
                        null

                            ? Number(
                                coach.latitude
                            )

                            : null,

                    longitude:
                        coach.longitude !==
                        null

                            ? Number(
                                coach.longitude
                            )

                            : null,

                    defaultSessionPrice:
                        Number(
                            coach.default_session_price ||
                            0
                        ),

                    currency:
                        coach.currency,

                    approvalStatus:
                        coach.approval_status,

                    isActive:
                        Boolean(
                            coach.is_active
                        )
                }
            });
        }
    );


    return router;
};