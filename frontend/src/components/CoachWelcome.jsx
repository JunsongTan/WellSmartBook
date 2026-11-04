
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ======================================================
// API CONFIGURATION
// ======================================================

const API_BASE_URL =
    `http://${window.location.hostname}:5000`;

// ======================================================
// FORMAT SESSION DATE
// ======================================================

function formatSessionDate(value) {

    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
            String(value || '')
        )
    ) {
        return String(value || '');
    }

    const date =
        new Date(`${value}T12:00:00+08:00`);

    return new Intl.DateTimeFormat(
        'en-MY',
        {
            timeZone: 'Asia/Kuala_Lumpur',
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        }
    ).format(date);
}

// ======================================================
// FORMAT SESSION TIME
// ======================================================

function formatSessionTime(value) {

    const match =
        /^(\d{2}):(\d{2})/.exec(
            String(value || '')
        );

    if (!match) {
        return String(value || '');
    }

    const hour = Number(match[1]);

    return (
        `${hour % 12 || 12}:${match[2]} ` +
        `${hour >= 12 ? 'PM' : 'AM'}`
    );
}

// ======================================================
// COACH DASHBOARD
// ======================================================

export default function CoachWelcome() {

    const navigate = useNavigate();

    // ==================================================
    // STATES
    // ==================================================

    const [coach, setCoach] =
        useState(null);

    const [profileLoading, setProfileLoading] =
        useState(true);

    const [profileError, setProfileError] =
        useState('');

    const [sessions, setSessions] =
        useState([]);

    const [sessionsLoading, setSessionsLoading] =
        useState(true);

    const [sessionsError, setSessionsError] =
        useState('');

    const [refreshKey, setRefreshKey] =
        useState(0);

    // ==================================================
    // LOAD COACH PROFILE
    // ==================================================

    useEffect(() => {

        const controller =
            new AbortController();

        async function loadProfile() {

            setProfileLoading(true);
            setProfileError('');

            try {

                const token =
                    localStorage.getItem('token');

                if (!token) {
                    navigate('/login');
                    return;
                }

                const response = await fetch(
                    `${API_BASE_URL}/api/coach/profile`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        },

                        signal: controller.signal
                    }
                );

                const data =
                    await response.json();

                if (controller.signal.aborted) {
                    return;
                }

                if (
                    response.status === 401 ||
                    response.status === 403
                ) {

                    if (data.code === 'COACH_BLOCKED') {

                        setProfileError(
                            data.message ||
                            'Coach account is blocked.'
                        );

                    } else {

                        navigate('/login');
                    }

                    return;
                }

                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        'Unable to load coach profile.'
                    );
                }

                setCoach(data.coach);

            } catch (err) {

                if (
                    err.name !== 'AbortError' &&
                    !controller.signal.aborted
                ) {

                    setProfileError(
                        err.message ||
                        'Unable to load coach profile.'
                    );
                }

            } finally {

                if (!controller.signal.aborted) {
                    setProfileLoading(false);
                }
            }
        }

        loadProfile();

        return () => {
            controller.abort();
        };

    }, [navigate]);

    // ==================================================
    // LOAD UPCOMING COACHING SESSIONS
    // ==================================================

    useEffect(() => {

        const controller =
            new AbortController();

        let active = true;

        async function loadUpcoming(
            silent = false
        ) {

            if (!silent) {
                setSessionsLoading(true);
            }

            setSessionsError('');

            try {

                const token =
                    localStorage.getItem('token');

                if (!token) {
                    throw new Error(
                        'Please log in again.'
                    );
                }

                const response = await fetch(
                    `${API_BASE_URL}/api/coach/bookings/upcoming`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        },

                        signal: controller.signal
                    }
                );

                const data =
                    await response.json();

                if (
                    !response.ok ||
                    data.success === false
                ) {

                    throw new Error(
                        data.message ||
                        'Unable to load upcoming sessions.'
                    );
                }

                if (active) {

                    setSessions(
                        Array.isArray(data.bookings)
                            ? data.bookings
                            : []
                    );
                }

            } catch (err) {

                if (
                    active &&
                    err.name !== 'AbortError'
                ) {

                    setSessionsError(
                        err.message ||
                        'Unable to load upcoming sessions.'
                    );
                }

            } finally {

                if (active && !silent) {
                    setSessionsLoading(false);
                }
            }
        }

        // Load immediately.

        loadUpcoming();

        // Refresh every 60 seconds.

        const timer = window.setInterval(
            () => loadUpcoming(true),
            60000
        );

        return () => {

            active = false;

            controller.abort();

            window.clearInterval(timer);
        };

    }, [refreshKey]);

    // ==================================================
    // RENDER
    // ==================================================

    return (

        <div className="cwd-page">

            <style>
                {dashboardCss}
            </style>

            {profileLoading ? (

                <div className="cwd-loading">

                    Loading Coach Dashboard...

                </div>

            ) : profileError ? (

                <div
                    className="cwd-error"
                    role="alert"
                >

                    <h2>
                        Coach Account Unavailable
                    </h2>

                    <p>
                        {profileError}
                    </p>

                </div>

            ) : (

                <>

                    {/* ==================================
                        DASHBOARD HEADER
                    ================================== */}

                    <header className="cwd-heading">

                        <div>

                            <span className="cwd-eyebrow">
                                COACH DASHBOARD
                            </span>

                            <h1>
                                Welcome back,{' '}
                                {coach?.fullName || 'Coach'}
                            </h1>

                            <p>
                                View your coaching profile,
                                locations and upcoming sessions.
                            </p>

                        </div>

                        <button
                            type="button"
                            className="cwd-primary"

                            onClick={() =>
                                navigate('/coach/gyms')
                            }
                        >
                            View Gym Locations →
                        </button>

                    </header>

                    {/* ==================================
                        COACH SUMMARY CARDS
                    ================================== */}

                    <div className="cwd-summary">

                        {/* SPECIALIZATION */}

                        <article>

                            <span>
                                SPECIALIZATION
                            </span>

                            <strong>
                                {coach?.specialization || '—'}
                            </strong>

                            <small>
                                Primary coaching expertise
                            </small>

                        </article>

                        {/* EXPERIENCE */}

                        <article>

                            <span>
                                EXPERIENCE
                            </span>

                            <strong>

                                {Number(
                                    coach?.yearsExperience ?? 0
                                )} years

                            </strong>

                            <small>
                                Professional experience
                            </small>

                        </article>

                        {/* SESSION PRICE */}

                        <article>

                            <span>
                                SESSION PRICE
                            </span>

                            <strong>

                                RM{' '}

                                {Number(
                                    coach?.defaultSessionPrice || 0
                                ).toFixed(2)}

                            </strong>

                            <small>
                                Default coaching price
                            </small>

                        </article>

                    </div>

                    {/* ==================================
                        UPCOMING COACHING SESSIONS
                    ================================== */}

                    <section className="cwd-upcoming">

                        {/* SECTION HEADER */}

                        <div className="cwd-upcoming-heading">

                            <div>

                                <span className="cwd-eyebrow">
                                    YOUR CALENDAR
                                </span>

                                <h2>
                                    Upcoming Coaching Sessions
                                </h2>

                                <p>
                                    Confirmed sessions from all
                                    of your gym locations.
                                </p>

                            </div>

                            <div className="cwd-actions">

                                <button
                                    type="button"
                                    className="cwd-secondary"

                                    disabled={sessionsLoading}

                                    onClick={() =>
                                        setRefreshKey(
                                            n => n + 1
                                        )
                                    }
                                >
                                    ↻ Refresh
                                </button>

                                <button
                                    type="button"
                                    className="cwd-primary"

                                    onClick={() =>
                                        navigate(
                                            '/coach/schedule'
                                        )
                                    }
                                >
                                    View Full Schedule →
                                </button>

                            </div>

                        </div>

                        {/* ==================================
                            LOADING
                        ================================== */}

                        {sessionsLoading ? (

                            <div
                                className="cwd-empty"
                                role="status"
                            >
                                Loading upcoming sessions...
                            </div>

                        ) : sessionsError ? (

                            /* ==========================
                                ERROR
                            ========================== */

                            <div
                                className="cwd-error"
                                role="alert"
                            >

                                {sessionsError}

                                <button
                                    type="button"
                                    className="cwd-secondary"

                                    onClick={() =>
                                        setRefreshKey(
                                            n => n + 1
                                        )
                                    }
                                >
                                    Try Again
                                </button>

                            </div>

                        ) : sessions.length === 0 ? (

                            /* ==========================
                                NO UPCOMING BOOKINGS
                            ========================== */

                            <div className="cwd-empty">

                                <div className="cwd-empty-icon">
                                    ▢
                                </div>

                                <h3>
                                    No upcoming sessions
                                </h3>

                                <p>
                                    Your confirmed coaching
                                    bookings will appear here
                                    automatically.
                                </p>

                                <button
                                    type="button"
                                    className="cwd-secondary"

                                    onClick={() =>
                                        navigate(
                                            '/coach/schedule'
                                        )
                                    }
                                >
                                    Open Schedule →
                                </button>

                            </div>

                        ) : (

                            /* ==========================
                                UPCOMING SESSION LIST
                            ========================== */

                            <div className="cwd-session-list">

                                {sessions.map(
                                    (session, index) => (

                                        <article
                                            key={session.bookingId}
                                            className="cwd-session"
                                        >

                                            {/* SESSION DATE */}

                                            <div className="cwd-session-date">

                                                <small>

                                                    {index === 0
                                                        ? 'NEXT SESSION'
                                                        : 'UPCOMING'}

                                                </small>

                                                <strong>

                                                    {formatSessionDate(
                                                        session.sessionDate
                                                    )}

                                                </strong>

                                                <span>

                                                    {formatSessionTime(
                                                        session.startTime
                                                    )}

                                                    {' – '}

                                                    {formatSessionTime(
                                                        session.endTime
                                                    )}

                                                </span>

                                            </div>

                                            {/* CLIENT AND LOCATION */}

                                            <div className="cwd-session-details">

                                                <strong>

                                                    {session.clientName ||
                                                        'Client'}

                                                </strong>

                                                <span>

                                                    ⌖{' '}

                                                    {session.gymName ||
                                                        'Gym location'}

                                                </span>

                                                <span>

                                                    {session.durationMinutes}

                                                    {' min coaching session'}

                                                </span>

                                            </div>

                                            {/* STATUS */}

                                            <span className="cwd-confirmed">
                                                Confirmed
                                            </span>

                                        </article>

                                    )
                                )}

                            </div>

                        )}

                    </section>

                </>

            )}

        </div>
    );
}

// ======================================================
// CSS INSIDE COACHWELCOME.JSX
// ======================================================

const dashboardCss = `

.cwd-page {
    width: 100%;
    max-width: 1450px;
    margin: 0 auto;
    min-width: 0;
    color: #172033;
}

.cwd-page * {
    box-sizing: border-box;
}

/* ======================================================
   DASHBOARD HEADER
====================================================== */

.cwd-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 23px;
}

.cwd-heading h1 {
    font-size: 28px;
    margin: 7px 0;
    line-height: 1.25;
}

.cwd-heading p,
.cwd-upcoming-heading p {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: #64748b;
}

.cwd-eyebrow {
    display: block;
    color: #0759d9;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .8px;
}

/* ======================================================
   BUTTONS
====================================================== */

.cwd-primary,
.cwd-secondary {
    padding: 11px 16px;
    border-radius: 9px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    font-family: inherit;
}

.cwd-primary {
    border: 1px solid #0759d9;
    background: #0759d9;
    color: white;
}

.cwd-primary:hover {
    background: #0045b6;
}

.cwd-secondary {
    border: 1px solid #cad8ee;
    background: white;
    color: #0759d9;
}

.cwd-secondary:hover {
    background: #eaf2ff;
}

.cwd-page button:disabled {
    cursor: not-allowed;
    opacity: .5;
}

/* ======================================================
   COACH SUMMARY CARDS
====================================================== */

.cwd-summary {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 15px;
    margin-bottom: 22px;
}

.cwd-summary article {
    padding: 23px;
    border: 1px solid #e2e8f0;
    border-radius: 15px;
    background: white;

    display: flex;
    flex-direction: column;
    gap: 10px;

    min-width: 0;
}

.cwd-summary article > span {
    font-size: 11px;
    color: #94a3b8;
    font-weight: 800;
}

.cwd-summary article > strong {
    color: #172033;
    font-size: 20px;
    overflow-wrap: anywhere;
}

.cwd-summary article > small {
    color: #64748b;
    font-size: 12px;
}

/* ======================================================
   UPCOMING SESSION PANEL
====================================================== */

.cwd-upcoming {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 24px;
}

.cwd-upcoming-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 18px;
}

.cwd-upcoming-heading h2 {
    margin: 7px 0;
    font-size: 22px;
}

.cwd-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

/* ======================================================
   UPCOMING SESSIONS LIST
====================================================== */

.cwd-session-list {
    display: grid;
    gap: 12px;
}

.cwd-session {
    display: grid;
    grid-template-columns:
        minmax(200px, 1fr)
        minmax(170px, 1fr)
        auto;

    gap: 15px;
    align-items: center;

    padding: 17px 19px;

    border: 1px solid #dce6f5;
    border-radius: 12px;
    background: #f8fbff;
}

.cwd-session:first-child {
    background: #eef5ff;
    border-color: #c6d9ff;
}

.cwd-session-date,
.cwd-session-details {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
}

.cwd-session-date small {
    font-size: 10px;
    letter-spacing: .5px;
    font-weight: 800;
    color: #0759d9;
}

.cwd-session-date strong,
.cwd-session-details strong {
    color: #142b4d;
    font-size: 15px;
}

.cwd-session-date span,
.cwd-session-details span {
    font-size: 12px;
    color: #64748b;
    overflow-wrap: anywhere;
}

/* ======================================================
   CONFIRMED BADGE
====================================================== */

.cwd-confirmed {
    border-radius: 99px;
    padding: 7px 10px;
    background: #dcfce7;
    color: #15803d;
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
}

/* ======================================================
   EMPTY AND ERROR STATES
====================================================== */

.cwd-empty {
    text-align: center;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
    padding: 36px 16px;
    color: #64748b;
    font-size: 13px;
    background: #f8fbff;
}

.cwd-empty-icon {
    color: #0759d9;
    font-size: 34px;
    margin-bottom: 8px;
}

.cwd-empty h3 {
    margin: 0 0 8px;
    font-size: 17px;
    color: #172033;
}

.cwd-empty p {
    line-height: 1.6;
    margin: 0 0 15px;
}

.cwd-loading {
    text-align: center;
    padding: 70px 16px;
    color: #64748b;
}

.cwd-error {
    border: 1px solid #fecaca;
    border-radius: 11px;
    padding: 20px;
    background: #fff1f2;
    color: #b42318;

    display: flex;
    flex-direction: column;
    align-items: start;
    gap: 10px;
}

.cwd-error h2,
.cwd-error p {
    margin: 0;
}

/* ======================================================
   TABLET
====================================================== */

@media (max-width: 1050px) {

    .cwd-session {
        grid-template-columns:
            minmax(0, 1fr)
            minmax(0, 1fr);
    }

    .cwd-confirmed {
        justify-self: start;
    }

}

/* ======================================================
   MOBILE
====================================================== */

@media (max-width: 700px) {

    .cwd-heading,
    .cwd-upcoming-heading {
        align-items: stretch;
        flex-direction: column;
    }

    .cwd-summary {
        grid-template-columns: 1fr;
        gap: 11px;
    }

    .cwd-summary article {
        padding: 17px;
    }

    .cwd-upcoming {
        padding: 15px;
    }

    .cwd-session {
        grid-template-columns: 1fr;
        gap: 10px;
        padding: 15px;
    }

    .cwd-actions {
        width: 100%;
    }

    .cwd-actions button {
        flex: 1;
    }

    .cwd-heading > button {
        align-self: stretch;
    }

    .cwd-heading h1 {
        font-size: 23px;
    }

    .cwd-upcoming-heading h2 {
        font-size: 19px;
    }

}

`;
