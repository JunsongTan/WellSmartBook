const express =
    require('express');

const bcrypt =
    require('bcryptjs');

const {
    safeParseJson,
    normalizeDateOnly,
    calculateAge,
    normalizeAllergies
} =
    require('../helpers/generalHelpers');

const {
    ACTIVITY_FACTORS,
    calculatePersonalTargets,
    formatUserForClient
} =
    require('../helpers/userHelpers');

const {
    safeDeleteFile
} =
    require('../helpers/fileHelpers');

const {
    saveProfileImage,
    getProfileImagePathFromUrl
} =
    require('../helpers/profileImageHelpers');

const {
    profileUpload
} =
    require('../helpers/uploadHelpers');

const {
    isStrongPassword,
    PASSWORD_MESSAGE
} = require('../helpers/passwordPolicy');


// ======================================================
// PROFILE ROUTES
// ======================================================

function createProfileRouter({
    db,
    authenticateToken
}) {

    const router =
        express.Router();


    // ======================================================
    // GET PROFILE
    // ======================================================

    router.get(
        '/profile',

        authenticateToken,

        (
            req,
            res
        ) => {

            db.query(
                `
                SELECT *
                FROM users
                WHERE id = ?
                LIMIT 1
                `,
                [
                    req.user.id
                ],

                (
                    error,
                    results
                ) => {

                    if (
                        error
                    ) {
                        return res
                            .status(500)
                            .json({
                                message:
                                    'Unable to load profile.'
                            });
                    }


                    if (
                        results.length ===
                        0
                    ) {
                        return res
                            .status(404)
                            .json({
                                message:
                                    'Profile not found.'
                            });
                    }


                    return res.json({
                        success: true,

                        user:
                            formatUserForClient(
                                results[0]
                            )
                    });
                }
            );
        }
    );


    // ======================================================
    // UPDATE PROFILE
    // ======================================================

    router.patch(
        '/profile',

        authenticateToken,

        (
            req,
            res
        ) => {

            const userId =
                req.user.id;


            db.query(
                `
                SELECT *
                FROM users
                WHERE id = ?
                LIMIT 1
                `,
                [userId],

                (
                    loadError,
                    results
                ) => {

                    if (
                        loadError
                    ) {
                        return res
                            .status(500)
                            .json({
                                message:
                                    'Unable to load profile.'
                            });
                    }


                    if (
                        results.length ===
                        0
                    ) {
                        return res
                            .status(404)
                            .json({
                                message:
                                    'User profile not found.'
                            });
                    }


                    const current =
                        results[0];


                    const username =
                        String(
                            req.body.username ??
                            current.username
                        ).trim();


                    const fullName =
                        String(
                            req.body.fullName ??
                            current.full_name
                        ).trim();


                    const dateOfBirth =
                        normalizeDateOnly(
                            req.body.dateOfBirth ??
                            current.date_of_birth
                        );


                    const gender =
                        req.body.gender ??
                        current.gender;


                    const height =
                        Number(
                            req.body.height ??
                            current.height
                        );


                    const weight =
                        Number(
                            req.body.weight ??
                            current.weight
                        );


                    const activityLevel =
                        req.body.activityLevel ??
                        current.activity_level;


                    const primaryGoal =
                        req.body.primaryGoal ??
                        current.primary_goal;


                    let targetWeight =
                        Number(
                            req.body.targetWeight ??
                            current.target_weight ??
                            weight
                        );


                    let goalPace =
                        req.body.goalPace ??
                        current.goal_pace;


                    const exerciseDaysPerWeek =
                        Number(
                            req.body.exerciseDaysPerWeek ??
                            current.exercise_days_per_week ??
                            0
                        );


                    const exerciseMinutes =
                        Number(
                            req.body.exerciseMinutes ??
                            current.exercise_minutes ??
                            0
                        );


                    const dietaryPreference =
                        req.body.dietaryPreference ??
                        current.dietary_preference;


                    const mealsPerDay =
                        Number(
                            req.body.mealsPerDay ??
                            current.meals_per_day ??
                            3
                        );


                    const cookingTimePreference =
                        req.body.cookingTimePreference ??
                        current.cooking_time_preference;


                    const allergies =
                        normalizeAllergies(
                            Array.isArray(
                                req.body.allergies
                            )
                                ? req.body.allergies
                                : safeParseJson(
                                    current.allergies,
                                    []
                                )
                        );


                    if (
                        username.length <
                        3
                    ) {
                        return res
                            .status(400)
                            .json({
                                message:
                                    'Username must be at least 3 characters.'
                            });
                    }


                    if (!fullName) {
                        return res
                            .status(400)
                            .json({
                                message:
                                    'Full name is required.'
                            });
                    }


                    if (
                        ![
                            'Male',
                            'Female'
                        ].includes(
                            gender
                        )
                    ) {
                        return res
                            .status(400)
                            .json({
                                message:
                                    'Please select Male or Female for energy calculation.'
                            });
                    }


                    const age =
                        calculateAge(
                            dateOfBirth
                        );


                    if (
                        age === null ||
                        age < 18
                    ) {
                        return res
                            .status(400)
                            .json({
                                message:
                                    'Personalized calorie targets require age 18 or above.'
                            });
                    }


                    if (
                        !Number.isFinite(
                            height
                        ) ||
                        height < 100 ||
                        height > 250
                    ) {
                        return res
                            .status(400)
                            .json({
                                message:
                                    'Height must be between 100 cm and 250 cm.'
                            });
                    }


                    if (
                        !Number.isFinite(
                            weight
                        ) ||
                        weight < 30 ||
                        weight > 300
                    ) {
                        return res
                            .status(400)
                            .json({
                                message:
                                    'Weight must be between 30 kg and 300 kg.'
                            });
                    }


                    if (
                        !ACTIVITY_FACTORS[
                            activityLevel
                        ]
                    ) {
                        return res
                            .status(400)
                            .json({
                                message:
                                    'Invalid activity level.'
                            });
                    }


                    if (
                        ![
                            'Lose Weight',
                            'Maintain Weight',
                            'Build Muscle'
                        ].includes(
                            primaryGoal
                        )
                    ) {
                        return res
                            .status(400)
                            .json({
                                message:
                                    'Invalid health goal.'
                            });
                    }


                    if (
                        primaryGoal ===
                        'Maintain Weight'
                    ) {
                        targetWeight =
                            weight;

                        goalPace =
                            'Maintain';
                    }


                    if (
                        primaryGoal ===
                        'Lose Weight'
                    ) {

                        if (
                            !Number.isFinite(
                                targetWeight
                            ) ||
                            targetWeight >=
                            weight
                        ) {
                            return res
                                .status(400)
                                .json({
                                    message:
                                        'For weight loss, target weight must be lower than current weight.'
                                });
                        }


                        if (
                            ![
                                'Gradual',
                                'Moderate',
                                'Faster'
                            ].includes(
                                goalPace
                            )
                        ) {
                            return res
                                .status(400)
                                .json({
                                    message:
                                        'Invalid weight-loss pace.'
                                });
                        }
                    }


                    if (
                        primaryGoal ===
                        'Build Muscle'
                    ) {

                        if (
                            !Number.isFinite(
                                targetWeight
                            ) ||
                            targetWeight <=
                            weight
                        ) {
                            return res
                                .status(400)
                                .json({
                                    message:
                                        'For muscle building, target weight must be higher than current weight.'
                                });
                        }


                        if (
                            ![
                                'Lean Gain',
                                'Standard Gain'
                            ].includes(
                                goalPace
                            )
                        ) {
                            return res
                                .status(400)
                                .json({
                                    message:
                                        'Invalid muscle-building pace.'
                                });
                        }
                    }


                    if (
                        !Number.isInteger(
                            exerciseDaysPerWeek
                        ) ||
                        exerciseDaysPerWeek < 0 ||
                        exerciseDaysPerWeek > 7
                    ) {
                        return res
                            .status(400)
                            .json({
                                message:
                                    'Exercise days must be between 0 and 7.'
                            });
                    }


                    if (
                        !Number.isFinite(
                            exerciseMinutes
                        ) ||
                        exerciseMinutes < 0 ||
                        exerciseMinutes > 300
                    ) {
                        return res
                            .status(400)
                            .json({
                                message:
                                    'Exercise duration must be between 0 and 300 minutes.'
                            });
                    }


                    if (
                        !Number.isInteger(
                            mealsPerDay
                        ) ||
                        mealsPerDay < 1 ||
                        mealsPerDay > 8
                    ) {
                        return res
                            .status(400)
                            .json({
                                message:
                                    'Meals per day must be between 1 and 8.'
                            });
                    }


                    let targets;


                    try {

                        targets =
                            calculatePersonalTargets({
                                gender,
                                dateOfBirth,
                                height,
                                weight,
                                activityLevel,
                                primaryGoal,
                                goalPace
                            });

                    } catch (error) {
                        return res
                            .status(400)
                            .json({
                                message:
                                    error.message
                            });
                    }


                    db.query(
                        `
                        SELECT id
                        FROM users
                        WHERE username = ?
                        AND id <> ?
                        LIMIT 1
                        `,
                        [
                            username,
                            userId
                        ],

                        (
                            duplicateError,
                            duplicates
                        ) => {

                            if (
                                duplicateError
                            ) {
                                return res
                                    .status(500)
                                    .json({
                                        message:
                                            'Unable to validate username.'
                                    });
                            }


                            if (
                                duplicates.length >
                                0
                            ) {
                                return res
                                    .status(409)
                                    .json({
                                        message:
                                            'That username is already taken.'
                                    });
                            }


                            db.query(
                                `
                                UPDATE users
                                SET
                                    username = ?,
                                    full_name = ?,
                                    date_of_birth = ?,
                                    gender = ?,
                                    height = ?,
                                    weight = ?,
                                    activity_level = ?,
                                    primary_goal = ?,
                                    target_weight = ?,
                                    goal_pace = ?,
                                    exercise_days_per_week = ?,
                                    exercise_minutes = ?,
                                    dietary_preference = ?,
                                    allergies = ?,
                                    meals_per_day = ?,
                                    cooking_time_preference = ?,
                                    bmi = ?,
                                    bmr = ?,
                                    tdee = ?,
                                    daily_calorie_target = ?,
                                    protein_target = ?,
                                    carbs_target = ?,
                                    fat_target = ?
                                WHERE id = ?
                                `,
                                [
                                    username,
                                    fullName,
                                    dateOfBirth,
                                    gender,
                                    height,
                                    weight,
                                    activityLevel,
                                    primaryGoal,
                                    targetWeight,
                                    goalPace,
                                    exerciseDaysPerWeek,
                                    exerciseMinutes,
                                    dietaryPreference,
                                    JSON.stringify(
                                        allergies
                                    ),
                                    mealsPerDay,
                                    cookingTimePreference,
                                    targets.bmi,
                                    targets.bmr,
                                    targets.tdee,
                                    targets.dailyCalorieTarget,
                                    targets.proteinTarget,
                                    targets.carbsTarget,
                                    targets.fatTarget,
                                    userId
                                ],

                                (
                                    updateError
                                ) => {

                                    if (
                                        updateError
                                    ) {
                                        console.error(
                                            'Profile update:',
                                            updateError
                                        );


                                        return res
                                            .status(500)
                                            .json({
                                                message:
                                                    'Unable to update profile.'
                                            });
                                    }


                                    db.query(
                                        `
                                        SELECT *
                                        FROM users
                                        WHERE id = ?
                                        LIMIT 1
                                        `,
                                        [userId],

                                        (
                                            reloadError,
                                            updatedUsers
                                        ) => {

                                            if (
                                                reloadError ||
                                                updatedUsers.length ===
                                                0
                                            ) {
                                                return res
                                                    .status(500)
                                                    .json({
                                                        message:
                                                            'Profile updated but could not be reloaded.'
                                                    });
                                            }


                                            return res.json({
                                                success: true,

                                                message:
                                                    'Profile updated successfully.',

                                                user:
                                                    formatUserForClient(
                                                        updatedUsers[0]
                                                    )
                                            });
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        }
    );


    // ======================================================
    // PROFILE PICTURE
    // ======================================================

    router.post(
        '/profile-picture',

        authenticateToken,

        profileUpload.single(
            'image'
        ),

        (
            req,
            res
        ) => {

            if (!req.file) {
                return res
                    .status(400)
                    .json({
                        message:
                            'Please choose a profile picture.'
                    });
            }


            let storedImage;


            try {

                storedImage =
                    saveProfileImage(
                        req.user.id,
                        req.file
                    );

            } catch (
                error
            ) {

                console.error(
                    'Store profile image:',
                    error
                );


                return res
                    .status(500)
                    .json({
                        message:
                            'Unable to store profile picture.'
                    });
            }


            const {
                filePath,
                imageUrl
            } =
                storedImage;


            db.query(
                `
                SELECT profile_picture
                FROM users
                WHERE id = ?
                LIMIT 1
                `,
                [
                    req.user.id
                ],

                (
                    readError,
                    rows
                ) => {

                    if (
                        readError
                    ) {
                        safeDeleteFile(
                            filePath
                        );


                        return res
                            .status(500)
                            .json({
                                message:
                                    'Unable to update profile picture.'
                            });
                    }


                    const previousPicture =
                        rows[0]
                            ?.profile_picture;


                    db.query(
                        `
                        UPDATE users
                        SET profile_picture = ?
                        WHERE id = ?
                        `,
                        [
                            imageUrl,
                            req.user.id
                        ],

                        (
                            updateError
                        ) => {

                            if (
                                updateError
                            ) {
                                safeDeleteFile(
                                    filePath
                                );


                                return res
                                    .status(500)
                                    .json({
                                        message:
                                            'Unable to update profile picture.'
                                    });
                            }


                            const previousFilePath =
                                getProfileImagePathFromUrl(
                                    previousPicture
                                );


                            if (
                                previousFilePath
                            ) {

                                safeDeleteFile(
                                    previousFilePath
                                );
                            }


                            db.query(
                                `
                                SELECT *
                                FROM users
                                WHERE id = ?
                                LIMIT 1
                                `,
                                [
                                    req.user.id
                                ],

                                (
                                    reloadError,
                                    updatedUsers
                                ) => {

                                    if (
                                        reloadError ||
                                        updatedUsers.length ===
                                        0
                                    ) {
                                        return res
                                            .status(500)
                                            .json({
                                                message:
                                                    'Picture changed but profile reload failed.'
                                            });
                                    }


                                    return res.json({
                                        success: true,

                                        message:
                                            'Profile picture updated.',

                                        user:
                                            formatUserForClient(
                                                updatedUsers[0]
                                            )
                                    });
                                }
                            );
                        }
                    );
                }
            );
        }
    );


    // ======================================================
    // PASSWORD
    // ======================================================

    router.patch(
        '/profile/password',

        authenticateToken,

        (
            req,
            res
        ) => {

            const {
                currentPassword,
                newPassword
            } =
                req.body;


            if (
                !currentPassword ||
                !newPassword
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            'Current password and new password are required.'
                    });
            }


            
            // ======================================================
            // VALIDATE NEW PASSWORD
            // APPLIES TO USERS AND COACHES
            // ======================================================

            if (!isStrongPassword(newPassword)) {

                return res.status(400).json({
                    success: false,
                    message: PASSWORD_MESSAGE
                });
            }



            db.query(
                `
                SELECT password_hash
                FROM users
                WHERE id = ?
                LIMIT 1
                `,
                [
                    req.user.id
                ],

                async (
                    error,
                    results
                ) => {

                    if (
                        error ||
                        results.length ===
                        0
                    ) {
                        return res
                            .status(500)
                            .json({
                                message:
                                    'Unable to verify password.'
                            });
                    }


                    const matches =
                        await bcrypt.compare(
                            currentPassword,
                            results[0]
                                .password_hash
                        );


                    if (!matches) {
                        return res
                            .status(400)
                            .json({
                                message:
                                    'Current password is incorrect.'
                            });
                    }


                    const passwordHash =
                        await bcrypt.hash(
                            newPassword,
                            10
                        );


                    db.query(
                        `
                        UPDATE users
                        SET password_hash = ?
                        WHERE id = ?
                        `,
                        [
                            passwordHash,
                            req.user.id
                        ],

                        (
                            updateError
                        ) => {

                            if (
                                updateError
                            ) {
                                return res
                                    .status(500)
                                    .json({
                                        message:
                                            'Unable to change password.'
                                    });
                            }


                            return res.json({
                                success: true,
                                message:
                                    'Password changed successfully.'
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
// EXPORT
// ======================================================

module.exports =
    createProfileRouter;