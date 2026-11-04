
 // ======================================================
 // WELLSMARTBOOK
 // AUTOMATIC COACH DAILY SUMMARY SCHEDULER
 //
 // Sends each eligible coach a daily schedule
 // at midnight, Malaysia time.
 //
 // This file does not run automatically until
 // started from index.js.
 // ======================================================

const {
    malaysiaDateOnly,
    getCoachDailySummaries
} = require('./coachDailySummaryService');

const CHECK_EVERY_MS = 60 * 1000;

const MAX_ATTEMPTS = 3;


// ======================================================
// GET THE CURRENT HOUR IN MALAYSIA
// ======================================================

function malaysiaHour(now = new Date()) {

    const hourPart = new Intl.DateTimeFormat(
        'en-GB',
        {
            timeZone: 'Asia/Kuala_Lumpur',

            hour: '2-digit',

            hourCycle: 'h23'
        }
    )
        .formatToParts(now)
        .find(part => part.type === 'hour');

    return Number(hourPart?.value);
}


// ======================================================
// CONVERT MALAYSIA MIDNIGHT INTO UTC
//
// Example:
//
// 26 Oct 2026, 12:00 AM Malaysia
//          ↓
// 25 Oct 2026, 4:00 PM UTC
// ======================================================

function midnightMalaysiaAsUtc(sessionDate) {

    // Malaysia uses UTC+08:00.
    const instant = new Date(
        `${sessionDate}T00:00:00+08:00`
    );

    if (!Number.isFinite(instant.getTime())) {

        throw new Error(
            'Invalid Malaysia session date.'
        );
    }

    return instant
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');
}


// ======================================================
// CHECK AND SEND DAILY COACHING SUMMARIES
// ======================================================

async function runCoachDailySummaryCheck({

    bookingPool,

    transporter,

    now = new Date(),

    previewOnly = false

}) {

    const hour = malaysiaHour(now);

    const sessionDate = malaysiaDateOnly(now);

    // ==================================================
    // ONLY SEND DURING THE MIDNIGHT HOUR
    //
    // Allows a short catch-up after a server restart.
    // Prevents sending yesterday's schedule later.
    // ==================================================

    if (!previewOnly && hour !== 0) {

        return {
            skipped: 'Outside Malaysia midnight hour',
            sessionDate
        };
    }

    // ==================================================
    // LOAD ELIGIBLE COACH SESSIONS
    // ==================================================

    const summaries = await getCoachDailySummaries(
        bookingPool,
        sessionDate
    );

    const dueAtUtc =
        midnightMalaysiaAsUtc(sessionDate);

    // ==================================================
    // SAFE PREVIEW - NO EMAILS OR DATABASE WRITES
    // ==================================================

    if (previewOnly) {

        console.log(
            '[Coach summary PREVIEW]',
            sessionDate
        );

        for (const item of summaries) {

            console.log(
                'Coach:',
                item.coachId,

                'Sessions:',
                item.sessions.length,

                'Has email:',
                Boolean(item.coachEmail)
            );
        }

        console.log(
            'PREVIEW ONLY - no database writes, no emails.'
        );

        return {
            previewOnly: true,
            sessionDate,
            coaches: summaries.length
        };
    }

    // ==================================================
    // VERIFY EMAIL TRANSPORTER
    // ==================================================

    if (
        !transporter ||
        typeof transporter.sendMail !== 'function'
    ) {

        throw new Error(
            'The Gmail transporter is required.'
        );
    }

    const sql = bookingPool.promise();

    let sent = 0;

    // ==================================================
    // PROCESS ONE COACH AT A TIME
    // ==================================================

    for (const summary of summaries) {

        // ==============================================
        // CHECK COACH EMAIL
        // ==============================================

        if (
            !summary.coachEmail ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
                .test(summary.coachEmail)
        ) {

            console.warn(
                '[Coach summary] Missing valid coach email:',
                summary.coachId
            );

            continue;
        }

        // ==============================================
        // CREATE UNIQUE NOTIFICATION KEY
        //
        // One coach + one date = one daily summary.
        // ==============================================

        const key =
            `daily_summary:${sessionDate}:coach:${summary.coachId}`;

        // ==============================================
        // CREATE NOTIFICATION RECORD IF MISSING
        // ==============================================

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
                ?,
                ?,
                NULL,
                'daily_summary',
                ?,
                ?,
                'pending'
            )
            `,
            [
                key,
                summary.coachId,
                sessionDate,
                dueAtUtc
            ]
        );

        // ==============================================
        // CLAIM NOTIFICATION BEFORE SENDING
        //
        // Uses an atomic SQL UPDATE so two scheduler
        // workers cannot claim the same pending job.
        // ==============================================

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
                        AND updated_at <=
                            UTC_TIMESTAMP()
                            - INTERVAL 5 MINUTE
                    )

                    OR (
                        status = 'sending'
                        AND claimed_at_utc <=
                            UTC_TIMESTAMP()
                            - INTERVAL 20 MINUTE
                    )
              )
            `,
            [
                key,
                MAX_ATTEMPTS
            ]
        );

        // Already sent or claimed by another worker.
        if (claim.affectedRows !== 1) {
            continue;
        }

        // ==============================================
        // SEND DAILY SUMMARY
        // ==============================================

        try {

            await transporter.sendMail({

                from:
                    `"WellSmartBook" <${process.env.EMAIL_USER}>`,

                to:
                    summary.coachEmail,

                subject:
                    summary.email.subject,

                text:
                    summary.email.text,

                html:
                    summary.email.html
            });

            // ==========================================
            // MARK NOTIFICATION AS SENT
            // ==========================================

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
                '[Coach summary] Sent for coach:',
                summary.coachId,

                'Date:',
                sessionDate
            );

        } catch (error) {

            console.error(
                '[Coach summary] Send failed:',
                error.message
            );

            // ==========================================
            // RECORD FAILED ATTEMPT
            // ==========================================

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
                        error.message ||
                        'Email error'
                    ).slice(0, 500),

                    key
                ]
            );
        }
    }

    return {
        sessionDate,
        eligibleCoaches: summaries.length,
        sent
    };
}


// ======================================================
// START AUTOMATIC SCHEDULER
// ======================================================

function startCoachDailySummaryScheduler({

    bookingPool,

    transporter

}) {

    // ==============================================
    // SCHEDULER IS DISABLED UNLESS EXPLICITLY ENABLED
    // ==============================================

    if (
        process.env.COACH_DAILY_SUMMARY_ENABLED !== 'true'
    ) {

        console.log(
            '[Coach summary] Scheduler disabled in .env.'
        );

        return () => {};
    }

    let running = false;

    // ==============================================
    // EXECUTE ONE SCHEDULER CHECK
    // ==============================================

    async function tick() {

        if (running) {
            return;
        }

        running = true;

        try {

            await runCoachDailySummaryCheck({
                bookingPool,
                transporter
            });

        } catch (error) {

            console.error(
                '[Coach summary] Scheduler error:',
                error.message
            );

        } finally {

            running = false;
        }
    }

    // Check immediately when server starts.
    void tick();

    // Check every minute afterward.
    const timer = setInterval(
        () => void tick(),
        CHECK_EVERY_MS
    );

    timer.unref?.();

    console.log(
        '[Coach summary] Midnight scheduler enabled (Asia/Kuala_Lumpur).'
    );

    return () => clearInterval(timer);
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    malaysiaHour,

    midnightMalaysiaAsUtc,

    runCoachDailySummaryCheck,

    startCoachDailySummaryScheduler

};
