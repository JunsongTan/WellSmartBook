import {
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';

import {
    useNavigate
} from 'react-router-dom';


const API_BASE_URL =
    `http://${window.location.hostname}:5000`;


const ACTIVITY_OPTIONS = [
    'Sedentary',
    'Lightly Active',
    'Moderately Active',
    'Very Active'
];


const DIET_OPTIONS = [
    'No Preference',
    'Halal',
    'Vegetarian',
    'Vegan',
    'Pescatarian',
    'High Protein',
    'Low Carb'
];


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


const COOKING_TIME_OPTIONS = [
    'No Preference',
    'Under 15 Minutes',
    '15-30 Minutes',
    '30-60 Minutes'
];


export default function Profile() {

    const navigate =
        useNavigate();


    const fileInputRef =
        useRef(null);


    const [
        loading,
        setLoading
    ] = useState(true);


    const [
        saving,
        setSaving
    ] = useState(false);


    const [
        uploadingImage,
        setUploadingImage
    ] = useState(false);


    const [
        changingPassword,
        setChangingPassword
    ] = useState(false);


    const [
        user,
        setUser
    ] = useState(null);


    const [
        message,
        setMessage
    ] = useState('');


    const [
        error,
        setError
    ] = useState('');


    const [
        currentPassword,
        setCurrentPassword
    ] = useState('');


    const [
        newPassword,
        setNewPassword
    ] = useState('');


    const [
        confirmPassword,
        setConfirmPassword
    ] = useState('');


    const [
        form,
        setForm
    ] = useState({
        username: '',
        fullName: '',
        email: '',
        dateOfBirth: '',
        gender: 'Male',
        height: '',
        weight: '',
        activityLevel:
            'Sedentary',
        primaryGoal:
            'Maintain Weight',
        targetWeight: '',
        goalPace:
            'Maintain',
        exerciseDaysPerWeek:
            0,
        exerciseMinutes:
            0,
        dietaryPreference:
            'No Preference',
        allergies: [],
        mealsPerDay:
            3,
        cookingTimePreference:
            'No Preference'
    });


    useEffect(
        () => {
            loadProfile();
        },
        []
    );


    async function loadProfile() {

        const token =
            localStorage.getItem(
                'token'
            );


        if (!token) {
            navigate(
                '/login'
            );

            return;
        }


        try {

            setLoading(
                true
            );

            setError(
                ''
            );


            const response =
                await fetch(
                    `${API_BASE_URL}/api/profile`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );


            const data =
                await response.json();


            if (
                response.status ===
                401 ||
                response.status ===
                403
            ) {
                logout();

                return;
            }


            if (!response.ok) {
                throw new Error(
                    data.message ||
                    'Unable to load profile.'
                );
            }


            applyUser(
                data.user
            );

        } catch (
            loadError
        ) {

            setError(
                loadError.message
            );

        } finally {

            setLoading(
                false
            );
        }
    }


    function applyUser(
        profileUser
    ) {

        setUser(
            profileUser
        );


        setForm({
            username:
                profileUser.username ||
                '',

            fullName:
                profileUser.fullName ||
                '',

            email:
                profileUser.email ||
                '',

            dateOfBirth:
                profileUser.dateOfBirth ||
                '',

            gender:
                profileUser.gender ||
                'Male',

            height:
                profileUser.height ??
                '',

            weight:
                profileUser.weight ??
                '',

            activityLevel:
                profileUser.activityLevel ||
                'Sedentary',

            primaryGoal:
                profileUser.primaryGoal ||
                'Maintain Weight',

            targetWeight:
                profileUser.targetWeight ??
                profileUser.weight ??
                '',

            goalPace:
                profileUser.goalPace ||
                'Maintain',

            exerciseDaysPerWeek:
                profileUser.exerciseDaysPerWeek ??
                0,

            exerciseMinutes:
                profileUser.exerciseMinutes ??
                0,

            dietaryPreference:
                profileUser.dietaryPreference ||
                'No Preference',

            allergies:
                Array.isArray(
                    profileUser.allergies
                )
                    ? profileUser.allergies
                    : [],

            mealsPerDay:
                profileUser.mealsPerDay ??
                3,

            cookingTimePreference:
                profileUser.cookingTimePreference ||
                'No Preference'
        });


        localStorage.setItem(
            'user',
            JSON.stringify(
                profileUser
            )
        );


        window.dispatchEvent(
            new Event(
                'profileUpdated'
            )
        );
    }


    function updateField(
        field,
        value
    ) {

        setError('');
        setMessage('');


        setForm(
            (
                current
            ) => {

                const next = {
                    ...current,
                    [field]:
                        value
                };


                if (
                    field ===
                    'primaryGoal'
                ) {

                    if (
                        value ===
                        'Maintain Weight'
                    ) {
                        next.targetWeight =
                            current.weight;

                        next.goalPace =
                            'Maintain';

                    } else if (
                        value ===
                        'Lose Weight'
                    ) {
                        next.goalPace =
                            'Gradual';

                    } else {
                        next.goalPace =
                            'Lean Gain';
                    }
                }


                if (
                    field ===
                    'weight' &&
                    current.primaryGoal ===
                    'Maintain Weight'
                ) {
                    next.targetWeight =
                        value;
                }


                return next;
            }
        );
    }


    function toggleAllergy(
        allergy
    ) {

        setForm(
            (
                current
            ) => {

                const exists =
                    current.allergies.includes(
                        allergy
                    );


                return {
                    ...current,

                    allergies:
                        exists
                            ? current.allergies.filter(
                                (
                                    item
                                ) =>
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
    }


    async function saveProfile(
        event
    ) {

        event.preventDefault();


        const token =
            localStorage.getItem(
                'token'
            );


        try {

            setSaving(
                true
            );

            setError('');
            setMessage('');


            const response =
                await fetch(
                    `${API_BASE_URL}/api/profile`,
                    {
                        method:
                            'PATCH',

                        headers: {
                            'Content-Type':
                                'application/json',

                            Authorization:
                                `Bearer ${token}`
                        },

                        body:
                            JSON.stringify({
                                username:
                                    form.username,

                                fullName:
                                    form.fullName,

                                dateOfBirth:
                                    form.dateOfBirth,

                                gender:
                                    form.gender,

                                height:
                                    Number(
                                        form.height
                                    ),

                                weight:
                                    Number(
                                        form.weight
                                    ),

                                activityLevel:
                                    form.activityLevel,

                                primaryGoal:
                                    form.primaryGoal,

                                targetWeight:
                                    form.primaryGoal ===
                                    'Maintain Weight'
                                        ? Number(
                                            form.weight
                                        )
                                        : Number(
                                            form.targetWeight
                                        ),

                                goalPace:
                                    form.goalPace,

                                exerciseDaysPerWeek:
                                    Number(
                                        form.exerciseDaysPerWeek
                                    ),

                                exerciseMinutes:
                                    Number(
                                        form.exerciseMinutes
                                    ),

                                dietaryPreference:
                                    form.dietaryPreference,

                                allergies:
                                    form.allergies,

                                mealsPerDay:
                                    Number(
                                        form.mealsPerDay
                                    ),

                                cookingTimePreference:
                                    form.cookingTimePreference
                            })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    data.message ||
                    'Unable to save profile.'
                );
            }


            applyUser(
                data.user
            );


            setMessage(
                'Profile updated successfully.'
            );

        } catch (
            saveError
        ) {

            setError(
                saveError.message
            );

        } finally {

            setSaving(
                false
            );
        }
    }


    async function uploadProfilePicture(
        file
    ) {

        if (!file) {
            return;
        }


        const token =
            localStorage.getItem(
                'token'
            );


        try {

            setUploadingImage(
                true
            );

            setError('');
            setMessage('');


            const body =
                new FormData();


            body.append(
                'image',
                file
            );


            const response =
                await fetch(
                    `${API_BASE_URL}/api/profile-picture`,
                    {
                        method:
                            'POST',

                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        },

                        body
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    data.message ||
                    'Unable to upload profile picture.'
                );
            }


            applyUser(
                data.user
            );


            setMessage(
                'Profile picture updated.'
            );

        } catch (
            uploadError
        ) {

            setError(
                uploadError.message
            );

        } finally {

            setUploadingImage(
                false
            );


            if (
                fileInputRef.current
            ) {
                fileInputRef.current.value =
                    '';
            }
        }
    }


    async function changePassword(
        event
    ) {

        event.preventDefault();


        if (
            newPassword !==
            confirmPassword
        ) {
            setError(
                'New password and confirmation do not match.'
            );

            return;
        }


        const token =
            localStorage.getItem(
                'token'
            );


        try {

            setChangingPassword(
                true
            );

            setError('');
            setMessage('');


            const response =
                await fetch(
                    `${API_BASE_URL}/api/profile/password`,
                    {
                        method:
                            'PATCH',

                        headers: {
                            'Content-Type':
                                'application/json',

                            Authorization:
                                `Bearer ${token}`
                        },

                        body:
                            JSON.stringify({
                                currentPassword,
                                newPassword
                            })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {
                throw new Error(
                    data.message ||
                    'Unable to change password.'
                );
            }


            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');


            setMessage(
                'Password changed successfully.'
            );

        } catch (
            passwordError
        ) {

            setError(
                passwordError.message
            );

        } finally {

            setChangingPassword(
                false
            );
        }
    }


    const goalPaceOptions =
        useMemo(
            () => {

                if (
                    form.primaryGoal ===
                    'Lose Weight'
                ) {
                    return [
                        'Gradual',
                        'Moderate',
                        'Faster'
                    ];
                }


                if (
                    form.primaryGoal ===
                    'Build Muscle'
                ) {
                    return [
                        'Lean Gain',
                        'Standard Gain'
                    ];
                }


                return [
                    'Maintain'
                ];
            },
            [
                form.primaryGoal
            ]
        );


    function logout() {

        localStorage.removeItem(
            'token'
        );

        localStorage.removeItem(
            'user'
        );


        navigate(
            '/login'
        );
    }


    if (loading) {

        return (
            <div className="profile-loading">
                <style>
                    {profileCss}
                </style>

                <div className="profile-spinner" />

                <p>
                    Loading profile...
                </p>
            </div>
        );
    }


    return (
        <div className="profile-page">

            <style>
                {profileCss}
            </style>


            <div className="profile-page-heading">
                <div>
                    <h1>
                        My Profile
                    </h1>

                    <p>
                        Manage your account, body information, goals and nutrition preferences.
                    </p>
                </div>
            </div>


            {message && (
                <div className="profile-message success">
                    ✓ {message}
                </div>
            )}


            {error && (
                <div className="profile-message error">
                    ⚠ {error}
                </div>
            )}


            <section className="profile-hero">

                <div className="photo-column">

                    <button
                        type="button"
                        className="large-avatar"
                        onClick={() =>
                            fileInputRef
                                .current
                                ?.click()
                        }
                    >
                        {user?.profilePicture ? (
                            <img
                                src={
                                    user.profilePicture
                                }
                                alt="Profile"
                            />
                        ) : (
                            <span>
                                {
                                    getInitials(
                                        form.fullName ||
                                        form.username
                                    )
                                }
                            </span>
                        )}
                    </button>


                    <input
                        ref={
                            fileInputRef
                        }
                        hidden
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={
                            (
                                event
                            ) =>
                                uploadProfilePicture(
                                    event.target.files?.[0]
                                )
                        }
                    />


                    <button
                        type="button"
                        className="change-photo-button"
                        disabled={
                            uploadingImage
                        }
                        onClick={() =>
                            fileInputRef
                                .current
                                ?.click()
                        }
                    >
                        {
                            uploadingImage
                                ? 'Uploading...'
                                : '📷 Change Photo'
                        }
                    </button>


                    <small>
                        JPG, PNG or WEBP · Max 5 MB
                    </small>

                </div>


                <div className="hero-profile-copy">

                    <span className="hero-eyebrow">
                        WELLSMARTBOOK MEMBER
                    </span>

                    <h2>
                        {
                            form.fullName ||
                            form.username
                        }
                    </h2>

                    <p>
                        @{form.username}
                    </p>


                    <div className="hero-pills">
                        <span>
                            🎯 {form.primaryGoal}
                        </span>

                        <span>
                            ⚡ {form.activityLevel}
                        </span>

                        <span>
                            🍽 {form.dietaryPreference}
                        </span>
                    </div>

                </div>

            </section>


            <section className="metric-grid">

                <MetricCard
                    icon="⚖️"
                    label="Current BMI"
                    value={
                        user?.bmi ??
                        '—'
                    }
                />

                <MetricCard
                    icon="🔥"
                    label="BMR"
                    value={
                        user?.bmr
                            ? Math.round(
                                user.bmr
                            )
                            : '—'
                    }
                    unit="kcal"
                />

                <MetricCard
                    icon="⚡"
                    label="Estimated Daily Expenditure"
                    value={
                        user?.tdee
                            ? Math.round(
                                user.tdee
                            )
                            : '—'
                    }
                    unit="kcal"
                />

                <MetricCard
                    icon="🎯"
                    label="Daily Calorie Target"
                    value={
                        user?.dailyCalorieTarget
                            ? Math.round(
                                user.dailyCalorieTarget
                            )
                            : '—'
                    }
                    unit="kcal"
                />

            </section>


            <div className="profile-layout">

                <form
                    className="main-profile-form"
                    onSubmit={
                        saveProfile
                    }
                >

                    <ProfileSection
                        eyebrow="ACCOUNT"
                        title="Account Information"
                        description="Basic account information displayed throughout WellSmartBook."
                    >

                        <div className="form-grid">

                            <Field label="Username">
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
                                    required
                                />
                            </Field>


                            <Field label="Full Name">
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
                                    required
                                />
                            </Field>


                            <Field
                                label="Email"
                                hint="Email is currently read-only because changing it should use OTP verification."
                            >
                                <input
                                    value={
                                        form.email
                                    }
                                    disabled
                                />
                            </Field>


                            <Field label="Role">
                                <input
                                    value={
                                        capitalize(
                                            user?.role ||
                                            'user'
                                        )
                                    }
                                    disabled
                                />
                            </Field>

                        </div>

                    </ProfileSection>


                    <ProfileSection
                        eyebrow="BODY & LIFESTYLE"
                        title="Personal Information"
                        description="Changes here recalculate BMI, BMR, TDEE and your daily nutrition targets."
                    >

                        <div className="form-grid">

                            <Field label="Date of Birth">
                                <input
                                    type="date"
                                    value={
                                        form.dateOfBirth
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'dateOfBirth',
                                                event.target.value
                                            )
                                    }
                                    required
                                />
                            </Field>


                            <Field label="Sex for Energy Calculation">
                                <select
                                    value={
                                        form.gender
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'gender',
                                                event.target.value
                                            )
                                    }
                                >
                                    <option value="Male">
                                        Male
                                    </option>

                                    <option value="Female">
                                        Female
                                    </option>
                                </select>
                            </Field>


                            <Field
                                label="Height"
                                suffix="cm"
                            >
                                <input
                                    type="number"
                                    min="100"
                                    max="250"
                                    value={
                                        form.height
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'height',
                                                event.target.value
                                            )
                                    }
                                    required
                                />
                            </Field>


                            <Field
                                label="Current Weight"
                                suffix="kg"
                            >
                                <input
                                    type="number"
                                    min="30"
                                    max="300"
                                    step="0.1"
                                    value={
                                        form.weight
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'weight',
                                                event.target.value
                                            )
                                    }
                                    required
                                />
                            </Field>


                            <Field
                                label="Activity Level"
                                wide
                            >
                                <select
                                    value={
                                        form.activityLevel
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'activityLevel',
                                                event.target.value
                                            )
                                    }
                                >
                                    {ACTIVITY_OPTIONS.map(
                                        (
                                            item
                                        ) => (
                                            <option
                                                key={
                                                    item
                                                }
                                                value={
                                                    item
                                                }
                                            >
                                                {item}
                                            </option>
                                        )
                                    )}
                                </select>
                            </Field>


                            <Field label="Exercise Days / Week">
                                <input
                                    type="number"
                                    min="0"
                                    max="7"
                                    value={
                                        form.exerciseDaysPerWeek
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'exerciseDaysPerWeek',
                                                event.target.value
                                            )
                                    }
                                />
                            </Field>


                            <Field
                                label="Exercise Duration"
                                suffix="min"
                            >
                                <input
                                    type="number"
                                    min="0"
                                    max="300"
                                    value={
                                        form.exerciseMinutes
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'exerciseMinutes',
                                                event.target.value
                                            )
                                    }
                                />
                            </Field>

                        </div>

                    </ProfileSection>


                    <ProfileSection
                        eyebrow="HEALTH GOAL"
                        title="Goal & Nutrition Plan"
                        description="Your calorie and macro targets adapt when your goal changes."
                    >

                        <div className="goal-grid">

                            {[
                                'Lose Weight',
                                'Maintain Weight',
                                'Build Muscle'
                            ].map(
                                (
                                    goal
                                ) => (
                                    <button
                                        key={
                                            goal
                                        }
                                        type="button"
                                        className={
                                            form.primaryGoal ===
                                            goal
                                                ? 'goal-card active'
                                                : 'goal-card'
                                        }
                                        onClick={() =>
                                            updateField(
                                                'primaryGoal',
                                                goal
                                            )
                                        }
                                    >
                                        <strong>
                                            {
                                                goal ===
                                                'Lose Weight'
                                                    ? '📉'
                                                    : goal ===
                                                      'Build Muscle'
                                                        ? '💪'
                                                        : '⚖️'
                                            }
                                        </strong>

                                        <span>
                                            {goal}
                                        </span>
                                    </button>
                                )
                            )}

                        </div>


                        {form.primaryGoal !==
                            'Maintain Weight' && (

                            <div className="form-grid goal-extra">

                                <Field
                                    label="Target Weight"
                                    suffix="kg"
                                >
                                    <input
                                        type="number"
                                        min="30"
                                        max="300"
                                        step="0.1"
                                        value={
                                            form.targetWeight
                                        }
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                updateField(
                                                    'targetWeight',
                                                    event.target.value
                                                )
                                        }
                                        required
                                    />
                                </Field>


                                <Field label="Goal Pace">
                                    <select
                                        value={
                                            form.goalPace
                                        }
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                updateField(
                                                    'goalPace',
                                                    event.target.value
                                                )
                                        }
                                    >
                                        {goalPaceOptions.map(
                                            (
                                                item
                                            ) => (
                                                <option
                                                    key={
                                                        item
                                                    }
                                                    value={
                                                        item
                                                    }
                                                >
                                                    {item}
                                                </option>
                                            )
                                        )}
                                    </select>
                                </Field>

                            </div>

                        )}

                    </ProfileSection>


                    <ProfileSection
                        eyebrow="FOOD PREFERENCES"
                        title="Food & Recipe Preferences"
                        description="These settings are used by your personalized recipe recommendation system."
                    >

                        <div className="form-grid">

                            <Field label="Dietary Preference">
                                <select
                                    value={
                                        form.dietaryPreference
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'dietaryPreference',
                                                event.target.value
                                            )
                                    }
                                >
                                    {DIET_OPTIONS.map(
                                        (
                                            item
                                        ) => (
                                            <option
                                                key={
                                                    item
                                                }
                                                value={
                                                    item
                                                }
                                            >
                                                {item}
                                            </option>
                                        )
                                    )}
                                </select>
                            </Field>


                            <Field label="Meals Per Day">
                                <select
                                    value={
                                        form.mealsPerDay
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'mealsPerDay',
                                                event.target.value
                                            )
                                    }
                                >
                                    {[1,2,3,4,5,6,7,8].map(
                                        (
                                            value
                                        ) => (
                                            <option
                                                key={
                                                    value
                                                }
                                                value={
                                                    value
                                                }
                                            >
                                                {value}
                                            </option>
                                        )
                                    )}
                                </select>
                            </Field>


                            <Field
                                label="Cooking Time Preference"
                                wide
                            >
                                <select
                                    value={
                                        form.cookingTimePreference
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            updateField(
                                                'cookingTimePreference',
                                                event.target.value
                                            )
                                    }
                                >
                                    {!COOKING_TIME_OPTIONS.includes(
                                        form.cookingTimePreference
                                    ) &&
                                        form.cookingTimePreference && (
                                        <option
                                            value={
                                                form.cookingTimePreference
                                            }
                                        >
                                            {
                                                form.cookingTimePreference
                                            }
                                        </option>
                                    )}

                                    {COOKING_TIME_OPTIONS.map(
                                        (
                                            item
                                        ) => (
                                            <option
                                                key={
                                                    item
                                                }
                                                value={
                                                    item
                                                }
                                            >
                                                {item}
                                            </option>
                                        )
                                    )}
                                </select>
                            </Field>

                        </div>


                        <div className="allergy-section">

                            <h3>
                                Allergies
                            </h3>

                            <p>
                                AI recipe recommendations will be instructed to avoid these allergens.
                            </p>


                            <div className="allergy-grid">

                                {ALLERGY_OPTIONS.map(
                                    (
                                        allergy
                                    ) => {

                                        const active =
                                            form.allergies.includes(
                                                allergy
                                            );


                                        return (
                                            <button
                                                type="button"
                                                key={
                                                    allergy
                                                }
                                                className={
                                                    active
                                                        ? 'allergy-button active'
                                                        : 'allergy-button'
                                                }
                                                onClick={() =>
                                                    toggleAllergy(
                                                        allergy
                                                    )
                                                }
                                            >
                                                <span>
                                                    {
                                                        active
                                                            ? '✓'
                                                            : ''
                                                    }
                                                </span>

                                                {allergy}
                                            </button>
                                        );
                                    }
                                )}

                            </div>

                        </div>

                    </ProfileSection>


                    <div className="profile-actions">

                        <button
                            type="button"
                            className="cancel-button"
                            onClick={() =>
                                navigate(
                                    '/dashboard'
                                )
                            }
                        >
                            Cancel
                        </button>


                        <button
                            type="submit"
                            className="save-button"
                            disabled={
                                saving
                            }
                        >
                            {
                                saving
                                    ? 'Saving Changes...'
                                    : '✓ Save Changes'
                            }
                        </button>

                    </div>

                </form>


                <aside className="profile-sidebar">

                    <section className="side-card">

                        <span className="side-eyebrow">
                            CURRENT PLAN
                        </span>

                        <h2>
                            Daily Targets
                        </h2>


                        <TargetRow
                            label="Calories"
                            value={`${Math.round(
                                user?.dailyCalorieTarget ||
                                0
                            )} kcal`}
                        />

                        <TargetRow
                            label="Protein"
                            value={`${roundOne(
                                user?.proteinTarget
                            )} g`}
                        />

                        <TargetRow
                            label="Carbs"
                            value={`${roundOne(
                                user?.carbsTarget
                            )} g`}
                        />

                        <TargetRow
                            label="Fat"
                            value={`${roundOne(
                                user?.fatTarget
                            )} g`}
                        />


                        <p className="side-note">
                            Saving body, activity or goal changes automatically recalculates these estimated targets.
                        </p>

                    </section>


                    <section className="side-card">

                        <span className="side-eyebrow">
                            SECURITY
                        </span>

                        <h2>
                            Change Password
                        </h2>


                        <form
                            onSubmit={
                                changePassword
                            }
                        >

                            <label className="password-label">
                                Current Password
                            </label>

                            <input
                                className="password-input"
                                type="password"
                                value={
                                    currentPassword
                                }
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setCurrentPassword(
                                            event.target.value
                                        )
                                }
                                required
                            />


                            <label className="password-label">
                                New Password
                            </label>

                            <input
                                className="password-input"
                                type="password"
                                value={
                                    newPassword
                                }
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setNewPassword(
                                            event.target.value
                                        )
                                }
                                required
                            />


                            <label className="password-label">
                                Confirm New Password
                            </label>

                            <input
                                className="password-input"
                                type="password"
                                value={
                                    confirmPassword
                                }
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setConfirmPassword(
                                            event.target.value
                                        )
                                }
                                required
                            />


                            <p className="password-help">
                                At least 8 characters, one uppercase letter and one number.
                            </p>


                            <button
                                type="submit"
                                className="password-button"
                                disabled={
                                    changingPassword
                                }
                            >
                                {
                                    changingPassword
                                        ? 'Changing...'
                                        : 'Change Password'
                                }
                            </button>

                        </form>

                    </section>

                </aside>

            </div>

        </div>
    );
}


function ProfileSection({
    eyebrow,
    title,
    description,
    children
}) {

    return (
        <section className="profile-card">

            <span className="section-eyebrow">
                {eyebrow}
            </span>

            <h2>
                {title}
            </h2>

            <p className="section-description">
                {description}
            </p>

            <div className="section-body">
                {children}
            </div>

        </section>
    );
}


function Field({
    label,
    hint,
    suffix,
    wide,
    children
}) {

    return (
        <div
            className={
                wide
                    ? 'form-field wide'
                    : 'form-field'
            }
        >

            <label>
                {label}
            </label>


            <div className="input-wrap">
                {children}

                {suffix && (
                    <span className="input-suffix">
                        {suffix}
                    </span>
                )}
            </div>


            {hint && (
                <small>
                    {hint}
                </small>
            )}

        </div>
    );
}


function MetricCard({
    icon,
    label,
    value,
    unit
}) {

    return (
        <div className="metric-card">

            <div className="metric-icon">
                {icon}
            </div>

            <div>
                <span>
                    {label}
                </span>

                <strong>
                    {value}

                    {unit && (
                        <small>
                            {' '}
                            {unit}
                        </small>
                    )}
                </strong>
            </div>

        </div>
    );
}


function TargetRow({
    label,
    value
}) {

    return (
        <div className="target-row">

            <span>
                {label}
            </span>

            <strong>
                {value}
            </strong>

        </div>
    );
}


function getInitials(
    value
) {

    return String(
        value ||
        'U'
    )
        .trim()
        .split(
            /\s+/
        )
        .slice(
            0,
            2
        )
        .map(
            (
                part
            ) =>
                part[0]
                    ?.toUpperCase()
        )
        .join('') ||
        'U';
}


function capitalize(
    value
) {

    const text =
        String(
            value ||
            ''
        );


    return text
        ? text.charAt(0)
            .toUpperCase() +
          text.slice(1)
        : '';
}


function roundOne(
    value
) {

    return (
        Math.round(
            Number(
                value ||
                0
            ) *
            10
        ) /
        10
    );
}


const profileCss = `

.profile-page {
    width: 100%;
    padding-bottom: 50px;
}

.profile-page-heading {
    margin-bottom: 20px;
}

.profile-page-heading h1 {
    margin: 0;
    color: #172033;
    font-size: 27px;
}

.profile-page-heading p {
    margin: 6px 0 0;
    color: #64748b;
    font-size: 12px;
}

.profile-message {
    margin-bottom: 14px;
    padding: 11px 14px;
    border-radius: 10px;
    font-size: 10px;
}

.profile-message.success {
    color: #15803d;
    background: #ecfdf3;
    border: 1px solid #bbf7d0;
}

.profile-message.error {
    color: #c2410c;
    background: #fff7ed;
    border: 1px solid #fed7aa;
}

.profile-hero {
    display: flex;
    align-items: center;
    gap: 25px;
    padding: 27px;
    border-radius: 20px;
    color: white;
    background:
        linear-gradient(
            135deg,
            #0759d9,
            #0648ae
        );
}

.photo-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
}

.large-avatar {
    width: 112px;
    height: 112px;
    padding: 0;
    overflow: hidden;
    border-radius: 50%;
    border: 4px solid rgba(255,255,255,.35);
    background: #dbeafe;
    color: #0759d9;
    font-size: 34px;
    font-weight: 800;
    cursor: pointer;
}

.large-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.change-photo-button {
    margin-top: 10px;
    padding: 8px 11px;
    border: 0;
    border-radius: 8px;
    background: white;
    color: #0759d9;
    font-size: 9px;
    font-weight: 800;
    cursor: pointer;
}

.photo-column small {
    margin-top: 6px;
    font-size: 7px;
    opacity: .7;
}

.hero-eyebrow {
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .8px;
    opacity: .7;
}

.hero-profile-copy h2 {
    margin: 7px 0 2px;
    font-size: 28px;
}

.hero-profile-copy > p {
    margin: 0;
    opacity: .8;
    font-size: 11px;
}

.hero-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin-top: 15px;
}

.hero-pills span {
    padding: 7px 9px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,.18);
    background: rgba(255,255,255,.14);
    font-size: 8px;
    font-weight: 700;
}

.metric-grid {
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 12px;
    margin-top: 15px;
}

.metric-card {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 15px;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: white;
}

.metric-icon {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 10px;
    background: #edf4ff;
    display: flex;
    align-items: center;
    justify-content: center;
}

.metric-card span {
    display: block;
    color: #64748b;
    font-size: 8px;
}

.metric-card strong {
    display: block;
    margin-top: 3px;
    color: #172033;
    font-size: 16px;
}

.metric-card small {
    color: #64748b;
    font-size: 8px;
}

.profile-layout {
    display: grid;
    grid-template-columns: minmax(0,1fr) 290px;
    gap: 18px;
    align-items: start;
    margin-top: 18px;
}

.main-profile-form {
    min-width: 0;
}

.profile-sidebar {
    position: sticky;
    top: 92px;
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.profile-card,
.side-card {
    padding: 21px;
    border: 1px solid #e2e8f0;
    border-radius: 17px;
    background: white;
}

.profile-card {
    margin-bottom: 16px;
}

.section-eyebrow,
.side-eyebrow {
    color: #0759d9;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .7px;
}

.profile-card h2,
.side-card h2 {
    margin: 6px 0 4px;
    color: #172033;
    font-size: 18px;
}

.section-description {
    margin: 0;
    color: #64748b;
    font-size: 9px;
}

.section-body {
    margin-top: 19px;
}

.form-grid {
    display: grid;
    grid-template-columns: repeat(2,minmax(0,1fr));
    gap: 14px;
}

.form-field.wide {
    grid-column: 1 / -1;
}

.form-field > label {
    display: block;
    margin-bottom: 6px;
    color: #334155;
    font-size: 9px;
    font-weight: 800;
}

.input-wrap {
    position: relative;
}

.form-field input,
.form-field select,
.password-input {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 11px;
    border: 1px solid #ccd7e5;
    border-radius: 9px;
    outline: none;
    background: white;
    color: #172033;
    font-size: 10px;
}

.form-field input:focus,
.form-field select:focus,
.password-input:focus {
    border-color: #0759d9;
    box-shadow: 0 0 0 3px rgba(7,89,217,.08);
}

.form-field input:disabled {
    background: #f8fafc;
    color: #94a3b8;
}

.form-field small {
    display: block;
    margin-top: 5px;
    color: #94a3b8;
    font-size: 7px;
    line-height: 1.5;
}

.input-wrap:has(.input-suffix) input {
    padding-right: 48px;
}

.input-suffix {
    position: absolute;
    top: 50%;
    right: 10px;
    transform: translateY(-50%);
    color: #94a3b8;
    font-size: 8px;
}

.goal-grid {
    display: grid;
    grid-template-columns: repeat(3,1fr);
    gap: 9px;
}

.goal-card {
    padding: 14px 8px;
    border: 1px solid #d9e1ec;
    border-radius: 11px;
    background: white;
    color: #475569;
    cursor: pointer;
}

.goal-card strong {
    display: block;
    font-size: 19px;
}

.goal-card span {
    display: block;
    margin-top: 5px;
    font-size: 9px;
    font-weight: 800;
}

.goal-card.active {
    border-color: #0759d9;
    background: #edf4ff;
    color: #0759d9;
}

.goal-extra {
    margin-top: 15px;
}

.allergy-section {
    margin-top: 18px;
}

.allergy-section h3 {
    margin: 0;
    font-size: 11px;
    color: #172033;
}

.allergy-section > p {
    margin: 4px 0 10px;
    color: #94a3b8;
    font-size: 8px;
}

.allergy-grid {
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 7px;
}

.allergy-button {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 9px;
    border: 1px solid #dde4ee;
    border-radius: 9px;
    background: #fbfcff;
    color: #475569;
    cursor: pointer;
    font-size: 8px;
}

.allergy-button > span {
    width: 15px;
    height: 15px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    display: flex;
    justify-content: center;
    align-items: center;
}

.allergy-button.active {
    border-color: #dc2626;
    background: #fff1f2;
    color: #b91c1c;
}

.allergy-button.active > span {
    border-color: #dc2626;
    background: #dc2626;
    color: white;
}

.profile-actions {
    display: flex;
    justify-content: flex-end;
    gap: 9px;
}

.save-button,
.cancel-button {
    padding: 11px 18px;
    border-radius: 9px;
    font-size: 10px;
    font-weight: 800;
    cursor: pointer;
}

.save-button {
    border: 0;
    background: #0759d9;
    color: white;
}

.cancel-button {
    border: 1px solid #cbd5e1;
    background: white;
    color: #475569;
}

.target-row {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid #edf1f5;
    font-size: 9px;
}

.target-row span {
    color: #64748b;
}

.target-row strong {
    color: #172033;
}

.side-note {
    margin: 12px 0 0;
    color: #94a3b8;
    font-size: 7px;
    line-height: 1.6;
}

.password-label {
    display: block;
    margin: 10px 0 5px;
    color: #475569;
    font-size: 8px;
    font-weight: 800;
}

.password-help {
    color: #94a3b8;
    font-size: 7px;
    line-height: 1.5;
}

.password-button {
    width: 100%;
    padding: 10px;
    border: 0;
    border-radius: 9px;
    background: #172033;
    color: white;
    font-size: 9px;
    font-weight: 800;
    cursor: pointer;
}

.profile-loading {
    min-height: 60vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    color: #64748b;
}

.profile-spinner {
    width: 35px;
    height: 35px;
    border: 4px solid #dbeafe;
    border-top-color: #0759d9;
    border-radius: 50%;
    animation: profile-spin .8s linear infinite;
}

@keyframes profile-spin {
    to {
        transform: rotate(360deg);
    }
}

@media(max-width: 1050px) {

    .profile-layout {
        grid-template-columns: 1fr;
    }

    .profile-sidebar {
        position: static;
        display: grid;
        grid-template-columns: repeat(2,1fr);
    }

    .metric-grid {
        grid-template-columns: repeat(2,1fr);
    }
}

@media(max-width: 700px) {

    .profile-hero {
        flex-direction: column;
        text-align: center;
    }

    .hero-pills {
        justify-content: center;
    }

    .metric-grid,
    .form-grid,
    .profile-sidebar,
    .goal-grid,
    .allergy-grid {
        grid-template-columns: 1fr;
    }
}

`;