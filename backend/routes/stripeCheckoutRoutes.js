const express =
    require('express');

function getFrontendUrl(
    req
) {

    const requestOrigin =
        String(
            req.get('origin') ||
            ''
        )
            .trim()
            .replace(
                /\/+$/,
                ''
            );


    // During local development:
    // Laptop  -> http://localhost:5173
    // Mobile  -> http://192.168.100.10:5173
    if (
        process.env.NODE_ENV !==
            'production' &&
        requestOrigin
    ) {

        return requestOrigin;
    }


    return String(
        process.env.FRONTEND_URL ||
        'http://localhost:5173'
    )
        .trim()
        .replace(
            /\/+$/,
            ''
        );
}

// ======================================================
// STRIPE CHECKOUT ROUTES
// ======================================================

function createStripeCheckoutRouter({
    bookingPool,
    stripe,
    authenticateToken
}) {

    const router =
        express.Router();


    // ======================================================
    // USER BOOKING - START MULTI-SLOT STRIPE CHECKOUT
    //
    // One Stripe Checkout Session pays for all selected rows.
    // ======================================================

    router.post(
        '/bookings/checkout',

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
                            'Only user accounts can pay for coaching sessions.'
                    });
            }


            if (!stripe) {

                return res
                    .status(500)
                    .json({
                        success: false,

                        message:
                            'Stripe is not configured.'
                    });
            }


            const bookingIds =
                [
                    ...new Set(
                        (
                            Array.isArray(
                                req.body.bookingIds
                            )
                                ? req.body.bookingIds
                                : []
                        )
                            .map(
                                Number
                            )
                            .filter(
                                (
                                    id
                                ) =>
                                    Number.isInteger(
                                        id
                                    ) &&
                                    id > 0
                            )
                    )
                ];


            if (
                bookingIds.length ===
                    0 ||
                bookingIds.length >
                    10
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Please provide between 1 and 10 valid booking IDs.'
                    });
            }


            const userId =
                Number(
                    req.user.id
                );


            const placeholders =
                bookingIds
                    .map(
                        () => '?'
                    )
                    .join(',');


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
                // LOOK UP ALL BOOKINGS
                // ==========================================

                const [
                    lookupRows
                ] =
                    await bookingDb.query(
                        `
                        SELECT
                            id,
                            coach_id,
                            gym_id

                        FROM coach_bookings

                        WHERE id IN
                        (
                            ${placeholders}
                        )

                        AND user_id =
                            ?

                        ORDER BY id ASC
                        `,
                        [
                            ...bookingIds,
                            userId
                        ]
                    );


                if (
                    lookupRows.length !==
                    bookingIds.length
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
                                'One or more booking holds were not found.'
                        });
                }


                const coachIds =
                    [
                        ...new Set(
                            lookupRows.map(
                                (
                                    row
                                ) =>
                                    Number(
                                        row.coach_id
                                    )
                            )
                        )
                    ];


                if (
                    coachIds.length !==
                    1
                ) {

                    await bookingDb
                        .rollback();


                    transactionStarted =
                        false;


                    return res
                        .status(400)
                        .json({
                            success: false,

                            message:
                                'Selected bookings must belong to the same coach.'
                        });
                }


                const coachId =
                    coachIds[0];


                // ==========================================
                // LOCK COACH
                // ==========================================

                await bookingDb.query(
                    `
                    SELECT id

                    FROM coach_profiles

                    WHERE id = ?

                    LIMIT 1

                    FOR UPDATE
                    `,
                    [
                        coachId
                    ]
                );
                
                // ======================================================
                // CHECK AND LOCK ACTIVE GYMS BEFORE STRIPE CHECKOUT
                // ======================================================

                const gymIds = [
                    ...new Set(
                        lookupRows.map(
                            row => Number(row.gym_id)
                        )
                    )
                ].sort((a, b) => a - b);

                const gymPlaceholders = gymIds
                    .map(() => '?')
                    .join(',');

                const [activeGyms] = await bookingDb.query(
                    `
                    SELECT id
                    FROM gyms
                    WHERE id IN (${gymPlaceholders})
                    AND is_active = 1
                    ORDER BY id
                    FOR UPDATE
                    `,
                    gymIds
                );

                // ======================================================
                // REJECT CHECKOUT IF ANY GYM IS DISABLED
                // ======================================================

                if (activeGyms.length !== gymIds.length) {

                    await bookingDb.rollback();

                    transactionStarted = false;

                    return res.status(409).json({
                        success: false,
                        message:
                            'A selected gym is unavailable. ' +
                            'Please choose an active gym before payment.'
                    });
                }



                // ==========================================
                // LOCK BOOKING ROWS
                // ==========================================

                const [
                    bookings
                ] =
                    await bookingDb.query(
                        `
                        SELECT

                            cb.id,
                            cb.coach_id,
                            cb.gym_id,

                            DATE_FORMAT(
                                cb.session_date,
                                '%Y-%m-%d'
                            ) AS session_date,

                            TIME_FORMAT(
                                cb.start_time,
                                '%H:%i'
                            ) AS start_time,

                            TIME_FORMAT(
                                cb.end_time,
                                '%H:%i'
                            ) AS end_time,

                            cb.session_duration_minutes,

                            cb.amount,
                            cb.currency,

                            cb.status,
                            cb.payment_status,

                            cb.hold_expires_at,

                            (
                                cb.hold_expires_at >
                                NOW()
                            ) AS hold_active,

                            cb.stripe_checkout_session_id,

                            coach_user.full_name
                                AS coach_name,

                            customer.email
                                AS customer_email,

                            g.name
                                AS gym_name

                        FROM coach_bookings cb

                        INNER JOIN coach_profiles cp
                            ON cp.id =
                                cb.coach_id

                        INNER JOIN users coach_user
                            ON coach_user.id =
                                cp.user_id

                        INNER JOIN users customer
                            ON customer.id =
                                cb.user_id

                        INNER JOIN gyms g
                            ON g.id =
                                cb.gym_id

                        WHERE cb.id IN
                        (
                            ${placeholders}
                        )

                        AND cb.user_id =
                            ?

                        ORDER BY
                            cb.session_date ASC,
                            cb.start_time ASC

                        FOR UPDATE
                        `,
                        [
                            ...bookingIds,
                            userId
                        ]
                    );


                if (
                    bookings.length !==
                    bookingIds.length
                ) {

                    throw new Error(
                        'One or more booking holds disappeared.'
                    );
                }


                // ==========================================
                // ALREADY PAID?
                // ==========================================

                if (
                    bookings.some(
                        (
                            booking
                        ) =>
                            booking.status ===
                                'confirmed' &&
                            booking.payment_status ===
                                'paid'
                    )
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
                                'One or more selected bookings have already been paid.'
                        });
                }


                // ==========================================
                // ALL HOLDS MUST STILL BE ACTIVE
                // ==========================================

                if (
                    bookings.some(
                        (
                            booking
                        ) =>
                            booking.status !==
                                'pending_payment' ||
                            !Number(
                                booking.hold_active
                            )
                    )
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
                                'One or more booking holds have expired. Please choose the sessions again.'
                        });
                }


                // ==========================================
                // EXISTING STRIPE SESSION?
                // ==========================================

                const sessionIds =
                    [
                        ...new Set(
                            bookings
                                .map(
                                    (
                                        booking
                                    ) =>
                                        booking
                                            .stripe_checkout_session_id
                                )
                                .filter(
                                    Boolean
                                )
                        )
                    ];


                if (
                    sessionIds.length ===
                        1 &&

                    bookings.every(
                        (
                            booking
                        ) =>
                            booking
                                .stripe_checkout_session_id ===
                            sessionIds[0]
                    )
                ) {

                    const existingSession =
                        await stripe.checkout
                            .sessions.retrieve(
                                sessionIds[0]
                            );


                    if (
                        existingSession.status ===
                            'open' &&
                        existingSession.url
                    ) {

                        await bookingDb
                            .commit();


                        transactionStarted =
                            false;


                        return res.json({

                            success:
                                true,

                            reused:
                                true,

                            bookingIds,

                            sessionId:
                                existingSession.id,

                            checkoutUrl:
                                existingSession.url
                        });
                    }
                }


                if (
                    sessionIds.length >
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
                                'These bookings are already connected to another payment session. Please refresh and try again.'
                        });
                }


                // ==========================================
                // CURRENCY
                // ==========================================

                const currencies =
                    [
                        ...new Set(
                            bookings.map(
                                (
                                    booking
                                ) =>
                                    String(
                                        booking.currency ||
                                        'MYR'
                                    )
                                        .trim()
                                        .toLowerCase()
                            )
                        )
                    ];


                if (
                    currencies.length !==
                    1
                ) {

                    throw new Error(
                        'Selected bookings use different currencies.'
                    );
                }


                const currency =
                    currencies[0];


                const frontendUrl =
                    getFrontendUrl(
                        req
                    );


                const stripeExpiresAt =
                    Math.floor(
                        Date.now() /
                        1000
                    ) +
                    30 *
                    60;


                // ==========================================
                // ONE STRIPE LINE ITEM PER SESSION
                // ==========================================

                const lineItems =
                    bookings.map(
                        (
                            booking
                        ) => {

                            const amount =
                                Number(
                                    booking.amount
                                );


                            if (
                                !Number.isFinite(
                                    amount
                                ) ||
                                amount <= 0
                            ) {

                                throw new Error(
                                    'Invalid booking payment amount.'
                                );
                            }


                            return {

                                quantity:
                                    1,

                                price_data: {

                                    currency,

                                    unit_amount:
                                        Math.round(
                                            amount *
                                            100
                                        ),

                                    product_data: {

                                        name:
                                            `Coaching Session with ${booking.coach_name}`,

                                        description:
                                            `${booking.session_date} ${booking.start_time}-${booking.end_time} at ${booking.gym_name}`
                                    }
                                }
                            };
                        }
                    );


                // ==========================================
                // CREATE ONE STRIPE CHECKOUT SESSION
                // ==========================================

                const checkoutSession =
                    await stripe.checkout
                        .sessions.create({

                            mode:
                                'payment',

                            payment_method_types: [
                                'card'
                            ],

                            customer_email:
                                bookings[0]
                                    .customer_email,

                            client_reference_id:
                                bookingIds.join(
                                    ','
                                ),

                            line_items:
                                lineItems,

                            metadata: {

                                bookingIds:
                                    bookingIds.join(
                                        ','
                                    ),

                                userId:
                                    String(
                                        userId
                                    ),

                                coachId:
                                    String(
                                        coachId
                                    )
                            },

                            payment_intent_data: {

                                metadata: {

                                    bookingIds:
                                        bookingIds.join(
                                            ','
                                        ),

                                    userId:
                                        String(
                                            userId
                                        )
                                }
                            },

                            expires_at:
                                stripeExpiresAt,

                            success_url:
                                `${frontendUrl}/gym-map?payment=success&session_id={CHECKOUT_SESSION_ID}`,

                            cancel_url:
                                `${frontendUrl}/gym-map?payment=cancelled`
                        });


                // ==========================================
                // SAME STRIPE SESSION FOR ALL BOOKING ROWS
                // ==========================================

                await bookingDb.query(
                    `
                    UPDATE coach_bookings

                    SET
                        payment_status =
                            'pending',

                        stripe_checkout_session_id =
                            ?,

                        hold_expires_at =
                            FROM_UNIXTIME(?)

                    WHERE id IN
                    (
                        ${placeholders}
                    )

                    AND user_id =
                        ?

                    AND status =
                        'pending_payment'
                    `,
                    [
                        checkoutSession.id,

                        stripeExpiresAt +
                            60,

                        ...bookingIds,

                        userId
                    ]
                );


                await bookingDb
                    .commit();


                transactionStarted =
                    false;


                const totalAmount =
                    bookings.reduce(
                        (
                            total,
                            booking
                        ) =>
                            total +
                            Number(
                                booking.amount ||
                                0
                            ),
                        0
                    );


                return res.json({

                    success:
                        true,

                    reused:
                        false,

                    bookingIds,

                    totalAmount,

                    currency:
                        currency.toUpperCase(),

                    sessionId:
                        checkoutSession.id,

                    checkoutUrl:
                        checkoutSession.url
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
                            'Multi-slot Stripe checkout rollback:',
                            rollbackError
                        );
                    }
                }


                console.error(
                    'Create multi-slot Stripe Checkout:',
                    error
                );


                return res
                    .status(500)
                    .json({
                        success: false,

                        message:
                            'Unable to start Stripe Checkout.'
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

    // ======================================================
    // USER BOOKING - START STRIPE CHECKOUT
    // ======================================================

    router.post(
        '/bookings/:bookingId/checkout',

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
                            'Only user accounts can pay for coaching sessions.'
                    });
            }


            if (!stripe) {

                return res
                    .status(500)
                    .json({
                        success: false,

                        message:
                            'Stripe is not configured.'
                    });
            }


            const bookingId =
                Number(
                    req.params.bookingId
                );


            if (
                !Number.isInteger(
                    bookingId
                ) ||
                bookingId <= 0
            ) {

                return res
                    .status(400)
                    .json({
                        success: false,

                        message:
                            'Invalid booking ID.'
                    });
            }


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
                // READ COACH ID
                // ==========================================

                const [
                    bookingLookup
                ] =
                    await bookingDb.query(
                        `
                        SELECT coach_id, gym_id

                        FROM coach_bookings

                        WHERE id = ?
                        AND user_id = ?

                        LIMIT 1
                        `,
                        [
                            bookingId,
                            userId
                        ]
                    );


                if (
                    bookingLookup.length ===
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
                                'Booking hold not found.'
                        });
                }


                const coachId =
                    Number(
                        bookingLookup[0]
                            .coach_id
                    );


                // ==========================================
                // LOCK COACH
                // ==========================================

                await bookingDb.query(
                    `
                    SELECT id

                    FROM coach_profiles

                    WHERE id = ?

                    LIMIT 1

                    FOR UPDATE
                    `,
                    [
                        coachId
                    ]
                );
                
                // ======================================================
                // CHECK AND LOCK ACTIVE GYM BEFORE STRIPE CHECKOUT
                // ======================================================

                const gymId = Number(
                    bookingLookup[0].gym_id
                );

                const [activeGyms] = await bookingDb.query(
                    `
                    SELECT id
                    FROM gyms
                    WHERE id = ?
                    AND is_active = 1
                    LIMIT 1
                    FOR UPDATE
                    `,
                    [gymId]
                );

                // ======================================================
                // REJECT CHECKOUT IF GYM IS DISABLED
                // ======================================================

                if (activeGyms.length === 0) {

                    await bookingDb.rollback();

                    transactionStarted = false;

                    return res.status(409).json({
                        success: false,
                        message:
                            'This gym is unavailable. ' +
                            'Please choose an active gym before payment.'
                    });
                }



                // ==========================================
                // LOCK + LOAD BOOKING
                // ==========================================

                const [
                    bookings
                ] =
                    await bookingDb.query(
                        `
                        SELECT

                            cb.id,
                            cb.user_id,
                            cb.coach_id,
                            cb.gym_id,

                            DATE_FORMAT(
                                cb.session_date,
                                '%Y-%m-%d'
                            ) AS session_date,

                            TIME_FORMAT(
                                cb.start_time,
                                '%H:%i'
                            ) AS start_time,

                            TIME_FORMAT(
                                cb.end_time,
                                '%H:%i'
                            ) AS end_time,

                            cb.session_duration_minutes,

                            cb.amount,
                            cb.currency,

                            cb.status,
                            cb.payment_status,

                            cb.hold_expires_at,

                            cb.stripe_checkout_session_id,

                            cp.default_session_price,

                            coach_user.full_name
                                AS coach_name,

                            customer.email
                                AS customer_email,

                            g.name
                                AS gym_name

                        FROM coach_bookings cb

                        INNER JOIN coach_profiles cp
                            ON cp.id =
                                cb.coach_id

                        INNER JOIN users coach_user
                            ON coach_user.id =
                                cp.user_id

                        INNER JOIN users customer
                            ON customer.id =
                                cb.user_id

                        INNER JOIN gyms g
                            ON g.id =
                                cb.gym_id

                        WHERE cb.id = ?

                        AND cb.user_id = ?

                        LIMIT 1

                        FOR UPDATE
                        `,
                        [
                            bookingId,
                            userId
                        ]
                    );


                if (
                    bookings.length ===
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
                                'Booking hold not found.'
                        });
                }


                const booking =
                    bookings[0];


                // ==========================================
                // ALREADY PAID
                // ==========================================

                if (
                    booking.status ===
                        'confirmed' &&
                    booking.payment_status ===
                        'paid'
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
                                'This booking has already been paid.'
                        });
                }


                // ==========================================
                // HOLD MUST STILL BE ACTIVE
                // ==========================================

                if (
                    booking.status !==
                        'pending_payment' ||
                    !booking.hold_expires_at ||
                    new Date(
                        booking.hold_expires_at
                    ).getTime() <=
                        Date.now()
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
                                'Your booking hold has expired. Please choose the session again.'
                        });
                }


                // ==========================================
                // EXISTING STRIPE SESSION
                // ==========================================

                if (
                    booking
                        .stripe_checkout_session_id
                ) {

                    const existingSession =
                        await stripe.checkout
                            .sessions.retrieve(
                                booking
                                    .stripe_checkout_session_id
                            );


                    if (
                        existingSession.status ===
                            'open' &&
                        existingSession.url
                    ) {

                        await bookingDb
                            .commit();


                        transactionStarted =
                            false;


                        return res.json({
                            success: true,

                            reused:
                                true,

                            checkoutUrl:
                                existingSession.url,

                            sessionId:
                                existingSession.id
                        });
                    }
                }


                // ==========================================
                // PRICE COMES FROM BOOKING DATABASE ROW
                // ==========================================

                const amount =
                    Number(
                        booking.amount
                    );


                if (
                    !Number.isFinite(
                        amount
                    ) ||
                    amount <= 0
                ) {

                    throw new Error(
                        'Invalid booking payment amount.'
                    );
                }


                const currency =
                    String(
                        booking.currency ||
                        'MYR'
                    )
                        .trim()
                        .toLowerCase();


                const frontendUrl =
                    getFrontendUrl(
                        req
                    );


                // ==========================================
                // STRIPE MINIMUM CUSTOM EXPIRY = 30 MINUTES
                // ==========================================

                const stripeExpiresAt =
                    Math.floor(
                        Date.now() /
                        1000
                    ) +
                    30 *
                    60;


                const checkoutSession =
                    await stripe.checkout
                        .sessions.create({

                            mode:
                                'payment',

                            payment_method_types: [
                                'card'
                            ],

                            customer_email:
                                booking.customer_email,

                            client_reference_id:
                                String(
                                    bookingId
                                ),

                            line_items: [
                                {
                                    quantity:
                                        1,

                                    price_data: {

                                        currency,

                                        unit_amount:
                                            Math.round(
                                                amount *
                                                100
                                            ),

                                        product_data: {

                                            name:
                                                `Coaching Session with ${booking.coach_name}`,

                                            description:
                                                `${booking.session_date} ${booking.start_time}-${booking.end_time} at ${booking.gym_name}`
                                        }
                                    }
                                }
                            ],

                            metadata: {

                                bookingId:
                                    String(
                                        bookingId
                                    ),

                                userId:
                                    String(
                                        userId
                                    ),

                                coachId:
                                    String(
                                        booking.coach_id
                                    ),

                                gymId:
                                    String(
                                        booking.gym_id
                                    )
                            },

                            payment_intent_data: {

                                metadata: {

                                    bookingId:
                                        String(
                                            bookingId
                                        )
                                }
                            },

                            expires_at:
                                stripeExpiresAt,

                            success_url:
                                `${frontendUrl}/gym-map?payment=success&session_id={CHECKOUT_SESSION_ID}`,

                            cancel_url:
                                `${frontendUrl}/gym-map?payment=cancelled&bookingId=${bookingId}`
                        });


                // ==========================================
                // WHEN PAYMENT STARTS:
                //
                // Extend DB reservation to Stripe's
                // 30-minute checkout window + 1 minute
                // webhook delivery grace.
                // ==========================================

                await bookingDb.query(
                    `
                    UPDATE coach_bookings

                    SET
                        payment_status =
                            'pending',

                        stripe_checkout_session_id =
                            ?,

                        hold_expires_at =
                            FROM_UNIXTIME(?)

                    WHERE id = ?
                    AND user_id = ?
                    AND status =
                        'pending_payment'
                    `,
                    [
                        checkoutSession.id,

                        stripeExpiresAt +
                            60,

                        bookingId,
                        userId
                    ]
                );


                await bookingDb
                    .commit();


                transactionStarted =
                    false;


                return res.json({

                    success:
                        true,

                    reused:
                        false,

                    bookingId,

                    sessionId:
                        checkoutSession.id,

                    checkoutUrl:
                        checkoutSession.url
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
                            'Stripe checkout rollback:',
                            rollbackError
                        );
                    }
                }


                console.error(
                    'Create Stripe Checkout:',
                    error
                );


                return res
                    .status(500)
                    .json({
                        success: false,

                        message:
                            'Unable to start Stripe Checkout.'
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
    createStripeCheckoutRouter;