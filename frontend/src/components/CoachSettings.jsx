import { useCallback, useEffect, useRef, useState } from 'react';
import { isStrongPassword } from './PasswordChecklist';

// ======================================================
// WELLSMARTBOOK - COACH SETTINGS
// All CSS stays inside this JSX file.
// ======================================================

const API_BASE_URL = `http://${window.location.hostname}:5000`;

const SPECIALTY_OPTIONS = [
    'Weight Loss',
    'Strength Training',
    'Muscle Gain',
    'Yoga',
    'HIIT Training',
    'Nutrition',
    'Mental Health',
    'Meditation',
    'Post-Injury Recovery',
    'Flexibility',
    'Sports Conditioning',
    'Cardio Fitness'
];

const EMPTY_PROFILE = {
    displayName: '',
    biography: '',
    specialization: '',
    specialties: [],
    yearsExperience: '0',
    defaultSessionPrice: '0'
};

function resolveAvatar(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    // Always use the backend host the visitor is using.
    // Avoid localhost URLs breaking on a mobile phone.
    try {
        const url = new URL(raw, API_BASE_URL);
        if (!url.pathname.startsWith('/profile-images/')) return '';
        return `${API_BASE_URL}${url.pathname}`;
    } catch {
        return '';
    }
}

function initials(value) {
    return String(value || 'Coach')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(word => word.charAt(0).toUpperCase())
        .join('');
}

async function readJsonResponse(response) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false) {
        throw new Error(data.message || `Request failed (HTTP ${response.status}).`);
    }
    return data;
}

function authHeaders(extra = {}) {
    return {
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        ...extra
    };
}

export default function CoachSettings() {
    const fileInputRef = useRef(null);

    const [form, setForm] = useState({ ...EMPTY_PROFILE });
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [profilePicture, setProfilePicture] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [saveSuccess, setSaveSuccess] = useState('');

    const [photoFile, setPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState('');
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [photoError, setPhotoError] = useState('');
    const [photoSuccess, setPhotoSuccess] = useState('');

    const [passwords, setPasswords] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showPasswords, setShowPasswords] = useState(false);
    const [changingPassword, setChangingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');

    // ==================================================
    // LOAD SETTINGS FROM MYSQL
    // ==================================================

    const loadSettings = useCallback(async (signal) => {
        const response = await fetch(`${API_BASE_URL}/api/coach/settings`, {
            headers: authHeaders(),
            signal
        });
        return readJsonResponse(response);
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        async function start() {
            setLoading(true);
            setLoadError('');

            try {
                const data = await loadSettings(controller.signal);
                if (controller.signal.aborted) return;

                const coach = data.coach || {};
                setForm({
                    displayName: coach.displayName || '',
                    biography: coach.biography || '',
                    specialization: coach.specialization || '',
                    specialties: Array.isArray(coach.specialties)
                        ? coach.specialties
                        : [],
                    yearsExperience: String(coach.yearsExperience ?? 0),
                    defaultSessionPrice: String(coach.defaultSessionPrice ?? 0)
                });
                setEmail(coach.email || '');
                setPhone(coach.phone || '');
                setProfilePicture(coach.profilePicture || '');
            } catch (error) {
                if (error.name !== 'AbortError' && !controller.signal.aborted) {
                    setLoadError(error.message || 'Unable to load settings.');
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }

        start();
        return () => controller.abort();
    }, [loadSettings]);

    // ==================================================
    // PICTURE PREVIEW
    // ==================================================

    useEffect(() => {
        if (!photoFile) {
            setPhotoPreview('');
            return;
        }
        const url = URL.createObjectURL(photoFile);
        setPhotoPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [photoFile]);

    function updateField(field, value) {
        setForm(previous => ({ ...previous, [field]: value }));
        setSaveError('');
        setSaveSuccess('');
    }

    function toggleSpecialty(value) {
        const alreadySelected = form.specialties.includes(value);
        if (!alreadySelected && form.specialties.length >= 10) {
            setSaveError('You can choose up to 10 specialties.');
            return;
        }
        setForm(previous => ({
            ...previous,
            specialties: alreadySelected
                ? previous.specialties.filter(item => item !== value)
                : [...previous.specialties, value]
        }));
        setSaveError('');
        setSaveSuccess('');
    }

    // ==================================================
    // SAVE COACH PROFILE
    // ==================================================

    async function saveProfile(event) {
        event.preventDefault();
        if (saving) return;

        setSaveError('');
        setSaveSuccess('');

        if (form.displayName.trim().length < 2) {
            setSaveError('Enter a display name with at least 2 characters.');
            return;
        }
        if (form.specialization.trim().length < 2) {
            setSaveError('Enter your primary specialization.');
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/coach/settings`, {
                method: 'PATCH',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    displayName: form.displayName.trim(),
                    biography: form.biography.trim(),
                    specialization: form.specialization.trim(),
                    specialties: form.specialties,
                    yearsExperience: Number(form.yearsExperience),
                    defaultSessionPrice: Number(form.defaultSessionPrice)
                })
            });

            await readJsonResponse(response);
            setSaveSuccess('Your coach profile has been updated successfully.');

            // Keep any locally displayed coach name in sync.
            try {
                const stored = JSON.parse(localStorage.getItem('user') || 'null');
                if (stored && typeof stored === 'object') {
                    localStorage.setItem('user', JSON.stringify({
                        ...stored,
                        fullName: form.displayName.trim(),
                        full_name: form.displayName.trim()
                    }));
                }
            } catch {
                // A missing or invalid cached user must not undo a successful save.
            }
        } catch (error) {
            setSaveError(error.message || 'Unable to save your profile.');
        } finally {
            setSaving(false);
        }
    }

    // ==================================================
    // UPLOAD PROFILE PICTURE (EXISTING USER PROFILE API)
    // ==================================================

    function choosePhoto(event) {
        const file = event.target.files?.[0] || null;
        setPhotoError('');
        setPhotoSuccess('');

        if (!file) {
            setPhotoFile(null);
            return;
        }

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setPhotoError('Choose a JPG, PNG or WEBP image.');
            event.target.value = '';
            setPhotoFile(null);
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setPhotoError('Choose an image smaller than 5 MB.');
            event.target.value = '';
            setPhotoFile(null);
            return;
        }

        setPhotoFile(file);

        // Upload immediately after the coach chooses a valid picture.
        void uploadPhoto(file);
    }

    async function uploadPhoto(file) {
        if (!file || uploadingPhoto) return;
        setUploadingPhoto(true);
        setPhotoError('');
        setPhotoSuccess('');

        try {
            const payload = new FormData();
            payload.append('image', file);

            const response = await fetch(`${API_BASE_URL}/api/profile-picture`, {
                method: 'POST',
                headers: authHeaders(),
                body: payload
            });
            const result = await readJsonResponse(response);

            // Reload just the picture and preserve unsaved text edits.
            // If the follow-up GET fails, don't report the completed upload as failed.
            let newPicture = result.user?.profilePicture || '';
            if (!newPicture) {
                try {
                    const refreshed = await loadSettings();
                    newPicture = refreshed.coach?.profilePicture || '';
                } catch (refreshError) {
                    console.warn('Picture uploaded, but refresh failed:', refreshError);
                }
            }
            if (newPicture) setProfilePicture(newPicture);
            setPhotoSuccess('Profile picture updated successfully.');
            setPhotoFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            setPhotoError(error.message || 'Unable to upload profile picture.');
            // Restore the previous saved photo if uploading fails.
            setPhotoFile(null);
        } finally {
            setUploadingPhoto(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    // ==================================================
    // CHANGE PASSWORD (EXISTING SECURE PASSWORD API)
    // ==================================================

    async function changePassword(event) {
        event.preventDefault();
        if (changingPassword) return;

        setPasswordError('');
        setPasswordSuccess('');

        const { currentPassword, newPassword, confirmPassword } = passwords;
        if (!currentPassword || !newPassword || !confirmPassword) {
            setPasswordError('Please complete all password fields.');
            return;
        }

        // ======================================================
        // STRONG PASSWORD VALIDATION
        // ======================================================

        const strongPassword = isStrongPassword(newPassword);

        if (!strongPassword) {

            setPasswordError(
                'Password must contain at least 12 characters, ' +
                'including uppercase, lowercase, number and symbol.'
            );

            return;
        }

        if (newPassword !== confirmPassword) {
            setPasswordError('The new passwords do not match.');
            return;
        }
        if (newPassword === currentPassword) {
            setPasswordError('Choose a different password from your current password.');
            return;
        }

        setChangingPassword(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/profile/password`, {
                method: 'PATCH',
                headers: authHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ currentPassword, newPassword })
            });
            await readJsonResponse(response);
            setPasswords({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
            setPasswordSuccess('Password changed successfully. Use your new password next time you log in.');
        } catch (error) {
            setPasswordError(error.message || 'Unable to change password.');
        } finally {
            setChangingPassword(false);
        }
    }

    const avatarSrc = photoPreview || resolveAvatar(profilePicture);

    if (loading) {
        return (
            <div className="cset-page">
                <style>{css}</style>
                <div className="cset-loading">Loading Coach Settings...</div>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="cset-page">
                <style>{css}</style>
                <div className="cset-alert cset-error" role="alert">{loadError}</div>
                <button type="button" className="cset-primary" onClick={() => window.location.reload()}>
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <main className="cset-page">
            <style>{css}</style>

            <header className="cset-header">
                <span className="cset-eyebrow">COACH PORTAL</span>
                <h1>Profile Management</h1>
                <p>Update your public coach profile, training expertise and account security.</p>
            </header>

            <div className="cset-layout">
                {/* ======================================
                    LEFT: PROFILE PHOTO + ACCOUNT
                ====================================== */}
                <aside className="cset-side">
                    <section className="cset-card cset-identity">
                        {/* Click the profile picture to choose a replacement. */}
                        <button
                            type="button"
                            className="cset-avatar cset-avatar-button"
                            aria-label="Change profile picture"
                            title="Click to change profile picture"
                            disabled={uploadingPhoto}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {avatarSrc ? (
                                <img src={avatarSrc} alt="Coach profile" />
                            ) : (
                                <span>{initials(form.displayName)}</span>
                            )}
                            <span className="cset-avatar-edit" aria-hidden="true">✎</span>
                            {uploadingPhoto && (
                                <span className="cset-avatar-uploading">Uploading...</span>
                            )}
                        </button>
                        <h2>{form.displayName || 'Fitness Coach'}</h2>
                        <p>{form.specialization || 'Fitness Coach'}</p>

                        {/* The actual file input stays hidden. */}
                        <input
                            id="cset-photo-input"
                            ref={fileInputRef}
                            className="cset-hidden-file"
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp"
                            onChange={choosePhoto}
                            tabIndex={-1}
                            aria-hidden="true"
                        />
                        <small>
                            {uploadingPhoto
                                ? 'Uploading your new picture...'
                                : 'Click your profile picture to change it'}
                        </small>
                        <small>JPG, PNG or WEBP · Up to 5 MB</small>
                        {photoError && <div className="cset-alert cset-error" role="alert">{photoError}</div>}
                        {photoSuccess && <div className="cset-alert cset-success" role="status">{photoSuccess}</div>}
                    </section>

                    <section className="cset-card cset-account">
                        <h3>Account Information</h3>
                        <label>Email Address</label>
                        <div className="cset-readonly">{email || '—'}</div>
                        <label>Phone Number</label>
                        <div className="cset-readonly">{phone || '—'}</div>
                        <p>These details come from your registered coach account.</p>
                    </section>
                </aside>

                {/* ======================================
                    RIGHT: PROFILE EDITING + PASSWORD
                ====================================== */}
                <div className="cset-main">
                    <form className="cset-card cset-form" onSubmit={saveProfile}>
                        <div className="cset-section-heading">
                            <span className="cset-section-icon">✎</span>
                            <div>
                                <h2>Coach Profile Details</h2>
                                <p>Information displayed to WellSmartBook users.</p>
                            </div>
                        </div>

                        {saveError && <div className="cset-alert cset-error" role="alert">{saveError}</div>}
                        {saveSuccess && <div className="cset-alert cset-success" role="status">{saveSuccess}</div>}

                        <div className="cset-fields-two">
                            <label className="cset-field">
                                <span>Display Name *</span>
                                <input
                                    required
                                    minLength={2}
                                    maxLength={100}
                                    value={form.displayName}
                                    onChange={e => updateField('displayName', e.target.value)}
                                    placeholder="Your coaching name"
                                />
                            </label>
                            <label className="cset-field">
                                <span>Primary Specialization *</span>
                                <input
                                    required
                                    minLength={2}
                                    maxLength={100}
                                    value={form.specialization}
                                    onChange={e => updateField('specialization', e.target.value)}
                                    placeholder="e.g. Strength & Conditioning"
                                />
                            </label>
                        </div>

                        <label className="cset-field">
                            <span>Coach Biography</span>
                            <textarea
                                rows={6}
                                maxLength={2000}
                                value={form.biography}
                                onChange={e => updateField('biography', e.target.value)}
                                placeholder="Introduce yourself and your coaching philosophy..."
                            />
                            <small>{form.biography.length} / 2000 characters</small>
                        </label>

                        <div className="cset-section-heading cset-subheading">
                            <span className="cset-section-icon">✦</span>
                            <div>
                                <h2>Specialties & Expertise</h2>
                                <p>Select up to 10 training specialties.</p>
                            </div>
                        </div>

                        <div className="cset-specialties" aria-label="Select coach specialties">
                            {SPECIALTY_OPTIONS.map(option => (
                                <button
                                    type="button"
                                    key={option}
                                    className={form.specialties.includes(option) ? 'selected' : ''}
                                    aria-pressed={form.specialties.includes(option)}
                                    onClick={() => toggleSpecialty(option)}
                                >
                                    {option}{form.specialties.includes(option) ? ' ×' : ' +' }
                                </button>
                            ))}
                        </div>
                        <div className="cset-specialty-count">
                            {form.specialties.length} / 10 selected
                        </div>

                        <div className="cset-fields-two cset-numbers">
                            <label className="cset-field">
                                <span>Years of Experience</span>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    max="70"
                                    step="1"
                                    value={form.yearsExperience}
                                    onChange={e => updateField('yearsExperience', e.target.value)}
                                />
                            </label>
                            <label className="cset-field">
                                <span>Session Price (RM)</span>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    max="10000"
                                    step="0.01"
                                    value={form.defaultSessionPrice}
                                    onChange={e => updateField('defaultSessionPrice', e.target.value)}
                                />
                            </label>
                        </div>

                        <div className="cset-form-actions">
                            <button className="cset-primary" type="submit" disabled={saving}>
                                {saving ? 'Saving Profile...' : 'Save Profile Changes →'}
                            </button>
                        </div>
                    </form>

                    <form className="cset-card cset-form" onSubmit={changePassword}>
                        <div className="cset-section-heading">
                            <span className="cset-section-icon">⌁</span>
                            <div>
                                <h2>Change Password</h2>
                                <p>Confirm your current password to keep your account secure.</p>
                            </div>
                        </div>

                        {passwordError && <div className="cset-alert cset-error" role="alert">{passwordError}</div>}
                        {passwordSuccess && <div className="cset-alert cset-success" role="status">{passwordSuccess}</div>}

                        <label className="cset-field">
                            <span>Current Password *</span>
                            <input
                                required
                                type={showPasswords ? 'text' : 'password'}
                                autoComplete="current-password"
                                value={passwords.currentPassword}
                                onChange={e => setPasswords(p => ({ ...p, currentPassword: e.target.value }))}
                            />
                        </label>

                        <div className="cset-fields-two">
                            <label className="cset-field">
                                <span>New Password *</span>
                                <input
                                    required
                                    type={showPasswords ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    value={passwords.newPassword}
                                    onChange={e => setPasswords(p => ({ ...p, newPassword: e.target.value }))}
                                />
                            </label>
                            <label className="cset-field">
                                <span>Confirm New Password *</span>
                                <input
                                    required
                                    type={showPasswords ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    value={passwords.confirmPassword}
                                    onChange={e => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))}
                                />
                            </label>
                        </div>

                        <label className="cset-show-password">
                            <input
                                type="checkbox"
                                checked={showPasswords}
                                onChange={e => setShowPasswords(e.target.checked)}
                            />
                            Show passwords
                        </label>
                        
                        <p className="cset-password-hint">
                            Use at least 12 characters, including
                            one uppercase letter, one lowercase letter,
                            one number and one symbol.
                        </p>

                        <div className="cset-form-actions">
                            <button type="submit" className="cset-primary" disabled={changingPassword}>
                                {changingPassword ? 'Updating Password...' : 'Change Password →'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </main>
    );
}

// ======================================================
// COMPONENT-LOCAL RESPONSIVE CSS
// ======================================================

const css = `
.cset-page {
    width: 100%;
    max-width: 1450px;
    min-width: 0;
    margin: 0 auto;
    color: #142b4d;
}
.cset-page * { box-sizing: border-box; }
.cset-header { margin-bottom: 24px; }
.cset-eyebrow {
    color: #0759d9;
    font-weight: 800;
    font-size: 11px;
    letter-spacing: .8px;
}
.cset-header h1 {
    font-size: 28px;
    margin: 8px 0;
    color: #102a53;
}
.cset-header p {
    color: #718096;
    font-size: 13px;
    line-height: 1.65;
    margin: 0;
}
.cset-layout {
    display: grid;
    grid-template-columns: minmax(240px, .36fr) minmax(0, 1fr);
    gap: 22px;
    align-items: start;
}
.cset-side, .cset-main {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
}
.cset-card {
    padding: 24px;
    background: white;
    border: 1px solid #e0e8f2;
    border-radius: 14px;
    min-width: 0;
}
.cset-identity {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}
.cset-avatar {
    width: 116px;
    height: 116px;
    border-radius: 50%;
    background: #e8f0ff;
    border: 4px solid #d7e6ff;
    overflow: hidden;
    display: grid;
    place-items: center;
    color: #0759d9;
    font-size: 32px;
    font-weight: 800;
    margin-bottom: 15px;
}
.cset-avatar img { width: 100%; height: 100%; object-fit: cover; }
.cset-identity h2 { font-size: 19px; margin: 0 0 5px; overflow-wrap: anywhere; }
.cset-identity p { font-size: 12px; color: #718096; margin: 0 0 17px; }
/* Clickable avatar (photo upload is triggered through its hidden input). */
.cset-avatar-button {
    position: relative;
    padding: 0;
    cursor: pointer;
    appearance: none;
    transition: border-color .18s ease, transform .18s ease;
}
.cset-avatar-button:hover {
    border-color: #0759d9;
    transform: scale(1.03);
}
.cset-avatar-button:disabled { cursor: progress; opacity: .85; }
.cset-avatar-edit {
    position: absolute;
    right: 0;
    bottom: 1px;
    display: grid;
    place-items: center;
    width: 29px;
    height: 29px;
    border-radius: 50%;
    background: #0759d9;
    border: 2px solid white;
    color: #fff;
    font-size: 16px;
    box-shadow: 0 2px 6px rgba(0,0,0,.15);
}
.cset-avatar-uploading {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: rgba(0,22,65,.7);
    color: white;
    font-size: 12px;
    font-weight: 700;
}
.cset-hidden-file { display: none; }
.cset-identity > small { margin-top: 7px; color: #94a3b8; font-size: 11px; }
.cset-account h3 { font-size: 16px; margin: 0 0 20px; }
.cset-account label { display: block; color: #526581; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
.cset-readonly {
    background: #f5f8ff;
    border: 1px solid #e0e8f2;
    padding: 12px;
    border-radius: 9px;
    font-size: 12px;
    overflow-wrap: anywhere;
    margin-bottom: 15px;
}
.cset-account p { font-size: 11px; line-height: 1.6; color: #718096; margin: 0; }
.cset-form { display: flex; flex-direction: column; gap: 17px; }
.cset-section-heading { display: flex; align-items: flex-start; gap: 11px; }
.cset-section-icon {
    flex-shrink: 0;
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: #eaf2ff;
    color: #0759d9;
    font-weight: 800;
    font-size: 19px;
}
.cset-section-heading h2 { font-size: 18px; margin: 0 0 5px; }
.cset-section-heading p { font-size: 12px; line-height: 1.6; color: #718096; margin: 0; }
.cset-subheading { margin-top: 9px; }
.cset-fields-two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.cset-field { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.cset-field > span { font-size: 12px; font-weight: 700; color: #233b58; }
.cset-field input, .cset-field textarea {
    min-width: 0;
    width: 100%;
    padding: 12px;
    border: 1px solid #d7e2f0;
    border-radius: 9px;
    font-family: inherit;
    font-size: 13px;
    color: #142b4d;
    background: #fff;
    outline: none;
}
.cset-field input:focus, .cset-field textarea:focus {
    border-color: #0759d9;
    box-shadow: 0 0 0 3px rgba(7,89,217,.09);
}
.cset-field textarea { resize: vertical; line-height: 1.7; }
.cset-field small { color: #94a3b8; font-size: 11px; text-align: right; }
.cset-specialties { display: flex; flex-wrap: wrap; gap: 9px; }
.cset-specialties button {
    border: 1px solid #dbe5f3;
    color: #47617f;
    background: #f5f8ff;
    font-size: 12px;
    font-weight: 650;
    border-radius: 999px;
    padding: 9px 13px;
    cursor: pointer;
}
.cset-specialties button.selected { background: #0759d9; border-color: #0759d9; color: #fff; }
.cset-specialties button:hover { border-color: #0759d9; }
.cset-specialty-count { font-size: 11px; color: #718096; }
.cset-numbers { margin-top: 3px; }
.cset-form-actions { display: flex; justify-content: flex-end; padding-top: 10px; }
.cset-primary {
    border: 1px solid #0759d9;
    border-radius: 9px;
    background: #0759d9;
    color: white;
    padding: 12px 17px;
    font-size: 13px;
    font-weight: 750;
    cursor: pointer;
    font-family: inherit;
}
.cset-primary:hover { background: #0045b6; }
.cset-primary:disabled { opacity: .6; cursor: not-allowed; }
.cset-show-password { display: flex; align-items: center; gap: 9px; font-size: 12px; color: #526581; }
.cset-show-password input { accent-color: #0759d9; }
.cset-password-hint { margin: 0; font-size: 11px; line-height: 1.7; color: #718096; }
.cset-alert { font-size: 12px; line-height: 1.6; padding: 12px; border-radius: 9px; width: 100%; text-align: left; }
.cset-error { background: #fff1f1; color: #b42318; border: 1px solid #f4c6c6; }
.cset-success { background: #e9f9f1; color: #087645; border: 1px solid #bde9d0; }
.cset-loading { text-align: center; padding: 80px 15px; color: #718096; }
.cset-page button:focus-visible, .cset-page input:focus-visible, .cset-page textarea:focus-visible {
    outline: 3px solid #93bdff;
    outline-offset: 2px;
}
@media (max-width: 1050px) {
    .cset-layout { grid-template-columns: 1fr; }
    .cset-side { display: grid; grid-template-columns: 1fr 1fr; align-items: start; }
}
@media (max-width: 650px) {
    .cset-header h1 { font-size: 23px; }
    .cset-card { padding: 16px; }
    .cset-side { display: flex; }
    .cset-fields-two { grid-template-columns: 1fr; }
    .cset-form-actions .cset-primary { width: 100%; }
    .cset-section-heading h2 { font-size: 16px; }
}
`;
