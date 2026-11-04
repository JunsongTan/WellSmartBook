
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AdminAddGym from './AdminAddGym';

import AdminGymMap from './AdminGymMap';

import AdminGymEditor from './AdminGymEditor';

// ======================================================
// WELLSMARTBOOK - ADMIN GYM OVERSIGHT
// GET /api/admin/gyms
// ======================================================

const API_BASE_URL =
    `http://${window.location.hostname}:5000`;

const PAGE_SIZE = 5;

const EMPTY_SUMMARY = {
    totalGyms: 0,
    activeGyms: 0,
    disabledGyms: 0
};

// ======================================================
// FORMAT GYM ADDRESS
// ======================================================

function formatAddress(gym) {
    return [
        gym.addressLine1,
        gym.addressLine2,
        gym.postcode,
        gym.city,
        gym.state,
        gym.country
    ].filter(Boolean).join(', ');
}

// ======================================================
// FORMAT GYM COORDINATES
// ======================================================

function formatCoordinates(gym) {

    if (
        !Number.isFinite(gym.latitude) ||
        !Number.isFinite(gym.longitude)
    ) {
        return 'Not available';
    }

    return (
        `${gym.latitude.toFixed(6)}, ` +
        `${gym.longitude.toFixed(6)}`
    );
}


 // ======================================================
 // DISPLAY SAVED GYM PHOTO
 // ======================================================

function getGymPhotoUrl(imageUrl) {

    if (typeof imageUrl !== 'string') {
        return '';
    }

    const value = imageUrl.trim();

    // Photos uploaded to the WellSmartBook backend.

    if (value.startsWith('/api/gym-images/')) {
        return `${API_BASE_URL}${value}`;
    }

    // Support existing externally hosted gym photos.

    try {

        const url = new URL(value);

        return ['http:', 'https:'].includes(
            url.protocol
        )
            ? url.href
            : '';

    } catch {

        return '';
    }
}

// ======================================================
// GYM PHOTO COMPONENT
// ======================================================

function GymCardPhoto({ gym }) {

    const [failedUrl, setFailedUrl] = useState('');

    const photoUrl = getGymPhotoUrl(
        gym.imageUrl
    );

    if (
        !photoUrl ||
        failedUrl === photoUrl
    ) {

        return (
            <div className="agym-card-photo-empty">
                No gym photo available
            </div>
        );
    }

    return (

        <img
            className="agym-card-photo"
            src={photoUrl}
            alt={`${gym.name} gym photo`}
            loading="lazy"
            onError={() =>
                setFailedUrl(photoUrl)
            }
        />

    );
}


// ======================================================
// ADMIN GYMS COMPONENT
// ======================================================

export default function AdminGyms() {

    const navigate = useNavigate();

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [page, setPage] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);

    const [summary, setSummary] = useState(null);
    const [gyms, setGyms] = useState([]);
    
    const [selectedGymId, setSelectedGymId] = useState(null);

    // ==================================================
    // ENABLE / DISABLE GYM STATUS
    // ==================================================

    const [statusTarget, setStatusTarget] = useState(null);
    const [statusBusy, setStatusBusy] = useState(false);
    const [statusError, setStatusError] = useState('');
    const [statusMessage, setStatusMessage] = useState('');


    const [pagination, setPagination] = useState({
        page: 1,
        limit: PAGE_SIZE,
        total: 0,
        totalPages: 0
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // ==================================================
    // DEBOUNCE SEARCH
    // ==================================================

    useEffect(() => {

        const timer = setTimeout(() => {
            setSearch(searchInput.trim());
        }, 350);

        return () => clearTimeout(timer);

    }, [searchInput]);

    // ==================================================
    // FETCH GYMS FROM MYSQL
    // ==================================================

    useEffect(() => {

        const controller = new AbortController();

        async function loadGyms() {

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

                const params = new URLSearchParams({
                    search,
                    status,
                    page: String(page),
                    limit: String(PAGE_SIZE)
                });

                const response = await fetch(
                    `${API_BASE_URL}/api/admin/gyms?${params}`,
                    {
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
                // EXPIRED OR INVALID ADMIN SESSION
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
                // VALIDATE API RESPONSE
                // ======================================

                if (
                    !response.ok ||
                    data.success !== true ||
                    !Array.isArray(data.gyms) ||
                    !data.summary ||
                    !data.pagination
                ) {

                    throw new Error(
                        data.message ||
                        'Unable to load gym information.'
                    );
                }

                const requiredKeys = [
                    'totalGyms',
                    'activeGyms',
                    'disabledGyms'
                ];

                const validSummary = requiredKeys.every(
                    key =>
                        Number.isSafeInteger(
                            data.summary[key]
                        ) &&
                        data.summary[key] >= 0
                );

                if (
                    !validSummary ||
                    !Number.isSafeInteger(
                        data.pagination.total
                    ) ||
                    !Number.isSafeInteger(
                        data.pagination.totalPages
                    )
                ) {

                    throw new Error(
                        'The server returned invalid gym statistics.'
                    );
                }

                // ======================================
                // UPDATE FRONTEND
                // ======================================

                setSummary(data.summary);
                setGyms(data.gyms);
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

                    setGyms([]);
                }

            } finally {

                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        void loadGyms();

        return () => controller.abort();

    }, [navigate, page, refreshKey, search, status]);

    // ==================================================
    // REFRESH DATA
    // ==================================================

    function refreshGyms() {

        if (!loading) {
            setRefreshKey(value => value + 1);
        }
    }
    
    // ======================================================
    // REFRESH GYM LIST AFTER NEW GYM CREATED
    // ======================================================

    function handleGymCreated() {

        setSearchInput('');

        setSearch('');

        setStatus('all');

        setPage(1);

        setRefreshKey(value => value + 1);
    }

    
    // ======================================================
    // SELECT GYM FROM GOOGLE MAP
    // ======================================================

    
    // ======================================================
    // CLICK GOOGLE MAP MARKER TO EDIT GYM
    // ======================================================

    function handleMapGymClick(gym) {

        setSelectedGymId(gym.id);
    }

    // ==================================================
    // OPEN / CLOSE THE STATUS CONFIRMATION
    // ==================================================

    function requestStatusChange(gym) {
        if (statusBusy) return;

        setStatusError('');
        setStatusMessage('');
        setStatusTarget({
            id: Number(gym.id),
            name: gym.name,
            isActive: gym.isActive === true
        });
    }

    function cancelStatusChange() {
        if (statusBusy) return;

        setStatusTarget(null);
        setStatusError('');
    }

    // Allow Escape to close an idle confirmation dialog.
    useEffect(() => {
        if (!statusTarget || statusBusy) return;

        function handleEscape(event) {
            if (event.key === 'Escape') {
                setStatusTarget(null);
                setStatusError('');
            }
        }

        document.addEventListener('keydown', handleEscape);

        return () => document.removeEventListener(
            'keydown', handleEscape
        );
    }, [statusTarget, statusBusy]);

    // ==================================================
    // CONFIRM ENABLE / DISABLE WITH BACKEND
    // ==================================================

    async function confirmStatusChange() {
        if (!statusTarget || statusBusy) return;

        const token = localStorage.getItem('token');

        if (!token) {
            navigate('/login', { replace: true });
            return;
        }

        const newStatus = !statusTarget.isActive;
        const gymId = statusTarget.id;

        setStatusBusy(true);
        setStatusError('');
        setStatusMessage('');

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/admin/gyms/${gymId}/status`,
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ isActive: newStatus })
                }
            );

            const data = await response.json().catch(() => ({}));

            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                navigate('/login', { replace: true });
                return;
            }

            if (!response.ok || data.success !== true) {
                throw new Error(
                    data.message || 'Unable to update gym status.'
                );
            }

            // The response is authoritative, including when the
            // gym status changed in another admin session.
            setStatusTarget(null);
            setStatusMessage(
                data.message || 'Gym status updated successfully.'
            );

            // Refresh counts, list, filter and Google Maps markers.
            setRefreshKey(value => value + 1);

        } catch (requestError) {
            // Keep the dialog open so the admin can read a 409
            // conflict and retry later or cancel.
            setStatusError(
                requestError.message || 'Connection error.'
            );
        } finally {
            setStatusBusy(false);
        }
    }




    // ==================================================
    // SEARCH AND STATUS FILTER
    // ==================================================

    function updateSearch(value) {
        setSearchInput(value);
        setPage(1);
    }

    function updateStatus(value) {
        setStatus(value);
        setPage(1);
    }

    // ==================================================
    // PAGINATION
    // ==================================================

    const counts = summary || EMPTY_SUMMARY;

    const total = pagination.total;

    const totalPages = Math.max(
        1,
        pagination.totalPages
    );

    const start = total === 0
        ? 0
        : (page - 1) * PAGE_SIZE + 1;

    const end = total === 0
        ? 0
        : Math.min(total, page * PAGE_SIZE);

    const numberFormat =
        new Intl.NumberFormat('en-MY');

    // ==================================================
    // DASHBOARD CARDS
    // ==================================================

    const summaryCards = [
        {
            label: 'Registered Gyms',
            value: counts.totalGyms,
            icon: '▦',
            cls: 'total'
        },
        {
            label: 'Active Gyms',
            value: counts.activeGyms,
            icon: '✓',
            cls: 'active'
        },
        {
            label: 'Disabled Gyms',
            value: counts.disabledGyms,
            icon: '⊘',
            cls: 'disabled'
        }
    ];

    // ==================================================
    // RENDER
    // ==================================================

    return (

        <main className="agym-page">

            <style>{css}</style>

            {/* ======================================
                PAGE HEADER
            ====================================== */}

            <header className="agym-header">

                <div>

                    <span className="agym-eyebrow">
                        ADMIN MANAGEMENT
                    </span>

                    <h1>Gym Oversight</h1>

                    <p>
                        Monitor all registered gyms
                        and their current status.
                    </p>

                </div>

                <button
                    type="button"
                    className="agym-refresh"
                    onClick={refreshGyms}
                    disabled={loading}
                >
                    <span aria-hidden="true">↻</span>

                    {loading
                        ? 'Loading...'
                        : 'Refresh Data'}
                </button>

            </header>
            
            {/* ======================================
                ADMIN - ADD GYM
            ====================================== */}

            <AdminAddGym onCreated={handleGymCreated} />


            {/* ======================================
                GYM STATISTICS
            ====================================== */}

            <div
                className="agym-stats"
                aria-label="Gym statistics"
            >

                {summaryCards.map(card => (

                    <section
                        className="agym-stat"
                        key={card.label}
                    >

                        <div className="agym-stat-top">

                            <span>{card.label}</span>

                            <span
                                className={
                                    `agym-stat-icon agym-icon-${card.cls}`
                                }
                                aria-hidden="true"
                            >
                                {card.icon}
                            </span>

                        </div>

                        <strong>
                            {summary
                                ? numberFormat.format(card.value)
                                : '—'}
                        </strong>

                    </section>

                ))}

            </div>

            {/* ======================================
                REGISTERED GYM PANEL
            ====================================== */}

            <section className="agym-panel">

                <div className="agym-panel-top">

                    <div>

                        <h2>
                            Registered Gym Locations
                        </h2>

                        <p>
                            Search by gym name, city,
                            state, or address.
                        </p>

                    </div>

                    <span className="agym-count">
                        {loading
                            ? 'Loading...'
                            : `${total} matching gym${
                                total === 1 ? '' : 's'
                            }`}
                    </span>

                </div>
                
                {/* ==================================
                    ADMIN GOOGLE MAP
                ================================== */}

                <AdminGymMap
                    gyms={gyms}
                    onSelectGym={handleMapGymClick}
                />


                {/* ==================================
                    SEARCH AND FILTER
                ================================== */}

                <div className="agym-filters">

                    <label>

                        <span>Search gyms</span>

                        <input
                            type="search"
                            value={searchInput}
                            onChange={event =>
                                updateSearch(event.target.value)
                            }
                            placeholder="Search gym name or location..."
                            maxLength={100}
                        />

                    </label>

                    <label>

                        <span>Gym status</span>

                        <select
                            value={status}
                            onChange={event =>
                                updateStatus(event.target.value)
                            }
                        >

                            <option value="all">
                                All gyms
                            </option>

                            <option value="active">
                                Active only
                            </option>

                            <option value="disabled">
                                Disabled only
                            </option>

                        </select>

                    </label>

                </div>

                {/* ==================================
                    STATUS UPDATE RESULT
                ================================== */}

                {statusMessage && (
                    <div className="agym-status-success" role="status">
                        {statusMessage}
                    </div>
                )}

                {/* ==================================
                    ERROR MESSAGE
                ================================== */}

                {error && (

                    <div
                        className="agym-error"
                        role="alert"
                    >

                        <span>{error}</span>

                        <button
                            type="button"
                            onClick={refreshGyms}
                        >
                            Try Again
                        </button>

                    </div>

                )}

                {/* ==================================
                    GYM LIST
                ================================== */}

                {loading ? (

                    <div
                        className="agym-empty"
                        role="status"
                    >
                        Loading gym information...
                    </div>

                ) : gyms.length === 0 ? (

                    <div className="agym-empty">

                        <strong>
                            No gyms found
                        </strong>

                        <p>
                            Try a different search
                            or status filter.
                        </p>

                    </div>

                ) : (

                    <div className="agym-grid">

                        {gyms.map(gym => (

                            
                            <article
                                id={`agym-card-${gym.id}`}
                                className={
                                    Number(selectedGymId) === Number(gym.id)
                                        ? 'agym-card agym-card-selected'
                                        : 'agym-card'
                                }
                                key={gym.id}    
                            >


                                <div className="agym-card-top">

                                    <div
                                        className="agym-gym-symbol"
                                        aria-hidden="true"
                                    >
                                        ⌖
                                    </div>

                                    <div className="agym-card-identity">

                                        <h3>
                                            {gym.name}
                                        </h3>

                                        <small>
                                            Gym ID #{gym.id}
                                        </small>

                                    </div>

                                    <span
                                        className={
                                            `agym-badge ${
                                                gym.isActive
                                                    ? 'agym-badge-active'
                                                    : 'agym-badge-disabled'
                                            }`
                                        }
                                    >
                                        {gym.isActive
                                            ? 'Active'
                                            : 'Disabled'}
                                    </span>

                                </div>
                                
                                {/* ======================================
                                    GYM PHOTO
                                ====================================== */}

                                <GymCardPhoto gym={gym} />


                                {gym.description && (

                                    <p className="agym-description">
                                        {gym.description}
                                    </p>

                                )}

                                <dl className="agym-details">

                                    <div>
                                        <dt>Address</dt>
                                        <dd>
                                            {formatAddress(gym) ||
                                                'Not available'}
                                        </dd>
                                    </div>

                                    <div>
                                        <dt>Coordinates</dt>
                                        <dd>
                                            {formatCoordinates(gym)}
                                        </dd>
                                    </div>

                                    <div>
                                        <dt>Phone</dt>
                                        <dd>
                                            {gym.phone ||
                                                'Not provided'}
                                        </dd>
                                    </div>

                                    <div>
                                        <dt>Email</dt>
                                        <dd>
                                            {gym.email ||
                                                'Not provided'}
                                        </dd>
                                    </div>

                                    <div>
                                        <dt>Website</dt>
                                        <dd>
                                            {gym.websiteUrl ||
                                                'Not provided'}
                                        </dd>
                                    </div>

                                </dl>
                                
                                {/* ======================================
                                    EDIT GYM BUTTON
                                ====================================== */}

                                <div className="agym-card-actions">

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSelectedGymId(gym.id)
                                        }
                                        disabled={statusBusy}
                                    >
                                        ✎ Edit Gym Details
                                    </button>

                                    <button
                                        type="button"
                                        className={gym.isActive
                                            ? 'agym-status-disable'
                                            : 'agym-status-enable'}
                                        onClick={() => requestStatusChange(gym)}
                                        disabled={statusBusy}
                                    >
                                        {gym.isActive
                                            ? '⊘ Disable Gym'
                                            : '✓ Enable Gym'}
                                    </button>

                                </div>


                            </article>

                        ))}

                    </div>

                )}

                {/* ==================================
                    PAGINATION
                ================================== */}

                <footer className="agym-pagination">

                    <span>
                        Showing {start}–{end} of {total}
                    </span>

                    <div>

                        <button
                            type="button"
                            disabled={
                                loading || page <= 1
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
            
            {/* ======================================
                EDIT GYM DETAILS MODAL
            ====================================== */}

            {selectedGymId !== null && (

                <AdminGymEditor
                    key={selectedGymId}
                    gymId={selectedGymId}

                    onClose={() =>
                        setSelectedGymId(null)
                    }

                    onSaved={() =>
                        setRefreshKey(value => value + 1)
                    }
                />

            )}


            {/* ======================================
                CONFIRM GYM STATUS CHANGE
            ====================================== */}

            {statusTarget && (
                <div className="agym-confirm-overlay">
                    <section
                        className="agym-confirm-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="agym-confirm-title"
                        aria-describedby="agym-confirm-description"
                    >
                        <h2 id="agym-confirm-title">
                            {statusTarget.isActive
                                ? 'Disable Gym?'
                                : 'Enable Gym?'}
                        </h2>

                        <p className="agym-confirm-name">
                            {statusTarget.name} (Gym #{statusTarget.id})
                        </p>

                        <p id="agym-confirm-description">
                            {statusTarget.isActive
                                ? 'Disabling this gym hides it from User and Coach gym discovery and prevents new booking holds and checkout requests. Existing bookings and payment records are not deleted. Active Stripe checkouts may prevent disabling.'
                                : 'Enabling this gym makes it available for User and Coach gym discovery and allows new bookings where coach availability exists.'}
                        </p>

                        {statusError && (
                            <p className="agym-confirm-error" role="alert">
                                {statusError}
                            </p>
                        )}

                        <div className="agym-confirm-actions">
                            <button
                                type="button"
                                className="agym-confirm-cancel"
                                onClick={cancelStatusChange}
                                disabled={statusBusy}
                                autoFocus
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className={statusTarget.isActive
                                    ? 'agym-confirm-disable'
                                    : 'agym-confirm-enable'}
                                onClick={confirmStatusChange}
                                disabled={statusBusy}
                            >
                                {statusBusy
                                    ? 'Updating...'
                                    : statusTarget.isActive
                                        ? 'Yes, Disable Gym'
                                        : 'Yes, Enable Gym'}
                            </button>
                        </div>
                    </section>
                </div>
            )}

            <p className="agym-note">
                Disabled gyms remain visible to administrators and
                keep their existing booking and payment history.
                Disabling does not automatically cancel or refund
                existing confirmed reservations.
            </p>

        </main>
    );
}

// ======================================================
// CSS INSIDE JSX
// ======================================================

const css = `

.agym-page,
.agym-page * {
    box-sizing: border-box;
}

.agym-page {
    width: 100%;
    max-width: 1500px;
    min-width: 0;
    margin: 0 auto;
    color: #142b4d;
}

.agym-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 24px;
}

.agym-eyebrow {
    color: #0759dc;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
}

.agym-header h1 {
    color: #142b4d !important;
    margin: 10px 0;
    font-size: 27px;
    line-height: 1.3;
}

.agym-header p {
    color: #718096;
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
}

.agym-refresh {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1px solid #d4e3f6;
    border-radius: 10px;
    padding: 11px 15px;
    color: #0759dc;
    background: white;
    font-family: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
}

.agym-refresh > span {
    font-size: 19px;
}

.agym-refresh:hover {
    background: #eef5ff;
}

.agym-page button:disabled {
    opacity: .5;
    cursor: not-allowed;
}

.agym-page button:focus-visible {
    outline: 3px solid #93bdff;
    outline-offset: 2px;
}

.agym-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 15px;
    margin-bottom: 20px;
}

.agym-stat {
    background: white;
    border: 1px solid #e0e8f4;
    border-radius: 15px;
    padding: 22px;
    min-width: 0;
}

.agym-stat-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    color: #546781;
    font-size: 12px;
    font-weight: 750;
}

.agym-stat-icon {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 37px;
    height: 37px;
    border-radius: 10px;
    font-size: 22px;
}

.agym-icon-total {
    background: #edf3ff;
    color: #0759dc;
}

.agym-icon-active {
    background: #e7f8ef;
    color: #087747;
}

.agym-icon-disabled {
    background: #fff1f2;
    color: #be123c;
}

.agym-stat > strong {
    display: block;
    margin-top: 11px;
    color: #0759dc;
    font-size: 31px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
}

.agym-panel {
    background: white;
    border: 1px solid #e0e8f4;
    border-radius: 15px;
    min-width: 0;
    overflow: hidden;
}

.agym-panel-top {
    padding: 22px 22px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
}

.agym-panel-top h2 {
    color: #142b4d !important;
    font-size: 18px;
    margin: 0 0 6px;
}

.agym-panel-top p {
    color: #718096;
    font-size: 12px;
    margin: 0;
    line-height: 1.6;
}

.agym-count {
    flex-shrink: 0;
    background: #eaf2ff;
    border-radius: 99px;
    color: #0759dc;
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 800;
}

.agym-filters {
    display: grid;
    grid-template-columns:
        minmax(0, 1fr) minmax(170px, 240px);
    gap: 14px;
    padding: 15px 22px 22px;
}

.agym-filters label {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 8px;
    font-size: 12px;
    font-weight: 700;
    color: #40536e;
}

.agym-filters input,
.agym-filters select {
    min-width: 0;
    width: 100%;
    padding: 12px 13px;
    border: 1px solid #d6e2f2;
    border-radius: 9px;
    background: #fbfcff;
    color: #203954;
    outline: 0;
    font-family: inherit;
    font-size: 13px;
}

.agym-filters input:focus,
.agym-filters select:focus {
    border-color: #0759dc;
    box-shadow:
        0 0 0 3px rgba(7, 89, 220, .10);
}

.agym-grid {
    border-top: 1px solid #edf1f7;
    padding: 19px 22px;
    display: grid;
    grid-template-columns:
        repeat(2, minmax(0, 1fr));
    gap: 16px;
}

.agym-card {
    min-width: 0;
    padding: 19px;
    border: 1px solid #e2eaf5;
    border-radius: 13px;
    background: white;
}


/* ==========================================
   GYM CARD PHOTO
========================================== */

.agym-card-photo,
.agym-card-photo-empty {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    margin-top: 15px;

    border-radius: 11px;
    border: 1px solid #e2eaf5;
}

.agym-card-photo {
    object-fit: cover;
    background: #f1f5fb;
}

.agym-card-photo-empty {
    display: flex;
    justify-content: center;
    align-items: center;

    background: #f1f5fb;
    color: #8190a6;

    font-size: 12px;
    text-align: center;
    padding: 12px;
}


.agym-card-top {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
}

.agym-gym-symbol {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 42px;
    height: 42px;
    border-radius: 11px;
    background: #edf3ff;
    color: #0759dc;
    font-size: 25px;
}

.agym-card-identity {
    min-width: 0;
    flex: 1;
}

.agym-card-identity h3 {
    color: #142b4d !important;
    margin: 0 0 4px;
    font-size: 15px;
    overflow-wrap: anywhere;
}

.agym-card-identity small {
    color: #8190a6;
    font-size: 10px;
}

.agym-badge {
    flex-shrink: 0;
    border-radius: 99px;
    padding: 7px 10px;
    font-size: 10px;
    font-weight: 800;
}

.agym-badge-active {
    background: #e7f8ef;
    color: #087747;
}

.agym-badge-disabled {
    background: #fff1f2;
    color: #be123c;
}

.agym-description {
    color: #5d7089;
    font-size: 12px;
    line-height: 1.65;
    overflow-wrap: anywhere;
    margin: 15px 0;
}

.agym-details {
    margin: 15px 0 0;
    display: grid;
    gap: 11px;
}

.agym-details > div {
    border-top: 1px solid #f0f3f8;
    padding-top: 10px;
    display: grid;
    grid-template-columns:
        95px minmax(0, 1fr);
    gap: 10px;
}

.agym-details dt {
    color: #8190a6;
    font-size: 11px;
}

.agym-details dd {
    margin: 0;
    color: #263d59;
    font-size: 12px;
    font-weight: 550;
    overflow-wrap: anywhere;
}

.agym-error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    margin: 0 22px 16px;
    padding: 12px;
    border: 1px solid #fecdd3;
    border-radius: 10px;
    background: #fff1f2;
    color: #9f1239;
    font-size: 12px;
}

.agym-error button {
    padding: 7px 12px;
    border: 1px solid #fda4af;
    border-radius: 7px;
    background: white;
    color: #9f1239;
    cursor: pointer;
}

.agym-empty {
    padding: 38px 15px;
    color: #718096;
    font-size: 13px;
    text-align: center;
}

.agym-empty strong {
    color: #263d59;
}

.agym-empty p {
    font-size: 12px;
}

.agym-pagination {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    padding: 17px 22px;
    border-top: 1px solid #edf1f7;
    color: #718096;
    font-size: 12px;
}

.agym-pagination > div {
    display: flex;
    align-items: center;
    gap: 11px;
}

.agym-pagination button {
    border: 1px solid #d6e1f0;
    border-radius: 8px;
    padding: 9px 11px;
    background: white;
    color: #0759dc;
    font-family: inherit;
    font-size: 11px;
    font-weight: 750;
    cursor: pointer;
}

.agym-pagination > div > span {
    white-space: nowrap;
    color: #526782;
    font-weight: 700;
    font-size: 11px;
}

.agym-note {
    color: #718096;
    font-size: 12px;
    line-height: 1.7;
    margin: 16px 3px 0;
}

/* ==========================================
   SELECTED GYM FROM GOOGLE MAP
========================================== */

.agym-card-selected {
    border-color: #0759dc !important;
    background: #f1f7ff !important;
    box-shadow:
        0 0 0 3px rgba(7, 89, 220, .10);
}

/* ==========================================
   EDIT GYM BUTTON
========================================== */

.agym-card-actions {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 16px;
}

.agym-card-actions button {
    padding: 10px 14px;

    border: 1px solid #0759dc;
    border-radius: 9px;

    color: #0759dc;
    background: #eff5ff;

    font-family: inherit;
    font-size: 12px;
    font-weight: 750;

    cursor: pointer;
}

.agym-card-actions button:hover {
    background: #dceafe;
}


/* ==========================================
   ENABLE / DISABLE BUTTONS
========================================== */

.agym-card-actions .agym-status-disable {
    color: #b42338;
    border-color: #fecaca;
    background: #fff1f2;
}

.agym-card-actions .agym-status-disable:hover {
    background: #ffe4e6;
}

.agym-card-actions .agym-status-enable {
    color: #087747;
    border-color: #a7e7c5;
    background: #e7f8ef;
}

.agym-card-actions .agym-status-enable:hover {
    background: #d1fae5;
}

.agym-status-success {
    margin: 0 22px 18px;
    padding: 12px 14px;
    border: 1px solid #b7e7cc;
    border-radius: 10px;
    color: #087747;
    background: #e7f8ef;
    font-size: 12px;
}

/* ==========================================
   CONFIRMATION DIALOG
========================================== */

.agym-confirm-overlay {
    position: fixed;
    inset: 0;
    z-index: 1500;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 14px;
    background: rgba(14, 33, 58, .65);
}

.agym-confirm-dialog {
    width: min(480px, 100%);
    max-height: 90dvh;
    overflow-y: auto;
    padding: 24px;
    border: 1px solid #e0e8f4;
    border-radius: 16px;
    background: white;
    color: #142b4d;
    box-shadow: 0 20px 60px rgba(0, 0, 0, .22);
}

.agym-confirm-dialog h2 {
    margin: 0 0 12px;
    color: #142b4d;
    font-size: 22px;
}

.agym-confirm-name {
    font-weight: 800;
    overflow-wrap: anywhere;
}

.agym-confirm-dialog p {
    line-height: 1.65;
    font-size: 13px;
}

.agym-confirm-dialog .agym-confirm-error {
    color: #9f1239;
    background: #fff1f2;
    border: 1px solid #fecdd3;
    padding: 12px;
    border-radius: 9px;
}

.agym-confirm-actions {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 10px;
}

.agym-confirm-actions button {
    font: inherit;
    font-size: 13px;
    font-weight: 800;
    padding: 11px 15px;
    border-radius: 9px;
    cursor: pointer;
}

.agym-confirm-cancel {
    color: #344763;
    background: white;
    border: 1px solid #d3e0f1;
}

.agym-confirm-disable {
    color: white;
    background: #b42338;
    border: 1px solid #b42338;
}

.agym-confirm-enable {
    color: white;
    background: #087747;
    border: 1px solid #087747;
}

/* ==========================================
   TABLET
========================================== */

@media (max-width: 1100px) {

    .agym-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 750px) {

    .agym-header {
        flex-direction: column;
    }

    .agym-refresh {
        width: 100%;
    }

    .agym-stats {
        grid-template-columns:
            repeat(2, minmax(0, 1fr));
    }

    .agym-stats .agym-stat:first-child {
        grid-column: 1 / -1;
    }

    .agym-filters {
        grid-template-columns: 1fr;
    }

    .agym-panel-top {
        flex-wrap: wrap;
    }

    .agym-pagination {
        flex-direction: column;
        align-items: stretch;
    }

    .agym-pagination > div {
        justify-content: space-between;
    }
}

/* ==========================================
   MOBILE
========================================== */

@media (max-width: 470px) {

    .agym-header h1 {
        font-size: 23px;
    }

    .agym-stat {
        padding: 16px;
    }

    .agym-stat > strong {
        font-size: 26px;
    }

    .agym-panel-top,
    .agym-filters,
    .agym-pagination {
        padding-left: 15px;
        padding-right: 15px;
    }

    .agym-grid {
        padding: 14px;
    }

    .agym-card {
        padding: 14px;
    }

    .agym-card-actions {
        flex-direction: column;
    }

    .agym-card-actions button {
        width: 100%;
    }

    .agym-confirm-dialog {
        padding: 18px;
    }

    .agym-confirm-actions {
        flex-direction: column;
    }

    .agym-confirm-actions button {
        width: 100%;
    }

    .agym-details > div {
        grid-template-columns:
            80px minmax(0, 1fr);
    }

    .agym-pagination button {
        padding: 9px 8px;
    }
}
`;
