
 // =====================================================
 // WELLSMARTBOOK - TWO-HOUR COACH REMINDER SCHEDULER
 // Step 2.10.2B
 //
 // Not started automatically until index.js calls it.
 // Direct execution of this file is READ-ONLY.
 // =====================================================

const {
    malaysiaDateOnly
} = require('./coachDailySummaryService');

const {
    getCoachTwoHourReminderCandidates
} = require('./coachTwoHourReminderService');

const CHECK_INTERVAL_MS = 60 * 1000;
const SEND_GRACE_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 3;


// =====================================================
// CALCULATE TOMORROW'S MALAYSIA DATE
// =====================================================

function nextDateOnly(dateOnly) {

    const day = new Date(
        `${dateOnly}T00:00:00.000Z`
    );

    if (Number.isNaN(day.getTime())) {
        throw new Error('Invalid Malaysia date.');
    }

    day.setUTCDate(day.getUTCDate() + 1);

    return day.toISOString().slice(0, 10);
}


// =====================================================
// CONVERT UTC ISO TIME TO MYSQL DATETIME
// =====================================================

function utcSqlDate(isoString) {

    return isoString
        .slice(0, 19)
        .replace('T', ' ');
}


// =====================================================
// FIND REMINDERS DUE NOW
//
// Checks today's and tomorrow's sessions in MYT.
//
// Allows a maximum of 10 minutes' delay if the
// backend restarts shortly after the due time.
// =====================================================

async function getDueCoachReminders(
    bookingPool,
    now = new Date()
) {

    if (
        !(now instanceof Date) ||
        Number.isNaN(now.getTime())
    ) {
        throw new Error('Invalid current time.');
    }

    const today = malaysiaDateOnly(now);
    const tomorrow = nextDateOnly(today);

    const [
        todaySessions,
        tomorrowSessions
    ] = await Promise.all([

        getCoachTwoHourReminderCandidates(
            bookingPool,
            today
        ),

        getCoachTwoHourReminderCandidates(
            bookingPool,
            tomorrow
        )
    ]);

    const nowMs = now.getTime();

    const due = [
        ...todaySessions,
        ...tomorrowSessions
    ].filter(item => {

        const dueMs = Date.parse(
            item.reminderDueAtUtc
        );

        const startMs = Date.parse(
            item.startAtUtc
        );

        const lateByMs = nowMs - dueMs;

        return (
            Number.isFinite(dueMs) &&
            Number.isFinite(startMs) &&
            lateByMs >= 0 &&
            lateByMs <= SEND_GRACE_MS &&
            startMs > nowMs
        );
    });

    return due.sort((a, b) =>
        a.reminderDueAtUtc.localeCompare(
            b.reminderDueAtUtc
        )
    );
}


// =====================================================
// RECHECK BOOKING BEFORE SENDING
//
// Prevents reminders for bookings that changed
// or were cancelled before email processing.
// =====================================================

async function stillEligible(
    bookingPool,
    original
) {

    const latest =
        await getCoachTwoHourReminderCandidates(
            bookingPool,
            original.session.sessionDate
        );

    return latest.some(item =>

        item.bookingId === original.bookingId &&

        item.coachId === original.coachId &&

        item.startAtUtc === original.startAtUtc &&

        item.reminderDueAtUtc ===
            original.reminderDueAtUtc &&

        item.coachEmail === original.coachEmail
    );
}


// =====================================================
// RUN REMINDER CHECK
// =====================================================

async function runCoachTwoHourReminderCheck({

    bookingPool,

    transporter,

    now = new Date(),

    previewOnly = true

}) {

    if (
        !bookingPool ||
        typeof bookingPool.promise !== 'function'
    ) {
        throw new Error(
            'A MySQL booking pool is required.'
        );
    }

    const due = await getDueCoachReminders(
        bookingPool,
        now
    );


    // =================================================
    // PREVIEW MODE
    //
    // NO GMAIL AND NO DATABASE WRITES
    // =================================================

    if (previewOnly) {

        console.log(
            '[Coach reminder PREVIEW] UTC:',
            now.toISOString()
        );

        console.log(
            'Reminders due:',
            due.length
        );

        for (const item of due) {

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
                'Session (MYT):',
                item.session.sessionDate,
                item.session.startTime
            );

            console.log(
                'Due (UTC):',
                item.reminderDueAtUtc
            );

            console.log(
                'Has coach email:',
                Boolean(item.coachEmail)
            );
        }

        console.log(
            'PREVIEW ONLY - no Gmail, no database writes.'
        );

        return {
            previewOnly: true,
            due: due.length
        };
    }


    // =================================================
    // LIVE MODE
    // =================================================

    if (
        !transporter ||
        typeof transporter.sendMail !== 'function'
    ) {
        throw new Error(
            'A Gmail transporter is required.'
        );
    }

    const sql = bookingPool.promise();

    let sent = 0;


    // =================================================
    // PROCESS EACH DUE BOOKING
    // =================================================

    for (const item of due) {

        const email = item.coachEmail;

        if (
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {

            console.warn(
                '[Coach reminder] Missing valid email for coach:',
                item.coachId
            );

            continue;
        }


        // =============================================
        // UNIQUE REMINDER KEY
        //
        // Includes the session start time so that a
        // rescheduled booking has a different key.
        // =============================================

        const key =
            `two_hour_reminder:booking:${item.bookingId}:start:${item.startAtUtc}`;

        const dueUtc = utcSqlDate(
            item.reminderDueAtUtc
        );


        // =============================================
        // CREATE NOTIFICATION RECORD
        // =============================================

        await sql.query(

            `
            INSERT IGNORE INTO coach_email_notifications

            (
                notification_key,
                coach_id,
                booking_id,
                notification_type,
                session_date,
                due_at_utc,
                status
            )

            VALUES (
                ?, ?, ?,
                'two_hour_reminder',
                ?, ?,
                'pending'
            )
            `,

            [
                key,
                item.coachId,
                item.bookingId,
                item.session.sessionDate,
                dueUtc
            ]
        );


        // =============================================
        // CLAIM THE REMINDER ATOMICALLY
        // =============================================

        const [claim] = await sql.query(

            `
            UPDATE coach_email_notifications

            SET
                status = 'sending',
                attempts = attempts + 1,
                claimed_at_utc = UTC_TIMESTAMP(),
                last_error = NULL

            WHERE notification_key = ?

              AND due_at_utc <= UTC_TIMESTAMP()

              AND attempts < ?

              AND (
                    status = 'pending'

                    OR (
                        status = 'failed'
                        AND claimed_at_utc <=
                            UTC_TIMESTAMP()
                            - INTERVAL 2 MINUTE
                    )

                    OR (
                        status = 'sending'
                        AND claimed_at_utc <=
                            UTC_TIMESTAMP()
                            - INTERVAL 5 MINUTE
                    )
              )
            `,

            [
                key,
                MAX_ATTEMPTS
            ]
        );

        if (claim.affectedRows !== 1) {
            continue;
        }


        // =============================================
        // RECHECK AND SEND EMAIL
        // =============================================

        try {

            const eligible = await stillEligible(
                bookingPool,
                item
            );

            if (!eligible) {

                await sql.query(

                    `
                    UPDATE coach_email_notifications

                    SET
                        status = 'failed',
                        last_error =
                            'Booking changed or cancelled before email.'

                    WHERE notification_key = ?
                      AND status = 'sending'
                    `,

                    [key]
                );

                console.log(
                    '[Coach reminder] Skipped changed booking:',
                    item.bookingId
                );

                continue;
            }


            // =========================================
            // SEND TO THE COACH
            // =========================================

            const result =
                await transporter.sendMail({

                    from:
                        `"WellSmartBook" <${process.env.EMAIL_USER}>`,

                    to: email,

                    subject: item.email.subject,

                    text: item.email.text,

                    html: item.email.html
                });


            // =========================================
            // VERIFY SMTP ACCEPTED RECIPIENT
            // =========================================

            const accepted = (
                result.accepted || []
            ).some(address =>

                address.toLowerCase() ===
                email.toLowerCase()
            );

            if (!accepted) {

                throw new Error(
                    'SMTP did not accept the coach recipient.'
                );
            }


            // =========================================
            // RECORD SUCCESSFUL REMINDER
            // =========================================

            await sql.query(

                `
                UPDATE coach_email_notifications

                SET
                    status = 'sent',
                    sent_at_utc = UTC_TIMESTAMP(),
                    last_error = NULL

                WHERE notification_key = ?
                  AND status = 'sending'
                `,

                [key]
            );

            sent += 1;

            console.log(
                '[Coach reminder] Sent booking:',
                item.bookingId
            );

        } catch (error) {

            console.error(
                '[Coach reminder] Failed booking:',
                item.bookingId,
                error.message
            );


            // =========================================
            // RECORD FAILURE
            // =========================================

            await sql.query(

                `
                UPDATE coach_email_notifications

                SET
                    status = 'failed',
                    last_error = ?

                WHERE notification_key = ?
                  AND status = 'sending'
                `,

                [
                    String(
                        error.message || 'Email failed'
                    ).slice(0, 500),

                    key
                ]
            );
        }
    }

    return {
        due: due.length,
        sent
    };
}


// =====================================================
// START AUTOMATIC SCHEDULER
// =====================================================

function startCoachTwoHourReminderScheduler({

    bookingPool,

    transporter

}) {

    if (
        process.env.COACH_TWO_HOUR_REMINDER_ENABLED !==
        'true'
    ) {

        console.log(
            '[Coach reminder] Scheduler disabled in .env.'
        );

        return () => {};
    }

    let running = false;


    async function tick() {

        if (running) return;

        running = true;

        try {

            await runCoachTwoHourReminderCheck({

                bookingPool,

                transporter,

                previewOnly: false
            });

        } catch (error) {

            console.error(
                '[Coach reminder] Scheduler error:',
                error.message
            );

        } finally {

            running = false;
        }
    }


    // Check once when started.
    void tick();

    // Check every minute afterward.
    const timer = setInterval(
        () => void tick(),
        CHECK_INTERVAL_MS
    );

    timer.unref?.();

    console.log(
        '[Coach reminder] Two-hour scheduler enabled (Asia/Kuala_Lumpur).'
    );

    return () => clearInterval(timer);
}


// =====================================================
// EXPORT
// =====================================================

module.exports = {

    getDueCoachReminders,

    runCoachTwoHourReminderCheck,

    startCoachTwoHourReminderScheduler
};


// =====================================================
// DIRECT TEST MODE
//
// Running this file directly ALWAYS uses preview.
// NO GMAIL AND NO DATABASE WRITES.
//
// Example:
// node helpers/coachTwoHourReminderScheduler.js
//     2026-10-25T23:00:00Z
// =====================================================

if (require.main === module) {

    require('dotenv').config();

    const mysql = require('mysql2');

    const bookingPool = mysql.createPool({

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

    const now = process.argv[2]
        ? new Date(process.argv[2])
        : new Date();


    runCoachTwoHourReminderCheck({

        bookingPool,

        now,

        previewOnly: true
    })

        .catch(error => {

            console.error(
                'Reminder dry run failed:',
                error.message
            );

            process.exitCode = 1;
        })

        .finally(
            () => bookingPool.promise().end()
        );
}
