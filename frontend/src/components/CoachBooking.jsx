
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ======================================================
// API CONFIGURATION
// ======================================================

const API_BASE_URL =
    `http://${window.location.hostname}:5000`;

// ======================================================
// DATE AND TIME HELPERS
// ======================================================

function getSessionDateTime(booking) {
    const dateText = String(booking.sessionDate || '');
    const timeText = String(booking.startTime || '00:00');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
        return null;
    }

    const [year, month, day] =
        dateText.split('-').map(Number);

    const [hour, minute] =
        timeText.split(':').map(Number);

    const date = new Date(
        year,
        month - 1,
        day,
        hour || 0,
        minute || 0
    );

    return Number.isNaN(date.getTime())
        ? null
        : date;
}

function formatDate(booking) {
    const date = getSessionDateTime(booking);

    if (!date) return 'Date unavailable';

    return new Intl.DateTimeFormat('en-MY', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

function formatTime(value) {
    if (!value) return 'N/A';

    const [hour, minute] =
        String(value).split(':').map(Number);

    if (
        !Number.isFinite(hour) ||
        !Number.isFinite(minute)
    ) {
        return String(value);
    }

    return new Intl.DateTimeFormat('en-MY', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    }).format(new Date(2020, 0, 1, hour, minute));
}

function formatMoney(amount, currency) {
    try {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: String(currency || 'MYR')
                .toUpperCase()
        }).format(Number(amount || 0));
    } catch {
        return `RM ${Number(amount || 0).toFixed(2)}`;
    }
}

function formatStatus(value) {
    return String(value || 'unknown')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

// ======================================================
// HOLD HELPERS
// ======================================================

function getHoldSeconds(booking, nowMs) {
    const expires = Number(
        booking.holdExpiresAtUnix
    );

    if (!Number.isFinite(expires) || expires <= 0) {
        return 0;
    }

    return Math.max(
        0,
        Math.ceil(expires - nowMs / 1000)
    );
}

function formatCountdown(seconds) {
    if (seconds <= 0) return 'Expired';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    }

    return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function isActivePending(booking, nowMs) {
    const date = getSessionDateTime(booking);

    return (
        booking.status === 'pending_payment' &&
        booking.paymentStatus !== 'paid' &&
        getHoldSeconds(booking, nowMs) > 0 &&
        date !== null &&
        date.getTime() > nowMs
    );
}

function isUpcoming(booking, nowMs) {
    const date = getSessionDateTime(booking);

    if (!date || date.getTime() <= nowMs) {
        return false;
    }

    if (booking.status === 'confirmed') {
        return true;
    }

    return isActivePending(booking, nowMs);
}

function getDisplayStatus(booking, nowMs) {
    if (
        booking.status === 'pending_payment' &&
        !isActivePending(booking, nowMs)
    ) {
        return 'Hold Expired';
    }

    return formatStatus(booking.status);
}

function getStatusClass(booking, nowMs) {
    if (
        booking.status === 'pending_payment' &&
        !isActivePending(booking, nowMs)
    ) {
        return 'cb-status-danger';
    }

    if (
        booking.status === 'confirmed' ||
        booking.status === 'completed'
    ) {
        return 'cb-status-success';
    }

    if (booking.status === 'pending_payment') {
        return 'cb-status-warning';
    }

    if (
        booking.status === 'cancelled' ||
        booking.status === 'expired'
    ) {
        return 'cb-status-danger';
    }

    return 'cb-status-neutral';
}

// ======================================================
// BOOKING CARD
// ======================================================

function BookingCard({
    booking,
    nowMs,
    expanded,
    onToggle,
    onContinuePayment,
    onCancel,
    busy
}) {
    const pending = isActivePending(booking, nowMs);
    const remaining = getHoldSeconds(booking, nowMs);
    const linkedCount = Math.max(
        1,
        Number(booking.linkedPendingCount || 1)
    );

    return (
        <article className="cb-booking-card">

            <div className="cb-booking-main">

                <div className="cb-coach-avatar">
                    {String(booking.coachName || 'C')
                        .charAt(0)
                        .toUpperCase()}
                </div>

                <div className="cb-booking-info">

                    <div className="cb-coach-heading">
                        <h3>{booking.coachName || 'Coach'}</h3>

                        <span
                            className={
                                `cb-status ${getStatusClass(booking, nowMs)}`
                            }
                        >
                            {getDisplayStatus(booking, nowMs)}
                        </span>
                    </div>

                    <p>
                        📅 {formatDate(booking)}
                        {' · '}
                        {formatTime(booking.startTime)}
                        {' - '}
                        {formatTime(booking.endTime)}
                    </p>

                    <p>
                        📍 {booking.gymName || 'Gym unavailable'}
                    </p>

                    <p className="cb-payment-line">
                        Payment:
                        <strong
                            className={
                                booking.paymentStatus === 'paid'
                                    ? 'cb-payment-paid'
                                    : 'cb-payment-other'
                            }
                        >
                            {formatStatus(booking.paymentStatus)}
                        </strong>
                    </p>

                    {pending && (
                        <div className="cb-hold-info">
                            <span>⏳ Hold remaining:</span>
                            <strong>{formatCountdown(remaining)}</strong>
                        </div>
                    )}

                    {pending && linkedCount > 1 && (
                        <p className="cb-group-note">
                            This payment includes {linkedCount} linked
                            coaching sessions.
                        </p>
                    )}

                </div>
            </div>

            <div className="cb-booking-actions">

                <strong className="cb-price">
                    {formatMoney(
                        booking.amount,
                        booking.currency
                    )}
                </strong>

                <div className="cb-action-buttons">

                    {pending && (
                        <>
                            <button
                                type="button"
                                className="cb-pay-button"
                                disabled={Boolean(busy)}
                                onClick={() => onContinuePayment(booking)}
                            >
                                {busy === `pay-${booking.bookingId}`
                                    ? 'Opening Payment...'
                                    : 'Continue Payment'}
                            </button>

                            <button
                                type="button"
                                className="cb-cancel-button"
                                disabled={Boolean(busy)}
                                onClick={() => onCancel(booking)}
                            >
                                {busy === `cancel-${booking.bookingId}`
                                    ? 'Cancelling...'
                                    : 'Cancel Booking'}
                            </button>
                        </>
                    )}

                    <button
                        type="button"
                        className="cb-outline-button"
                        aria-expanded={expanded}
                        onClick={onToggle}
                    >
                        {expanded ? 'Hide Details' : 'View Details'}
                    </button>

                </div>
            </div>

            {expanded && (
                <div className="cb-booking-details">
                    <h4>Booking Information</h4>

                    <div className="cb-details-grid">

                        <div>
                            <span>Booking ID</span>
                            <strong>#{booking.bookingId}</strong>
                        </div>

                        <div>
                            <span>Coach</span>
                            <strong>{booking.coachName}</strong>
                        </div>

                        <div>
                            <span>Gym</span>
                            <strong>{booking.gymName}</strong>
                        </div>

                        <div>
                            <span>Session Date</span>
                            <strong>{formatDate(booking)}</strong>
                        </div>

                        <div>
                            <span>Session Time</span>
                            <strong>
                                {formatTime(booking.startTime)}
                                {' - '}
                                {formatTime(booking.endTime)}
                            </strong>
                        </div>

                        <div>
                            <span>Duration</span>
                            <strong>
                                {booking.durationMinutes || 0} minutes
                            </strong>
                        </div>

                        <div>
                            <span>Booking Status</span>
                            <strong>
                                {getDisplayStatus(booking, nowMs)}
                            </strong>
                        </div>

                        <div>
                            <span>Payment Status</span>
                            <strong>
                                {formatStatus(booking.paymentStatus)}
                            </strong>
                        </div>

                        {pending && (
                            <div>
                                <span>Time Remaining</span>
                                <strong>
                                    {formatCountdown(remaining)}
                                </strong>
                            </div>
                        )}

                    </div>
                </div>
            )}

        </article>
    );
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function CoachBooking() {

    const navigate = useNavigate();

    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionError, setActionError] = useState('');
    const [notice, setNotice] = useState('');
    const [activeTab, setActiveTab] = useState('upcoming');
    const [expandedId, setExpandedId] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [busy, setBusy] = useState('');
    const [nowMs, setNowMs] = useState(Date.now());

    // ==================================================
    // COUNTDOWN TIMER
    // ==================================================

    useEffect(() => {
        const timer = setInterval(() => {
            setNowMs(Date.now());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // ==================================================
    // LOAD REAL USER BOOKINGS
    // ==================================================

    useEffect(() => {
        const controller = new AbortController();

        async function loadBookings() {
            setLoading(true);
            setError('');

            try {
                const token = localStorage.getItem('token');

                if (!token) {
                    throw new Error(
                        'Please log in to view your bookings.'
                    );
                }

                const response = await fetch(
                    `${API_BASE_URL}/api/bookings/my`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        signal: controller.signal
                    }
                );

                const data = await response.json();

                if (!response.ok || data.success === false) {
                    throw new Error(
                        data.message || 'Unable to load bookings.'
                    );
                }

                if (!controller.signal.aborted) {
                    setBookings(
                        Array.isArray(data.bookings)
                            ? data.bookings
                            : []
                    );
                }

            } catch (err) {
                if (
                    err.name !== 'AbortError' &&
                    !controller.signal.aborted
                ) {
                    setError(err.message || 'Unable to load bookings.');
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        loadBookings();

        return () => controller.abort();

    }, [refreshKey]);

    // ==================================================
    // REFRESH
    // ==================================================

    function refreshBookings() {
        setRefreshKey(previous => previous + 1);
    }

    // ==================================================
    // CONTINUE STRIPE PAYMENT
    // ==================================================

    async function continuePayment(booking) {

        if (!isActivePending(booking, Date.now())) {
            setActionError(
                'This booking hold is no longer active. Please refresh.'
            );
            return;
        }

        setBusy(`pay-${booking.bookingId}`);
        setActionError('');
        setNotice('');

        try {
            const token = localStorage.getItem('token');

            const response = await fetch(
                `${API_BASE_URL}/api/bookings/${booking.bookingId}/checkout`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || 'Unable to continue payment.'
                );
            }

            if (!data.checkoutUrl) {
                throw new Error(
                    'Stripe Checkout URL was not returned.'
                );
            }

            const checkoutUrl = new URL(data.checkoutUrl);

            if (checkoutUrl.protocol !== 'https:') {
                throw new Error(
                    'Invalid Stripe Checkout URL.'
                );
            }

            window.location.assign(checkoutUrl.href);

        } catch (err) {
            setActionError(err.message);
            refreshBookings();
        } finally {
            setBusy('');
        }
    }

    // ==================================================
    // CANCEL PENDING BOOKING
    // ==================================================

    async function cancelPendingBooking(booking) {

        if (!isActivePending(booking, Date.now())) {
            setActionError(
                'This booking hold has expired. Please refresh.'
            );
            return;
        }

        const linkedCount = Math.max(
            1,
            Number(booking.linkedPendingCount || 1)
        );

        const message = linkedCount > 1
            ? `This payment contains ${linkedCount} linked bookings.\n\nCancelling will cancel ALL linked pending sessions.\n\nDo you want to continue?`
            : `Cancel booking #${booking.bookingId}?\n\nThe reserved coaching slot will be released.`;

        if (!window.confirm(message)) {
            return;
        }

        setBusy(`cancel-${booking.bookingId}`);
        setActionError('');
        setNotice('');

        try {
            const token = localStorage.getItem('token');

            const response = await fetch(
                `${API_BASE_URL}/api/bookings/${booking.bookingId}/cancel-pending`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || 'Unable to cancel booking.'
                );
            }

            setNotice(
                data.message || 'Booking cancelled successfully.'
            );

            setExpandedId(null);
            refreshBookings();

        } catch (err) {
            setActionError(err.message);
            refreshBookings();
        } finally {
            setBusy('');
        }
    }

    // ==================================================
    // UPCOMING AND HISTORY
    // ==================================================

    const upcoming = bookings
        .filter(booking => isUpcoming(booking, nowMs))
        .sort((a, b) =>
            getSessionDateTime(a).getTime() -
            getSessionDateTime(b).getTime()
        );

    const history = bookings
        .filter(booking => !isUpcoming(booking, nowMs))
        .sort((a, b) =>
            (getSessionDateTime(b)?.getTime() || 0) -
            (getSessionDateTime(a)?.getTime() || 0)
        );

    const completedCount = bookings.filter(
        booking => booking.status === 'completed'
    ).length;

    const confirmedCount = upcoming.filter(
        booking => booking.status === 'confirmed'
    ).length;

    const visibleBookings =
        activeTab === 'upcoming' ? upcoming : history;

    // ==================================================
    // RENDER
    // ==================================================

    return (
        <div className="cb-page">

            <style>{coachBookingCss}</style>

            <div className="cb-heading">
                <div>
                    <h1>My Coach Bookings</h1>
                    <p>
                        Manage your coaching sessions
                        and booking history.
                    </p>
                </div>

                <div className="cb-header-actions">
                    <button
                        className="cb-refresh-button"
                        onClick={refreshBookings}
                        disabled={loading || Boolean(busy)}
                    >
                        ↻ Refresh
                    </button>

                    <button
                        className="cb-primary-button"
                        onClick={() => navigate('/gym-map')}
                    >
                        + Book New Session
                    </button>
                </div>
            </div>

            {error && (
                <div className="cb-error-message" role="alert">
                    {error}
                </div>
            )}

            {actionError && (
                <div className="cb-error-message" role="alert">
                    {actionError}
                </div>
            )}

            {notice && (
                <div className="cb-success-message" role="status">
                    {notice}
                </div>
            )}

            <div className="cb-stats">

                <div className="cb-stat-card">
                    <span>Upcoming Sessions</span>
                    <strong>
                        {loading ? '...' : confirmedCount}
                    </strong>
                    <small>Confirmed future sessions</small>
                </div>

                <div className="cb-stat-card cb-stat-green">
                    <span>Completed Sessions</span>
                    <strong>
                        {loading ? '...' : completedCount}
                    </strong>
                    <small>Sessions marked completed</small>
                </div>

                <div className="cb-stat-card">
                    <span>Booking History</span>
                    <strong>
                        {loading ? '...' : history.length}
                    </strong>
                    <small>Past, cancelled and expired</small>
                </div>

            </div>

            <div className="cb-section">

                <div className="cb-section-header">
                    <h2>Coaching Sessions</h2>

                    <span className="cb-total-count">
                        {loading
                            ? 'Loading...'
                            : `${bookings.length} Total Bookings`}
                    </span>
                </div>

                <div className="cb-tabs">

                    <button
                        className={
                            activeTab === 'upcoming' ? 'active' : ''
                        }
                        onClick={() => {
                            setActiveTab('upcoming');
                            setExpandedId(null);
                        }}
                    >
                        Upcoming Bookings ({upcoming.length})
                    </button>

                    <button
                        className={
                            activeTab === 'history' ? 'active' : ''
                        }
                        onClick={() => {
                            setActiveTab('history');
                            setExpandedId(null);
                        }}
                    >
                        Booking History ({history.length})
                    </button>

                </div>

                <div className="cb-booking-list">

                    {loading ? (
                        <div className="cb-empty">
                            <div className="cb-loader" />
                            <h3>Loading bookings...</h3>
                        </div>
                    ) : error ? (
                        <div className="cb-empty">
                            <h3>Unable to display bookings</h3>
                            <p>Please refresh and try again.</p>
                        </div>
                    ) : visibleBookings.length === 0 ? (
                        <div className="cb-empty">
                            <div className="cb-empty-icon">📅</div>

                            <h3>No bookings found</h3>

                            <p>
                                {activeTab === 'upcoming'
                                    ? 'You have no upcoming coaching sessions.'
                                    : 'Your booking history is empty.'}
                            </p>
                        </div>
                    ) : (
                        visibleBookings.map(booking => (
                            <BookingCard
                                key={booking.bookingId}
                                booking={booking}
                                nowMs={nowMs}
                                expanded={
                                    expandedId === booking.bookingId
                                }
                                onToggle={() =>
                                    setExpandedId(
                                        expandedId === booking.bookingId
                                            ? null
                                            : booking.bookingId
                                    )
                                }
                                onContinuePayment={continuePayment}
                                onCancel={cancelPendingBooking}
                                busy={busy}
                            />
                        ))
                    )}

                </div>
            </div>
        </div>
    );
}

// ======================================================
// CSS INSIDE JSX
// ======================================================

const coachBookingCss = `

.cb-page {
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    color: #172b4d;
}

.cb-page * {
    box-sizing: border-box;
}

/* HEADER */

.cb-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    margin-bottom: 28px;
}

.cb-heading h1 {
    margin: 0 0 8px;
    font-size: 29px;
    color: #102a53;
}

.cb-heading p {
    margin: 0;
    font-size: 14px;
    color: #718096;
}

.cb-header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
}

.cb-primary-button,
.cb-refresh-button {
    padding: 12px 17px;
    border-radius: 9px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
}

.cb-primary-button {
    background: #0759df;
    color: white;
    border: 1px solid #0759df;
}

.cb-primary-button:hover {
    background: #0048bc;
}

.cb-refresh-button {
    background: white;
    color: #244364;
    border: 1px solid #d8e2f0;
}

.cb-refresh-button:disabled {
    opacity: .5;
    cursor: not-allowed;
}

/* MESSAGES */

.cb-error-message,
.cb-success-message {
    padding: 14px 18px;
    border-radius: 10px;
    margin-bottom: 20px;
    font-size: 14px;
}

.cb-error-message {
    background: #fff0f0;
    border: 1px solid #f5c2c2;
    color: #ad2525;
}

.cb-success-message {
    background: #e5f8ef;
    border: 1px solid #b8e9ce;
    color: #087645;
}

/* STATISTICS */

.cb-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
    margin-bottom: 34px;
}

.cb-stat-card {
    background: #edf3ff;
    border: 1px solid #dce6ff;
    padding: 25px;
    border-radius: 13px;
    display: flex;
    flex-direction: column;
    gap: 13px;
}

.cb-stat-card span {
    font-size: 14px;
    color: #526581;
}

.cb-stat-card strong {
    font-size: 30px;
    color: #095bdb;
}

.cb-stat-card small {
    font-size: 13px;
    color: #748399;
}

.cb-stat-green {
    background: #e9f9f1;
    border-color: #d0ecdf;
}

.cb-stat-green strong {
    color: #098047;
}

/* SECTION */

.cb-section {
    background: white;
    border: 1px solid #e4e9f2;
    border-radius: 13px;
    overflow: hidden;
}

.cb-section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 22px;
    gap: 10px;
}

.cb-section-header h2 {
    margin: 0;
    font-size: 19px;
    color: #142c4e;
}

.cb-total-count {
    font-size: 13px;
    color: #718096;
}

.cb-tabs {
    display: flex;
    gap: 23px;
    padding: 0 22px;
    border-bottom: 1px solid #e4e9f2;
}

.cb-tabs button {
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    padding: 18px 5px;
    color: #718096;
    font-size: 14px;
    font-weight: 650;
    cursor: pointer;
}

.cb-tabs button.active {
    color: #0759df;
    border-bottom-color: #0759df;
}

/* BOOKING CARDS */

.cb-booking-list {
    padding: 20px;
}

.cb-booking-card {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    padding: 23px;
    margin-bottom: 14px;
    border: 1px solid #e2e8f1;
    border-radius: 12px;
    background: white;
}

.cb-booking-card:last-child {
    margin-bottom: 0;
}

.cb-booking-card:hover {
    border-color: #c5d7f7;
}

.cb-booking-main {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 16px;
    min-width: 0;
}

.cb-coach-avatar {
    width: 56px;
    height: 56px;
    flex-shrink: 0;
    border-radius: 50%;
    background: #dbeafe;
    color: #095bdb;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 21px;
    font-weight: 800;
}

.cb-booking-info {
    min-width: 0;
    flex: 1;
}

.cb-coach-heading {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
}

.cb-coach-heading h3 {
    margin: 0;
    font-size: 16px;
    color: #152d50;
}

.cb-booking-info p {
    margin: 7px 0;
    font-size: 13px;
    color: #64748b;
    line-height: 1.6;
}

.cb-status {
    display: inline-block;
    padding: 5px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
}

.cb-status-success {
    background: #d9fbe8;
    color: #087645;
}

.cb-status-warning {
    background: #fff2cc;
    color: #9a6700;
}

.cb-status-danger {
    background: #fee4e2;
    color: #b42318;
}

.cb-status-neutral {
    background: #edf0f4;
    color: #526581;
}

.cb-payment-line {
    display: flex;
    align-items: center;
    gap: 6px;
}

.cb-payment-paid {
    color: #098047;
}

.cb-payment-other {
    color: #ae7b00;
}

.cb-hold-info {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-top: 9px;
    padding: 9px 12px;
    border-radius: 8px;
    background: #fff7e2;
    color: #946200;
    font-size: 12px;
}

.cb-hold-info strong {
    font-size: 14px;
    font-variant-numeric: tabular-nums;
}

.cb-booking-info .cb-group-note {
    color: #946200;
    font-size: 12px;
}

/* ACTION BUTTONS */

.cb-booking-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
}

.cb-price {
    font-size: 15px;
    color: #102a53;
    white-space: nowrap;
}

.cb-action-buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 9px;
}

.cb-action-buttons button {
    padding: 10px 13px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
}

.cb-pay-button {
    background: #0759df;
    color: white;
    border: 1px solid #0759df;
}

.cb-pay-button:hover {
    background: #0048bc;
}

.cb-cancel-button {
    background: #fff5f5;
    color: #bb2424;
    border: 1px solid #f1caca;
}

.cb-cancel-button:hover {
    background: #ffe8e8;
}

.cb-outline-button {
    background: white;
    color: #244364;
    border: 1px solid #dce3ed;
}

.cb-outline-button:hover {
    background: #f2f6fd;
}

.cb-action-buttons button:disabled {
    opacity: .5;
    cursor: not-allowed;
}

/* DETAILS */

.cb-booking-details {
    flex-basis: 100%;
    border-top: 1px solid #edf0f5;
    padding-top: 20px;
}

.cb-booking-details h4 {
    margin: 0 0 17px;
    font-size: 15px;
}

.cb-details-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
}

.cb-details-grid > div {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
}

.cb-details-grid span {
    font-size: 12px;
    color: #718096;
}

.cb-details-grid strong {
    color: #233b58;
    font-size: 13px;
    overflow-wrap: anywhere;
}

/* EMPTY STATES */

.cb-empty {
    padding: 50px 15px;
    text-align: center;
}

.cb-empty-icon {
    font-size: 34px;
}

.cb-empty h3 {
    color: #203657;
    font-size: 17px;
    margin: 15px 0 9px;
}

.cb-empty p {
    color: #718096;
    font-size: 13px;
}

.cb-loader {
    width: 34px;
    height: 34px;
    margin: 0 auto;
    border: 4px solid #dbeafe;
    border-top-color: #0759df;
    border-radius: 50%;
    animation: cb-spin .8s linear infinite;
}

@keyframes cb-spin {
    to { transform: rotate(360deg); }
}

/* TABLET */

@media (max-width: 950px) {
    .cb-stats {
        gap: 12px;
    }

    .cb-stat-card {
        padding: 18px;
    }

    .cb-booking-card {
        padding: 17px;
    }
}

/* MOBILE */

@media (max-width: 650px) {
    .cb-heading {
        flex-direction: column;
        align-items: stretch;
    }

    .cb-heading h1 {
        font-size: 23px;
    }

    .cb-header-actions {
        width: 100%;
    }

    .cb-primary-button {
        flex: 1;
    }

    .cb-stats {
        grid-template-columns: 1fr;
        gap: 12px;
        margin-bottom: 22px;
    }

    .cb-stat-card {
        padding: 17px;
        gap: 8px;
    }

    .cb-section-header {
        padding: 18px 14px;
    }

    .cb-section-header h2 {
        font-size: 16px;
    }

    .cb-tabs {
        gap: 8px;
        padding: 0 12px;
    }

    .cb-tabs button {
        flex: 1;
        font-size: 12px;
        padding: 14px 2px;
    }

    .cb-booking-list {
        padding: 10px;
    }

    .cb-booking-card {
        flex-direction: column;
        align-items: stretch;
        padding: 15px;
    }

    .cb-booking-main {
        align-items: flex-start;
        gap: 12px;
    }

    .cb-coach-avatar {
        width: 44px;
        height: 44px;
        font-size: 18px;
    }

    .cb-coach-heading h3 {
        font-size: 14px;
    }

    .cb-booking-actions {
        width: 100%;
        align-items: stretch;
    }

    .cb-action-buttons {
        justify-content: flex-start;
    }

    .cb-action-buttons button {
        flex: 1;
    }

    .cb-details-grid {
        grid-template-columns: 1fr;
        gap: 14px;
    }
}

@media (max-width: 390px) {
    .cb-header-actions {
        flex-direction: column;
    }

    .cb-header-actions button {
        width: 100%;
    }

    .cb-action-buttons {
        flex-direction: column;
    }
}

`;
