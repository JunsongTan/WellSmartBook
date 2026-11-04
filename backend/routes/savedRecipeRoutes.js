const express =
    require('express');


const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

// ======================================================
// RECIPE PHOTO STORAGE
// ======================================================

const RECIPE_PHOTO_DIR = path.join(
    __dirname,
    '..',
    'uploads',
    'recipe-photos'
);

fs.mkdirSync(RECIPE_PHOTO_DIR, {
    recursive: true
});

// Maximum upload size: 5 MB.
const recipePhotoUpload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
    }
}).single('image');

// Safe server-generated filenames only.
const recipePhotoNamePattern =
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp)$/i;

// ======================================================
// DETECT ACTUAL IMAGE FORMAT
// ======================================================

function identifyRecipePhoto(buffer) {

    if (
        !Buffer.isBuffer(buffer) ||
        buffer.length < 12
    ) {
        return null;
    }

    // JPEG
    if (
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
    ) {
        return {
            extension: 'jpg',
            mime: 'image/jpeg'
        };
    }

    // PNG
    if (
        buffer.subarray(0, 8).equals(
            Buffer.from([
                137, 80, 78, 71,
                13, 10, 26, 10
            ])
        )
    ) {
        return {
            extension: 'png',
            mime: 'image/png'
        };
    }

    // WebP
    if (
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
        return {
            extension: 'webp',
            mime: 'image/webp'
        };
    }

    return null;
}


const {
    formatSavedRecipe
} =
    require('../helpers/savedRecipeHelpers');


// ======================================================
// SAVED RECIPE ROUTES
// ======================================================

function createSavedRecipeRouter({
    db,
    authenticateToken
}) {

    const router =
        express.Router();


    // ==================================================
    // SAVE RECIPE
    // ==================================================

    router.post(
        '/saved-recipes',

        authenticateToken,

        (
            req,
            res
        ) => {

            const {
                title,
                description,
                imageUrl,
                servings,
                prepTimeMinutes,
                cookTimeMinutes,
                caloriesPerServing,
                proteinPerServing,
                carbsPerServing,
                fatPerServing,
                ingredients,
                instructions,
                tags
            } =
                req.body;


            if (
                !title ||
                !Array.isArray(
                    ingredients
                ) ||
                !ingredients.length ||
                !Array.isArray(
                    instructions
                ) ||
                !instructions.length
            ) {

                return res
                    .status(400)
                    .json({
                        message:
                            'Complete recipe information is required.'
                    });
            }


            db.query(
                `
                SELECT id
                FROM saved_recipes
                WHERE user_id = ?
                  AND title = ?
                LIMIT 1
                `,
                [
                    req.user.id,
                    title
                ],

                (
                    checkError,
                    existing
                ) => {

                    if (
                        checkError
                    ) {

                        return res
                            .status(500)
                            .json({
                                message:
                                    'Unable to save recipe.'
                            });
                    }


                    if (
                        existing.length
                    ) {

                        return res
                            .status(409)
                            .json({
                                message:
                                    'This recipe is already saved.',

                                recipeId:
                                    existing[0].id
                            });
                    }


                    db.query(
                        `
                        INSERT INTO saved_recipes
                        (
                            user_id,
                            title,
                            description,
                            image_url,
                            servings,
                            prep_time_minutes,
                            cook_time_minutes,
                            calories_per_serving,
                            protein_per_serving,
                            carbs_per_serving,
                            fat_per_serving,
                            ingredients,
                            instructions,
                            tags,
                            recipe_source,
                            is_favourite
                        )
                        VALUES
                        (
                            ?, ?, ?, ?, ?, ?, ?, ?,
                            ?, ?, ?, ?, ?, ?,
                            'gemini',
                            0
                        )
                        `,
                        [
                            req.user.id,
                            title,
                            description ||
                            null,

                            imageUrl ||
                            null,

                            Number(
                                servings ||
                                1
                            ),

                            prepTimeMinutes ??
                            null,

                            cookTimeMinutes ??
                            null,

                            caloriesPerServing ??
                            null,

                            proteinPerServing ??
                            null,

                            carbsPerServing ??
                            null,

                            fatPerServing ??
                            null,

                            JSON.stringify(
                                ingredients
                            ),

                            JSON.stringify(
                                instructions
                            ),

                            JSON.stringify(
                                Array.isArray(
                                    tags
                                )
                                    ? tags
                                    : []
                            )
                        ],

                        (
                            error,
                            result
                        ) => {

                            if (
                                error
                            ) {

                                console.error(
                                    error
                                );


                                return res
                                    .status(500)
                                    .json({
                                        message:
                                            'Unable to save recipe.'
                                    });
                            }


                            return res
                                .status(201)
                                .json({
                                    success:
                                        true,

                                    recipeId:
                                        result.insertId
                                });
                        }
                    );
                }
            );
        }
    );

    
    // ======================================================
    // UPLOAD PHOTO FOR A SAVED RECIPE
    //
    // POST /api/saved-recipes/:id/photo
    //
    // Only the recipe owner can upload its photo.
    // ======================================================

    router.post(
        '/saved-recipes/:id/photo',

        authenticateToken,

        (req, res) => {

            if (req.user?.role !== 'user') {
                return res.status(403).json({
                    success: false,
                    message: 'User access required.'
                });
            }

            const recipeId = Number(req.params.id);

            if (
                !Number.isSafeInteger(recipeId) ||
                recipeId <= 0
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid recipe ID.'
                });
            }

            // Receive the selected image.
            recipePhotoUpload(
                req,
                res,

                async uploadError => {

                    if (uploadError) {

                        return res.status(
                            uploadError.code === 'LIMIT_FILE_SIZE'
                                ? 413
                                : 400
                        ).json({
                            success: false,

                            message:
                                uploadError.code === 'LIMIT_FILE_SIZE'
                                    ? 'Recipe photo must be 5 MB or smaller.'
                                    : 'Unable to read the uploaded photo.'
                        });
                    }

                    if (!req.file) {

                        return res.status(400).json({
                            success: false,
                            message: 'Please select a recipe photo.'
                        });
                    }

                    // Check actual image contents.
                    const photoType = identifyRecipePhoto(
                        req.file.buffer
                    );

                    if (
                        !photoType ||
                        photoType.mime !== req.file.mimetype
                    ) {

                        return res.status(400).json({
                            success: false,
                            message:
                                'Recipe photo must be JPEG, PNG or WebP.'
                        });
                    }

                    // ======================================
                    // VERIFY RECIPE OWNERSHIP
                    // ======================================

                    db.query(
                        `
                        SELECT id
                        FROM saved_recipes
                        WHERE id = ?
                        AND user_id = ?
                        LIMIT 1
                        `,
                        [
                            recipeId,
                            req.user.id
                        ],

                        async (lookupError, matches) => {

                            if (lookupError) {

                                return res.status(500).json({
                                    success: false,
                                    message:
                                        'Unable to check saved recipe.'
                                });
                            }

                            if (!matches.length) {

                                return res.status(404).json({
                                    success: false,
                                    message: 'Saved recipe not found.'
                                });
                            }

                            // ==================================
                            // GENERATE A SAFE FILENAME
                            // ==================================

                            const filename =
                                `${crypto.randomUUID()}.${photoType.extension}`;

                            const filePath = path.join(
                                RECIPE_PHOTO_DIR,
                                filename
                            );

                            const imageUrl =
                                `/api/recipe-photos/${filename}`;

                            // ==================================
                            // WRITE IMAGE TO DISK
                            // ==================================

                            try {

                                await fs.promises.writeFile(
                                    filePath,
                                    req.file.buffer,
                                    {
                                        flag: 'wx',
                                        mode: 0o600
                                    }
                                );

                            } catch (writeError) {

                                console.error(
                                    'Recipe photo write:',
                                    writeError
                                );

                                return res.status(500).json({
                                    success: false,
                                    message:
                                        'Unable to store recipe photo.'
                                });
                            }

                            
                            // Save the uploaded photo against its recipe first.
                            try {
                                const updateResult = await new Promise(
                                    (resolve, reject) => {
                                        db.query(
                                            `UPDATE saved_recipes
                                            SET image_url = ?
                                            WHERE id = ? AND user_id = ?
                                            LIMIT 1`,
                                            [imageUrl, recipeId, req.user.id],
                                            (error, result) => {
                                                if (error) reject(error);
                                                else resolve(result);
                                            }
                                        );
                                    }
                                );

                                if (updateResult.affectedRows !== 1) {
                                    throw new Error('Recipe update failed.');
                                }

                            } catch (error) {
                                console.error('Save recipe photo:', error);

                                await fs.promises.unlink(filePath).catch(() => {});

                                return res.status(500).json({
                                    success: false,
                                    message: 'Unable to save recipe photo.'
                                });
                            }


                            
                            // ======================================================
                            // AUTOMATICALLY LINK PHOTO TO OLDER RECIPE MEAL LOGS
                            //
                            // Only updates meal logs that:
                            // 1. Belong to the same user
                            // 2. Are logged from a recipe
                            // 3. Have no image yet
                            // 4. Match this saved recipe's exact title
                            // 5. Have exactly one matching saved recipe
                            // ======================================================

                            db.query(
                                `
                                UPDATE meal_logs AS m

                                INNER JOIN saved_recipes AS s
                                    ON s.id = ?
                                    AND s.user_id = m.user_id
                                    AND BINARY s.title = BINARY m.food_name

                                SET m.image_url = ?

                                WHERE m.user_id = ?
                                AND m.source_type = 'recipe'
                                AND m.image_url IS NULL

                                AND (
                                    SELECT COUNT(*)
                                    FROM saved_recipes AS s2
                                    WHERE s2.user_id = m.user_id
                                        AND BINARY s2.title = BINARY m.food_name
                                ) = 1
                                `,

                                [
                                    recipeId,
                                    imageUrl,
                                    req.user.id
                                ],

                                (linkError, linkResult) => {

                                    if (linkError) {

                                        console.error(
                                            'Recipe photo meal link failed:',
                                            linkError
                                        );
                                    }

                                    // The recipe photo is already saved.
                                    // Do not report upload failure if linking
                                    // an older meal encounters an error.

                                    return res.json({
                                        success: true,

                                        recipeId,

                                        imageUrl,

                                        linkedMeals: linkError
                                            ? 0
                                            : linkResult.affectedRows,

                                        message: linkError
                                            ? 'Recipe photo uploaded, but older meal photos could not be linked.'
                                            : 'Recipe photo uploaded successfully.'
                                    });
                                }
                            );

                        }
                    );
                }
            );
        }
    );


    
    // ======================================================
    // RETRIEVE SAVED RECIPE PHOTO
    //
    // GET /api/recipe-photos/:filename
    //
    // Allowed if the authenticated user owns the
    // recipe or a logged meal referencing the photo.
    // ======================================================

    router.get(
        '/recipe-photos/:filename',

        authenticateToken,

        (req, res) => {

            const filename = String(
                req.params.filename || ''
            );

            if (
                !recipePhotoNamePattern.test(filename)
            ) {

                return res.status(400).json({
                    success: false,
                    message: 'Invalid photo name.'
                });
            }

            const imageUrl =
                `/api/recipe-photos/${filename}`;

            db.query(
                `
                SELECT 1 AS allowed
                FROM saved_recipes
                WHERE user_id = ?
                AND image_url = ?

                UNION ALL

                SELECT 1 AS allowed
                FROM meal_logs
                WHERE user_id = ?
                AND image_url = ?

                LIMIT 1
                `,
                [
                    req.user.id,
                    imageUrl,
                    req.user.id,
                    imageUrl
                ],

                (error, matches) => {

                    if (error) {

                        return res.status(500).json({
                            success: false,
                            message:
                                'Unable to access recipe photo.'
                        });
                    }

                    if (!matches.length) {

                        return res.status(404).json({
                            success: false,
                            message:
                                'Recipe photo not found.'
                        });
                    }

                    const filePath = path.join(
                        RECIPE_PHOTO_DIR,
                        filename
                    );

                    const contentType =
                        filename.endsWith('.png')
                            ? 'image/png'
                            : filename.endsWith('.webp')
                                ? 'image/webp'
                                : 'image/jpeg';

                    res.set({
                        'Cache-Control': 'private, no-store',
                        'X-Content-Type-Options': 'nosniff',
                        'Content-Type': contentType
                    });

                    res.sendFile(
                        filePath,

                        sendError => {

                            if (
                                sendError &&
                                !res.headersSent
                            ) {

                                return res.status(404).json({
                                    success: false,
                                    message:
                                        'Recipe photo file missing.'
                                });
                            }
                        }
                    );
                }
            );
        }
    );


    // ==================================================
    // GET SAVED RECIPES
    // ==================================================

    router.get(
        '/saved-recipes',

        authenticateToken,

        (
            req,
            res
        ) => {

            db.query(
                `
                SELECT *
                FROM saved_recipes
                WHERE user_id = ?
                ORDER BY created_at DESC
                `,
                [
                    req.user.id
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
                                    'Unable to load saved recipes.'
                            });
                    }


                    return res.json({
                        success:
                            true,

                        recipes:
                            results.map(
                                formatSavedRecipe
                            )
                    });
                }
            );
        }
    );


    // ==================================================
    // GET ONE SAVED RECIPE
    // ==================================================

    router.get(
        '/saved-recipes/:id',

        authenticateToken,

        (
            req,
            res
        ) => {

            db.query(
                `
                SELECT *
                FROM saved_recipes
                WHERE id = ?
                  AND user_id = ?
                LIMIT 1
                `,
                [
                    Number(
                        req.params.id
                    ),

                    req.user.id
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
                                    'Saved recipe not found.'
                            });
                    }


                    return res.json({
                        success:
                            true,

                        recipe:
                            formatSavedRecipe(
                                results[0]
                            )
                    });
                }
            );
        }
    );
    
    // ==================================================
    // ADD OR REMOVE RECIPE FROM FAVOURITES
    //
    // PATCH /api/saved-recipes/:id/favourite
    //
    // Body:
    // {
    //     "isFavourite": true
    // }
    //
    // true  = Add to favourites
    // false = Remove from favourites
    //
    // This does NOT delete the recipe.
    // ==================================================

    router.patch(
        '/saved-recipes/:id/favourite',

        authenticateToken,

        (req, res) => {

            const recipeId = Number(req.params.id);

            const isFavourite =
                req.body?.isFavourite;

            // ==========================================
            // VALIDATE RECIPE ID
            // ==========================================

            if (
                !Number.isSafeInteger(recipeId) ||
                recipeId <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message: 'Invalid recipe ID.'
                });
            }

            // ==========================================
            // VALIDATE FAVORITE VALUE
            // ==========================================

            if (typeof isFavourite !== 'boolean') {

                return res.status(400).json({
                    success: false,
                    message:
                        'isFavourite must be true or false.'
                });
            }

            // ==========================================
            // ONLY NORMAL USER ACCOUNTS
            // ==========================================

            if (req.user?.role !== 'user') {

                return res.status(403).json({
                    success: false,
                    message:
                        'User account access required.'
                });
            }

            // ==========================================
            // UPDATE FAVORITE STATUS
            // ONLY FOR RECIPE OWNER
            // ==========================================

            db.query(
                `
                UPDATE saved_recipes

                SET is_favourite = ?

                WHERE id = ?
                AND user_id = ?

                LIMIT 1
                `,
                [
                    isFavourite ? 1 : 0,
                    recipeId,
                    req.user.id
                ],

                (error, result) => {

                    if (error) {

                        console.error(
                            'Update recipe favourite:',
                            error
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                'Unable to update favourite.'
                        });
                    }

                    // ==================================
                    // RECIPE DOES NOT EXIST OR
                    // DOES NOT BELONG TO THIS USER
                    // ==================================

                    if (result.affectedRows === 0) {

                        return res.status(404).json({
                            success: false,
                            message:
                                'Saved recipe not found.'
                        });
                    }

                    // ==================================
                    // SUCCESS
                    // ==================================

                    return res.json({

                        success: true,

                        recipeId,

                        isFavourite,

                        message: isFavourite
                            ? 'Recipe added to favourites.'
                            : 'Recipe removed from favourites.'
                    });
                }
            );
        }
    );



    // ==================================================
    // DELETE SAVED RECIPE
    // ==================================================

    router.delete(
        '/saved-recipes/:id',

        authenticateToken,

        (
            req,
            res
        ) => {

            db.query(
                `
                DELETE FROM saved_recipes
                WHERE id = ?
                  AND user_id = ?
                LIMIT 1
                `,
                [
                    Number(
                        req.params.id
                    ),

                    req.user.id
                ],

                (
                    error,
                    result
                ) => {

                    if (
                        error ||
                        result.affectedRows ===
                        0
                    ) {

                        return res
                            .status(
                                error
                                    ? 500
                                    : 404
                            )
                            .json({
                                message:
                                    'Saved recipe not found.'
                            });
                    }


                    return res.json({
                        success:
                            true
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
    createSavedRecipeRouter;