import { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

// ======================================================
// WELLSMARTBOOK - ADMIN ADD GYM FORM
// POST /api/admin/gyms
// ======================================================

const API_BASE_URL =
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

const initialForm = () => ({
    name: '',
    description: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postcode: '',
    country: 'Malaysia',
    latitude: '',
    longitude: '',
    phone: '',
    email: '',
    websiteUrl: '',
    amenitiesText: ''
});

const initialHours = () =>
    Object.fromEntries(
        DAYS.map(day => [day, ''])
    );

// ======================================================
// HELPERS
// ======================================================

function isValidUrl(value) {

    if (!value) return true;

    try {
        const parsed = new URL(value);

        return ['http:', 'https:'].includes(
            parsed.protocol
        );
    } catch {
        return false;
    }
}

function parseCoordinate(value, minimum, maximum) {

    if (String(value).trim() === '') {
        return null;
    }

    const number = Number(value);

    return (
        Number.isFinite(number) &&
        number >= minimum &&
        number <= maximum
    )
        ? number
        : null;
}

// ======================================================
// ADMIN ADD GYM COMPONENT
// ======================================================

export default function AdminAddGym({ onCreated }) {

    const navigate = useNavigate();

    const [open, setOpen] = useState(false);

    const [form, setForm] = useState(initialForm);

    const [hours, setHours] = useState(initialHours);

    const [saving, setSaving] = useState(false);

    const [error, setError] = useState('');

    const [success, setSuccess] = useState('');

    
    // ======================================================
    // ADD GYM PHOTO UPLOAD
    // ======================================================

    const [selectedPhoto, setSelectedPhoto] =
        useState(null);

    const [photoPreview, setPhotoPreview] =
        useState('');

    // ======================================================
    // CREATE PHOTO PREVIEW
    // ======================================================

    useEffect(() => {

        if (!selectedPhoto) {

            setPhotoPreview('');
            return;
        }

        const previewUrl =
            URL.createObjectURL(selectedPhoto);

        setPhotoPreview(previewUrl);

        return () =>
            URL.revokeObjectURL(previewUrl);

    }, [selectedPhoto]);

    // ======================================================
    // CHOOSE PHOTO
    // ======================================================

    function choosePhoto(event) {

        const file = event.target.files?.[0];

        if (!file) {
            setSelectedPhoto(null);
            return;
        }

        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp'
        ];

        if (!allowedTypes.includes(file.type)) {

            setError(
                'Please choose a JPEG, PNG or WebP photo.'
            );

            setSelectedPhoto(null);
            event.target.value = '';

            return;
        }

        if (
            file.size === 0 ||
            file.size > 5 * 1024 * 1024
        ) {

            setError(
                'Gym photo must be larger than 0 bytes and at most 5 MB.'
            );

            setSelectedPhoto(null);
            event.target.value = '';

            return;
        }

        setSelectedPhoto(file);
        setError('');
    }


    // ==================================================
    // UPDATE FORM
    // ==================================================

    function updateField(event) {

        const { name, value } = event.target;

        setForm(previous => ({
            ...previous,
            [name]: value
        }));

        setError('');
    }

    // ==================================================
    // UPDATE OPENING HOURS
    // ==================================================

    function updateHours(day, value) {

        setHours(previous => ({
            ...previous,
            [day]: value
        }));

        setError('');
    }

    // ==================================================
    // OPEN / CLOSE ADD GYM FORM
    // ==================================================

    function toggleForm() {

        if (saving) return;

        setOpen(previous => !previous);

        setError('');
        setSuccess('');
    }

    // ==================================================
    // CREATE GYM
    // ==================================================

    async function handleSubmit(event) {

        event.preventDefault();

        if (saving) return;

        setError('');
        setSuccess('');

        // ==============================================
        // VALIDATE COORDINATES
        // ==============================================

        const latitude = parseCoordinate(
            form.latitude,
            -90,
            90
        );

        const longitude = parseCoordinate(
            form.longitude,
            -180,
            180
        );

        if (
            latitude === null ||
            longitude === null
        ) {

            setError(
                'Enter valid latitude (-90 to 90) ' +
                'and longitude (-180 to 180).'
            );

            return;
        }

        // ==============================================
        // PREPARE AMENITIES
        // ==============================================

        const amenities = form.amenitiesText
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);

        if (
            amenities.length > 30 ||
            amenities.some(item => item.length > 100)
        ) {

            setError(
                'Use up to 30 amenities, ' +
                'each 100 characters or fewer.'
            );

            return;
        }

        // ==============================================
        // VALIDATE OPTIONAL URLS
        // ==============================================

        
        if (!isValidUrl(form.websiteUrl.trim())) {

            setError(
                'Website URL must begin with http:// or https://.'
            );

            return;
        }


        // ==============================================
        // PREPARE OPENING HOURS
        // ==============================================

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

            openingHours[day] = /^closed$/i.test(value)
                ? 'Closed'
                : value.replace(/\s+/g, '');
        }

        // ==============================================
        // PREPARE API REQUEST BODY
        // ==============================================

        const payload = {

            name: form.name.trim(),

            description: form.description.trim(),

            addressLine1: form.addressLine1.trim(),

            addressLine2: form.addressLine2.trim(),

            city: form.city.trim(),

            state: form.state.trim(),

            postcode: form.postcode.trim(),

            country:
                form.country.trim() || 'Malaysia',

            latitude,

            longitude,

            phone: form.phone.trim(),

            email: form.email.trim(),

            websiteUrl: form.websiteUrl.trim(),

            

            ...(amenities.length
                ? { amenities }
                : {}),

            ...(Object.keys(openingHours).length
                ? { openingHours }
                : {})
        };

        setSaving(true);

        try {

            // ==========================================
            // GET ADMIN TOKEN
            // ==========================================

            const token =
                localStorage.getItem('token');

            if (!token) {

                navigate('/login', {
                    replace: true
                });

                return;
            }

            // ==========================================
            // CALL ADD GYM API
            // ==========================================

            const response = await fetch(
                `${API_BASE_URL}/api/admin/gyms`,
                {
                    method: 'POST',

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
            // INVALID / EXPIRED ADMIN SESSION
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
            // CHECK API RESPONSE
            // ==========================================

            if (
                !response.ok ||
                data.success !== true
            ) {

                throw new Error(
                    data.message ||
                    'Unable to create gym.'
                );
            }

            
            // ======================================================
            // GYM CREATED SUCCESSFULLY IN MYSQL
            // ======================================================

            const createdGymId = Number(data.gym?.id);

            let photoResult = '';

            // ======================================================
            // UPLOAD SELECTED PHOTO TO THE NEW GYM
            // ======================================================

            if (selectedPhoto) {

                if (
                    !Number.isSafeInteger(createdGymId) ||
                    createdGymId <= 0
                ) {

                    photoResult =
                        'Photo could not be uploaded because ' +
                        'the server did not return a gym ID. ' +
                        'Use Edit Gym to upload it. ' +
                        'Do not create the gym again.';

                } else {

                    try {

                        const photoData = new FormData();

                        // IMPORTANT:
                        // Backend expects the field name "photo".

                        photoData.append(
                            'photo',
                            selectedPhoto
                        );

                        const photoResponse = await fetch(
                            `${API_BASE_URL}/api/admin/gyms/${createdGymId}/photo`,
                            {
                                method: 'POST',

                                headers: {
                                    Authorization:
                                        `Bearer ${token}`
                                },

                                body: photoData
                            }
                        );

                        const upload = await photoResponse
                            .json()
                            .catch(() => ({}));

                        if (
                            !photoResponse.ok ||
                            upload.success !== true
                        ) {

                            photoResult =
                                `Photo upload failed: ${
                                    upload.message || 'Upload error'
                                }. ` +
                                'Open Edit Gym to retry. ' +
                                'Do not create the gym again.';

                        } else {

                            photoResult =
                                'Photo uploaded successfully.';
                        }

                    } catch (photoError) {

                        photoResult =
                            `Photo upload failed: ${
                                photoError.message || 'Connection error'
                            }. ` +
                            'Open Edit Gym to retry. ' +
                            'Do not create the gym again.';
                    }
                }
            }

            // ======================================================
            // SHOW SUCCESS MESSAGE
            // ======================================================

            setSuccess(
                `Gym "${
                    data.gym?.name || payload.name
                }" created successfully ` +
                `(ID #${data.gym?.id}). ` +
                photoResult
            );

            // ======================================================
            // RESET ADD GYM FORM
            // ======================================================

            setForm(initialForm());

            setHours(initialHours());

            setSelectedPhoto(null);

            setOpen(false);

            // Refresh Gym Oversight data and map.

            onCreated?.();


        } catch (requestError) {

            setError(
                requestError.message ||
                'Unable to connect to server.'
            );

        } finally {

            setSaving(false);
        }
    }

    // ==================================================
    // RENDER
    // ==================================================

    return (

        <section
            className="aag-section"
            aria-labelledby="aag-title"
        >

            <style>{css}</style>

            {/* ======================================
                FORM HEADER
            ====================================== */}

            <div className="aag-header">

                <div>

                    <span className="aag-eyebrow">
                        GYM MANAGEMENT
                    </span>

                    <h2 id="aag-title">
                        Add a Gym Location
                    </h2>

                    <p>
                        Create a gym record with its
                        address and map coordinates.
                    </p>

                </div>

                <button
                    type="button"
                    className="aag-primary"
                    onClick={toggleForm}
                    disabled={saving}
                    aria-expanded={open}
                >
                    {open ? 'Cancel' : '+ Add Gym'}
                </button>

            </div>

            {/* ======================================
                SUCCESS MESSAGE
            ====================================== */}

            {success && (

                <div
                    className="aag-success"
                    role="status"
                >
                    {success}
                </div>

            )}

            {/* ======================================
                CREATE GYM FORM
            ====================================== */}

            {open && (

                <form
                    className="aag-form"
                    onSubmit={handleSubmit}
                >

                    {/* ==============================
                        BASIC INFORMATION
                    ============================== */}

                    <h3>Basic Information</h3>

                    <div className="aag-fields">

                        <label className="aag-full">

                            <span>
                                Gym Name <b>*</b>
                            </span>

                            <input
                                name="name"
                                value={form.name}
                                onChange={updateField}
                                placeholder="Enter gym name"
                                required
                                maxLength={150}
                                disabled={saving}
                            />

                        </label>

                        <label className="aag-full">

                            <span>
                                Description (Optional)
                            </span>

                            <textarea
                                name="description"
                                value={form.description}
                                onChange={updateField}
                                rows={3}
                                maxLength={5000}
                                placeholder="Briefly describe the gym"
                                disabled={saving}
                            />

                        </label>

                    </div>

                    {/* ==============================
                        LOCATION
                    ============================== */}

                    <h3>
                        Location &amp; Map Coordinates
                    </h3>

                    <div className="aag-fields">

                        <label className="aag-full">

                            <span>
                                Address Line 1 <b>*</b>
                            </span>

                            <input
                                name="addressLine1"
                                value={form.addressLine1}
                                onChange={updateField}
                                required
                                maxLength={255}
                                placeholder="Street address"
                                disabled={saving}
                            />

                        </label>

                        <label className="aag-full">

                            <span>
                                Address Line 2 (Optional)
                            </span>

                            <input
                                name="addressLine2"
                                value={form.addressLine2}
                                onChange={updateField}
                                maxLength={255}
                                placeholder="Unit, floor or building"
                                disabled={saving}
                            />

                        </label>

                        <label>

                            <span>
                                City <b>*</b>
                            </span>

                            <input
                                name="city"
                                value={form.city}
                                onChange={updateField}
                                required
                                maxLength={100}
                                placeholder="e.g. Bayan Lepas"
                                disabled={saving}
                            />

                        </label>

                        <label>

                            <span>
                                State <b>*</b>
                            </span>

                            <input
                                name="state"
                                value={form.state}
                                onChange={updateField}
                                required
                                maxLength={100}
                                placeholder="e.g. Penang"
                                disabled={saving}
                            />

                        </label>

                        <label>

                            <span>
                                Postcode (Optional)
                            </span>

                            <input
                                name="postcode"
                                value={form.postcode}
                                onChange={updateField}
                                maxLength={20}
                                placeholder="e.g. 11900"
                                disabled={saving}
                            />

                        </label>

                        <label>

                            <span>Country</span>

                            <input
                                name="country"
                                value={form.country}
                                onChange={updateField}
                                maxLength={100}
                                required
                                disabled={saving}
                            />

                        </label>

                        <label>

                            <span>
                                Latitude <b>*</b>
                            </span>

                            <input
                                name="latitude"
                                type="number"
                                step="any"
                                min="-90"
                                max="90"
                                value={form.latitude}
                                onChange={updateField}
                                placeholder="e.g. 5.3259"
                                required
                                disabled={saving}
                            />

                        </label>

                        <label>

                            <span>
                                Longitude <b>*</b>
                            </span>

                            <input
                                name="longitude"
                                type="number"
                                step="any"
                                min="-180"
                                max="180"
                                value={form.longitude}
                                onChange={updateField}
                                placeholder="e.g. 100.2731"
                                required
                                disabled={saving}
                            />

                        </label>

                        <p className="aag-help aag-full">
                            Copy the actual decimal GPS coordinates
                            from the location in your map provider.
                            Incorrect coordinates can place the gym
                            in the wrong area.
                        </p>

                    </div>

                    {/* ==============================
                        CONTACT INFORMATION
                    ============================== */}

                    <h3>
                        Contact &amp; Additional Details
                        {' '}
                        <small>(Optional)</small>
                    </h3>

                    <div className="aag-fields">

                        <label>

                            <span>Phone</span>

                            <input
                                name="phone"
                                value={form.phone}
                                onChange={updateField}
                                maxLength={30}
                                placeholder="Gym contact number"
                                disabled={saving}
                            />

                        </label>

                        <label>

                            <span>Contact Email</span>

                            <input
                                name="email"
                                type="email"
                                value={form.email}
                                onChange={updateField}
                                maxLength={150}
                                placeholder="gym@example.com"
                                disabled={saving}
                            />

                        </label>

                        <label className="aag-full">

                            <span>Website URL</span>

                            <input
                                name="websiteUrl"
                                type="url"
                                value={form.websiteUrl}
                                onChange={updateField}
                                maxLength={500}
                                placeholder="https://example.com"
                                disabled={saving}
                            />

                        </label>

                        
                        {/* ======================================
                            UPLOAD GYM PHOTO
                        ====================================== */}

                        <label className="aag-full">

                            <span>
                                Gym Photo (Optional)
                            </span>

                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={choosePhoto}
                                disabled={saving}
                            />

                            <small>
                                Choose JPEG, PNG or WebP,
                                maximum 5 MB.
                                The photo uploads automatically
                                after creating the gym.
                            </small>

                        </label>

                        {/* ======================================
                            SELECTED PHOTO PREVIEW
                        ====================================== */}

                        {photoPreview && (

                            <img
                                className="aag-photo-preview aag-full"
                                src={photoPreview}
                                alt="Selected gym photo preview"
                            />

                        )}


                        <label className="aag-full">

                            <span>
                                Amenities (comma-separated)
                            </span>

                            <input
                                name="amenitiesText"
                                value={form.amenitiesText}
                                onChange={updateField}
                                placeholder="Parking, Showers, Free weights"
                                disabled={saving}
                            />

                            <small>
                                Up to 30 amenities,
                                maximum 100 characters each.
                            </small>

                        </label>

                    </div>

                    {/* ==============================
                        OPENING HOURS
                    ============================== */}

                    <details className="aag-hours">

                        <summary>
                            Opening Hours (Optional)
                        </summary>

                        <p>
                            Use 24-hour time, e.g.
                            06:00-22:00, or type Closed.
                            Leave blank if unknown.
                        </p>

                        <div className="aag-hours-grid">

                            {DAYS.map(day => (

                                <label key={day}>

                                    <span>{day}</span>

                                    <input
                                        type="text"
                                        value={hours[day]}
                                        onChange={event =>
                                            updateHours(
                                                day,
                                                event.target.value
                                            )
                                        }
                                        placeholder="06:00-22:00 or Closed"
                                        maxLength={30}
                                        disabled={saving}
                                    />

                                </label>

                            ))}

                        </div>

                    </details>

                    {/* ==============================
                        ERROR
                    ============================== */}

                    {error && (

                        <div
                            className="aag-error"
                            role="alert"
                        >
                            {error}
                        </div>

                    )}

                    {/* ==============================
                        FORM ACTIONS
                    ============================== */}

                    <div className="aag-footer">

                        <span>
                            * Required field. Newly created
                            gyms are Active automatically.
                        </span>

                        <div className="aag-actions">

                            <button
                                className="aag-secondary"
                                type="button"
                                onClick={toggleForm}
                                disabled={saving}
                            >
                                Cancel
                            </button>

                            <button
                                className="aag-primary"
                                type="submit"
                                disabled={saving}
                            >
                                {saving
                                    ? 'Saving Gym...'
                                    : 'Create Gym'}
                            </button>

                        </div>

                    </div>

                </form>

            )}

        </section>
    );
}

// ======================================================
// RESPONSIVE CSS INSIDE JSX
// ======================================================

const css = `

.aag-section,
.aag-section * {
    box-sizing: border-box;
}

.aag-section {
    min-width: 0;
    border: 1px solid #e0e8f4;
    border-radius: 15px;
    padding: 22px;
    margin-bottom: 22px;
    background: white;
    color: #142b4d;
}

.aag-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
}

.aag-eyebrow {
    color: #0759dc;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
}

.aag-header h2 {
    color: #142b4d !important;
    font-size: 18px;
    margin: 8px 0;
}

.aag-header p {
    color: #718096;
    font-size: 12px;
    margin: 0;
    line-height: 1.5;
}

/* ==========================================
   BUTTONS
========================================== */

.aag-primary,
.aag-secondary {
    border-radius: 9px;
    padding: 12px 16px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    white-space: nowrap;
}

.aag-primary {
    background: #0759dc;
    color: white;
    border: 1px solid #0759dc;
}

.aag-primary:hover {
    background: #0049bd;
}

.aag-secondary {
    border: 1px solid #d3e0f1;
    background: white;
    color: #0759dc;
}

.aag-secondary:hover {
    background: #eef5ff;
}

.aag-section button:disabled {
    opacity: .6;
    cursor: not-allowed;
}

.aag-section button:focus-visible,
.aag-section input:focus-visible,
.aag-section textarea:focus-visible,
.aag-section summary:focus-visible {
    outline: 3px solid #93bdff;
    outline-offset: 2px;
}

/* ==========================================
   FORM
========================================== */

.aag-form {
    border-top: 1px solid #edf1f7;
    margin-top: 22px;
    padding-top: 8px;
}

.aag-form h3 {
    color: #142b4d !important;
    font-size: 15px;
    margin: 22px 0 14px;
}

.aag-form h3 small {
    font-size: 11px;
    font-weight: 500;
    color: #718096;
}

.aag-fields {
    display: grid;
    grid-template-columns:
        repeat(2, minmax(0, 1fr));
    gap: 15px;
}

.aag-fields label,
.aag-hours-grid label {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 7px;
}

.aag-fields label > span,
.aag-hours-grid label > span {
    font-size: 12px;
    font-weight: 750;
    color: #344763;
}

.aag-fields label b {
    color: #b42338;
}

.aag-fields input,
.aag-fields textarea,
.aag-hours-grid input {
    width: 100%;
    min-width: 0;
    border: 1px solid #d5e1f0;
    border-radius: 9px;
    padding: 12px 13px;
    font-size: 13px;
    font-family: inherit;
    background: #fbfcff;
    color: #172b4d;
    outline: none;
}

.aag-fields textarea {
    resize: vertical;
}

.aag-fields input:focus,
.aag-fields textarea:focus,
.aag-hours-grid input:focus {
    background: white;
    border-color: #0759dc;
    box-shadow:
        0 0 0 3px rgba(7,89,220,.09);
}

.aag-full {
    grid-column: 1 / -1;
}

.aag-fields small,
.aag-help {
    color: #718096;
    font-size: 11px;
    line-height: 1.6;
}

.aag-help {
    margin: 0;
}


/* ==========================================
   ADD GYM PHOTO PREVIEW
========================================== */

.aag-photo-preview {
    display: block;

    width: 100%;
    max-width: 500px;

    aspect-ratio: 16 / 9;
    object-fit: cover;

    border: 1px solid #d5e1f0;
    border-radius: 11px;
}


/* ==========================================
   OPENING HOURS
========================================== */

.aag-hours {
    margin-top: 23px;
    border: 1px solid #e1eaf6;
    border-radius: 10px;
    padding: 14px;
}

.aag-hours summary {
    cursor: pointer;
    font-size: 13px;
    font-weight: 750;
    color: #0759dc;
}

.aag-hours p {
    margin: 12px 0;
    color: #718096;
    font-size: 11px;
    line-height: 1.6;
}

.aag-hours-grid {
    display: grid;
    grid-template-columns:
        repeat(2, minmax(0, 1fr));
    gap: 13px;
}

/* ==========================================
   FOOTER
========================================== */

.aag-footer {
    margin-top: 24px;
    padding-top: 18px;
    border-top: 1px solid #edf1f7;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
}

.aag-footer > span {
    font-size: 11px;
    color: #718096;
}

.aag-actions {
    display: flex;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 10px;
}

/* ==========================================
   MESSAGES
========================================== */

.aag-error,
.aag-success {
    margin-top: 15px;
    border-radius: 9px;
    padding: 13px 14px;
    font-size: 12px;
    line-height: 1.6;
}

.aag-error {
    background: #fff1f2;
    border: 1px solid #fecdd3;
    color: #9f1239;
}

.aag-success {
    background: #e7f8ef;
    border: 1px solid #b7e7cc;
    color: #087747;
}

/* ==========================================
   MOBILE
========================================== */

@media (max-width: 750px) {

    .aag-section {
        padding: 16px;
    }

    .aag-header {
        align-items: stretch;
        flex-direction: column;
    }

    .aag-header .aag-primary {
        width: 100%;
    }

    .aag-fields,
    .aag-hours-grid {
        grid-template-columns: 1fr;
    }

    .aag-footer {
        flex-direction: column;
        align-items: stretch;
    }

    .aag-actions button {
        flex: 1;
    }

    .aag-fields input,
    .aag-fields textarea,
    .aag-hours-grid input {
        font-size: 16px;
    }
}

`;
