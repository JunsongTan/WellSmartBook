// ======================================================
// STRIPE HELPERS
// ======================================================


// ======================================================
// GET BOOKING IDS FROM STRIPE SESSION
// ======================================================

function getStripeBookingIds(
    session
) {

    const raw =
        session?.metadata?.bookingIds ||
        session?.metadata?.bookingId ||
        '';


    return [
        ...new Set(
            String(
                raw
            )
                .split(
                    ','
                )
                .map(
                    (
                        value
                    ) =>
                        Number(
                            value.trim()
                        )
                )
                .filter(
                    (
                        value
                    ) =>
                        Number.isInteger(
                            value
                        ) &&
                        value > 0
                )
        )
    ];
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    getStripeBookingIds

};