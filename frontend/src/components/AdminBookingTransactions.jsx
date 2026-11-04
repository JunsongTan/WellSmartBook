
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ======================================================
// WELLSMARTBOOK - ADMIN BOOKING TRANSACTIONS
// GET /api/admin/booking-transactions
// READ ONLY
// ======================================================

const API_BASE_URL =
    `http://${window.location.hostname}:5000`;

const PAGE_SIZE = 10;

const EMPTY_SUMMARY = {
    totalBookings: 0,
    confirmedBookings: 0,
    completedBookings: 0,
    pendingBookings: 0,
    cancelledBookings: 0,
    expiredBookings: 0,
    paidBookings: 0,
    paidTotalsByCurrency: []
};

const BOOKING_STATUS_OPTIONS = [
    { value: 'all', label: 'All booking statuses' },
    { value: 'pending_payment', label: 'Pending payment' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'expired', label: 'Expired' }
];

const PAYMENT_STATUS_OPTIONS = [
    { value: 'all', label: 'All payment statuses' },
    { value: 'unpaid', label: 'Unpaid' },
    { value: 'pending', label: 'Pending' },
    { value: 'paid', label: 'Paid' }
];

const STATUS_LABELS = {
    pending_payment: 'Pending payment',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    expired: 'Expired',
    unpaid: 'Unpaid',
    pending: 'Pending',
    paid: 'Paid'
};

// ======================================================
// FORMAT STATUS
// ======================================================

function statusLabel(value) {
    return STATUS_LABELS[value] ||
        String(value || 'Unknown').replaceAll('_', ' ');
}

function statusClass(value) {
    if (
        value === 'confirmed' ||
        value === 'completed' ||
        value === 'paid'
    ) {
        return 'positive';
    }

    if (
        value === 'cancelled' ||
        value === 'expired'
    ) {
        return 'negative';
    }

    return 'pending';
}

function StatusBadge({ value }) {

    return (
        <span
            className={
                `abt-badge abt-badge-${statusClass(value)}`
            }
        >
            {statusLabel(value)}
        </span>
    );
}

// ======================================================
// FORMAT MONEY
// ======================================================

function money(amount, currency = 'MYR') {

    const number = Number(amount);

    if (!Number.isFinite(number)) {
        return '—';
    }

    const code =
        String(currency || 'MYR').toUpperCase();

    try {
        return new Intl.NumberFormat('en-MY', {
            style: 'currency',
            currency: code
        }).format(number);

    } catch {
        return `${code} ${number.toFixed(2)}`;
    }
}

// ======================================================
// DESKTOP TABLE ROW
// ======================================================

function BookingRow({ booking }) {

    return (
        <tr>
            <td>
                <strong>#{booking.bookingId}</strong>
            </td>

            <td>
                <strong>
                    {booking.sessionDate || '—'}
                </strong>

                <small>
                    {booking.startTime || '—'}
                    {' – '}
                    {booking.endTime || '—'}
                </small>

                <small>
                    {booking.durationMinutes} min
                </small>
            </td>

            <td>
                <strong>
                    {booking.customerName}
                </strong>

                <small>
                    {booking.customerEmail || 'No email'}
                </small>
            </td>

            <td>
                {booking.coachName}
            </td>

            <td>
                {booking.gymName}
            </td>

            <td>
                <strong>
                    {money(
                        booking.amount,
                        booking.currency
                    )}
                </strong>
            </td>

            <td>
                <StatusBadge value={booking.status} />
            </td>

            <td>
                <StatusBadge
                    value={booking.paymentStatus}
                />
            </td>
        </tr>
    );
}

// ======================================================
// MOBILE BOOKING CARD
// ======================================================

function BookingMobileCard({ booking }) {

    return (
        <article className="abt-mobile-card">

            <div className="abt-mobile-head">

                <div>
                    <strong>
                        Booking #{booking.bookingId}
                    </strong>

                    <small>
                        {booking.sessionDate}
                        {' · '}
                        {booking.startTime}
                        {'–'}
                        {booking.endTime}
                    </small>
                </div>

                <strong className="abt-mobile-amount">
                    {money(
                        booking.amount,
                        booking.currency
                    )}
                </strong>

            </div>

            <dl className="abt-mobile-details">

                <div>
                    <dt>Customer</dt>
                    <dd>{booking.customerName}</dd>
                </div>

                <div>
                    <dt>Email</dt>
                    <dd>
                        {booking.customerEmail || '—'}
                    </dd>
                </div>

                <div>
                    <dt>Coach</dt>
                    <dd>{booking.coachName}</dd>
                </div>

                <div>
                    <dt>Gym</dt>
                    <dd>{booking.gymName}</dd>
                </div>

                <div>
                    <dt>Duration</dt>
                    <dd>
                        {booking.durationMinutes} minutes
                    </dd>
                </div>

                <div>
                    <dt>Booking</dt>
                    <dd>
                        <StatusBadge
                            value={booking.status}
                        />
                    </dd>
                </div>

                <div>
                    <dt>Payment</dt>
                    <dd>
                        <StatusBadge
                            value={booking.paymentStatus}
                        />
                    </dd>
                </div>

            </dl>

        </article>
    );
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function AdminBookingTransactions() {

    const navigate = useNavigate();

    // ==============================================
    // SEARCH / FILTER / PAGINATION
    // ==============================================

    const [searchInput, setSearchInput] =
        useState('');

    const [search, setSearch] =
        useState('');

    const [status, setStatus] =
        useState('all');

    const [paymentStatus, setPaymentStatus] =
        useState('all');

    const [page, setPage] =
        useState(1);

    const [refreshKey, setRefreshKey] =
        useState(0);

    // ==============================================
    // BACKEND DATA
    // ==============================================

    const [summary, setSummary] =
        useState(EMPTY_SUMMARY);

    const [bookings, setBookings] =
        useState([]);

    const [pagination, setPagination] = useState({
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 0
    });

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState('');

    // ==============================================
    // SEARCH DEBOUNCE
    // ==============================================

    useEffect(() => {

        const timeout = setTimeout(() => {
            setSearch(searchInput.trim());
        }, 350);

        return () => clearTimeout(timeout);

    }, [searchInput]);

    // ==============================================
    // LOAD BOOKING TRANSACTIONS FROM MYSQL
    // ==============================================

    useEffect(() => {

        const controller = new AbortController();

        async function loadTransactions() {

            setLoading(true);
            setError('');

            try {

                const token =
                    localStorage.getItem('token');

                if (!token) {

                    navigate('/login', {
                        replace: true
                    });

                    return;
                }

                // ==================================
                // BUILD SEARCH PARAMETERS
                // ==================================

                const params = new URLSearchParams({
                    search,
                    status,
                    paymentStatus,
                    page: String(page),
                    limit: String(PAGE_SIZE)
                });

                // ==================================
                // CALL ADMIN BOOKING API
                // ==================================

                const response = await fetch(
                    `${API_BASE_URL}/api/admin/booking-transactions?${params}`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        },
                        signal: controller.signal
                    }
                );

                const data = await response
                    .json()
                    .catch(() => ({}));

                if (controller.signal.aborted) {
                    return;
                }

                // ==================================
                // HANDLE EXPIRED ADMIN LOGIN
                // ==================================

                if (
                    response.status === 401 ||
                    response.status === 403
                ) {

                    localStorage.removeItem('token');
                    localStorage.removeItem('user');

                    navigate('/login', {
                        replace: true
                    });

                    return;
                }

                // ==================================
                // VALIDATE BACKEND RESPONSE
                // ==================================

                if (
                    !response.ok ||
                    data.success !== true ||
                    !Array.isArray(data.bookings) ||
                    !data.summary ||
                    !data.pagination
                ) {

                    throw new Error(
                        data.message ||
                        'Unable to load booking transactions.'
                    );
                }

                // ==================================
                // UPDATE REACT STATE
                // ==================================

                setSummary(data.summary);
                setBookings(data.bookings);
                setPagination(data.pagination);

            } catch (requestError) {

                if (
                    requestError.name !== 'AbortError' &&
                    !controller.signal.aborted
                ) {

                    setError(
                        requestError.message ||
                        'Server connection error.'
                    );

                    setBookings([]);
                }

            } finally {

                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        void loadTransactions();

        return () => controller.abort();

    }, [
        navigate,
        search,
        status,
        paymentStatus,
        page,
        refreshKey
    ]);

    // ==============================================
    // FILTER HANDLERS
    // ==============================================

    function updateSearch(value) {
        setSearchInput(value);
        setPage(1);
    }

    function updateStatus(value) {
        setStatus(value);
        setPage(1);
    }

    function updatePaymentStatus(value) {
        setPaymentStatus(value);
        setPage(1);
    }

    // ==============================================
    // PAGINATION
    // ==============================================

    const total = Number(
        pagination.total || 0
    );

    const totalPages = Math.max(
        1,
        Number(pagination.totalPages || 0)
    );

    const start = total === 0
        ? 0
        : (page - 1) * PAGE_SIZE + 1;

    const end = Math.min(
        total,
        page * PAGE_SIZE
    );

    // ==============================================
    // SUMMARY CARDS
    // ==============================================

    const cards = [
        {
            label: 'Total Bookings',
            value: summary.totalBookings
        },
        {
            label: 'Confirmed',
            value: summary.confirmedBookings
        },
        {
            label: 'Pending Payment',
            value: summary.pendingBookings
        },
        {
            label: 'Paid Bookings',
            value: summary.paidBookings
        }
    ];

    // ==============================================
    // RENDER PAGE
    // ==============================================

    return (

        <main className="abt-page">

            <style>{css}</style>

            {/* ======================================
                PAGE HEADER
            ====================================== */}

            <header className="abt-header">

                <div>

                    <span className="abt-eyebrow">
                        ADMIN MANAGEMENT
                    </span>

                    <h1>
                        Booking Transactions
                    </h1>

                    <p>
                        View booking and payment records
                        across WellSmartBook.
                        This page is read-only.
                    </p>

                </div>

                <button
                    type="button"
                    className="abt-refresh"
                    disabled={loading}
                    onClick={() =>
                        setRefreshKey(value => value + 1)
                    }
                >
                    ↻ {loading
                        ? 'Loading...'
                        : 'Refresh Data'}
                </button>

            </header>

            {/* ======================================
                BOOKING STATISTICS
            ====================================== */}

            <section
                className="abt-stats"
                aria-label="Booking statistics"
            >

                {cards.map(card => (

                    <div
                        className="abt-stat"
                        key={card.label}
                    >

                        <span>
                            {card.label}
                        </span>

                        <strong>
                            {Number(
                                card.value || 0
                            ).toLocaleString('en-MY')}
                        </strong>

                    </div>

                ))}

            </section>

            {/* ======================================
                PAID BOOKING TOTALS
            ====================================== */}

            <section
                className="abt-revenue"
                aria-label="Paid booking totals"
            >

                <div>

                    <h2>
                        Paid Booking Totals
                    </h2>

                    <p>
                        Based on bookings marked paid,
                        grouped by currency.
                        Not net platform revenue.
                    </p>

                </div>

                <div className="abt-revenue-amounts">

                    {summary.paidTotalsByCurrency?.length
                        ? (

                            summary.paidTotalsByCurrency.map(
                                item => (

                                    <div key={item.currency}>

                                        <strong>
                                            {money(
                                                item.amount,
                                                item.currency
                                            )}
                                        </strong>

                                        <small>
                                            {item.bookingCount}
                                            {' '}paid booking(s)
                                        </small>

                                    </div>
                                )
                            )

                        ) : (

                            <span className="abt-muted">
                                No paid bookings yet
                            </span>

                        )}

                </div>

            </section>

            {/* ======================================
                BOOKING RECORDS
            ====================================== */}

            <section className="abt-panel">

                <div className="abt-panel-heading">

                    <div>

                        <h2>
                            Booking Records
                        </h2>

                        <p>
                            Search customer name/email,
                            coach, or gym.
                        </p>

                    </div>

                    <span className="abt-count">
                        {total} matching bookings
                    </span>

                </div>

                {/* ==================================
                    SEARCH / FILTER
                ================================== */}

                <div className="abt-filters">

                    <label>

                        <span>
                            Search bookings
                        </span>

                        <input
                            type="search"
                            placeholder="Search customer, coach or gym..."
                            value={searchInput}
                            maxLength={100}
                            onChange={event =>
                                updateSearch(event.target.value)
                            }
                        />

                    </label>

                    <label>

                        <span>
                            Booking status
                        </span>

                        <select
                            value={status}
                            onChange={event =>
                                updateStatus(event.target.value)
                            }
                        >

                            {BOOKING_STATUS_OPTIONS.map(
                                option => (

                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>

                                )
                            )}

                        </select>

                    </label>

                    <label>

                        <span>
                            Payment status
                        </span>

                        <select
                            value={paymentStatus}
                            onChange={event =>
                                updatePaymentStatus(
                                    event.target.value
                                )
                            }
                        >

                            {PAYMENT_STATUS_OPTIONS.map(
                                option => (

                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>

                                )
                            )}

                        </select>

                    </label>

                </div>

                {/* ==================================
                    ERROR MESSAGE
                ================================== */}

                {error && (

                    <div
                        className="abt-error"
                        role="alert"
                    >

                        <span>{error}</span>

                        <button
                            type="button"
                            onClick={() =>
                                setRefreshKey(value => value + 1)
                            }
                        >
                            Try Again
                        </button>

                    </div>

                )}

                {/* ==================================
                    BOOKING LIST
                ================================== */}

                {loading ? (

                    <p
                        className="abt-empty"
                        role="status"
                    >
                        Loading booking transactions...
                    </p>

                ) : error ? (

                    <p className="abt-empty">
                        Could not load booking transactions.
                    </p>

                ) : bookings.length === 0 ? (

                    <p className="abt-empty">
                        No bookings match the selected filters.
                    </p>

                ) : (

                    <>

                        {/* DESKTOP TABLE */}

                        <div className="abt-table-wrap">

                            <table className="abt-table">

                                <thead>
                                    <tr>
                                        <th>Booking</th>
                                        <th>Session</th>
                                        <th>Customer</th>
                                        <th>Coach</th>
                                        <th>Gym</th>
                                        <th>Amount</th>
                                        <th>Booking Status</th>
                                        <th>Payment</th>
                                    </tr>
                                </thead>

                                <tbody>

                                    {bookings.map(booking => (

                                        <BookingRow
                                            key={booking.bookingId}
                                            booking={booking}
                                        />

                                    ))}

                                </tbody>

                            </table>

                        </div>

                        {/* MOBILE CARDS */}

                        <div className="abt-mobile-list">

                            {bookings.map(booking => (

                                <BookingMobileCard
                                    key={booking.bookingId}
                                    booking={booking}
                                />

                            ))}

                        </div>

                    </>

                )}

                {/* ==================================
                    PAGINATION
                ================================== */}

                <footer className="abt-pagination">

                    <span>
                        Showing {start}–{end} of {total}
                    </span>

                    <div>

                        <button
                            type="button"
                            disabled={
                                loading ||
                                page <= 1
                            }
                            onClick={() =>
                                setPage(value =>
                                    Math.max(1, value - 1)
                                )
                            }
                        >
                            ← Previous
                        </button>

                        <span>
                            Page {page} of {totalPages}
                        </span>

                        <button
                            type="button"
                            disabled={
                                loading ||
                                page >= totalPages
                            }
                            onClick={() =>
                                setPage(value =>
                                    Math.min(
                                        totalPages,
                                        value + 1
                                    )
                                )
                            }
                        >
                            Next →
                        </button>

                    </div>

                </footer>

            </section>

        </main>
    );
}

// ======================================================
// CSS INSIDE JSX
// ======================================================

const css = `

.abt-page,
.abt-page * {
    box-sizing: border-box;
}

.abt-page {
    color: #142b4d;
    min-width: 0;
    max-width: 1500px;
    margin: auto;
}

/* PAGE HEADER */

.abt-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 15px;
    margin-bottom: 22px;
}

.abt-eyebrow {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
    color: #0759dc;
}

.abt-header h1 {
    margin: 9px 0;
    font-size: 27px;
    color: #142b4d;
}

.abt-header p {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: #718096;
}

.abt-refresh {
    flex-shrink: 0;
    padding: 11px 15px;
    border-radius: 10px;
    background: white;
    color: #0759dc;
    border: 1px solid #d4e3f6;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
}

.abt-page button:disabled {
    opacity: .5;
    cursor: not-allowed;
}

/* STATISTICS */

.abt-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 14px;
    margin-bottom: 17px;
}

.abt-stat {
    min-width: 0;
    padding: 20px;
    border-radius: 14px;
    border: 1px solid #e0e8f4;
    background: white;
}

.abt-stat span {
    color: #61728a;
    font-size: 12px;
    font-weight: 700;
}

.abt-stat strong {
    display: block;
    margin-top: 12px;
    font-size: 28px;
    color: #0759dc;
}

/* PAID BOOKING TOTALS */

.abt-revenue {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
    padding: 19px 22px;
    border: 1px solid #dce8fa;
    border-radius: 14px;
    background: #f0f6ff;
    margin-bottom: 20px;
}


.abt-revenue h2 {
    margin: 0 0 6px;
    font-size: 16px;
    color: #142b4d !important;
}


.abt-revenue p {
    margin: 0;
    font-size: 12px;
    color: #61728a;
    line-height: 1.6;
}

.abt-revenue-amounts {
    display: flex;
    gap: 20px;
    align-items: center;
    flex-wrap: wrap;
}

.abt-revenue-amounts strong {
    display: block;
    color: #0759dc;
    font-size: 21px;
}

.abt-revenue-amounts small {
    color: #61728a;
    font-size: 11px;
}

.abt-muted {
    color: #61728a;
    font-size: 12px;
}

/* TRANSACTIONS PANEL */

.abt-panel {
    min-width: 0;
    border: 1px solid #e0e8f4;
    border-radius: 15px;
    background: white;
    overflow: hidden;
}

.abt-panel-heading {
    padding: 21px 22px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
}


.abt-panel-heading h2 {
    margin: 0 0 6px;
    font-size: 18px;
    color: #142b4d !important;
}


.abt-panel-heading p {
    margin: 0;
    font-size: 12px;
    color: #718096;
}

.abt-count {
    padding: 8px 12px;
    border-radius: 99px;
    background: #eaf2ff;
    color: #0759dc;
    font-size: 11px;
    font-weight: 800;
}

/* SEARCH AND FILTER */

.abt-filters {
    display: grid;
    grid-template-columns:
        minmax(0, 1fr)
        minmax(160px, 220px)
        minmax(160px, 220px);
    gap: 12px;
    padding: 14px 22px 20px;
}

.abt-filters label {
    display: flex;
    flex-direction: column;
    gap: 7px;
    min-width: 0;
    font-size: 12px;
    font-weight: 700;
    color: #40536e;
}

.abt-filters input,
.abt-filters select {
    width: 100%;
    min-width: 0;
    padding: 11px 12px;
    border: 1px solid #d6e2f2;
    border-radius: 9px;
    background: #fbfcff;
    color: #203954;
    font-size: 13px;
    font-family: inherit;
}

.abt-error {
    margin: 0 22px 16px;
    padding: 12px;
    border: 1px solid #fecdd3;
    border-radius: 10px;
    background: #fff1f2;
    color: #9f1239;
    font-size: 12px;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
}

.abt-error button {
    padding: 8px;
    border: 1px solid #fda4af;
    border-radius: 8px;
    background: white;
    cursor: pointer;
}

.abt-empty {
    text-align: center;
    padding: 35px 18px;
    font-size: 13px;
    color: #718096;
}

/* DESKTOP TABLE */

.abt-table-wrap {
    width: 100%;
    overflow-x: auto;
}

.abt-table {
    width: 100%;
    min-width: 1010px;
    border-collapse: collapse;
    text-align: left;
}

.abt-table th {
    padding: 14px 12px;
    background: #f6f9fe;
    color: #64748b;
    font-size: 11px;
    white-space: nowrap;
    border-top: 1px solid #edf1f7;
}

.abt-table td {
    padding: 14px 12px;
    font-size: 12px;
    color: #263d59;
    vertical-align: top;
    border-top: 1px solid #edf1f7;
    overflow-wrap: anywhere;
}

.abt-table td strong {
    font-weight: 750;
}

.abt-table td small {
    display: block;
    margin-top: 5px;
    font-size: 11px;
    color: #718096;
}

.abt-table td:nth-child(3) {
    max-width: 200px;
}

.abt-table td:nth-child(5) {
    max-width: 170px;
}

/* STATUS BADGES */

.abt-badge {
    display: inline-flex;
    padding: 6px 9px;
    border-radius: 99px;
    font-size: 10px;
    font-weight: 800;
    white-space: nowrap;
}

.abt-badge-positive {
    background: #e7f8ef;
    color: #087747;
}

.abt-badge-pending {
    background: #fff6db;
    color: #895800;
}

.abt-badge-negative {
    background: #fff1f2;
    color: #b42338;
}

/* MOBILE BOOKING CARDS */

.abt-mobile-list {
    display: none;
}

/* PAGINATION */

.abt-pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 18px 22px;
    border-top: 1px solid #edf1f7;
    color: #718096;
    font-size: 12px;
}

.abt-pagination > div {
    display: flex;
    align-items: center;
    gap: 12px;
}

.abt-pagination button {
    padding: 9px 12px;
    border: 1px solid #d6e1f0;
    border-radius: 8px;
    background: white;
    color: #0759dc;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
}

.abt-pagination > div > span {
    white-space: nowrap;
    font-weight: 700;
    color: #526782;
}

/* ==========================================
   TABLET
========================================== */

@media (max-width: 1100px) {

    .abt-stats {
        grid-template-columns:
            repeat(2, minmax(0, 1fr));
    }

    .abt-filters {
        grid-template-columns: 1fr 1fr;
    }

    .abt-filters label:first-child {
        grid-column: 1 / -1;
    }
}

/* ==========================================
   MOBILE
========================================== */

@media (max-width: 750px) {

    .abt-header {
        flex-direction: column;
    }

    .abt-refresh {
        width: 100%;
    }

    .abt-table-wrap {
        display: none;
    }

    .abt-mobile-list {
        display: grid;
        gap: 12px;
        padding: 0 15px 16px;
    }

    .abt-mobile-card {
        padding: 16px;
        border: 1px solid #e0e8f4;
        border-radius: 12px;
        background: white;
    }

    .abt-mobile-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 10px;
        padding-bottom: 13px;
        border-bottom: 1px solid #edf1f7;
    }

    .abt-mobile-head > div > strong {
        display: block;
        font-size: 14px;
    }

    .abt-mobile-head small {
        display: block;
        color: #718096;
        margin-top: 6px;
        font-size: 11px;
    }

    .abt-mobile-amount {
        color: #0759dc;
    }

    .abt-mobile-details {
        display: grid;
        gap: 12px;
        margin: 14px 0 0;
    }

    .abt-mobile-details > div {
        display: grid;
        grid-template-columns:
            76px minmax(0, 1fr);
        gap: 9px;
    }

    .abt-mobile-details dt {
        color: #8190a6;
        font-size: 11px;
    }

    .abt-mobile-details dd {
        min-width: 0;
        margin: 0;
        overflow-wrap: anywhere;
        font-size: 12px;
        font-weight: 600;
    }

    .abt-pagination {
        flex-direction: column;
        align-items: stretch;
    }

    .abt-pagination > div {
        justify-content: space-between;
    }
}

/* ==========================================
   SMALL MOBILE
========================================== */

@media (max-width: 470px) {

    .abt-header h1 {
        font-size: 23px;
    }

    .abt-stats {
        gap: 9px;
    }

    .abt-stat {
        padding: 15px;
    }

    .abt-stat span {
        font-size: 11px;
    }

    .abt-stat strong {
        font-size: 24px;
    }

    .abt-filters {
        grid-template-columns: 1fr;
        padding: 12px 15px 18px;
    }

    .abt-filters label:first-child {
        grid-column: auto;
    }

    .abt-panel-heading {
        padding: 18px 15px;
    }

    .abt-revenue {
        padding: 16px;
    }

    .abt-pagination {
        padding: 16px 12px;
    }

    .abt-pagination button {
        padding: 9px 7px;
    }
}
`;
