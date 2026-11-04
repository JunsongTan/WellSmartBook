const express =
    require('express');

const {
    isValidDateOnly,
    getMalaysiaDateString,
    getMalaysiaCurrentMinutes,
    getDayOfWeekFromDate,
    bookingTimeToMinutes,
    minutesToBookingTime
} =
    require('../helpers/bookingHelpers');


// ======================================================
// COACH SLOT ROUTES
// ======================================================

function createCoachSlotRouter({
    db,
    authenticateToken
}) {

    const router =
        express.Router();


    // ======================================================
    // USER BOOKING - AVAILABLE COACH SLOTS
    // ======================================================

    router.get(
        '/coaches/:coachId/slots',

        authenticateToken,

        (
            req,
            res
        ) => {

            const coachId =
                Number(
                    req.params.coachId
                );


            const gymId =
                Number(
                    req.query.gymId
                );


            const date =
                String(
                    req.query.date ||
                    ''
                ).trim();


            // ==============================================
            // VALIDATE IDS
            // ==============================================

            if (
                !Number.isInteger(
                    coachId
                ) ||
                coachId <= 0
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Invalid coach ID.'
                    });
            }


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
            // VALIDATE DATE
            // ==============================================

            if (
                !isValidDateOnly(
                    date
                )
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Please provide a valid date in YYYY-MM-DD format.'
                    });
            }


            const malaysiaToday =
                getMalaysiaDateString();


            if (
                date <
                malaysiaToday
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'You cannot book a coaching session in the past.'
                    });
            }


            const dayOfWeek =
                getDayOfWeekFromDate(
                    date
                );


            // ==============================================
            // VALIDATE COACH + GYM
            // ==============================================

            db.query(
                `
                SELECT

                    cp.id AS coach_id,
                    cp.default_session_price,
                    cp.currency,

                    u.full_name,
                    u.profile_picture,
                    u.username,

                    g.id AS gym_id,
                    g.name AS gym_name,
                    g.address_line1,
                    g.address_line2,
                    g.city,
                    g.state,
                    g.postcode,
                    g.country

                FROM coach_profiles cp

                INNER JOIN users u
                    ON u.id = cp.user_id

                INNER JOIN gyms g
                    ON g.id = ?

                WHERE cp.id = ?

                AND cp.is_active = 1
                AND cp.approval_status = 'approved'

                AND u.role = 'coach'

                AND g.is_active = 1

                LIMIT 1
                `,
                [
                    gymId,
                    coachId
                ],

                (
                    profileError,
                    profiles
                ) => {

                    if (
                        profileError
                    ) {

                        console.error(
                            'Slot coach validation:',
                            profileError
                        );


                        return res
                            .status(500)
                            .json({
                                success: false,

                                message:
                                    'Unable to validate coach.'
                            });
                    }


                    if (
                        profiles.length ===
                        0
                    ) {

                        return res
                            .status(404)
                            .json({
                                success: false,

                                message:
                                    'Coach or gym is unavailable.'
                            });
                    }


                    const profile =
                        profiles[0];


                    // ======================================
                    // LOAD AVAILABILITY FOR THIS DATE
                    //
                    // Weekly availability:
                    // same weekday
                    //
                    // Specific-date availability:
                    // exact date
                    // ======================================

                    db.query(
                        `
                        SELECT

                            id,
                            availability_type,
                            day_of_week,

                            DATE_FORMAT(
                                specific_date,
                                '%Y-%m-%d'
                            ) AS specific_date,

                            TIME_FORMAT(
                                start_time,
                                '%H:%i'
                            ) AS start_time,

                            TIME_FORMAT(
                                end_time,
                                '%H:%i'
                            ) AS end_time,

                            slot_duration_minutes

                        FROM coach_availability_rules

                        WHERE coach_id = ?
                        AND gym_id = ?
                        AND is_active = 1

                        AND
                        (
                            (
                                availability_type = 'weekly'
                                AND day_of_week = ?
                            )

                            OR

                            (
                                availability_type = 'specific_date'
                                AND specific_date = ?
                            )
                        )

                        ORDER BY
                            start_time ASC
                        `,
                        [
                            coachId,
                            gymId,
                            dayOfWeek,
                            date
                        ],

                        (
                            availabilityError,
                            rules
                        ) => {

                            if (
                                availabilityError
                            ) {

                                console.error(
                                    'Load coach slot rules:',
                                    availabilityError
                                );


                                return res
                                    .status(500)
                                    .json({
                                        success: false,

                                        message:
                                            'Unable to load coach availability.'
                                    });
                            }


                            // ==================================
                            // NO AVAILABILITY
                            // ==================================

                            if (
                                rules.length ===
                                0
                            ) {

                                return res.json({
                                    success: true,

                                    date,
                                    dayOfWeek,

                                    coach: {
                                        id:
                                            profile.coach_id,

                                        fullName:
                                            profile.full_name,

                                        profilePicture:
                                            profile.profile_picture,

                                        sessionPrice:
                                            Number(
                                                profile.default_session_price ||
                                                0
                                            ),

                                        currency:
                                            profile.currency
                                    },

                                    gym: {
                                        id:
                                            profile.gym_id,

                                        name:
                                            profile.gym_name
                                    },

                                    slots:
                                        []
                                });
                            }


                            // ==================================
                            // LOAD BLOCKING BOOKINGS
                            //
                            // IMPORTANT:
                            //
                            // Notice there is NO gym_id filter.
                            //
                            // Therefore booking Coach 1 at Gym B
                            // blocks Coach 1 at Gym A, C, D...
                            // for the same overlapping time.
                            // ==================================

                            db.query(
                                `
                                SELECT

                                    id,

                                    TIME_FORMAT(
                                        start_time,
                                        '%H:%i'
                                    ) AS start_time,

                                    TIME_FORMAT(
                                        end_time,
                                        '%H:%i'
                                    ) AS end_time,

                                    status,
                                    payment_status,
                                    hold_expires_at

                                FROM coach_bookings

                                WHERE coach_id = ?
                                AND session_date = ?

                                AND
                                (
                                    status IN
                                    (
                                        'confirmed',
                                        'completed'
                                    )

                                    OR

                                    (
                                        status = 'pending_payment'

                                        AND hold_expires_at IS NOT NULL

                                        AND hold_expires_at > NOW()
                                    )
                                )
                                `,
                                [
                                    coachId,
                                    date
                                ],

                                (
                                    bookingError,
                                    bookings
                                ) => {

                                    if (
                                        bookingError
                                    ) {

                                        console.error(
                                            'Load blocked coach times:',
                                            bookingError
                                        );


                                        return res
                                            .status(500)
                                            .json({
                                                success: false,

                                                message:
                                                    'Unable to calculate available slots.'
                                            });
                                    }


                                    // ==========================
                                    // GENERATE CANDIDATE SLOTS
                                    // ==========================

                                    const slotMap =
                                        new Map();


                                    rules.forEach(
                                        (
                                            rule
                                        ) => {

                                            const start =
                                                bookingTimeToMinutes(
                                                    rule.start_time
                                                );


                                            const end =
                                                bookingTimeToMinutes(
                                                    rule.end_time
                                                );


                                            const duration =
                                                Number(
                                                    rule.slot_duration_minutes
                                                );


                                            if (
                                                !Number.isInteger(
                                                    duration
                                                ) ||
                                                duration <= 0
                                            ) {

                                                return;
                                            }


                                            for (
                                                let slotStart =
                                                    start;

                                                slotStart +
                                                    duration <=
                                                    end;

                                                slotStart +=
                                                    duration
                                            ) {

                                                const slotEnd =
                                                    slotStart +
                                                    duration;


                                                // ==================
                                                // DO NOT SHOW PAST
                                                // TIME TODAY
                                                // ==================

                                                if (
                                                    date ===
                                                        malaysiaToday &&
                                                    slotStart <=
                                                        getMalaysiaCurrentMinutes()
                                                ) {

                                                    continue;
                                                }


                                                // ==================
                                                // CHECK ANY-GYM
                                                // BOOKING CONFLICT
                                                // ==================

                                                const blocked =
                                                    bookings.some(
                                                        (
                                                            booking
                                                        ) => {

                                                            const bookedStart =
                                                                bookingTimeToMinutes(
                                                                    booking.start_time
                                                                );


                                                            const bookedEnd =
                                                                bookingTimeToMinutes(
                                                                    booking.end_time
                                                                );


                                                            return (
                                                                slotStart <
                                                                    bookedEnd &&
                                                                slotEnd >
                                                                    bookedStart
                                                            );
                                                        }
                                                    );


                                                if (
                                                    blocked
                                                ) {

                                                    continue;
                                                }


                                                const startValue =
                                                    minutesToBookingTime(
                                                        slotStart
                                                    );


                                                const endValue =
                                                    minutesToBookingTime(
                                                        slotEnd
                                                    );


                                                const key =
                                                    `${startValue}-${endValue}`;


                                                // ==================
                                                // DEDUPLICATE
                                                //
                                                // In case weekly and
                                                // specific-date rules
                                                // create same slot.
                                                // ==================

                                                if (
                                                    !slotMap.has(
                                                        key
                                                    )
                                                ) {

                                                    slotMap.set(
                                                        key,
                                                        {
                                                            startTime:
                                                                startValue,

                                                            endTime:
                                                                endValue,

                                                            durationMinutes:
                                                                duration,

                                                            amount:
                                                                Number(
                                                                    profile.default_session_price ||
                                                                    0
                                                                ),

                                                            currency:
                                                                profile.currency,

                                                            available:
                                                                true
                                                        }
                                                    );
                                                }
                                            }
                                        }
                                    );


                                    const slots =
                                        Array.from(
                                            slotMap.values()
                                        )
                                            .sort(
                                                (
                                                    a,
                                                    b
                                                ) =>
                                                    a.startTime
                                                        .localeCompare(
                                                            b.startTime
                                                        )
                                            );


                                    // ==========================
                                    // RESPONSE
                                    // ==========================

                                    return res.json({
                                        success: true,

                                        date,
                                        dayOfWeek,

                                        coach: {
                                            id:
                                                profile.coach_id,

                                            fullName:
                                                profile.full_name,

                                            username:
                                                profile.username,

                                            profilePicture:
                                                profile.profile_picture,

                                            sessionPrice:
                                                Number(
                                                    profile.default_session_price ||
                                                    0
                                                ),

                                            currency:
                                                profile.currency
                                        },

                                        gym: {
                                            id:
                                                profile.gym_id,

                                            name:
                                                profile.gym_name,

                                            address: [
                                                profile.address_line1,
                                                profile.address_line2,
                                                profile.postcode,
                                                profile.city,
                                                profile.state,
                                                profile.country
                                            ]
                                                .filter(
                                                    Boolean
                                                )
                                                .join(
                                                    ', '
                                                )
                                        },

                                        slots
                                    });
                                }
                            );
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
    createCoachSlotRouter;