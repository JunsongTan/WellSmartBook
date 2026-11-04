
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ======================================================
// WELLSMARTBOOK SHARED LOGIN
//
// USER  -> EMAIL + PASSWORD
// COACH -> EMAIL + PASSWORD
// ADMIN -> USERNAME + PASSWORD
// ======================================================

const API_URL =
    `http://${window.location.hostname}:5000`;

export default function Login() {

    const navigate = useNavigate();

    // ==================================================
    // LOGIN STATES
    // ==================================================

    const [credentials, setCredentials] = useState({
        login: '',
        password: ''
    });

    const [showPassword, setShowPassword] =
        useState(false);

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState('');

    const [success, setSuccess] =
        useState('');

    // ==================================================
    // ADMIN FIRST-TIME PASSWORD CHANGE STATES
    // ==================================================

    const [needsAdminChange, setNeedsAdminChange] =
        useState(false);

    const [adminUsername, setAdminUsername] =
        useState('');

    const [passwordForm, setPasswordForm] =
        useState({
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        });

    const [showNewPassword, setShowNewPassword] =
        useState(false);

    // ==================================================
    // UPDATE LOGIN INPUTS
    // ==================================================

    function handleChange(event) {

        const { name, value } = event.target;

        setCredentials(previous => ({
            ...previous,
            [name]: value
        }));

        setError('');
        setSuccess('');
    }

    // ==================================================
    // UPDATE ADMIN PASSWORD INPUTS
    // ==================================================

    function handlePasswordChange(event) {

        const { name, value } = event.target;

        setPasswordForm(previous => ({
            ...previous,
            [name]: value
        }));

        setError('');
    }

    // ==================================================
    // HANDLE SHARED LOGIN
    // ==================================================

    async function handleSubmit(event) {

        event.preventDefault();

        if (loading) return;

        setError('');
        setSuccess('');
        setLoading(true);

        try {

            const response = await fetch(
                `${API_URL}/api/login`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json'
                    },

                    body: JSON.stringify({
                        login: credentials.login.trim(),
                        password: credentials.password
                    })
                }
            );

            const data = await response.json();

            // ==========================================
            // CHECK LOGIN RESULT
            // ==========================================

            if (!response.ok || !data.success) {

                throw new Error(
                    data.message ||
                    'Invalid login credentials.'
                );
            }

            // ==========================================
            // FIRST-TIME ADMIN LOGIN
            //
            // NO FULL ADMIN TOKEN YET
            // ==========================================

            if (
                data.user?.role === 'admin' &&
                data.requiresPasswordChange
            ) {

                // Clear any previous login session.

                localStorage.removeItem('token');
                localStorage.removeItem('user');

                setAdminUsername(
                    data.user.username ||
                    credentials.login.trim()
                );

                setNeedsAdminChange(true);

                setPasswordForm({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                });

                setCredentials(previous => ({
                    ...previous,
                    password: ''
                }));

                setError('');

                return;
            }

            // ==========================================
            // VALIDATE SUCCESSFUL LOGIN
            // ==========================================

            if (!data.token || !data.user?.role) {

                throw new Error(
                    'Login response is incomplete.'
                );
            }

            const role = data.user.role;

            if (
                !['user', 'coach', 'admin'].includes(role)
            ) {

                throw new Error(
                    'Unsupported account role.'
                );
            }

            // ==========================================
            // STORE LOGIN SESSION
            // ==========================================

            localStorage.setItem(
                'token',
                data.token
            );

            localStorage.setItem(
                'user',
                JSON.stringify(data.user)
            );

            // ==========================================
            // REDIRECT BASED ON ACCOUNT ROLE
            // ==========================================

            if (role === 'admin') {

                navigate(
                    '/admin/dashboard',
                    { replace: true }
                );

            } else if (role === 'coach') {

                navigate(
                    '/coach/dashboard',
                    { replace: true }
                );

            } else {

                navigate(
                    '/dashboard',
                    { replace: true }
                );
            }

        } catch (err) {

            setError(
                err.message ||
                'Server error. Please try again.'
            );

        } finally {

            setLoading(false);
        }
    }

    // ==================================================
    // ACTIVATE ADMIN PASSWORD
    // ==================================================

    async function activateAdminPassword(event) {

        event.preventDefault();

        if (loading) return;

        setError('');
        setSuccess('');

        const {
            currentPassword,
            newPassword,
            confirmPassword
        } = passwordForm;

        // ==============================================
        // VALIDATE NEW PASSWORD
        // ==============================================

        if (newPassword !== confirmPassword) {

            setError(
                'New passwords do not match.'
            );

            return;
        }

        const strongPassword =
            newPassword.length >= 12 &&
            /[a-z]/.test(newPassword) &&
            /[A-Z]/.test(newPassword) &&
            /[0-9]/.test(newPassword) &&
            /[^a-zA-Z0-9]/.test(newPassword);

        if (!strongPassword) {

            setError(
                'Use at least 12 characters with uppercase, lowercase, number and symbol.'
            );

            return;
        }

        setLoading(true);

        try {

            const response = await fetch(
                `${API_URL}/api/admin/activate-password`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json'
                    },

                    body: JSON.stringify({
                        username: adminUsername,
                        currentPassword,
                        newPassword
                    })
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {

                throw new Error(
                    data.message ||
                    'Unable to change administrator password.'
                );
            }

            // ==========================================
            // PASSWORD CHANGED SUCCESSFULLY
            // ==========================================

            setNeedsAdminChange(false);

            setPasswordForm({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });

            setCredentials({
                login: adminUsername,
                password: ''
            });

            setSuccess(
                'Administrator password updated successfully. Log in again using your new password.'
            );

        } catch (err) {

            setError(
                err.message ||
                'Unable to update administrator password.'
            );

        } finally {

            setLoading(false);
        }
    }

    // ==================================================
    // BACK TO LOGIN
    // ==================================================

    function backToLogin() {

        if (loading) return;

        setNeedsAdminChange(false);

        setPasswordForm({
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
        });

        setCredentials(previous => ({
            ...previous,
            password: ''
        }));

        setError('');
        setSuccess('');
    }

    // ==================================================
    // RENDER
    // ==================================================

    return (

        <main className="wsl-page">

            <style>{loginCss}</style>

            <div className="wsl-card">

                {/* ======================================
                    WELL SMART BOOK LOGO
                ====================================== */}

                <div className="wsl-brand">

                    <div className="wsl-logo">
                        ♥
                    </div>

                    <h1>
                        WellSmartBook
                    </h1>

                    <p>
                        Your Health Companion
                    </p>

                </div>

                {/* ======================================
                    STANDARD LOGIN FORM
                ====================================== */}

                {!needsAdminChange ? (

                    <>

                        <div className="wsl-heading">

                            <h2>Welcome Back</h2>

                            <p>
                                Sign in to your WellSmartBook account
                            </p>

                        </div>

                        {error && (

                            <div
                                className="wsl-alert wsl-error"
                                role="alert"
                            >
                                {error}
                            </div>

                        )}

                        {success && (

                            <div
                                className="wsl-alert wsl-success"
                                role="status"
                            >
                                {success}
                            </div>

                        )}

                        <form
                            onSubmit={handleSubmit}
                            className="wsl-form"
                        >

                            {/* EMAIL OR ADMIN USERNAME */}

                            <div className="wsl-field">

                                <label htmlFor="wsl-login">
                                    Email
                                </label>

                                <input
                                    id="wsl-login"
                                    type="text"
                                    name="login"
                                    autoComplete="username"
                                    placeholder="Email "
                                    required
                                    maxLength={190}
                                    value={credentials.login}
                                    onChange={handleChange}
                                    disabled={loading}
                                />


                            </div>

                            {/* PASSWORD */}

                            <div className="wsl-field">

                                <label htmlFor="wsl-password">
                                    Password
                                </label>

                                <div className="wsl-password-wrap">

                                    <input
                                        id="wsl-password"
                                        type={
                                            showPassword
                                                ? 'text'
                                                : 'password'
                                        }
                                        name="password"
                                        autoComplete="current-password"
                                        placeholder="Enter your password"
                                        required
                                        value={credentials.password}
                                        onChange={handleChange}
                                        disabled={loading}
                                    />

                                    <button
                                        type="button"
                                        className="wsl-show-password"
                                        onClick={() =>
                                            setShowPassword(
                                                previous => !previous
                                            )
                                        }
                                        aria-label={
                                            showPassword
                                                ? 'Hide password'
                                                : 'Show password'
                                        }
                                    >
                                        {showPassword ? 'Hide' : 'Show'}
                                    </button>

                                </div>

                            </div>
                            
                            {/* ==========================================
                                FORGOT PASSWORD - USERS AND COACHES
                            ========================================== */}

                            <button
                                type="button"
                                className="wsl-forgot-password"
                                onClick={() => navigate('/forgot-password')}
                                disabled={loading}
                            >
                                Forgot Password?
                            </button>


                            {/* LOGIN BUTTON */}

                            <button
                                type="submit"
                                className="wsl-primary"
                                disabled={loading}
                            >
                                {loading
                                    ? 'Signing In...'
                                    : 'Log In'}
                            </button>

                        </form>

                        <div className="wsl-footer">

                            <div className="wsl-divider" />

                            <p>
                                Don't have an account?{' '}

                                <button
                                    type="button"
                                    className="wsl-text-button"
                                    onClick={() =>
                                        navigate('/register')
                                    }
                                >
                                    Sign up now!
                                </button>
                            </p>

                        </div>

                    </>

                ) : (

                    /* ======================================
                        FIRST-TIME ADMIN PASSWORD FORM
                    ====================================== */

                    <>

                        <div className="wsl-heading">

                            <div className="wsl-security-icon">
                                <span aria-hidden="true">🔒</span>
                            </div>

                            <h2>
                                Set Administrator Password
                            </h2>

                            <p>
                                You're signing in as{' '}
                                <strong>{adminUsername}</strong>.
                                Change the temporary password
                                before accessing the Admin Portal.
                            </p>

                        </div>

                        {error && (

                            <div
                                className="wsl-alert wsl-error"
                                role="alert"
                            >
                                {error}
                            </div>

                        )}

                        <form
                            onSubmit={activateAdminPassword}
                            className="wsl-form"
                        >

                            {/* CURRENT PASSWORD */}

                            <div className="wsl-field">

                                <label htmlFor="wsl-current">
                                    Current Password
                                </label>

                                <input
                                    id="wsl-current"
                                    type="password"
                                    name="currentPassword"
                                    autoComplete="current-password"
                                    placeholder="Enter temporary password"
                                    required
                                    value={
                                        passwordForm.currentPassword
                                    }
                                    onChange={handlePasswordChange}
                                    disabled={loading}
                                />

                            </div>

                            {/* NEW PASSWORD */}

                            <div className="wsl-field">

                                <label htmlFor="wsl-new">
                                    New Password
                                </label>

                                <div className="wsl-password-wrap">

                                    <input
                                        id="wsl-new"
                                        type={
                                            showNewPassword
                                                ? 'text'
                                                : 'password'
                                        }
                                        name="newPassword"
                                        autoComplete="new-password"
                                        placeholder="Enter a strong password"
                                        required
                                        minLength={12}
                                        value={
                                            passwordForm.newPassword
                                        }
                                        onChange={handlePasswordChange}
                                        disabled={loading}
                                    />

                                    <button
                                        type="button"
                                        className="wsl-show-password"
                                        onClick={() =>
                                            setShowNewPassword(
                                                previous => !previous
                                            )
                                        }
                                    >
                                        {showNewPassword
                                            ? 'Hide'
                                            : 'Show'}
                                    </button>

                                </div>

                                <small>
                                    Minimum 12 characters, including
                                    uppercase, lowercase, number
                                    and symbol.
                                </small>

                            </div>

                            {/* CONFIRM PASSWORD */}

                            <div className="wsl-field">

                                <label htmlFor="wsl-confirm">
                                    Confirm New Password
                                </label>

                                <input
                                    id="wsl-confirm"
                                    type={
                                        showNewPassword
                                            ? 'text'
                                            : 'password'
                                    }
                                    name="confirmPassword"
                                    autoComplete="new-password"
                                    placeholder="Confirm new password"
                                    required
                                    value={
                                        passwordForm.confirmPassword
                                    }
                                    onChange={handlePasswordChange}
                                    disabled={loading}
                                />

                            </div>

                            {/* UPDATE BUTTON */}

                            <button
                                type="submit"
                                className="wsl-primary"
                                disabled={loading}
                            >
                                {loading
                                    ? 'Updating Password...'
                                    : 'Change Password'}
                            </button>

                            {/* BACK BUTTON */}

                            <button
                                type="button"
                                className="wsl-secondary"
                                onClick={backToLogin}
                                disabled={loading}
                            >
                                ← Back to Login
                            </button>

                        </form>

                    </>

                )}

            </div>

            {/* PAGE FOOTER */}

            <div className="wsl-page-footer">
                WellSmartBook Fitness Management System
            </div>

        </main>
    );
}

// ======================================================
// CSS INSIDE LOGIN.JSX
// ======================================================

const loginCss = `

.wsl-page {
    min-height: 100vh;
    min-height: 100dvh;
    width: 100%;

    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    padding: 24px 16px;

    background: #f5f8fd;

    font-family:
        Inter,
        "Segoe UI",
        Arial,
        sans-serif;

    color: #1e293b;
}

.wsl-page * {
    box-sizing: border-box;
}

/* ==========================================
   LOGIN CARD
========================================== */

.wsl-card {
    width: 100%;
    max-width: 445px;

    padding: 35px;

    background: white;

    border: 1px solid #e5eaf3;
    border-radius: 20px;

    box-shadow:
        0 12px 40px rgba(29, 59, 104, .06);
}

/* ==========================================
   BRAND
========================================== */

.wsl-brand {
    display: flex;
    flex-direction: column;
    align-items: center;

    margin-bottom: 30px;
    text-align: center;
}

.wsl-logo {
    width: 55px;
    height: 55px;

    display: flex;
    align-items: center;
    justify-content: center;

    margin-bottom: 13px;

    background: #0759df;
    color: white;

    border-radius: 15px;

    font-size: 27px;
}

.wsl-brand h1 {
    margin: 0;
    color: #0759df;
    font-size: 25px;
    font-weight: 800;
}

.wsl-brand p {
    margin: 8px 0 0;
    color: #718096;
    font-size: 13px;
}

/* ==========================================
   LOGIN HEADING
========================================== */

.wsl-heading {
    text-align: center;
    margin-bottom: 25px;
}

.wsl-heading h2 {
    margin: 0 0 9px;
    color: #172b4d;
    font-size: 22px;
}

.wsl-heading p {
    margin: 0;
    color: #718096;
    font-size: 13px;
    line-height: 1.7;
}

.wsl-heading strong {
    color: #0759df;
}

/* ==========================================
   FORM
========================================== */

.wsl-form {
    display: flex;
    flex-direction: column;
    gap: 19px;
}

.wsl-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.wsl-field label {
    color: #233b58;
    font-size: 13px;
    font-weight: 700;
}

.wsl-field input {
    width: 100%;
    min-width: 0;

    padding: 14px 15px;

    border: 1px solid #dce5f2;
    border-radius: 9px;

    outline: none;

    background: #f7f9fd;
    color: #172b4d;

    font-family: inherit;
    font-size: 14px;
}

.wsl-field input:focus {
    background: white;
    border-color: #0759df;

    box-shadow:
        0 0 0 3px rgba(7, 89, 223, .10);
}

.wsl-field input::placeholder {
    color: #94a3b8;
}

.wsl-field small {
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.6;
}

/* ==========================================
   PASSWORD VISIBILITY
========================================== */

.wsl-password-wrap {
    position: relative;
}

.wsl-password-wrap input {
    padding-right: 76px;
}

.wsl-show-password {
    position: absolute;
    top: 50%;
    right: 12px;

    transform: translateY(-50%);

    border: 0;
    background: transparent;

    color: #0759df;

    font-family: inherit;
    font-size: 12px;
    font-weight: 700;

    cursor: pointer;
}

/* ==========================================
   BUTTONS
========================================== */

.wsl-primary {
    width: 100%;

    padding: 15px;

    border: 1px solid #0759df;
    border-radius: 9px;

    background: #0759df;
    color: white;

    font-family: inherit;
    font-size: 14px;
    font-weight: 750;

    cursor: pointer;
}

.wsl-primary:hover {
    background: #0048bc;
}

.wsl-secondary {
    width: 100%;

    padding: 13px;

    background: white;
    color: #315071;

    border: 1px solid #d7e2f0;
    border-radius: 9px;

    font-family: inherit;
    font-size: 13px;
    font-weight: 700;

    cursor: pointer;
}

.wsl-secondary:hover {
    background: #f1f6ff;
}

.wsl-page button:disabled {
    opacity: .6;
    cursor: not-allowed;
}


/* ==========================================
   FORGOT PASSWORD BUTTON
========================================== */

.wsl-forgot-password {
    align-self: flex-end;

    margin-top: -9px;
    margin-bottom: -5px;

    padding: 4px 0;

    border: none;
    background: transparent;

    color: #0759df;

    font-family: inherit;
    font-size: 13px;
    font-weight: 700;

    cursor: pointer;
}

.wsl-forgot-password:hover {
    text-decoration: underline;
}

.wsl-forgot-password:focus-visible {
    outline: 3px solid #83b4fa;
    outline-offset: 3px;
    border-radius: 3px;
}


/* ==========================================
   FOOTER
========================================== */

.wsl-footer {
    text-align: center;
    margin-top: 24px;
}

.wsl-divider {
    height: 1px;
    background: #e5eaf3;
    margin-bottom: 19px;
}

.wsl-footer p {
    margin: 0;
    color: #718096;
    font-size: 13px;
}

.wsl-text-button {
    padding: 0;
    background: transparent;

    border: none;

    color: #0759df;
    font-size: 13px;
    font-weight: 750;

    cursor: pointer;
}

/* ==========================================
   ALERTS
========================================== */

.wsl-alert {
    padding: 13px;

    margin-bottom: 20px;

    border-radius: 9px;

    font-size: 12px;
    line-height: 1.6;

    text-align: center;
}

.wsl-error {
    background: #fff0f0;
    color: #b42318;
    border: 1px solid #f5c2c2;
}

.wsl-success {
    background: #e8f9ef;
    color: #087645;
    border: 1px solid #b8e9ce;
}

/* ==========================================
   PASSWORD CHANGE
========================================== */

.wsl-security-icon {
    width: 54px;
    height: 54px;

    margin: 0 auto 15px;

    display: flex;
    align-items: center;
    justify-content: center;

    border-radius: 50%;

    background: #eaf2ff;
    color: #0759df;

    font-size: 24px;
}

/* ==========================================
   PAGE FOOTER
========================================== */

.wsl-page-footer {
    margin-top: 22px;

    color: #94a3b8;
    font-size: 11px;

    text-align: center;
}

/* ==========================================
   ACCESSIBILITY
========================================== */

.wsl-page button:focus-visible {
    outline: 3px solid #83b4fa;
    outline-offset: 3px;
}

/* ==========================================
   MOBILE
========================================== */

@media (max-width: 600px) {

    .wsl-page {
        padding: 16px 12px;
    }

    .wsl-card {
        padding: 25px 19px;
        border-radius: 15px;
    }

    .wsl-brand h1 {
        font-size: 22px;
    }

    .wsl-heading h2 {
        font-size: 20px;
    }

    .wsl-field input {
        font-size: 16px;
    }

}

`;
