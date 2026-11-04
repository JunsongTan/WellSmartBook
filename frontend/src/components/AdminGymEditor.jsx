import { useEffect, useRef, useState } from 'react';

import { useNavigate } from 'react-router-dom';

// ======================================================
// WELLSMARTBOOK - ADMIN EDIT GYM DETAILS
//
// GET   /api/admin/gyms/:id/details
// PATCH /api/admin/gyms/:id
//
// Photo upload will be added in the next step.
// ======================================================

const API_URL =
    `http://${window.location.hostname}:5000`;

const DAYS = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday'
];

const EDITABLE_TEXT_FIELDS = [
    'name',
    'description',
    'addressLine1',
    'addressLine2',
    'city',
    'state',
    'postcode',
    'country',
    'phone',
    'email',
    'websiteUrl'
];

function emptyHours() {
    return Object.fromEntries(
        DAYS.map(day => [day, ''])
    );
}

// ======================================================
// ADMIN GYM EDITOR COMPONENT
// ======================================================

export default function AdminGymEditor({
    gymId,
    onClose,
    onSaved
}) {

    const navigate = useNavigate();

    const [form, setForm] = useState(null);

    const [hours, setHours] =
        useState(emptyHours);

    const [amenitiesText, setAmenitiesText] =
        useState('');

    const [hoursEdited, setHoursEdited] =
        useState(false);

    const [amenitiesEdited, setAmenitiesEdited] =
        useState(false);

    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    const [error, setError] =
        useState('');

    const [success, setSuccess] =
        useState('');

    
    // ======================================================
    // GYM PHOTO UPLOAD STATE
    // ======================================================

    const [photoFile, setPhotoFile] = useState(null);

    const [photoPreview, setPhotoPreview] = useState('');

    const [currentPhotoUrl, setCurrentPhotoUrl] =
        useState('');

    const [uploadingPhoto, setUploadingPhoto] =
        useState(false);

    const photoInputRef = useRef(null);

    // ======================================================
    // CREATE PREVIEW OF SELECTED PHOTO
    // ======================================================

    useEffect(() => {

        if (!photoFile) {
            setPhotoPreview('');
            return;
        }

        const objectUrl = URL.createObjectURL(photoFile);

        setPhotoPreview(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);

    }, [photoFile]);

    // ======================================================
    // DISPLAY EXISTING OR SELECTED PHOTO
    // ======================================================

    const displayedPhoto = photoPreview || (
        currentPhotoUrl.startsWith('/api/')
            ? `${API_URL}${currentPhotoUrl}`
            : currentPhotoUrl
    );


    // ==================================================
    // HANDLE EXPIRED ADMIN SESSION
    // ==================================================

    function handleUnauthorized(status) {

        if (
            status !== 401 &&
            status !== 403
        ) {
            return false;
        }

        localStorage.removeItem('token');
        localStorage.removeItem('user');

        navigate('/login', {
            replace: true
        });

        return true;
    }

    // ==================================================
    // LOAD COMPLETE GYM DETAILS
    // ==================================================

    useEffect(() => {

        const controller = new AbortController();

        async function loadGym() {

            setLoading(true);
            setError('');
            setSuccess('');
            setForm(null);
            setHoursEdited(false);
            setAmenitiesEdited(false);

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
                    `${API_URL}/api/admin/gyms/${gymId}/details`,
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

                if (
                    response.status === 401 ||
                    response.status === 403
                ) {

                    handleUnauthorized(response.status);
                    return;
                }

                if (
                    !response.ok ||
                    !data.success ||
                    !data.gym
                ) {

                    throw new Error(
                        data.message ||
                        'Unable to load gym details.'
                    );
                }

                const gym = data.gym;

                // ======================================
                // PREPARE EDITABLE INFORMATION
                // ======================================

                const loadedForm = {};

                EDITABLE_TEXT_FIELDS.forEach(key => {

                    loadedForm[key] = String(
                        gym[key] ?? ''
                    );
                });

                loadedForm.latitude = String(
                    gym.latitude ?? ''
                );

                loadedForm.longitude = String(
                    gym.longitude ?? ''
                );

                
                loadedForm.isActive = gym.isActive;

                setForm(loadedForm);

                setCurrentPhotoUrl(gym.imageUrl || '');

                setPhotoFile(null);


                // ======================================
                // PREPARE OPENING HOURS
                // ======================================

                const openingHours =
                    gym.openingHours || {};

                setHours(
                    Object.fromEntries(
                        DAYS.map(day => [
                            day,
                            typeof openingHours[day] === 'string'
                                ? openingHours[day]
                                : ''
                        ])
                    )
                );

                // ======================================
                // PREPARE AMENITIES
                // ======================================

                setAmenitiesText(
                    Array.isArray(gym.amenities)
                        ? gym.amenities
                            .filter(
                                value =>
                                    typeof value === 'string'
                            )
                            .join(', ')
                        : ''
                );

            } catch (err) {

                if (
                    !controller.signal.aborted &&
                    err.name !== 'AbortError'
                ) {

                    setError(
                        err.message ||
                        'Unable to load gym.'
                    );
                }

            } finally {

                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        void loadGym();

        return () => controller.abort();

    }, [gymId, navigate]);

    // ==================================================
    // UPDATE INPUT VALUES
    // ==================================================

    function updateField(event) {

        const { name, value } = event.target;

        setForm(previous => ({
            ...previous,
            [name]: value
        }));

        setError('');
        setSuccess('');
    }

    // ==================================================
    // UPDATE OPENING HOURS
    // ==================================================

    function updateHour(day, value) {

        setHours(previous => ({
            ...previous,
            [day]: value
        }));

        setHoursEdited(true);

        setError('');
        setSuccess('');
    }

    // ==================================================
    // SAVE GYM DETAILS
    // ==================================================

    // ======================================================
    // SELECT GYM PHOTO
    // ======================================================

    function choosePhoto(event) {

        const file = event.target.files?.[0];

        if (!file) return;

        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp'
        ];

        if (!allowedTypes.includes(file.type)) {

            setError(
                'Please choose a JPEG, PNG or WebP image.'
            );

            event.target.value = '';
            setPhotoFile(null);

            return;
        }

        if (file.size > 5 * 1024 * 1024) {

            setError(
                'Gym photo must be 5 MB or smaller.'
            );

            event.target.value = '';
            setPhotoFile(null);

            return;
        }

        setPhotoFile(file);
        setError('');
        setSuccess('');
    }

    // ======================================================
    // UPLOAD GYM PHOTO TO BACKEND
    // ======================================================

    async function uploadPhoto() {

        if (
            !photoFile ||
            saving ||
            uploadingPhoto
        ) {
            return;
        }

        const token = localStorage.getItem('token');

        if (!token) {
            navigate('/login', { replace: true });
            return;
        }

        setUploadingPhoto(true);
        setError('');
        setSuccess('');

        try {

            // ==============================================
            // PREPARE PHOTO FILE
            // ==============================================

            const uploadData = new FormData();

            uploadData.append('photo', photoFile);

            // ==============================================
            // SEND PHOTO TO BACKEND
            // ==============================================

            const response = await fetch(
                `${API_URL}/api/admin/gyms/${gymId}/photo`,
                {
                    method: 'POST',

                    headers: {
                        Authorization: `Bearer ${token}`
                    },

                    body: uploadData
                }
            );

            const data = await response
                .json()
                .catch(() => ({}));

            // ==============================================
            // CHECK ADMIN LOGIN
            // ==============================================

            if (handleUnauthorized(response.status)) {
                return;
            }

            // ==============================================
            // CHECK UPLOAD RESULT
            // ==============================================

            if (
                !response.ok ||
                data.success !== true ||
                typeof data.gym?.imageUrl !== 'string'
            ) {

                throw new Error(
                    data.message ||
                    'Unable to upload gym photo.'
                );
            }

            // ==============================================
            // UPLOAD SUCCESSFUL
            // ==============================================

            setCurrentPhotoUrl(data.gym.imageUrl);

            setPhotoFile(null);

            if (photoInputRef.current) {
                photoInputRef.current.value = '';
            }

            setSuccess(
                'Gym photo uploaded successfully.'
            );

            // Refresh parent Gym Oversight page.

            onSaved?.();

        } catch (err) {

            setError(
                err.message ||
                'Unable to upload gym photo.'
            );

        } finally {

            setUploadingPhoto(false);
        }
    }

    async function handleSave(event) {

        event.preventDefault();

        
        if (!form || saving || uploadingPhoto) return;


        setError('');
        setSuccess('');

        // ==============================================
        // VALIDATE GPS COORDINATES
        // ==============================================

        const lat = Number(form.latitude);
        const lng = Number(form.longitude);

        if (
            !String(form.latitude).trim() ||
            !String(form.longitude).trim() ||
            !Number.isFinite(lat) ||
            lat < -90 ||
            lat > 90 ||
            !Number.isFinite(lng) ||
            lng < -180 ||
            lng > 180
        ) {

            setError(
                'Latitude must be -90 to 90 ' +
                'and longitude -180 to 180.'
            );

            return;
        }

        // ==============================================
        // PREPARE ONLY ALLOWED UPDATE FIELDS
        // ==============================================

        const payload = {};

        EDITABLE_TEXT_FIELDS.forEach(key => {

            payload[key] = form[key].trim();
        });

        payload.latitude = lat;
        payload.longitude = lng;

        // ==============================================
        // PREPARE AMENITIES IF EDITED
        // ==============================================

        if (amenitiesEdited) {

            const amenities = amenitiesText
                .split(',')
                .map(value => value.trim())
                .filter(Boolean);

            if (
                amenities.length > 30 ||
                amenities.some(
                    value => value.length > 100
                )
            ) {

                setError(
                    'Use at most 30 amenities, ' +
                    'each up to 100 characters.'
                );

                return;
            }

            payload.amenities = amenities;
        }

        // ==============================================
        // PREPARE OPENING HOURS IF EDITED
        // ==============================================

        if (hoursEdited) {

            const openingHours = {};

            const timePattern =
                /^(?:([01]\d|2[0-3]):[0-5]\d\s*-\s*([01]\d|2[0-3]):[0-5]\d|closed)$/i;

            for (const day of DAYS) {

                const value = hours[day].trim();

                if (!value) continue;

                if (!timePattern.test(value)) {

                    setError(
                        `Invalid ${day} hours. ` +
                        'Use 06:00-22:00 or Closed.'
                    );

                    return;
                }

                openingHours[day] =
                    /^closed$/i.test(value)
                        ? 'Closed'
                        : value.replace(/\s+/g, '');
            }

            payload.openingHours = openingHours;
        }

        // ==============================================
        // SEND UPDATE REQUEST TO BACKEND
        // ==============================================

        setSaving(true);

        try {

            const token =
                localStorage.getItem('token');

            const response = await fetch(
                `${API_URL}/api/admin/gyms/${gymId}`,
                {
                    method: 'PATCH',

                    headers: {
                        Authorization:
                            `Bearer ${token}`,

                        'Content-Type':
                            'application/json'
                    },

                    body: JSON.stringify(payload)
                }
            );

            const data = await response
                .json()
                .catch(() => ({}));

            // ==========================================
            // CHECK ADMIN SESSION
            // ==========================================

            if (
                response.status === 401 ||
                response.status === 403
            ) {

                handleUnauthorized(response.status);
                return;
            }

            // ==========================================
            // CHECK UPDATE RESULT
            // ==========================================

            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    'Unable to update gym.'
                );
            }

            // ==========================================
            // UPDATE SUCCESSFUL
            // ==========================================

            setSuccess(
                'Gym details updated successfully.'
            );

            setHoursEdited(false);
            setAmenitiesEdited(false);

            // Refresh Admin Gym list and map.
            onSaved?.();

        } catch (err) {

            setError(
                err.message ||
                'Could not connect to backend.'
            );

        } finally {

            setSaving(false);
        }
    }

    // ==================================================
    // RENDER EDIT GYM MODAL
    // ==================================================

    return (

        <div className="age-overlay">

            <style>{css}</style>

            <section
                className="age-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="age-heading"
            >

                {/* ==================================
                    MODAL HEADER
                ================================== */}

                <header className="age-header">

                    <div>

                        <small>
                            ADMIN GYM MANAGEMENT
                        </small>

                        <h2 id="age-heading">
                            Edit Gym Details #{gymId}
                        </h2>

                    </div>

                    <button
                        type="button"
                        className="age-close"
                        onClick={onClose}
                        disabled={saving}
                        aria-label="Close gym editor"
                    >
                        ✕
                    </button>

                </header>

                {/* ==================================
                    LOADING / ERROR
                ================================== */}

                {loading ? (

                    <p className="age-message">
                        Loading gym details...
                    </p>

                ) : !form ? (

                    <p
                        className="age-error"
                        role="alert"
                    >
                        {error || 'Unable to open gym.'}
                    </p>

                ) : (

                    <form onSubmit={handleSave}>

                        {/* ==========================
                            SUCCESS MESSAGE
                        ========================== */}

                        {success && (

                            <p
                                className="age-success"
                                role="status"
                            >
                                {success}
                            </p>

                        )}

                        {error && (

                            <p
                                className="age-error"
                                role="alert"
                            >
                                {error}
                            </p>

                        )}

                        {/* ==========================
                            CURRENT GYM STATUS
                        ========================== */}

                        <p className="age-status">

                            Current status:{' '}

                            <strong>
                                {form.isActive
                                    ? 'Active'
                                    : 'Disabled'}
                            </strong>

                            <span>
                                {' '}· Gym availability is managed separately.
                            </span>

                        </p>
                        
                        {/* ======================================
                            GYM PHOTO UPLOAD
                        ====================================== */}

                        <section className="age-photo-section">

                            <h3>Gym Photo</h3>

                            {/* CURRENT IMAGE OR SELECTED PREVIEW */}

                            {displayedPhoto ? (

                                <img
                                    className="age-photo-preview"
                                    src={displayedPhoto}
                                    alt={
                                        photoPreview
                                            ? 'Selected gym photo preview'
                                            : 'Current gym photo'
                                    }
                                />

                            ) : (

                                <div className="age-photo-empty">
                                    No gym photo uploaded yet
                                </div>

                            )}

                            {/* CHOOSE PHOTO */}

                            <label htmlFor="age-photo-file">
                                Choose Photo (JPEG, PNG or WebP, max 5 MB)
                            </label>

                            <input
                                id="age-photo-file"
                                ref={photoInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={choosePhoto}
                                disabled={saving || uploadingPhoto}
                            />

                            {/* UPLOAD PHOTO BUTTON */}

                            <button
                                type="button"
                                className="age-photo-upload"
                                onClick={uploadPhoto}
                                disabled={
                                    !photoFile ||
                                    saving ||
                                    uploadingPhoto
                                }
                            >

                                {uploadingPhoto
                                    ? 'Uploading Photo...'
                                    : 'Upload Photo'}

                            </button>

                            <p>
                                Photo uploading is separate from
                                Save Gym Details. The uploaded photo
                                is saved immediately.
                            </p>

                        </section>


                        {/* ==========================
                            GYM INFORMATION
                        ========================== */}

                        <div className="age-grid">

                            <label className="age-wide">
                                Gym Name *

                                <input
                                    name="name"
                                    value={form.name}
                                    onChange={updateField}
                                    required
                                    maxLength={150}
                                    disabled={saving}
                                />
                            </label>

                            <label className="age-wide">
                                Description

                                <textarea
                                    name="description"
                                    value={form.description}
                                    onChange={updateField}
                                    rows={3}
                                    maxLength={5000}
                                    disabled={saving}
                                />
                            </label>

                            <label className="age-wide">
                                Address Line 1 *

                                <input
                                    name="addressLine1"
                                    value={form.addressLine1}
                                    onChange={updateField}
                                    required
                                    maxLength={255}
                                    disabled={saving}
                                />
                            </label>

                            <label className="age-wide">
                                Address Line 2

                                <input
                                    name="addressLine2"
                                    value={form.addressLine2}
                                    onChange={updateField}
                                    maxLength={255}
                                    disabled={saving}
                                />
                            </label>

                            <label>
                                City *

                                <input
                                    name="city"
                                    value={form.city}
                                    onChange={updateField}
                                    required
                                    maxLength={100}
                                    disabled={saving}
                                />
                            </label>

                            <label>
                                State *

                                <input
                                    name="state"
                                    value={form.state}
                                    onChange={updateField}
                                    required
                                    maxLength={100}
                                    disabled={saving}
                                />
                            </label>

                            <label>
                                Postcode

                                <input
                                    name="postcode"
                                    value={form.postcode}
                                    onChange={updateField}
                                    maxLength={20}
                                    disabled={saving}
                                />
                            </label>

                            <label>
                                Country *

                                <input
                                    name="country"
                                    value={form.country}
                                    onChange={updateField}
                                    required
                                    maxLength={100}
                                    disabled={saving}
                                />
                            </label>

                            <label>
                                Latitude *

                                <input
                                    name="latitude"
                                    type="number"
                                    step="any"
                                    min="-90"
                                    max="90"
                                    value={form.latitude}
                                    onChange={updateField}
                                    required
                                    disabled={saving}
                                />
                            </label>

                            <label>
                                Longitude *

                                <input
                                    name="longitude"
                                    type="number"
                                    step="any"
                                    min="-180"
                                    max="180"
                                    value={form.longitude}
                                    onChange={updateField}
                                    required
                                    disabled={saving}
                                />
                            </label>

                            <label>
                                Phone

                                <input
                                    name="phone"
                                    value={form.phone}
                                    onChange={updateField}
                                    maxLength={30}
                                    disabled={saving}
                                />
                            </label>

                            <label>
                                Contact Email

                                <input
                                    name="email"
                                    type="email"
                                    value={form.email}
                                    onChange={updateField}
                                    maxLength={150}
                                    disabled={saving}
                                />
                            </label>

                            <label className="age-wide">
                                Website URL

                                <input
                                    name="websiteUrl"
                                    type="url"
                                    value={form.websiteUrl}
                                    onChange={updateField}
                                    maxLength={500}
                                    placeholder="https://..."
                                    disabled={saving}
                                />
                            </label>

                            <label className="age-wide">
                                Amenities (separated by commas)

                                <input
                                    value={amenitiesText}
                                    maxLength={3400}
                                    disabled={saving}
                                    onChange={event => {

                                        setAmenitiesText(
                                            event.target.value
                                        );

                                        setAmenitiesEdited(true);
                                        setSuccess('');
                                    }}
                                    placeholder="Parking, Showers, Free weights"
                                />
                            </label>

                        </div>

                        {/* ==========================
                            OPENING HOURS
                        ========================== */}

                        <details className="age-hours">

                            <summary>
                                Opening Hours (Optional)
                            </summary>

                            <p>
                                Use 24-hour time such as
                                06:00-22:00, or Closed.
                            </p>

                            <div className="age-grid">

                                {DAYS.map(day => (

                                    <label key={day}>

                                        {day}

                                        <input
                                            value={hours[day]}
                                            maxLength={30}
                                            disabled={saving}
                                            onChange={event =>
                                                updateHour(
                                                    day,
                                                    event.target.value
                                                )
                                            }
                                            placeholder="06:00-22:00 or Closed"
                                        />

                                    </label>

                                ))}

                            </div>

                        </details>

                        {/* ==========================
                            FORM BUTTONS
                        ========================== */}

                        <footer className="age-actions">

                            <button
                                type="button"
                                className="age-cancel"
                                onClick={onClose}
                                disabled={saving}
                            >
                                Cancel
                            </button>

                            <button
                                type="submit"
                                className="age-save"
                                disabled={saving}
                            >
                                {saving
                                    ? 'Saving...'
                                    : 'Save Gym Details'}
                            </button>

                        </footer>

                    </form>

                )}

            </section>

        </div>
    );
}

// ======================================================
// CSS INSIDE JSX
// ======================================================

const css = `

.age-overlay,
.age-overlay * {
    box-sizing: border-box;
}

.age-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;

    padding: 15px;

    background: rgba(14, 33, 58, .63);

    display: flex;
    align-items: center;
    justify-content: center;
}

.age-dialog {
    width: min(760px, 100%);
    max-height: 92dvh;

    overflow-y: auto;

    background: #fff;
    border-radius: 16px;

    box-shadow: 0 20px 60px rgba(0,0,0,.22);

    padding: 24px;
    color: #142b4d;
}

.age-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 15px;

    padding-bottom: 15px;
    margin-bottom: 18px;

    border-bottom: 1px solid #e4eaf4;
}

.age-header small {
    color: #0759dc;
    font-size: 11px;
    font-weight: 800;
}

.age-header h2 {
    color: #142b4d !important;
    margin: 6px 0 0;
    font-size: 22px;
}

.age-close {
    border: 1px solid #dce5f2;
    background: #f6f9ff;
    color: #263b58;

    border-radius: 9px;
    padding: 9px 12px;

    cursor: pointer;
}

.age-grid {
    display: grid;

    grid-template-columns:
        repeat(2, minmax(0, 1fr));

    gap: 16px;
}

.age-grid label {
    min-width: 0;

    display: flex;
    flex-direction: column;
    gap: 7px;

    color: #344763;
    font-size: 12px;
    font-weight: 700;
}

.age-grid input,
.age-grid textarea {
    width: 100%;
    min-width: 0;

    padding: 11px 12px;

    border: 1px solid #d4e1f0;
    border-radius: 9px;

    font: inherit;
    font-size: 14px;
    font-weight: 400;

    color: #172b4d;
    background: #fcfdff;

    outline: none;
}

.age-grid input:focus,
.age-grid textarea:focus {
    border-color: #0759dc;

    box-shadow:
        0 0 0 3px rgba(7,89,220,.1);
}

.age-grid textarea {
    resize: vertical;
}

.age-wide {
    grid-column: 1 / -1;
}

.age-status {
    background: #eff5ff;
    padding: 12px;
    border-radius: 9px;
    font-size: 12px;
}

.age-status span {
    color: #657892;
}

.age-hours {
    margin-top: 20px;

    border: 1px solid #dfe8f5;
    border-radius: 10px;

    padding: 14px;
}

.age-hours summary {
    cursor: pointer;
    color: #0759dc;
    font-size: 13px;
    font-weight: 750;
}

.age-hours p {
    color: #718096;
    font-size: 11px;
}

.age-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;

    margin-top: 22px;
}

.age-actions button {
    border-radius: 9px;

    padding: 12px 16px;

    font: inherit;
    font-size: 12px;
    font-weight: 800;

    cursor: pointer;
}

.age-cancel {
    color: #0759dc;
    background: white;

    border: 1px solid #d4e1f0;
}

.age-save {
    color: white;
    background: #0759dc;

    border: 1px solid #0759dc;
}

.age-dialog button:disabled {
    opacity: .55;
    cursor: not-allowed;
}

.age-success,
.age-error,
.age-message {
    font-size: 12px;
    line-height: 1.6;

    padding: 12px 14px;
    border-radius: 9px;
}

.age-success {
    color: #087747;
    background: #e7f8ef;
}

.age-error {
    color: #9f1239;
    background: #fff1f2;
}

.age-message {
    color: #657892;
}

.age-dialog button:focus-visible {
    outline: 3px solid #8bb8ff;
    outline-offset: 2px;
}

/* ==========================================
   GYM PHOTO UPLOAD SECTION
========================================== */

.age-photo-section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;

    padding: 16px;
    margin: 18px 0;

    background: #f8fbff;
    border: 1px solid #dce7f5;
    border-radius: 11px;
}

.age-photo-section h3 {
    margin: 0;
    font-size: 15px;
    color: #142b4d;
}

.age-photo-section label,
.age-photo-section p {
    margin: 0;
    font-size: 12px;
    color: #526782;
}

.age-photo-section input[type="file"] {
    max-width: 100%;
    font-size: 13px;
}

.age-photo-preview {
    display: block;
    width: 100%;
    max-width: 460px;
    height: 220px;

    object-fit: cover;

    border: 1px solid #d4e1f0;
    border-radius: 10px;
}

.age-photo-empty {
    width: 100%;
    max-width: 460px;

    padding: 40px 12px;
    text-align: center;

    color: #718096;
    background: #edf3fc;

    border-radius: 10px;
    font-size: 12px;
}

.age-photo-upload {
    padding: 10px 14px;

    border: 1px solid #0759dc;
    border-radius: 9px;

    background: #0759dc;
    color: white;

    font-size: 12px;
    font-weight: 750;

    cursor: pointer;
}

.age-photo-upload:disabled {
    opacity: .5;
    cursor: not-allowed;
}


/* ==========================================
   MOBILE RESPONSIVE
========================================== */

@media (max-width: 650px) {

    .age-overlay {
        padding: 9px;
    }

    .age-dialog {
        padding: 16px;
        max-height: 96dvh;
    }

    .age-header h2 {
        font-size: 19px;
    }

    .age-grid {
        grid-template-columns: 1fr;
    }

    .age-grid input,
    .age-grid textarea {
        font-size: 16px;
    }

    .age-actions {
        flex-direction: column-reverse;
    }

    .age-actions button {
        width: 100%;
    }

}

`;
