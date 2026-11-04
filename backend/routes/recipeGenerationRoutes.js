const express =
    require('express');

const {
    normalizeIngredients,
    containsUnsafeIngredient,
    createIngredientKey
} =
    require('../helpers/ingredientHelpers');

const {
    getGeminiClient,
    getErrorText,
    isTransientGeminiError,

    optionsCache,
    detailCache,

    getCachedValue,
    setCachedValue
} =
    require('../helpers/geminiHelpers');

const {
    generateRecipeOptions,
    generateFullRecipe
} =
    require('../helpers/recipeHelpers');

const {
    generateMealImage
} =
    require('../helpers/recipeImageHelpers');


// ======================================================
// RECIPE GENERATION ROUTES
// ======================================================

function createRecipeGenerationRouter({
    authenticateToken
}) {

    const router =
        express.Router();


    // ==================================================
    // RAW RECIPE OPTIONS
    // ==================================================

    router.post(
        '/generate-recipe-options',

        authenticateToken,

        async (
            req,
            res
        ) => {

            try {

                const ingredients =
                    normalizeIngredients(
                        req.body.ingredients
                    );


                if (
                    ingredients.length ===
                    0
                ) {

                    return res
                        .status(400)
                        .json({
                            message:
                                'Please provide at least one ingredient.'
                        });
                }


                if (
                    containsUnsafeIngredient(
                        ingredients
                    )
                ) {

                    return res
                        .status(400)
                        .json({
                            message:
                                'One or more ingredients appear unsafe.'
                        });
                }


                const cacheKey =
                    createIngredientKey(
                        ingredients
                    );


                const cached =
                    getCachedValue(
                        optionsCache,
                        cacheKey
                    );


                if (cached) {

                    return res.json({
                        success: true,
                        cached: true,
                        recipes:
                            cached
                    });
                }


                const ai =
                    await getGeminiClient();


                const recipes =
                    await generateRecipeOptions(
                        ai,
                        ingredients
                    );


                setCachedValue(
                    optionsCache,
                    cacheKey,
                    recipes
                );


                return res.json({
                    success: true,
                    cached: false,
                    recipes
                });

            } catch (
                error
            ) {

                console.error(
                    'Recipe options:',
                    getErrorText(
                        error
                    )
                );


                return res
                    .status(
                        isTransientGeminiError(
                            error
                        )
                            ? 503
                            : 500
                    )
                    .json({
                        message:
                            isTransientGeminiError(
                                error
                            )
                                ? 'Gemini is temporarily unavailable or your quota has been reached.'
                                : 'Unable to generate recipes.'
                    });
            }
        }
    );


    // ==================================================
    // FULL INGREDIENT RECIPE
    // ==================================================

    router.post(
        '/generate-recipe-detail',

        authenticateToken,

        async (
            req,
            res
        ) => {

            try {

                const ingredients =
                    normalizeIngredients(
                        req.body.ingredients
                    );


                const selectedOption =
                    req.body.selectedOption;


                if (
                    !ingredients.length ||
                    !selectedOption?.title
                ) {

                    return res
                        .status(400)
                        .json({
                            message:
                                'Ingredients and selected recipe are required.'
                        });
                }


                const key =
                    `${req.user.id}:${createIngredientKey(
                        ingredients
                    )}:${selectedOption.title.toLowerCase()}`;


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


                
                // ======================================================
                // FASTER RECIPE GENERATION
                // ======================================================

                const startedAt = Date.now();

                const ai = await getGeminiClient();

                // Image generation is disabled by default.
                // Enable only when your Gemini API tier supports it.

                const generateImages =
                    process.env.ENABLE_GEMINI_RECIPE_IMAGES === 'true';

                // ======================================================
                // GENERATE RECIPE TEXT
                // ======================================================

                const textStartedAt = Date.now();

                const recipeTask = generateFullRecipe(
                    ai,
                    ingredients,
                    selectedOption
                ).then(recipe => {

                    console.log(
                        '[Recipe] Text generation:',
                        `${(
                            (Date.now() - textStartedAt) / 1000
                        ).toFixed(1)}s`
                    );

                    return recipe;
                });

                // ======================================================
                // OPTIONAL RECIPE IMAGE GENERATION
                // ======================================================

                const imageStartedAt = Date.now();

                const imageTask = generateImages

                    ? generateMealImage(
                        ai,
                        selectedOption
                    )

                        .then(imageUrl => {

                            console.log(
                                '[Recipe] Image generation:',
                                `${(
                                    (Date.now() - imageStartedAt) / 1000
                                ).toFixed(1)}s`
                            );

                            return imageUrl;
                        })

                        .catch(error => {

                            console.error(
                                '[Recipe] Image unavailable:',
                                getErrorText(error)
                            );

                            return null;
                        })

                    : Promise.resolve(null);

                // No Gemini image requests when disabled.

                if (!generateImages) {

                    console.log(
                        '[Recipe] Image generation skipped (disabled).'
                    );
                }

                // ======================================================
                // WAIT FOR REQUIRED RESULTS
                // ======================================================

                const [recipe, imageUrl] = await Promise.all([
                    recipeTask,
                    imageTask
                ]);

                console.log(
                    '[Recipe] Total detail request:',
                    `${(
                        (Date.now() - startedAt) / 1000
                    ).toFixed(1)}s`
                );

                // ======================================================
                // CHECK FOOD SAFETY
                // ======================================================

                if (recipe.isSafeToCook !== true) {

                    return res.status(400).json({
                        message:
                            recipe.safetyNote ||
                            'Recipe cannot safely be generated.'
                    });
                }

                // ======================================================
                // COMPLETE RECIPE
                // ======================================================

                const completed = {
                    ...recipe,
                    imageUrl
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

            } catch (
                error
            ) {

                return res
                    .status(
                        isTransientGeminiError(
                            error
                        )
                            ? 503
                            : 500
                    )
                    .json({
                        message:
                            isTransientGeminiError(
                                error
                            )
                                ? 'Gemini is temporarily unavailable or your quota has been reached.'
                                : 'Unable to generate recipe detail.'
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
    createRecipeGenerationRouter;