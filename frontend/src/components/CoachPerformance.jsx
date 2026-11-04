import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ======================================================
// COACH PERFORMANCE DASHBOARD
// Data: GET /api/coach/performance
// CSS remains inside this JSX file.
// ======================================================

const API_BASE_URL = `http://${window.location.hostname}:5000`;

function formatMoney(value) {
    return new Intl.NumberFormat('en-MY', {
        style: 'currency',
        currency: 'MYR',
        minimumFractionDigits: 2
    }).format(Number(value) || 0);
}

function formatMonth(value) {
    if (!/^\d{4}-\d{2}$/.test(String(value || ''))) {
        return String(value || '');
    }

    const [year, month] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en-MY', {
        month: 'short',
        timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
        return String(value || '');
    }

    const [year, month, day] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('en-MY', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatTime(value) {
    const match = /^(\d{2}):(\d{2})/.exec(String(value || ''));
    if (!match) return String(value || '');

    const hour = Number(match[1]);
    return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function statusLabel(value) {
    return String(value || 'unknown').replace(/_/g, ' ');
}

export default function CoachPerformance() {
    const navigate = useNavigate();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);
    const [chartMetric, setChartMetric] = useState('value');

    // ==================================================
    // LOAD COACH-OWNED PERFORMANCE DATA
    // ==================================================

    useEffect(() => {
        const controller = new AbortController();

        async function loadPerformance() {
            setLoading(true);
            setError('');

            try {
                const token = localStorage.getItem('token');
                if (!token) throw new Error('Please log in as a coach.');

                const response = await fetch(
                    `${API_BASE_URL}/api/coach/performance`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        signal: controller.signal
                    }
                );

                const result = await response.json();

                if (!response.ok || result.success !== true) {
                    throw new Error(
                        result.message || 'Unable to load coach performance.'
                    );
                }

                if (!controller.signal.aborted) {
                    setData(result);
                }
            } catch (requestError) {
                if (
                    !controller.signal.aborted &&
                    requestError.name !== 'AbortError'
                ) {
                    setError(requestError.message || 'Unable to load performance.');
                    setData(null);
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        loadPerformance();
        return () => controller.abort();
    }, [refreshKey]);

    // ==================================================
    // CHART DATA (REAL MYSQL RESULTS ONLY)
    // ==================================================

    const months = Array.isArray(data?.monthly) ? data.monthly : [];

    const chartValues = useMemo(() => months.map(item =>
        chartMetric === 'value'
            ? Number(item.paidSessionValue) || 0
            : Number(item.sessions) || 0
    ), [months, chartMetric]);

    const highest = Math.max(1, ...chartValues);
    const hasChartData = chartValues.some(value => value > 0);
    const summary = data?.summary || {};
    const recentSessions = Array.isArray(data?.recentSessions)
        ? data.recentSessions
        : [];

    const currentMonth = data?.period?.month || '';

    return (
        <main className="cpd-page">
            <style>{performanceCss}</style>

            {/* PAGE HEADER */}
            <header className="cpd-header">
                <div>
                    <span className="cpd-eyebrow">COACH ANALYTICS</span>
                    <h1>Performance Overview</h1>
                    <p>
                        Track your real coaching bookings, client activity,
                        and paid booking value.
                    </p>
                </div>

                <div className="cpd-header-actions">
                    <button
                        type="button"
                        className="cpd-outline"
                        disabled={loading}
                        onClick={() => setRefreshKey(value => value + 1)}
                    >
                        ↻ Refresh
                    </button>
                    <button
                        type="button"
                        className="cpd-primary"
                        onClick={() => navigate('/coach/schedule')}
                    >
                        View Schedule →
                    </button>
                </div>
            </header>

            {loading ? (
                <section className="cpd-state" role="status">
                    Loading coach performance...
                </section>
            ) : error ? (
                <section className="cpd-state cpd-state-error" role="alert">
                    <strong>Unable to load performance</strong>
                    <p>{error}</p>
                    <button
                        type="button"
                        className="cpd-outline"
                        onClick={() => setRefreshKey(value => value + 1)}
                    >
                        Try Again
                    </button>
                </section>
            ) : (
                <>
                    {/* MAIN STATISTICS */}
                    <section className="cpd-stat-grid" aria-label="Coaching statistics">
                        <article className="cpd-stat-card">
                            <div className="cpd-stat-top">
                                <span>Sessions This Week</span>
                                <span className="cpd-stat-icon">▣</span>
                            </div>
                            <strong>{Number(summary.sessionsThisWeek) || 0}</strong>
                            <small>Confirmed and completed bookings this week</small>
                        </article>

                        <article className="cpd-stat-card">
                            <div className="cpd-stat-top">
                                <span>Unique Clients</span>
                                <span className="cpd-stat-icon green">♙</span>
                            </div>
                            <strong>{Number(summary.uniqueClients) || 0}</strong>
                            <small>Clients with confirmed or completed bookings</small>
                        </article>

                        <article className="cpd-stat-card">
                            <div className="cpd-stat-top">
                                <span>Upcoming Sessions Today</span>
                                <span className="cpd-stat-icon purple">▦</span>
                            </div>
                            <strong>{Number(summary.upcomingToday) || 0}</strong>
                            <small>Confirmed sessions that have not finished</small>
                        </article>
                    </section>

                    {/* CHART AND COACHING SUMMARY */}
                    <div className="cpd-analytics-grid">
                        <section className="cpd-panel cpd-chart-panel">
                            <div className="cpd-panel-heading">
                                <div>
                                    <h2>Financial & Session Performance</h2>
                                    <p>Last six months · Based on session dates</p>
                                </div>
                                <div
                                    className="cpd-chart-switch"
                                    role="group"
                                    aria-label="Chart metric"
                                >
                                    <button
                                        type="button"
                                        className={chartMetric === 'value' ? 'active' : ''}
                                        aria-pressed={chartMetric === 'value'}
                                        onClick={() => setChartMetric('value')}
                                    >
                                        Paid Value
                                    </button>
                                    <button
                                        type="button"
                                        className={chartMetric === 'sessions' ? 'active' : ''}
                                        aria-pressed={chartMetric === 'sessions'}
                                        onClick={() => setChartMetric('sessions')}
                                    >
                                        Sessions
                                    </button>
                                </div>
                            </div>

                            <div className="cpd-chart-value">
                                {chartMetric === 'value'
                                    ? 'Paid booking value (RM)'
                                    : 'Number of sessions'}
                            </div>

                            <div
                                className="cpd-chart"
                                role="img"
                                aria-label={chartMetric === 'value'
                                    ? 'Paid booking value by month for the last six months'
                                    : 'Coaching sessions by month for the last six months'}
                            >
                                {months.map((item, index) => {
                                    const value = chartValues[index] || 0;
                                    const height = value > 0
                                        ? Math.max(5, (value / highest) * 100)
                                        : 0;
                                    const displayValue = chartMetric === 'value'
                                        ? formatMoney(value)
                                        : `${value} sessions`;

                                    return (
                                        <div className="cpd-chart-column" key={item.month}>
                                            <span className="cpd-chart-number" title={displayValue}>
                                                {chartMetric === 'value'
                                                    ? `${value.toFixed(0)}`
                                                    : value}
                                            </span>
                                            <div className="cpd-chart-track">
                                                <div
                                                    className="cpd-chart-bar"
                                                    style={{ height: `${height}%` }}
                                                    title={`${item.month}: ${displayValue}`}
                                                />
                                            </div>
                                            <span className="cpd-chart-month">
                                                {formatMonth(item.month)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {!hasChartData && (
                                <p className="cpd-chart-empty">
                                    No {chartMetric === 'value' ? 'paid booking value' : 'sessions'}
                                    {' '}recorded in this six-month period.
                                </p>
                            )}

                            <p className="cpd-chart-note">
                                Paid booking value is the sum of paid, confirmed/completed
                                bookings grouped by session month. It is not net coach earnings.
                            </p>
                        </section>

                        <aside className="cpd-panel cpd-highlights">
                            <div className="cpd-panel-heading">
                                <div>
                                    <h2>Coaching Highlights</h2>
                                    <p>Your booking activity at a glance</p>
                                </div>
                            </div>

                            <div className="cpd-highlight-box">
                                <span>Paid Booking Value This Month</span>
                                <strong>{formatMoney(summary.paidSessionValueThisMonth)}</strong>
                                <small>{currentMonth || 'Current month'} · Paid sessions scheduled this month</small>
                            </div>

                            <div className="cpd-highlight-box neutral">
                                <span>Completed Sessions</span>
                                <strong>{Number(summary.completedAllTime) || 0}</strong>
                                <small>All-time sessions marked completed</small>
                            </div>

                            <button
                                type="button"
                                className="cpd-highlight-link"
                                onClick={() => navigate('/coach/gyms')}
                            >
                                Manage Gym Locations →
                            </button>
                        </aside>
                    </div>

                    {/* RECENT COACHING SESSIONS */}
                    <section className="cpd-panel cpd-recent">
                        <div className="cpd-panel-heading">
                            <div>
                                <h2>Recent Coaching Sessions</h2>
                                <p>Confirmed and completed bookings dated today or earlier</p>
                            </div>
                            <button
                                type="button"
                                className="cpd-outline"
                                onClick={() => navigate('/coach/schedule')}
                            >
                                Open Schedule →
                            </button>
                        </div>

                        {recentSessions.length === 0 ? (
                            <div className="cpd-recent-empty">
                                No recent coaching sessions found.
                            </div>
                        ) : (
                            <div className="cpd-session-list">
                                {recentSessions.map(session => (
                                    <article
                                        className="cpd-session"
                                        key={session.bookingId}
                                    >
                                        <div className="cpd-session-main">
                                            <span className="cpd-avatar" aria-hidden="true">
                                                {String(session.clientName || 'C')
                                                    .trim()
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </span>
                                            <div>
                                                <strong>{session.clientName || 'Client'}</strong>
                                                <span>{session.gymName || 'Gym location'}</span>
                                            </div>
                                        </div>

                                        <div className="cpd-session-datetime">
                                            <strong>{formatDate(session.sessionDate)}</strong>
                                            <span>{formatTime(session.startTime)}</span>
                                        </div>

                                        <div className="cpd-session-meta">
                                            <span className={`cpd-status ${session.status}`}>
                                                {statusLabel(session.status)}
                                            </span>
                                            <small>
                                                {formatMoney(session.amount)} ·{' '}
                                                {statusLabel(session.paymentStatus)}
                                            </small>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                </>
            )}
        </main>
    );
}

// ======================================================
// STYLES - ALL INSIDE COACHPERFORMANCE.JSX
// ======================================================

const performanceCss = `
.cpd-page {
    width: 100%;
    max-width: 1480px;
    margin: 0 auto;
    min-width: 0;
    color: #172b4d;
}
.cpd-page * { box-sizing: border-box; }
.cpd-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    margin-bottom: 24px;
}
.cpd-eyebrow {
    color: #0759df;
    font-weight: 800;
    font-size: 11px;
    letter-spacing: 1px;
}
.cpd-header h1 {
    margin: 7px 0;
    color: #102a53;
    font-size: 28px;
}
.cpd-header p, .cpd-panel-heading p {
    margin: 0;
    color: #718096;
    font-size: 13px;
    line-height: 1.6;
}
.cpd-header-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}
.cpd-outline, .cpd-primary {
    border-radius: 9px;
    padding: 11px 15px;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
}
.cpd-outline {
    border: 1px solid #d7e2f0;
    background: white;
    color: #24517b;
}
.cpd-primary {
    border: 1px solid #0759df;
    background: #0759df;
    color: white;
}
.cpd-outline:hover { background: #f0f6ff; }
.cpd-primary:hover { background: #0048bc; }
.cpd-page button:disabled { opacity: .55; cursor: not-allowed; }
.cpd-page button:focus-visible {
    outline: 3px solid #83b4fa;
    outline-offset: 2px;
}
.cpd-stat-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 20px;
}
.cpd-stat-card {
    min-width: 0;
    background: #fff;
    border: 1px solid #e0e8f2;
    border-radius: 14px;
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.cpd-stat-top {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: center;
}
.cpd-stat-top > span:first-child {
    font-size: 13px;
    font-weight: 650;
    color: #526581;
}
.cpd-stat-icon {
    display: grid;
    place-items: center;
    width: 35px;
    height: 35px;
    flex-shrink: 0;
    border-radius: 10px;
    color: #0759df;
    background: #e7f0ff;
    font-size: 18px;
}
.cpd-stat-icon.green { color: #00874d; background: #e3f8ef; }
.cpd-stat-icon.purple { color: #6252c7; background: #efecff; }
.cpd-stat-card > strong {
    font-size: 33px;
    line-height: 1;
    color: #102a53;
}
.cpd-stat-card > small {
    font-size: 11px;
    color: #718096;
    line-height: 1.5;
}
.cpd-analytics-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
    align-items: start;
    gap: 19px;
    margin-bottom: 20px;
}
.cpd-panel {
    background: white;
    border: 1px solid #e0e8f2;
    border-radius: 14px;
    padding: 22px;
    min-width: 0;
}
.cpd-panel-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-bottom: 21px;
}
.cpd-panel-heading h2 {
    margin: 0 0 6px;
    font-size: 19px;
    color: #102a53;
}
.cpd-chart-switch {
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 9px;
    background: #f1f5fb;
}
.cpd-chart-switch button {
    border: 0;
    padding: 9px 12px;
    border-radius: 7px;
    background: transparent;
    color: #526581;
    font-weight: 700;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
}
.cpd-chart-switch button.active {
    background: white;
    color: #0759df;
    box-shadow: 0 1px 4px rgba(23,43,77,.12);
}
.cpd-chart-value {
    margin-bottom: 14px;
    font-size: 12px;
    font-weight: 700;
    color: #526581;
}
.cpd-chart {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 12px;
    min-width: 0;
    height: 255px;
    padding: 0 0 5px;
}
.cpd-chart-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: end;
    gap: 7px;
    min-width: 0;
    height: 100%;
}
.cpd-chart-number {
    text-align: center;
    font-size: 11px;
    font-weight: 750;
    color: #315071;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
}
.cpd-chart-track {
    position: relative;
    width: 100%;
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: end;
    justify-content: center;
    border-bottom: 1px solid #e0e8f2;
    background: repeating-linear-gradient(
        to top,
        #f0f4fa 0px, #f0f4fa 1px,
        transparent 1px, transparent 44px
    );
}
.cpd-chart-bar {
    width: min(65%, 57px);
    min-height: 0;
    border-radius: 7px 7px 0 0;
    background: linear-gradient(180deg, #80adfa, #0759df);
    transition: height .2s ease;
}
.cpd-chart-month { font-size: 11px; color: #718096; }
.cpd-chart-note, .cpd-chart-empty {
    margin: 15px 0 0;
    color: #718096;
    line-height: 1.6;
    font-size: 11px;
}
.cpd-chart-empty { color: #a3671a; }
.cpd-highlights { display: flex; flex-direction: column; gap: 15px; }
.cpd-highlights .cpd-panel-heading { margin-bottom: 0; }
.cpd-highlight-box {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 20px;
    background: #edf4ff;
    border: 1px solid #d5e4ff;
    border-radius: 11px;
}
.cpd-highlight-box.neutral { background: #f6f8fc; border-color: #e6ebf3; }
.cpd-highlight-box span { font-size: 12px; color: #526581; font-weight: 700; }
.cpd-highlight-box strong { font-size: 25px; color: #0759df; overflow-wrap: anywhere; }
.cpd-highlight-box.neutral strong { color: #102a53; }
.cpd-highlight-box small { font-size: 11px; color: #718096; line-height: 1.6; }
.cpd-highlight-link {
    text-align: left;
    border: 0;
    background: none;
    padding: 7px 2px;
    color: #0759df;
    font-size: 12px;
    font-weight: 750;
    cursor: pointer;
}
.cpd-recent .cpd-panel-heading { margin-bottom: 17px; }
.cpd-session-list { display: grid; gap: 10px; }
.cpd-session {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr) auto;
    gap: 15px;
    align-items: center;
    border: 1px solid #e6edf7;
    background: #fafcff;
    border-radius: 10px;
    padding: 14px 15px;
}
.cpd-session-main {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
}
.cpd-avatar {
    display: grid;
    place-items: center;
    width: 41px;
    height: 41px;
    border-radius: 50%;
    background: #dceaff;
    color: #0759df;
    font-weight: 800;
    flex-shrink: 0;
}
.cpd-session-main div, .cpd-session-datetime, .cpd-session-meta {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
}
.cpd-session strong { color: #142b4d; font-size: 13px; overflow-wrap: anywhere; }
.cpd-session span:not(.cpd-avatar):not(.cpd-status), .cpd-session small {
    font-size: 11px;
    color: #718096;
    overflow-wrap: anywhere;
}
.cpd-session-meta { align-items: flex-end; text-align: right; }
.cpd-status {
    border-radius: 99px;
    padding: 6px 10px;
    background: #e9f1ff;
    color: #0759df;
    text-transform: capitalize;
    font-size: 11px;
    font-weight: 750;
    white-space: nowrap;
}
.cpd-status.completed { background: #e4f8ef; color: #087645; }
.cpd-recent-empty {
    text-align: center;
    border: 1px dashed #d1dce9;
    border-radius: 10px;
    padding: 35px 14px;
    color: #718096;
    font-size: 13px;
}
.cpd-state {
    padding: 65px 18px;
    border-radius: 14px;
    background: white;
    border: 1px solid #e0e8f2;
    text-align: center;
    color: #64748b;
}
.cpd-state-error { color: #b42318; background: #fff3f3; }
.cpd-state-error p { line-height: 1.6; }
@media (max-width: 1080px) {
    .cpd-analytics-grid { grid-template-columns: 1fr; }
}
@media (max-width: 760px) {
    .cpd-header { flex-direction: column; align-items: stretch; }
    .cpd-header h1 { font-size: 23px; }
    .cpd-stat-grid { grid-template-columns: 1fr; gap: 11px; }
    .cpd-stat-card { padding: 17px; }
    .cpd-stat-card > strong { font-size: 28px; }
    .cpd-panel { padding: 15px; }
    .cpd-panel-heading { flex-direction: column; align-items: stretch; }
    .cpd-panel-heading h2 { font-size: 17px; }
    .cpd-session { grid-template-columns: 1fr; gap: 12px; }
    .cpd-session-meta { align-items: flex-start; text-align: left; }
    .cpd-chart { height: 225px; gap: 6px; }
    .cpd-chart-number, .cpd-chart-month { font-size: 10px; }
    .cpd-header-actions button { flex: 1; }
}
`;
