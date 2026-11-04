const express =
    require('express');


// ======================================================
// SYSTEM ROUTES
// ======================================================

function createSystemRouter() {

    const router =
        express.Router();


    // ==================================================
    // HEALTH CHECK
    // ==================================================

    router.get(
        '/health',

        (
            req,
            res
        ) => {

            return res.json({
                status: 'ok',

                service:
                    'WellSmartBook Backend',

                features: {
                    authentication: true,
                    profileEditing: true,
                    profilePicture: true,
                    passwordChange: true,
                    personalizedTargets: true,
                    ingredientScanner: true,
                    mealClassifier: true,
                    nutrition: true,
                    mealLogging: true,
                    savedRecipes: true,
                    personalizedRecommendations: true,
                    personalizedFullRecipe: true
                }
            });
        }
    );


    return router;
}


// ======================================================
// EXPORT
// ======================================================

module.exports =
    createSystemRouter;