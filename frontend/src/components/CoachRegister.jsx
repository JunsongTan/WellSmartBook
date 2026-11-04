import {
    useState
} from 'react';

import {
    useNavigate
} from 'react-router-dom';

import PasswordChecklist, { isStrongPassword } from './PasswordChecklist';


const API_BASE_URL =
    `http://${window.location.hostname}:5000`;


const SPECIALIZATIONS = [
    'Strength & Conditioning',
    'Weight Training',
    'Functional Fitness',
    'Bodybuilding',
    'Cardio & Endurance',
    'HIIT',
    'Mobility & Flexibility',
    'Yoga',
    'Pilates',
    'Sports Performance',
    'General Fitness',
    'Other'
];


const MALAYSIA_STATES = [
    'Johor',
    'Kedah',
    'Kelantan',
    'Melaka',
    'Negeri Sembilan',
    'Pahang',
    'Penang',
    'Perak',
    'Perlis',
    'Sabah',
    'Sarawak',
    'Selangor',
    'Terengganu',
    'Kuala Lumpur',
    'Labuan',
    'Putrajaya'
];


export default function CoachRegister() {

    const navigate =
        useNavigate();


    const [
        step,
        setStep
    ] = useState(1);


    const [
        loading,
        setLoading
    ] = useState(false);


    const [
        otpSent,
        setOtpSent
    ] = useState(false);


    const [
        error,
        setError
    ] = useState('');


    const [
        message,
        setMessage
    ] = useState('');


    const [
        form,
        setForm
    ] = useState({

        fullName: '',

        username: '',

        email: '',

        password: '',

        confirmPassword: '',

        otp: '',

        phone: '',

        specialization:
            'Strength & Conditioning',

        yearsExperience:
            0,

        bio: '',

        serviceArea: '',

        defaultSessionPrice:
            80,

        addressLine1: '',

        addressLine2: '',

        city: '',

        state:
            'Penang',

        postcode: '',

        country:
            'Malaysia'
    });


    function updateField(
        field,
        value
    ) {

        setForm(
            (
                current
            ) => ({
                ...current,

                [field]:
                    value
            })
        );


        setError('');
        setMessage('');
    }


    // ==================================================
    // ACCOUNT VALIDATION
    // ==================================================

    function continueAccount() {

        if (
            !form.fullName.trim() ||
            !form.username.trim() ||
            !form.email.trim() ||
            !form.password ||
            !form.confirmPassword
        ) {

            setError(
                'Please complete all account information.'
            );


            return;
        }


        if (
            form.username
                .trim()
                .length < 3
        ) {

            setError(
                'Username must contain at least 3 characters.'
            );


            return;
        }


        if (
            form.password !==
            form.confirmPassword
        ) {

            setError(
                'Password and confirmation do not match.'
            );


            return;
        }


        if (!isStrongPassword(form.password)) {
            setError(
                'Password must contain at least 12 characters, one uppercase letter, one lowercase letter, one number and one symbol (maximum 72 UTF-8 bytes).'
            );
            return;
        }


        setError('');
        setStep(2);
    }


    // ==================================================
    // SEND OTP
    // ==================================================

    async function sendOtp() {

        try {

            setLoading(true);
            setError('');
            setMessage('');


            const response =
                await fetch(
                    `${API_BASE_URL}/api/send-otp`,
                    {
                        method:
                            'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body:
                            JSON.stringify({
                                email:
                                    form.email,

                                purpose:
                                    'coach_registration'
                            })
                    }
                );


            const data =
                await response.json();


            if (
                !response.ok
            ) {

                throw new Error(
                    data.message ||
                    'Unable to send verification code.'
                );
            }


            setOtpSent(true);


            setMessage(
                'Verification code sent. Check your email.'
            );


        } catch (
            requestError
        ) {

            setError(
                requestError.message
            );


        } finally {

            setLoading(false);

        }
    }


    // ==================================================
    // VERIFY OTP
    // ==================================================

    async function verifyOtp() {

        if (
            form.otp.length !==
            6
        ) {

            setError(
                'Please enter the 6-digit verification code.'
            );


            return;
        }


        try {

            setLoading(true);
            setError('');
            setMessage('');


            const response =
                await fetch(
                    `${API_BASE_URL}/api/verify-otp`,
                    {
                        method:
                            'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body:
                            JSON.stringify({

                                email:
                                    form.email,

                                otp:
                                    form.otp,

                                purpose:
                                    'coach_registration'

                            })
                    }
                );


            const data =
                await response.json();


            if (
                !response.ok
            ) {

                throw new Error(
                    data.message ||
                    'Verification failed.'
                );
            }


            setMessage(
                'Email verified successfully.'
            );


            setTimeout(
                () => {

                    setMessage('');
                    setStep(3);

                },
                500
            );


        } catch (
            requestError
        ) {

            setError(
                requestError.message
            );


        } finally {

            setLoading(false);

        }
    }


    // ==================================================
    // PROFESSIONAL PROFILE
    // ==================================================

    function continueProfessional() {

        if (
            !form.phone.trim() ||
            !form.specialization
        ) {

            setError(
                'Phone number and specialization are required.'
            );


            return;
        }


        const experience =
            Number(
                form.yearsExperience
            );


        if (
            !Number.isInteger(
                experience
            ) ||
            experience < 0 ||
            experience > 70
        ) {

            setError(
                'Please enter valid years of experience.'
            );


            return;
        }


        const price =
            Number(
                form.defaultSessionPrice
            );


        if (
            !Number.isFinite(
                price
            ) ||
            price < 0
        ) {

            setError(
                'Please enter a valid session price.'
            );


            return;
        }


        setError('');
        setStep(4);
    }


    // ==================================================
    // REGISTER
    // ==================================================

    async function registerCoach(
        event
    ) {

        event.preventDefault();


        if (
            !form.addressLine1.trim() ||
            !form.city.trim() ||
            !form.state.trim()
        ) {

            setError(
                'Address, city and state are required.'
            );


            return;
        }


        try {

            setLoading(true);
            setError('');
            setMessage('');


            const response =
                await fetch(
                    `${API_BASE_URL}/api/register-coach`,
                    {
                        method:
                            'POST',

                        headers: {
                            'Content-Type':
                                'application/json'
                        },

                        body:
                            JSON.stringify({

                                username:
                                    form.username,

                                email:
                                    form.email,

                                password:
                                    form.password,

                                fullName:
                                    form.fullName,

                                phone:
                                    form.phone,

                                specialization:
                                    form.specialization,

                                bio:
                                    form.bio,

                                yearsExperience:
                                    Number(
                                        form.yearsExperience
                                    ),

                                serviceArea:
                                    form.serviceArea,

                                defaultSessionPrice:
                                    Number(
                                        form.defaultSessionPrice
                                    ),

                                addressLine1:
                                    form.addressLine1,

                                addressLine2:
                                    form.addressLine2,

                                city:
                                    form.city,

                                state:
                                    form.state,

                                postcode:
                                    form.postcode,

                                country:
                                    form.country
                            })
                    }
                );


            const data =
                await response.json();


            if (
                !response.ok
            ) {

                throw new Error(
                    data.message ||
                    'Unable to create coach account.'
                );
            }


            setMessage(
                'Coach account created successfully! Redirecting to login...'
            );


            setTimeout(
                () => {

                    navigate(
                        '/login'
                    );

                },
                1200
            );


        } catch (
            requestError
        ) {

            setError(
                requestError.message
            );


        } finally {

            setLoading(false);

        }
    }


    return (
        <div className="coach-register-page">

            <style>
                {coachRegisterCss}
            </style>


            {/* ========================================
                LEFT PANEL
            ======================================== */}

            <aside className="coach-register-side">

                <button
                    type="button"
                    className="coach-register-brand"
                    onClick={() =>
                        navigate(
                            '/'
                        )
                    }
                >

                    <div>
                        ♥
                    </div>


                    <section>

                        <strong>
                            WellSmartBook
                        </strong>

                        <span>
                            Coach Portal
                        </span>

                    </section>

                </button>


                <div className="coach-side-copy">

                    <span className="coach-side-eyebrow">
                        WELLSMARTBOOK COACH
                    </span>


                    <h1>
                        Grow your coaching career.
                    </h1>


                    <p>
                        Join WellSmartBook and connect with people looking for professional fitness guidance.
                    </p>


                    <div className="coach-side-benefits">

                        <article>

                            <span>
                                ✓
                            </span>

                            <div>

                                <strong>
                                    Registered Gym Locations
                                </strong>

                                <small>
                                    Choose active facilities available through WellSmartBook.
                                </small>

                            </div>

                        </article>


                        <article>

                            <span>
                                ✓
                            </span>

                            <div>

                                <strong>
                                    Flexible Availability
                                </strong>

                                <small>
                                    Publish the days and hours that work for you.
                                </small>

                            </div>

                        </article>


                        <article>

                            <span>
                                ✓
                            </span>

                            <div>

                                <strong>
                                    Client Management
                                </strong>

                                <small>
                                    Manage future sessions from your Coach Portal.
                                </small>

                            </div>

                        </article>

                    </div>

                </div>

            </aside>


            {/* ========================================
                FORM AREA
            ======================================== */}

            <main className="coach-register-main">

                <div className="coach-register-card">

                    <button
                        type="button"
                        className="register-back"
                        onClick={() =>
                            navigate(
                                '/register'
                            )
                        }
                    >
                        ← Account Type
                    </button>


                    <div className="register-step-header">

                        <span>
                            STEP {step} OF 4
                        </span>


                        <h2>

                            {
                                step === 1
                                    ? 'Create Coach Account'

                                    : step === 2
                                        ? 'Verify Your Email'

                                        : step === 3
                                            ? 'Professional Profile'

                                            : 'Location & Pricing'
                            }

                        </h2>


                        <p>

                            {
                                step === 1
                                    ? 'Create the login details for your WellSmartBook Coach Portal.'

                                    : step === 2
                                        ? 'Verify the email linked to your professional account.'

                                        : step === 3
                                            ? 'Tell future clients about your coaching experience.'

                                            : 'Tell us your service area and default coaching price.'
                            }

                        </p>

                    </div>


                    <div className="coach-progress">

                        {[1,2,3,4].map(
                            (
                                progressStep
                            ) => (

                                <span
                                    key={
                                        progressStep
                                    }
                                    className={
                                        progressStep <=
                                        step

                                            ? 'active'

                                            : ''
                                    }
                                />

                            )
                        )}

                    </div>


                    {error && (

                        <div className="coach-alert error">
                            ⚠ {error}
                        </div>

                    )}


                    {message && (

                        <div className="coach-alert success">
                            ✓ {message}
                        </div>

                    )}


                    {/* =================================
                        STEP 1
                    ================================= */}

                    {step === 1 && (

                        <div className="coach-form-grid">

                            <Field
                                label="Full Name"
                            >

                                <input
                                    value={
                                        form.fullName
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'fullName',
                                                event.target.value
                                            )
                                    }
                                    placeholder="Your full name"
                                />

                            </Field>


                            <Field
                                label="Username"
                            >

                                <input
                                    value={
                                        form.username
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'username',
                                                event.target.value
                                            )
                                    }
                                    placeholder="Choose a username"
                                />

                            </Field>


                            <Field
                                label="Email Address"
                                wide
                            >

                                <input
                                    type="email"
                                    value={
                                        form.email
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'email',
                                                event.target.value
                                            )
                                    }
                                    placeholder="coach@example.com"
                                />

                            </Field>


                            <Field
                                label="Password"
                            >

                                <input
                                    type="password"
                                    value={
                                        form.password
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'password',
                                                event.target.value
                                            )
                                    }
                                    placeholder="Minimum 12 characters"
                                />

                            </Field>


                            <div className="coach-password-checklist">
                                <PasswordChecklist password={form.password} />
                            </div>

                            <Field
                                label="Confirm Password"
                            >

                                <input
                                    type="password"
                                    value={
                                        form.confirmPassword
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'confirmPassword',
                                                event.target.value
                                            )
                                    }
                                    placeholder="Repeat password"
                                />

                            </Field>


                            <div className="coach-form-actions single">

                                <button
                                    type="button"
                                    className="coach-primary-button"
                                    onClick={
                                        continueAccount
                                    }
                                >
                                    Continue →
                                </button>

                            </div>

                        </div>

                    )}


                    {/* =================================
                        STEP 2
                    ================================= */}

                    {step === 2 && (

                        <div className="coach-verification">

                            <div className="verification-email-card">

                                <span>
                                    ✉
                                </span>


                                <div>

                                    <small>
                                        Verification email
                                    </small>

                                    <strong>
                                        {form.email}
                                    </strong>

                                </div>

                            </div>


                            <button
                                type="button"
                                className="coach-send-code"
                                onClick={
                                    sendOtp
                                }
                                disabled={
                                    loading
                                }
                            >

                                {
                                    loading
                                        ? 'Sending...'

                                        : otpSent
                                            ? 'Resend Verification Code'

                                            : 'Send Verification Code'
                                }

                            </button>


                            <Field
                                label="6-digit Verification Code"
                            >

                                <input
                                    className="otp-input"
                                    inputMode="numeric"
                                    maxLength="6"
                                    value={
                                        form.otp
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'otp',

                                                event.target.value
                                                    .replace(
                                                        /\D/g,
                                                        ''
                                                    )
                                                    .slice(
                                                        0,
                                                        6
                                                    )
                                            )
                                    }
                                    placeholder="000000"
                                />

                            </Field>


                            <div className="coach-form-actions">

                                <button
                                    type="button"
                                    className="coach-secondary-button"
                                    onClick={() =>
                                        setStep(1)
                                    }
                                >
                                    Back
                                </button>


                                <button
                                    type="button"
                                    className="coach-primary-button"
                                    onClick={
                                        verifyOtp
                                    }
                                    disabled={
                                        loading ||
                                        !otpSent
                                    }
                                >
                                    Verify & Continue
                                </button>

                            </div>

                        </div>

                    )}


                    {/* =================================
                        STEP 3
                    ================================= */}

                    {step === 3 && (

                        <div className="coach-form-grid">

                            <Field
                                label="Phone Number"
                            >

                                <input
                                    value={
                                        form.phone
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'phone',
                                                event.target.value
                                            )
                                    }
                                    placeholder="012-3456789"
                                />

                            </Field>


                            <Field
                                label="Years of Experience"
                            >

                                <input
                                    type="number"
                                    min="0"
                                    max="70"
                                    value={
                                        form.yearsExperience
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'yearsExperience',
                                                event.target.value
                                            )
                                    }
                                />

                            </Field>


                            <Field
                                label="Specialization"
                                wide
                            >

                                <select
                                    value={
                                        form.specialization
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'specialization',
                                                event.target.value
                                            )
                                    }
                                >

                                    {SPECIALIZATIONS.map(
                                        (
                                            specialization
                                        ) => (

                                            <option
                                                key={
                                                    specialization
                                                }
                                                value={
                                                    specialization
                                                }
                                            >
                                                {
                                                    specialization
                                                }
                                            </option>

                                        )
                                    )}

                                </select>

                            </Field>


                            <Field
                                label="Professional Bio"
                                wide
                                hint="A short introduction clients can see when viewing your profile."
                            >

                                <textarea
                                    rows="5"
                                    maxLength="1500"
                                    value={
                                        form.bio
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'bio',
                                                event.target.value
                                            )
                                    }
                                    placeholder="Tell clients about your experience, training approach and areas of expertise..."
                                />

                            </Field>


                            <div className="coach-form-actions">

                                <button
                                    type="button"
                                    className="coach-secondary-button"
                                    onClick={() =>
                                        setStep(2)
                                    }
                                >
                                    Back
                                </button>


                                <button
                                    type="button"
                                    className="coach-primary-button"
                                    onClick={
                                        continueProfessional
                                    }
                                >
                                    Continue →
                                </button>

                            </div>

                        </div>

                    )}


                    {/* =================================
                        STEP 4
                    ================================= */}

                    {step === 4 && (

                        <form
                            className="coach-form-grid"
                            onSubmit={
                                registerCoach
                            }
                        >

                            <Field
                                label="Service Area"
                                wide
                                hint="Example: Bayan Lepas, Penang"
                            >

                                <input
                                    value={
                                        form.serviceArea
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'serviceArea',
                                                event.target.value
                                            )
                                    }
                                    placeholder="Preferred coaching area"
                                />

                            </Field>


                            <Field
                                label="Address Line 1"
                                wide
                            >

                                <input
                                    value={
                                        form.addressLine1
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'addressLine1',
                                                event.target.value
                                            )
                                    }
                                    placeholder="Street / building"
                                />

                            </Field>


                            <Field
                                label="Address Line 2"
                                wide
                                hint="Optional"
                            >

                                <input
                                    value={
                                        form.addressLine2
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'addressLine2',
                                                event.target.value
                                            )
                                    }
                                    placeholder="Apartment / unit"
                                />

                            </Field>


                            <Field
                                label="City"
                            >

                                <input
                                    value={
                                        form.city
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'city',
                                                event.target.value
                                            )
                                    }
                                    placeholder="Bayan Lepas"
                                />

                            </Field>


                            <Field
                                label="State"
                            >

                                <select
                                    value={
                                        form.state
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'state',
                                                event.target.value
                                            )
                                    }
                                >

                                    {MALAYSIA_STATES.map(
                                        (
                                            state
                                        ) => (

                                            <option
                                                key={
                                                    state
                                                }
                                                value={
                                                    state
                                                }
                                            >
                                                {state}
                                            </option>

                                        )
                                    )}

                                </select>

                            </Field>


                            <Field
                                label="Postcode"
                            >

                                <input
                                    value={
                                        form.postcode
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'postcode',
                                                event.target.value
                                            )
                                    }
                                    placeholder="11900"
                                />

                            </Field>


                            <Field
                                label="Country"
                            >

                                <input
                                    value={
                                        form.country
                                    }
                                    disabled
                                />

                            </Field>


                            <Field
                                label="Default Session Price"
                                wide
                                hint="You will be able to manage pricing later from your Coach Portal."
                            >

                                <div className="coach-price-field">

                                    <span>
                                        RM
                                    </span>


                                    <input
                                        type="number"
                                        min="0"
                                        max="10000"
                                        step="0.01"
                                        value={
                                            form.defaultSessionPrice
                                        }
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                updateField(
                                                    'defaultSessionPrice',
                                                    event.target.value
                                                )
                                        }
                                    />

                                    <small>
                                        / session
                                    </small>

                                </div>

                            </Field>


                            <div className="coach-register-notice">

                                <span>
                                    ℹ
                                </span>

                                <p>
                                    After registration you can select any active WellSmartBook gym and publish your availability. Administrators may disable coach accounts that violate platform rules.
                                </p>

                            </div>


                            <div className="coach-form-actions">

                                <button
                                    type="button"
                                    className="coach-secondary-button"
                                    onClick={() =>
                                        setStep(3)
                                    }
                                >
                                    Back
                                </button>


                                <button
                                    type="submit"
                                    className="coach-primary-button"
                                    disabled={
                                        loading
                                    }
                                >

                                    {
                                        loading
                                            ? 'Creating Account...'
                                            : 'Create Coach Account'
                                    }

                                </button>

                            </div>

                        </form>

                    )}

                </div>

            </main>

        </div>
    );
}


// ======================================================
// FIELD
// ======================================================

function Field({
    label,
    hint,
    wide,
    children
}) {

    return (
        <div
            className={
                wide
                    ? 'coach-field wide'
                    : 'coach-field'
            }
        >

            <label>
                {label}
            </label>


            {children}


            {hint && (
                <small>
                    {hint}
                </small>
            )}

        </div>
    );
}


// ======================================================
// CSS
// ======================================================

const coachRegisterCss = `

* {
    box-sizing: border-box;
}

.coach-register-page {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 38% 62%;
    background: #f7f9fc;
}

/* ========================================
   LEFT
======================================== */

.coach-register-side {
    position: relative;
    min-height: 100vh;
    padding: 36px 47px;
    overflow: hidden;
    color: white;
    background:
        linear-gradient(
            145deg,
            #073985,
            #0759d9 52%,
            #0873e9
        );
}

.coach-register-side::after {
    content: '';
    position: absolute;
    width: 380px;
    height: 380px;
    right: -170px;
    bottom: -120px;
    border-radius: 50%;
    background: rgba(255,255,255,.06);
}

.coach-register-brand {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 0;
    border: 0;
    background: transparent;
    color: white;
    cursor: pointer;
    text-align: left;
}

.coach-register-brand > div {
    width: 44px;
    height: 44px;
    border-radius: 11px;
    background: white;
    color: #0759d9;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 18px;
}

.coach-register-brand section strong {
    display: block;
    font-size: 17px;
}

.coach-register-brand section span {
    display: block;
    margin-top: 2px;
    font-size: 8px;
    opacity: .72;
}

.coach-side-copy {
    position: relative;
    z-index: 2;
    max-width: 390px;
    margin-top: 115px;
}

.coach-side-eyebrow {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 1px;
    opacity: .76;
}

.coach-side-copy h1 {
    margin: 12px 0;
    font-size: 35px;
    line-height: 1.14;
}

.coach-side-copy > p {
    margin: 0;
    font-size: 11px;
    line-height: 1.75;
    opacity: .82;
}

.coach-side-benefits {
    display: grid;
    gap: 15px;
    margin-top: 28px;
}

.coach-side-benefits article {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
}

.coach-side-benefits article > span {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(255,255,255,.17);
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 9px;
}

.coach-side-benefits strong {
    display: block;
    font-size: 10px;
}

.coach-side-benefits small {
    display: block;
    margin-top: 2px;
    font-size: 8px;
    line-height: 1.5;
    opacity: .7;
}

/* ========================================
   MAIN
======================================== */

.coach-register-main {
    min-height: 100vh;
    padding: 50px 34px;
    display: flex;
    justify-content: center;
    align-items: flex-start;
}

.coach-register-card {
    width: min(660px,100%);
    padding: 31px;
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    background: white;
    box-shadow: 0 15px 45px rgba(15,23,42,.05);
}

.register-back {
    padding: 0;
    border: 0;
    background: transparent;
    color: #0759d9;
    cursor: pointer;
    font-size: 9px;
    font-weight: 800;
}

.register-step-header {
    margin-top: 21px;
}

.register-step-header > span {
    color: #0759d9;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .8px;
}

.register-step-header h2 {
    margin: 6px 0;
    color: #172033;
    font-size: 24px;
}

.register-step-header p {
    margin: 0;
    color: #64748b;
    font-size: 9px;
    line-height: 1.5;
}

.coach-progress {
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 6px;
    margin: 20px 0;
}

.coach-progress span {
    height: 4px;
    border-radius: 999px;
    background: #e2e8f0;
}

.coach-progress span.active {
    background: #0759d9;
}

/* ========================================
   ALERTS
======================================== */

.coach-alert {
    margin-bottom: 16px;
    padding: 10px 12px;
    border-radius: 9px;
    font-size: 9px;
}

.coach-alert.error {
    border: 1px solid #fed7aa;
    background: #fff7ed;
    color: #c2410c;
}

.coach-alert.success {
    border: 1px solid #bbf7d0;
    background: #ecfdf3;
    color: #15803d;
}

/* ========================================
   FORM
======================================== */

.coach-form-grid {
    display: grid;
    grid-template-columns: repeat(2,minmax(0,1fr));
    gap: 14px;
}

.coach-password-checklist {
    grid-column: 1 / -1;
}

.coach-field.wide {
    grid-column: 1 / -1;
}

.coach-field label {
    display: block;
    margin-bottom: 6px;
    color: #334155;
    font-size: 9px;
    font-weight: 800;
}

.coach-field > input,
.coach-field > select,
.coach-field > textarea {
    width: 100%;
    padding: 11px;
    border: 1px solid #cbd5e1;
    border-radius: 9px;
    outline: none;
    background: white;
    color: #172033;
    font-family: inherit;
    font-size: 10px;
}

.coach-field textarea {
    resize: vertical;
}

.coach-field > input:focus,
.coach-field > select:focus,
.coach-field > textarea:focus {
    border-color: #0759d9;
    box-shadow: 0 0 0 3px rgba(7,89,217,.08);
}

.coach-field > input:disabled {
    background: #f8fafc;
    color: #64748b;
}

.coach-field > small {
    display: block;
    margin-top: 5px;
    color: #94a3b8;
    font-size: 7px;
    line-height: 1.45;
}

/* ========================================
   BUTTONS
======================================== */

.coach-form-actions {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: auto minmax(170px,1fr);
    gap: 8px;
    margin-top: 4px;
}

.coach-form-actions.single {
    grid-template-columns: 1fr;
}

.coach-primary-button,
.coach-secondary-button,
.coach-send-code {
    padding: 11px 15px;
    border-radius: 9px;
    cursor: pointer;
    font-size: 9px;
    font-weight: 800;
}

.coach-primary-button {
    border: 0;
    background: #0759d9;
    color: white;
}

.coach-primary-button:hover {
    background: #064dc1;
}

.coach-primary-button:disabled {
    opacity: .55;
    cursor: wait;
}

.coach-secondary-button {
    border: 1px solid #cbd5e1;
    background: white;
    color: #475569;
}

/* ========================================
   OTP
======================================== */

.coach-verification {
    display: grid;
    gap: 14px;
}

.verification-email-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 13px;
    border-radius: 10px;
    background: #f8fafc;
}

.verification-email-card > span {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: #e8f1ff;
    color: #0759d9;
    display: flex;
    justify-content: center;
    align-items: center;
}

.verification-email-card small {
    display: block;
    color: #94a3b8;
    font-size: 7px;
}

.verification-email-card strong {
    display: block;
    margin-top: 2px;
    color: #334155;
    font-size: 9px;
}

.coach-send-code {
    width: 100%;
    border: 0;
    background: #e8f1ff;
    color: #0759d9;
}

.otp-input {
    text-align: center;
    font-size: 18px !important;
    font-weight: 800;
    letter-spacing: 8px;
}

/* ========================================
   PRICE
======================================== */

.coach-price-field {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    overflow: hidden;
    border: 1px solid #cbd5e1;
    border-radius: 9px;
}

.coach-price-field > span {
    padding-left: 11px;
    color: #334155;
    font-size: 9px;
    font-weight: 800;
}

.coach-price-field input {
    width: 100%;
    padding: 11px;
    border: 0;
    outline: 0;
    background: transparent;
}

.coach-price-field small {
    padding-right: 11px;
    color: #94a3b8;
    font-size: 8px;
}

/* ========================================
   NOTICE
======================================== */

.coach-register-notice {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 9px;
    padding: 12px;
    border: 1px solid #bfdbfe;
    border-radius: 10px;
    background: #eff6ff;
    color: #1d4ed8;
}

.coach-register-notice p {
    margin: 0;
    font-size: 8px;
    line-height: 1.6;
}

/* ========================================
   RESPONSIVE
======================================== */

@media(max-width: 850px) {

    .coach-register-page {
        grid-template-columns: 1fr;
    }

    .coach-register-side {
        min-height: auto;
        padding: 25px;
    }

    .coach-side-copy {
        margin-top: 45px;
    }
}

@media(max-width: 600px) {

    .coach-register-main {
        padding: 25px 15px;
    }

    .coach-form-grid {
        grid-template-columns: 1fr;
    }

    .coach-field.wide {
        grid-column: auto;
    }

    .coach-form-actions {
        grid-column: auto;
    }

    .coach-register-notice {
        grid-column: auto;
    }
}

`;