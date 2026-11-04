const express =
    require('express');

const {
    normalizeFoodKey
} =
    require('../helpers/nutritionHelpers');

const {
    sendImageToVisionService
} =
    require('../helpers/visionHelpers');

const {
    upload
} =
    require('../helpers/uploadHelpers');


// ======================================================
// VISION / SCANNER ROUTES
// ======================================================

function createVisionRouter({
    db,
    authenticateToken
}) {

    const router =
        express.Router();


    // ==================================================
    // RAW INGREDIENT / FOOD SCANNER
    // ==================================================

    router.post(
        '/scan-food',

        upload.single(
            'image'
        ),

        async (
            req,
            res
        ) => {

            if (
                !req.file
            ) {

                return res
                    .status(400)
                    .json({
                        message:
                            'No image uploaded.'
                    });
            }


            try {

                const result =
                    await sendImageToVisionService(
                        req.file,
                        '/api/scan'
                    );


                return res.json(
                    result
                );

            } catch (
                error
            ) {

                console.error(
                    error.message
                );


                return res
                    .status(500)
                    .json({
                        message:
                            'Unable to communicate with AI Vision service.'
                    });
            }
        }
    );


    // ==================================================
    // CLASSIFY MEAL
    // ==================================================

    router.post(
        '/classify-meal',

        authenticateToken,

        upload.single(
            'image'
        ),

        async (
            req,
            res
        ) => {

            if (
                !req.file
            ) {

                return res
                    .status(400)
                    .json({
                        message:
                            'No meal image uploaded.'
                    });
            }


            try {

                return res.json(
                    await sendImageToVisionService(
                        req.file,
                        '/api/classify-meal'
                    )
                );

            } catch (
                error
            ) {

                return res
                    .status(500)
                    .json({
                        message:
                            'Unable to communicate with Malaysian food recognition service.'
                    });
            }
        }
    );


    // ==================================================
    // ANALYZE MEAL
    // ==================================================

    router.post(
        '/analyze-meal',

        authenticateToken,

        upload.single(
            'image'
        ),

        async (
            req,
            res
        ) => {

            if (
                !req.file
            ) {

                return res
                    .status(400)
                    .json({
                        message:
                            'No meal image uploaded.'
                    });
            }


            try {

                const classification =
                    await sendImageToVisionService(
                        req.file,
                        '/api/classify-meal'
                    );


                if (
                    !classification.success ||
                    !classification.prediction
                ) {

                    return res
                        .status(400)
                        .json({
                            message:
                                'Meal could not be identified.'
                        });
                }


                const foodKey =
                    normalizeFoodKey(
                        classification
                            .prediction
                            .item
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
                            error
                        ) {

                            return res
                                .status(500)
                                .json({
                                    message:
                                        'Nutrition lookup failed.'
                                });
                        }


                        if (
                            !results.length
                        ) {

                            return res.json({
                                success:
                                    true,

                                classification,

                                nutritionAvailable:
                                    false
                            });
                        }


                        const food =
                            results[0];


                        return res.json({
                            success:
                                true,

                            classification,

                            nutritionAvailable:
                                true,

                            nutritionReference: {

                                foodKey:
                                    food.food_key,

                                displayName:
                                    food.display_name,

                                defaultPortionGrams:
                                    Number(
                                        food.default_portion_g
                                    ),

                                servingDescription:
                                    food.serving_description,

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

                                source:
                                    food.source_name
                            }
                        });
                    }
                );

            } catch (
                error
            ) {

                return res
                    .status(500)
                    .json({
                        message:
                            'Meal analysis failed. Make sure Python AI service is running.'
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
    createVisionRouter;