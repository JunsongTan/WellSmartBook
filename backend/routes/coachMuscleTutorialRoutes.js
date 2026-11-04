
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// ======================================================
// COACH MUSCLE TUTORIAL UPLOAD ROUTES
// ======================================================

const UPLOAD_DIR = path.join(
    __dirname, '..', 'uploads', 'muscle-tutorials'
);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MUSCLE_GROUPS = new Set([
    'chest', 'shoulders', 'biceps', 'forearms', 'abs',
    'quadriceps', 'calves', 'trapezius', 'triceps',
    'back', 'lower_back', 'glutes', 'hamstrings'
]);

const ALLOWED_FILES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm'
};

// ======================================================
// CHECK ACTUAL FILE CONTENT
// ======================================================

async function signatureMatches(filePath, mimeType) {

    const handle =
        await fs.promises.open(filePath, 'r');

    try {

        const header = Buffer.alloc(16);

        const { bytesRead } =
            await handle.read(header, 0, 16, 0);

        if (bytesRead < 12) return false;

        if (mimeType === 'image/jpeg') {
            return header[0] === 0xff &&
                header[1] === 0xd8 &&
                header[2] === 0xff;
        }

        if (mimeType === 'image/png') {
            return header.subarray(0, 8).equals(
                Buffer.from([
                    137, 80, 78, 71, 13, 10, 26, 10
                ])
            );
        }

        if (mimeType === 'image/webp') {
            return (
                header.toString('ascii', 0, 4) === 'RIFF' &&
                header.toString('ascii', 8, 12) === 'WEBP'
            );
        }

        if (mimeType === 'video/mp4') {
            return (
                header.toString('ascii', 4, 8) === 'ftyp'
            );
        }

        if (mimeType === 'video/webm') {
            return header.subarray(0, 4).equals(
                Buffer.from([0x1a, 0x45, 0xdf, 0xa3])
            );
        }

        return false;

    } finally {
        await handle.close();
    }
}

// ======================================================
// FILE UPLOAD CONFIGURATION
// ======================================================

const upload = multer({

    storage: multer.diskStorage({

        destination: (_req, _file, cb) => {
            cb(null, UPLOAD_DIR);
        },

        filename: (_req, file, cb) => {
            cb(
                null,
                randomUUID() + ALLOWED_FILES[file.mimetype]
            );
        }
    }),

    limits: {
        fileSize: 50 * 1024 * 1024,
        files: 1
    },

    fileFilter: (_req, file, cb) => {

        if (!ALLOWED_FILES[file.mimetype]) {

            return cb(new Error(
                'Upload JPG, PNG, WEBP, MP4 or WEBM only.'
            ));
        }

        cb(null, true);
    }

}).single('media');

// ======================================================
// UPLOAD ERROR HANDLER
// ======================================================

function uploadMiddleware(req, res, next) {

    upload(req, res, error => {

        if (error) {

            return res.status(400).json({
                success: false,

                message:
                    error.code === 'LIMIT_FILE_SIZE'
                        ? 'File is too large (maximum 50 MB).'
                        : error.message
            });
        }

        next();
    });
}

// ======================================================
// COACH MUSCLE TUTORIAL ROUTER
// ======================================================

function createCoachMuscleTutorialRouter({
    db,
    authenticateToken,
    authenticateActiveCoach
}) {

    const router = express.Router();

    // ==================================================
    // SERVE UPLOADED TUTORIAL MEDIA
    // ==================================================

    router.use(
        '/muscle-tutorial-media',

        express.static(UPLOAD_DIR, {

            index: false,
            dotfiles: 'deny',

            setHeaders: res => {
                res.setHeader(
                    'X-Content-Type-Options',
                    'nosniff'
                );
            }
        })
    );

    // ==================================================
    // COACH - UPLOAD AND PUBLISH TUTORIAL
    // ==================================================

    router.post(
        '/coach/muscle-tutorials',

        authenticateToken,
        authenticateActiveCoach,
        uploadMiddleware,

        async (req, res) => {

            const filePath = req.file?.path;

            let savedToDatabase = false;

            try {

                const coachId =
                    Number(req.coach?.id);

                const muscleGroup = String(
                    req.body.muscleGroup || ''
                ).trim().toLowerCase();

                const title = String(
                    req.body.title || ''
                ).trim();

                const description = String(
                    req.body.description || ''
                ).trim();

                const instructions = String(
                    req.body.instructions || ''
                ).trim();

                const reps = String(
                    req.body.reps || ''
                ).trim();

                const setsRaw = String(
                    req.body.sets || ''
                ).trim();

                const setsCount = setsRaw
                    ? Number(setsRaw)
                    : null;

                // ======================================
                // VALIDATE COACH
                // ======================================

                if (
                    !Number.isSafeInteger(coachId) ||
                    coachId <= 0
                ) {

                    return res.status(403).json({
                        success: false,
                        message: 'Coach profile is unavailable.'
                    });
                }

                // ======================================
                // VALIDATE MUSCLE GROUP
                // ======================================

                if (!MUSCLE_GROUPS.has(muscleGroup)) {

                    return res.status(400).json({
                        success: false,
                        message: 'Choose a valid muscle group.'
                    });
                }

                // ======================================
                // VALIDATE TUTORIAL DETAILS
                // ======================================

                if (
                    !title ||
                    title.length > 200 ||
                    !instructions ||
                    instructions.length > 10000 ||
                    description.length > 2000 ||
                    reps.length > 50
                ) {

                    return res.status(400).json({
                        success: false,
                        message:
                            'Check the title, description, instructions and reps.'
                    });
                }

                if (
                    setsCount !== null &&
                    (
                        !Number.isInteger(setsCount) ||
                        setsCount < 1 ||
                        setsCount > 50
                    )
                ) {

                    return res.status(400).json({
                        success: false,
                        message: 'Sets must be between 1 and 50.'
                    });
                }

                // ======================================
                // VALIDATE UPLOADED FILE
                // ======================================

                if (!req.file) {

                    return res.status(400).json({
                        success: false,
                        message: 'Please choose a photo or video.'
                    });
                }

                const validContent =
                    await signatureMatches(
                        filePath,
                        req.file.mimetype
                    );

                if (!validContent) {

                    return res.status(400).json({
                        success: false,
                        message:
                            'File content does not match its image/video type.'
                    });
                }

                // ======================================
                // GET MEDIA TYPE AND URL
                // ======================================

                const mediaType =
                    req.file.mimetype.startsWith('image/')
                        ? 'image'
                        : 'video';

                const mediaUrl =
                    `/api/muscle-tutorial-media/${req.file.filename}`;

                // ======================================
                // SAVE TUTORIAL INTO MYSQL
                // ======================================

                const [result] =
                    await db.promise().execute(
                        `
                        INSERT INTO muscle_tutorials (

                            coach_id,
                            muscle_group,
                            title,
                            description,
                            instructions,
                            media_type,
                            media_url,
                            sets_count,
                            reps,
                            status

                        )

                        VALUES (
                            ?, ?, ?, ?, ?, ?, ?, ?, ?,
                            'published'
                        )
                        `,
                        [
                            coachId,
                            muscleGroup,
                            title,
                            description || null,
                            instructions,
                            mediaType,
                            mediaUrl,
                            setsCount,
                            reps || null
                        ]
                    );

                savedToDatabase = true;

                return res.status(201).json({

                    success: true,

                    message:
                        'Tutorial published successfully.',

                    tutorialId:
                        result.insertId,

                    mediaUrl
                });

            } catch (error) {

                console.error(
                    'Upload muscle tutorial:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: 'Unable to publish tutorial.'
                });

            } finally {

                // Remove file if database insert
                // did not succeed.

                if (!savedToDatabase && filePath) {

                    await fs.promises
                        .unlink(filePath)
                        .catch(() => {});
                }
            }
        }
    );

    // ==================================================
    // COACH - VIEW OWN UPLOADED TUTORIALS
    // ==================================================

    router.get(
        '/coach/muscle-tutorials',

        authenticateToken,
        authenticateActiveCoach,

        async (req, res) => {

            try {

                const coachId =
                    Number(req.coach.id);

                const [rows] =
                    await db.promise().execute(
                        `
                        SELECT

                            id AS tutorialId,

                            muscle_group AS muscleGroup,

                            title,
                            description,
                            instructions,

                            media_type AS mediaType,

                            media_url AS mediaUrl,

                            sets_count AS sets,

                            reps,
                            status,

                            created_at AS createdAt

                        FROM muscle_tutorials

                        WHERE coach_id = ?

                        ORDER BY
                            created_at DESC,
                            id DESC

                        LIMIT 100
                        `,
                        [coachId]
                    );

                return res.json({
                    success: true,
                    count: rows.length,
                    tutorials: rows
                });

            } catch (error) {

                console.error(
                    'List coach muscle tutorials:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        'Unable to load your tutorials.'
                });
            }
        }
    );

    
    // ==================================================
    // HELPER - REMOVE OLD UPLOADED MEDIA SAFELY
    // ==================================================

    async function removeStoredMedia(mediaUrl) {

        const match =
            /^\/api\/muscle-tutorial-media\/([a-f0-9-]{36}\.(?:jpg|png|webp|mp4|webm))$/i.exec(
                String(mediaUrl || '')
            );

        if (!match) return;

        try {

            await fs.promises.unlink(
                path.join(UPLOAD_DIR, match[1])
            );

        } catch (error) {

            if (error.code !== 'ENOENT') {
                console.error(
                    'Remove tutorial media:',
                    error
                );
            }
        }
    }


    // ==================================================
    // COACH - EDIT OWN MUSCLE TUTORIAL
    // ==================================================

    router.put(
        '/coach/muscle-tutorials/:tutorialId',

        authenticateToken,
        authenticateActiveCoach,
        uploadMiddleware,

        async (req, res) => {

            const newFilePath = req.file?.path;

            let keepNewFile = false;

            try {

                const tutorialId =
                    Number(req.params.tutorialId);

                const coachId =
                    Number(req.coach?.id);


                // ======================================
                // VALIDATE IDS
                // ======================================

                if (
                    !Number.isSafeInteger(tutorialId) ||
                    tutorialId <= 0 ||
                    !Number.isSafeInteger(coachId) ||
                    coachId <= 0
                ) {

                    return res.status(400).json({
                        success: false,
                        message: 'Invalid tutorial or coach ID.'
                    });
                }


                // ======================================
                // GET UPDATED FIELDS
                // ======================================

                const muscleGroup =
                    String(req.body?.muscleGroup || '')
                        .trim()
                        .toLowerCase();

                const title =
                    String(req.body?.title || '').trim();

                const description =
                    String(req.body?.description || '').trim();

                const instructions =
                    String(req.body?.instructions || '').trim();

                const reps =
                    String(req.body?.reps || '').trim();

                const setsRaw =
                    String(req.body?.sets || '').trim();

                const setsCount =
                    setsRaw ? Number(setsRaw) : null;


                // ======================================
                // VALIDATE MUSCLE GROUP
                // ======================================

                if (!MUSCLE_GROUPS.has(muscleGroup)) {

                    return res.status(400).json({
                        success: false,
                        message: 'Choose a valid muscle group.'
                    });
                }


                // ======================================
                // VALIDATE TUTORIAL INFORMATION
                // ======================================

                if (
                    !title ||
                    title.length > 200 ||
                    !instructions ||
                    instructions.length > 10000 ||
                    description.length > 2000 ||
                    reps.length > 50
                ) {

                    return res.status(400).json({
                        success: false,
                        message:
                            'Check the title, description, instructions and repetitions.'
                    });
                }

                if (
                    setsCount !== null &&
                    (
                        !Number.isInteger(setsCount) ||
                        setsCount < 1 ||
                        setsCount > 50
                    )
                ) {

                    return res.status(400).json({
                        success: false,
                        message: 'Sets must be between 1 and 50.'
                    });
                }


                // ======================================
                // VERIFY TUTORIAL OWNERSHIP
                // ======================================

                const [existing] =
                    await db.promise().execute(
                        `
                        SELECT
                            media_url AS mediaUrl,
                            media_type AS mediaType

                        FROM muscle_tutorials

                        WHERE id = ?
                        AND coach_id = ?

                        LIMIT 1
                        `,
                        [tutorialId, coachId]
                    );

                if (existing.length === 0) {

                    return res.status(404).json({
                        success: false,
                        message: 'Tutorial not found in your account.'
                    });
                }


                // ======================================
                // KEEP EXISTING MEDIA BY DEFAULT
                // ======================================

                let mediaUrl = existing[0].mediaUrl;

                let mediaType = existing[0].mediaType;


                // ======================================
                // OPTIONAL REPLACEMENT IMAGE / VIDEO
                // ======================================

                if (req.file) {

                    const valid =
                        await signatureMatches(
                            req.file.path,
                            req.file.mimetype
                        );

                    if (!valid) {

                        return res.status(400).json({
                            success: false,
                            message:
                                'Uploaded media does not match its file type.'
                        });
                    }

                    mediaType =
                        req.file.mimetype.startsWith('image/')
                            ? 'image'
                            : 'video';

                    mediaUrl =
                        `/api/muscle-tutorial-media/${req.file.filename}`;
                }


                // ======================================
                // UPDATE TUTORIAL IN MYSQL
                // ======================================

                const [result] =
                    await db.promise().execute(
                        `
                        UPDATE muscle_tutorials

                        SET
                            muscle_group = ?,
                            title = ?,
                            description = ?,
                            instructions = ?,
                            sets_count = ?,
                            reps = ?,
                            media_type = ?,
                            media_url = ?

                        WHERE id = ?
                        AND coach_id = ?
                        `,
                        [
                            muscleGroup,
                            title,
                            description || null,
                            instructions,
                            setsCount,
                            reps || null,
                            mediaType,
                            mediaUrl,
                            tutorialId,
                            coachId
                        ]
                    );


                // ======================================
                // CHECK IF TUTORIAL STILL EXISTS
                // ======================================

                if (result.affectedRows === 0) {

                    const [stillOwned] =
                        await db.promise().execute(
                            `
                            SELECT id
                            FROM muscle_tutorials

                            WHERE id = ?
                            AND coach_id = ?

                            LIMIT 1
                            `,
                            [tutorialId, coachId]
                        );

                    if (!stillOwned.length) {

                        return res.status(409).json({
                            success: false,
                            message:
                                'Tutorial changed or was deleted. Refresh the page.'
                        });
                    }
                }


                // ======================================
                // DATABASE UPDATE SUCCESSFUL
                // ======================================

                keepNewFile = true;


                // ======================================
                // REMOVE OLD MEDIA IF REPLACED
                // ======================================

                if (req.file) {

                    await removeStoredMedia(
                        existing[0].mediaUrl
                    );
                }


                return res.json({

                    success: true,

                    message:
                        'Tutorial updated successfully.',

                    tutorialId,

                    mediaUrl
                });

            } catch (error) {

                console.error(
                    'Edit coach tutorial:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: 'Unable to update tutorial.'
                });

            } finally {

                // Remove the newly uploaded file
                // if the database update failed.

                if (newFilePath && !keepNewFile) {

                    await fs.promises
                        .unlink(newFilePath)
                        .catch(() => {});
                }
            }
        }
    );


    // ==================================================
    // COACH - DELETE OWN MUSCLE TUTORIAL
    // ==================================================

    router.delete(
        '/coach/muscle-tutorials/:tutorialId',

        authenticateToken,
        authenticateActiveCoach,

        async (req, res) => {

            try {

                const tutorialId =
                    Number(req.params.tutorialId);

                const coachId =
                    Number(req.coach?.id);


                // ======================================
                // VALIDATE IDS
                // ======================================

                if (
                    !Number.isSafeInteger(tutorialId) ||
                    tutorialId <= 0 ||
                    !Number.isSafeInteger(coachId) ||
                    coachId <= 0
                ) {

                    return res.status(400).json({
                        success: false,
                        message: 'Invalid tutorial or coach ID.'
                    });
                }


                // ======================================
                // VERIFY OWNERSHIP AND GET MEDIA
                // ======================================

                const [existing] =
                    await db.promise().execute(
                        `
                        SELECT
                            media_url AS mediaUrl

                        FROM muscle_tutorials

                        WHERE id = ?
                        AND coach_id = ?

                        LIMIT 1
                        `,
                        [tutorialId, coachId]
                    );


                if (!existing.length) {

                    return res.status(404).json({
                        success: false,
                        message: 'Tutorial not found in your account.'
                    });
                }


                // ======================================
                // DELETE TUTORIAL FROM MYSQL
                // ======================================

                const [result] =
                    await db.promise().execute(
                        `
                        DELETE FROM muscle_tutorials

                        WHERE id = ?
                        AND coach_id = ?
                        `,
                        [tutorialId, coachId]
                    );


                if (result.affectedRows !== 1) {

                    return res.status(409).json({
                        success: false,
                        message:
                            'Tutorial was already deleted. Refresh the page.'
                    });
                }


                // ======================================
                // REMOVE UPLOADED MEDIA FILE
                // ======================================

                await removeStoredMedia(
                    existing[0].mediaUrl
                );


                return res.json({

                    success: true,

                    message:
                        'Tutorial deleted successfully.',

                    tutorialId
                });

            } catch (error) {

                console.error(
                    'Delete coach tutorial:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message: 'Unable to delete tutorial.'
                });
            }
        }
    );


    return router;
}

// ======================================================
// EXPORT
// ======================================================

module.exports = createCoachMuscleTutorialRouter;
