
const express = require('express');

// ======================================================
// WELLSMARTBOOK - ADMIN GYM OVERSIGHT
//
// GET /api/admin/gyms
// ======================================================

function createAdminGymRouter({
    db,
    bookingPool,
    authenticateToken
}) {

    const router = express.Router();

    // ==================================================
    // DATABASE QUERY HELPER
    // ==================================================

    function query(sql, params = []) {

        return new Promise((resolve, reject) => {

            db.query(sql, params, (error, rows) => {

                if (error) {
                    return reject(error);
                }

                resolve(rows);
            });
        });
    }

    // ==================================================
    // GET ALL GYMS FOR ADMINISTRATOR
    // ==================================================

    router.get(
        '/admin/gyms',
        authenticateToken,

        async (req, res) => {

            // ==========================================
            // VERIFY ADMINISTRATOR ROLE
            // ==========================================

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
                    message:
                        'Administrator access required.'
                });
            }

            // ==========================================
            // SEARCH, FILTER AND PAGINATION
            // ==========================================

            const search = String(
                req.query.search ?? ''
            ).trim();

            const status = String(
                req.query.status ?? 'all'
            ).trim().toLowerCase();

            const page = Number(
                req.query.page ?? 1
            );

            const limit = Number(
                req.query.limit ?? 10
            );

            // ==========================================
            // VALIDATE QUERY PARAMETERS
            // ==========================================

            if (
                search.length > 100 ||
                !['all', 'active', 'disabled'].includes(
                    status
                ) ||
                !Number.isSafeInteger(page) ||
                page < 1 ||
                page > 10000 ||
                !Number.isSafeInteger(limit) ||
                limit < 1 ||
                limit > 50
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        'Invalid search, status, page, or limit.'
                });
            }

            try {

                // ======================================
                // VERIFY ACTIVE ADMIN IN MYSQL
                // ======================================

                const adminRows = await query(
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

                if (!adminRows.length) {

                    return res.status(403).json({
                        success: false,
                        message:
                            'Administrator access has been revoked.'
                    });
                }

                // ======================================
                // CALCULATE ALL GYM COUNTS
                // ======================================

                const summaryRows = await query(
                    `
                    SELECT

                        COUNT(*) AS total_gyms,

                        COALESCE(
                            SUM(is_active = 1),
                            0
                        ) AS active_gyms,

                        COALESCE(
                            SUM(is_active = 0),
                            0
                        ) AS disabled_gyms

                    FROM gyms
                    `
                );

                const summary = summaryRows[0] || {};

                // ======================================
                // BUILD STATUS FILTER
                // ======================================

                let whereSql = 'WHERE 1 = 1';

                const params = [];

                if (status !== 'all') {

                    whereSql += `
                        AND is_active = ?
                    `;

                    params.push(
                        status === 'active' ? 1 : 0
                    );
                }

                // ======================================
                // BUILD SEARCH FILTER
                // ======================================

                if (search) {

                    const escaped = search.replace(
                        /[!%_]/g,
                        '!$&'
                    );

                    const keyword = `%${escaped}%`;

                    whereSql += `
                        AND (
                            name LIKE ? ESCAPE '!'
                            OR city LIKE ? ESCAPE '!'
                            OR state LIKE ? ESCAPE '!'
                            OR address_line1 LIKE ? ESCAPE '!'
                        )
                    `;

                    params.push(
                        keyword,
                        keyword,
                        keyword,
                        keyword
                    );
                }

                // ======================================
                // COUNT MATCHING GYMS
                // ======================================

                const countRows = await query(
                    `
                    SELECT COUNT(*) AS total
                    FROM gyms
                    ${whereSql}
                    `,
                    params
                );

                const total = Number(
                    countRows[0]?.total ?? 0
                );

                const offset = (page - 1) * limit;

                // ======================================
                // RETRIEVE REGISTERED GYMS
                // ======================================

                const rows = await query(
                    `
                    SELECT

                        id,
                        name,
                        description,

                        address_line1,
                        address_line2,

                        city,
                        state,
                        postcode,
                        country,

                        latitude,
                        longitude,

                        phone,
                        email,
                        website_url,

                        image_url,
                        is_active,

                        created_by_admin_id,
                        created_at,
                        updated_at

                    FROM gyms

                    ${whereSql}

                    ORDER BY id DESC

                    LIMIT ? OFFSET ?
                    `,
                    [
                        ...params,
                        limit,
                        offset
                    ]
                );

                // ======================================
                // FORMAT GYM INFORMATION
                // ======================================

                const gyms = rows.map(gym => ({

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
                        gym.latitude == null
                            ? null
                            : Number(gym.latitude),

                    longitude:
                        gym.longitude == null
                            ? null
                            : Number(gym.longitude),

                    phone:
                        gym.phone || '',

                    email:
                        gym.email || '',

                    websiteUrl:
                        gym.website_url || '',

                    imageUrl:
                        gym.image_url || '',

                    isActive:
                        Number(gym.is_active) === 1,

                    createdByAdminId:
                        gym.created_by_admin_id == null
                            ? null
                            : Number(
                                gym.created_by_admin_id
                            ),

                    createdAt:
                        gym.created_at,

                    updatedAt:
                        gym.updated_at
                }));

                // ======================================
                // SEND GYM INFORMATION
                // ======================================

                return res.json({

                    success: true,

                    summary: {

                        totalGyms: Number(
                            summary.total_gyms || 0
                        ),

                        activeGyms: Number(
                            summary.active_gyms || 0
                        ),

                        disabledGyms: Number(
                            summary.disabled_gyms || 0
                        )
                    },

                    gyms,

                    pagination: {

                        page,

                        limit,

                        total,

                        totalPages:
                            Math.ceil(total / limit)
                    }
                });

            } catch (error) {

                console.error(
                    'Admin gym oversight:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        'Unable to load gym information.'
                });
            }
        }
    );
    
    // ==================================================
    // ADMIN - CREATE GYM
    //
    // POST /api/admin/gyms
    // ==================================================

    router.post(
        '/admin/gyms',
        authenticateToken,

        async (req, res) => {

            // ==========================================
            // VERIFY ADMINISTRATOR
            // ==========================================

            const adminId = Number(req.user?.id);

            if (
                req.user?.role !== 'admin' ||
                req.user?.purpose === 'admin_password_change' ||
                !Number.isSafeInteger(adminId) ||
                adminId <= 0
            ) {

                return res.status(403).json({
                    success: false,
                    message: 'Administrator access required.'
                });
            }

            const body = req.body;

            if (
                !body ||
                typeof body !== 'object' ||
                Array.isArray(body)
            ) {

                return res.status(400).json({
                    success: false,
                    message: 'Please supply gym information.'
                });
            }

            // ==========================================
            // VALIDATE TEXT FIELDS
            // ==========================================

            const maxLengths = {
                name: 150,
                description: 5000,
                addressLine1: 255,
                addressLine2: 255,
                city: 100,
                state: 100,
                postcode: 20,
                country: 100,
                phone: 30,
                email: 150,
                websiteUrl: 500,
                imageUrl: 500
            };

            const required = new Set([
                'name',
                'addressLine1',
                'city',
                'state'
            ]);

            const gym = {};

            for (
                const [field, max] of
                Object.entries(maxLengths)
            ) {

                const raw = body[field];

                if (
                    raw != null &&
                    typeof raw !== 'string'
                ) {

                    return res.status(400).json({
                        success: false,
                        message: `${field} must be text.`
                    });
                }

                const value =
                    typeof raw === 'string'
                        ? raw.trim()
                        : '';

                if (
                    required.has(field) &&
                    !value
                ) {

                    return res.status(400).json({
                        success: false,
                        message: `${field} is required.`
                    });
                }

                if (value.length > max) {

                    return res.status(400).json({
                        success: false,
                        message:
                            `${field} must be ${max} characters or fewer.`
                    });
                }

                gym[field] =
                    value ||
                    (
                        field === 'country'
                            ? 'Malaysia'
                            : null
                    );
            }

            // ==========================================
            // VALIDATE GYM COORDINATES
            // ==========================================

            function parseCoordinate(value) {

                if (
                    (
                        typeof value !== 'number' &&
                        typeof value !== 'string'
                    ) ||
                    String(value).trim() === ''
                ) {
                    return NaN;
                }

                return Number(value);
            }

            const latitude =
                parseCoordinate(body.latitude);

            const longitude =
                parseCoordinate(body.longitude);

            if (
                !Number.isFinite(latitude) ||
                latitude < -90 ||
                latitude > 90 ||

                !Number.isFinite(longitude) ||
                longitude < -180 ||
                longitude > 180
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        'Valid latitude (-90 to 90) and longitude (-180 to 180) are required.'
                });
            }

            // ==========================================
            // VALIDATE OPTIONAL EMAIL
            // ==========================================

            if (
                gym.email &&
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gym.email)
            ) {

                return res.status(400).json({
                    success: false,
                    message: 'Invalid gym contact email.'
                });
            }

            // ==========================================
            // VALIDATE OPTIONAL URLS
            // ==========================================

            for (
                const field of ['websiteUrl', 'imageUrl']
            ) {

                if (gym[field]) {

                    try {

                        const url =
                            new URL(gym[field]);

                        if (
                            !['http:', 'https:'].includes(
                                url.protocol
                            )
                        ) {
                            throw new Error(
                                'Invalid URL protocol.'
                            );
                        }

                    } catch {

                        return res.status(400).json({
                            success: false,
                            message:
                                `${field} must be a valid http or https URL.`
                        });
                    }
                }
            }

            // ==========================================
            // OPTIONAL OPENING HOURS
            // ==========================================

            let openingHours = null;

            if (body.openingHours != null) {

                if (
                    typeof body.openingHours !== 'object' ||
                    Array.isArray(body.openingHours)
                ) {

                    return res.status(400).json({
                        success: false,
                        message:
                            'openingHours must be an object.'
                    });
                }

                openingHours =
                    JSON.stringify(body.openingHours);

                if (openingHours.length > 5000) {

                    return res.status(400).json({
                        success: false,
                        message: 'openingHours is too long.'
                    });
                }
            }

            // ==========================================
            // OPTIONAL AMENITIES
            // ==========================================

            let amenities = null;

            if (body.amenities != null) {

                if (
                    !Array.isArray(body.amenities) ||
                    body.amenities.length > 30 ||
                    body.amenities.some(
                        item =>
                            typeof item !== 'string' ||
                            !item.trim() ||
                            item.trim().length > 100
                    )
                ) {

                    return res.status(400).json({
                        success: false,
                        message:
                            'amenities must be an array of up to 30 short labels.'
                    });
                }

                amenities = JSON.stringify(
                    body.amenities.map(
                        item => item.trim()
                    )
                );
            }

            try {

                // ======================================
                // VERIFY ADMIN ACCOUNT IN MYSQL
                // ======================================

                const admins = await query(
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

                if (!admins.length) {

                    return res.status(403).json({
                        success: false,
                        message:
                            'Administrator access has been revoked.'
                    });
                }

                // ======================================
                // INSERT NEW GYM INTO MYSQL
                //
                // New gyms are ACTIVE automatically.
                // ======================================

                const result = await query(
                    `
                    INSERT INTO gyms
                    (
                        name,
                        description,

                        address_line1,
                        address_line2,

                        city,
                        state,
                        postcode,
                        country,

                        latitude,
                        longitude,

                        phone,
                        email,
                        website_url,

                        opening_hours,
                        amenities,
                        image_url,

                        is_active,
                        created_by_admin_id
                    )

                    VALUES
                    (
                        ?, ?, ?, ?,
                        ?, ?, ?, ?,
                        ?, ?,
                        ?, ?, ?,
                        ?, ?, ?,
                        1, ?
                    )
                    `,
                    [
                        gym.name,
                        gym.description,

                        gym.addressLine1,
                        gym.addressLine2,

                        gym.city,
                        gym.state,
                        gym.postcode,
                        gym.country,

                        latitude,
                        longitude,

                        gym.phone,
                        gym.email,
                        gym.websiteUrl,

                        openingHours,
                        amenities,
                        gym.imageUrl,

                        adminId
                    ]
                );

                // ======================================
                // SUCCESS
                // ======================================

                return res.status(201).json({

                    success: true,

                    message:
                        'Gym created successfully.',

                    gym: {
                        id: Number(result.insertId),
                        name: gym.name,
                        isActive: true
                    }
                });

            } catch (error) {

                console.error(
                    'Admin create gym:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        'Unable to create gym.'
                });
            }
        }
    );
    
    // ==================================================
    // ADMIN - ENABLE OR DISABLE A GYM
    //
    // PATCH /api/admin/gyms/:id/status
    //
    // Body:
    // { isActive: true }
    // OR
    // { isActive: false }
    // ==================================================

    router.patch(
        '/admin/gyms/:id/status',
        authenticateToken,

        async (req, res) => {

            const adminId = Number(req.user?.id);

            const gymIdText = String(req.params.id);
            const gymId = Number(gymIdText);

            const desiredStatus = req.body?.isActive;

            // ==========================================
            // VERIFY ADMINISTRATOR
            // ==========================================

            if (
                req.user?.role !== 'admin' ||
                req.user?.purpose ===
                    'admin_password_change' ||
                !Number.isSafeInteger(adminId) ||
                adminId <= 0
            ) {

                return res.status(403).json({
                    success: false,
                    message:
                        'Administrator access required.'
                });
            }

            // ==========================================
            // VALIDATE GYM ID
            // ==========================================

            if (
                !/^[1-9]\d*$/.test(gymIdText) ||
                !Number.isSafeInteger(gymId)
            ) {

                return res.status(400).json({
                    success: false,
                    message: 'Invalid gym ID.'
                });
            }

            // ==========================================
            // VALIDATE STATUS
            // ==========================================

            if (typeof desiredStatus !== 'boolean') {

                return res.status(400).json({
                    success: false,
                    message:
                        'isActive must be true or false.'
                });
            }

            
            // ==================================================
            // SAFE GYM STATUS UPDATE
            // ==================================================

            let bookingDb = null;
            let transactionStarted = false;

            try {

                // ==============================================
                // VERIFY ACTIVE ADMINISTRATOR
                // ==============================================

                const admins = await query(
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

                if (!admins.length) {

                    return res.status(403).json({
                        success: false,
                        message:
                            'Administrator access has been revoked.'
                    });
                }

                // ==============================================
                // USE DEDICATED DATABASE CONNECTION
                // ==============================================

                bookingDb = await bookingPool
                    .promise()
                    .getConnection();

                await bookingDb.beginTransaction();

                transactionStarted = true;

                // ==============================================
                // LOCK GYM RECORD
                // ==============================================

                const [gyms] = await bookingDb.query(
                    `
                    SELECT
                        id,
                        name,
                        is_active
                    FROM gyms
                    WHERE id = ?
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [gymId]
                );

                if (!gyms.length) {

                    await bookingDb.rollback();
                    transactionStarted = false;

                    return res.status(404).json({
                        success: false,
                        message: 'Gym not found.'
                    });
                }

                const gym = gyms[0];

                const wasActive =
                    Number(gym.is_active) === 1;

                // ==============================================
                // NO CHANGE NEEDED
                // ==============================================

                if (wasActive === desiredStatus) {

                    await bookingDb.commit();
                    transactionStarted = false;

                    return res.json({
                        success: true,

                        changed: false,

                        message:
                            'Gym already has this status.',

                        gym: {
                            id: gymId,
                            name: gym.name,
                            isActive: wasActive
                        }
                    });
                }

                // ==============================================
                // IF DISABLING:
                // CHECK FOR ACTIVE STRIPE CHECKOUT
                // ==============================================

                if (!desiredStatus) {

                    const [activeCheckouts] =
                        await bookingDb.query(
                            `
                            SELECT id
                            FROM coach_bookings
                            WHERE gym_id = ?
                              AND status = 'pending_payment'
                              AND payment_status IN (
                                  'unpaid',
                                  'pending'
                              )
                              AND stripe_checkout_session_id
                                  IS NOT NULL
                              AND hold_expires_at > NOW()
                            LIMIT 1
                            FOR UPDATE
                            `,
                            [gymId]
                        );

                    // ==========================================
                    // DO NOT DISABLE DURING ACTIVE PAYMENT
                    // ==========================================

                    if (activeCheckouts.length > 0) {

                        await bookingDb.rollback();
                        transactionStarted = false;

                        return res.status(409).json({
                            success: false,

                            message:
                                'This gym has a payment checkout in progress. ' +
                                'Please wait for payment or checkout expiry ' +
                                'before disabling the gym.'
                        });
                    }
                }

                // ==============================================
                // UPDATE GYM STATUS ONLY
                // ==============================================

                const [result] = await bookingDb.query(
                    `
                    UPDATE gyms
                    SET is_active = ?
                    WHERE id = ?
                      AND is_active = ?
                    `,
                    [
                        desiredStatus ? 1 : 0,
                        gymId,
                        wasActive ? 1 : 0
                    ]
                );

                if (result.affectedRows !== 1) {

                    await bookingDb.rollback();
                    transactionStarted = false;

                    return res.status(409).json({
                        success: false,
                        message:
                            'Gym status changed. Refresh and try again.'
                    });
                }

                // ==============================================
                // COMMIT STATUS CHANGE
                // ==============================================

                await bookingDb.commit();
                transactionStarted = false;

                return res.json({
                    success: true,

                    changed: true,

                    message: desiredStatus
                        ? 'Gym enabled successfully.'
                        : 'Gym disabled successfully.',

                    gym: {
                        id: gymId,
                        name: gym.name,
                        isActive: desiredStatus
                    }
                });

            } catch (error) {

                if (
                    bookingDb &&
                    transactionStarted
                ) {

                    try {
                        await bookingDb.rollback();

                    } catch (rollbackError) {

                        console.error(
                            'Gym status rollback:',
                            rollbackError
                        );
                    }
                }

                console.error(
                    'Admin gym status update:',
                    error
                );

                return res.status(500).json({
                    success: false,
                    message:
                        'Unable to update gym status.'
                });

            } finally {

                if (bookingDb) {
                    bookingDb.release();
                }
            }

        }
    );



    return router;
}

// ======================================================
// EXPORT ROUTER
// ======================================================

module.exports = createAdminGymRouter;
