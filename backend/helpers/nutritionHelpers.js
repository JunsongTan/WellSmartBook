// ======================================================
// NUTRITION HELPERS
// ======================================================


// ======================================================
// NORMALIZE FOOD KEY
//
// Example:
//
// "Nasi Lemak"
//      ↓
// "nasi_lemak"
//
// "Chicken-Rice"
//      ↓
// "chicken_rice"
// ======================================================

function normalizeFoodKey(
    foodKey
) {

    return String(
        foodKey || ''
    )
        .trim()
        .toLowerCase()
        .replace(
            /[\s-]+/g,
            '_'
        )
        .replace(
            /[^a-z0-9_]/g,
            ''
        );
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    normalizeFoodKey

};