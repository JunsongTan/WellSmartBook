const {
    roundOne,
    safeParseJson
} =
    require('./generalHelpers');


// ======================================================
// GYM DISTANCE
// ======================================================

function calculateGymDistanceKm(
    latitude1,
    longitude1,
    latitude2,
    longitude2
) {

    const lat1 =
        Number(
            latitude1
        );

    const lng1 =
        Number(
            longitude1
        );

    const lat2 =
        Number(
            latitude2
        );

    const lng2 =
        Number(
            longitude2
        );


    if (
        !Number.isFinite(
            lat1
        ) ||
        !Number.isFinite(
            lng1
        ) ||
        !Number.isFinite(
            lat2
        ) ||
        !Number.isFinite(
            lng2
        )
    ) {

        return null;
    }


    const earthRadiusKm =
        6371;


    const toRadians =
        (
            degrees
        ) =>
            degrees *
            Math.PI /
            180;


    const deltaLatitude =
        toRadians(
            lat2 -
            lat1
        );


    const deltaLongitude =
        toRadians(
            lng2 -
            lng1
        );


    const a =
        Math.sin(
            deltaLatitude /
            2
        ) ** 2 +

        Math.cos(
            toRadians(
                lat1
            )
        ) *

        Math.cos(
            toRadians(
                lat2
            )
        ) *

        Math.sin(
            deltaLongitude /
            2
        ) ** 2;


    const c =
        2 *
        Math.atan2(
            Math.sqrt(
                a
            ),

            Math.sqrt(
                1 -
                a
            )
        );


    return roundOne(
        earthRadiusKm *
        c
    );
}


// ======================================================
// VALIDATE YYYY-MM-DD DATE
// ======================================================

function isValidDateOnly(
    value
) {

    if (
        !/^\d{4}-\d{2}-\d{2}$/
            .test(
                String(
                    value ||
                    ''
                )
            )
    ) {

        return false;
    }


    const [
        year,
        month,
        day
    ] =
        value
            .split(
                '-'
            )
            .map(
                Number
            );


    const date =
        new Date(
            Date.UTC(
                year,
                month - 1,
                day
            )
        );


    return (
        date.getUTCFullYear() ===
            year &&

        date.getUTCMonth() ===
            month - 1 &&

        date.getUTCDate() ===
            day
    );
}


// ======================================================
// CURRENT MALAYSIA DATE
// ======================================================

function getMalaysiaDateString() {

    const formatter =
        new Intl.DateTimeFormat(
            'en-GB',

            {
                timeZone:
                    'Asia/Kuala_Lumpur',

                year:
                    'numeric',

                month:
                    '2-digit',

                day:
                    '2-digit'
            }
        );


    const parts =
        formatter
            .formatToParts(
                new Date()
            );


    const values =
        {};


    parts.forEach(
        (
            part
        ) => {

            values[
                part.type
            ] =
                part.value;
        }
    );


    return (
        `${values.year}-` +
        `${values.month}-` +
        `${values.day}`
    );
}


// ======================================================
// CURRENT MALAYSIA TIME IN MINUTES
// ======================================================

function getMalaysiaCurrentMinutes() {

    const formatter =
        new Intl.DateTimeFormat(
            'en-GB',

            {
                timeZone:
                    'Asia/Kuala_Lumpur',

                hour:
                    '2-digit',

                minute:
                    '2-digit',

                hourCycle:
                    'h23'
            }
        );


    const parts =
        formatter
            .formatToParts(
                new Date()
            );


    const values =
        {};


    parts.forEach(
        (
            part
        ) => {

            values[
                part.type
            ] =
                part.value;
        }
    );


    return (
        Number(
            values.hour
        ) *
        60
    ) +
        Number(
            values.minute
        );
}


// ======================================================
// GET DAY OF WEEK
// ======================================================

function getDayOfWeekFromDate(
    dateString
) {

    const date =
        new Date(
            `${dateString}T12:00:00+08:00`
        );


    return new Intl.DateTimeFormat(
        'en-US',

        {
            weekday:
                'long',

            timeZone:
                'Asia/Kuala_Lumpur'
        }
    )
        .format(
            date
        )
        .toLowerCase();
}


// ======================================================
// BOOKING TIME TO MINUTES
//
// Example:
// 09:30 -> 570
// ======================================================

function bookingTimeToMinutes(
    value
) {

    const [
        hour,
        minute
    ] =
        String(
            value ||
            ''
        )
            .slice(
                0,
                5
            )
            .split(
                ':'
            )
            .map(
                Number
            );


    return (
        hour *
        60
    ) +
        minute;
}


// ======================================================
// MINUTES TO BOOKING TIME
//
// Example:
// 570 -> 09:30
// ======================================================

function minutesToBookingTime(
    totalMinutes
) {

    const hours =
        Math.floor(
            totalMinutes /
            60
        );


    const minutes =
        totalMinutes %
        60;


    return (
        String(
            hours
        )
            .padStart(
                2,
                '0'
            ) +

        ':' +

        String(
            minutes
        )
            .padStart(
                2,
                '0'
            )
    );
}


// ======================================================
// NORMALIZE BOOKING TIME
// ======================================================

function normalizeBookingTime(
    value
) {

    const text =
        String(
            value ||
            ''
        ).trim();


    if (
        !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/
            .test(
                text
            )
    ) {

        return null;
    }


    return text.slice(
        0,
        5
    );
}


// ======================================================
// FORMAT GYM FOR FRONTEND
// ======================================================

function formatGymForClient(
    gym,
    userLatitude = null,
    userLongitude = null
) {

    const latitude =
        Number(
            gym.latitude
        );


    const longitude =
        Number(
            gym.longitude
        );


    let distanceKm =
        null;


    if (
        userLatitude !==
            null &&

        userLongitude !==
            null &&

        Number.isFinite(
            Number(
                userLatitude
            )
        ) &&

        Number.isFinite(
            Number(
                userLongitude
            )
        )
    ) {

        distanceKm =
            calculateGymDistanceKm(
                userLatitude,
                userLongitude,
                latitude,
                longitude
            );
    }


    return {

        id:
            gym.id,

        name:
            gym.name,

        description:
            gym.description,

        address: {

            line1:
                gym.address_line1,

            line2:
                gym.address_line2,

            city:
                gym.city,

            state:
                gym.state,

            postcode:
                gym.postcode,

            country:
                gym.country

        },

        fullAddress: [

            gym.address_line1,

            gym.address_line2,

            gym.postcode,

            gym.city,

            gym.state,

            gym.country

        ]
            .filter(
                Boolean
            )
            .join(
                ', '
            ),

        latitude,

        longitude,

        phone:
            gym.phone,

        email:
            gym.email,

        websiteUrl:
            gym.website_url,

        imageUrl:
            gym.image_url,

        openingHours:
            safeParseJson(
                gym.opening_hours,
                {}
            ),

        amenities:
            safeParseJson(
                gym.amenities,
                []
            ),

        distanceKm,

        isActive:
            Boolean(
                gym.is_active
            )

    };
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    calculateGymDistanceKm,

    isValidDateOnly,

    getMalaysiaDateString,

    getMalaysiaCurrentMinutes,

    getDayOfWeekFromDate,

    bookingTimeToMinutes,

    minutesToBookingTime,

    normalizeBookingTime,

    formatGymForClient

};