
const express = require('express');

// ======================================================
// COACH PROFILE SETTINGS ROUTES
// ======================================================

function createCoachSettingsRouter({
    db,
    bookingPool,
    authenticateToken,
    authenticateActiveCoach
}) {
    const router = express.Router();

    // ==================================================
    // PARSE SPECIALTIES FROM MYSQL
    // ==================================================

    function readSpecialties(raw) {
        try {
            const value = JSON.parse(raw || '[]');

            return Array.isArray(value)
                ? value
                    .filter(item => typeof item === 'string')
                    .slice(0, 10)
                : [];
        } catch {
            return [];
        }
    }

    // ==================================================
    // GET COACH SETTINGS
    // ==================================================

    router.get(
        '/coach/settings',
        authenticateToken,
        authenticateActiveCoach,

        async (req, res) => {
            try {
                const coachId = Number(req.coach?.id);
                const userId = Number(req.user?.id);

                const [rows] = await db.promise().execute(
                    `
                    SELECT
                        u.full_name AS fullName,
                        u.email,
                        u.profile_picture AS profilePicture,

                        cp.phone,
                        cp.specialization,
                        cp.bio,
                        cp.years_experience AS yearsExperience,
                        cp.default_session_price AS defaultSessionPrice,

                        extra.display_name AS displayName,
                        extra.biography,
                        extra.specialties_json AS specialtiesJson

                    FROM coach_profiles cp

                    INNER JOIN users u
                        ON u.id = cp.user_id

                    LEFT JOIN coach_portal_profiles extra
                        ON extra.coach_id = cp.id

                    WHERE cp.id = ?
                      AND cp.user_id = ?

                    LIMIT 1
                    `,
                    [coachId, userId]
                );

                if (!rows.length) {
                    return res.status(404).json({
                        success: false,
                        message: 'Coach profile not found.'
                    });
                }

                const row = rows[0];

                return res.json({
                    success: true,

                    coach: {
                        displayName:
                            row.displayName || row.fullName || '',

                        email: row.email,

                        profilePicture: row.profilePicture,

                        phone: row.phone || '',

                        specialization:
                            row.specialization || '',

                        biography:
                            row.biography ?? row.bio ?? '',

                        specialties:
                            readSpecialties(row.specialtiesJson),

                        yearsExperience:
                            Number(row.yearsExperience || 0),

                        defaultSessionPrice:
                            Number(row.defaultSessionPrice || 0)
                    }
                });

            } catch (error) {
                console.error('Load coach settings:', error);

                return res.status(500).json({
                    success: false,
                    message: 'Unable to load coach settings.'
                });
            }
        }
    );

    // ==================================================
    // UPDATE COACH SETTINGS
    // ==================================================

    router.patch(
        '/coach/settings',
        authenticateToken,
        authenticateActiveCoach,

        async (req, res) => {
            const coachId = Number(req.coach?.id);
            const userId = Number(req.user?.id);
            const body = req.body || {};

            // ==========================================
            // INPUT VALUES
            // ==========================================

            const displayName =
                typeof body.displayName === 'string'
                    ? body.displayName.trim()
                    : '';

            const biography =
                typeof body.biography === 'string'
                    ? body.biography.trim()
                    : '';

            const specialization =
                typeof body.specialization === 'string'
                    ? body.specialization.trim()
                    : '';

            const yearsExperience =
                Number(body.yearsExperience);

            const defaultSessionPrice =
                Number(body.defaultSessionPrice);

            const rawSpecialties = body.specialties;

            // ==========================================
            // VALIDATION
            // ==========================================

            if (
                displayName.length < 2 ||
                displayName.length > 100
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Display name must contain 2–100 characters.'
                });
            }

            if (biography.length > 2000) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Biography cannot exceed 2,000 characters.'
                });
            }

            if (
                specialization.length < 2 ||
                specialization.length > 100
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Primary specialization must contain 2–100 characters.'
                });
            }

            if (
                !Number.isInteger(yearsExperience) ||
                yearsExperience < 0 ||
                yearsExperience > 70
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Experience must be between 0 and 70 years.'
                });
            }

            if (
                !Number.isFinite(defaultSessionPrice) ||
                defaultSessionPrice < 0 ||
                defaultSessionPrice > 10000 ||
                Math.abs(
                    defaultSessionPrice * 100 -
                    Math.round(defaultSessionPrice * 100)
                ) > 0.000001
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Session price must be between RM 0 and RM 10,000, with up to two decimal places.'
                });
            }

            if (
                !Array.isArray(rawSpecialties) ||
                rawSpecialties.length > 10 ||
                rawSpecialties.some(
                    item =>
                        typeof item !== 'string' ||
                        !item.trim() ||
                        item.trim().length > 50
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        'Select up to 10 valid specialties (50 characters each).'
                });
            }

            const specialties = [
                ...new Set(
                    rawSpecialties.map(item => item.trim())
                )
            ];

            // ==========================================
            // DATABASE TRANSACTION
            // ==========================================

            let connection;

            try {
                connection =
                    await bookingPool.promise().getConnection();

                await connection.beginTransaction();

                // Verify the logged-in coach owns the profile.

                const [owned] = await connection.execute(
                    `
                    SELECT id
                    FROM coach_profiles
                    WHERE id = ?
                      AND user_id = ?
                    FOR UPDATE
                    `,
                    [coachId, userId]
                );

                if (!owned.length) {
                    await connection.rollback();

                    return res.status(403).json({
                        success: false,
                        message: 'Coach profile not available.'
                    });
                }

                // ======================================
                // UPDATE COACH DISPLAY NAME
                // ==========================================

                await connection.execute(
                    `
                    UPDATE users
                    SET full_name = ?
                    WHERE id = ?
                      AND role = 'coach'
                    `,
                    [displayName, userId]
                );

                // ======================================
                // UPDATE EXISTING COACH PROFILE
                // ==========================================

                await connection.execute(
                    `
                    UPDATE coach_profiles
                    SET
                        specialization = ?,
                        bio = ?,
                        years_experience = ?,
                        default_session_price = ?
                    WHERE id = ?
                      AND user_id = ?
                    `,
                    [
                        specialization,
                        biography || null,
                        yearsExperience,
                        defaultSessionPrice,
                        coachId,
                        userId
                    ]
                );

                // ======================================
                // SAVE EXTRA COACH PROFILE DETAILS
                // ==========================================

                await connection.execute(
                    `
                    INSERT INTO coach_portal_profiles (
                        coach_id,
                        display_name,
                        biography,
                        specialties_json
                    )
                    VALUES (?, ?, ?, ?)

                    ON DUPLICATE KEY UPDATE
                        display_name = VALUES(display_name),
                        biography = VALUES(biography),
                        specialties_json = VALUES(specialties_json)
                    `,
                    [
                        coachId,
                        displayName,
                        biography || null,
                        JSON.stringify(specialties)
                    ]
                );

                // ======================================
                // SAVE ALL CHANGES
                // ==========================================

                await connection.commit();

                return res.json({
                    success: true,
                    message: 'Coach settings saved successfully.',

                    coach: {
                        displayName,
                        specialization,
                        biography,
                        specialties,
                        yearsExperience,
                        defaultSessionPrice
                    }
                });

            } catch (error) {

                if (connection) {
                    try {
                        await connection.rollback();
                    } catch (rollbackError) {
                        console.error(
                            'Rollback coach settings:',
                            rollbackError
                        );
                    }
                }

                console.error('Save coach settings:', error);

                return res.status(500).json({
                    success: false,
                    message: 'Unable to save coach settings.'
                });

            } finally {
                if (connection) {
                    connection.release();
                }
            }
        }
    );

    return router;
}

// ======================================================
// EXPORT
// ======================================================

module.exports = createCoachSettingsRouter;
