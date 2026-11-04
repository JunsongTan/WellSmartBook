const {
    safeParseJson
} =
    require('./generalHelpers');


// ======================================================
// SAVED RECIPE HELPERS
// ======================================================


// ======================================================
// FORMAT SAVED RECIPE
// ======================================================

function formatSavedRecipe(
    recipe
) {

    return {
        id:
            recipe.id,

        
        isFavourite:
            Number(recipe.is_favourite) === 1,


        title:
            recipe.title,

        description:
            recipe.description,

        imageUrl:
            recipe.image_url,

        servings:
            Number(
                recipe.servings ||
                1
            ),

        prepTimeMinutes:
            recipe.prep_time_minutes,

        cookTimeMinutes:
            recipe.cook_time_minutes,

        nutrition: {
            calories:
                Number(
                    recipe.calories_per_serving ||
                    0
                ),

            proteinGrams:
                Number(
                    recipe.protein_per_serving ||
                    0
                ),

            carbsGrams:
                Number(
                    recipe.carbs_per_serving ||
                    0
                ),

            fatGrams:
                Number(
                    recipe.fat_per_serving ||
                    0
                )
        },

        ingredients:
            safeParseJson(
                recipe.ingredients,
                []
            ),

        instructions:
            safeParseJson(
                recipe.instructions,
                []
            ),

        tags:
            safeParseJson(
                recipe.tags,
                []
            ),

        createdAt:
            recipe.created_at
    };
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    formatSavedRecipe

};  