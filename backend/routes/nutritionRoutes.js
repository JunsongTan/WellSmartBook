const express =
    require('express');

const {
    roundOne
} =
    require('../helpers/generalHelpers');

const {
    normalizeFoodKey
} =
    require('../helpers/nutritionHelpers');


// ======================================================
// NUTRITION ROUTES
// ======================================================

function createNutritionRouter({
    db,
    authenticateToken
}) {

    const router =
        express.Router();


    // ==================================================
    // NUTRITION LIST
    // ==================================================

    router.get(
        '/nutrition-foods',

        authenticateToken,

        (
            req,
            res
        ) => {

            db.query(
                `
                SELECT
                    food_key,
                    display_name,
                    calories_per_100g,
                    protein_per_100g,
                    carbs_per_100g,
                    fat_per_100g,
                    default_portion_g,
                    serving_description,
                    source_name
                FROM food_nutrition_reference
                WHERE is_active = 1
                ORDER BY display_name ASC
                `,

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
                                    'Unable to retrieve foods.'
                            });
                    }


                    return res.json({
                        success:
                            true,

                        foods:
                            results.map(
                                (
                                    food
                                ) => ({

                                    foodKey:
                                        food.food_key,

                                    displayName:
                                        food.display_name,

                                    per100g: {

                                        calories:
                                            Number(
                                                food.calories_per_100g
                                            ),

                                        protein:
                                            Number(
                                                food.protein_per_100g
                                            ),

                                        carbs:
                                            Number(
                                                food.carbs_per_100g
                                            ),

                                        fat:
                                            Number(
                                                food.fat_per_100g
                                            )
                                    },

                                    defaultPortionGrams:
                                        Number(
                                            food.default_portion_g
                                        ),

                                    servingDescription:
                                        food.serving_description,

                                    source:
                                        food.source_name
                                })
                            )
                    });
                }
            );
        }
    );


    // ==================================================
    // ONE NUTRITION FOOD
    // ==================================================

    router.get(
        '/nutrition/:foodKey',

        authenticateToken,

        (
            req,
            res
        ) => {

            const foodKey =
                normalizeFoodKey(
                    req.params.foodKey
                );


            db.query(
                `
                SELECT *
                FROM food_nutrition_reference
                WHERE food_key = ?
                  AND is_active = 1
                LIMIT 1
                `,
                [
                    foodKey
                ],

                (
                    error,
                    results
                ) => {

                    if (
                        error ||
                        !results.length
                    ) {

                        return res
                            .status(
                                error
                                    ? 500
                                    : 404
                            )
                            .json({
                                message:
                                    'Nutrition information is unavailable.'
                            });
                    }


                    const food =
                        results[0];


                    return res.json({
                        success:
                            true,

                        food: {

                            foodKey:
                                food.food_key,

                            displayName:
                                food.display_name
                        },

                        per100g: {

                            calories:
                                Number(
                                    food.calories_per_100g
                                ),

                            protein:
                                Number(
                                    food.protein_per_100g
                                ),

                            carbs:
                                Number(
                                    food.carbs_per_100g
                                ),

                            fat:
                                Number(
                                    food.fat_per_100g
                                )
                        },

                        defaultPortion: {

                            grams:
                                Number(
                                    food.default_portion_g
                                ),

                            description:
                                food.serving_description
                        },

                        source:
                            food.source_name
                    });
                }
            );
        }
    );


    // ==================================================
    // CALCULATE NUTRITION
    // ==================================================

    router.post(
        '/calculate-nutrition',

        authenticateToken,

        (
            req,
            res
        ) => {

            const {
                foodKey,
                portion,
                portionGrams
            } =
                req.body;


            const normalizedFoodKey =
                normalizeFoodKey(
                    foodKey
                );


            db.query(
                `
                SELECT *
                FROM food_nutrition_reference
                WHERE food_key = ?
                  AND is_active = 1
                LIMIT 1
                `,
                [
                    normalizedFoodKey
                ],

                (
                    error,
                    results
                ) => {

                    if (
                        error ||
                        !results.length
                    ) {

                        return res
                            .status(
                                error
                                    ? 500
                                    : 404
                            )
                            .json({
                                message:
                                    'Nutrition information is unavailable.'
                            });
                    }


                    const food =
                        results[0];


                    const defaultGrams =
                        Number(
                            food.default_portion_g
                        );


                    let grams;
                    let type;


                    if (
                        portionGrams !==
                        undefined &&
                        portionGrams !==
                        null &&
                        portionGrams !==
                        ''
                    ) {

                        grams =
                            Number(
                                portionGrams
                            );

                        type =
                            'custom';

                    } else {

                        type =
                            String(
                                portion ||
                                'regular'
                            ).toLowerCase();


                        if (
                            type ===
                            'small'
                        ) {

                            grams =
                                defaultGrams *
                                0.75;

                        } else if (
                            type ===
                            'regular'
                        ) {

                            grams =
                                defaultGrams;

                        } else if (
                            type ===
                            'large'
                        ) {

                            grams =
                                defaultGrams *
                                1.25;

                        } else {

                            return res
                                .status(400)
                                .json({
                                    message:
                                        'Invalid portion.'
                                });
                        }
                    }


                    if (
                        !Number.isFinite(
                            grams
                        ) ||
                        grams <= 0 ||
                        grams > 2000
                    ) {

                        return res
                            .status(400)
                            .json({
                                message:
                                    'Portion must be between 1g and 2000g.'
                            });
                    }


                    grams =
                        Math.round(
                            grams
                        );


                    const multiplier =
                        grams /
                        100;


                    return res.json({
                        success:
                            true,

                        food: {

                            foodKey:
                                food.food_key,

                            displayName:
                                food.display_name
                        },

                        portion: {

                            type,

                            grams,

                            referenceServing:
                                food.serving_description
                        },

                        nutrition: {

                            calories:
                                roundOne(
                                    Number(
                                        food.calories_per_100g
                                    ) *
                                    multiplier
                                ),

                            protein:
                                roundOne(
                                    Number(
                                        food.protein_per_100g
                                    ) *
                                    multiplier
                                ),

                            carbs:
                                roundOne(
                                    Number(
                                        food.carbs_per_100g
                                    ) *
                                    multiplier
                                ),

                            fat:
                                roundOne(
                                    Number(
                                        food.fat_per_100g
                                    ) *
                                    multiplier
                                )
                        },

                        source:
                            food.source_name
                    });
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
    createNutritionRouter;