
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PasswordChecklist, {
    isStrongPassword
} from './PasswordChecklist';

const API_URL = `http://${window.location.hostname}:5000`;

// ======================================================
// SEND REQUEST TO EXISTING PASSWORD RESET BACKEND
// ======================================================

async function postReset(path, body) {
    const response = await fetch(
        `${API_URL}/api/forgot-password/${path}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }
    );

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(
            data.message ||
            'Something went wrong. Please try again.'
        );
    }

    return data;
}

// ======================================================
// FORGOT PASSWORD PAGE
// ======================================================

export default function ForgotPassword() {
    const navigate = useNavigate();

    const [step, setStep] = useState('email');

    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [resetToken, setResetToken] = useState('');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showPassword, setShowPassword] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    // ==================================================
    // 60-SECOND RESEND COOLDOWN
    // ==================================================

    useEffect(() => {
        if (cooldown <= 0) return undefined;

        const timer = window.setTimeout(() => {
            setCooldown(previous =>
                Math.max(0, previous - 1)
            );
        }, 1000);

        return () => window.clearTimeout(timer);
    }, [cooldown]);

    function clearMessages() {
        setError('');
        setNotice('');
    }

    // ==================================================
    // STEP 1 - REQUEST EMAIL OTP
    // ==================================================

    async function requestOtp(event) {
        event?.preventDefault();

        if (loading) return;

        clearMessages();
        setLoading(true);

        try {
            const cleanEmail = email.trim().toLowerCase();

            const data = await postReset(
                'request-otp',
                { email: cleanEmail }
            );

            setEmail(cleanEmail);
            setOtp('');
            setResetToken('');
            setCooldown(60);

            setStep('otp');
            setNotice(data.message);

        } catch (err) {
            setError(
                err.message || 'Unable to request code.'
            );
        } finally {
            setLoading(false);
        }
    }

    // ==================================================
    // RESEND EMAIL OTP
    // ==================================================

    async function resendOtp() {
        if (loading || cooldown > 0) return;

        clearMessages();
        setLoading(true);

        try {
            const data = await postReset(
                'request-otp',
                { email }
            );

            setOtp('');
            setCooldown(60);
            setNotice(data.message);

        } catch (err) {
            setError(
                err.message || 'Unable to resend code.'
            );
        } finally {
            setLoading(false);
        }
    }

    // ==================================================
    // STEP 2 - VERIFY OTP
    // ==================================================

    async function verifyOtp(event) {
        event.preventDefault();

        if (loading) return;

        clearMessages();

        if (!/^\d{6}$/.test(otp)) {
            setError(
                'Enter the six-digit code from your email.'
            );
            return;
        }

        setLoading(true);

        try {
            const data = await postReset(
                'verify-otp',
                { email, otp }
            );

            if (!data.resetToken) {
                throw new Error(
                    'Reset authorization was not issued.'
                );
            }

            // Keep the temporary token in React state.
            // Never store it in localStorage.
            setResetToken(data.resetToken);

            setOtp('');
            setNewPassword('');
            setConfirmPassword('');

            setStep('password');
            setNotice(
                'Code verified. Please choose a new password.'
            );

        } catch (err) {
            setError(
                err.message || 'Could not verify code.'
            );
        } finally {
            setLoading(false);
        }
    }

    // ==================================================
    // STEP 3 - RESET PASSWORD
    // ==================================================

    async function resetPassword(event) {
        event.preventDefault();

        if (loading) return;

        clearMessages();

        if (!isStrongPassword(newPassword)) {
            setError(
                'Please meet all password requirements below.'
            );
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);

        try {
            await postReset('reset-password', {
                email,
                resetToken,
                newPassword,
                confirmPassword
            });

            setResetToken('');
            setNewPassword('');
            setConfirmPassword('');

            setStep('success');
            setNotice(
                'Your password has been reset successfully.'
            );

        } catch (err) {
            setError(
                err.message || 'Unable to reset password.'
            );
        } finally {
            setLoading(false);
        }
    }

    // ==================================================
    // START AGAIN
    // ==================================================

    function backToEmail() {
        if (loading) return;

        clearMessages();

        setOtp('');
        setResetToken('');
        setNewPassword('');
        setConfirmPassword('');

        setStep('email');
    }

    const stepIndex = {
        email: 1,
        otp: 2,
        password: 3,
        success: 4
    }[step];

    // ==================================================
    // PAGE INTERFACE
    // ==================================================

    return (
        <main className="wsfp-page">
            <style>{forgotCss}</style>

            <section
                className="wsfp-card"
                aria-label="Password recovery"
            >
                {/* BRAND */}

                <header className="wsfp-brand">
                    <div
                        className="wsfp-logo"
                        aria-hidden="true"
                    >
                        ♥
                    </div>

                    <h1>WellSmartBook</h1>
                    <p>Your Health Companion</p>
                </header>

                {/* PROGRESS INDICATOR */}

                <div
                    className="wsfp-progress"
                    aria-label={`Step ${stepIndex} of 4`}
                >
                    {[
                        'Email',
                        'OTP',
                        'Password',
                        'Done'
                    ].map((label, index) => (
                        <div
                            key={label}
                            className={
                                `wsfp-progress-item ${
                                    stepIndex >= index + 1
                                        ? 'active'
                                        : ''
                                }`
                            }
                        >
                            <span>{index + 1}</span>
                            <small>{label}</small>
                        </div>
                    ))}
                </div>

                {/* HEADING */}

                <div className="wsfp-heading">
                    <h2>
                        {step === 'email'
                            ? 'Forgot Password?'
                            : step === 'otp'
                            ? 'Verify Your Email'
                            : step === 'password'
                            ? 'Set New Password'
                            : 'Password Updated!'}
                    </h2>

                    <p>
                        {step === 'email'
                            ? 'Enter your registered user or coach email address.'
                            : step === 'otp'
                            ? `Enter the six-digit code sent to ${email}. The code expires after 10 minutes.`
                            : step === 'password'
                            ? 'Create a strong new password for your WellSmartBook account.'
                            : 'You can now sign in using your new password.'}
                    </p>
                </div>

                {/* ERROR AND SUCCESS MESSAGES */}

                {error && (
                    <div
                        className="wsfp-alert wsfp-error"
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                {notice && (
                    <div
                        className="wsfp-alert wsfp-notice"
                        role="status"
                    >
                        {notice}
                    </div>
                )}

                {/* ====================================
                    STEP 1: EMAIL
                ==================================== */}

                {step === 'email' && (
                    <form
                        className="wsfp-form"
                        onSubmit={requestOtp}
                    >
                        <label htmlFor="wsfp-email">
                            Email Address
                        </label>

                        <input
                            id="wsfp-email"
                            type="email"
                            autoComplete="email"
                            placeholder="Enter your registered email"
                            required
                            maxLength={100}
                            value={email}
                            onChange={e =>
                                setEmail(e.target.value)
                            }
                            disabled={loading}
                        />

                        <button
                            className="wsfp-primary"
                            type="submit"
                            disabled={loading}
                        >
                            {loading
                                ? 'Sending...'
                                : 'Send Verification Code'}
                        </button>
                    </form>
                )}

                {/* ====================================
                    STEP 2: OTP VERIFICATION
                ==================================== */}

                {step === 'otp' && (
                    <form
                        className="wsfp-form"
                        onSubmit={verifyOtp}
                    >
                        <label htmlFor="wsfp-otp">
                            Six-Digit Verification Code
                        </label>

                        <input
                            id="wsfp-otp"
                            className="wsfp-otp"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="000000"
                            maxLength={6}
                            required
                            value={otp}
                            onChange={e =>
                                setOtp(
                                    e.target.value
                                        .replace(/\D/g, '')
                                        .slice(0, 6)
                                )
                            }
                            disabled={loading}
                        />

                        <button
                            className="wsfp-primary"
                            type="submit"
                            disabled={
                                loading || otp.length !== 6
                            }
                        >
                            {loading
                                ? 'Verifying...'
                                : 'Verify OTP'}
                        </button>

                        <button
                            className="wsfp-secondary"
                            type="button"
                            onClick={resendOtp}
                            disabled={
                                loading || cooldown > 0
                            }
                        >
                            {cooldown > 0
                                ? `Resend Code in ${cooldown}s`
                                : 'Resend Code'}
                        </button>

                        <button
                            className="wsfp-link"
                            type="button"
                            onClick={backToEmail}
                            disabled={loading}
                        >
                            Change email address
                        </button>
                    </form>
                )}

                {/* ====================================
                    STEP 3: NEW PASSWORD
                ==================================== */}

                {step === 'password' && (
                    <form
                        className="wsfp-form"
                        onSubmit={resetPassword}
                    >
                        <label htmlFor="wsfp-new">
                            New Password
                        </label>

                        <div className="wsfp-password-wrap">
                            <input
                                id="wsfp-new"
                                type={
                                    showPassword
                                        ? 'text'
                                        : 'password'
                                }
                                autoComplete="new-password"
                                required
                                minLength={12}
                                placeholder="Enter a strong new password"
                                value={newPassword}
                                onChange={e =>
                                    setNewPassword(e.target.value)
                                }
                                disabled={loading}
                            />

                            <button
                                type="button"
                                onClick={() =>
                                    setShowPassword(value => !value)
                                }
                                aria-label={
                                    showPassword
                                        ? 'Hide password'
                                        : 'Show password'
                                }
                            >
                                {showPassword
                                    ? 'Hide'
                                    : 'Show'}
                            </button>
                        </div>

                        {/* EXISTING PASSWORD POLICY */}

                        <PasswordChecklist
                            password={newPassword}
                        />

                        <label htmlFor="wsfp-confirm">
                            Confirm New Password
                        </label>

                        <input
                            id="wsfp-confirm"
                            type={
                                showPassword
                                    ? 'text'
                                    : 'password'
                            }
                            autoComplete="new-password"
                            required
                            placeholder="Re-enter your new password"
                            value={confirmPassword}
                            onChange={e =>
                                setConfirmPassword(e.target.value)
                            }
                            disabled={loading}
                        />

                        <button
                            className="wsfp-primary"
                            type="submit"
                            disabled={
                                loading ||
                                !isStrongPassword(newPassword) ||
                                newPassword !== confirmPassword
                            }
                        >
                            {loading
                                ? 'Updating...'
                                : 'Reset Password'}
                        </button>

                        <button
                            className="wsfp-link"
                            type="button"
                            onClick={backToEmail}
                            disabled={loading}
                        >
                            Start again with a new code
                        </button>
                    </form>
                )}

                {/* ====================================
                    STEP 4: SUCCESS
                ==================================== */}

                {step === 'success' && (
                    <div className="wsfp-success">
                        <div
                            className="wsfp-check"
                            aria-hidden="true"
                        >
                            ✓
                        </div>

                        <p>
                            Your password has been changed.
                            Return to login to access your account.
                        </p>

                        <button
                            className="wsfp-primary"
                            type="button"
                            onClick={() =>
                                navigate('/login')
                            }
                        >
                            Return to Login
                        </button>
                    </div>
                )}

                {/* BACK BUTTON */}

                {step !== 'success' && (
                    <button
                        className="wsfp-back"
                        type="button"
                        onClick={() =>
                            navigate('/login')
                        }
                        disabled={loading}
                    >
                        ← Back to Login
                    </button>
                )}
            </section>
        </main>
    );
}

// ======================================================
// RESPONSIVE CSS
// ======================================================

const forgotCss = `
.wsfp-page {
    width: 100%;
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    background: #f5f8fd;
    font-family: Inter, "Segoe UI", Arial, sans-serif;
    color: #172b4d;
}

.wsfp-page * {
    box-sizing: border-box;
}

.wsfp-card {
    width: 100%;
    max-width: 480px;
    background: #fff;
    border: 1px solid #e5eaf3;
    border-radius: 20px;
    padding: 32px;
    box-shadow: 0 12px 40px rgba(29, 59, 104, .06);
}

.wsfp-brand {
    text-align: center;
    margin-bottom: 24px;
}

.wsfp-logo {
    width: 55px;
    height: 55px;
    margin: 0 auto 12px;
    border-radius: 15px;
    display: grid;
    place-items: center;
    background: #0759df;
    color: #fff;
    font-size: 27px;
}

.wsfp-brand h1 {
    font-size: 25px;
    font-weight: 800;
    color: #0759df;
    margin: 0;
}

.wsfp-brand p {
    font-size: 13px;
    color: #718096;
    margin: 7px 0 0;
}

.wsfp-progress {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin: 0 0 28px;
}

.wsfp-progress-item {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    color: #94a3b8;
}

.wsfp-progress-item span {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: #edf2fa;
    font-size: 12px;
    font-weight: 800;
}

.wsfp-progress-item small {
    font-size: 11px;
}

.wsfp-progress-item.active {
    color: #0759df;
}

.wsfp-progress-item.active span {
    background: #0759df;
    color: #fff;
}

.wsfp-heading {
    text-align: center;
    margin-bottom: 22px;
}


.wsfp-heading h2 {
    font-size: 23px;
    margin: 0 0 8px;
    color: #172b4d !important;
}


.wsfp-heading p {
    font-size: 13px;
    line-height: 1.65;
    margin: 0;
    color: #718096;
    overflow-wrap: anywhere;
}

.wsfp-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.wsfp-form label {
    font-size: 13px;
    font-weight: 700;
    color: #233b58;
}

.wsfp-form input {
    width: 100%;
    min-width: 0;
    padding: 14px 15px;
    border: 1px solid #dce5f2;
    border-radius: 9px;
    background: #f7f9fd;
    color: #172b4d;
    font-size: 14px;
    outline: none;
    font-family: inherit;
}

.wsfp-form input:focus {
    background: #fff;
    border-color: #0759df;
    box-shadow: 0 0 0 3px rgba(7, 89, 223, .1);
}

.wsfp-form input::placeholder {
    color: #94a3b8;
}

.wsfp-form .wsfp-otp {
    text-align: center;
    letter-spacing: 8px;
    font-size: 24px;
    font-weight: 750;
}

.wsfp-password-wrap {
    position: relative;
}

.wsfp-password-wrap input {
    padding-right: 66px;
}

.wsfp-password-wrap button {
    position: absolute;
    top: 50%;
    right: 11px;
    transform: translateY(-50%);
    border: 0;
    background: none;
    color: #0759df;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
}

.wsfp-primary,
.wsfp-secondary {
    display: block;
    width: 100%;
    padding: 14px;
    border-radius: 9px;
    font-size: 14px;
    font-weight: 750;
    font-family: inherit;
    cursor: pointer;
}

.wsfp-primary {
    background: #0759df;
    border: 1px solid #0759df;
    color: #fff;
    margin-top: 6px;
}

.wsfp-primary:hover {
    background: #0048bc;
}

.wsfp-secondary {
    background: #fff;
    border: 1px solid #d7e2f0;
    color: #315071;
}

.wsfp-page button:disabled {
    opacity: .55;
    cursor: not-allowed;
}

.wsfp-link,
.wsfp-back {
    border: 0;
    background: none;
    color: #0759df;
    font-size: 13px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    padding: 8px;
}

.wsfp-back {
    display: block;
    margin: 18px auto 0;
}

.wsfp-alert {
    padding: 12px 14px;
    margin: 0 0 18px;
    border-radius: 9px;
    font-size: 12px;
    line-height: 1.6;
    overflow-wrap: anywhere;
}

.wsfp-error {
    color: #ae192b;
    background: #fff1f2;
    border: 1px solid #fecdd3;
}

.wsfp-notice {
    color: #155e4a;
    background: #e9f9f0;
    border: 1px solid #bbebcd;
}

.wsfp-success {
    text-align: center;
}

.wsfp-success p {
    color: #64748b;
    font-size: 13px;
    line-height: 1.6;
}

.wsfp-check {
    margin: 0 auto 12px;
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: #e5faef;
    color: #168454;
    font-size: 31px;
    font-weight: 700;
}

@media (max-width: 520px) {
    .wsfp-page {
        align-items: flex-start;
        padding: 18px 12px;
    }

    .wsfp-card {
        padding: 23px 18px;
        border-radius: 16px;
    }

    .wsfp-brand h1 {
        font-size: 23px;
    }

    .wsfp-heading h2 {
        font-size: 21px;
    }

    .wsfp-form input {
        font-size: 16px;
    }
}
`;
