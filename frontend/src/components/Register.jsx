import {
    useMemo,
    useState
} from 'react';

import {
    useNavigate
} from 'react-router-dom';

import PasswordChecklist, { isStrongPassword } from './PasswordChecklist';


const API_BASE_URL =
    `http://${window.location.hostname}:5000`;


const ACTIVITY_FACTORS = {
    'Sedentary': 1.2,
    'Lightly Active': 1.375,
    'Moderately Active': 1.55,
    'Very Active': 1.725
};


const ALLERGY_OPTIONS = [
    'Peanuts',
    'Tree Nuts',
    'Shellfish',
    'Fish',
    'Dairy',
    'Eggs',
    'Soy',
    'Gluten'
];


function calculateAge(
    dateOfBirth
) {

    if (!dateOfBirth) {

        return null;
    }


    const birthDate =
        new Date(
            `${dateOfBirth}T00:00:00`
        );


    if (
        Number.isNaN(
            birthDate.getTime()
        )
    ) {

        return null;
    }


    const today =
        new Date();


    let age =
        today.getFullYear() -
        birthDate.getFullYear();


    const monthDifference =
        today.getMonth() -
        birthDate.getMonth();


    if (
        monthDifference < 0 ||
        (
            monthDifference === 0 &&
            today.getDate() <
            birthDate.getDate()
        )
    ) {

        age -= 1;
    }


    return age;
}


function calculatePersonalTargets(
    formData
) {

    const age =
        calculateAge(
            formData.dateOfBirth
        );


    const height =
        Number(
            formData.height
        );


    const weight =
        Number(
            formData.weight
        );


    const activityFactor =
        ACTIVITY_FACTORS[
            formData.activityLevel
        ];


    if (
        age === null ||
        age < 18 ||
        !height ||
        !weight ||
        !activityFactor ||
        !formData.gender
    ) {

        return null;
    }


    // Mifflin-St Jeor equation.
    // Sex is used here because the equation has
    // different constants for male and female adults.
    let bmr =
        10 * weight +
        6.25 * height -
        5 * age;


    if (
        formData.gender ===
        'Male'
    ) {

        bmr += 5;

    } else {

        bmr -= 161;
    }


    const tdee =
        bmr *
        activityFactor;


    let calorieMultiplier =
        1;


    if (
        formData.primaryGoal ===
        'Lose Weight'
    ) {

        if (
            formData.goalPace ===
            'Gradual'
        ) {

            calorieMultiplier =
                0.90;

        } else if (
            formData.goalPace ===
            'Moderate'
        ) {

            calorieMultiplier =
                0.85;

        } else {

            calorieMultiplier =
                0.80;
        }

    } else if (
        formData.primaryGoal ===
        'Build Muscle'
    ) {

        if (
            formData.goalPace ===
            'Lean Gain'
        ) {

            calorieMultiplier =
                1.05;

        } else {

            calorieMultiplier =
                1.10;
        }
    }


    const dailyCalories =
        tdee *
        calorieMultiplier;


    let proteinPerKg =
        1.2;


    if (
        formData.primaryGoal ===
        'Lose Weight'
    ) {

        proteinPerKg =
            1.6;

    } else if (
        formData.primaryGoal ===
        'Build Muscle'
    ) {

        proteinPerKg =
            1.8;
    }


    const protein =
        weight *
        proteinPerKg;


    const fat =
        (
            dailyCalories *
            0.25
        ) /
        9;


    const remainingCalories =
        Math.max(
            0,
            dailyCalories -
            protein * 4 -
            fat * 9
        );


    const carbs =
        remainingCalories /
        4;


    const heightMeters =
        height /
        100;


    const bmi =
        weight /
        (
            heightMeters *
            heightMeters
        );


    return {
        age:
            Math.round(
                age
            ),

        bmi:
            Number(
                bmi.toFixed(1)
            ),

        bmr:
            Math.round(
                bmr
            ),

        tdee:
            Math.round(
                tdee
            ),

        dailyCalorieTarget:
            Math.round(
                dailyCalories
            ),

        proteinTarget:
            Math.round(
                protein
            ),

        carbsTarget:
            Math.round(
                carbs
            ),

        fatTarget:
            Math.round(
                fat
            )
    };
}


export default function Register() {

    const navigate =
        useNavigate();


    const [
        step,
        setStep
    ] = useState(1);


    const [
        showPassword,
        setShowPassword
    ] = useState(false);


    const [
        otpCode,
        setOtpCode
    ] = useState('');


    const [
        errors,
        setErrors
    ] = useState({});


    const [
        message,
        setMessage
    ] = useState('');


    const [
        serverError,
        setServerError
    ] = useState('');


    const [
        isSendingOtp,
        setIsSendingOtp
    ] = useState(false);


    const [
        isSubmitting,
        setIsSubmitting
    ] = useState(false);


    const [
        formData,
        setFormData
    ] = useState({

        fullName:
            '',

        username:
            '',

        email:
            '',

        password:
            '',

        confirmPassword:
            '',

        // Used for adult energy-estimation equation.
        gender:
            '',

        dateOfBirth:
            '',

        height:
            '',

        weight:
            '',

        primaryGoal:
            '',

        targetWeight:
            '',

        goalPace:
            '',

        activityLevel:
            '',

        exerciseDaysPerWeek:
            '',

        exerciseMinutes:
            '',

        dietaryPreference:
            'No Preference',

        allergies:
            [],

        mealsPerDay:
            '3',

        cookingTimePreference:
            '15-30 minutes'

    });


    const totalSteps =
        7;


    const targets =
        useMemo(
            () =>
                calculatePersonalTargets(
                    formData
                ),
            [formData]
        );


    const theme = {

        primary:
            '#0047b3',

        primarySoft:
            '#eff6ff',

        bg:
            '#f8fafc',

        inputBg:
            '#f1f5f9',

        textDark:
            '#1e293b',

        textLight:
            '#64748b',

        border:
            '#dbe4f0',

        green:
            '#15803d'
    };


    const stepLabels = {

        1:
            'Account Setup',

        2:
            'Email Verification',

        3:
            'About You',

        4:
            'Your Goal',

        5:
            'Lifestyle',

        6:
            'Food Preferences',

        7:
            'Your Plan'

    };


    // ==================================================
    // FORM HELPERS
    // ==================================================

    const handleChange =
        (event) => {

            const {
                name,
                value
            } =
                event.target;


            setFormData(
                (current) => ({
                    ...current,

                    [name]:
                        value
                })
            );


            setErrors(
                (current) => ({
                    ...current,

                    [name]:
                        false
                })
            );


            setServerError('');
        };


    const setField =
        (
            name,
            value
        ) => {

            setFormData(
                (current) => ({
                    ...current,

                    [name]:
                        value
                })
            );


            setErrors(
                (current) => ({
                    ...current,

                    [name]:
                        false
                })
            );


            setServerError('');
        };


    const toggleAllergy =
        (
            allergy
        ) => {

            setFormData(
                (current) => {

                    const alreadySelected =
                        current.allergies.includes(
                            allergy
                        );


                    return {
                        ...current,

                        allergies:
                            alreadySelected
                                ? current.allergies.filter(
                                    (item) =>
                                        item !==
                                        allergy
                                )
                                : [
                                    ...current.allergies,
                                    allergy
                                ]
                    };
                }
            );
        };


    const goBack = () => {

        setErrors({});
        setServerError('');
        setMessage('');

        setStep(
            (current) =>
                Math.max(
                    1,
                    current - 1
                )
        );
    };


    // ==================================================
    // STEP 1
    // ==================================================

    const validateStep1 =
        async () => {

            const newErrors =
                {};


            if (
                !formData.fullName.trim()
            ) {

                newErrors.fullName =
                    true;
            }


            if (
                !formData.username.trim()
            ) {

                newErrors.username =
                    true;
            }


            if (
                !formData.email.trim()
            ) {

                newErrors.email =
                    true;
            }


            if (!isStrongPassword(formData.password)) {
                newErrors.password = true;
            }

            if (
                !formData.confirmPassword ||
                formData.password !== formData.confirmPassword
            ) {
                newErrors.confirmPassword = true;
            }


            setErrors(
                newErrors
            );


            if (
                Object.keys(
                    newErrors
                ).length >
                0
            ) {

                setServerError(
                    'Complete every field. Passwords must match and contain at least 12 characters, uppercase, lowercase, a number and a symbol (maximum 72 UTF-8 bytes).'
                );

                return;
            }


            try {

                setIsSendingOtp(
                    true
                );

                setServerError(
                    ''
                );

                setMessage(
                    'Sending verification code...'
                );


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
                                        formData.email,

                                    purpose:
                                        'user_registration'
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


                setMessage(
                    `OTP sent to ${formData.email}`
                );

                setStep(
                    2
                );


            } catch (
                error
            ) {

                setMessage(
                    ''
                );

                setServerError(
                    error.message ||
                    'Server connection error.'
                );

            } finally {

                setIsSendingOtp(
                    false
                );
            }
        };


    // ==================================================
    // STEP 2
    // ==================================================

    const verifyOtp =
        async () => {

            if (
                !/^\d{6}$/.test(
                    otpCode.trim()
                )
            ) {

                setServerError(
                    'Enter the 6-digit verification code.'
                );

                return;
            }


            try {

                setServerError(
                    ''
                );


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
                                        formData.email,

                                    otp:
                                        otpCode.trim(),

                                    purpose:
                                        'user_registration'
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
                        'Invalid verification code.'
                    );
                }


                setMessage(
                    ''
                );

                setStep(
                    3
                );


            } catch (
                error
            ) {

                setServerError(
                    error.message ||
                    'Server connection error.'
                );
            }
        };


    // ==================================================
    // STEP 3
    // ==================================================

    const validateStep3 =
        () => {

            const newErrors =
                {};


            const age =
                calculateAge(
                    formData.dateOfBirth
                );


            const height =
                Number(
                    formData.height
                );


            const weight =
                Number(
                    formData.weight
                );


            if (
                !formData.gender
            ) {

                newErrors.gender =
                    true;
            }


            if (
                !formData.dateOfBirth
            ) {

                newErrors.dateOfBirth =
                    true;

            } else if (
                age === null ||
                age < 18
            ) {

                newErrors.dateOfBirth =
                    true;
            }


            if (
                !Number.isFinite(
                    height
                ) ||
                height < 100 ||
                height > 250
            ) {

                newErrors.height =
                    true;
            }


            if (
                !Number.isFinite(
                    weight
                ) ||
                weight < 30 ||
                weight > 300
            ) {

                newErrors.weight =
                    true;
            }


            setErrors(
                newErrors
            );


            if (
                Object.keys(
                    newErrors
                ).length >
                0
            ) {

                setServerError(
                    age !== null &&
                    age < 18
                        ? 'Personalized adult calorie targets are currently available for users aged 18 and above.'
                        : 'Please enter valid profile information.'
                );

                return;
            }


            setServerError(
                ''
            );

            setStep(
                4
            );
        };


    // ==================================================
    // STEP 4
    // ==================================================

    const validateStep4 =
        () => {

            const newErrors =
                {};


            if (
                !formData.primaryGoal
            ) {

                newErrors.primaryGoal =
                    true;
            }


            if (
                formData.primaryGoal !==
                'Maintain Weight'
            ) {

                const targetWeight =
                    Number(
                        formData.targetWeight
                    );


                if (
                    !Number.isFinite(
                        targetWeight
                    ) ||
                    targetWeight < 30 ||
                    targetWeight > 300
                ) {

                    newErrors.targetWeight =
                        true;
                }


                if (
                    !formData.goalPace
                ) {

                    newErrors.goalPace =
                        true;
                }

            }


            setErrors(
                newErrors
            );


            if (
                Object.keys(
                    newErrors
                ).length >
                0
            ) {

                setServerError(
                    'Please complete your goal information.'
                );

                return;
            }


            if (
                formData.primaryGoal ===
                'Maintain Weight'
            ) {

                setFormData(
                    (current) => ({
                        ...current,

                        targetWeight:
                            current.weight,

                        goalPace:
                            'Maintain'
                    })
                );
            }


            setServerError(
                ''
            );

            setStep(
                5
            );
        };


    // ==================================================
    // STEP 5
    // ==================================================

    const validateStep5 =
        () => {

            const newErrors =
                {};


            if (
                !formData.activityLevel
            ) {

                newErrors.activityLevel =
                    true;
            }


            if (
                formData.exerciseDaysPerWeek ===
                ''
            ) {

                newErrors.exerciseDaysPerWeek =
                    true;
            }


            if (
                !formData.exerciseMinutes
            ) {

                newErrors.exerciseMinutes =
                    true;
            }


            setErrors(
                newErrors
            );


            if (
                Object.keys(
                    newErrors
                ).length >
                0
            ) {

                setServerError(
                    'Please tell us about your typical activity.'
                );

                return;
            }


            setServerError(
                ''
            );

            setStep(
                6
            );
        };


    // ==================================================
    // STEP 6
    // ==================================================

    const validateStep6 =
        () => {

            const newErrors =
                {};


            if (
                !formData.dietaryPreference
            ) {

                newErrors.dietaryPreference =
                    true;
            }


            if (
                !formData.mealsPerDay
            ) {

                newErrors.mealsPerDay =
                    true;
            }


            if (
                !formData.cookingTimePreference
            ) {

                newErrors.cookingTimePreference =
                    true;
            }


            setErrors(
                newErrors
            );


            if (
                Object.keys(
                    newErrors
                ).length >
                0
            ) {

                setServerError(
                    'Please complete your food preferences.'
                );

                return;
            }


            setServerError(
                ''
            );

            setStep(
                7
            );
        };


    // ==================================================
    // FINAL SUBMISSION
    // ==================================================

    const handleSubmit =
        async (
            event
        ) => {

            event.preventDefault();


            if (
                step !==
                7
            ) {

                return;
            }


            if (!targets) {

                setServerError(
                    'Unable to calculate your personalized targets. Please review your profile details.'
                );

                return;
            }


            try {

                setIsSubmitting(
                    true
                );

                setServerError(
                    ''
                );


                const accountFields = { ...formData };
                delete accountFields.confirmPassword;
                const payload = {
                    ...accountFields,
                    ...targets
                };


                const response =
                    await fetch(
                        `${API_BASE_URL}/api/register`,
                        {
                            method:
                                'POST',

                            headers: {
                                'Content-Type':
                                    'application/json'
                            },

                            body:
                                JSON.stringify(
                                    payload
                                )
                        }
                    );


                const data =
                    await response.json();


                if (
                    !response.ok
                ) {

                    throw new Error(
                        data.message ||
                        'Registration failed.'
                    );
                }


                setMessage(
                    'Registration successful! Redirecting to login...'
                );


                setTimeout(
                    () =>
                        navigate(
                            '/login'
                        ),
                    1500
                );


            } catch (
                error
            ) {

                setServerError(
                    error.message ||
                    'Registration failed.'
                );

            } finally {

                setIsSubmitting(
                    false
                );
            }
        };


    // ==================================================
    // STYLES
    // ==================================================

    const getInputStyle =
        (
            fieldName
        ) => ({

            padding:
                '14px 16px',

            fontSize:
                '15px',

            borderRadius:
                '10px',

            width:
                '100%',

            boxSizing:
                'border-box',

            backgroundColor:
                theme.inputBg,

            border:
                errors[fieldName]
                    ? '2px solid #ef4444'
                    : '2px solid transparent',

            color:
                theme.textDark,

            outline:
                'none',

            transition:
                '0.2s'
        });


    const labelStyle = {

        fontSize:
            '13px',

        fontWeight:
            '700',

        color:
            theme.textDark,

        marginBottom:
            '7px',

        display:
            'block'
    };


    const btnStyle = {

        padding:
            '14px',

        fontSize:
            '16px',

        backgroundColor:
            theme.primary,

        color:
            '#fff',

        border:
            'none',

        borderRadius:
            '9px',

        cursor:
            'pointer',

        fontWeight:
            '700',

        width:
            '100%',

        transition:
            '0.2s'
    };


    const sectionTitleStyle = {

        margin:
            '0 0 5px 0',

        color:
            theme.textDark,

        fontSize:
            '24px'
    };


    const sectionDescriptionStyle = {

        margin:
            '0 0 15px 0',

        color:
            theme.textLight,

        fontSize:
            '14px',

        lineHeight:
            1.6
    };


    return (

        <div
            style={{
                minHeight:
                    '100vh',

                display:
                    'flex',

                alignItems:
                    'center',

                justifyContent:
                    'center',

                backgroundColor:
                    theme.bg,

                padding:
                    '28px 20px',

                fontFamily:
                    '"Inter", "Segoe UI", sans-serif'
            }}
        >

            <div
                style={{
                    width:
                        '100%',

                    maxWidth:
                        '620px',

                    backgroundColor:
                        '#fff',

                    borderRadius:
                        '24px',

                    padding:
                        '40px',

                    boxShadow:
                        '0 10px 40px rgba(0,0,0,0.05)'
                }}
            >

                {/* =====================================
                    BRAND
                ===================================== */}

                <div
                    style={{
                        textAlign:
                            'center',

                        marginBottom:
                            '28px'
                    }}
                >

                    <h2
                        style={{
                            color:
                                theme.primary,

                            display:
                                'flex',

                            alignItems:
                                'center',

                            justifyContent:
                                'center',

                            gap:
                                '8px',

                            margin:
                                0
                        }}
                    >

                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill={
                                theme.primary
                            }
                        >
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>

                        WellSmartBook

                    </h2>


                    <p
                        style={{
                            color:
                                theme.textLight,

                            fontSize:
                                '14px',

                            marginTop:
                                '8px'
                        }}
                    >
                        Your Health Companion
                    </p>

                </div>


                {/* =====================================
                    PROGRESS
                ===================================== */}

                <div
                    style={{
                        display:
                            'flex',

                        justifyContent:
                            'space-between',

                        gap:
                            '16px',

                        fontSize:
                            '12px',

                        color:
                            theme.textLight,

                        marginBottom:
                            '8px',

                        fontWeight:
                            '700'
                    }}
                >

                    <span>
                        Step {step} of {totalSteps}
                    </span>


                    <span
                        style={{
                            color:
                                theme.primary
                        }}
                    >
                        {stepLabels[step]}
                    </span>

                </div>


                <div
                    style={{
                        height:
                            '5px',

                        backgroundColor:
                            theme.inputBg,

                        borderRadius:
                            '999px',

                        marginBottom:
                            '30px',

                        overflow:
                            'hidden'
                    }}
                >

                    <div
                        style={{
                            height:
                                '100%',

                            width:
                                `${(
                                    step /
                                    totalSteps
                                ) * 100}%`,

                            backgroundColor:
                                theme.primary,

                            borderRadius:
                                '999px',

                            transition:
                                '0.3s ease-in-out'
                        }}
                    />

                </div>


                {message && (

                    <div
                        style={{
                            padding:
                                '12px',

                            backgroundColor:
                                '#dcfce7',

                            color:
                                '#166534',

                            borderRadius:
                                '8px',

                            marginBottom:
                                '20px',

                            fontSize:
                                '14px',

                            textAlign:
                                'center'
                        }}
                    >
                        {message}
                    </div>

                )}


                {serverError && (

                    <div
                        style={{
                            padding:
                                '12px',

                            backgroundColor:
                                '#fee2e2',

                            color:
                                '#991b1b',

                            borderRadius:
                                '8px',

                            marginBottom:
                                '20px',

                            fontSize:
                                '14px',

                            textAlign:
                                'center'
                        }}
                    >
                        {serverError}
                    </div>

                )}


                <form
                    onSubmit={
                        handleSubmit
                    }
                    style={{
                        display:
                            'flex',

                        flexDirection:
                            'column',

                        gap:
                            '20px'
                    }}
                >

                    {/* =====================================
                        STEP 1 — ACCOUNT
                    ===================================== */}

                    {step ===
                        1 && (

                        <>

                            <h3
                                style={
                                    sectionTitleStyle
                                }
                            >
                                Welcome
                            </h3>


                            <p
                                style={
                                    sectionDescriptionStyle
                                }
                            >
                                Create your WellSmartBook account first. We will personalize your nutrition plan after email verification.
                            </p>


                            <div>

                                <label
                                    style={
                                        labelStyle
                                    }
                                >
                                    Full Name
                                </label>


                                <input
                                    type="text"
                                    name="fullName"
                                    placeholder="e.g. John Doe"
                                    value={
                                        formData.fullName
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    style={
                                        getInputStyle(
                                            'fullName'
                                        )
                                    }
                                />

                            </div>


                            <div>

                                <label
                                    style={
                                        labelStyle
                                    }
                                >
                                    Username
                                </label>


                                <input
                                    type="text"
                                    name="username"
                                    placeholder="johndoe123"
                                    value={
                                        formData.username
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    style={
                                        getInputStyle(
                                            'username'
                                        )
                                    }
                                />

                            </div>


                            <div>

                                <label
                                    style={
                                        labelStyle
                                    }
                                >
                                    Registered Email Address
                                </label>


                                <input
                                    type="email"
                                    name="email"
                                    placeholder="name@example.com"
                                    value={
                                        formData.email
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    style={
                                        getInputStyle(
                                            'email'
                                        )
                                    }
                                />

                            </div>


                            <div>

                                <label
                                    style={
                                        labelStyle
                                    }
                                >
                                    Password
                                </label>


                                <div
                                    style={{
                                        position:
                                            'relative'
                                    }}
                                >

                                    <input
                                        type={
                                            showPassword
                                                ? 'text'
                                                : 'password'
                                        }
                                        name="password"
                                        placeholder="••••••••"
                                        value={
                                            formData.password
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        style={{
                                            ...getInputStyle(
                                                'password'
                                            ),

                                            paddingRight:
                                                '48px'
                                        }}
                                    />


                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword(
                                                !showPassword
                                            )
                                        }
                                        aria-label="Toggle password visibility"
                                        style={{
                                            position:
                                                'absolute',

                                            right:
                                                '15px',

                                            top:
                                                '13px',

                                            background:
                                                'none',

                                            border:
                                                'none',

                                            cursor:
                                                'pointer',

                                            color:
                                                theme.textLight,

                                            padding:
                                                0
                                        }}
                                    >
                                        {showPassword
                                            ? '🙈'
                                            : '👁️'}
                                    </button>

                                </div>


                                <p
                                    style={{
                                        fontSize:
                                            '11px',

                                        color:
                                            theme.textLight,

                                        margin:
                                            '6px 0 0'
                                    }}
                                >
                                    At least 12 characters with uppercase, lowercase, a number and a symbol.
                                </p>

                            </div>


                            <div>
                                <PasswordChecklist password={formData.password} />
                            </div>

                            <div>
                                <label style={labelStyle} htmlFor="register-confirm-password">
                                    Confirm Password
                                </label>
                                <input
                                    id="register-confirm-password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="confirmPassword"
                                    placeholder="Repeat your password"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    autoComplete="new-password"
                                    style={getInputStyle('confirmPassword')}
                                />
                            </div>

                            <button
                                type="button"
                                onClick={
                                    validateStep1
                                }
                                disabled={
                                    isSendingOtp
                                }
                                style={{
                                    ...btnStyle,

                                    opacity:
                                        isSendingOtp
                                            ? 0.7
                                            : 1
                                }}
                            >
                                {isSendingOtp
                                    ? 'Sending OTP...'
                                    : 'Verify Email'}
                            </button>

                        </>

                    )}


                    {/* =====================================
                        STEP 2 — OTP
                    ===================================== */}

                    {step ===
                        2 && (

                        <>

                            <h3
                                style={
                                    sectionTitleStyle
                                }
                            >
                                Check your inbox
                            </h3>


                            <p
                                style={
                                    sectionDescriptionStyle
                                }
                            >
                                We sent a 6-digit verification code to {formData.email}.
                            </p>


                            <div>

                                <label
                                    style={
                                        labelStyle
                                    }
                                >
                                    Verification Code
                                </label>


                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength="6"
                                    placeholder="000000"
                                    value={
                                        otpCode
                                    }
                                    onChange={(event) =>
                                        setOtpCode(
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
                                    style={{
                                        ...getInputStyle(
                                            'otp'
                                        ),

                                        textAlign:
                                            'center',

                                        fontSize:
                                            '24px',

                                        letterSpacing:
                                            '5px'
                                    }}
                                />

                            </div>


                            <div
                                style={{
                                    display:
                                        'flex',

                                    gap:
                                        '12px',

                                    marginTop:
                                        '10px'
                                }}
                            >

                                <button
                                    type="button"
                                    onClick={
                                        goBack
                                    }
                                    style={{
                                        ...btnStyle,

                                        backgroundColor:
                                            theme.inputBg,

                                        color:
                                            theme.textDark,

                                        width:
                                            '30%'
                                    }}
                                >
                                    Back
                                </button>


                                <button
                                    type="button"
                                    onClick={
                                        verifyOtp
                                    }
                                    style={{
                                        ...btnStyle,

                                        width:
                                            '70%'
                                    }}
                                >
                                    Continue
                                </button>

                            </div>

                        </>

                    )}


                    {/* =====================================
                        STEP 3 — ABOUT YOU
                    ===================================== */}

                    {step ===
                        3 && (

                        <>

                            <h3
                                style={
                                    sectionTitleStyle
                                }
                            >
                                Tell Us About You
                            </h3>


                            <p
                                style={
                                    sectionDescriptionStyle
                                }
                            >
                                These measurements help WellSmartBook estimate your BMI, resting energy needs and daily calorie target.
                            </p>


                            <div>

                                <label
                                    style={
                                        labelStyle
                                    }
                                >
                                    Sex used for energy calculation
                                </label>


                                <div
                                    style={{
                                        display:
                                            'grid',

                                        gridTemplateColumns:
                                            'repeat(2, minmax(0, 1fr))',

                                        gap:
                                            '10px'
                                    }}
                                >

                                    <ChoiceButton
                                        title="Male"
                                        icon="♂️"
                                        selected={
                                            formData.gender ===
                                            'Male'
                                        }
                                        onClick={() =>
                                            setField(
                                                'gender',
                                                'Male'
                                            )
                                        }
                                        theme={
                                            theme
                                        }
                                    />


                                    <ChoiceButton
                                        title="Female"
                                        icon="♀️"
                                        selected={
                                            formData.gender ===
                                            'Female'
                                        }
                                        onClick={() =>
                                            setField(
                                                'gender',
                                                'Female'
                                            )
                                        }
                                        theme={
                                            theme
                                        }
                                    />

                                </div>

                            </div>


                            <div>

                                <label
                                    style={
                                        labelStyle
                                    }
                                >
                                    Date of Birth
                                </label>


                                <input
                                    type="date"
                                    name="dateOfBirth"
                                    value={
                                        formData.dateOfBirth
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    style={
                                        getInputStyle(
                                            'dateOfBirth'
                                        )
                                    }
                                />

                            </div>


                            <div
                                style={{
                                    display:
                                        'grid',

                                    gridTemplateColumns:
                                        'repeat(2, minmax(0, 1fr))',

                                    gap:
                                        '12px'
                                }}
                            >

                                <div>

                                    <label
                                        style={
                                            labelStyle
                                        }
                                    >
                                        Height (cm)
                                    </label>


                                    <input
                                        type="number"
                                        name="height"
                                        min="100"
                                        max="250"
                                        placeholder="170"
                                        value={
                                            formData.height
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        style={
                                            getInputStyle(
                                                'height'
                                            )
                                        }
                                    />

                                </div>


                                <div>

                                    <label
                                        style={
                                            labelStyle
                                        }
                                    >
                                        Current Weight (kg)
                                    </label>


                                    <input
                                        type="number"
                                        name="weight"
                                        min="30"
                                        max="300"
                                        step="0.1"
                                        placeholder="70"
                                        value={
                                            formData.weight
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        style={
                                            getInputStyle(
                                                'weight'
                                            )
                                        }
                                    />

                                </div>

                            </div>


                            <p
                                style={{
                                    margin:
                                        0,

                                    color:
                                        theme.textLight,

                                    fontSize:
                                        '11px',

                                    lineHeight:
                                        1.5
                                }}
                            >
                                Personalized calorie targets in this prototype are designed for adults aged 18+. They are estimates and are not a substitute for medical nutrition advice.
                            </p>


                            <NavigationButtons
                                onBack={
                                    goBack
                                }
                                onNext={
                                    validateStep3
                                }
                                theme={
                                    theme
                                }
                                btnStyle={
                                    btnStyle
                                }
                            />

                        </>

                    )}


                    {/* =====================================
                        STEP 4 — GOAL
                    ===================================== */}

                    {step ===
                        4 && (

                        <>

                            <h3
                                style={
                                    sectionTitleStyle
                                }
                            >
                                What is your primary goal?
                            </h3>


                            <p
                                style={
                                    sectionDescriptionStyle
                                }
                            >
                                Your goal changes the calorie and protein targets WellSmartBook recommends.
                            </p>


                            <div
                                style={{
                                    display:
                                        'grid',

                                    gap:
                                        '10px'
                                }}
                            >

                                <GoalCard
                                    title="Lose Weight"
                                    description="Use a moderate calorie deficit while keeping protein higher."
                                    icon="📉"
                                    selected={
                                        formData.primaryGoal ===
                                        'Lose Weight'
                                    }
                                    onClick={() => {

                                        setField(
                                            'primaryGoal',
                                            'Lose Weight'
                                        );

                                        setField(
                                            'goalPace',
                                            ''
                                        );

                                    }}
                                    theme={
                                        theme
                                    }
                                />


                                <GoalCard
                                    title="Maintain Weight"
                                    description="Aim near your estimated daily energy expenditure."
                                    icon="⚖️"
                                    selected={
                                        formData.primaryGoal ===
                                        'Maintain Weight'
                                    }
                                    onClick={() => {

                                        setField(
                                            'primaryGoal',
                                            'Maintain Weight'
                                        );

                                        setField(
                                            'targetWeight',
                                            formData.weight
                                        );

                                        setField(
                                            'goalPace',
                                            'Maintain'
                                        );

                                    }}
                                    theme={
                                        theme
                                    }
                                />


                                <GoalCard
                                    title="Build Muscle"
                                    description="Use a modest calorie surplus with a higher protein target."
                                    icon="💪"
                                    selected={
                                        formData.primaryGoal ===
                                        'Build Muscle'
                                    }
                                    onClick={() => {

                                        setField(
                                            'primaryGoal',
                                            'Build Muscle'
                                        );

                                        setField(
                                            'goalPace',
                                            ''
                                        );

                                    }}
                                    theme={
                                        theme
                                    }
                                />

                            </div>


                            {formData.primaryGoal &&
                                formData.primaryGoal !==
                                'Maintain Weight' && (

                                <>

                                    <div>

                                        <label
                                            style={
                                                labelStyle
                                            }
                                        >
                                            Target Weight (kg)
                                        </label>


                                        <input
                                            type="number"
                                            name="targetWeight"
                                            min="30"
                                            max="300"
                                            step="0.1"
                                            placeholder={
                                                formData.primaryGoal ===
                                                'Lose Weight'
                                                    ? 'e.g. 65'
                                                    : 'e.g. 75'
                                            }
                                            value={
                                                formData.targetWeight
                                            }
                                            onChange={
                                                handleChange
                                            }
                                            style={
                                                getInputStyle(
                                                    'targetWeight'
                                                )
                                            }
                                        />

                                    </div>


                                    <div>

                                        <label
                                            style={
                                                labelStyle
                                            }
                                        >
                                            Preferred Progress Pace
                                        </label>


                                        <div
                                            style={{
                                                display:
                                                    'grid',

                                                gap:
                                                    '9px'
                                            }}
                                        >

                                            {formData.primaryGoal ===
                                                'Lose Weight' ? (

                                                <>
                                                    <ChoiceButton
                                                        title="Gradual"
                                                        subtitle="Small calorie deficit"
                                                        selected={
                                                            formData.goalPace ===
                                                            'Gradual'
                                                        }
                                                        onClick={() =>
                                                            setField(
                                                                'goalPace',
                                                                'Gradual'
                                                            )
                                                        }
                                                        theme={
                                                            theme
                                                        }
                                                    />

                                                    <ChoiceButton
                                                        title="Moderate"
                                                        subtitle="Balanced calorie deficit"
                                                        selected={
                                                            formData.goalPace ===
                                                            'Moderate'
                                                        }
                                                        onClick={() =>
                                                            setField(
                                                                'goalPace',
                                                                'Moderate'
                                                            )
                                                        }
                                                        theme={
                                                            theme
                                                        }
                                                    />

                                                    <ChoiceButton
                                                        title="Faster"
                                                        subtitle="Larger deficit; still treated as an estimate"
                                                        selected={
                                                            formData.goalPace ===
                                                            'Faster'
                                                        }
                                                        onClick={() =>
                                                            setField(
                                                                'goalPace',
                                                                'Faster'
                                                            )
                                                        }
                                                        theme={
                                                            theme
                                                        }
                                                    />
                                                </>

                                            ) : (

                                                <>
                                                    <ChoiceButton
                                                        title="Lean Gain"
                                                        subtitle="Small calorie surplus"
                                                        selected={
                                                            formData.goalPace ===
                                                            'Lean Gain'
                                                        }
                                                        onClick={() =>
                                                            setField(
                                                                'goalPace',
                                                                'Lean Gain'
                                                            )
                                                        }
                                                        theme={
                                                            theme
                                                        }
                                                    />

                                                    <ChoiceButton
                                                        title="Standard Gain"
                                                        subtitle="Moderate calorie surplus"
                                                        selected={
                                                            formData.goalPace ===
                                                            'Standard Gain'
                                                        }
                                                        onClick={() =>
                                                            setField(
                                                                'goalPace',
                                                                'Standard Gain'
                                                            )
                                                        }
                                                        theme={
                                                            theme
                                                        }
                                                    />
                                                </>

                                            )}

                                        </div>

                                    </div>

                                </>

                            )}


                            <NavigationButtons
                                onBack={
                                    goBack
                                }
                                onNext={
                                    validateStep4
                                }
                                theme={
                                    theme
                                }
                                btnStyle={
                                    btnStyle
                                }
                            />

                        </>

                    )}


                    {/* =====================================
                        STEP 5 — LIFESTYLE
                    ===================================== */}

                    {step ===
                        5 && (

                        <>

                            <h3
                                style={
                                    sectionTitleStyle
                                }
                            >
                                Tell Us About Your Lifestyle
                            </h3>


                            <p
                                style={
                                    sectionDescriptionStyle
                                }
                            >
                                Daily activity is used to estimate total daily energy expenditure. Exercise information also helps personalize future recommendations.
                            </p>


                            <div>

                                <label
                                    style={
                                        labelStyle
                                    }
                                >
                                    Typical Daily Activity
                                </label>


                                <select
                                    name="activityLevel"
                                    value={
                                        formData.activityLevel
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    style={
                                        getInputStyle(
                                            'activityLevel'
                                        )
                                    }
                                >

                                    <option value="">
                                        Select Activity Level
                                    </option>

                                    <option value="Sedentary">
                                        Sedentary — mostly sitting, little daily movement
                                    </option>

                                    <option value="Lightly Active">
                                        Lightly Active — some walking / movement
                                    </option>

                                    <option value="Moderately Active">
                                        Moderately Active — frequent walking / active routine
                                    </option>

                                    <option value="Very Active">
                                        Very Active — physical work / highly active routine
                                    </option>

                                </select>

                            </div>


                            <div>

                                <label
                                    style={
                                        labelStyle
                                    }
                                >
                                    Exercise Days Per Week
                                </label>


                                <div
                                    style={{
                                        display:
                                            'grid',

                                        gridTemplateColumns:
                                            'repeat(4, minmax(0, 1fr))',

                                        gap:
                                            '8px'
                                    }}
                                >

                                    {[
                                        0,
                                        1,
                                        2,
                                        3,
                                        4,
                                        5,
                                        6,
                                        7
                                    ].map(
                                        (days) => (

                                            <ChoiceButton
                                                key={
                                                    days
                                                }
                                                title={
                                                    String(
                                                        days
                                                    )
                                                }
                                                selected={
                                                    String(
                                                        formData.exerciseDaysPerWeek
                                                    ) ===
                                                    String(
                                                        days
                                                    )
                                                }
                                                onClick={() =>
                                                    setField(
                                                        'exerciseDaysPerWeek',
                                                        String(
                                                            days
                                                        )
                                                    )
                                                }
                                                compact
                                                theme={
                                                    theme
                                                }
                                            />

                                        )
                                    )}

                                </div>

                            </div>


                            <div>

                                <label
                                    style={
                                        labelStyle
                                    }
                                >
                                    Average Exercise Duration
                                </label>


                                <select
                                    name="exerciseMinutes"
                                    value={
                                        formData.exerciseMinutes
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    style={
                                        getInputStyle(
                                            'exerciseMinutes'
                                        )
                                    }
                                >

                                    <option value="">
                                        Select Duration
                                    </option>

                                    <option value="15">
                                        Less than 30 minutes
                                    </option>

                                    <option value="30">
                                        Around 30 minutes
                                    </option>

                                    <option value="45">
                                        Around 45 minutes
                                    </option>

                                    <option value="60">
                                        Around 60 minutes
                                    </option>

                                    <option value="90">
                                        More than 60 minutes
                                    </option>

                                </select>

                            </div>


                            <NavigationButtons
                                onBack={
                                    goBack
                                }
                                onNext={
                                    validateStep5
                                }
                                theme={
                                    theme
                                }
                                btnStyle={
                                    btnStyle
                                }
                            />

                        </>

                    )}


                    {/* =====================================
                        STEP 6 — FOOD PREFERENCES
                    ===================================== */}

                    {step ===
                        6 && (

                        <>

                            <h3
                                style={
                                    sectionTitleStyle
                                }
                            >
                                Personalize Your Food Recommendations
                            </h3>


                            <p
                                style={
                                    sectionDescriptionStyle
                                }
                            >
                                These preferences can later be included in your AI recipe prompts so recommendations better match your lifestyle.
                            </p>


                            <div>

                                <label
                                    style={
                                        labelStyle
                                    }
                                >
                                    Dietary Preference
                                </label>


                                <select
                                    name="dietaryPreference"
                                    value={
                                        formData.dietaryPreference
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    style={
                                        getInputStyle(
                                            'dietaryPreference'
                                        )
                                    }
                                >

                                    <option value="No Preference">
                                        No Preference
                                    </option>

                                    <option value="Halal">
                                        Halal
                                    </option>

                                    <option value="Vegetarian">
                                        Vegetarian
                                    </option>

                                    <option value="Vegan">
                                        Vegan
                                    </option>

                                    <option value="Pescatarian">
                                        Pescatarian
                                    </option>

                                    <option value="High Protein">
                                        High Protein
                                    </option>

                                    <option value="Low Carb">
                                        Low Carb
                                    </option>

                                </select>

                            </div>


                            <div>

                                <label
                                    style={
                                        labelStyle
                                    }
                                >
                                    Foods / Allergens to Avoid
                                </label>


                                <div
                                    style={{
                                        display:
                                            'flex',

                                        flexWrap:
                                            'wrap',

                                        gap:
                                            '8px'
                                    }}
                                >

                                    {ALLERGY_OPTIONS.map(
                                        (allergy) => {

                                            const selected =
                                                formData.allergies.includes(
                                                    allergy
                                                );


                                            return (

                                                <button
                                                    key={
                                                        allergy
                                                    }
                                                    type="button"
                                                    onClick={() =>
                                                        toggleAllergy(
                                                            allergy
                                                        )
                                                    }
                                                    style={{
                                                        padding:
                                                            '9px 12px',

                                                        borderRadius:
                                                            '999px',

                                                        border:
                                                            selected
                                                                ? `2px solid ${theme.primary}`
                                                                : `1px solid ${theme.border}`,

                                                        background:
                                                            selected
                                                                ? theme.primarySoft
                                                                : '#fff',

                                                        color:
                                                            selected
                                                                ? theme.primary
                                                                : theme.textDark,

                                                        fontWeight:
                                                            '600',

                                                        cursor:
                                                            'pointer'
                                                    }}
                                                >
                                                    {allergy}
                                                </button>

                                            );
                                        }
                                    )}

                                </div>

                            </div>


                            <div
                                style={{
                                    display:
                                        'grid',

                                    gridTemplateColumns:
                                        'repeat(2, minmax(0, 1fr))',

                                    gap:
                                        '12px'
                                }}
                            >

                                <div>

                                    <label
                                        style={
                                            labelStyle
                                        }
                                    >
                                        Meals Per Day
                                    </label>


                                    <select
                                        name="mealsPerDay"
                                        value={
                                            formData.mealsPerDay
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        style={
                                            getInputStyle(
                                                'mealsPerDay'
                                            )
                                        }
                                    >

                                        <option value="2">
                                            2 meals
                                        </option>

                                        <option value="3">
                                            3 meals
                                        </option>

                                        <option value="4">
                                            4 meals
                                        </option>

                                        <option value="5">
                                            5+ meals
                                        </option>

                                    </select>

                                </div>


                                <div>

                                    <label
                                        style={
                                            labelStyle
                                        }
                                    >
                                        Usual Cooking Time
                                    </label>


                                    <select
                                        name="cookingTimePreference"
                                        value={
                                            formData.cookingTimePreference
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        style={
                                            getInputStyle(
                                                'cookingTimePreference'
                                            )
                                        }
                                    >

                                        <option value="Under 15 minutes">
                                            Under 15 min
                                        </option>

                                        <option value="15-30 minutes">
                                            15–30 min
                                        </option>

                                        <option value="30-60 minutes">
                                            30–60 min
                                        </option>

                                        <option value="No Preference">
                                            No preference
                                        </option>

                                    </select>

                                </div>

                            </div>


                            <NavigationButtons
                                onBack={
                                    goBack
                                }
                                onNext={
                                    validateStep6
                                }
                                theme={
                                    theme
                                }
                                btnStyle={
                                    btnStyle
                                }
                            />

                        </>

                    )}


                    {/* =====================================
                        STEP 7 — PERSONALIZED PLAN
                    ===================================== */}

                    {step ===
                        7 && (

                        <>

                            <h3
                                style={
                                    sectionTitleStyle
                                }
                            >
                                Your Starting Plan
                            </h3>


                            <p
                                style={
                                    sectionDescriptionStyle
                                }
                            >
                                Review the estimated targets WellSmartBook will use for your dashboard, meal tracking and future recipe personalization.
                            </p>


                            {targets ? (

                                <>

                                    <div
                                        style={{
                                            display:
                                                'grid',

                                            gridTemplateColumns:
                                                'repeat(2, minmax(0, 1fr))',

                                            gap:
                                                '10px'
                                        }}
                                    >

                                        <SummaryMetric
                                            label="BMI"
                                            value={
                                                targets.bmi
                                            }
                                            helper="Current estimate"
                                        />


                                        <SummaryMetric
                                            label="BMR"
                                            value={`${targets.bmr} kcal`}
                                            helper="Estimated resting energy"
                                        />


                                        <SummaryMetric
                                            label="Daily Expenditure"
                                            value={`${targets.tdee} kcal`}
                                            helper="Estimated TDEE"
                                        />


                                        <SummaryMetric
                                            label="Calorie Target"
                                            value={`${targets.dailyCalorieTarget} kcal`}
                                            helper={
                                                formData.primaryGoal
                                            }
                                            highlight
                                        />

                                    </div>


                                    <div
                                        style={{
                                            padding:
                                                '18px',

                                            background:
                                                '#f8fafc',

                                            border:
                                                `1px solid ${theme.border}`,

                                            borderRadius:
                                                '14px'
                                        }}
                                    >

                                        <div
                                            style={{
                                                fontSize:
                                                    '12px',

                                                color:
                                                    theme.textLight,

                                                fontWeight:
                                                    '800',

                                                textTransform:
                                                    'uppercase',

                                                marginBottom:
                                                    '12px'
                                            }}
                                        >
                                            Daily Macro Targets
                                        </div>


                                        <div
                                            style={{
                                                display:
                                                    'grid',

                                                gridTemplateColumns:
                                                    'repeat(3, minmax(0, 1fr))',

                                                gap:
                                                    '10px'
                                            }}
                                        >

                                            <MacroBox
                                                label="Protein"
                                                value={`${targets.proteinTarget} g`}
                                                icon="🥩"
                                            />

                                            <MacroBox
                                                label="Carbs"
                                                value={`${targets.carbsTarget} g`}
                                                icon="🍚"
                                            />

                                            <MacroBox
                                                label="Fat"
                                                value={`${targets.fatTarget} g`}
                                                icon="🥑"
                                            />

                                        </div>

                                    </div>


                                    <div
                                        style={{
                                            padding:
                                                '16px',

                                            background:
                                                '#eff6ff',

                                            borderRadius:
                                                '12px',

                                            color:
                                                '#1e40af',

                                            fontSize:
                                                '12px',

                                            lineHeight:
                                                1.6
                                        }}
                                    >
                                        <strong>
                                            How WellSmartBook will use this:
                                        </strong>{' '}
                                        your meal scanner can compare logged calories and macros against these daily targets, while recipe recommendations can prioritize your goal, dietary preference, allergies and cooking-time preference.
                                    </div>


                                    <div
                                        style={{
                                            padding:
                                                '14px',

                                            background:
                                                '#fff7ed',

                                            border:
                                                '1px solid #fed7aa',

                                            borderRadius:
                                                '12px',

                                            color:
                                                '#9a3412',

                                            fontSize:
                                                '11px',

                                            lineHeight:
                                                1.6
                                        }}
                                    >
                                        These values are general estimates for adult users and are not medical advice. They may not be appropriate during pregnancy, breastfeeding, illness, or when following a clinician-prescribed nutrition plan.
                                    </div>

                                </>

                            ) : (

                                <div
                                    style={{
                                        padding:
                                            '20px',

                                        background:
                                            '#fee2e2',

                                        color:
                                            '#991b1b',

                                        borderRadius:
                                            '12px'
                                    }}
                                >
                                    Unable to calculate your plan. Please go back and check your profile information.
                                </div>

                            )}


                            <div
                                style={{
                                    display:
                                        'flex',

                                    gap:
                                        '12px',

                                    marginTop:
                                        '4px'
                                }}
                            >

                                <button
                                    type="button"
                                    onClick={
                                        goBack
                                    }
                                    style={{
                                        ...btnStyle,

                                        backgroundColor:
                                            theme.inputBg,

                                        color:
                                            theme.textDark,

                                        width:
                                            '30%'
                                    }}
                                >
                                    Back
                                </button>


                                <button
                                    type="submit"
                                    disabled={
                                        isSubmitting ||
                                        !targets
                                    }
                                    style={{
                                        ...btnStyle,

                                        width:
                                            '70%',

                                        opacity:
                                            isSubmitting ||
                                            !targets
                                                ? 0.65
                                                : 1
                                    }}
                                >
                                    {isSubmitting
                                        ? 'Creating Your Plan...'
                                        : 'Complete Registration'}
                                </button>

                            </div>

                        </>

                    )}

                </form>


                {step ===
                    1 && (

                    <div
                        style={{
                            textAlign:
                                'center',

                            marginTop:
                                '25px',

                            fontSize:
                                '14px',

                            color:
                                theme.textLight
                        }}
                    >
                        Already have an account?{' '}

                        <span
                            onClick={() =>
                                navigate(
                                    '/login'
                                )
                            }
                            style={{
                                color:
                                    theme.primary,

                                fontWeight:
                                    '700',

                                cursor:
                                    'pointer'
                            }}
                        >
                            Log In!
                        </span>
                    </div>

                )}

            </div>

        </div>

    );
}


// ======================================================
// REUSABLE UI COMPONENTS
// ======================================================

function NavigationButtons({
    onBack,
    onNext,
    theme,
    btnStyle
}) {

    return (

        <div
            style={{
                display:
                    'flex',

                gap:
                    '12px',

                marginTop:
                    '10px'
            }}
        >

            <button
                type="button"
                onClick={
                    onBack
                }
                style={{
                    ...btnStyle,

                    backgroundColor:
                        theme.inputBg,

                    color:
                        theme.textDark,

                    width:
                        '30%'
                }}
            >
                Back
            </button>


            <button
                type="button"
                onClick={
                    onNext
                }
                style={{
                    ...btnStyle,

                    width:
                        '70%'
                }}
            >
                Next Step
            </button>

        </div>

    );
}


function ChoiceButton({
    title,
    subtitle,
    icon,
    selected,
    onClick,
    compact = false,
    theme
}) {

    return (

        <button
            type="button"
            onClick={
                onClick
            }
            style={{
                padding:
                    compact
                        ? '11px 8px'
                        : '13px 14px',

                borderRadius:
                    '10px',

                border:
                    selected
                        ? `2px solid ${theme.primary}`
                        : `1px solid ${theme.border}`,

                background:
                    selected
                        ? theme.primarySoft
                        : '#fff',

                color:
                    selected
                        ? theme.primary
                        : theme.textDark,

                cursor:
                    'pointer',

                textAlign:
                    compact
                        ? 'center'
                        : 'left',

                fontWeight:
                    '700',

                display:
                    'flex',

                alignItems:
                    'center',

                justifyContent:
                    compact
                        ? 'center'
                        : 'flex-start',

                gap:
                    '9px'
            }}
        >

            {icon && (
                <span>
                    {icon}
                </span>
            )}


            <span>

                <span
                    style={{
                        display:
                            'block'
                    }}
                >
                    {title}
                </span>


                {subtitle && (

                    <span
                        style={{
                            display:
                                'block',

                            marginTop:
                                '3px',

                            color:
                                theme.textLight,

                            fontSize:
                                '11px',

                            fontWeight:
                                '500'
                        }}
                    >
                        {subtitle}
                    </span>

                )}

            </span>

        </button>

    );
}


function GoalCard({
    title,
    description,
    icon,
    selected,
    onClick,
    theme
}) {

    return (

        <button
            type="button"
            onClick={
                onClick
            }
            style={{
                padding:
                    '16px',

                borderRadius:
                    '12px',

                cursor:
                    'pointer',

                display:
                    'flex',

                alignItems:
                    'center',

                gap:
                    '13px',

                textAlign:
                    'left',

                backgroundColor:
                    selected
                        ? '#eff6ff'
                        : theme.inputBg,

                border:
                    selected
                        ? `2px solid ${theme.primary}`
                        : '2px solid transparent',

                color:
                    selected
                        ? theme.primary
                        : theme.textDark,

                transition:
                    '0.2s',

                width:
                    '100%'
            }}
        >

            <span
                style={{
                    fontSize:
                        '23px'
                }}
            >
                {icon}
            </span>


            <span>

                <span
                    style={{
                        display:
                            'block',

                        fontWeight:
                            '800'
                    }}
                >
                    {title}
                </span>


                <span
                    style={{
                        display:
                            'block',

                        marginTop:
                            '3px',

                        color:
                            theme.textLight,

                        fontSize:
                            '11px',

                        lineHeight:
                            1.4
                    }}
                >
                    {description}
                </span>

            </span>

        </button>

    );
}


function SummaryMetric({
    label,
    value,
    helper,
    highlight = false
}) {

    return (

        <div
            style={{
                padding:
                    '16px',

                borderRadius:
                    '13px',

                background:
                    highlight
                        ? '#eff6ff'
                        : '#f8fafc',

                border:
                    highlight
                        ? '2px solid #93c5fd'
                        : '1px solid #e2e8f0'
            }}
        >

            <div
                style={{
                    color:
                        '#64748b',

                    fontSize:
                        '11px',

                    fontWeight:
                        '800',

                    textTransform:
                        'uppercase'
                }}
            >
                {label}
            </div>


            <div
                style={{
                    marginTop:
                        '6px',

                    fontSize:
                        '23px',

                    fontWeight:
                        '900',

                    color:
                        highlight
                            ? '#0047b3'
                            : '#1e293b'
                }}
            >
                {value}
            </div>


            <div
                style={{
                    marginTop:
                        '4px',

                    color:
                        '#64748b',

                    fontSize:
                        '10px'
                }}
            >
                {helper}
            </div>

        </div>

    );
}


function MacroBox({
    icon,
    label,
    value
}) {

    return (

        <div
            style={{
                padding:
                    '13px 8px',

                textAlign:
                    'center',

                background:
                    '#fff',

                border:
                    '1px solid #e2e8f0',

                borderRadius:
                    '10px'
            }}
        >

            <div
                style={{
                    fontSize:
                        '20px'
                }}
            >
                {icon}
            </div>


            <div
                style={{
                    marginTop:
                        '5px',

                    color:
                        '#64748b',

                    fontSize:
                        '10px',

                    fontWeight:
                        '700'
                }}
            >
                {label}
            </div>


            <div
                style={{
                    marginTop:
                        '3px',

                    color:
                        '#1e293b',

                    fontWeight:
                        '900'
                }}
            >
                {value}
            </div>

        </div>

    );
}
