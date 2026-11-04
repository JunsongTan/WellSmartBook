const {
    roundOne
} =
    require('./generalHelpers');

const {
    structuredWithFallback
} =
    require('./geminiHelpers');



// ======================================================
// RECIPE SCHEMAS
// ======================================================

const recipeOptionsSchema = {
    type: 'object',

    properties: {
        recipes: {
            type: 'array',
            minItems: 3,
            maxItems: 3,

            items: {
                type: 'object',

                properties: {
                    title: {
                        type: 'string'
                    },

                    description: {
                        type: 'string'
                    },

                    cookingStyle: {
                        type: 'string'
                    },

                    prepTimeMinutes: {
                        type: 'integer'
                    },

                    cookTimeMinutes: {
                        type: 'integer'
                    },

                    estimatedCalories: {
                        type: 'number'
                    },

                    tags: {
                        type: 'array',

                        items: {
                            type: 'string'
                        }
                    }
                },

                required: [
                    'title',
                    'description',
                    'cookingStyle',
                    'prepTimeMinutes',
                    'cookTimeMinutes',
                    'estimatedCalories',
                    'tags'
                ]
            }
        }
    },

    required: [
        'recipes'
    ]
};


const personalizedRecommendationSchema = {
    type: 'object',

    properties: {
        recipes: {
            type: 'array',
            minItems: 3,
            maxItems: 3,

            items: {
                type: 'object',

                properties: {
                    title: {
                        type: 'string'
                    },

                    description: {
                        type: 'string'
                    },

                    cookingStyle: {
                        type: 'string'
                    },

                    prepTimeMinutes: {
                        type: 'integer'
                    },

                    cookTimeMinutes: {
                        type: 'integer'
                    },

                    estimatedCalories: {
                        type: 'number'
                    },

                    estimatedProteinGrams: {
                        type: 'number'
                    },

                    estimatedCarbsGrams: {
                        type: 'number'
                    },

                    estimatedFatGrams: {
                        type: 'number'
                    },

                    matchReason: {
                        type: 'string'
                    },

                    tags: {
                        type: 'array',

                        items: {
                            type: 'string'
                        }
                    }
                },

                required: [
                    'title',
                    'description',
                    'cookingStyle',
                    'prepTimeMinutes',
                    'cookTimeMinutes',
                    'estimatedCalories',
                    'estimatedProteinGrams',
                    'estimatedCarbsGrams',
                    'estimatedFatGrams',
                    'matchReason',
                    'tags'
                ]
            }
        }
    },

    required: [
        'recipes'
    ]
};


const fullRecipeSchema = {
    type: 'object',

    properties: {
        isSafeToCook: {
            type: 'boolean'
        },

        safetyNote: {
            type: 'string'
        },

        title: {
            type: 'string'
        },

        description: {
            type: 'string'
        },

        servings: {
            type: 'integer'
        },

        prepTimeMinutes: {
            type: 'integer'
        },

        cookTimeMinutes: {
            type: 'integer'
        },

        ingredients: {
            type: 'array',

            items: {
                type: 'object',

                properties: {
                    name: {
                        type: 'string'
                    },

                    amount: {
                        type: 'string'
                    },

                    source: {
                        type: 'string',

                        enum: [
                            'user',
                            'pantry',
                            'recommended'
                        ]
                    }
                },

                required: [
                    'name',
                    'amount',
                    'source'
                ]
            }
        },

        instructions: {
            type: 'array',

            items: {
                type: 'object',

                properties: {
                    stepNumber: {
                        type: 'integer'
                    },

                    title: {
                        type: 'string'
                    },

                    instruction: {
                        type: 'string'
                    }
                },

                required: [
                    'stepNumber',
                    'title',
                    'instruction'
                ]
            }
        },

        nutrition: {
            type: 'object',

            properties: {
                calories: {
                    type: 'number'
                },

                proteinGrams: {
                    type: 'number'
                },

                carbsGrams: {
                    type: 'number'
                },

                fatGrams: {
                    type: 'number'
                }
            },

            required: [
                'calories',
                'proteinGrams',
                'carbsGrams',
                'fatGrams'
            ]
        },

        tags: {
            type: 'array',

            items: {
                type: 'string'
            }
        }
    },

    required: [
        'isSafeToCook',
        'safetyNote',
        'title',
        'description',
        'servings',
        'prepTimeMinutes',
        'cookTimeMinutes',
        'ingredients',
        'instructions',
        'nutrition',
        'tags'
    ]
};



// ======================================================
// RECIPE GENERATION
// ======================================================

async function generateRecipeOptions(
    ai,
    ingredients
) {

    const prompt = `
You are the recipe recommendation engine for WellSmartBook.

USER INGREDIENTS:
${JSON.stringify(ingredients)}

Generate EXACTLY THREE meaningfully different recipe ideas.

Do not provide complete quantities or instructions yet.

Return:
- title
- description
- cookingStyle
- prepTimeMinutes
- cookTimeMinutes
- estimatedCalories per serving
- tags

Use the user's foods as the main ingredients.
Pantry staples may be assumed.
Do not invent another major protein, fruit or vegetable.
Nutrition is approximate.
Do not make medical claims.
`;


    const outputText =
        await structuredWithFallback({
            ai,

            primaryModel:
                process.env
                    .GEMINI_OPTIONS_MODEL ||
                'gemini-3.5-flash-lite',

            fallbackModel:
                process.env
                    .GEMINI_OPTIONS_FALLBACK ||
                'gemini-3.8-flash',

            prompt,

            schema:
                recipeOptionsSchema
        });


    const data =
        JSON.parse(
            outputText
        );


    return (
        data.recipes ||
        []
    ).slice(
        0,
        3
    );
}


async function generateFullRecipe(
    ai,
    ingredients,
    selectedOption
) {

    const prompt = `
You are the detailed cooking engine for WellSmartBook.

USER INGREDIENTS:
${JSON.stringify(ingredients)}

SELECTED RECIPE:
${JSON.stringify(selectedOption)}

Generate the complete recipe.

Keep the same concept.
Use user ingredients as major foods.
For user ingredients use source="user".
For basic added staples use source="pantry".
Give realistic quantities and numbered instructions.
Nutrition is an estimate per serving.
Do not make medical claims.

If unsafe, isSafeToCook=false.
Otherwise isSafeToCook=true.
`;


    const outputText =
        await structuredWithFallback({
            ai,

            primaryModel:
                process.env
                    .GEMINI_DETAIL_MODEL ||
                'gemini-3.8-flash',

            fallbackModel:
                process.env
                    .GEMINI_DETAIL_FALLBACK ||
                'gemini-3.5-flash-lite',

            prompt,

            schema:
                fullRecipeSchema,

            // Flash-Lite uses its faster minimal-thinking default.
            primaryLowThinking:
                false,

            // If fallback to Flash is needed, use low thinking.
            fallbackLowThinking:
                true
        });


    return JSON.parse(
        outputText
    );
}


// ======================================================
// PERSONALIZED RECOMMENDATION LOGIC
// ======================================================

function getCurrentMealPeriod() {

    const hour =
        new Date()
            .getHours();


    if (
        hour >= 5 &&
        hour < 11
    ) {
        return 'breakfast';
    }


    if (
        hour >= 11 &&
        hour < 16
    ) {
        return 'lunch';
    }


    if (
        hour >= 16 &&
        hour < 22
    ) {
        return 'dinner';
    }


    return 'snack';
}


function calculateRecommendedMealBudget({
    remainingCalories,
    dailyTarget,
    mealPeriod,
    primaryGoal
}) {

    const remaining =
        Math.max(
            0,
            Number(
                remainingCalories ||
                0
            )
        );


    const target =
        Math.max(
            0,
            Number(
                dailyTarget ||
                0
            )
        );


    if (
        remaining <= 0
    ) {
        return {
            minCalories: 0,
            maxCalories: 200
        };
    }


    let recommendedCalories;


    if (
        mealPeriod ===
        'breakfast'
    ) {
        recommendedCalories =
            remaining *
            0.30;

    } else if (
        mealPeriod ===
        'lunch'
    ) {
        recommendedCalories =
            remaining *
            0.45;

    } else if (
        mealPeriod ===
        'dinner'
    ) {
        recommendedCalories =
            remaining *
            0.70;

    } else {
        recommendedCalories =
            remaining *
            0.25;
    }


    if (
        primaryGoal ===
        'Lose Weight'
    ) {
        recommendedCalories *=
            0.95;
    }


    if (
        primaryGoal ===
        'Build Muscle'
    ) {
        recommendedCalories *=
            1.05;
    }


    let minimumMeal =
        target *
        0.15;


    if (
        mealPeriod ===
        'snack'
    ) {
        minimumMeal =
            target *
            0.05;
    }


    recommendedCalories =
        Math.max(
            minimumMeal,
            recommendedCalories
        );


    recommendedCalories =
        Math.min(
            remaining,
            recommendedCalories
        );


    let minCalories =
        recommendedCalories *
        0.80;


    let maxCalories =
        recommendedCalories *
        1.20;


    maxCalories =
        Math.min(
            remaining,
            maxCalories
        );


    minCalories =
        Math.min(
            minCalories,
            maxCalories
        );


    return {
        minCalories:
            roundOne(
                Math.max(
                    0,
                    minCalories
                )
            ),

        maxCalories:
            roundOne(
                Math.max(
                    0,
                    maxCalories
                )
            )
    };
}


async function generatePersonalizedRecommendations(
    ai,
    context
) {

    const prompt = `
You are WellSmartBook's personalized recipe recommendation engine.

WellSmartBook already calculated the user's calorie and macro targets.
DO NOT recalculate BMR, TDEE or daily calorie requirements.

Goal:
${context.primaryGoal}

Dietary preference:
${context.dietaryPreference || 'No Preference'}

Allergies:
${JSON.stringify(context.allergies || [])}

Cooking preference:
${context.cookingTimePreference || 'No Preference'}

Daily target:
${context.dailyCalorieTarget} kcal
Protein ${context.proteinTarget} g
Carbs ${context.carbsTarget} g
Fat ${context.fatTarget} g

Consumed:
${context.caloriesConsumed} kcal
Protein ${context.proteinConsumed} g
Carbs ${context.carbsConsumed} g
Fat ${context.fatConsumed} g

Remaining:
${context.caloriesRemaining} kcal
Protein ${context.proteinRemaining} g
Carbs ${context.carbsRemaining} g
Fat ${context.fatRemaining} g

Current meal:
${context.mealPeriod}

Recommended meal calorie range:
${context.minCalories}-${context.maxCalories} kcal.

Generate EXACTLY THREE recipes.

Respect dietary preference and strictly avoid allergies.
Prefer meals practical in Malaysia.
Do not intentionally exceed remaining calories.
Prioritize protein when proteinRemaining is high.
Nutrition is estimated per serving.
Return a short matchReason explaining why the recipe fits today.
Do not make medical claims.
`;


    const outputText =
        await structuredWithFallback({
            ai,

            primaryModel:
                process.env
                    .GEMINI_OPTIONS_MODEL ||
                'gemini-3.5-flash-lite',

            fallbackModel:
                process.env
                    .GEMINI_OPTIONS_FALLBACK ||
                'gemini-3.8-flash',

            prompt,

            schema:
                personalizedRecommendationSchema
        });


    const data =
        JSON.parse(
            outputText
        );


    return (
        data.recipes ||
        []
    ).slice(
        0,
        3
    );
}


async function generatePersonalizedFullRecipe(
    ai,
    selectedOption,
    context
) {

    const prompt = `
You are WellSmartBook's detailed personalized cooking engine.

SELECTED RECIPE:
${JSON.stringify(selectedOption, null, 2)}

USER PROFILE:
Goal: ${context.primaryGoal}
Diet: ${context.dietaryPreference || 'No Preference'}
Allergies: ${JSON.stringify(context.allergies || [])}
Cooking time preference: ${context.cookingTimePreference || 'No Preference'}

CURRENT REMAINING:
Calories: ${context.caloriesRemaining} kcal
Protein: ${context.proteinRemaining} g
Carbs: ${context.carbsRemaining} g
Fat: ${context.fatRemaining} g

Turn the selected option into a complete practical recipe.

Keep the same title and concept.
Strictly respect diet and allergies.
Prefer ingredients easy to obtain in Malaysia.
Major ingredients use source="recommended".
Basic staples use source="pantry".
Give realistic quantities.
Give clear numbered instructions.
Nutrition is estimated PER SERVING.
Try to remain near the originally recommended nutrition.
Do not intentionally exceed current remaining calories.
Do not make medical claims.

If the recipe conflicts with dietary/allergy requirements:
isSafeToCook=false.
Otherwise isSafeToCook=true.
`;


    const outputText =
        await structuredWithFallback({
            ai,

            primaryModel:
                process.env
                    .GEMINI_DETAIL_MODEL ||
                'gemini-3.8-flash',

            fallbackModel:
                process.env
                    .GEMINI_DETAIL_FALLBACK ||
                'gemini-3.5-flash-lite',

            prompt,

            schema:
                fullRecipeSchema,

            // Flash-Lite uses its faster minimal-thinking default.
            primaryLowThinking:
                false,

            // If fallback to Flash is needed, use low thinking.
            fallbackLowThinking:
                true
        });


    return JSON.parse(
        outputText
    );
}

// ======================================================
// EXPORT
// ======================================================

module.exports = {

    generateRecipeOptions,

    generateFullRecipe,

    getCurrentMealPeriod,

    calculateRecommendedMealBudget,

    generatePersonalizedRecommendations,

    generatePersonalizedFullRecipe

};