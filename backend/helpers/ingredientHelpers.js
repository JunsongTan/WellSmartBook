// ======================================================
// INGREDIENT HELPERS
// ======================================================


// ======================================================
// UNSAFE INGREDIENT KEYWORDS
// ======================================================

const unsafeIngredientKeywords = [

    'bleach',
    'detergent',
    'soap',
    'cleaner',
    'poison',
    'pesticide',
    'battery',
    'plastic',
    'glass',
    'gasoline',
    'petrol',
    'chemical',
    'paint',
    'glue'

];


// ======================================================
// NORMALIZE INGREDIENTS
// ======================================================

function normalizeIngredients(
    ingredients
) {

    if (
        !Array.isArray(
            ingredients
        )
    ) {

        return [];
    }


    return [
        ...new Map(
            ingredients
                .filter(
                    (ingredient) =>
                        typeof ingredient ===
                        'string'
                )
                .map(
                    (ingredient) =>
                        ingredient.trim()
                )
                .filter(
                    Boolean
                )
                .filter(
                    (ingredient) =>
                        ingredient.length <=
                        50
                )
                .map(
                    (ingredient) => [

                        ingredient
                            .toLowerCase(),

                        ingredient

                    ]
                )
        ).values()
    ].slice(
        0,
        30
    );
}


// ======================================================
// CHECK UNSAFE INGREDIENT
// ======================================================

function containsUnsafeIngredient(
    ingredients
) {

    return ingredients.some(
        (
            ingredient
        ) => {

            const value =
                ingredient
                    .toLowerCase();


            return unsafeIngredientKeywords
                .some(
                    (
                        word
                    ) =>
                        value.includes(
                            word
                        )
                );
        }
    );
}


// ======================================================
// CREATE INGREDIENT CACHE KEY
// ======================================================

function createIngredientKey(
    ingredients
) {

    return ingredients
        .map(
            (
                ingredient
            ) =>
                ingredient
                    .toLowerCase()
                    .trim()
        )
        .sort()
        .join(
            '|'
        );
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    normalizeIngredients,

    containsUnsafeIngredient,

    createIngredientKey

};