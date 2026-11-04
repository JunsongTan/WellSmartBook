
require('dotenv').config();

const nodemailer = require('nodemailer');

const {
    buildCoachDailySummaryEmail
} = require('./bookingEmailHelpers');

// ======================================================
// WELLSMARTBOOK - DAILY SUMMARY GMAIL TEST
//
// Default: Preview only
// --send-test: Send ONE email to EMAIL_USER
//
// Does not update MySQL.
// Does not email real coaches.
// ======================================================

async function main() {

    const sender = String(
        process.env.EMAIL_USER || ''
    ).trim();

    const password =
        process.env.EMAIL_PASS;

    const sendTest =
        process.argv.includes('--send-test');

    // ==================================================
    // SAMPLE BOOKING (NOT A REAL CUSTOMER)
    // ==================================================

    const sampleSession = {

        bookingId: 999001,

        sessionDate: '2026-10-27',

        startTime: '10:00',

        endTime: '11:00',

        durationMinutes: 60,

        clientName: 'Test Customer',

        gymName: 'WellSmartBook Test Gym',

        gymAddress: 'Penang, Malaysia'
    };

    // ==================================================
    // GENERATE DAILY SUMMARY TEMPLATE
    // ==================================================

    const email = buildCoachDailySummaryEmail({

        coachName: 'Test Coach',

        sessionDate:
            sampleSession.sessionDate,

        sessions: [sampleSession]
    });

    console.log(
        '===================================='
    );

    console.log(
        'WELLSMARTBOOK DAILY SUMMARY TEST'
    );

    console.log(
        '===================================='
    );

    console.log(
        'Subject:',
        email.subject
    );

    console.log(
        'Body:\n',
        email.text
    );

    // ==================================================
    // PREVIEW MODE - NO EMAIL
    // ==================================================

    if (!sendTest) {

        console.log(
            '\nPREVIEW ONLY - no Gmail sent.'
        );

        console.log(
            'Use --send-test to send one test email.'
        );

        return;
    }

    // ==================================================
    // VERIFY EMAIL CONFIGURATION
    // ==================================================

    if (!sender || !password) {

        throw new Error(
            'EMAIL_USER or EMAIL_PASS is missing.'
        );
    }

    const transporter =
        nodemailer.createTransport({

            service: 'gmail',

            auth: {

                user: sender,

                pass: password
            }
        });

    // ==================================================
    // TEST GMAIL CONNECTION
    // ==================================================

    console.log(
        '\nChecking Gmail connection...'
    );

    await transporter.verify();

    console.log(
        'Gmail connection verified.'
    );

    // ==================================================
    // SEND TEST EMAIL TO YOUR OWN GMAIL ONLY
    // ==================================================

    console.log(
        'Sending one test email to EMAIL_USER...'
    );

    const result =
        await transporter.sendMail({

            from:
                `"WellSmartBook" <${sender}>`,

            to: sender,

            subject:
                `[TEST] ${email.subject}`,

            text:
                'TEST EMAIL - No real coaching appointment.\n\n' +
                email.text,

            html:
                '<p><strong>TEST EMAIL - No real coaching appointment.</strong></p>' +
                email.html
        });

    // ==================================================
    // CHECK SMTP ACCEPTANCE
    // ==================================================

    const accepted = (
        result.accepted || []
    ).some(
        address =>
            address.toLowerCase() ===
            sender.toLowerCase()
    );

    console.log(
        'Message ID:',
        result.messageId
    );

    console.log(
        'SMTP accepted:',
        accepted
    );

    console.log(
        'Rejected recipients:',
        result.rejected || []
    );

    if (!accepted) {

        throw new Error(
            'Gmail did not accept the test message.'
        );
    }

    console.log(
        '\nTEST EMAIL ACCEPTED BY GMAIL.'
    );

    console.log(
        'Check your Gmail Inbox or Spam folder.'
    );

    console.log(
        'No coach notification records were changed.'
    );
}

// ======================================================
// RUN
// ======================================================

main().catch(error => {

    console.error(
        'Email test failed:',
        error.message
    );

    process.exitCode = 1;
});
