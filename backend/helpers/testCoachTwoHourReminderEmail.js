
require('dotenv').config();

const nodemailer = require('nodemailer');

const {
    buildCoachTwoHourReminderEmail
} = require('./bookingEmailHelpers');

// ======================================================
// WELLSMARTBOOK - TWO-HOUR REMINDER GMAIL TEST
//
// Normal run: Preview only
// --send-test: Send ONE email to EMAIL_USER
//
// No real booking is modified.
// No notification database records are created.
// ======================================================

async function main() {

    const sendTest =
        process.argv.includes('--send-test');

    // ==================================================
    // SAMPLE COACHING SESSION
    // ==================================================

    const session = {

        bookingId: 999002,

        sessionDate: '2026-10-27',

        startTime: '10:00:00',

        endTime: '11:00:00',

        durationMinutes: 60,

        clientName: 'Test Customer',

        gymName: 'WellSmartBook Test Gym',

        gymAddress: 'Penang, Malaysia'
    };

    // ==================================================
    // GENERATE THE REMINDER EMAIL
    // ==================================================

    const email = buildCoachTwoHourReminderEmail({

        coachName: 'Test Coach',

        session
    });

    console.log('================================');
    console.log('COACH TWO-HOUR REMINDER TEST');
    console.log('================================');

    console.log('Subject:', email.subject);
    console.log('Body:\n' + email.text);

    // ==================================================
    // PREVIEW MODE - NO EMAIL
    // ==================================================

    if (!sendTest) {

        console.log(
            '\nPREVIEW ONLY - no Gmail sent.'
        );

        console.log(
            'Use --send-test to send to EMAIL_USER.'
        );

        return;
    }

    // ==================================================
    // CHECK EMAIL SETTINGS
    // ==================================================

    const sender = String(
        process.env.EMAIL_USER || ''
    ).trim();

    const password =
        process.env.EMAIL_PASS;

    if (!sender || !password) {

        throw new Error(
            'EMAIL_USER or EMAIL_PASS is missing.'
        );
    }

    // ==================================================
    // CREATE GMAIL TRANSPORTER FOR THIS TEST
    // ==================================================

    const transporter =
        nodemailer.createTransport({

            service: 'gmail',

            auth: {

                user: sender,

                pass: password
            }
        });

    // ==================================================
    // VERIFY GMAIL CONNECTION
    // ==================================================

    console.log('\nChecking Gmail connection...');

    await transporter.verify();

    console.log('Gmail connection verified.');

    // ==================================================
    // SEND ONE TEST EMAIL TO YOUR OWN GMAIL
    // ==================================================

    console.log(
        'Sending one test email to EMAIL_USER...'
    );

    const result = await transporter.sendMail({

        from:
            `"WellSmartBook" <${sender}>`,

        to: sender,

        subject:
            `[TEST] ${email.subject}`,

        text:
            'TEST EMAIL - Not a real coaching appointment.\n\n' +
            email.text,

        html:
            '<p><strong>TEST EMAIL - Not a real coaching appointment.</strong></p>' +
            email.html
    });

    // ==================================================
    // CHECK WHETHER GMAIL ACCEPTED THE EMAIL
    // ==================================================

    const accepted = (
        result.accepted || []
    ).some(
        address =>
            String(address).toLowerCase() ===
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
            'Gmail did not accept the test recipient.'
        );
    }

    console.log(
        'TEST REMINDER EMAIL ACCEPTED BY GMAIL.'
    );

    console.log(
        'Check your Gmail Inbox, Spam or All Mail.'
    );

    console.log(
        'No coach notification records were changed.'
    );
}

// ======================================================
// RUN TEST
// ======================================================

main().catch(error => {

    console.error(
        'Reminder email test failed:',
        error.message
    );

    process.exitCode = 1;
});
