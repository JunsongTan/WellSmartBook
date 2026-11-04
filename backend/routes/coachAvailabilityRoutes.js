const express =
    require('express');

const {
    normalizeDateOnly
} =
    require('../helpers/generalHelpers');


// ======================================================
// COACH AVAILABILITY ROUTES
// ======================================================

function createCoachAvailabilityRouter({
    db,
    authenticateToken,
    authenticateActiveCoach
}) {

    const router =
        express.Router();


    // ======================================================
    // COACH AVAILABILITY
    // ======================================================


    // ======================================================
    // GET COACH'S OWN AVAILABILITY
    // ======================================================

    router.get(
        '/coach/availability',

        authenticateToken,
        authenticateActiveCoach,

        (
            req,
            res
        ) => {

            db.query(
                `
                SELECT
                    car.id,
                    car.coach_id,
                    car.gym_id,
                    car.availability_type,
                    car.day_of_week,
                    car.specific_date,
                    car.start_time,
                    car.end_time,
                    car.slot_duration_minutes,
                    car.is_active,
                    car.created_at,
                    car.updated_at,

                    g.name AS gym_name,
                    g.address_line1,
                    g.address_line2,
                    g.city,
                    g.state,
                    g.postcode,
                    g.country,
                    g.latitude,
                    g.longitude

                FROM coach_availability_rules car

                INNER JOIN gyms g
                    ON g.id = car.gym_id

                WHERE car.coach_id = ?
                AND car.is_active = 1

                ORDER BY
                    car.specific_date ASC,
                    car.day_of_week ASC,
                    car.start_time ASC
                `,
                [
                    req.coach.id
                ],

                (
                    error,
                    results
                ) => {

                    if (error) {

                        console.error(
                            'Load coach availability:',
                            error
                        );


                        return res
                            .status(500)
                            .json({
                                success: false,

                                message:
                                    'Unable to load coach availability.'
                            });
                    }


                    return res.json({
                        success: true,

                        availability:
                            results.map(
                                (
                                    item
                                ) => ({

                                    id:
                                        item.id,

                                    coachId:
                                        item.coach_id,

                                    gymId:
                                        item.gym_id,

                                    gymName:
                                        item.gym_name,

                                    availabilityType:
                                        item.availability_type,

                                    dayOfWeek:
                                        item.day_of_week,

                                    specificDate:
                                        normalizeDateOnly(
                                            item.specific_date
                                        ),

                                    startTime:
                                        item.start_time,

                                    endTime:
                                        item.end_time,

                                    slotDurationMinutes:
                                        Number(
                                            item.slot_duration_minutes
                                        ),

                                    isActive:
                                        Boolean(
                                            item.is_active
                                        ),

                                    gym: {

                                        name:
                                            item.gym_name,

                                        address: [
                                            item.address_line1,
                                            item.address_line2,
                                            item.postcode,
                                            item.city,
                                            item.state,
                                            item.country
                                        ]
                                            .filter(Boolean)
                                            .join(', '),

                                        latitude:
                                            Number(
                                                item.latitude
                                            ),

                                        longitude:
                                            Number(
                                                item.longitude
                                            )
                                    }
                                })
                            )
                    });
                }
            );
        }
    );


    // ======================================================
    // ADD COACH AVAILABILITY
    // ======================================================

    router.post(
        '/coach/availability',

        authenticateToken,
        authenticateActiveCoach,

        (
            req,
            res
        ) => {

            const {
                gymId,
                availabilityType,
                dayOfWeek,
                specificDate,
                startTime,
                endTime,
                slotDurationMinutes
            } =
                req.body;


            const numericGymId =
                Number(
                    gymId
                );


            const duration =
                Number(
                    slotDurationMinutes ||
                    60
                );


            // ----------------------------------------------
            // BASIC VALIDATION
            // ----------------------------------------------

            if (
                !Number.isInteger(
                    numericGymId
                ) ||
                numericGymId <= 0
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Please select a valid gym.'
                    });
            }


            if (
                ![
                    'weekly',
                    'specific_date'
                ].includes(
                    availabilityType
                )
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Invalid availability type.'
                    });
            }


            if (
                !startTime ||
                !endTime
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Start time and end time are required.'
                    });
            }


            if (
                startTime >=
                endTime
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'End time must be later than start time.'
                    });
            }


            if (
                !Number.isInteger(
                    duration
                ) ||
                duration < 15 ||
                duration > 240
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Session duration must be between 15 and 240 minutes.'
                    });
            }


            // ----------------------------------------------
            // WEEKLY
            // ----------------------------------------------

            const validDaysOfWeek = [
                'monday',
                'tuesday',
                'wednesday',
                'thursday',
                'friday',
                'saturday',
                'sunday'
            ];


            const normalizedDayOfWeek =
                String(
                    dayOfWeek || ''
                )
                    .trim()
                    .toLowerCase();


            if (
                availabilityType ===
                'weekly'
            ) {

                if (
                    !validDaysOfWeek.includes(
                        normalizedDayOfWeek
                    )
                ) {

                    return res
                        .status(400)
                        .json({
                            success: false,

                            message:
                                'Please select a valid day of the week.'
                        });
                }
            }


            // ----------------------------------------------
            // SPECIFIC DATE
            // ----------------------------------------------

            if (
                availabilityType ===
                'specific_date' &&
                !specificDate
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Please select a specific date.'
                    });
            }


            // ----------------------------------------------
            // MAKE SURE GYM EXISTS
            // ----------------------------------------------

            db.query(
                `
                SELECT id
                FROM gyms

                WHERE id = ?
                AND is_active = 1

                LIMIT 1
                `,
                [
                    numericGymId
                ],

                (
                    gymError,
                    gyms
                ) => {

                    if (
                        gymError
                    ) {

                        console.error(
                            'Availability gym check:',
                            gymError
                        );


                        return res
                            .status(500)
                            .json({
                                success: false,

                                message:
                                    'Unable to validate gym.'
                            });
                    }


                    if (
                        gyms.length === 0
                    ) {

                        return res
                            .status(404)
                            .json({
                                success: false,

                                message:
                                    'Gym is unavailable.'
                            });
                    }


                    // --------------------------------------
                    // CHECK DUPLICATE / OVERLAPPING TIME
                    // --------------------------------------

                    let conflictSql;

                    let conflictValues;


                    if (
                        availabilityType ===
                        'weekly'
                    ) {

                        conflictSql = `
                            SELECT id
                            FROM coach_availability_rules

                            WHERE coach_id = ?
                            AND gym_id = ?
                            AND availability_type = 'weekly'
                            AND day_of_week = ?
                            AND is_active = 1

                            AND start_time < ?
                            AND end_time > ?

                            LIMIT 1
                        `;


                        conflictValues = [
                            req.coach.id,
                            numericGymId,
                            normalizedDayOfWeek,
                            endTime,
                            startTime
                        ];

                    } else {

                        conflictSql = `
                            SELECT id
                            FROM coach_availability_rules

                            WHERE coach_id = ?
                            AND gym_id = ?
                            AND availability_type = 'specific_date'
                            AND specific_date = ?
                            AND is_active = 1

                            AND start_time < ?
                            AND end_time > ?

                            LIMIT 1
                        `;


                        conflictValues = [
                            req.coach.id,
                            numericGymId,
                            specificDate,
                            endTime,
                            startTime
                        ];
                    }


                    db.query(
                        conflictSql,
                        conflictValues,

                        (
                            conflictError,
                            conflicts
                        ) => {

                            if (
                                conflictError
                            ) {

                                console.error(
                                    'Availability conflict check:',
                                    conflictError
                                );


                                return res
                                    .status(500)
                                    .json({
                                        success: false,

                                        message:
                                            'Unable to check existing availability.'
                                    });
                            }


                            if (
                                conflicts.length >
                                0
                            ) {

                                return res
                                    .status(409)
                                    .json({
                                        success: false,

                                        message:
                                            'This availability overlaps with an existing time.'
                                    });
                            }


                            // ----------------------------------
                            // SAVE
                            // ----------------------------------

                            db.query(
                                `
                                INSERT INTO coach_availability_rules
                                (
                                    coach_id,
                                    gym_id,
                                    availability_type,
                                    day_of_week,
                                    specific_date,
                                    start_time,
                                    end_time,
                                    slot_duration_minutes,
                                    is_active
                                )
                                VALUES
                                (
                                    ?, ?, ?, ?, ?, ?, ?, ?, 1
                                )
                                `,
                                [
                                    req.coach.id,

                                    numericGymId,

                                    availabilityType,

                                    availabilityType ===
                                    'weekly'
                                        ? normalizedDayOfWeek
                                        : null,

                                    availabilityType ===
                                    'specific_date'
                                        ? specificDate
                                        : null,

                                    startTime,

                                    endTime,

                                    duration
                                ],

                                (
                                    insertError,
                                    result
                                ) => {

                                    if (
                                        insertError
                                    ) {

                                        console.error(
                                            'Add coach availability:',
                                            insertError
                                        );


                                        return res
                                            .status(500)
                                            .json({
                                                success: false,

                                                message:
                                                    'Unable to save availability.'
                                            });
                                    }


                                    return res
                                        .status(201)
                                        .json({
                                            success: true,

                                            message:
                                                'Availability published successfully.',

                                            availabilityId:
                                                result.insertId
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
    // SYNC WEEKLY COACH AVAILABILITY
    //
    // This endpoint manages the coach's recurring weekdays
    // for ONE gym.
    //
    // Example:
    //
    // Current database:
    // Monday    active
    // Tuesday   active
    // Wednesday active
    //
    // Coach saves:
    // Tuesday
    // Wednesday
    // Friday
    //
    // Result:
    // Monday    -> inactive
    // Tuesday   -> active
    // Wednesday -> active
    // Friday    -> active
    //
    // Same availability at OTHER gyms is not affected.
    // ======================================================

    router.put(
        '/coach/availability/weekly',

        authenticateToken,
        authenticateActiveCoach,

        (
            req,
            res
        ) => {

            const {
                gymId,
                days,
                startTime,
                endTime,
                slotDurationMinutes
            } =
                req.body;


            // ==============================================
            // VALID DAYS
            // ==============================================

            const validDays = [
                'monday',
                'tuesday',
                'wednesday',
                'thursday',
                'friday',
                'saturday',
                'sunday'
            ];


            // ==============================================
            // GYM ID
            // ==============================================

            const numericGymId =
                Number(
                    gymId
                );


            if (
                !Number.isInteger(
                    numericGymId
                ) ||
                numericGymId <= 0
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Please select a valid gym.'
                    });
            }


            // ==============================================
            // DAYS MUST BE ARRAY
            //
            // [] is allowed.
            //
            // An empty array means:
            // remove all recurring weekly availability
            // for this coach at this gym.
            // ==============================================

            if (
                !Array.isArray(
                    days
                )
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Weekdays must be provided as an array.'
                    });
            }


            // ==============================================
            // NORMALISE DAYS
            // ==============================================

            const normalizedDays =
                [
                    ...new Set(
                        days
                            .map(
                                (
                                    day
                                ) =>
                                    String(
                                        day || ''
                                    )
                                        .trim()
                                        .toLowerCase()
                            )
                    )
                ];


            // ==============================================
            // VALIDATE DAYS
            // ==============================================

            const invalidDay =
                normalizedDays.find(
                    (
                        day
                    ) =>
                        !validDays.includes(
                            day
                        )
                );


            if (
                invalidDay
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'One or more selected weekdays are invalid.'
                    });
            }


            // ==============================================
            // DURATION
            // ==============================================

            const duration =
                Number(
                    slotDurationMinutes ||
                    60
                );


            if (
                !Number.isInteger(
                    duration
                ) ||
                duration < 15 ||
                duration > 240
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Session duration must be between 15 and 240 minutes.'
                    });
            }


            // ==============================================
            // TIME VALIDATION
            //
            // Time is still required even when days = [].
            // This keeps frontend payload consistent.
            // ==============================================

            const timePattern =
                /^([01]\d|2[0-3]):[0-5]\d$/;


            if (
                !timePattern.test(
                    String(
                        startTime || ''
                    )
                ) ||
                !timePattern.test(
                    String(
                        endTime || ''
                    )
                )
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Please provide valid start and end times.'
                    });
            }


            // ==============================================
            // COMPARE TIME SAFELY
            // ==============================================

            function timeToMinutes(
                value
            ) {

                const [
                    hours,
                    minutes
                ] =
                    value
                        .split(':')
                        .map(
                            Number
                        );


                return (
                    hours *
                    60
                ) +
                    minutes;
            }


            if (
                timeToMinutes(
                    startTime
                ) >=
                timeToMinutes(
                    endTime
                )
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'End time must be later than start time.'
                    });
            }


            // ==============================================
            // CHECK ACTIVE GYM
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
                    numericGymId
                ],

                (
                    gymError,
                    gyms
                ) => {

                    if (
                        gymError
                    ) {

                        console.error(
                            'Weekly availability gym check:',
                            gymError
                        );


                        return res
                            .status(500)
                            .json({
                                success: false,

                                message:
                                    'Unable to validate gym.'
                            });
                    }


                    if (
                        gyms.length === 0
                    ) {

                        return res
                            .status(404)
                            .json({
                                success: false,

                                message:
                                    'Gym facility is unavailable.'
                            });
                    }


                    // ======================================
                    // START TRANSACTION
                    // ======================================

                    db.beginTransaction(
                        (
                            transactionError
                        ) => {

                            if (
                                transactionError
                            ) {

                                console.error(
                                    'Weekly availability transaction:',
                                    transactionError
                                );


                                return res
                                    .status(500)
                                    .json({
                                        success: false,

                                        message:
                                            'Unable to update working hours.'
                                    });
                            }


                            // ==================================
                            // FIRST:
                            // DISABLE CURRENT WEEKLY RULES
                            //
                            // Only this coach + this gym.
                            //
                            // Specific-date availability is NOT
                            // touched.
                            // ==================================

                            db.query(
                                `
                                UPDATE coach_availability_rules

                                SET is_active = 0

                                WHERE coach_id = ?
                                AND gym_id = ?
                                AND availability_type = 'weekly'
                                AND is_active = 1
                                `,
                                [
                                    req.coach.id,
                                    numericGymId
                                ],

                                (
                                    disableError
                                ) => {

                                    if (
                                        disableError
                                    ) {

                                        return db.rollback(
                                            () => {

                                                console.error(
                                                    'Disable old weekly availability:',
                                                    disableError
                                                );


                                                return res
                                                    .status(500)
                                                    .json({
                                                        success: false,

                                                        message:
                                                            'Unable to update existing working hours.'
                                                    });
                                            }
                                        );
                                    }


                                    // ==========================
                                    // IF NO DAYS SELECTED
                                    //
                                    // All weekly availability for
                                    // this gym has now been
                                    // removed.
                                    // ==========================

                                    if (
                                        normalizedDays.length ===
                                        0
                                    ) {

                                        return db.commit(
                                            (
                                                commitError
                                            ) => {

                                                if (
                                                    commitError
                                                ) {

                                                    return db.rollback(
                                                        () => {

                                                            console.error(
                                                                'Weekly availability commit:',
                                                                commitError
                                                            );


                                                            return res
                                                                .status(500)
                                                                .json({
                                                                    success: false,

                                                                    message:
                                                                        'Unable to save working hours.'
                                                                });
                                                        }
                                                    );
                                                }


                                                return res.json({
                                                    success: true,

                                                    message:
                                                        'Weekly availability removed.',

                                                    gymId:
                                                        numericGymId,

                                                    days:
                                                        []
                                                });
                                            }
                                        );
                                    }


                                    // ==========================
                                    // PROCESS EACH SELECTED DAY
                                    // ==========================

                                    let currentIndex =
                                        0;


                                    const savedIds =
                                        [];


                                    function saveNextDay() {

                                        // ======================
                                        // ALL DAYS FINISHED
                                        // ======================

                                        if (
                                            currentIndex >=
                                            normalizedDays.length
                                        ) {

                                            return db.commit(
                                                (
                                                    commitError
                                                ) => {

                                                    if (
                                                        commitError
                                                    ) {

                                                        return db.rollback(
                                                            () => {

                                                                console.error(
                                                                    'Weekly availability commit:',
                                                                    commitError
                                                                );


                                                                return res
                                                                    .status(500)
                                                                    .json({
                                                                        success: false,

                                                                        message:
                                                                            'Unable to save working hours.'
                                                                    });
                                                            }
                                                        );
                                                    }


                                                    // ==================
                                                    // RETURN UPDATED DATA
                                                    // ==================

                                                    db.query(
                                                        `
                                                        SELECT
                                                            id,
                                                            coach_id,
                                                            gym_id,
                                                            availability_type,
                                                            day_of_week,
                                                            specific_date,
                                                            start_time,
                                                            end_time,
                                                            slot_duration_minutes,
                                                            is_active

                                                        FROM coach_availability_rules

                                                        WHERE coach_id = ?
                                                        AND gym_id = ?
                                                        AND availability_type = 'weekly'
                                                        AND is_active = 1

                                                        ORDER BY
                                                            FIELD(
                                                                day_of_week,
                                                                'monday',
                                                                'tuesday',
                                                                'wednesday',
                                                                'thursday',
                                                                'friday',
                                                                'saturday',
                                                                'sunday'
                                                            )
                                                        `,
                                                        [
                                                            req.coach.id,
                                                            numericGymId
                                                        ],

                                                        (
                                                            reloadError,
                                                            updatedRules
                                                        ) => {

                                                            if (
                                                                reloadError
                                                            ) {

                                                                console.error(
                                                                    'Reload weekly availability:',
                                                                    reloadError
                                                                );


                                                                return res.json({
                                                                    success: true,

                                                                    message:
                                                                        'Working hours updated successfully.',

                                                                    gymId:
                                                                        numericGymId,

                                                                    days:
                                                                        normalizedDays
                                                                });
                                                            }


                                                            return res.json({
                                                                success: true,

                                                                message:
                                                                    'Working hours updated successfully.',

                                                                gymId:
                                                                    numericGymId,

                                                                days:
                                                                    normalizedDays,

                                                                availability:
                                                                    updatedRules.map(
                                                                        (
                                                                            rule
                                                                        ) => ({

                                                                            id:
                                                                                rule.id,

                                                                            gymId:
                                                                                rule.gym_id,

                                                                            availabilityType:
                                                                                rule.availability_type,

                                                                            dayOfWeek:
                                                                                rule.day_of_week,

                                                                            startTime:
                                                                                rule.start_time,

                                                                            endTime:
                                                                                rule.end_time,

                                                                            slotDurationMinutes:
                                                                                Number(
                                                                                    rule.slot_duration_minutes
                                                                                ),

                                                                            isActive:
                                                                                Boolean(
                                                                                    rule.is_active
                                                                                )
                                                                        })
                                                                    )
                                                            });
                                                        }
                                                    );
                                                }
                                            );
                                        }


                                        const day =
                                            normalizedDays[
                                                currentIndex
                                            ];


                                        currentIndex +=
                                            1;


                                        // ======================
                                        // CHECK WHETHER THE SAME
                                        // RULE ALREADY EXISTS
                                        //
                                        // This includes inactive
                                        // old rows.
                                        // ======================

                                        db.query(
                                            `
                                            SELECT id

                                            FROM coach_availability_rules

                                            WHERE coach_id = ?
                                            AND gym_id = ?
                                            AND availability_type = 'weekly'
                                            AND day_of_week = ?
                                            AND specific_date IS NULL
                                            AND start_time = ?
                                            AND end_time = ?
                                            AND slot_duration_minutes = ?

                                            ORDER BY id DESC

                                            LIMIT 1
                                            `,
                                            [
                                                req.coach.id,
                                                numericGymId,
                                                day,
                                                startTime,
                                                endTime,
                                                duration
                                            ],

                                            (
                                                existingError,
                                                existingRows
                                            ) => {

                                                if (
                                                    existingError
                                                ) {

                                                    return db.rollback(
                                                        () => {

                                                            console.error(
                                                                'Find existing weekly rule:',
                                                                existingError
                                                            );


                                                            return res
                                                                .status(500)
                                                                .json({
                                                                    success: false,

                                                                    message:
                                                                        'Unable to update working hours.'
                                                                });
                                                        }
                                                    );
                                                }


                                                // ==================
                                                // REACTIVATE OLD RULE
                                                // ==================

                                                if (
                                                    existingRows.length >
                                                    0
                                                ) {

                                                    const existingId =
                                                        existingRows[0]
                                                            .id;


                                                    return db.query(
                                                        `
                                                        UPDATE coach_availability_rules

                                                        SET
                                                            is_active = 1,
                                                            updated_at = CURRENT_TIMESTAMP

                                                        WHERE id = ?
                                                        `,
                                                        [
                                                            existingId
                                                        ],

                                                        (
                                                            reactivateError
                                                        ) => {

                                                            if (
                                                                reactivateError
                                                            ) {

                                                                return db.rollback(
                                                                    () => {

                                                                        console.error(
                                                                            'Reactivate weekly rule:',
                                                                            reactivateError
                                                                        );


                                                                        return res
                                                                            .status(500)
                                                                            .json({
                                                                                success: false,

                                                                                message:
                                                                                    'Unable to update working hours.'
                                                                            });
                                                                    }
                                                                );
                                                            }


                                                            savedIds.push(
                                                                existingId
                                                            );


                                                            saveNextDay();
                                                        }
                                                    );
                                                }


                                                // ==================
                                                // CREATE NEW RULE
                                                // ==================

                                                db.query(
                                                    `
                                                    INSERT INTO coach_availability_rules
                                                    (
                                                        coach_id,
                                                        gym_id,
                                                        availability_type,
                                                        day_of_week,
                                                        specific_date,
                                                        start_time,
                                                        end_time,
                                                        slot_duration_minutes,
                                                        is_active
                                                    )

                                                    VALUES
                                                    (
                                                        ?,
                                                        ?,
                                                        'weekly',
                                                        ?,
                                                        NULL,
                                                        ?,
                                                        ?,
                                                        ?,
                                                        1
                                                    )
                                                    `,
                                                    [
                                                        req.coach.id,
                                                        numericGymId,
                                                        day,
                                                        startTime,
                                                        endTime,
                                                        duration
                                                    ],

                                                    (
                                                        insertError,
                                                        insertResult
                                                    ) => {

                                                        if (
                                                            insertError
                                                        ) {

                                                            return db.rollback(
                                                                () => {

                                                                    console.error(
                                                                        'Insert weekly rule:',
                                                                        insertError
                                                                    );


                                                                    return res
                                                                        .status(500)
                                                                        .json({
                                                                            success: false,

                                                                            message:
                                                                                'Unable to create working hours.'
                                                                        });
                                                                }
                                                            );
                                                        }


                                                        savedIds.push(
                                                            insertResult.insertId
                                                        );


                                                        saveNextDay();
                                                    }
                                                );
                                            }
                                        );
                                    }


                                    // ==========================
                                    // START SAVING
                                    // ==========================

                                    saveNextDay();
                                }
                            );
                        }
                    );
                }
            );
        }
    );

    // ======================================================
    // DELETE / DISABLE COACH AVAILABILITY
    // ======================================================

    router.delete(
        '/coach/availability/:id',

        authenticateToken,
        authenticateActiveCoach,

        (
            req,
            res
        ) => {

            const availabilityId =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(
                    availabilityId
                ) ||
                availabilityId <= 0
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Invalid availability ID.'
                    });
            }


            db.query(
                `
                UPDATE coach_availability_rules

                SET is_active = 0

                WHERE id = ?
                AND coach_id = ?
                AND is_active = 1
                `,
                [
                    availabilityId,
                    req.coach.id
                ],

                (
                    error,
                    result
                ) => {

                    if (error) {

                        console.error(
                            'Delete availability:',
                            error
                        );


                        return res
                            .status(500)
                            .json({
                                success: false,

                                message:
                                    'Unable to remove availability.'
                            });
                    }


                    if (
                        result.affectedRows ===
                        0
                    ) {

                        return res
                            .status(404)
                            .json({
                                success: false,

                                message:
                                    'Availability not found.'
                            });
                    }


                    return res.json({
                        success: true,

                        message:
                            'Availability removed successfully.'
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
    createCoachAvailabilityRouter;