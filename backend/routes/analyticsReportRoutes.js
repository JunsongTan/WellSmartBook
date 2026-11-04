
const express = require('express');

const {
    calculatePersonalTargets
} = require('../helpers/userHelpers');

const {
    normalizeDateOnly
} = require('../helpers/generalHelpers');

// =====================================================
// WELLSMARTBOOK - USER ANALYTICS REPORT
//
// GET /api/analytics/report
//
// READ ONLY - DOES NOT MODIFY DATABASE
// =====================================================

function createAnalyticsReportRouter({
    db,
    bookingPool,
    authenticateToken
}) {

    const router = express.Router();

    // =================================================
    // MYSQL QUERY HELPER
    // =================================================

    function query(sql, values = []) {

        return new Promise((resolve, reject) => {

            db.query(sql, values, (error, rows) => {

                if (error) {
                    return reject(error);
                }

                resolve(rows);
            });
        });
    }

    // =================================================
    // CALCULATE CURRENT WEEK IN MALAYSIA
    //
    // Monday to Sunday
    // Assumes MySQL DATETIME stores Malaysia local time
    // =================================================

    function getMalaysiaPeriods(weekOffset = 0) {

        const parts = new Intl.DateTimeFormat(
            'en-GB',
            {
                timeZone: 'Asia/Kuala_Lumpur',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }
        ).formatToParts(new Date());

        const dateParts = Object.fromEntries(
            parts.map(part => [
                part.type,
                part.value
            ])
        );

        const year = Number(dateParts.year);
        const month = Number(dateParts.month);
        const day = Number(dateParts.day);

        const today = new Date(
            Date.UTC(year, month - 1, day)
        );

        const monday = new Date(today);

        monday.setUTCDate(
            today.getUTCDate() -
            ((today.getUTCDay() + 6) % 7) -
            (weekOffset * 7)
        );

        const nextMonday = new Date(monday);

        nextMonday.setUTCDate(
            monday.getUTCDate() + 7
        );

        const sunday = new Date(monday);

        sunday.setUTCDate(
            monday.getUTCDate() + 6
        );

        // Last 6 calendar months.

        const weightStart = new Date(
            Date.UTC(year, month - 6, 1)
        );

        const weightEndExclusive = new Date(
            Date.UTC(year, month, 1)
        );

        const asDate = value =>
            value.toISOString().slice(0, 10);

        return {
            weekStart: asDate(monday),
            weekEnd: asDate(sunday),
            weekEndExclusive: asDate(nextMonday),

            weightStart: asDate(weightStart),
            weightEndExclusive:
                asDate(weightEndExclusive)
        };
    }

    // =================================================
    // OPTIONAL NUMERIC FIELD
    // =================================================

    function optionalNumber(value) {

        if (
            value === null ||
            value === undefined ||
            value === ''
        ) {
            return null;
        }

        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : null;
    }

    // =================================================
    // CONVERT DAILY TARGET TO WEEKLY TARGET
    // =================================================

    function weeklyTarget(value) {

        const daily = optionalNumber(value);

        if (daily === null || daily <= 0) {
            return null;
        }

        return Number(
            (daily * 7).toFixed(2)
        );
    }

    // =================================================
    // GET USER ANALYTICS REPORT
    //
    // GET /api/analytics/report
    // =================================================

    router.get(
        '/analytics/report',

        authenticateToken,

        async (req, res) => {

            const userId = Number(
                req.user?.id
            );

            // =========================================
            // VERIFY NORMAL USER
            // =========================================

            if (
                req.user?.role !== 'user' ||
                req.user?.purpose ===
                    'admin_password_change' ||
                !Number.isSafeInteger(userId) ||
                userId <= 0
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        'User account access required.'
                });
            }
            
            // =====================================================
            // VALIDATE NUTRITION REPORTING WEEK
            //
            // 0 = This Week
            // 1 = Last Week
            // =====================================================

            const weekOffsetRaw = String(
                req.query.weekOffset ?? '0'
            );

            if (!['0', '1'].includes(weekOffsetRaw)) {

                return res.status(400).json({
                    success: false,
                    message:
                        'weekOffset must be 0 (this week) or 1 (last week).'
                });
            }

            const weekOffset = Number(weekOffsetRaw);


            try {

                // =====================================
                // LOAD CURRENT USER'S PROFILE TARGETS
                // =====================================

                const users = await query(
                    `
                    SELECT
                        weight,
                        target_weight,
                        daily_calorie_target,
                        protein_target,
                        carbs_target,
                        fat_target
                    FROM users
                    WHERE id = ?
                      AND role = 'user'
                      AND is_active = 1
                    LIMIT 1
                    `,
                    [userId]
                );

                if (!users.length) {

                    return res.status(403).json({
                        success: false,
                        message:
                            'Active user account not found.'
                    });
                }

                const user = users[0];

                const period = getMalaysiaPeriods(weekOffset);

                // =====================================
                // GET GENUINE WEIGHT HISTORY
                //
                // Last 6 calendar months.
                // Do not generate fake measurements.
                // =====================================

                const weightRows = await query(
                    `
                    SELECT
                        id,
                        weight_kg,

                        DATE_FORMAT(
                            recorded_at,
                            '%Y-%m-%d %H:%i:%s'
                        ) AS recorded_at

                    FROM weight_history

                    WHERE user_id = ?

                      AND recorded_at >=
                          CONCAT(?, ' 00:00:00')

                      AND recorded_at <
                          CONCAT(?, ' 00:00:00')

                    ORDER BY
                        recorded_at DESC,
                        id DESC

                    LIMIT 1000
                    `,
                    [
                        userId,
                        period.weightStart,
                        period.weightEndExclusive
                    ]
                );

                // =====================================
                // CALCULATE WEEKLY NUTRIENT TOTALS
                //
                // Only meals for logged-in user.
                // Monday 00:00 to next Monday 00:00.
                // =====================================

                const mealRows = await query(
                    `
                    SELECT

                        COUNT(*) AS meal_count,

                        COALESCE(
                            SUM(calories),
                            0
                        ) AS calories,

                        COALESCE(
                            SUM(protein_grams),
                            0
                        ) AS protein_grams,

                        COALESCE(
                            SUM(carbs_grams),
                            0
                        ) AS carbs_grams,

                        COALESCE(
                            SUM(fat_grams),
                            0
                        ) AS fat_grams

                    FROM meal_logs

                    WHERE user_id = ?

                      AND logged_at >=
                          CONCAT(?, ' 00:00:00')

                      AND logged_at <
                          CONCAT(?, ' 00:00:00')
                    `,
                    [
                        userId,
                        period.weekStart,
                        period.weekEndExclusive
                    ]
                );
                
                // =====================================
                // DAILY NUTRITION BREAKDOWN
                //
                // Only the authenticated user's meals.
                // Group by Malaysia-local logged_at date.
                // =====================================

                const dailyRows = await query(
                    `
                    SELECT
                        DATE_FORMAT(
                            logged_at,
                            '%Y-%m-%d'
                        ) AS meal_date,

                        COUNT(*) AS meal_count,

                        COALESCE(SUM(calories), 0)
                            AS calories,

                        COALESCE(SUM(protein_grams), 0)
                            AS protein_grams,

                        COALESCE(SUM(carbs_grams), 0)
                            AS carbs_grams,

                        COALESCE(SUM(fat_grams), 0)
                            AS fat_grams

                    FROM meal_logs

                    WHERE user_id = ?
                      AND logged_at >=
                          CONCAT(?, ' 00:00:00')
                      AND logged_at <
                          CONCAT(?, ' 00:00:00')

                    GROUP BY DATE_FORMAT(
                        logged_at, '%Y-%m-%d'
                    )

                    ORDER BY meal_date ASC
                    `,
                    [
                        userId,
                        period.weekStart,
                        period.weekEndExclusive
                    ]
                );

                // Include all seven days, even when there
                // are no recorded meals for a given day.

                const dailyByDate = new Map(
                    dailyRows.map(row => [
                        row.meal_date,
                        row
                    ])
                );

                const weekMonday = new Date(
                    `${period.weekStart}T00:00:00Z`
                );

                const dailyNutrition = Array.from(
                    { length: 7 },
                    (_, dayIndex) => {

                        const date = new Date(weekMonday);

                        date.setUTCDate(
                            date.getUTCDate() + dayIndex
                        );

                        const dateKey = date
                            .toISOString()
                            .slice(0, 10);

                        const day = dailyByDate.get(dateKey);

                        return {
                            date: dateKey,

                            mealCount: Number(
                                day?.meal_count || 0
                            ),

                            totals: {
                                calories: Number(
                                    day?.calories || 0
                                ),

                                proteinGrams: Number(
                                    day?.protein_grams || 0
                                ),

                                carbsGrams: Number(
                                    day?.carbs_grams || 0
                                ),

                                fatGrams: Number(
                                    day?.fat_grams || 0
                                )
                            }
                        };
                    }
                );


                const meals = mealRows[0] || {};

                // =====================================
                // RETURN ANALYTICS REPORT
                // =====================================

                return res.json({

                    success: true,

                    period: {
                        weekOffset,
                        timeZone:
                            'Asia/Kuala_Lumpur',

                        weekStart:
                            period.weekStart,

                        weekEnd:
                            period.weekEnd,

                        weightHistoryFrom:
                            period.weightStart
                    },

                    // =================================
                    // USER WEIGHT AND GOAL
                    // =================================

                    profile: {

                        currentWeightKg:
                            optionalNumber(
                                user.weight
                            ),

                        targetWeightKg:
                            optionalNumber(
                                user.target_weight
                            )
                    },

                    // =================================
                    // HISTORICAL WEIGHT RECORDS
                    // =================================

                    weightHistory: weightRows
                        .reverse()
                        .map(row => ({

                            id: Number(row.id),

                            weightKg:
                                Number(row.weight_kg),

                            recordedAt:
                                row.recorded_at
                        })),

                    // =================================
                    // WEEKLY MACRONUTRIENTS
                    // =================================

                    weeklyNutrition: {
                        // Daily breakdown, Monday through Sunday
                        days: dailyNutrition,

                        mealCount:
                            Number(
                                meals.meal_count || 0
                            ),

                        totals: {

                            calories:
                                Number(
                                    meals.calories || 0
                                ),

                            proteinGrams:
                                Number(
                                    meals.protein_grams || 0
                                ),

                            carbsGrams:
                                Number(
                                    meals.carbs_grams || 0
                                ),

                            fatGrams:
                                Number(
                                    meals.fat_grams || 0
                                )
                        },

                        // Daily goals multiplied by 7.

                        targets: {

                            calories:
                                weeklyTarget(
                                    user.daily_calorie_target
                                ),

                            proteinGrams:
                                weeklyTarget(
                                    user.protein_target
                                ),

                            carbsGrams:
                                weeklyTarget(
                                    user.carbs_target
                                ),

                            fatGrams:
                                weeklyTarget(
                                    user.fat_target
                                )
                        }
                    }
                });

            } catch (error) {

                console.error(
                    'Analytics report:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        'Unable to load analytics report.'
                });
            }
        }
    );
    
    // =================================================
    // RECORD A WEIGHT MEASUREMENT
    //
    // POST /api/analytics/weights
    //
    // Body:
    // {
    //     "weightKg": 74.8
    // }
    // =================================================

    router.post(
        '/analytics/weights',

        authenticateToken,

        async (req, res) => {

            const userId = Number(
                req.user?.id
            );

            const rawWeight =
                req.body?.weightKg;

            const weightText =
                String(rawWeight ?? '').trim();

            const weightKg =
                Number(weightText);

            // =========================================
            // VERIFY NORMAL USER ACCOUNT
            // =========================================

            if (
                req.user?.role !== 'user' ||
                req.user?.purpose ===
                    'admin_password_change' ||
                !Number.isSafeInteger(userId) ||
                userId <= 0
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        'User account access required.'
                });
            }

            // =========================================
            // VALIDATE WEIGHT
            //
            // Same 30-300 kg range as User Profile.
            // =========================================

            if (
                !/^\d+(?:\.\d{1,2})?$/.test(weightText) ||
                !Number.isFinite(weightKg) ||
                weightKg < 30 ||
                weightKg > 300
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        'Enter a weight between 30 and 300 kg, ' +
                        'with at most two decimal places.'
                });
            }

            let connection;
            let transactionStarted = false;

            try {

                // =====================================
                // OPEN MYSQL TRANSACTION
                // =====================================

                connection = await bookingPool
                    .promise()
                    .getConnection();

                await connection.beginTransaction();

                transactionStarted = true;

                // =====================================
                // LOCK CURRENT USER PROFILE
                // =====================================

                const [users] =
                    await connection.query(
                        `
                        SELECT
                            id,
                            weight,
                            gender,
                            date_of_birth,
                            height,
                            activity_level,
                            primary_goal,
                            goal_pace

                        FROM users

                        WHERE id = ?
                          AND role = 'user'
                          AND is_active = 1

                        LIMIT 1
                        FOR UPDATE
                        `,
                        [userId]
                    );

                if (users.length === 0) {

                    await connection.rollback();
                    transactionStarted = false;

                    return res.status(403).json({
                        success: false,
                        message:
                            'Active user account not found.'
                    });
                }

                const user = users[0];

                const previousWeight =
                    user.weight === null
                        ? null
                        : Number(user.weight);

                // =====================================
                // CASE 1: USER'S WEIGHT HAS CHANGED
                // =====================================

                if (previousWeight !== weightKg) {

                    let calculated;

                    try {

                        // Reuse existing Profile calculations.

                        calculated =
                            calculatePersonalTargets({

                                gender:
                                    user.gender,

                                dateOfBirth:
                                    normalizeDateOnly(
                                        user.date_of_birth
                                    ),

                                height:
                                    Number(user.height),

                                weight:
                                    weightKg,

                                activityLevel:
                                    user.activity_level,

                                primaryGoal:
                                    user.primary_goal,

                                goalPace:
                                    user.goal_pace
                            });

                    } catch (calculationError) {

                        await connection.rollback();
                        transactionStarted = false;

                        return res.status(422).json({
                            success: false,
                            message:
                                'Please complete your health details in ' +
                                'Profile before recording a new weight.'
                        });
                    }

                    // =================================
                    // UPDATE CURRENT PROFILE WEIGHT
                    //
                    // Existing AFTER UPDATE trigger
                    // automatically saves weight history.
                    //
                    // Do not insert a second history row.
                    // =================================

                    await connection.query(
                        `
                        UPDATE users

                        SET weight = ?,
                            bmi = ?,
                            bmr = ?,
                            tdee = ?,
                            daily_calorie_target = ?,
                            protein_target = ?,
                            carbs_target = ?,
                            fat_target = ?

                        WHERE id = ?
                          AND role = 'user'
                          AND is_active = 1
                        `,
                        [
                            weightKg,

                            calculated.bmi,
                            calculated.bmr,
                            calculated.tdee,

                            calculated.dailyCalorieTarget,
                            calculated.proteinTarget,
                            calculated.carbsTarget,
                            calculated.fatTarget,

                            userId
                        ]
                    );

                } else {

                    // =================================
                    // CASE 2: WEIGHT HAS NOT CHANGED
                    //
                    // The UPDATE trigger would not add
                    // a record, so insert one directly.
                    // =================================

                    await connection.query(
                        `
                        INSERT INTO weight_history
                            (
                                user_id,
                                weight_kg,
                                recorded_at
                            )

                        VALUES (
                            ?,
                            ?,
                            UTC_TIMESTAMP() + INTERVAL 8 HOUR
                        )
                        `,
                        [
                            userId,
                            weightKg
                        ]
                    );
                }

                // =====================================
                // LOAD THE SAVED WEIGHT RECORD
                // =====================================

                const [latest] =
                    await connection.query(
                        `
                        SELECT
                            id,
                            weight_kg,

                            DATE_FORMAT(
                                recorded_at,
                                '%Y-%m-%d %H:%i:%s'
                            ) AS recorded_at

                        FROM weight_history

                        WHERE user_id = ?

                        ORDER BY id DESC

                        LIMIT 1
                        `,
                        [userId]
                    );

                if (
                    latest.length === 0 ||
                    Number(latest[0].weight_kg) !==
                        weightKg
                ) {

                    throw new Error(
                        'Weight history record was not created.'
                    );
                }

                // =====================================
                // COMMIT TRANSACTION
                // =====================================

                await connection.commit();

                transactionStarted = false;

                // =====================================
                // SUCCESS RESPONSE
                // =====================================

                return res.status(201).json({

                    success: true,

                    message:
                        'Weight measurement recorded successfully.',

                    measurement: {

                        id:
                            Number(latest[0].id),

                        weightKg:
                            Number(
                                latest[0].weight_kg
                            ),

                        recordedAt:
                            latest[0].recorded_at
                    }
                });

            } catch (error) {

                // =====================================
                // ROLLBACK ON ERROR
                // =====================================

                if (
                    connection &&
                    transactionStarted
                ) {

                    try {

                        await connection.rollback();

                    } catch (rollbackError) {

                        console.error(
                            'Weight record rollback:',
                            rollbackError
                        );
                    }
                }

                console.error(
                    'Record analytics weight:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        'Unable to record weight measurement.'
                });

            } finally {

                if (connection) {
                    connection.release();
                }
            }
        }
    );


    return router;
}

// =====================================================
// EXPORT
// =====================================================

module.exports = createAnalyticsReportRouter;
