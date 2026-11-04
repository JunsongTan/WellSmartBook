
 // ======================================================
 // STEP 2.10.1G
 // COACH DAILY SUMMARY SCHEDULER DRY RUN
 //
 // No actual Gmail will be sent.
 // No notification records will be created.
 // ======================================================

require('dotenv').config();

const mysql = require('mysql2');

const {
    runCoachDailySummaryCheck
} = require('./coachDailySummaryScheduler');

// ======================================================
// CONNECT TO EXISTING MYSQL DATABASE
// ======================================================

const bookingPool = mysql.createPool({

    host: process.env.DB_HOST || 'localhost',

    user: process.env.DB_USER || 'root',

    password: process.env.DB_PASSWORD || '',

    database:
        process.env.DB_NAME || 'wellsmartbook_db',

    port: Number(process.env.DB_PORT || 3306),

    waitForConnections: true,

    connectionLimit: 2
});

// ======================================================
// BLOCK REAL EMAIL SENDING DURING THE TEST
// ======================================================

const noEmailTransporter = {

    async sendMail() {

        throw new Error(
            'DRY RUN: sending email is not allowed.'
        );
    }
};

// ======================================================
// RUN TESTS
// ======================================================

async function main() {

    const sql = bookingPool.promise();

    // ==============================================
    // CHECK DATABASE BEFORE TEST
    // ==============================================

    const [beforeRows] = await sql.query(
        `
        SELECT COUNT(*) AS total
        FROM coach_email_notifications
        `
    );

    console.log(
        'Notifications BEFORE:',
        beforeRows[0].total
    );

    // ==============================================
    // TEST A — MIDNIGHT PREVIEW
    //
    // 26 October 2026, 12:05 AM Malaysia time.
    // ==============================================

    const midnightPreview =
        await runCoachDailySummaryCheck({

            bookingPool,

            transporter: noEmailTransporter,

            now: new Date(
                '2026-10-25T16:05:00Z'
            ),

            previewOnly: true

        });

    console.log(
        'Preview date:',
        midnightPreview.sessionDate
    );

    console.log(
        'Preview coaches:',
        midnightPreview.coaches
    );

    // ==============================================
    // TEST B — OUTSIDE MIDNIGHT HOUR
    //
    // 26 October 2026, 1:00 PM Malaysia time.
    // ==============================================

    const daytimeCheck =
        await runCoachDailySummaryCheck({

            bookingPool,

            transporter: noEmailTransporter,

            now: new Date(
                '2026-10-26T05:00:00Z'
            ),

            previewOnly: false

        });

    console.log(
        'Daytime result:',
        daytimeCheck.skipped
    );

    // ==============================================
    // CHECK DATABASE AFTER TEST
    // ==============================================

    const [afterRows] = await sql.query(
        `
        SELECT COUNT(*) AS total
        FROM coach_email_notifications
        `
    );

    console.log(
        'Notifications AFTER:',
        afterRows[0].total
    );

    // ==============================================
    // VALIDATE RESULTS
    // ==============================================

    if (
        Number(beforeRows[0].total) !==
        Number(afterRows[0].total)
    ) {

        throw new Error(
            'Unexpected notification database change.'
        );
    }

    if (
        daytimeCheck.skipped !==
        'Outside Malaysia midnight hour'
    ) {

        throw new Error(
            'Daytime check was not skipped.'
        );
    }

    console.log(
        'PASS — preview only, zero Gmail messages sent.'
    );
}

// ======================================================
// START TEST
// ======================================================

main()

    .catch(error => {

        console.error(
            'Dry-run FAILED:',
            error.message
        );

        process.exitCode = 1;
    })

    .finally(async () => {

        await bookingPool.promise().end();
    });
