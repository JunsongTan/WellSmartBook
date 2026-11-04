
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PasswordChecklist, {
    isStrongPassword
} from './PasswordChecklist';

// ======================================================
// WELLSMARTBOOK - ADMINISTRATOR ACCOUNTS
//
// GET  /api/admin/admins
// POST /api/admin/admins
// ======================================================

const API_BASE_URL =
    `http://${window.location.hostname}:5000`;

const EMPTY_FORM = {
    username: '',
    password: '',
    confirmPassword: ''
};

export default function AdminAdministrators() {

    const navigate = useNavigate();

    // ==================================================
    // ADMINISTRATOR LIST
    // ==================================================

    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [listError, setListError] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    // ==================================================
    // CREATE ADMIN FORM
    // ==================================================

    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [showPasswords, setShowPasswords] =
        useState(false);

    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');
    const [success, setSuccess] = useState('');

    // ==================================================
    // GET REGISTERED ADMINISTRATORS
    // ==================================================

    useEffect(() => {

        const controller = new AbortController();

        async function loadAdmins() {

            setLoading(true);
            setListError('');

            try {

                const token =
                    localStorage.getItem('token');

                if (!token) {

                    navigate('/login', {
                        replace: true
                    });

                    return;
                }

                const response = await fetch(
                    `${API_BASE_URL}/api/admin/admins`,
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

                // ======================================
                // INVALID ADMIN SESSION
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
                // CHECK RESPONSE
                // ======================================

                if (
                    !response.ok ||
                    data.success !== true ||
                    !Array.isArray(data.admins)
                ) {

                    throw new Error(
                        data.message ||
                        'Unable to load administrators.'
                    );
                }

                setAdmins(data.admins);

            } catch (error) {

                if (
                    !controller.signal.aborted &&
                    error.name !== 'AbortError'
                ) {

                    setListError(
                        error.message ||
                        'Unable to connect to the server.'
                    );
                }

            } finally {

                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        void loadAdmins();

        return () => controller.abort();

    }, [navigate, refreshKey]);

    // ==================================================
    // UPDATE FORM INPUTS
    // ==================================================

    function updateField(event) {

        const { name, value } = event.target;

        setForm(previous => ({
            ...previous,

            [name]:
                name === 'username'
                    ? value.toLowerCase()
                    : value
        }));

        setFormError('');
        setSuccess('');
    }

    // ==================================================
    // CLOSE CREATE ADMIN FORM
    // ==================================================

    function closeForm() {

        if (saving) return;

        setFormOpen(false);
        setForm(EMPTY_FORM);
        setFormError('');
        setShowPasswords(false);
    }

    // ==================================================
    // OPEN / CLOSE FORM
    // ==================================================

    function toggleForm() {

        if (formOpen) {

            closeForm();

        } else {

            setFormOpen(true);
            setSuccess('');
        }
    }

    // ==================================================
    // CREATE NEW ADMINISTRATOR
    // ==================================================

    async function handleCreateAdmin(event) {

        event.preventDefault();

        if (saving) return;

        setFormError('');
        setSuccess('');

        const username =
            form.username.trim().toLowerCase();

        // ==============================================
        // VALIDATE UNIQUE USERNAME FORMAT
        // ==============================================

        if (
            !/^[a-z][a-z0-9_]{2,31}$/.test(username)
        ) {

            setFormError(
                'Username must contain 3–32 characters, ' +
                'start with a letter, and use only lowercase ' +
                'letters, numbers or underscores.'
            );

            return;
        }

        // ==============================================
        // VALIDATE PASSWORD STRENGTH
        // ==============================================

        if (!isStrongPassword(form.password)) {

            setFormError(
                'Password needs at least 12 characters, ' +
                'uppercase and lowercase letters, a number, ' +
                'and a symbol (maximum 72 UTF-8 bytes).'
            );

            return;
        }

        // ==============================================
        // CONFIRM PASSWORD
        // ==============================================

        if (
            form.password !==
            form.confirmPassword
        ) {

            setFormError(
                'Confirm Password does not match.'
            );

            return;
        }

        // ==============================================
        // SEND CREATE ADMIN REQUEST
        // ==============================================

        setSaving(true);

        try {

            const token =
                localStorage.getItem('token');

            const response = await fetch(
                `${API_BASE_URL}/api/admin/admins`,
                {
                    method: 'POST',

                    headers: {
                        Authorization:
                            `Bearer ${token}`,

                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify({
                        username,
                        password: form.password
                    })
                }
            );

            const data = await response
                .json()
                .catch(() => ({}));

            // ==========================================
            // EXPIRED ADMIN LOGIN
            // ==========================================

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

            // ==========================================
            // HANDLE DATABASE / VALIDATION ERRORS
            // ==========================================

            if (
                !response.ok ||
                data.success !== true
            ) {

                throw new Error(
                    data.message ||
                    'Unable to create administrator.'
                );
            }

            // ==========================================
            // ADMIN CREATED SUCCESSFULLY
            // ==========================================

            setForm(EMPTY_FORM);
            setFormOpen(false);
            setShowPasswords(false);

            setSuccess(
                `Administrator "${
                    data.admin?.username || username
                }" created successfully.`
            );

            // Refresh administrator list.

            setRefreshKey(
                previous => previous + 1
            );

        } catch (error) {

            setFormError(
                error.message ||
                'Unable to connect to the server.'
            );

        } finally {

            setSaving(false);
        }
    }

    // ==================================================
    // PAGE RENDER
    // ==================================================

    return (

        <section
            className="aadm-section"
            aria-labelledby="aadm-title"
        >

            <style>{css}</style>

            {/* ======================================
                HEADER
            ====================================== */}

            <div className="aadm-heading">

                <div>

                    <span className="aadm-eyebrow">
                        ADMINISTRATOR MANAGEMENT
                    </span>

                    <h2 id="aadm-title">
                        Administrator Accounts
                    </h2>

                    <p>
                        View administrators and create
                        another secure admin account.
                    </p>

                </div>

                <div className="aadm-heading-actions">

                    <button
                        className="aadm-outline"
                        type="button"
                        disabled={loading}
                        onClick={() =>
                            setRefreshKey(
                                previous => previous + 1
                            )
                        }
                    >
                        ↻ Refresh
                    </button>

                    <button
                        className="aadm-primary"
                        type="button"
                        onClick={toggleForm}
                        disabled={saving}
                    >
                        {formOpen
                            ? 'Cancel'
                            : '+ Add Admin'}
                    </button>

                </div>

            </div>

            {/* ======================================
                SUCCESS MESSAGE
            ====================================== */}

            {success && (

                <p
                    className="aadm-success"
                    role="status"
                >
                    {success}
                </p>

            )}

            {/* ======================================
                LIST ERROR
            ====================================== */}

            {listError && (

                <div
                    className="aadm-error"
                    role="alert"
                >

                    {listError}

                    <button
                        type="button"
                        onClick={() =>
                            setRefreshKey(
                                previous => previous + 1
                            )
                        }
                    >
                        Retry
                    </button>

                </div>

            )}

            {/* ======================================
                ADD ADMIN FORM
            ====================================== */}

            {formOpen && (

                <form
                    className="aadm-form"
                    onSubmit={handleCreateAdmin}
                >

                    <h3>
                        Create New Administrator
                    </h3>

                    <p>
                        Administrators use a username
                        to log in. No email address
                        is needed.
                    </p>

                    {/* ADMIN USERNAME */}

                    <label htmlFor="aadm-username">
                        Admin Username
                    </label>

                    <input
                        id="aadm-username"
                        type="text"
                        name="username"
                        value={form.username}
                        onChange={updateField}
                        placeholder="e.g. admin_support"
                        autoComplete="off"
                        minLength={3}
                        maxLength={32}
                        pattern="[a-z][a-z0-9_]{2,31}"
                        required
                        disabled={saving}
                    />

                    
                    <small>
                        Unique among administrators.
                        Users and coaches may share usernames.
                        Use lowercase letters, numbers and underscores.
                    </small>


                    {/* PASSWORD */}

                    <label htmlFor="aadm-password">
                        Password
                    </label>

                    <input
                        id="aadm-password"
                        type={
                            showPasswords
                                ? 'text'
                                : 'password'
                        }
                        name="password"
                        value={form.password}
                        onChange={updateField}
                        placeholder="Enter strong password"
                        autoComplete="new-password"
                        required
                        disabled={saving}
                    />

                    {/* PASSWORD CHECKLIST */}

                    <PasswordChecklist
                        password={form.password}
                    />

                    {/* CONFIRM PASSWORD */}

                    <label htmlFor="aadm-confirm">
                        Confirm Password
                    </label>

                    <input
                        id="aadm-confirm"
                        type={
                            showPasswords
                                ? 'text'
                                : 'password'
                        }
                        name="confirmPassword"
                        value={form.confirmPassword}
                        onChange={updateField}
                        placeholder="Enter password again"
                        autoComplete="new-password"
                        required
                        disabled={saving}
                    />

                    {form.confirmPassword && (

                        <small
                            className={
                                form.password ===
                                form.confirmPassword
                                    ? 'aadm-match'
                                    : 'aadm-mismatch'
                            }
                        >

                            {form.password ===
                            form.confirmPassword
                                ? '✓ Passwords match'
                                : 'Passwords do not match yet'}

                        </small>

                    )}

                    {/* SHOW PASSWORDS */}

                    <label className="aadm-check">

                        <input
                            type="checkbox"
                            checked={showPasswords}
                            onChange={event =>
                                setShowPasswords(
                                    event.target.checked
                                )
                            }
                            disabled={saving}
                        />

                        Show passwords

                    </label>

                    {/* FORM ERROR */}

                    {formError && (

                        <div
                            className="aadm-error"
                            role="alert"
                        >
                            {formError}
                        </div>

                    )}

                    {/* FORM ACTIONS */}

                    <div className="aadm-form-actions">

                        <button
                            type="button"
                            className="aadm-outline"
                            onClick={closeForm}
                            disabled={saving}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="aadm-primary"
                            disabled={saving}
                        >
                            {saving
                                ? 'Creating Admin...'
                                : 'Create Administrator'}
                        </button>

                    </div>

                </form>

            )}

            {/* ======================================
                EXISTING ADMINISTRATORS
            ====================================== */}

            <div className="aadm-list-heading">

                <strong>
                    Registered Administrators
                </strong>

                <span>
                    {loading
                        ? 'Loading...'
                        : `${admins.length} administrator${
                            admins.length === 1 ? '' : 's'
                        }`
                    }
                </span>

            </div>

            {loading ? (

                <div
                    className="aadm-empty"
                    role="status"
                >
                    Loading administrators...
                </div>

            ) : admins.length === 0 ? (

                <div className="aadm-empty">
                    No administrators found.
                </div>

            ) : (

                <div className="aadm-list">

                    {admins.map(admin => (

                        <div
                            className="aadm-row"
                            key={admin.id}
                        >

                            <div className="aadm-person">

                                <span
                                    className="aadm-avatar"
                                    aria-hidden="true"
                                >
                                    {admin.username?.[0]
                                        ?.toUpperCase() || 'A'}
                                </span>

                                <div>

                                    <strong>
                                        {admin.username}
                                    </strong>

                                    <small>
                                        Administrator · ID #{admin.id}
                                    </small>

                                </div>

                            </div>

                            <span
                                className={
                                    admin.isActive
                                        ? 'aadm-badge-active'
                                        : 'aadm-badge-disabled'
                                }
                            >
                                {admin.isActive
                                    ? 'Active'
                                    : 'Disabled'}
                            </span>

                        </div>

                    ))}

                </div>

            )}

            <p className="aadm-note">
                New admins can log in through the shared
                WellSmartBook Login page using their
                username and password. Do not share
                administrator credentials. Passwords
                are never displayed in this list.
            </p>

        </section>
    );
}

// ======================================================
// CSS INSIDE JSX
// ======================================================

const css = `

.aadm-section,
.aadm-section * {
    box-sizing: border-box;
}

.aadm-section {
    margin-top: 24px;
    background: white;
    border: 1px solid #e0e8f4;
    border-radius: 15px;
    padding: 23px;
    color: #142b4d;
    min-width: 0;
}

.aadm-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
}

.aadm-eyebrow {
    display: block;
    color: #0759dc;
    font-weight: 800;
    font-size: 11px;
    letter-spacing: 1px;
    margin-bottom: 8px;
}

.aadm-heading h2,
.aadm-form h3 {
    color: #142b4d !important;
    margin: 0 0 8px;
    font-size: 19px;
}

.aadm-heading p,
.aadm-form > p {
    color: #718096;
    font-size: 12px;
    line-height: 1.6;
    margin: 0;
}

.aadm-heading-actions,
.aadm-form-actions {
    display: flex;
    gap: 9px;
    flex-wrap: wrap;
}

.aadm-primary,
.aadm-outline {
    border-radius: 9px;
    padding: 11px 14px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 750;
    cursor: pointer;
}

.aadm-primary {
    color: white;
    background: #0759dc;
    border: 1px solid #0759dc;
}

.aadm-primary:hover {
    background: #0049c2;
}

.aadm-outline {
    color: #0759dc;
    background: white;
    border: 1px solid #d5e1f0;
}

.aadm-outline:hover {
    background: #eff6ff;
}

.aadm-section button:disabled {
    cursor: not-allowed;
    opacity: .55;
}

.aadm-section button:focus-visible,
.aadm-section input:focus-visible {
    outline: 3px solid #93bdff;
    outline-offset: 2px;
}

.aadm-form {
    margin-top: 20px;
    padding: 20px;
    background: #fbfcff;
    border: 1px solid #e0e8f4;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 9px;
}

.aadm-form h3 {
    font-size: 17px;
}

.aadm-form > p {
    margin-bottom: 8px;
}

.aadm-form > label:not(.aadm-check) {
    color: #344763;
    font-size: 12px;
    font-weight: 750;
    margin-top: 6px;
}

.aadm-form > input {
    width: 100%;
    max-width: 520px;
    min-width: 0;
    background: white;
    color: #172b4d;
    border: 1px solid #d5e1f0;
    border-radius: 9px;
    padding: 12px 13px;
    font-family: inherit;
    font-size: 14px;
}

.aadm-form small {
    color: #7788a0;
    font-size: 11px;
    line-height: 1.5;
}

.aadm-form .ws-password-checklist {
    max-width: 520px;
    margin-top: 4px;
}

.aadm-match {
    color: #087747 !important;
}

.aadm-mismatch {
    color: #be123c !important;
}

.aadm-check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #526782;
    margin: 6px 0;
}

.aadm-check input {
    width: 16px;
    height: 16px;
}

.aadm-form-actions {
    margin-top: 10px;
}

.aadm-list-heading {
    margin-top: 22px;
    border-top: 1px solid #edf1f7;
    padding: 20px 0 13px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.aadm-list-heading strong {
    color: #142b4d;
    font-size: 14px;
}

.aadm-list-heading span {
    background: #eaf2ff;
    color: #0759dc;
    font-weight: 750;
    font-size: 11px;
    border-radius: 99px;
    padding: 7px 11px;
}

.aadm-list {
    display: grid;
    gap: 10px;
}

.aadm-row {
    border: 1px solid #edf1f7;
    border-radius: 11px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.aadm-person {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
}

.aadm-avatar {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: #e8f1ff;
    color: #0759dc;
    font-weight: 800;
}

.aadm-person strong {
    color: #203855;
    display: block;
    font-size: 12px;
    overflow-wrap: anywhere;
}

.aadm-person small {
    display: block;
    color: #8b9aaf;
    font-size: 11px;
    margin-top: 4px;
}

.aadm-badge-active,
.aadm-badge-disabled {
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 800;
    border-radius: 99px;
    white-space: nowrap;
}

.aadm-badge-active {
    background: #e7f8ef;
    color: #087747;
}

.aadm-badge-disabled {
    background: #fff1f2;
    color: #be123c;
}

.aadm-empty {
    text-align: center;
    color: #718096;
    font-size: 12px;
    padding: 25px;
    border: 1px dashed #d5e1f0;
    border-radius: 11px;
}

.aadm-note {
    font-size: 11px;
    color: #718096;
    line-height: 1.6;
    margin: 17px 0 0;
}

.aadm-error,
.aadm-success {
    margin-top: 13px;
    padding: 12px 14px;
    border-radius: 9px;
    font-size: 12px;
    line-height: 1.6;
}

.aadm-error {
    color: #9f1239;
    background: #fff1f2;
    border: 1px solid #fecdd3;
}

.aadm-error button {
    background: white;
    border: 1px solid #fda4af;
    color: #9f1239;
    border-radius: 7px;
    margin-left: 12px;
    padding: 4px 9px;
    cursor: pointer;
}

.aadm-success {
    color: #087747;
    background: #e7f8ef;
    border: 1px solid #b7e7cc;
}

/* ==========================================
   MOBILE
========================================== */

@media (max-width: 740px) {

    .aadm-section {
        padding: 16px;
    }

    .aadm-heading {
        flex-direction: column;
    }

    .aadm-heading-actions {
        width: 100%;
    }

    .aadm-heading-actions button {
        flex: 1;
    }

    .aadm-form {
        padding: 15px;
    }

    .aadm-form > input {
        font-size: 16px;
    }

    .aadm-form-actions button {
        flex: 1;
    }

}

`;
