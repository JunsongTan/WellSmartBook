const express =
    require('express');

const bcrypt =
    require('bcryptjs');

const {
    verifiedEmails
} =
    require('./authState');


const {
    isStrongPassword,
    PASSWORD_MESSAGE
} = require('../helpers/passwordPolicy');


// ======================================================
// COACH AUTH ROUTES
// ======================================================

function createCoachAuthRouter({
    db,
    authenticateToken,
    authenticateActiveCoach
}) {

    const router =
        express.Router();


    // ======================================================
    // REGISTER COACH
    // ======================================================

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


            // ==============================================
            // NORMALISE
            // ==============================================

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


            // ==============================================
            // REQUIRED VALUES
            // ==============================================

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
                            'Please complete all required coach registration fields.'
                    });
            }


            // ==============================================
            // USERNAME
            // ==============================================

            if (
                normalizedUsername.length < 3
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Username must contain at least 3 characters.'
                    });
            }


            
            // ======================================================
            // VALIDATE COACH REGISTRATION PASSWORD
            // ======================================================

            if (!isStrongPassword(password)) {

                return res.status(400).json({
                    success: false,
                    message: PASSWORD_MESSAGE
                });
            }



            // ==============================================
            // EMAIL MUST ALREADY BE OTP VERIFIED
            // ==============================================

            const verificationKey =
                `coach_registration:${normalizedEmail}`;


            const verifiedUntil =
                verifiedEmails.get(
                    verificationKey
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


            // ==============================================
            // EXPERIENCE
            // ==============================================

            const numericExperience =
                Number(
                    yearsExperience || 0
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


            // ==============================================
            // SESSION PRICE
            // ==============================================

            const numericPrice =
                Number(
                    defaultSessionPrice || 0
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


            // ==============================================
            // DUPLICATE ACCOUNT CHECK
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

                async (
                    lookupError,
                    existingUsers
                ) => {

                    if (
                        lookupError
                    ) {

                        console.error(
                            'Coach registration lookup:',
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
                        existingUsers.length > 0
                    ) {

                        return res
                            .status(409)
                            .json({
                                success: false,

                                message:
                                    'This email is already registered.'
                            });
                    }


                    try {

                        const passwordHash =
                            await bcrypt.hash(
                                password,
                                10
                            );


                        // ==================================
                        // TRANSACTION
                        // ==================================

                        db.beginTransaction(
                            (
                                transactionError
                            ) => {

                                if (
                                    transactionError
                                ) {

                                    return res
                                        .status(500)
                                        .json({
                                            success: false,

                                            message:
                                                'Unable to start coach registration.'
                                        });
                                }


                                // ==========================
                                // CREATE LOGIN ACCOUNT
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
                                                                'Unable to create coach account.'
                                                        });
                                                }
                                            );
                                        }


                                        const newUserId =
                                            userResult.insertId;


                                        // ==================
                                        // COACH PROFILE
                                        // ==================

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

                                                String(
                                                    country ||
                                                    'Malaysia'
                                                ).trim(),

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
                                                            verificationKey
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
        // ======================================================
    // GET CURRENT COACH PROFILE
    // ======================================================

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

                success:
                    true,

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
                        coach.latitude !== null
                            ? Number(
                                coach.latitude
                            )
                            : null,

                    longitude:
                        coach.longitude !== null
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

                    isActive:
                        Boolean(
                            coach.is_active
                        )

                }

            });
        }
    );


    return router;
}


module.exports =
    createCoachAuthRouter;