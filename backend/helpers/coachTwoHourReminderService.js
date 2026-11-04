
 // =====================================================
 // WELLSMARTBOOK - COACH TWO-HOUR REMINDER LOOKUP
 // STEP 2.10.2A
 //
 // PREVIEW ONLY - NO EMAILS OR DATABASE WRITES
 // =====================================================

const {
    malaysiaDateOnly
} = require('./coachDailySummaryService');

const {
    buildCoachTwoHourReminderEmail
} = require('./bookingEmailHelpers');


// =====================================================
// VALIDATE SESSION DATE
// =====================================================

function validSessionDate(value) {

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const date = new Date(
        `${value}T00:00:00.000Z`
    );

    return (
        Number.isFinite(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}


// =====================================================
// CONVERT MALAYSIA SESSION TIME TO UTC
// =====================================================

function sessionStartAsUtc(sessionDate, startTime) {

    if (!validSessionDate(sessionDate)) {
        throw new Error(
            'Invalid session date (YYYY-MM-DD).'
        );
    }

    const match = String(startTime ?? '').match(
        /^(\d{2}):(\d{2})(?::(\d{2}))?$/
    );

    if (!match) {
        throw new Error('Invalid booking start time.');
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);
    const second = Number(match[3] ?? 0);

    if (
        hour > 23 ||
        minute > 59 ||
        second > 59
    ) {
        throw new Error('Invalid booking start time.');
    }

    const time =
        `${match[1]}:${match[2]}:${String(second).padStart(2, '0')}`;

    // Malaysia time is UTC+08:00.
    return new Date(
        `${sessionDate}T${time}+08:00`
    );
}


// =====================================================
// CALCULATE REMINDER DUE TIME
//
// Session start minus two hours.
// =====================================================

function reminderDueAsUtc(sessionDate, startTime) {

    const start = sessionStartAsUtc(
        sessionDate,
        startTime
    );

    return new Date(
        start.getTime() - 2 * 60 * 60 * 1000
    );
}


// =====================================================
// LOAD CONFIRMED PAID COACHING SESSIONS
//
// One reminder candidate per booking.
// =====================================================

async function getCoachTwoHourReminderCandidates(
    bookingPool,
    sessionDate = malaysiaDateOnly()
) {

    if (!validSessionDate(sessionDate)) {
        throw new Error(
            'Invalid session date (YYYY-MM-DD).'
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

    const [rows] = await bookingPool.promise().query(
        `
        SELECT
            cb.id AS bookingId,

            cb.coach_id AS coachId,

            TIME_FORMAT(
                cb.start_time,
                '%H:%i:%s'
            ) AS startTime,

            TIME_FORMAT(
                cb.end_time,
                '%H:%i:%s'
            ) AS endTime,

            cb.session_duration_minutes
                AS durationMinutes,

            coach_user.full_name AS coachName,

            coach_user.email AS coachEmail,

            client.full_name AS clientName,

            g.name AS gymName,

            CONCAT_WS(', ',
                NULLIF(TRIM(g.address_line1), ''),
                NULLIF(TRIM(g.address_line2), ''),
                NULLIF(TRIM(g.city), ''),
                NULLIF(TRIM(g.state), ''),
                NULLIF(TRIM(g.postcode), ''),
                NULLIF(TRIM(g.country), '')
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
            cb.start_time ASC,
            cb.id ASC
        `,
        [sessionDate]
    );

    // ==============================================
    // BUILD EACH REMINDER
    // ==============================================

    return rows.map(row => {

        const session = {

            bookingId: Number(row.bookingId),

            sessionDate,

            startTime: row.startTime,

            endTime: row.endTime,

            durationMinutes:
                Number(row.durationMinutes || 0),

            clientName:
                row.clientName || 'Client',

            gymName:
                row.gymName || 'Gym',

            gymAddress:
                row.gymAddress || ''
        };

        const coachName =
            row.coachName || 'Coach';

        return {

            bookingId: session.bookingId,

            coachId: Number(row.coachId),

            coachName,

            coachEmail:
                String(row.coachEmail || '').trim(),

            session,

            startAtUtc:
                sessionStartAsUtc(
                    sessionDate,
                    row.startTime
                ).toISOString(),

            reminderDueAtUtc:
                reminderDueAsUtc(
                    sessionDate,
                    row.startTime
                ).toISOString(),

            email:
                buildCoachTwoHourReminderEmail({
                    coachName,
                    session
                })
        };
    });
}


// =====================================================
// EXPORT
// =====================================================

module.exports = {

    sessionStartAsUtc,

    reminderDueAsUtc,

    getCoachTwoHourReminderCandidates
};


// =====================================================
// DIRECT TEST MODE
//
// Run from backend folder.
// No Gmail and no notification writes.
// =====================================================

if (require.main === module) {

    require('dotenv').config();

    const mysql = require('mysql2');

    const pool = mysql.createPool({

        host:
            process.env.DB_HOST || 'localhost',

        user:
            process.env.DB_USER || 'root',

        password:
            process.env.DB_PASSWORD || '',

        database:
            process.env.DB_NAME || 'wellsmartbook_db',

        port:
            Number(process.env.DB_PORT || 3306),

        waitForConnections: true,

        connectionLimit: 2
    });

    const date =
        process.argv[2] || malaysiaDateOnly();

    getCoachTwoHourReminderCandidates(pool, date)

        .then(candidates => {

            console.log(
                'Malaysia session date:',
                date
            );

            console.log(
                'Eligible coaching sessions:',
                candidates.length
            );

            for (const item of candidates) {

                console.log(
                    '-------------------------------'
                );

                console.log(
                    'Booking ID:',
                    item.bookingId
                );

                console.log(
                    'Coach ID:',
                    item.coachId
                );

                console.log(
                    'Has coach email:',
                    Boolean(item.coachEmail)
                );

                console.log(
                    'Session start (Malaysia):',
                    item.session.startTime
                );

                console.log(
                    'Reminder due (UTC):',
                    item.reminderDueAtUtc
                );

                console.log(
                    'Subject:',
                    item.email.subject
                );
            }

            console.log(
                'PREVIEW ONLY - no Gmail sent, no database changes.'
            );
        })

        .catch(error => {

            console.error(
                'Reminder preview failed:',
                error.message
            );

            process.exitCode = 1;
        })

        .finally(
            () => pool.promise().end()
        );
}
