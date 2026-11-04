// ======================================================
// GENERAL HELPERS
// ======================================================


// ======================================================
// ROUND NUMBER TO 1 DECIMAL PLACE
// ======================================================

function roundOne(
    value
) {

    return (
        Math.round(
            Number(
                value || 0
            ) *
            10
        ) /
        10
    );
}


// ======================================================
// SAFE JSON PARSE
// ======================================================

function safeParseJson(
    value,
    fallback = []
) {

    if (
        value === null ||
        value === undefined
    ) {

        return fallback;
    }


    if (
        typeof value ===
        'object'
    ) {

        return value;
    }


    try {

        return JSON.parse(
            value
        );

    } catch {

        return fallback;
    }
}


// ======================================================
// NORMALIZE DATE ONLY
// ======================================================

function normalizeDateOnly(
    value
) {

    if (!value) {

        return null;
    }


    if (
        value instanceof Date
    ) {

        return value
            .toISOString()
            .slice(
                0,
                10
            );
    }


    return String(
        value
    ).slice(
        0,
        10
    );
}


// ======================================================
// CALCULATE AGE
// ======================================================

function calculateAge(
    dateOfBirth
) {

    const dateOnly =
        normalizeDateOnly(
            dateOfBirth
        );


    if (!dateOnly) {

        return null;
    }


    const birthDate =
        new Date(
            `${dateOnly}T00:00:00`
        );


    if (
        Number.isNaN(
            birthDate.getTime()
        )
    ) {

        return null;
    }


    const today =
        new Date();


    let age =
        today.getFullYear() -
        birthDate.getFullYear();


    const monthDifference =
        today.getMonth() -
        birthDate.getMonth();


    if (
        monthDifference < 0 ||
        (
            monthDifference === 0 &&
            today.getDate() <
            birthDate.getDate()
        )
    ) {

        age -= 1;
    }


    return age;
}


// ======================================================
// NORMALIZE ALLERGIES
// ======================================================

function normalizeAllergies(
    allergies
) {

    if (
        !Array.isArray(
            allergies
        )
    ) {

        return [];
    }


    return [
        ...new Set(
            allergies
                .filter(
                    (item) =>
                        typeof item ===
                        'string'
                )
                .map(
                    (item) =>
                        item.trim()
                )
                .filter(
                    Boolean
                )
        )
    ].slice(
        0,
        20
    );
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    roundOne,

    safeParseJson,

    normalizeDateOnly,

    calculateAge,

    normalizeAllergies

};