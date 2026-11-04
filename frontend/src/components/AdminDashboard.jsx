
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ======================================================
// WELLSMARTBOOK - ADMIN DASHBOARD
// Live statistics from MySQL
// ======================================================

const API_BASE_URL =
    `http://${window.location.hostname}:5000`;

const STAT_CARDS = [
    {
        key: 'totalUsers',
        title: 'Total Users',
        icon: '♙',
        info: 'Registered normal user accounts'
    },
    {
        key: 'totalCoaches',
        title: 'Total Coaches',
        icon: '✦',
        info: 'Registered coach accounts'
    },
    {
        key: 'registeredGyms',
        title: 'Registered Gyms',
        icon: '⌖',
        info: 'All gyms in the system'
    },
    {
        key: 'totalBookings',
        title: 'Total Bookings',
        icon: '▤',
        info: 'Bookings across all statuses'
    }
];

// ======================================================
// ADMIN DASHBOARD COMPONENT
// ======================================================

export default function AdminDashboard() {

    const navigate = useNavigate();

    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [lastUpdated, setLastUpdated] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // ==================================================
    // LOAD ADMIN DASHBOARD STATISTICS
    // ==================================================

    useEffect(() => {

        const controller = new AbortController();

        async function loadDashboard() {

            if (refreshKey === 0) {
                setLoading(true);
            } else {
                setRefreshing(true);
            }

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

                // ======================================
                // CALL PROTECTED ADMIN API
                // ======================================

                const response = await fetch(
                    `${API_BASE_URL}/api/admin/dashboard`,
                    {
                        method: 'GET',

                        headers: {
                            Authorization: `Bearer ${token}`
                        },

                        signal: controller.signal
                    }
                );

                const data = await response
                    .json()
                    .catch(() => ({}));

                if (controller.signal.aborted) return;

                // ======================================
                // HANDLE INVALID OR EXPIRED LOGIN
                // ======================================

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

                // ======================================
                // CHECK API RESPONSE
                // ======================================

                if (
                    !response.ok ||
                    data.success !== true
                ) {

                    throw new Error(
                        data.message ||
                        'Unable to load dashboard statistics.'
                    );
                }

                // ======================================
                // VALIDATE RETURNED COUNTS
                // ======================================

                const requiredKeys = STAT_CARDS.map(
                    card => card.key
                );

                const validSummary = requiredKeys.every(
                    key =>
                        Number.isSafeInteger(
                            data.summary?.[key]
                        ) &&
                        data.summary[key] >= 0
                );

                if (!validSummary) {

                    throw new Error(
                        'The server returned invalid dashboard statistics.'
                    );
                }

                // ======================================
                // UPDATE DASHBOARD
                // ======================================

                setSummary(data.summary);
                setLastUpdated(new Date());

            } catch (requestError) {

                if (
                    requestError.name !== 'AbortError' &&
                    !controller.signal.aborted
                ) {

                    setError(
                        requestError.message ||
                        'Unable to connect to the server.'
                    );
                }

            } finally {

                if (!controller.signal.aborted) {

                    setLoading(false);
                    setRefreshing(false);
                }
            }
        }

        loadDashboard();

        return () => controller.abort();

    }, [navigate, refreshKey]);

    // ==================================================
    // REFRESH DATA
    // ==================================================

    function refreshDashboard() {

        if (loading || refreshing) return;

        setRefreshKey(previous => previous + 1);
    }

    // ==================================================
    // FORMAT COUNTS
    // ==================================================

    const numberFormatter =
        new Intl.NumberFormat('en-MY');

    // ==================================================
    // RENDER DASHBOARD
    // ==================================================

    return (

        <div className="admin-dashboard">

            <style>{css}</style>

            {/* ======================================
                DASHBOARD HEADER
            ====================================== */}

            <header className="admin-dashboard-header">

                <div>

                    <span className="admin-dashboard-eyebrow">
                        ADMIN DASHBOARD
                    </span>

                    <h1>System Overview</h1>

                    <p>
                        Live account, gym and booking
                        statistics from WellSmartBook.
                    </p>

                </div>

                <button
                    type="button"
                    className="admin-dashboard-refresh"
                    onClick={refreshDashboard}
                    disabled={loading || refreshing}
                >
                    <span aria-hidden="true">↻</span>

                    {refreshing
                        ? 'Refreshing...'
                        : 'Refresh Data'}
                </button>

            </header>

            {/* ======================================
                ERROR MESSAGE
            ====================================== */}

            {error && (

                <div
                    className="admin-dashboard-error"
                    role="alert"
                >

                    <strong>
                        Unable to load dashboard
                    </strong>

                    <span>{error}</span>

                    <button
                        type="button"
                        onClick={refreshDashboard}
                        disabled={loading || refreshing}
                    >
                        Try Again
                    </button>

                </div>
            )}

            {/* ======================================
                STATISTIC CARDS
            ====================================== */}

            <div
                className="admin-dashboard-grid"
                aria-busy={loading || refreshing}
            >

                {STAT_CARDS.map(card => (

                    <section
                        className="admin-dashboard-card"
                        key={card.key}
                    >

                        <div className="admin-dashboard-card-head">

                            <strong>
                                {card.title}
                            </strong>

                            <span
                                className="admin-dashboard-icon"
                                aria-hidden="true"
                            >
                                {card.icon}
                            </span>

                        </div>

                        <div className="admin-dashboard-value">

                            {loading ? (

                                <span className="admin-dashboard-placeholder">
                                    Loading...
                                </span>

                            ) : summary ? (

                                numberFormatter.format(
                                    summary[card.key]
                                )

                            ) : (

                                '—'

                            )}

                        </div>

                        <small>
                            {card.info}
                        </small>

                    </section>

                ))}

            </div>

            {/* ======================================
                DASHBOARD INFORMATION
            ====================================== */}

            <section className="admin-dashboard-note">

                <div
                    className="admin-dashboard-note-icon"
                    aria-hidden="true"
                >
                    i
                </div>

                <div>

                    <h2>
                        Dashboard Information
                    </h2>

                    <p>
                        These figures are retrieved from
                        MySQL. Registered gyms includes
                        all gym records; total bookings
                        includes every booking status.
                    </p>

                    {lastUpdated && (

                        <p className="admin-dashboard-updated">

                            Last updated:{' '}

                            {lastUpdated.toLocaleString('en-MY')}

                        </p>

                    )}

                </div>

            </section>

        </div>
    );
}

// ======================================================
// RESPONSIVE CSS INSIDE JSX
// ======================================================

const css = `

.admin-dashboard,
.admin-dashboard * {
    box-sizing: border-box;
}

.admin-dashboard {
    width: 100%;
    max-width: 1500px;
    margin: 0 auto;
    color: #142b4d;
}

/* ==========================================
   HEADER
========================================== */

.admin-dashboard-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 25px;
}

.admin-dashboard-eyebrow {
    color: #0759dc;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
}

.admin-dashboard-header h1 {
    font-size: 28px;
    margin: 10px 0;
}

.admin-dashboard-header p {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: #74859d;
}

/* Fix dashboard heading text visibility */

.admin-dashboard-header h1 {
    color: #142b4d !important;
}

.admin-dashboard-note h2 {
    color: #142b4d !important;
}


/* ==========================================
   REFRESH BUTTON
========================================== */

.admin-dashboard-refresh {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-shrink: 0;

    padding: 11px 15px;

    border: 1px solid #d4e3f6;
    border-radius: 10px;

    background: white;
    color: #0759dc;

    font: inherit;
    font-size: 12px;
    font-weight: 700;

    cursor: pointer;
}

.admin-dashboard-refresh:hover {
    background: #edf5ff;
}

.admin-dashboard-refresh:disabled {
    opacity: .55;
    cursor: not-allowed;
}

.admin-dashboard-refresh span {
    font-size: 18px;
    line-height: 1;
}

/* ==========================================
   STATISTICS GRID
========================================== */

.admin-dashboard-grid {
    display: grid;

    grid-template-columns:
        repeat(4, minmax(0, 1fr));

    gap: 17px;
}

/* ==========================================
   STATISTIC CARD
========================================== */

.admin-dashboard-card {
    min-width: 0;
    padding: 23px;

    border: 1px solid #e0e8f4;
    border-radius: 15px;

    background: white;

    box-shadow:
        0 5px 18px rgba(18, 44, 77, .025);
}

.admin-dashboard-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    font-size: 12px;
}

.admin-dashboard-card-head strong {
    font-weight: 750;
}

.admin-dashboard-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;

    width: 35px;
    height: 35px;

    border-radius: 10px;

    color: #0759dc;
    background: #ecf3ff;

    font-size: 23px;
}

.admin-dashboard-value {
    min-height: 44px;

    display: flex;
    align-items: center;

    margin: 14px 0 7px;

    font-size: 31px;
    font-weight: 800;
    color: #0759dc;

    font-variant-numeric: tabular-nums;
}

.admin-dashboard-placeholder {
    font-size: 14px;
    color: #91a0b5;
    font-weight: 500;
}

.admin-dashboard-card small {
    display: block;
    color: #91a0b5;
    font-size: 11px;
    line-height: 1.5;
}

/* ==========================================
   INFORMATION
========================================== */

.admin-dashboard-note {
    display: flex;
    align-items: flex-start;
    gap: 13px;

    padding: 23px;
    margin-top: 22px;

    background: #eaf2ff;

    border: 1px solid #d0e1ff;
    border-radius: 15px;
}

.admin-dashboard-note-icon {
    flex-shrink: 0;

    display: grid;
    place-items: center;

    width: 28px;
    height: 28px;

    border-radius: 50%;

    background: #d7e7ff;
    color: #0759dc;

    font-size: 16px;
    font-weight: 800;
}

.admin-dashboard-note h2 {
    margin: 0 0 8px;
    font-size: 16px;
}

.admin-dashboard-note p {
    margin: 0;
    color: #516784;
    line-height: 1.65;
    font-size: 12px;
}

.admin-dashboard-note .admin-dashboard-updated {
    margin-top: 10px;
    font-size: 11px;
    font-weight: 700;
}

/* ==========================================
   ERRORS
========================================== */

.admin-dashboard-error {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;

    padding: 14px 16px;
    margin-bottom: 18px;

    background: #fff1f2;
    border: 1px solid #fecdd3;
    border-radius: 11px;

    color: #9f1239;
    font-size: 12px;
}

.admin-dashboard-error button {
    border: 1px solid #fda4af;
    border-radius: 8px;

    background: white;
    color: #9f1239;

    padding: 8px 10px;

    font: inherit;
    font-weight: 750;
    cursor: pointer;
}

.admin-dashboard-error button:disabled {
    opacity: .5;
    cursor: not-allowed;
}

.admin-dashboard button:focus-visible {
    outline: 3px solid #93bdff;
    outline-offset: 3px;
}

/* ==========================================
   TABLET
========================================== */

@media (max-width: 1100px) {

    .admin-dashboard-grid {
        grid-template-columns:
            repeat(2, minmax(0, 1fr));
    }

}

/* ==========================================
   SMALL TABLET
========================================== */

@media (max-width: 650px) {

    .admin-dashboard-header {
        flex-direction: column;
    }

    .admin-dashboard-header h1 {
        font-size: 24px;
    }

    .admin-dashboard-refresh {
        width: 100%;
    }

}

/* ==========================================
   MOBILE
========================================== */

@media (max-width: 550px) {

    .admin-dashboard-grid {
        grid-template-columns: 1fr;
    }

    .admin-dashboard-card {
        padding: 18px;
    }

    .admin-dashboard-note {
        padding: 17px;
    }

}

`;
