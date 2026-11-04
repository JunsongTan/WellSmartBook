// ======================================================
// STRIPE WEBHOOK HANDLER
// ======================================================

async function handleStripeWebhook(
    req,
    res,
    {
        stripe,
        confirmStripeBooking,
        expireStripeBooking
    }
) {

    console.log(
        '🔔 Stripe webhook request received'
    );


    if (
        !stripe ||
        !process.env
            .STRIPE_WEBHOOK_SECRET
    ) {

        console.error(
            'Stripe webhook configuration is missing.'
        );


        return res
            .status(500)
            .send(
                'Stripe webhook configuration error.'
            );
    }


    const signature =
        req.headers[
            'stripe-signature'
        ];


    let event;


    try {

        event =
            stripe.webhooks
                .constructEvent(
                    req.body,
                    signature,
                    process.env
                        .STRIPE_WEBHOOK_SECRET
                );


        console.log(
            'Stripe webhook event:',
            event.type
        );

    } catch (
        error
    ) {

        console.error(
            'Stripe webhook signature:',
            error.message
        );


        return res
            .status(400)
            .send(
                `Webhook Error: ${error.message}`
            );
    }


    try {

        // ==========================================
        // PAYMENT SUCCESS
        // ==========================================

        if (
            event.type ===
                'checkout.session.completed'
        ) {

            const session =
                event.data.object;


            if (
                session.payment_status ===
                'paid'
            ) {

                await confirmStripeBooking(
                    session
                );
            }
        }


        // ==========================================
        // CHECKOUT EXPIRED WITHOUT PAYMENT
        // ==========================================

        if (
            event.type ===
                'checkout.session.expired'
        ) {

            await expireStripeBooking(
                event.data.object
            );
        }


        return res.json({
            received: true
        });

    } catch (
        error
    ) {

        console.error(
            'Stripe webhook processing:',
            error
        );


        return res
            .status(500)
            .json({
                received: false
            });
    }
}


// ======================================================
// EXPORT
// ======================================================

module.exports =
    handleStripeWebhook;