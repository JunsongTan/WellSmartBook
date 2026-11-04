
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AdminAdministrators from './AdminAdministrators';

// ======================================================
// WELLSMARTBOOK - ADMIN USERS & COACHES
// GET /api/admin/accounts
// Read-only account management
// ======================================================

const API_BASE_URL =
    `http://${window.location.hostname}:5000`;

const PAGE_SIZE = 5;

const EMPTY_PAGINATION = {
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0
};

// ======================================================
// HELPER FUNCTIONS
// ======================================================

function displayName(account) {
    return (
        account.fullName?.trim() ||
        account.username ||
        'Unnamed account'
    );
}

function initials(account) {
    return displayName(account)
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word[0]?.toUpperCase() || '')
        .join('');
}

function RoleBadge({ role }) {
    return (
        <span
            className={
                `aa-role aa-role-${
                    role === 'coach' ? 'coach' : 'user'
                }`
            }
        >
            {role === 'coach' ? 'Coach' : 'User'}
        </span>
    );
}

// ======================================================
// ADMIN ACCOUNTS COMPONENT
// ======================================================

export default function AdminAccounts() {

    const navigate = useNavigate();

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [role, setRole] = useState('all');
    const [page, setPage] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);

    const [accounts, setAccounts] = useState([]);
    const [pagination, setPagination] =
        useState(EMPTY_PAGINATION);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Enable / Disable account confirmation.
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [actionPending, setActionPending] = useState(false);
    const [actionError, setActionError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // ==================================================
    // DELAY SEARCH WHILE USER IS TYPING
    // ==================================================

    useEffect(() => {

        const timer = setTimeout(() => {

            setSearch(searchInput.trim());

        }, 350);

        return () => clearTimeout(timer);

    }, [searchInput]);

    // ==================================================
    // LOAD ACCOUNTS FROM MYSQL API
    // ==================================================

    useEffect(() => {

        const controller = new AbortController();

        async function loadAccounts() {

            setLoading(true);
            setError('');

            const token = localStorage.getItem('token');

            if (!token) {

                navigate('/login', {
                    replace: true
                });

                return;
            }

            try {

                const params = new URLSearchParams({
                    role,
                    search,
                    page: String(page),
                    limit: String(PAGE_SIZE)
                });

                const response = await fetch(
                    `${API_BASE_URL}/api/admin/accounts?${params}`,
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
                // HANDLE EXPIRED OR INVALID ADMIN LOGIN
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
                // VALIDATE RESPONSE
                // ======================================

                if (
                    !response.ok ||
                    data.success !== true
                ) {

                    throw new Error(
                        data.message ||
                        'Unable to load accounts.'
                    );
                }

                if (
                    !Array.isArray(data.accounts) ||
                    !data.pagination ||
                    !Number.isSafeInteger(
                        data.pagination.total
                    )
                ) {

                    throw new Error(
                        'The server returned an invalid account list.'
                    );
                }

                // ======================================
                // UPDATE ACCOUNT LIST
                // ======================================

                setAccounts(data.accounts);
                setPagination(data.pagination);

            } catch (requestError) {

                if (
                    requestError.name !== 'AbortError' &&
                    !controller.signal.aborted
                ) {

                    setAccounts([]);
                    setPagination(EMPTY_PAGINATION);

                    setError(
                        requestError.message ||
                        'Server connection error.'
                    );
                }

            } finally {

                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        void loadAccounts();

        return () => controller.abort();

    }, [navigate, page, refreshKey, role, search]);

    // ==================================================
    // SEARCH
    // ==================================================

    function updateSearch(value) {

        setSearchInput(value);
        setPage(1);
    }

    // ==================================================
    // ROLE FILTER
    // ==================================================

    function updateRole(value) {

        setRole(value);
        setPage(1);
    }

    // ==================================================
    // ENABLE / DISABLE USER OR COACH
    // ==================================================

    function askToChangeStatus(account) {
        setActionError('');
        setSuccessMessage('');
        setSelectedAccount(account);
    }

    function closeConfirmation() {
        if (!actionPending) {
            setSelectedAccount(null);
            setActionError('');
        }
    }

    async function confirmStatusChange() {
        if (!selectedAccount || actionPending) return;

        setActionPending(true);
        setActionError('');

        const desiredStatus = !selectedAccount.isActive;

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/admin/accounts/${selectedAccount.id}/status`,
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ isActive: desiredStatus })
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
                throw new Error(data.message || 'Unable to update account.');
            }

            setSuccessMessage(data.message || 'Account status updated.');
            setSelectedAccount(null);
            setRefreshKey(value => value + 1);
        } catch (err) {
            setActionError(err.message || 'Unable to update account.');
        } finally {
            setActionPending(false);
        }
    }

    // ==================================================
    // PAGINATION
    // ==================================================

    const total = pagination.total;

    const totalPages = Math.max(
        1,
        pagination.totalPages
    );

    const start =
        total === 0
            ? 0
            : (pagination.page - 1) * PAGE_SIZE + 1;

    const end =
        total === 0
            ? 0
            : Math.min(
                total,
                pagination.page * PAGE_SIZE
            );

    // ==================================================
    // RENDER
    // ==================================================

    return (

        <main className="aa-page">

            <style>{css}</style>

            {/* ======================================
                PAGE HEADER
            ====================================== */}

            <header className="aa-header">

                <div>

                    <span className="aa-eyebrow">
                        ADMIN MANAGEMENT
                    </span>

                    <h1>Manage Users & Coaches</h1>

                    <p>
                        View registered accounts and find
                        members of WellSmartBook.
                    </p>

                </div>

                <button
                    type="button"
                    className="aa-refresh"
                    onClick={() =>
                        setRefreshKey(value => value + 1)
                    }
                    disabled={loading}
                >
                    <span aria-hidden="true">↻</span>

                    {loading ? 'Loading...' : 'Refresh Data'}
                </button>

            </header>

            {/* ======================================
                ACCOUNT PANEL
            ====================================== */}

            <section className="aa-panel">

                <div className="aa-panel-heading">

                    <div>

                        <h2>Registered Accounts</h2>

                        <p>
                            Search by full name, username,
                            or email address.
                        </p>

                    </div>

                    <span className="aa-total">

                        {loading
                            ? 'Loading...'
                            : `${total} matching account${
                                total === 1 ? '' : 's'
                            }`
                        }

                    </span>

                </div>

                {/* ==================================
                    SEARCH AND FILTER
                ================================== */}

                <div className="aa-filters">

                    <label className="aa-field aa-search">

                        <span>Search accounts</span>

                        <input
                            type="search"
                            value={searchInput}
                            onChange={event =>
                                updateSearch(event.target.value)
                            }
                            maxLength={100}
                            placeholder="Search name, username, email..."
                        />

                    </label>

                    <label className="aa-field aa-filter">

                        <span>Account role</span>

                        <select
                            value={role}
                            onChange={event =>
                                updateRole(event.target.value)
                            }
                        >
                            <option value="all">
                                All users & coaches
                            </option>

                            <option value="user">
                                Users only
                            </option>

                            <option value="coach">
                                Coaches only
                            </option>
                        </select>

                    </label>

                </div>

                {successMessage && (
                    <div className="aa-success" role="status">
                        {successMessage}
                    </div>
                )}

                {/* ==================================
                    ERROR MESSAGE
                ================================== */}

                {error && (

                    <div className="aa-alert" role="alert">

                        <span>{error}</span>

                        <button
                            type="button"
                            onClick={() =>
                                setRefreshKey(
                                    value => value + 1
                                )
                            }
                        >
                            Try Again
                        </button>

                    </div>

                )}

                {/* ==================================
                    LOADING / EMPTY / ACCOUNT LIST
                ================================== */}

                {loading ? (

                    <div className="aa-state" role="status">
                        Loading account information...
                    </div>

                ) : accounts.length === 0 ? (

                    <div className="aa-state">

                        <strong>No accounts found</strong>

                        <p>
                            Try another search or select
                            a different role.
                        </p>

                    </div>

                ) : (

                    <>

                        {/* ==========================
                            DESKTOP ACCOUNT TABLE
                        ========================== */}

                        <div className="aa-table-wrap">

                            <table className="aa-table">

                                <thead>

                                    <tr>
                                        <th>Account</th>
                                        <th>Username</th>
                                        <th>Email Address</th>
                                        <th>Role</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                        <th>ID</th>
                                    </tr>

                                </thead>

                                <tbody>

                                    {accounts.map(account => (

                                        <tr key={account.id}>

                                            <td>

                                                <div className="aa-identity">

                                                    <span
                                                        className="aa-avatar"
                                                        aria-hidden="true"
                                                    >
                                                        {initials(account)}
                                                    </span>

                                                    <strong>
                                                        {displayName(account)}
                                                    </strong>

                                                </div>

                                            </td>

                                            <td className="aa-break">
                                                {account.username || '—'}
                                            </td>

                                            <td className="aa-break">
                                                {account.email || '—'}
                                            </td>

                                            <td>
                                                <RoleBadge
                                                    role={account.role}
                                                />
                                            </td>

                                            <td>
                                                <span className={`aa-status ${account.isActive ? 'aa-active' : 'aa-inactive'}`}>
                                                    {account.isActive ? 'Active' : 'Disabled'}
                                                </span>
                                            </td>

                                            <td>
                                                <button
                                                    type="button"
                                                    className={`aa-status-action ${account.isActive ? 'aa-action-disable' : 'aa-action-enable'}`}
                                                    onClick={() => askToChangeStatus(account)}
                                                >
                                                    {account.isActive ? 'Disable' : 'Enable'}
                                                </button>
                                            </td>

                                            <td className="aa-id">
                                                #{account.id}
                                            </td>

                                        </tr>

                                    ))}

                                </tbody>

                            </table>

                        </div>

                        {/* ==========================
                            MOBILE ACCOUNT CARDS
                        ========================== */}

                        <div className="aa-mobile-list">

                            {accounts.map(account => (

                                <article
                                    key={account.id}
                                    className="aa-mobile-card"
                                >

                                    <div className="aa-mobile-top">

                                        <div className="aa-identity">

                                            <span
                                                className="aa-avatar"
                                                aria-hidden="true"
                                            >
                                                {initials(account)}
                                            </span>

                                            <div>

                                                <strong>
                                                    {displayName(account)}
                                                </strong>

                                                <small>
                                                    Account #{account.id}
                                                </small>

                                            </div>

                                        </div>

                                        <RoleBadge
                                            role={account.role}
                                        />

                                    </div>

                                    <dl>

                                        <div>
                                            <dt>Username</dt>
                                            <dd>
                                                {account.username || '—'}
                                            </dd>
                                        </div>

                                        <div>
                                            <dt>Email</dt>
                                            <dd>
                                                {account.email || '—'}
                                            </dd>
                                        </div>

                                        <div>
                                            <dt>Status</dt>
                                            <dd>
                                                <span className={`aa-status ${account.isActive ? 'aa-active' : 'aa-inactive'}`}>
                                                    {account.isActive ? 'Active' : 'Disabled'}
                                                </span>
                                            </dd>
                                        </div>

                                    </dl>

                                    <button
                                        type="button"
                                        className={`aa-status-action aa-mobile-action ${account.isActive ? 'aa-action-disable' : 'aa-action-enable'}`}
                                        onClick={() => askToChangeStatus(account)}
                                    >
                                        {account.isActive ? 'Disable Account' : 'Enable Account'}
                                    </button>

                                </article>

                            ))}

                        </div>

                    </>

                )}

                {/* ==================================
                    PAGINATION
                ================================== */}

                <footer className="aa-footer">

                    <span className="aa-page-summary">
                        Showing {start}–{end} of {total}
                    </span>

                    <div className="aa-pagination">

                        <button
                            type="button"
                            onClick={() =>
                                setPage(value =>
                                    Math.max(1, value - 1)
                                )
                            }
                            disabled={loading || page <= 1}
                        >
                            ← Previous
                        </button>

                        <span>
                            Page {page} of {totalPages}
                        </span>

                        <button
                            type="button"
                            onClick={() =>
                                setPage(value =>
                                    Math.min(
                                        totalPages,
                                        value + 1
                                    )
                                )
                            }
                            disabled={
                                loading ||
                                page >= totalPages
                            }
                        >
                            Next →
                        </button>

                    </div>

                </footer>

            </section>

            {/* ======================================
                INFORMATION
            ====================================== */}

            
            <p className="aa-explanation">
                User and coach accounts are managed above.
                Administrator accounts are listed separately.
                Disabling an account does not delete its bookings
                or payment history. Passwords and hashes
                are never displayed.
            </p>

            
            {/* ======================================
                ADMINISTRATOR ACCOUNTS AND ADD ADMIN
            ====================================== */}

            <AdminAdministrators />


            {selectedAccount && (
                <div className="aa-modal-overlay">
                    <div
                        className="aa-confirm-modal"
                        role="alertdialog"
                        aria-modal="true"
                        aria-labelledby="aa-confirm-title"
                        aria-describedby="aa-confirm-description"
                    >
                        <h2 id="aa-confirm-title">
                            {selectedAccount.isActive ? 'Disable Account?' : 'Enable Account?'}
                        </h2>
                        <p id="aa-confirm-description">
                            {selectedAccount.isActive
                                ? 'This account will be unable to log in or use protected features until enabled again.'
                                : 'This account will be allowed to log in again.'}
                        </p>
                        <p className="aa-confirm-identity">
                            {displayName(selectedAccount)} ({selectedAccount.role})
                        </p>

                        {actionError && (
                            <p className="aa-confirm-error" role="alert">{actionError}</p>
                        )}

                        <div className="aa-modal-buttons">
                            <button
                                type="button"
                                className="aa-modal-cancel"
                                onClick={closeConfirmation}
                                disabled={actionPending}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={`aa-status-action ${selectedAccount.isActive ? 'aa-action-disable' : 'aa-action-enable'}`}
                                onClick={confirmStatusChange}
                                disabled={actionPending}
                            >
                                {actionPending
                                    ? 'Updating...'
                                    : selectedAccount.isActive ? 'Confirm Disable' : 'Confirm Enable'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </main>
    );
}

// ======================================================
// RESPONSIVE CSS INSIDE JSX
// ======================================================

const css = `

.aa-page,
.aa-page * {
    box-sizing: border-box;
}

.aa-page {
    width: 100%;
    max-width: 1500px;
    margin: 0 auto;
    min-width: 0;
    color: #142b4d;
}

.aa-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 24px;
}

.aa-eyebrow {
    color: #0759dc;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
}

.aa-header h1 {
    color: #142b4d !important;
    margin: 9px 0;
    font-size: 27px;
    line-height: 1.25;
}

.aa-header p {
    margin: 0;
    color: #718096;
    font-size: 13px;
    line-height: 1.6;
}

.aa-refresh {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-shrink: 0;
    border: 1px solid #d4e3f6;
    border-radius: 10px;
    padding: 11px 15px;
    background: white;
    color: #0759dc;
    font-family: inherit;
    font-size: 12px;
    font-weight: 750;
    cursor: pointer;
}

.aa-refresh:hover {
    background: #eff6ff;
}

.aa-refresh:disabled {
    opacity: .55;
    cursor: not-allowed;
}

.aa-refresh > span {
    font-size: 18px;
}

.aa-panel {
    background: white;
    border: 1px solid #e0e8f4;
    border-radius: 15px;
    min-width: 0;
    overflow: hidden;
}

.aa-panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 22px 23px 12px;
}

.aa-panel-heading h2 {
    color: #142b4d !important;
    font-size: 18px;
    margin: 0 0 6px;
}

.aa-panel-heading p {
    color: #718096;
    font-size: 12px;
    margin: 0;
}

.aa-total {
    flex-shrink: 0;
    background: #eaf2ff;
    color: #0759dc;
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 750;
}

.aa-filters {
    display: grid;
    grid-template-columns:
        minmax(0, 1fr) minmax(180px, 240px);
    gap: 14px;
    padding: 17px 23px 23px;
}

.aa-field {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: #40536e;
    font-size: 12px;
    font-weight: 700;
}

.aa-field input,
.aa-field select {
    width: 100%;
    min-width: 0;
    padding: 12px 13px;
    border: 1px solid #d5e0ee;
    border-radius: 9px;
    background: #fbfcff;
    color: #253958;
    outline: none;
    font: inherit;
    font-size: 13px;
}

.aa-field input:focus,
.aa-field select:focus {
    border-color: #0759dc;
    box-shadow: 0 0 0 3px rgba(7,89,220,.1);
}

/* Desktop table */

.aa-table-wrap {
    width: 100%;
    overflow-x: auto;
}

.aa-table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 12px;
}

.aa-table th {
    background: #f7f9fd;
    color: #63758e;
    font-size: 11px;
    font-weight: 800;
    padding: 13px 18px;
    white-space: nowrap;
    border-top: 1px solid #ebeff6;
    border-bottom: 1px solid #ebeff6;
}

.aa-table td {
    padding: 15px 18px;
    border-bottom: 1px solid #edf1f7;
    vertical-align: middle;
    color: #3f516b;
}

.aa-table tr:last-child td {
    border-bottom: 0;
}

.aa-table tbody tr:hover {
    background: #fafcff;
}

.aa-identity {
    display: flex;
    gap: 11px;
    align-items: center;
    min-width: 150px;
}

.aa-identity strong {
    display: block;
    color: #213853;
    font-size: 12px;
    overflow-wrap: anywhere;
}

.aa-avatar {
    width: 37px;
    height: 37px;
    flex-shrink: 0;
    background: #e8f1ff;
    color: #0759dc;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 12px;
    font-weight: 800;
}

.aa-break {
    overflow-wrap: anywhere;
    word-break: break-word;
}

.aa-id {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}

.aa-role {
    display: inline-block;
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
}

.aa-role-user {
    background: #e9f3ff;
    color: #0759dc;
}

.aa-role-coach {
    background: #e7f8ef;
    color: #087747;
}

/* Pagination */

.aa-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border-top: 1px solid #ebeff6;
    padding: 17px 23px;
}

.aa-page-summary {
    color: #667892;
    font-size: 12px;
}

.aa-pagination {
    display: flex;
    align-items: center;
    gap: 10px;
}

.aa-pagination button {
    background: white;
    border: 1px solid #d6e1f0;
    border-radius: 8px;
    padding: 9px 11px;
    color: #0759dc;
    font-family: inherit;
    font-size: 11px;
    font-weight: 750;
    cursor: pointer;
}

.aa-pagination button:disabled {
    opacity: .4;
    cursor: not-allowed;
}

.aa-pagination span {
    font-size: 11px;
    font-weight: 650;
    white-space: nowrap;
    color: #516784;
}

/* Messages */

.aa-state {
    padding: 45px 20px;
    text-align: center;
    color: #657891;
    font-size: 13px;
}

.aa-state strong {
    color: #273a55;
}

.aa-state p {
    font-size: 12px;
}

.aa-alert {
    margin: 0 23px 15px;
    border: 1px solid #fecdd3;
    border-radius: 9px;
    background: #fff1f2;
    color: #9f1239;
    padding: 13px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
}

.aa-alert button {
    padding: 7px 10px;
    border: 1px solid #fda4af;
    border-radius: 7px;
    color: #9f1239;
    background: white;
    cursor: pointer;
    font: inherit;
    font-weight: 700;
}

.aa-explanation {
    color: #718096;
    line-height: 1.65;
    font-size: 12px;
    margin: 17px 2px 0;
}

.aa-mobile-list {
    display: none;
}

.aa-page button:focus-visible {
    outline: 3px solid #93bdff;
    outline-offset: 2px;
}

/* Mobile account cards */

@media (max-width: 760px) {

    .aa-header {
        flex-direction: column;
    }

    .aa-refresh {
        width: 100%;
    }

    .aa-filters {
        grid-template-columns: 1fr;
    }

    .aa-panel-heading {
        flex-wrap: wrap;
    }

    .aa-table-wrap {
        display: none;
    }

    .aa-mobile-list {
        display: grid;
        gap: 12px;
        padding: 0 16px 16px;
    }

    .aa-mobile-card {
        border: 1px solid #e2eaf5;
        border-radius: 12px;
        padding: 15px;
        background: #fff;
        min-width: 0;
    }

    .aa-mobile-top {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        align-items: center;
    }

    .aa-mobile-top .aa-identity {
        min-width: 0;
    }

    .aa-mobile-top .aa-identity small {
        display: block;
        color: #94a3b8;
        font-size: 10px;
        margin-top: 4px;
    }

    .aa-mobile-card dl {
        margin: 14px 0 0;
        display: grid;
        gap: 9px;
    }

    .aa-mobile-card dl > div {
        display: grid;
        grid-template-columns: 75px minmax(0, 1fr);
        gap: 10px;
    }

    .aa-mobile-card dt {
        color: #718096;
        font-size: 11px;
    }

    .aa-mobile-card dd {
        color: #263a58;
        font-size: 12px;
        margin: 0;
        overflow-wrap: anywhere;
    }

    .aa-footer {
        flex-direction: column;
        align-items: stretch;
    }

    .aa-pagination {
        justify-content: space-between;
    }

}

@media (max-width: 420px) {

    .aa-panel-heading,
    .aa-filters,
    .aa-footer {
        padding-left: 15px;
        padding-right: 15px;
    }

    .aa-header h1 {
        font-size: 23px;
    }

    .aa-pagination button {
        padding: 9px 8px;
    }

}

/* Enable / disable account */
.aa-status { display:inline-block; padding:6px 10px; border-radius:999px; font-size:11px; font-weight:800; white-space:nowrap; }
.aa-active { background:#e7f8ef; color:#087747; }
.aa-inactive { background:#fff1f2; color:#be123c; }
.aa-status-action { border-radius:9px; padding:9px 13px; font-family:inherit; font-size:11px; font-weight:800; cursor:pointer; white-space:nowrap; }
.aa-action-disable { background:white; border:1px solid #f1a0ab; color:#b42338; }
.aa-action-enable { background:#0759dc; border:1px solid #0759dc; color:white; }
.aa-status-action:disabled { opacity:.5; cursor:not-allowed; }
.aa-mobile-action { width:100%; margin-top:16px; }
.aa-success { margin:0 23px 16px; padding:13px; color:#076b44; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; font-size:12px; }
.aa-modal-overlay { position:fixed; inset:0; z-index:1000; display:grid; place-items:center; padding:18px; background:rgba(14,30,55,.55); }
.aa-confirm-modal { width:min(440px,100%); max-height:90vh; overflow:auto; border-radius:17px; padding:27px; background:white; box-shadow:0 22px 75px rgba(0,0,0,.2); }
.aa-confirm-modal h2 { color:#142b4d !important; margin:0 0 13px; font-size:21px; }
.aa-confirm-modal p { color:#526782; font-size:13px; line-height:1.6; }
.aa-confirm-identity { color:#142b4d !important; font-weight:800; overflow-wrap:anywhere; }
.aa-confirm-error { color:#b42338 !important; }
.aa-modal-buttons { display:flex; justify-content:flex-end; flex-wrap:wrap; gap:10px; margin-top:24px; }
.aa-modal-cancel { border:1px solid #d9e2ef; background:white; border-radius:9px; padding:10px 14px; cursor:pointer; color:#40536e; font-family:inherit; font-size:12px; font-weight:750; }
@media(max-width:420px) { .aa-confirm-modal { padding:20px; } .aa-modal-buttons > button { flex:1; } }

`;
