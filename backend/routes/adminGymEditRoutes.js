const express = require('express');

const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');
const { randomUUID } = require('crypto');

// ======================================================
// GYM PHOTO UPLOAD CONFIGURATION
// ======================================================

const GYM_IMAGE_DIR = path.join(
    __dirname,
    '..',
    'uploads',
    'gym-images'
);

// Maximum file size: 5 MB.
// The image is validated before it is saved.

const gymPhotoUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
    }
}).single('photo');

// ======================================================
// VALIDATE ACTUAL IMAGE FILE CONTENT
// Allow JPEG, PNG and WebP only
// ======================================================

function gymImageExtension(buffer) {

    if (!Buffer.isBuffer(buffer)) {
        return null;
    }

    // JPEG
    if (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
    ) {
        return '.jpg';
    }

    // PNG
    const pngSignature = Buffer.from([
        137, 80, 78, 71, 13, 10, 26, 10
    ]);

    if (
        buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(pngSignature)
    ) {
        return '.png';
    }

    // WebP
    if (
        buffer.length >= 12 &&
        buffer.toString('ascii', 0, 4) === 'RIFF' &&
        buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
        return '.webp';
    }

    return null;
}

// ======================================================
// WELLSMARTBOOK - ADMIN EDIT GYM DETAILS
//
// GET   /api/admin/gyms/:id/details
// PATCH /api/admin/gyms/:id
// ======================================================

function createAdminGymEditRouter({
    db,
    authenticateToken
}) {

    const router = express.Router();

    // ==================================================
    // MYSQL QUERY HELPER
    // ==================================================

    function query(sql, params = []) {

        return new Promise((resolve, reject) => {

            db.query(sql, params, (error, result) => {

                if (error) {
                    return reject(error);
                }

                resolve(result);
            });
        });
    }

    // ==================================================
    // VERIFY ACTIVE ADMINISTRATOR
    // ==================================================

    async function requireAdmin(req, res, next) {

        const adminId = Number(req.user?.id);

        if (
            req.user?.role !== 'admin' ||
            req.user?.purpose ===
                'admin_password_change' ||
            !Number.isSafeInteger(adminId) ||
            adminId <= 0
        ) {

            return res.status(403).json({
                success: false,
                message: 'Administrator access required.'
            });
        }

        try {

            const rows = await query(
                `
                SELECT id
                FROM users
                WHERE id = ?
                  AND role = 'admin'
                  AND is_active = 1
                LIMIT 1
                `,
                [adminId]
            );

            if (!rows.length) {

                return res.status(403).json({
                    success: false,
                    message:
                        'Administrator access has been revoked.'
                });
            }

            next();

        } catch (error) {

            console.error('Verify gym admin:', error);

            return res.status(500).json({
                success: false,
                message: 'Unable to verify administrator.'
            });
        }
    }

    // ==================================================
    // VALIDATE GYM ID
    // ==================================================

    function validateGymId(req, res, next) {

        const idText = String(req.params.id);
        const id = Number(idText);

        if (
            !/^[1-9]\d*$/.test(idText) ||
            !Number.isSafeInteger(id)
        ) {

            return res.status(400).json({
                success: false,
                message: 'Invalid gym ID.'
            });
        }

        req.gymId = id;

        next();
    }

    // ==================================================
    // PARSE DATABASE JSON
    // ==================================================

    function readJSON(value, fallback) {

        if (!value) return fallback;

        try {

            return typeof value === 'string'
                ? JSON.parse(value)
                : value;

        } catch {

            return fallback;
        }
    }

    // ==================================================
    // GET COMPLETE GYM DETAILS
    //
    // GET /api/admin/gyms/:id/details
    // ==================================================

    router.get(
        '/admin/gyms/:id/details',

        authenticateToken,
        requireAdmin,
        validateGymId,

        async (req, res) => {

            try {

                const rows = await query(
                    `
                    SELECT *
                    FROM gyms
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [req.gymId]
                );

                if (!rows.length) {

                    return res.status(404).json({
                        success: false,
                        message: 'Gym not found.'
                    });
                }

                const gym = rows[0];

                return res.json({

                    success: true,

                    gym: {

                        id: Number(gym.id),

                        name: gym.name,

                        description:
                            gym.description || '',

                        addressLine1:
                            gym.address_line1,

                        addressLine2:
                            gym.address_line2 || '',

                        city: gym.city,

                        state: gym.state,

                        postcode:
                            gym.postcode || '',

                        country: gym.country,

                        latitude:
                            Number(gym.latitude),

                        longitude:
                            Number(gym.longitude),

                        phone:
                            gym.phone || '',

                        email:
                            gym.email || '',

                        websiteUrl:
                            gym.website_url || '',

                        imageUrl:
                            gym.image_url || '',

                        openingHours: readJSON(
                            gym.opening_hours,
                            {}
                        ),

                        amenities: readJSON(
                            gym.amenities,
                            []
                        ),

                        isActive:
                            Number(gym.is_active) === 1
                    }
                });

            } catch (error) {

                console.error(
                    'Load gym details:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        'Unable to load gym details.'
                });
            }
        }
    );

    // ==================================================
    // UPDATE GYM INFORMATION
    //
    // PATCH /api/admin/gyms/:id
    //
    // Only edits gym details.
    // Status and photo are managed separately.
    // ==================================================

    router.patch(
        '/admin/gyms/:id',

        authenticateToken,
        requireAdmin,
        validateGymId,

        async (req, res) => {

            const body = req.body;

            if (
                !body ||
                typeof body !== 'object' ||
                Array.isArray(body)
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        'Gym details must be a JSON object.'
                });
            }

            // ==========================================
            // ALLOWED TEXT FIELDS
            // ==========================================

            const textFields = {

                name:
                    ['name', 150, true],

                description:
                    ['description', 5000, false],

                addressLine1:
                    ['address_line1', 255, true],

                addressLine2:
                    ['address_line2', 255, false],

                city:
                    ['city', 100, true],

                state:
                    ['state', 100, true],

                postcode:
                    ['postcode', 20, false],

                country:
                    ['country', 100, true],

                phone:
                    ['phone', 30, false],

                email:
                    ['email', 150, false],

                websiteUrl:
                    ['website_url', 500, false]
            };

            const allowedFields = new Set([
                ...Object.keys(textFields),
                'latitude',
                'longitude',
                'openingHours',
                'amenities'
            ]);

            const fields = Object.keys(body);

            // ==========================================
            // BLOCK UNSUPPORTED FIELDS
            //
            // Admin cannot change is_active or
            // image_url through this endpoint.
            // ==========================================

            if (
                !fields.length ||
                fields.some(
                    key => !allowedFields.has(key)
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        'No editable gym fields supplied, or an unsupported field was included.'
                });
            }

            const updates = {};

            // ==========================================
            // VALIDATE TEXT INFORMATION
            // ==========================================

            for (
                const [
                    key,
                    [column, max, required]
                ] of Object.entries(textFields)
            ) {

                if (
                    !Object.prototype.hasOwnProperty.call(
                        body,
                        key
                    )
                ) {
                    continue;
                }

                if (typeof body[key] !== 'string') {

                    return res.status(400).json({
                        success: false,
                        message: `${key} must be text.`
                    });
                }

                const value = body[key].trim();

                if (
                    (required && !value) ||
                    value.length > max
                ) {

                    return res.status(400).json({
                        success: false,
                        message:
                            `Invalid ${key}; maximum ${max} characters.`
                    });
                }

                updates[column] = value || null;
            }

            // ==========================================
            // VALIDATE GPS COORDINATES
            // ==========================================

            for (
                const [key, min, max] of [
                    ['latitude', -90, 90],
                    ['longitude', -180, 180]
                ]
            ) {

                if (
                    !Object.prototype.hasOwnProperty.call(
                        body,
                        key
                    )
                ) {
                    continue;
                }

                const raw = body[key];
                const number = Number(raw);

                if (
                    (
                        typeof raw !== 'number' &&
                        typeof raw !== 'string'
                    ) ||
                    String(raw).trim() === '' ||
                    !Number.isFinite(number) ||
                    number < min ||
                    number > max
                ) {

                    return res.status(400).json({
                        success: false,
                        message:
                            `Invalid ${key}; enter a value from ${min} to ${max}.`
                    });
                }

                updates[key] = number;
            }

            // ==========================================
            // VALIDATE OPTIONAL CONTACT EMAIL
            // ==========================================

            if (
                updates.email &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
                    updates.email
                )
            ) {

                return res.status(400).json({
                    success: false,
                    message: 'Invalid contact email.'
                });
            }

            // ==========================================
            // VALIDATE OPTIONAL WEBSITE
            // ==========================================

            if (updates.website_url) {

                try {

                    const url = new URL(
                        updates.website_url
                    );

                    if (
                        !['http:', 'https:'].includes(
                            url.protocol
                        )
                    ) {
                        throw new Error('Invalid URL');
                    }

                } catch {

                    return res.status(400).json({
                        success: false,
                        message:
                            'Website URL must start with http:// or https://.'
                    });
                }
            }

            // ==========================================
            // VALIDATE OPENING HOURS
            // ==========================================

            if (
                Object.prototype.hasOwnProperty.call(
                    body,
                    'openingHours'
                )
            ) {

                const hours = body.openingHours;

                const days = new Set([
                    'Monday',
                    'Tuesday',
                    'Wednesday',
                    'Thursday',
                    'Friday',
                    'Saturday',
                    'Sunday'
                ]);

                if (
                    !hours ||
                    typeof hours !== 'object' ||
                    Array.isArray(hours) ||
                    Object.entries(hours).some(
                        ([day, value]) =>
                            !days.has(day) ||
                            typeof value !== 'string' ||
                            value.length > 30
                    ) ||
                    JSON.stringify(hours).length > 5000
                ) {

                    return res.status(400).json({
                        success: false,
                        message: 'Invalid opening hours.'
                    });
                }

                updates.opening_hours =
                    JSON.stringify(hours);
            }

            // ==========================================
            // VALIDATE AMENITIES
            // ==========================================

            if (
                Object.prototype.hasOwnProperty.call(
                    body,
                    'amenities'
                )
            ) {

                const amenities = body.amenities;

                if (
                    !Array.isArray(amenities) ||
                    amenities.length > 30 ||
                    amenities.some(
                        value =>
                            typeof value !== 'string' ||
                            !value.trim() ||
                            value.trim().length > 100
                    )
                ) {

                    return res.status(400).json({
                        success: false,
                        message:
                            'Amenities must be an array of up to 30 short labels.'
                    });
                }

                updates.amenities = JSON.stringify(
                    amenities.map(
                        value => value.trim()
                    )
                );
            }

            // ==========================================
            // SAVE CHANGES TO MYSQL
            // ==========================================

            try {

                // Verify gym exists.

                const existing = await query(
                    `
                    SELECT id
                    FROM gyms
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [req.gymId]
                );

                if (!existing.length) {

                    return res.status(404).json({
                        success: false,
                        message: 'Gym not found.'
                    });
                }

                // Build UPDATE query using only
                // approved database column names.

                const columns =
                    Object.keys(updates);

                const sql = `
                    UPDATE gyms
                    SET ${columns.map(
                        column => `\`${column}\` = ?`
                    ).join(', ')}
                    WHERE id = ?
                `;

                await query(
                    sql,
                    [
                        ...Object.values(updates),
                        req.gymId
                    ]
                );

                return res.json({
                    success: true,
                    message:
                        'Gym details updated successfully.',
                    gymId: req.gymId
                });

            } catch (error) {

                console.error(
                    'Update gym details:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        'Unable to update gym details.'
                });
            }
        }
    );
    
    // ==================================================
    // SERVE UPLOADED GYM PHOTOS
    //
    // GET /api/gym-images/:filename
    // ==================================================

    router.use(
        '/gym-images',
        express.static(GYM_IMAGE_DIR, {
            index: false,
            dotfiles: 'deny',
            maxAge: '1h',

            setHeaders(res) {
                res.setHeader(
                    'X-Content-Type-Options',
                    'nosniff'
                );
            }
        })
    );

    // ==================================================
    // ADMIN - UPLOAD OR REPLACE GYM PHOTO
    //
    // POST /api/admin/gyms/:id/photo
    //
    // FormData field name: photo
    // ==================================================

    router.post(
        '/admin/gyms/:id/photo',

        authenticateToken,
        requireAdmin,
        validateGymId,

        (req, res) => {

            gymPhotoUpload(
                req,
                res,

                async uploadError => {

                    // ==================================
                    // CHECK UPLOAD ERRORS
                    // ==================================

                    if (uploadError) {

                        return res.status(400).json({
                            success: false,

                            message:
                                uploadError.code ===
                                'LIMIT_FILE_SIZE'
                                    ? 'The gym photo must be 5 MB or smaller.'
                                    : 'Invalid photo upload.'
                        });
                    }

                    // ==================================
                    // CHECK PHOTO EXISTS
                    // ==================================

                    if (!req.file) {

                        return res.status(400).json({
                            success: false,
                            message:
                                'Please select a gym photo.'
                        });
                    }

                    // ==================================
                    // CHECK REAL IMAGE TYPE
                    // ==================================

                    const extension =
                        gymImageExtension(
                            req.file.buffer
                        );

                    if (!extension) {

                        return res.status(400).json({
                            success: false,
                            message:
                                'Upload a JPEG, PNG or WebP image.'
                        });
                    }

                    let savedPath = null;

                    try {

                        // ==============================
                        // VERIFY GYM EXISTS IN MYSQL
                        // ==============================

                        const rows = await query(
                            `
                            SELECT image_url
                            FROM gyms
                            WHERE id = ?
                            LIMIT 1
                            `,
                            [req.gymId]
                        );

                        if (!rows.length) {

                            return res.status(404).json({
                                success: false,
                                message: 'Gym not found.'
                            });
                        }

                        // ==============================
                        // CREATE IMAGE FOLDER
                        // ==============================

                        await fs.mkdir(
                            GYM_IMAGE_DIR,
                            { recursive: true }
                        );

                        // ==============================
                        // GENERATE RANDOM FILENAME
                        // ==============================

                        const filename =
                            `${randomUUID()}${extension}`;

                        savedPath = path.join(
                            GYM_IMAGE_DIR,
                            filename
                        );

                        // ==============================
                        // SAVE IMAGE
                        // ==============================

                        await fs.writeFile(
                            savedPath,
                            req.file.buffer,
                            { flag: 'wx' }
                        );

                        // ==============================
                        // SAVE IMAGE PATH IN MYSQL
                        // ==============================

                        const imageUrl =
                            `/api/gym-images/${filename}`;

                        const result = await query(
                            `
                            UPDATE gyms
                            SET image_url = ?
                            WHERE id = ?
                            `,
                            [
                                imageUrl,
                                req.gymId
                            ]
                        );

                        if (result.affectedRows !== 1) {

                            await fs.unlink(
                                savedPath
                            ).catch(() => {});

                            return res.status(409).json({
                                success: false,
                                message:
                                    'Gym changed during upload. Try again.'
                            });
                        }

                        // ==============================
                        // REMOVE OLD LOCAL IMAGE
                        // ONLY AFTER MYSQL IS UPDATED
                        // ==============================

                        const oldUrl =
                            rows[0].image_url;

                        const oldName =
                            typeof oldUrl === 'string'
                                ? oldUrl.match(
                                    /^\/api\/gym-images\/([a-f0-9-]{36}\.(?:jpg|png|webp))$/i
                                )
                                : null;

                        if (
                            oldName &&
                            oldName[1] !== filename
                        ) {

                            await fs.unlink(
                                path.join(
                                    GYM_IMAGE_DIR,
                                    oldName[1]
                                )
                            ).catch(() => {});
                        }

                        // ==============================
                        // SUCCESS RESPONSE
                        // ==============================

                        return res.json({
                            success: true,

                            message:
                                'Gym photo uploaded successfully.',

                            gym: {
                                id: req.gymId,
                                imageUrl
                            }
                        });

                    } catch (error) {

                        if (savedPath) {

                            await fs.unlink(
                                savedPath
                            ).catch(() => {});
                        }

                        console.error(
                            'Admin gym photo upload:',
                            error
                        );

                        return res.status(500).json({
                            success: false,
                            message:
                                'Unable to save the gym photo.'
                        });
                    }
                }
            );
        }
    );


    // ==================================================
    // RETURN ROUTER
    // ==================================================

    return router;
}

module.exports = createAdminGymEditRouter;
