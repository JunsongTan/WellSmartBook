const express =
    require('express');

const {
    isValidDateOnly,
    getMalaysiaDateString,
    getMalaysiaCurrentMinutes,
    getDayOfWeekFromDate,
    bookingTimeToMinutes,
    normalizeBookingTime
} =
    require('../helpers/bookingHelpers');


// ======================================================
// BOOKING HOLD ROUTES
// ======================================================

function createBookingHoldRouter({
    bookingPool,
    authenticateToken
}) {

    const router =
        express.Router();


    // ======================================================
    // USER BOOKING - CREATE 15 MINUTE HOLD
    // ======================================================

    router.post(
        '/bookings/hold',

        authenticateToken,

        async (
            req,
            res
        ) => {

            // ==============================================
            // NORMAL USERS ONLY
            // ==============================================

            if (
                !req.user ||
                req.user.role !==
                    'user'
            ) {

                return res
                    .status(403)
                    .json({
                        success: false,

                        message:
                            'Only user accounts can book coaching sessions.'
                    });
            }


            // ==============================================
            // REQUEST VALUES
            // ==============================================

            const coachId =
                Number(
                    req.body.coachId
                );


            const gymId =
                Number(
                    req.body.gymId
                );


            const date =
                String(
                    req.body.date ||
                    req.body.sessionDate ||
                    ''
                ).trim();


            const startTime =
                normalizeBookingTime(
                    req.body.startTime
                );


            const endTime =
                normalizeBookingTime(
                    req.body.endTime
                );


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
                            'Please provide a valid booking date.'
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


            // ==============================================
            // VALIDATE TIME
            // ==============================================

            if (
                !startTime ||
                !endTime
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Please provide a valid session time.'
                    });
            }


            const requestedStartMinutes =
                bookingTimeToMinutes(
                    startTime
                );


            const requestedEndMinutes =
                bookingTimeToMinutes(
                    endTime
                );


            if (
                !Number.isFinite(
                    requestedStartMinutes
                ) ||
                !Number.isFinite(
                    requestedEndMinutes
                ) ||
                requestedEndMinutes <=
                    requestedStartMinutes
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Invalid coaching session time.'
                    });
            }


            // ==============================================
            // DO NOT HOLD PAST TIME TODAY
            // ==============================================

            if (
                date ===
                    malaysiaToday &&
                requestedStartMinutes <=
                    getMalaysiaCurrentMinutes()
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'This coaching time has already passed.'
                    });
            }


            const dayOfWeek =
                getDayOfWeekFromDate(
                    date
                );


            const userId =
                Number(
                    req.user.id
                );


            let bookingDb =
                null;


            let transactionStarted =
                false;


            try {

                // ==========================================
                // GET DEDICATED CONNECTION
                // ==========================================

                bookingDb =
                    await bookingPool
                        .promise()
                        .getConnection();


                await bookingDb
                    .beginTransaction();


                transactionStarted =
                    true;


                // ==========================================
                // 1. LOCK COACH
                //
                // Every booking attempt for this coach
                // locks the same coach_profiles row first.
                // ==========================================

                const [
                    coaches
                ] =
                    await bookingDb.query(
                        `
                        SELECT

                            cp.id,
                            cp.default_session_price,
                            cp.currency,

                            u.full_name,
                            u.username

                        FROM coach_profiles cp

                        INNER JOIN users u
                            ON u.id = cp.user_id

                        WHERE cp.id = ?

                        AND cp.is_active = 1

                        AND cp.approval_status =
                            'approved'

                        AND u.role =
                            'coach'

                        LIMIT 1

                        FOR UPDATE
                        `,
                        [
                            coachId
                        ]
                    );


                if (
                    coaches.length ===
                    0
                ) {

                    await bookingDb
                        .rollback();


                    transactionStarted =
                        false;


                    return res
                        .status(404)
                        .json({
                            success: false,

                            message:
                                'Coach is unavailable.'
                        });
                }


                const coach =
                    coaches[0];


                // ==========================================
                // SERVER-DERIVED PRICE
                //
                // Never trust price from frontend.
                // ==========================================

                const amount =
                    Number(
                        coach.default_session_price ||
                        0
                    );


                const currency =
                    String(
                        coach.currency ||
                        'MYR'
                    );


                if (
                    !Number.isFinite(
                        amount
                    ) ||
                    amount < 0
                ) {

                    await bookingDb
                        .rollback();


                    transactionStarted =
                        false;


                    return res
                        .status(500)
                        .json({
                            success: false,

                            message:
                                'Coach session price is unavailable.'
                        });
                }


                // ==========================================
                // 2. VALIDATE ACTIVE GYM
                // ==========================================

                const [
                    gyms
                ] =
                    await bookingDb.query(
                        `
                        SELECT
                            id,
                            name

                        FROM gyms

                        WHERE id = ?
                            AND is_active = 1

                        LIMIT 1
                        FOR UPDATE
                        `,
                        [
                            gymId
                        ]
                    );


                if (
                    gyms.length ===
                    0
                ) {

                    await bookingDb
                        .rollback();


                    transactionStarted =
                        false;


                    return res
                        .status(404)
                        .json({
                            success: false,

                            message:
                                'Gym is unavailable.'
                        });
                }


                const gym =
                    gyms[0];


                // ==========================================
                // 3. LOAD COACH AVAILABILITY
                // ==========================================

                const [
                    rules
                ] =
                    await bookingDb.query(
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
                                availability_type =
                                    'weekly'

                                AND day_of_week = ?
                            )

                            OR

                            (
                                availability_type =
                                    'specific_date'

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
                        ]
                    );


                if (
                    rules.length ===
                    0
                ) {

                    await bookingDb
                        .rollback();


                    transactionStarted =
                        false;


                    return res
                        .status(409)
                        .json({
                            success: false,

                            message:
                                'This coach is not available at this gym on the selected date.'
                        });
                }


                // ==========================================
                // 4. VERIFY EXACT SLOT
                //
                // Frontend cannot invent its own time.
                // ==========================================

                let matchedDuration =
                    null;


                rules.some(
                    (
                        rule
                    ) => {

                        const ruleStart =
                            bookingTimeToMinutes(
                                rule.start_time
                            );


                        const ruleEnd =
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

                            return false;
                        }


                        for (
                            let slotStart =
                                ruleStart;

                            slotStart +
                                duration <=
                                ruleEnd;

                            slotStart +=
                                duration
                        ) {

                            const slotEnd =
                                slotStart +
                                duration;


                            if (
                                slotStart ===
                                    requestedStartMinutes &&
                                slotEnd ===
                                    requestedEndMinutes
                            ) {

                                matchedDuration =
                                    duration;


                                return true;
                            }
                        }


                        return false;
                    }
                );


                if (
                    !matchedDuration
                ) {

                    await bookingDb
                        .rollback();


                    transactionStarted =
                        false;


                    return res
                        .status(409)
                        .json({
                            success: false,

                            message:
                                'The selected time is no longer a valid coach slot.'
                        });
                }


                // ==========================================
                // 5. EXPIRE OLD 15-MINUTE HOLDS
                // ==========================================

                await bookingDb.query(
                    `
                    UPDATE coach_bookings

                    SET status =
                        'expired'

                    WHERE coach_id = ?

                    AND session_date = ?

                    AND status =
                        'pending_payment'

                    AND hold_expires_at
                        IS NOT NULL

                    AND hold_expires_at
                        <= NOW()
                    `,
                    [
                        coachId,
                        date
                    ]
                );


                // ==========================================
                // 6. CHECK COACH CONFLICT
                //
                // IMPORTANT:
                //
                // NO gym_id condition here.
                //
                // If coach is held at Gym A from 09:00-10:00,
                // the same coach is also blocked at Gym B/C.
                // ==========================================

                const [
                    conflicts
                ] =
                    await bookingDb.query(
                        `
                        SELECT

                            id,
                            user_id,
                            gym_id,

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

                            DATE_FORMAT(
                                hold_expires_at,
                                '%Y-%m-%d %H:%i:%s'
                            ) AS hold_expires_at

                        FROM coach_bookings

                        WHERE coach_id = ?

                        AND session_date = ?

                        AND start_time < ?

                        AND end_time > ?

                        AND
                        (
                            status IN
                            (
                                'confirmed',
                                'completed'
                            )

                            OR

                            (
                                status =
                                    'pending_payment'

                                AND hold_expires_at
                                    IS NOT NULL

                                AND hold_expires_at
                                    > NOW()
                            )
                        )

                        ORDER BY
                            id ASC

                        LIMIT 1
                        `,
                        [
                            coachId,
                            date,
                            endTime,
                            startTime
                        ]
                    );


                if (
                    conflicts.length >
                    0
                ) {

                    const conflict =
                        conflicts[0];


                    // ======================================
                    // SAME USER CLICKED SAME HOLD AGAIN
                    //
                    // Reuse existing hold instead of
                    // creating duplicate booking row.
                    // ======================================

                    if (
                        conflict.status ===
                            'pending_payment' &&

                        Number(
                            conflict.user_id
                        ) ===
                            userId &&

                        Number(
                            conflict.gym_id
                        ) ===
                            gymId &&

                        conflict.start_time ===
                            startTime &&

                        conflict.end_time ===
                            endTime
                    ) {

                        await bookingDb
                            .commit();


                        transactionStarted =
                            false;


                        return res.json({
                            success: true,

                            reused:
                                true,

                            message:
                                'Your existing booking hold is still active.',

                            hold: {

                                bookingId:
                                    conflict.id,

                                coachId,

                                coachName:
                                    coach.full_name,

                                gymId,

                                gymName:
                                    gym.name,

                                date,

                                startTime,

                                endTime,

                                durationMinutes:
                                    matchedDuration,

                                amount,

                                currency,

                                status:
                                    'pending_payment',

                                paymentStatus:
                                    conflict.payment_status ||
                                    'unpaid',

                                holdExpiresAt:
                                    conflict.hold_expires_at,

                                holdMinutes:
                                    15
                            }
                        });
                    }


                    // ======================================
                    // ANOTHER USER / OTHER BOOKING HAS SLOT
                    // ======================================

                    await bookingDb
                        .rollback();


                    transactionStarted =
                        false;


                    return res
                        .status(409)
                        .json({
                            success: false,

                            message:
                                'This coach time was just reserved by another booking. Please choose another available slot.'
                        });
                }


                // ==========================================
                // 7. CREATE NEW 15-MINUTE HOLD
                // ==========================================

                const [
                    insertResult
                ] =
                    await bookingDb.query(
                        `
                        INSERT INTO coach_bookings
                        (
                            user_id,
                            coach_id,
                            gym_id,

                            session_date,

                            start_time,
                            end_time,

                            session_duration_minutes,

                            amount,
                            currency,

                            status,
                            payment_status,

                            hold_expires_at
                        )

                        VALUES
                        (
                            ?,
                            ?,
                            ?,

                            ?,

                            ?,
                            ?,

                            ?,

                            ?,
                            ?,

                            'pending_payment',
                            'unpaid',

                            DATE_ADD(
                                NOW(),
                                INTERVAL 15 MINUTE
                            )
                        )
                        `,
                        [
                            userId,
                            coachId,
                            gymId,

                            date,

                            startTime,
                            endTime,

                            matchedDuration,

                            amount,
                            currency
                        ]
                    );


                const bookingId =
                    insertResult.insertId;


                // ==========================================
                // 8. LOAD CREATED HOLD
                // ==========================================

                const [
                    holds
                ] =
                    await bookingDb.query(
                        `
                        SELECT

                            id,

                            DATE_FORMAT(
                                hold_expires_at,
                                '%Y-%m-%d %H:%i:%s'
                            ) AS hold_expires_at,

                            status,
                            payment_status

                        FROM coach_bookings

                        WHERE id = ?

                        LIMIT 1
                        `,
                        [
                            bookingId
                        ]
                    );


                if (
                    holds.length ===
                    0
                ) {

                    throw new Error(
                        'Booking hold was created but could not be loaded.'
                    );
                }


                const hold =
                    holds[0];


                // ==========================================
                // 9. COMMIT TRANSACTION
                // ==========================================

                await bookingDb
                    .commit();


                transactionStarted =
                    false;


                return res
                    .status(201)
                    .json({
                        success: true,

                        reused:
                            false,

                        message:
                            'Coach session held for 15 minutes.',

                        hold: {

                            bookingId:
                                hold.id,

                            coachId,

                            coachName:
                                coach.full_name,

                            gymId,

                            gymName:
                                gym.name,

                            date,

                            startTime,

                            endTime,

                            durationMinutes:
                                matchedDuration,

                            amount,

                            currency,

                            status:
                                hold.status,

                            paymentStatus:
                                hold.payment_status,

                            holdExpiresAt:
                                hold.hold_expires_at,

                            holdMinutes:
                                15
                        }
                    });

            } catch (
                error
            ) {

                // ==========================================
                // ROLLBACK IF SOMETHING FAILED
                // ==========================================

                if (
                    bookingDb &&
                    transactionStarted
                ) {

                    try {

                        await bookingDb
                            .rollback();

                    } catch (
                        rollbackError
                    ) {

                        console.error(
                            'Booking hold rollback:',
                            rollbackError
                        );
                    }
                }


                console.error(
                    'Booking hold:',
                    error
                );


                return res
                    .status(500)
                    .json({
                        success: false,

                        message:
                            'Unable to create booking hold.'
                    });

            } finally {

                // ==========================================
                // ALWAYS RETURN CONNECTION TO THE POOL
                // ==========================================

                if (
                    bookingDb
                ) {

                    bookingDb.release();
                }
            }
        }
    );

    // ======================================================
    // USER BOOKING - CREATE MULTIPLE 15-MINUTE HOLDS
    //
    // Same coach + gym + date.
    // If ONE slot fails, NONE are created.
    // ======================================================

    router.post(
        '/bookings/hold-batch',

        authenticateToken,

        async (
            req,
            res
        ) => {

            if (
                !req.user ||
                req.user.role !==
                    'user'
            ) {

                return res
                    .status(403)
                    .json({
                        success: false,

                        message:
                            'Only user accounts can book coaching sessions.'
                    });
            }


            const coachId =
                Number(
                    req.body.coachId
                );


            const gymId =
                Number(
                    req.body.gymId
                );


            const date =
                String(
                    req.body.date ||
                    ''
                ).trim();


            const rawSlots =
                Array.isArray(
                    req.body.slots
                )
                    ? req.body.slots
                    : [];


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
                            'Please provide a valid booking date.'
                    });
            }


            if (
                date <
                getMalaysiaDateString()
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'You cannot book a coaching session in the past.'
                    });
            }


            if (
                rawSlots.length ===
                    0 ||
                rawSlots.length >
                    10
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Please select between 1 and 10 coaching sessions.'
                    });
            }


            const requestedSlots =
                rawSlots.map(
                    (
                        slot
                    ) => {

                        const startTime =
                            normalizeBookingTime(
                                slot?.startTime
                            );


                        const endTime =
                            normalizeBookingTime(
                                slot?.endTime
                            );


                        return {

                            startTime,

                            endTime,

                            startMinutes:
                                bookingTimeToMinutes(
                                    startTime
                                ),

                            endMinutes:
                                bookingTimeToMinutes(
                                    endTime
                                )
                        };
                    }
                );


            if (
                requestedSlots.some(
                    (
                        slot
                    ) =>
                        !slot.startTime ||
                        !slot.endTime ||
                        !Number.isFinite(
                            slot.startMinutes
                        ) ||
                        !Number.isFinite(
                            slot.endMinutes
                        ) ||
                        slot.endMinutes <=
                            slot.startMinutes
                )
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'One or more selected session times are invalid.'
                    });
            }


            const uniqueKeys =
                new Set(
                    requestedSlots.map(
                        (
                            slot
                        ) =>
                            `${slot.startTime}-${slot.endTime}`
                    )
                );


            if (
                uniqueKeys.size !==
                requestedSlots.length
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'The same time slot was selected more than once.'
                    });
            }


            const sortedRequested =
                [
                    ...requestedSlots
                ]
                    .sort(
                        (
                            a,
                            b
                        ) =>
                            a.startMinutes -
                            b.startMinutes
                    );


            for (
                let index = 1;
                index <
                    sortedRequested.length;
                index += 1
            ) {

                if (
                    sortedRequested[
                        index - 1
                    ].endMinutes >
                    sortedRequested[
                        index
                    ].startMinutes
                ) {

                    return res
                        .status(400)
                        .json({
                            success: false,

                            message:
                                'Selected coaching sessions cannot overlap each other.'
                        });
                }
            }


            const malaysiaToday =
                getMalaysiaDateString();


            if (
                date ===
                malaysiaToday
            ) {

                const currentMinutes =
                    getMalaysiaCurrentMinutes();


                if (
                    requestedSlots.some(
                        (
                            slot
                        ) =>
                            slot.startMinutes <=
                            currentMinutes
                    )
                ) {

                    return res
                        .status(400)
                        .json({
                            success: false,

                            message:
                                'One or more selected coaching times have already passed.'
                        });
                }
            }


            const dayOfWeek =
                getDayOfWeekFromDate(
                    date
                );


            const userId =
                Number(
                    req.user.id
                );


            let bookingDb =
                null;


            let transactionStarted =
                false;


            try {

                bookingDb =
                    await bookingPool
                        .promise()
                        .getConnection();


                await bookingDb
                    .beginTransaction();


                transactionStarted =
                    true;


                // ==========================================
                // LOCK COACH
                // ==========================================

                const [
                    coaches
                ] =
                    await bookingDb.query(
                        `
                        SELECT

                            cp.id,
                            cp.default_session_price,
                            cp.currency,

                            u.full_name

                        FROM coach_profiles cp

                        INNER JOIN users u
                            ON u.id =
                                cp.user_id

                        WHERE cp.id = ?

                        AND cp.is_active = 1

                        AND cp.approval_status =
                            'approved'

                        AND u.role =
                            'coach'

                        LIMIT 1

                        FOR UPDATE
                        `,
                        [
                            coachId
                        ]
                    );


                if (
                    coaches.length ===
                    0
                ) {

                    await bookingDb
                        .rollback();


                    transactionStarted =
                        false;


                    return res
                        .status(404)
                        .json({
                            success: false,

                            message:
                                'Coach is unavailable.'
                        });
                }


                const coach =
                    coaches[0];


                const amount =
                    Number(
                        coach.default_session_price ||
                        0
                    );


                const currency =
                    String(
                        coach.currency ||
                        'MYR'
                    );


                if (
                    !Number.isFinite(
                        amount
                    ) ||
                    amount < 0
                ) {

                    throw new Error(
                        'Coach session price is unavailable.'
                    );
                }


                // ==========================================
                // GYM
                // ==========================================

                const [
                    gyms
                ] =
                    await bookingDb.query(
                        `
                        SELECT
                            id,
                            name

                        FROM gyms

                        WHERE id = ?
                            AND is_active = 1

                        LIMIT 1
                        FOR UPDATE
                        `,
                        [
                            gymId
                        ]
                    );


                if (
                    gyms.length ===
                    0
                ) {

                    await bookingDb
                        .rollback();


                    transactionStarted =
                        false;


                    return res
                        .status(404)
                        .json({
                            success: false,

                            message:
                                'Gym is unavailable.'
                        });
                }


                const gym =
                    gyms[0];


                // ==========================================
                // AVAILABILITY RULES
                // ==========================================

                const [
                    rules
                ] =
                    await bookingDb.query(
                        `
                        SELECT

                            id,
                            availability_type,

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
                                availability_type =
                                    'weekly'

                                AND day_of_week =
                                    ?
                            )

                            OR

                            (
                                availability_type =
                                    'specific_date'

                                AND specific_date =
                                    ?
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
                        ]
                    );


                if (
                    rules.length ===
                    0
                ) {

                    await bookingDb
                        .rollback();


                    transactionStarted =
                        false;


                    return res
                        .status(409)
                        .json({
                            success: false,

                            message:
                                'This coach is not available at this gym on the selected date.'
                        });
                }


                // ==========================================
                // VERIFY EVERY REQUESTED SLOT
                // ==========================================

                const validatedSlots =
                    [];


                for (
                    const requested
                    of requestedSlots
                ) {

                    let durationMinutes =
                        null;


                    for (
                        const rule
                        of rules
                    ) {

                        const ruleStart =
                            bookingTimeToMinutes(
                                rule.start_time
                            );


                        const ruleEnd =
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

                            continue;
                        }


                        for (
                            let slotStart =
                                ruleStart;

                            slotStart +
                                duration <=
                                ruleEnd;

                            slotStart +=
                                duration
                        ) {

                            const slotEnd =
                                slotStart +
                                duration;


                            if (
                                slotStart ===
                                    requested.startMinutes &&
                                slotEnd ===
                                    requested.endMinutes
                            ) {

                                durationMinutes =
                                    duration;


                                break;
                            }
                        }


                        if (
                            durationMinutes
                        ) {

                            break;
                        }
                    }


                    if (
                        !durationMinutes
                    ) {

                        await bookingDb
                            .rollback();


                        transactionStarted =
                            false;


                        return res
                            .status(409)
                            .json({
                                success: false,

                                message:
                                    `The selected time ${requested.startTime}-${requested.endTime} is no longer a valid coach slot.`
                            });
                    }


                    validatedSlots.push({

                        ...requested,

                        durationMinutes
                    });
                }


                // ==========================================
                // EXPIRE OLD HOLDS
                // ==========================================

                await bookingDb.query(
                    `
                    UPDATE coach_bookings

                    SET status =
                        'expired'

                    WHERE coach_id = ?

                    AND session_date = ?

                    AND status =
                        'pending_payment'

                    AND hold_expires_at
                        IS NOT NULL

                    AND hold_expires_at
                        <= NOW()
                    `,
                    [
                        coachId,
                        date
                    ]
                );


                // ==========================================
                // CHECK ALL EXISTING COACH BOOKINGS
                //
                // NO gym_id filter intentionally.
                // ==========================================

                const [
                    blockingBookings
                ] =
                    await bookingDb.query(
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
                            ) AS end_time

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
                                status =
                                    'pending_payment'

                                AND hold_expires_at
                                    IS NOT NULL

                                AND hold_expires_at
                                    > NOW()
                            )
                        )
                        `,
                        [
                            coachId,
                            date
                        ]
                    );


                const hasConflict =
                    validatedSlots.some(
                        (
                            slot
                        ) =>
                            blockingBookings.some(
                                (
                                    booking
                                ) => {

                                    const existingStart =
                                        bookingTimeToMinutes(
                                            booking.start_time
                                        );


                                    const existingEnd =
                                        bookingTimeToMinutes(
                                            booking.end_time
                                        );


                                    return (
                                        existingStart <
                                            slot.endMinutes &&

                                        existingEnd >
                                            slot.startMinutes
                                    );
                                }
                            )
                    );


                if (
                    hasConflict
                ) {

                    await bookingDb
                        .rollback();


                    transactionStarted =
                        false;


                    return res
                        .status(409)
                        .json({
                            success: false,

                            message:
                                'One or more selected coach times were just reserved. Please refresh and choose again.'
                        });
                }


                // ==========================================
                // ONE SHARED HOLD EXPIRY
                // ==========================================

                const [
                    expiryRows
                ] =
                    await bookingDb.query(
                        `
                        SELECT

                            DATE_FORMAT(
                                DATE_ADD(
                                    NOW(),
                                    INTERVAL 15 MINUTE
                                ),
                                '%Y-%m-%d %H:%i:%s'
                            ) AS hold_expires_at
                        `
                    );


                const holdExpiresAt =
                    expiryRows[0]
                        .hold_expires_at;


                const bookingIds =
                    [];


                // ==========================================
                // INSERT ALL SLOTS
                // ==========================================

                for (
                    const slot
                    of validatedSlots
                ) {

                    const [
                        insertResult
                    ] =
                        await bookingDb.query(
                            `
                            INSERT INTO coach_bookings
                            (
                                user_id,
                                coach_id,
                                gym_id,

                                session_date,

                                start_time,
                                end_time,

                                session_duration_minutes,

                                amount,
                                currency,

                                status,
                                payment_status,

                                hold_expires_at
                            )

                            VALUES
                            (
                                ?,
                                ?,
                                ?,

                                ?,

                                ?,
                                ?,

                                ?,

                                ?,
                                ?,

                                'pending_payment',
                                'unpaid',

                                ?
                            )
                            `,
                            [
                                userId,
                                coachId,
                                gymId,

                                date,

                                slot.startTime,
                                slot.endTime,

                                slot.durationMinutes,

                                amount,
                                currency,

                                holdExpiresAt
                            ]
                        );


                    bookingIds.push(
                        insertResult.insertId
                    );
                }


                await bookingDb
                    .commit();


                transactionStarted =
                    false;


                return res
                    .status(201)
                    .json({

                        success:
                            true,

                        message:
                            `${bookingIds.length} coaching session${bookingIds.length > 1 ? 's' : ''} held for 15 minutes.`,

                        hold: {

                            bookingIds,

                            coachId,

                            coachName:
                                coach.full_name,

                            gymId,

                            gymName:
                                gym.name,

                            date,

                            sessions:
                                validatedSlots.map(
                                    (
                                        slot,
                                        index
                                    ) => ({

                                        bookingId:
                                            bookingIds[index],

                                        startTime:
                                            slot.startTime,

                                        endTime:
                                            slot.endTime,

                                        durationMinutes:
                                            slot.durationMinutes,

                                        amount,

                                        currency
                                    })
                                ),

                            totalAmount:
                                amount *
                                validatedSlots.length,

                            totalDurationMinutes:
                                validatedSlots.reduce(
                                    (
                                        total,
                                        slot
                                    ) =>
                                        total +
                                        slot.durationMinutes,
                                    0
                                ),

                            currency,

                            status:
                                'pending_payment',

                            paymentStatus:
                                'unpaid',

                            holdExpiresAt,

                            holdMinutes:
                                15
                        }
                    });

            } catch (
                error
            ) {

                if (
                    bookingDb &&
                    transactionStarted
                ) {

                    try {

                        await bookingDb
                            .rollback();

                    } catch (
                        rollbackError
                    ) {

                        console.error(
                            'Batch booking hold rollback:',
                            rollbackError
                        );
                    }
                }


                console.error(
                    'Create batch booking hold:',
                    error
                );


                return res
                    .status(500)
                    .json({
                        success: false,

                        message:
                            'Unable to reserve the selected coaching sessions.'
                    });

            } finally {

                if (
                    bookingDb
                ) {

                    bookingDb.release();
                }
            }
        }
    );


    return router;
}


// ======================================================
// EXPORT
// ======================================================

module.exports =
    createBookingHoldRouter;