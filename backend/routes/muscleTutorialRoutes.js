
const express = require('express');

// ======================================================
// USER MUSCLE TUTORIAL LIBRARY + SAVED TUTORIALS
// ======================================================

const VALID_MUSCLES = new Set([
    'chest',
    'shoulders',
    'biceps',
    'forearms',
    'abs',
    'quadriceps',
    'calves',
    'trapezius',
    'triceps',
    'back',
    'lower_back',
    'glutes',
    'hamstrings'
]);

function createMuscleTutorialRouter({
    db,
    authenticateToken
}) {

    const router = express.Router();

    const database = db.promise();


    // ==================================================
    // ONLY NORMAL USERS CAN SAVE TUTORIALS
    // ==================================================

    function requireNormalUser(req, res, next) {

        if (
            !req.user ||
            req.user.role !== 'user'
        ) {
            return res.status(403).json({
                success: false,
                message:
                    'Only normal users can save tutorials.'
            });
        }

        next();
    }


    // ==================================================
    // VALIDATE TUTORIAL ID
    // ==================================================

    function parseTutorialId(req, res, next) {

        const tutorialId =
            Number(req.params.tutorialId);

        if (
            !Number.isSafeInteger(tutorialId) ||
            tutorialId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: 'Invalid tutorial ID.'
            });
        }

        req.tutorialId = tutorialId;

        next();
    }


    // ==================================================
    // GET PUBLISHED TUTORIALS
    //
    // SUPPORTS:
    // - All tutorials
    // - Muscle group filter
    // - Search by exercise title
    // - Saved tutorials only
    // ==================================================

    router.get(
        '/muscle-tutorials',

        authenticateToken,

        async (req, res) => {

            try {

                const muscle = String(
                    req.query.muscle || ''
                ).trim().toLowerCase();

                const search = String(
                    req.query.search || ''
                ).trim();

                const savedOnly =
                    req.query.savedOnly === '1' ||
                    req.query.savedOnly === 'true';

                const userId =
                    Number(req.user?.id);


                // ======================================
                // VALIDATE FILTERS
                // ======================================

                if (
                    muscle &&
                    !VALID_MUSCLES.has(muscle)
                ) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid muscle group.'
                    });
                }

                if (search.length > 120) {
                    return res.status(400).json({
                        success: false,
                        message:
                            'Search must be 120 characters or fewer.'
                    });
                }

                if (
                    !Number.isSafeInteger(userId) ||
                    userId <= 0
                ) {
                    return res.status(401).json({
                        success: false,
                        message: 'Invalid login session.'
                    });
                }

                if (
                    savedOnly &&
                    req.user.role !== 'user'
                ) {
                    return res.status(403).json({
                        success: false,
                        message:
                            'Saved tutorials are for normal users.'
                    });
                }


                // ======================================
                // BASE SQL QUERY
                // ======================================

                let sql = `

                    SELECT

                        mt.id AS tutorialId,

                        mt.coach_id AS coachId,

                        coach_user.full_name
                            AS coachName,

                        mt.muscle_group
                            AS muscleGroup,

                        mt.title,

                        mt.description,

                        mt.instructions,

                        mt.media_type
                            AS mediaType,

                        mt.media_url
                            AS mediaUrl,

                        mt.sets_count
                            AS sets,

                        mt.reps,

                        mt.created_at
                            AS createdAt,

                        IF(
                            saved.user_id IS NULL,
                            0,
                            1
                        ) AS isSaved

                    FROM muscle_tutorials mt

                    INNER JOIN coach_profiles cp
                        ON cp.id = mt.coach_id

                    INNER JOIN users coach_user
                        ON coach_user.id = cp.user_id

                    LEFT JOIN saved_muscle_tutorials saved
                        ON saved.tutorial_id = mt.id
                        AND saved.user_id = ?

                    WHERE mt.status = 'published'
                `;

                const values = [userId];


                // ======================================
                // FILTER BY MUSCLE
                // ======================================

                if (muscle) {

                    sql += `
                        AND mt.muscle_group = ?
                    `;

                    values.push(muscle);
                }


                // ======================================
                // SEARCH EXERCISE TITLE
                // ======================================

                if (search) {

                    sql += `
                        AND LOCATE(?, mt.title) > 0
                    `;

                    values.push(search);
                }


                // ======================================
                // SHOW SAVED TUTORIALS ONLY
                // ======================================

                if (savedOnly) {

                    sql += `
                        AND saved.user_id IS NOT NULL
                    `;
                }


                // ======================================
                // SORT TUTORIALS
                // ======================================

                sql += `

                    ORDER BY
                        mt.created_at DESC,
                        mt.id DESC

                    LIMIT 200
                `;


                // ======================================
                // EXECUTE QUERY
                // ======================================

                const [rows] =
                    await database.query(
                        sql,
                        values
                    );


                // ======================================
                // RESPONSE
                // ======================================

                return res.json({

                    success: true,

                    muscleGroup: muscle || null,

                    savedOnly,

                    count: rows.length,

                    tutorials: rows.map(row => ({

                        ...row,

                        isSaved: Boolean(row.isSaved)

                    }))
                });

            } catch (error) {

                console.error(
                    'Browse muscle tutorials:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        'Unable to load tutorials.'
                });
            }
        }
    );


    // ==================================================
    // SAVE A PUBLISHED TUTORIAL
    // ==================================================

    router.post(
        '/muscle-tutorials/:tutorialId/save',

        authenticateToken,
        requireNormalUser,
        parseTutorialId,

        async (req, res) => {

            try {

                const userId =
                    Number(req.user.id);


                // ======================================
                // SAVE TO MYSQL
                //
                // Only published tutorials can be saved.
                // Duplicate saves will not create
                // duplicate records.
                // ======================================

                const [result] =
                    await database.execute(
                        `
                        INSERT INTO saved_muscle_tutorials
                            (user_id, tutorial_id)

                        SELECT ?, id

                        FROM muscle_tutorials

                        WHERE id = ?
                        AND status = 'published'

                        ON DUPLICATE KEY UPDATE
                            saved_at = saved_at
                        `,
                        [
                            userId,
                            req.tutorialId
                        ]
                    );


                // ======================================
                // CHECK TUTORIAL EXISTS
                // ======================================

                if (result.affectedRows === 0) {

                    const [check] =
                        await database.execute(
                            `
                            SELECT id
                            FROM muscle_tutorials

                            WHERE id = ?
                            AND status = 'published'

                            LIMIT 1
                            `,
                            [req.tutorialId]
                        );

                    if (!check.length) {

                        return res.status(404).json({
                            success: false,
                            message:
                                'Published tutorial not found.'
                        });
                    }
                }


                return res.json({

                    success: true,

                    tutorialId:
                        req.tutorialId,

                    isSaved: true,

                    message:
                        'Tutorial saved.'
                });

            } catch (error) {

                console.error(
                    'Save muscle tutorial:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        'Unable to save tutorial.'
                });
            }
        }
    );


    // ==================================================
    // REMOVE A TUTORIAL FROM SAVED
    //
    // THIS DOES NOT DELETE THE COACH'S TUTORIAL.
    // ==================================================

    router.delete(
        '/muscle-tutorials/:tutorialId/save',

        authenticateToken,
        requireNormalUser,
        parseTutorialId,

        async (req, res) => {

            try {

                await database.execute(
                    `
                    DELETE FROM saved_muscle_tutorials

                    WHERE user_id = ?
                    AND tutorial_id = ?
                    `,
                    [
                        Number(req.user.id),
                        req.tutorialId
                    ]
                );


                return res.json({

                    success: true,

                    tutorialId:
                        req.tutorialId,

                    isSaved: false,

                    message:
                        'Tutorial removed from saved.'
                });

            } catch (error) {

                console.error(
                    'Unsave muscle tutorial:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        'Unable to remove saved tutorial.'
                });
            }
        }
    );


    return router;
}


// ======================================================
// EXPORT
// ======================================================

module.exports = createMuscleTutorialRouter;
