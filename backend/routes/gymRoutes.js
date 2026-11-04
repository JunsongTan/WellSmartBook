const express =
    require('express');

const {
    formatGymForClient
} =
    require('../helpers/bookingHelpers');


// ======================================================
// GYM ROUTES
// ======================================================

function createGymRouter({
    db,
    authenticateToken
}) {

    const router =
        express.Router();


    router.get(
        '/gyms',

        authenticateToken,

        (
            req,
            res
        ) => {

            const latitude =
                req.query.latitude !== undefined
                    ? Number(
                        req.query.latitude
                    )
                    : null;


            const longitude =
                req.query.longitude !== undefined
                    ? Number(
                        req.query.longitude
                    )
                    : null;


            const hasUserLocation =
                Number.isFinite(
                    latitude
                ) &&
                Number.isFinite(
                    longitude
                );


            db.query(
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

                    opening_hours,
                    amenities,

                    image_url,
                    is_active

                FROM gyms

                WHERE is_active = 1

                ORDER BY name ASC
                `,

                (
                    error,
                    results
                ) => {

                    if (error) {

                        console.error(
                            'Load gyms error:',
                            error
                        );


                        return res
                            .status(500)
                            .json({
                                success: false,

                                message:
                                    'Unable to load gym facilities.'
                            });
                    }


                    let gyms =
                        results.map(
                            (
                                gym
                            ) =>
                                formatGymForClient(
                                    gym,

                                    hasUserLocation
                                        ? latitude
                                        : null,

                                    hasUserLocation
                                        ? longitude
                                        : null
                                )
                        );


                    // --------------------------------------
                    // NEAREST FACILITY FIRST
                    // --------------------------------------

                    if (
                        hasUserLocation
                    ) {

                        gyms.sort(
                            (
                                first,
                                second
                            ) => {

                                if (
                                    first.distanceKm === null
                                ) {

                                    return 1;
                                }


                                if (
                                    second.distanceKm === null
                                ) {

                                    return -1;
                                }


                                return (
                                    first.distanceKm -
                                    second.distanceKm
                                );
                            }
                        );
                    }


                    return res.json({
                        success: true,

                        locationUsed:
                            hasUserLocation,

                        count:
                            gyms.length,

                        gyms
                    });
                }
            );
        }
    );


    // ======================================================
    // GET ONE ACTIVE GYM
    // ======================================================

    router.get(
        '/gyms/:id',

        authenticateToken,

        (
            req,
            res
        ) => {

            const gymId =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(
                    gymId
                ) ||
                gymId <= 0
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Invalid gym ID.'
                    });
            }


            db.query(
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

                    opening_hours,
                    amenities,

                    image_url,
                    is_active

                FROM gyms

                WHERE id = ?
                AND is_active = 1

                LIMIT 1
                `,

                [
                    gymId
                ],

                (
                    error,
                    results
                ) => {

                    if (error) {

                        console.error(
                            'Load gym detail error:',
                            error
                        );


                        return res
                            .status(500)
                            .json({
                                success: false,

                                message:
                                    'Unable to load gym information.'
                            });
                    }


                    if (
                        results.length === 0
                    ) {

                        return res
                            .status(404)
                            .json({
                                success: false,

                                message:
                                    'Gym facility not found.'
                            });
                    }


                    return res.json({
                        success: true,

                        gym:
                            formatGymForClient(
                                results[0]
                            )
                    });
                }
            );
        }
    );

    // ======================================================
    // USER BOOKING - COACHES AT A GYM
    // ======================================================

    router.get(
        '/gyms/:gymId/coaches',

        authenticateToken,

        (
            req,
            res
        ) => {

            const gymId =
                Number(
                    req.params.gymId
                );


            if (
                !Number.isInteger(
                    gymId
                ) ||
                gymId <= 0
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Invalid gym ID.'
                    });
            }


            // ==============================================
            // CHECK GYM
            // ==============================================

            db.query(
                `
                SELECT
                    id,
                    name

                FROM gyms

                WHERE id = ?
                AND is_active = 1

                LIMIT 1
                `,
                [
                    gymId
                ],

                (
                    gymError,
                    gyms
                ) => {

                    if (
                        gymError
                    ) {

                        console.error(
                            'Load booking gym:',
                            gymError
                        );


                        return res
                            .status(500)
                            .json({
                                success: false,

                                message:
                                    'Unable to load gym.'
                            });
                    }


                    if (
                        gyms.length ===
                        0
                    ) {

                        return res
                            .status(404)
                            .json({
                                success: false,

                                message:
                                    'Gym not found or unavailable.'
                            });
                    }


                    // ======================================
                    // FIND ACTIVE COACHES WHO HAVE
                    // AVAILABILITY AT THIS GYM
                    // ======================================

                    db.query(
                        `
                        SELECT DISTINCT

                            cp.id,
                            cp.user_id,

                            cp.specialization,
                            cp.bio,
                            cp.years_experience,

                            cp.service_area,

                            cp.default_session_price,
                            cp.currency,

                            u.full_name,
                            u.username,
                            u.profile_picture

                        FROM coach_profiles cp

                        INNER JOIN users u
                            ON u.id = cp.user_id

                        INNER JOIN coach_availability_rules car
                            ON car.coach_id = cp.id

                        WHERE car.gym_id = ?
                            AND car.is_active = 1

                            AND
                            (
                                car.availability_type = 'weekly'

                                OR

                                (
                                    car.availability_type = 'specific_date'
                                    AND car.specific_date >= CURDATE()
                                )
                            )

                            AND cp.is_active = 1
                            AND cp.approval_status = 'approved'

                            AND u.role = 'coach'

                        ORDER BY
                            u.full_name ASC
                        `,
                        [
                            gymId
                        ],

                        (
                            coachError,
                            coaches
                        ) => {

                            if (
                                coachError
                            ) {

                                console.error(
                                    'Load gym coaches:',
                                    coachError
                                );


                                return res
                                    .status(500)
                                    .json({
                                        success: false,

                                        message:
                                            'Unable to load coaches.'
                                    });
                            }


                            return res.json({
                                success: true,

                                gym: {
                                    id:
                                        gyms[0].id,

                                    name:
                                        gyms[0].name
                                },

                                coaches:
                                    coaches.map(
                                        (
                                            coach
                                        ) => ({

                                            id:
                                                coach.id,

                                            userId:
                                                coach.user_id,

                                            fullName:
                                                coach.full_name,

                                            username:
                                                coach.username,

                                            profilePicture:
                                                coach.profile_picture,

                                            specialization:
                                                coach.specialization,

                                            bio:
                                                coach.bio,

                                            yearsExperience:
                                                Number(
                                                    coach.years_experience ||
                                                    0
                                                ),

                                            serviceArea:
                                                coach.service_area,

                                            sessionPrice:
                                                Number(
                                                    coach.default_session_price ||
                                                    0
                                                ),

                                            currency:
                                                coach.currency
                                        })
                                    )
                            });
                        }
                    );
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
    createGymRouter;