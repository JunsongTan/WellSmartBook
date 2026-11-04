// ======================================================
// BOOKING EMAIL HELPERS
// ======================================================


// ======================================================
// ESCAPE HTML
// ======================================================

function escapeBookingEmailHtml(
    value
) {

    return String(
        value ?? ''
    )
        .replaceAll(
            '&',
            '&amp;'
        )
        .replaceAll(
            '<',
            '&lt;'
        )
        .replaceAll(
            '>',
            '&gt;'
        )
        .replaceAll(
            '"',
            '&quot;'
        )
        .replaceAll(
            "'",
            '&#039;'
        );
}


// ======================================================
// FORMAT BOOKING EMAIL TIME
// ======================================================

function formatBookingEmailTime(
    value
) {

    const match =
        String(
            value || ''
        ).match(
            /^(\d{2}):(\d{2})/
        );


    if (!match) {

        return String(
            value || ''
        );
    }


    const hour =
        Number(
            match[1]
        );


    const minute =
        match[2];


    const suffix =
        hour >= 12
            ? 'PM'
            : 'AM';


    const displayHour =
        hour % 12 ||
        12;


    return `${displayHour}:${minute} ${suffix}`;
}


// ======================================================
// FORMAT BOOKING EMAIL DATE
// ======================================================

function formatBookingEmailDate(
    value
) {

    const text =
        String(
            value || ''
        ).trim();


    if (
        !/^\d{4}-\d{2}-\d{2}$/
            .test(
                text
            )
    ) {

        return text;
    }


    const [
        year,
        month,
        day
    ] =
        text
            .split('-')
            .map(
                Number
            );


    return new Intl
        .DateTimeFormat(
            'en-MY',
            {
                weekday:
                    'short',

                day:
                    '2-digit',

                month:
                    'short',

                year:
                    'numeric',

                timeZone:
                    'UTC'
            }
        )
        .format(
            new Date(
                Date.UTC(
                    year,
                    month - 1,
                    day
                )
            )
        );
}

// ======================================================
// SEND PAYMENT SUCCESS EMAIL
// ======================================================



async function sendBookingConfirmationEmail(
    transporter,
    bookings,
    session
) {

    if (
        !Array.isArray(
            bookings
        ) ||
        bookings.length ===
            0
    ) {

        return;
    }


    const first =
        bookings[0];


    const recipientEmail =
        String(
            first.client_email ||
            ''
        ).trim();


    if (!recipientEmail) {

        console.warn(
            'Payment confirmed, but the user email is missing.'
        );

        return;
    }


    const clientName =
        first.client_name ||
        first.username ||
        'WellSmartBook User';


    const currency =
        first.currency ||
        'MYR';


    const totalAmount =
        bookings.reduce(
            (
                total,
                booking
            ) =>
                total +
                Number(
                    booking.amount ||
                    0
                ),
            0
        );


    const paymentReference =
        typeof session.payment_intent ===
            'string'
            ? session.payment_intent
            : session.id;


    const textSessions =
        bookings
            .map(
                (
                    booking,
                    index
                ) => {

                    const lines = [

                        `Session ${index + 1}`,

                        `Coach: ${booking.coach_name}`,

                        `Gym: ${booking.gym_name}`,

                        booking.gym_address
                            ? `Location: ${booking.gym_address}`
                            : null,

                        `Date: ${formatBookingEmailDate(
                            booking.session_date
                        )}`,

                        `Time: ${formatBookingEmailTime(
                            booking.start_time
                        )} - ${formatBookingEmailTime(
                            booking.end_time
                        )}`,

                        `Duration: ${Number(
                            booking.session_duration_minutes ||
                            0
                        )} minutes`,

                        `Price: ${currency} ${Number(
                            booking.amount ||
                            0
                        ).toFixed(2)}`
                    ];


                    return lines
                        .filter(
                            Boolean
                        )
                        .join(
                            '\n'
                        );
                }
            )
            .join(
                '\n\n'
            );


    const sessionCards =
        bookings
            .map(
                (
                    booking,
                    index
                ) => `

                    <div
                        style="
                            border:1px solid #dbe4f0;
                            border-radius:12px;
                            padding:16px;
                            margin-top:14px;
                            background:#f8fbff;
                        "
                    >

                        <div
                            style="
                                font-size:12px;
                                font-weight:700;
                                color:#0759d9;
                            "
                        >
                            SESSION ${index + 1}
                        </div>

                        <div
                            style="
                                margin-top:8px;
                                font-size:17px;
                                font-weight:700;
                                color:#0f172a;
                            "
                        >
                            ${escapeBookingEmailHtml(
                                booking.coach_name
                            )}
                        </div>

                        <div style="margin-top:8px;">
                            <strong>
                                Gym:
                            </strong>

                            ${escapeBookingEmailHtml(
                                booking.gym_name
                            )}
                        </div>

                        ${
                            booking.gym_address
                                ? `
                                    <div style="margin-top:6px;">
                                        <strong>
                                            Location:
                                        </strong>

                                        ${escapeBookingEmailHtml(
                                            booking.gym_address
                                        )}
                                    </div>
                                `
                                : ''
                        }

                        <div style="margin-top:6px;">
                            <strong>
                                Date:
                            </strong>

                            ${escapeBookingEmailHtml(
                                formatBookingEmailDate(
                                    booking.session_date
                                )
                            )}
                        </div>

                        <div style="margin-top:6px;">
                            <strong>
                                Time:
                            </strong>

                            ${escapeBookingEmailHtml(
                                formatBookingEmailTime(
                                    booking.start_time
                                )
                            )}

                            -

                            ${escapeBookingEmailHtml(
                                formatBookingEmailTime(
                                    booking.end_time
                                )
                            )}
                        </div>

                        <div style="margin-top:6px;">
                            <strong>
                                Duration:
                            </strong>

                            ${Number(
                                booking.session_duration_minutes ||
                                0
                            )}
                            minutes
                        </div>

                        <div style="margin-top:6px;">
                            <strong>
                                Price:
                            </strong>

                            ${escapeBookingEmailHtml(
                                currency
                            )}

                            ${Number(
                                booking.amount ||
                                0
                            ).toFixed(2)}
                        </div>

                    </div>
                `
            )
            .join('');


    await transporter.sendMail({

        from:
            `"WellSmartBook" <${process.env.EMAIL_USER}>`,

        to:
            recipientEmail,

        subject:
            'WellSmartBook - Payment Successful & Coaching Booking Confirmed',

        text:
            `Hi ${clientName},

Your payment was successful and your coaching booking has been confirmed.

${textSessions}

Total paid: ${currency} ${totalAmount.toFixed(2)}

Payment reference: ${paymentReference}

Thank you for using WellSmartBook.`,

        html: `

            <div
                style="
                    font-family:Arial,sans-serif;
                    background:#f1f5f9;
                    padding:28px;
                    color:#0f172a;
                "
            >

                <div
                    style="
                        max-width:620px;
                        margin:auto;
                        background:#ffffff;
                        border-radius:16px;
                        padding:28px;
                        border:1px solid #e2e8f0;
                    "
                >

                    <h2
                        style="
                            margin:0;
                            color:#0759d9;
                        "
                    >
                        WellSmartBook
                    </h2>

                    <div
                        style="
                            margin-top:18px;
                            font-size:12px;
                            font-weight:700;
                            color:#16a34a;
                        "
                    >
                        PAYMENT SUCCESSFUL
                    </div>

                    <h3>
                        Your coaching booking is confirmed
                    </h3>

                    <p>
                        Hi
                        ${escapeBookingEmailHtml(
                            clientName
                        )},
                        your Stripe payment was received successfully.
                    </p>

                    ${sessionCards}

                    <div
                        style="
                            margin-top:20px;
                            padding:16px;
                            border-radius:12px;
                            background:#ecfdf5;
                        "
                    >

                        <div
                            style="
                                font-size:12px;
                                font-weight:700;
                                color:#047857;
                            "
                        >
                            TOTAL PAID
                        </div>

                        <div
                            style="
                                margin-top:4px;
                                font-size:24px;
                                font-weight:800;
                            "
                        >
                            ${escapeBookingEmailHtml(
                                currency
                            )}

                            ${totalAmount.toFixed(2)}
                        </div>

                    </div>

                    <p
                        style="
                            margin-top:18px;
                            font-size:12px;
                            color:#64748b;
                        "
                    >
                        Payment reference:
                        ${escapeBookingEmailHtml(
                            paymentReference
                        )}
                    </p>

                </div>

            </div>
        `
    });
}


 // ======================================================
 // COACH EMAIL: REUSABLE SESSION FORMATTING
 // ======================================================

function formatCoachSessionText(session, index) {

    const gymAddress = session.gymAddress
        ? `\n   Address: ${session.gymAddress}`
        : '';

    return [
        `${index + 1}. ${formatBookingEmailTime(session.startTime)} - ${formatBookingEmailTime(session.endTime)}`,

        `   Client: ${session.clientName || 'Client'}`,

        `   Gym: ${session.gymName || 'Gym not specified'}`,

        gymAddress,

        `   Duration: ${Number(session.durationMinutes || 0)} minutes`,

        `   Booking ID: #${session.bookingId}`

    ].filter(Boolean).join('\n');
}


// ======================================================
// COACH SESSION HTML CARD
// ======================================================

function formatCoachSessionHtml(session, index) {

    const time =
        `${formatBookingEmailTime(session.startTime)} - ${formatBookingEmailTime(session.endTime)}`;

    const addressHtml = session.gymAddress
        ? `
            <p style="margin:6px 0;">
                <strong>Address:</strong>
                ${escapeBookingEmailHtml(session.gymAddress)}
            </p>
        `
        : '';

    return `
        <div style="
            padding:16px;
            margin:12px 0;
            border:1px solid #dbe4f0;
            border-radius:12px;
            background:#f8fbff;
        ">

            <p style="
                margin:0 0 8px;
                color:#0759d9;
                font-weight:700;
            ">
                SESSION ${index + 1}
            </p>

            <p>
                <strong>Time:</strong>
                ${escapeBookingEmailHtml(time)}
            </p>

            <p>
                <strong>Client:</strong>
                ${escapeBookingEmailHtml(
                    session.clientName || 'Client'
                )}
            </p>

            <p>
                <strong>Gym:</strong>
                ${escapeBookingEmailHtml(
                    session.gymName || 'Gym not specified'
                )}
            </p>

            ${addressHtml}

            <p>
                <strong>Duration:</strong>
                ${escapeBookingEmailHtml(
                    Number(session.durationMinutes || 0)
                )} minutes
            </p>

            <p>
                <strong>Booking ID:</strong>
                #${escapeBookingEmailHtml(session.bookingId)}
            </p>

        </div>
    `;
}


// ======================================================
// EMAIL 1: DAILY COACHING SUMMARY
//
// Will be sent at 12:00 AM Malaysia time.
// ======================================================

function buildCoachDailySummaryEmail({
    coachName = 'Coach',
    sessionDate,
    sessions = []
} = {}) {

    const bookings = Array.isArray(sessions)
        ? sessions
        : [];

    const dateLabel =
        formatBookingEmailDate(sessionDate);

    const total = bookings.length;

    const countLabel =
        `${total} confirmed coaching session${total === 1 ? '' : 's'}`;

    // ==================================================
    // PLAIN TEXT VERSION
    // ==================================================

    const text = [

        `Hello ${coachName},`,

        '',

        `Here is your WellSmartBook coaching schedule for ${dateLabel} (Malaysia time).`,

        `You have ${countLabel} today.`,

        '',

        total
            ? bookings
                .map(formatCoachSessionText)
                .join('\n\n')
            : 'No confirmed coaching sessions scheduled for today.',

        '',

        'Please check your Coach Portal for any last-minute booking changes.',

        'WellSmartBook'

    ].join('\n');

    // ==================================================
    // HTML VERSION
    // ==================================================

    const cards = total
        ? bookings
            .map(formatCoachSessionHtml)
            .join('')
        : '<p>No confirmed coaching sessions scheduled for today.</p>';

    const html = `

        <div style="
            font-family:Arial,sans-serif;
            background:#f1f5f9;
            padding:24px;
            color:#0f172a;
        ">

            <div style="
                max-width:620px;
                margin:auto;
                background:white;
                border:1px solid #dbe4f0;
                border-radius:16px;
                padding:24px;
            ">

                <h2 style="
                    margin-top:0;
                    color:#0759d9;
                ">
                    WellSmartBook
                </h2>

                <h3>
                    Today's Coaching Summary
                </h3>

                <p>
                    Hello
                    ${escapeBookingEmailHtml(coachName)},
                </p>

                <p>
                    Here is your schedule for

                    <strong>
                        ${escapeBookingEmailHtml(dateLabel)}
                    </strong>

                    (Malaysia time).
                </p>

                <p>
                    <strong>
                        ${escapeBookingEmailHtml(countLabel)}
                    </strong>
                </p>

                ${cards}

                <p style="
                    color:#64748b;
                    font-size:13px;
                ">
                    Booking details can change.
                    Please check your Coach Portal
                    before your sessions.
                </p>

            </div>

        </div>
    `;

    return {

        subject:
            `WellSmartBook - Daily Coaching Summary - ${dateLabel}`,

        text,

        html
    };
}


// ======================================================
// EMAIL 2: TWO-HOUR COACHING REMINDER
//
// Will be sent 2 hours before coaching.
// ======================================================

function buildCoachTwoHourReminderEmail({
    coachName = 'Coach',
    session
} = {}) {

    if (!session || typeof session !== 'object') {

        throw new Error(
            'A coaching session is required for the reminder.'
        );
    }

    const dateLabel =
        formatBookingEmailDate(session.sessionDate);

    const startTime =
        formatBookingEmailTime(session.startTime);

    // ==================================================
    // PLAIN TEXT VERSION
    // ==================================================

    const text = [

        `Hello ${coachName},`,

        '',

        'Your upcoming coaching session starts in approximately 2 hours.',

        `Date: ${dateLabel} (Malaysia time)`,

        '',

        formatCoachSessionText(session, 0),

        '',

        'Please check your Coach Portal for any last-minute booking changes.',

        'WellSmartBook'

    ].join('\n');

    // ==================================================
    // HTML VERSION
    // ==================================================

    const html = `

        <div style="
            font-family:Arial,sans-serif;
            background:#f1f5f9;
            padding:24px;
            color:#0f172a;
        ">

            <div style="
                max-width:620px;
                margin:auto;
                background:white;
                border:1px solid #dbe4f0;
                border-radius:16px;
                padding:24px;
            ">

                <h2 style="
                    margin-top:0;
                    color:#0759d9;
                ">
                    WellSmartBook
                </h2>

                <h3>
                    Coaching Session Reminder
                </h3>

                <p>
                    Hello
                    ${escapeBookingEmailHtml(coachName)},
                </p>

                <p>
                    Your coaching session starts in
                    approximately

                    <strong>2 hours</strong>.
                </p>

                <p>
                    <strong>
                        ${escapeBookingEmailHtml(dateLabel)}

                        at

                        ${escapeBookingEmailHtml(startTime)}
                    </strong>

                    (Malaysia time)
                </p>

                ${formatCoachSessionHtml(session, 0)}

                <p style="
                    color:#64748b;
                    font-size:13px;
                ">
                    Please check your Coach Portal
                    for any last-minute booking changes.
                </p>

            </div>

        </div>
    `;

    return {

        subject:
            `WellSmartBook - Coaching Reminder - ${dateLabel} ${startTime}`,

        text,

        html
    };
}



// ======================================================
// EXPORT
// ======================================================


module.exports = {

    
    escapeBookingEmailHtml,

    formatBookingEmailTime,

    formatBookingEmailDate,

    sendBookingConfirmationEmail,

    
    buildCoachDailySummaryEmail,

    buildCoachTwoHourReminderEmail

};
