
 // ======================================================
 // WELLSMARTBOOK
 // COACH DAILY SUMMARY SERVICE
 //
 // Step 2.10.1D - Read-only booking preview.
 // No Gmail messages are sent in this step.
 // ======================================================

const {
    buildCoachDailySummaryEmail
} = require('./bookingEmailHelpers');


// ======================================================
// GET TODAY'S DATE IN MALAYSIA
// ======================================================

function malaysiaDateOnly(now = new Date()) {

    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Kuala_Lumpur',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        })
            .formatToParts(now)
            .filter(part => part.type !== 'literal')
            .map(part => [part.type, part.value])
    );

    return `${parts.year}-${parts.month}-${parts.day}`;
}


// ======================================================
// VALIDATE DATE
// ======================================================

function validDateOnly(value) {

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const parsed = new Date(
        `${value}T00:00:00.000Z`
    );

    return (
        Number.isFinite(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
    );
}


// ======================================================
// GET DAILY COACHING SUMMARIES
//
// Only include:
// - Confirmed bookings
// - Paid bookings
// - Approved coaches
// - Active coaches and accounts
// ======================================================

async function getCoachDailySummaries(
    bookingPool,
    sessionDate = malaysiaDateOnly()
) {

    if (!validDateOnly(sessionDate)) {

        throw new Error(
            'Invalid session date (expected YYYY-MM-DD).'
        );
    }

    if (
        !bookingPool ||
        typeof bookingPool.promise !== 'function'
    ) {

        throw new Error(
            'A MySQL booking pool is required.'
        );
    }

    // ==================================================
    // LOAD CONFIRMED COACHING SESSIONS
    // ==================================================

    const [rows] = await bookingPool.promise().query(
        `
        SELECT

            cb.id AS bookingId,

            cb.coach_id AS coachId,

            TIME_FORMAT(
                cb.start_time,
                '%H:%i'
            ) AS startTime,

            TIME_FORMAT(
                cb.end_time,
                '%H:%i'
            ) AS endTime,

            cb.session_duration_minutes
                AS durationMinutes,

            coach_user.full_name AS coachName,

            coach_user.email AS coachEmail,

            client.full_name AS clientName,

            g.name AS gymName,

            CONCAT_WS(', ',

                NULLIF(
                    TRIM(g.address_line1), ''
                ),

                NULLIF(
                    TRIM(g.address_line2), ''
                ),

                NULLIF(
                    TRIM(g.city), ''
                ),

                NULLIF(
                    TRIM(g.state), ''
                ),

                NULLIF(
                    TRIM(g.postcode), ''
                ),

                NULLIF(
                    TRIM(g.country), ''
                )

            ) AS gymAddress

        FROM coach_bookings AS cb

        INNER JOIN coach_profiles AS cp
            ON cp.id = cb.coach_id

        INNER JOIN users AS coach_user
            ON coach_user.id = cp.user_id

        INNER JOIN users AS client
            ON client.id = cb.user_id

        INNER JOIN gyms AS g
            ON g.id = cb.gym_id

        WHERE cb.session_date = ?

          AND cb.status = 'confirmed'

          AND cb.payment_status = 'paid'

          AND cp.approval_status = 'approved'

          AND cp.is_active = 1

          AND coach_user.is_active = 1

          AND coach_user.role = 'coach'

        ORDER BY
            cb.coach_id ASC,
            cb.start_time ASC,
            cb.id ASC
        `,
        [sessionDate]
    );

    // ==================================================
    // GROUP BOOKINGS BY COACH
    // ==================================================

    const byCoach = new Map();

    for (const row of rows) {

        const coachId = Number(row.coachId);

        if (!byCoach.has(coachId)) {

            byCoach.set(coachId, {

                coachId,

                coachName:
                    row.coachName || 'Coach',

                coachEmail:
                    String(
                        row.coachEmail || ''
                    ).trim(),

                sessionDate,

                sessions: []
            });
        }

        // ==============================================
        // ADD SESSION TO THE CORRECT COACH
        // ==============================================

        byCoach.get(coachId).sessions.push({

            bookingId:
                Number(row.bookingId),

            sessionDate,

            clientName:
                row.clientName || 'Client',

            gymName:
                row.gymName || 'Gym',

            gymAddress:
                row.gymAddress || '',

            startTime:
                row.startTime,

            endTime:
                row.endTime,

            durationMinutes:
                Number(
                    row.durationMinutes || 0
                )
        });
    }

    // ==================================================
    // BUILD DAILY SUMMARY EMAIL FOR EACH COACH
    // ==================================================

    return Array.from(
        byCoach.values()
    ).map(summary => ({

        ...summary,

        email:
            buildCoachDailySummaryEmail(summary)
    }));
}


// ======================================================
// EXPORT FOR FUTURE SCHEDULER
// ======================================================

module.exports = {

    malaysiaDateOnly,

    getCoachDailySummaries
};


// ======================================================
// DIRECT TEST MODE
//
// Run this file directly to preview real bookings.
// NO EMAILS ARE SENT.
// ======================================================

if (require.main === module) {

    require('dotenv').config();

    const mysql = require('mysql2');

    const pool = mysql.createPool({

        host:
            process.env.DB_HOST ||
            'localhost',

        user:
            process.env.DB_USER ||
            'root',

        password:
            process.env.DB_PASSWORD ||
            '',

        database:
            process.env.DB_NAME ||
            'wellsmartbook_db',

        port:
            Number(
                process.env.DB_PORT ||
                3306
            ),

        waitForConnections: true,

        connectionLimit: 2
    });

    const date =
        process.argv[2] ||
        malaysiaDateOnly();

    getCoachDailySummaries(pool, date)

        .then(summaries => {

            console.log(
                'Malaysia session date:',
                date
            );

            console.log(
                'Coaches with confirmed paid sessions:',
                summaries.length
            );

            for (const summary of summaries) {

                console.log(
                    '-----------------------'
                );

                console.log(
                    'Coach ID:',
                    summary.coachId
                );

                console.log(
                    'Coach:',
                    summary.coachName
                );

                console.log(
                    'Has email:',
                    Boolean(summary.coachEmail)
                );

                console.log(
                    'Session count:',
                    summary.sessions.length
                );

                console.log(
                    'Booking IDs:',
                    summary.sessions.map(
                        session => session.bookingId
                    )
                );

                console.log(
                    'Email subject:',
                    summary.email.subject
                );
            }

            console.log(
                'PREVIEW ONLY - no emails sent.'
            );
        })

        .catch(error => {

            console.error(
                'Daily summary preview failed:',
                error.message
            );

            process.exitCode = 1;
        })

        .finally(
            () => pool.promise().end()
        );
}
