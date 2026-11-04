const express =
    require('express');

const {
    roundOne,
    safeParseJson
} =
    require('../helpers/generalHelpers');

const {
    getGeminiClient,
    isTransientGeminiError,

    detailCache,
    recommendationCache,

    RECOMMENDATION_CACHE_DURATION,

    getCachedValue,
    setCachedValue
} =
    require('../helpers/geminiHelpers');

const {
    getCurrentMealPeriod,
    calculateRecommendedMealBudget,
    generatePersonalizedRecommendations,
    generatePersonalizedFullRecipe
} =
    require('../helpers/recipeHelpers');

const {
    generateMealImage
} =
    require('../helpers/recipeImageHelpers');


// ======================================================
// PERSONALIZED RECIPE ROUTES
// ======================================================

function createPersonalizedRecipeRouter({
    db,
    authenticateToken
}) {

    const router =
        express.Router();


    // ======================================================
    // RECOMMEND RECIPES
    // ======================================================

    router.post(
        '/recommend-recipes',

        authenticateToken,

        (
            req,
            res
        ) => {

            db.query(
                `
                SELECT
                    primary_goal,
                    dietary_preference,
                    allergies,
                    meals_per_day,
                    cooking_time_preference,
                    daily_calorie_target,
                    protein_target,
                    carbs_target,
                    fat_target
                FROM users
                WHERE id = ?
                LIMIT 1
                `,
                [
                    req.user.id
                ],

                (
                    userError,
                    users
                ) => {

                    if (
                        userError ||
                        !users.length
                    ) {
                        return res
                            .status(500)
                            .json({
                                message:
                                    'Unable to load user profile.'
                            });
                    }


                    const user =
                        users[0];


                    db.query(
                        `
                        SELECT
                            COALESCE(
                                SUM(calories),
                                0
                            ) AS calories_consumed,

                            COALESCE(
                                SUM(protein_grams),
                                0
                            ) AS protein_consumed,

                            COALESCE(
                                SUM(carbs_grams),
                                0
                            ) AS carbs_consumed,

                            COALESCE(
                                SUM(fat_grams),
                                0
                            ) AS fat_consumed

                        FROM meal_logs
                        WHERE user_id = ?
                        AND DATE(logged_at) = CURDATE()
                        `,
                        [
                            req.user.id
                        ],

                        async (
                            error,
                            consumptionRows
                        ) => {

                            if (error) {
                                return res
                                    .status(500)
                                    .json({
                                        message:
                                            'Unable to calculate remaining nutrition.'
                                    });
                            }


                            try {

                                const consumed =
                                    consumptionRows[0];


                                const dailyCalorieTarget =
                                    Number(
                                        user.daily_calorie_target ||
                                        0
                                    );


                                const proteinTarget =
                                    Number(
                                        user.protein_target ||
                                        0
                                    );


                                const carbsTarget =
                                    Number(
                                        user.carbs_target ||
                                        0
                                    );


                                const fatTarget =
                                    Number(
                                        user.fat_target ||
                                        0
                                    );


                                const caloriesConsumed =
                                    Number(
                                        consumed.calories_consumed ||
                                        0
                                    );


                                const proteinConsumed =
                                    Number(
                                        consumed.protein_consumed ||
                                        0
                                    );


                                const carbsConsumed =
                                    Number(
                                        consumed.carbs_consumed ||
                                        0
                                    );


                                const fatConsumed =
                                    Number(
                                        consumed.fat_consumed ||
                                        0
                                    );


                                const mealPeriod =
                                    getCurrentMealPeriod();


                                const context = {
                                    primaryGoal:
                                        user.primary_goal,

                                    dietaryPreference:
                                        user.dietary_preference,

                                    allergies:
                                        safeParseJson(
                                            user.allergies,
                                            []
                                        ),

                                    mealsPerDay:
                                        user.meals_per_day,

                                    cookingTimePreference:
                                        user.cooking_time_preference,

                                    dailyCalorieTarget,
                                    proteinTarget,
                                    carbsTarget,
                                    fatTarget,

                                    caloriesConsumed,
                                    proteinConsumed,
                                    carbsConsumed,
                                    fatConsumed,

                                    caloriesRemaining:
                                        Math.max(
                                            0,
                                            dailyCalorieTarget -
                                            caloriesConsumed
                                        ),

                                    proteinRemaining:
                                        Math.max(
                                            0,
                                            proteinTarget -
                                            proteinConsumed
                                        ),

                                    carbsRemaining:
                                        Math.max(
                                            0,
                                            carbsTarget -
                                            carbsConsumed
                                        ),

                                    fatRemaining:
                                        Math.max(
                                            0,
                                            fatTarget -
                                            fatConsumed
                                        ),

                                    mealPeriod
                                };


                                const budget =
                                    calculateRecommendedMealBudget({
                                        remainingCalories:
                                            context.caloriesRemaining,

                                        dailyTarget:
                                            context.dailyCalorieTarget,

                                        mealPeriod,

                                        primaryGoal:
                                            context.primaryGoal
                                    });


                                context.minCalories =
                                    budget.minCalories;

                                context.maxCalories =
                                    budget.maxCalories;


                                const key =
                                    JSON.stringify({
                                        userId:
                                            req.user.id,

                                        ...context
                                    });


                                const cached =
                                    getCachedValue(
                                        recommendationCache,
                                        key,
                                        RECOMMENDATION_CACHE_DURATION
                                    );


                                const publicContext = {
                                    mealPeriod,
                                    primaryGoal:
                                        context.primaryGoal,

                                    caloriesRemaining:
                                        roundOne(
                                            context.caloriesRemaining
                                        ),

                                    proteinRemaining:
                                        roundOne(
                                            context.proteinRemaining
                                        ),

                                    carbsRemaining:
                                        roundOne(
                                            context.carbsRemaining
                                        ),

                                    fatRemaining:
                                        roundOne(
                                            context.fatRemaining
                                        ),

                                    recommendedCalories: {
                                        min:
                                            budget.minCalories,

                                        max:
                                            budget.maxCalories
                                    }
                                };


                                if (cached) {
                                    return res.json({
                                        success: true,
                                        cached: true,
                                        context:
                                            publicContext,
                                        recipes:
                                            cached
                                    });
                                }


                                const ai =
                                    await getGeminiClient();


                                const recipes =
                                    await generatePersonalizedRecommendations(
                                        ai,
                                        context
                                    );


                                setCachedValue(
                                    recommendationCache,
                                    key,
                                    recipes
                                );


                                return res.json({
                                    success: true,
                                    cached: false,
                                    context:
                                        publicContext,
                                    recipes
                                });

                            } catch (generationError) {

                                return res
                                    .status(
                                        isTransientGeminiError(
                                            generationError
                                        )
                                            ? 503
                                            : 500
                                    )
                                    .json({
                                        message:
                                            isTransientGeminiError(
                                                generationError
                                            )
                                                ? 'Gemini recommendation service is temporarily unavailable or your quota has been reached.'
                                                : 'Unable to generate recommendations.'
                                    });
                            }
                        }
                    );
                }
            );
        }
    );
    // ======================================================
    // FULL PERSONALIZED RECIPE
    // ======================================================

    router.post(
        '/generate-personalized-recipe-detail',

        authenticateToken,

        (
            req,
            res
        ) => {

            const selectedOption =
                req.body.selectedOption;


            if (
                !selectedOption?.title
            ) {
                return res
                    .status(400)
                    .json({
                        message:
                            'Please select a recipe.'
                    });
            }


            db.query(
                `
                SELECT
                    u.primary_goal,
                    u.dietary_preference,
                    u.allergies,
                    u.cooking_time_preference,
                    u.daily_calorie_target,
                    u.protein_target,
                    u.carbs_target,
                    u.fat_target,

                    COALESCE(
                        SUM(m.calories),
                        0
                    ) AS calories_consumed,

                    COALESCE(
                        SUM(m.protein_grams),
                        0
                    ) AS protein_consumed,

                    COALESCE(
                        SUM(m.carbs_grams),
                        0
                    ) AS carbs_consumed,

                    COALESCE(
                        SUM(m.fat_grams),
                        0
                    ) AS fat_consumed

                FROM users u

                LEFT JOIN meal_logs m
                    ON m.user_id = u.id
                AND DATE(m.logged_at) = CURDATE()

                WHERE u.id = ?

                GROUP BY
                    u.id,
                    u.primary_goal,
                    u.dietary_preference,
                    u.allergies,
                    u.cooking_time_preference,
                    u.daily_calorie_target,
                    u.protein_target,
                    u.carbs_target,
                    u.fat_target

                LIMIT 1
                `,
                [
                    req.user.id
                ],

                async (
                    error,
                    rows
                ) => {

                    if (
                        error ||
                        !rows.length
                    ) {
                        return res
                            .status(500)
                            .json({
                                message:
                                    'Unable to load current nutrition profile.'
                            });
                    }


                    try {

                        const row =
                            rows[0];


                        const context = {
                            primaryGoal:
                                row.primary_goal,

                            dietaryPreference:
                                row.dietary_preference,

                            allergies:
                                safeParseJson(
                                    row.allergies,
                                    []
                                ),

                            cookingTimePreference:
                                row.cooking_time_preference,

                            caloriesRemaining:
                                Math.max(
                                    0,

                                    Number(
                                        row.daily_calorie_target ||
                                        0
                                    ) -
                                    Number(
                                        row.calories_consumed ||
                                        0
                                    )
                                ),

                            proteinRemaining:
                                Math.max(
                                    0,

                                    Number(
                                        row.protein_target ||
                                        0
                                    ) -
                                    Number(
                                        row.protein_consumed ||
                                        0
                                    )
                                ),

                            carbsRemaining:
                                Math.max(
                                    0,

                                    Number(
                                        row.carbs_target ||
                                        0
                                    ) -
                                    Number(
                                        row.carbs_consumed ||
                                        0
                                    )
                                ),

                            fatRemaining:
                                Math.max(
                                    0,

                                    Number(
                                        row.fat_target ||
                                        0
                                    ) -
                                    Number(
                                        row.fat_consumed ||
                                        0
                                    )
                                )
                        };


                        const key =
                            JSON.stringify({
                                type:
                                    'personalized-detail',

                                userId:
                                    req.user.id,

                                title:
                                    selectedOption
                                        .title
                                        .toLowerCase(),

                                caloriesRemaining:
                                    roundOne(
                                        context.caloriesRemaining
                                    ),

                                dietaryPreference:
                                    context.dietaryPreference,

                                allergies:
                                    context.allergies
                            });


                        const cached =
                            getCachedValue(
                                detailCache,
                                key
                            );


                        if (cached) {
                            return res.json({
                                success: true,
                                cached: true,
                                recipe:
                                    cached
                            });
                        }


                        const ai =
                            await getGeminiClient();


                        const [
                            recipeResult,
                            imageResult
                        ] =
                            await Promise.allSettled([
                                generatePersonalizedFullRecipe(
                                    ai,
                                    selectedOption,
                                    context
                                ),

                                generateMealImage(
                                    ai,
                                    selectedOption
                                )
                            ]);


                        if (
                            recipeResult.status !==
                            'fulfilled'
                        ) {
                            throw recipeResult.reason;
                        }


                        const recipe =
                            recipeResult.value;


                        if (
                            recipe.isSafeToCook !==
                            true
                        ) {
                            return res
                                .status(400)
                                .json({
                                    message:
                                        recipe.safetyNote ||
                                        'Recipe conflicts with dietary requirements.'
                                });
                        }


                        const completed = {
                            ...recipe,

                            imageUrl:
                                imageResult.status ===
                                'fulfilled'
                                    ? imageResult.value
                                    : null,

                            personalization: {
                                source:
                                    'daily_recommendation',

                                primaryGoal:
                                    context.primaryGoal,

                                matchReason:
                                    selectedOption.matchReason ||
                                    '',

                                originalRecommendation: {
                                    calories:
                                        Number(
                                            selectedOption.estimatedCalories ||
                                            0
                                        ),

                                    protein:
                                        Number(
                                            selectedOption.estimatedProteinGrams ||
                                            0
                                        ),

                                    carbs:
                                        Number(
                                            selectedOption.estimatedCarbsGrams ||
                                            0
                                        ),

                                    fat:
                                        Number(
                                            selectedOption.estimatedFatGrams ||
                                            0
                                        )
                                },

                                remainingWhenGenerated: {
                                    calories:
                                        roundOne(
                                            context.caloriesRemaining
                                        ),

                                    protein:
                                        roundOne(
                                            context.proteinRemaining
                                        ),

                                    carbs:
                                        roundOne(
                                            context.carbsRemaining
                                        ),

                                    fat:
                                        roundOne(
                                            context.fatRemaining
                                        )
                                }
                            }
                        };


                        setCachedValue(
                            detailCache,
                            key,
                            completed
                        );


                        return res.json({
                            success: true,
                            cached: false,
                            recipe:
                                completed
                        });

                    } catch (generationError) {

                        return res
                            .status(
                                isTransientGeminiError(
                                    generationError
                                )
                                    ? 503
                                    : 500
                            )
                            .json({
                                message:
                                    isTransientGeminiError(
                                        generationError
                                    )
                                        ? 'Gemini is temporarily unavailable or your quota has been reached.'
                                        : 'Unable to generate personalized recipe.'
                            });
                    }
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
    createPersonalizedRecipeRouter;