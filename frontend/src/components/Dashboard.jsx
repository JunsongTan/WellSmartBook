import {
    useCallback,
    useEffect,
    useMemo,
    useState
} from 'react';

import {
    useNavigate
} from 'react-router-dom';


const API_BASE_URL =
    `http://${window.location.hostname}:5000`;


// ======================================================
// DASHBOARD
// ======================================================

export default function Dashboard() {

    const navigate =
        useNavigate();


    const [
        summary,
        setSummary
    ] = useState(null);


    const [
        meals,
        setMeals
    ] = useState([]);


    const [
        loading,
        setLoading
    ] = useState(true);


    const [
        error,
        setError
    ] = useState('');


    const [
        deletingMealId,
        setDeletingMealId
    ] = useState(null);


    // ==================================================
    // LOAD DASHBOARD DATA
    // ==================================================

    const loadDashboard =
        useCallback(
            async () => {

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


                    const headers = {

                        Authorization:
                            `Bearer ${token}`

                    };


                    const [
                        summaryResponse,
                        mealsResponse
                    ] =
                        await Promise.all([

                            fetch(
                                `${API_BASE_URL}/api/daily-summary`,
                                {
                                    headers
                                }
                            ),

                            fetch(
                                `${API_BASE_URL}/api/meal-logs/today`,
                                {
                                    headers
                                }
                            )

                        ]);


                    if (
                        summaryResponse.status ===
                        401 ||
                        summaryResponse.status ===
                        403 ||
                        mealsResponse.status ===
                        401 ||
                        mealsResponse.status ===
                        403
                    ) {

                        localStorage.removeItem(
                            'token'
                        );

                        localStorage.removeItem(
                            'user'
                        );


                        navigate(
                            '/login'
                        );

                        return;
                    }


                    const summaryData =
                        await summaryResponse.json();


                    const mealsData =
                        await mealsResponse.json();


                    if (
                        !summaryResponse.ok
                    ) {

                        throw new Error(
                            summaryData.message ||
                            'Unable to load daily summary.'
                        );
                    }


                    if (
                        !mealsResponse.ok
                    ) {

                        throw new Error(
                            mealsData.message ||
                            'Unable to load today\'s meals.'
                        );
                    }


                    setSummary(
                        summaryData
                    );


                    setMeals(
                        Array.isArray(
                            mealsData.meals
                        )
                            ? mealsData.meals
                            : []
                    );


                } catch (
                    fetchError
                ) {

                    console.error(
                        'Dashboard load error:',
                        fetchError
                    );


                    setError(
                        fetchError.message ||
                        'Unable to load dashboard.'
                    );

                } finally {

                    setLoading(
                        false
                    );

                }

            },

            [
                navigate
            ]
        );


    useEffect(
        () => {

            loadDashboard();


            // Refresh dashboard after returning
            // from another tab/page.
            const handleFocus =
                () => {

                    loadDashboard();

                };


            window.addEventListener(
                'focus',
                handleFocus
            );


            return () => {

                window.removeEventListener(
                    'focus',
                    handleFocus
                );

            };

        },

        [
            loadDashboard
        ]
    );


    // ==================================================
    // DELETE A MEAL
    // ==================================================

    const deleteMeal =
        async (
            mealId
        ) => {

            const confirmed =
                window.confirm(
                    'Remove this meal from today\'s diary?'
                );


            if (!confirmed) {

                return;
            }


            const token =
                localStorage.getItem(
                    'token'
                );


            try {

                setDeletingMealId(
                    mealId
                );


                const response =
                    await fetch(

                        `${API_BASE_URL}/api/meal-logs/${mealId}`,

                        {

                            method:
                                'DELETE',

                            headers: {

                                Authorization:
                                    `Bearer ${token}`

                            }

                        }

                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        'Unable to remove meal.'
                    );
                }


                await loadDashboard();


            } catch (
                deleteError
            ) {

                alert(
                    deleteError.message
                );

            } finally {

                setDeletingMealId(
                    null
                );

            }

        };


    // ==================================================
    // DERIVED DATA
    // ==================================================

    const profile =
        summary?.profile ||
        {};


    const targets =
        summary?.targets ||
        {};


    const consumed =
        summary?.consumed ||
        {};


    const remaining =
        summary?.remaining ||
        {};


    const progress =
        summary?.progress ||
        {};


    const firstName =
        profile.fullName

            ? profile.fullName
                .trim()
                .split(' ')[0]

            : 'there';


    const calorieTarget =
        Number(
            targets.calories ||
            0
        );


    const caloriesConsumed =
        Number(
            consumed.calories ||
            0
        );


    const caloriesRemaining =
        Number(
            remaining.calories ||
            0
        );


    const caloriesOver =
        Math.max(
            0,

            caloriesConsumed -
            calorieTarget
        );


    const calorieProgress =
        Math.max(
            0,

            Number(
                progress.calories ||
                0
            )
        );


    const bmiStatus =
        useMemo(
            () => {

                const bmi =
                    Number(
                        profile.bmi
                    );


                if (
                    !Number.isFinite(
                        bmi
                    ) ||
                    bmi <=
                    0
                ) {

                    return {
                        text:
                            'Not available',

                        note:
                            'Complete your profile'
                    };
                }


                if (
                    bmi <
                    18.5
                ) {

                    return {
                        text:
                            'Below standard range',

                        note:
                            'BMI below 18.5'
                    };
                }


                if (
                    bmi <
                    25
                ) {

                    return {
                        text:
                            'Standard range',

                        note:
                            'BMI 18.5 – 24.9'
                    };
                }


                if (
                    bmi <
                    30
                ) {

                    return {
                        text:
                            'Above standard range',

                        note:
                            'BMI 25.0 – 29.9'
                    };
                }


                return {
                    text:
                        'High range',

                    note:
                        'BMI 30 or above'
                };

            },

            [
                profile.bmi
            ]
        );


    // ==================================================
    // LOADING SCREEN
    // ==================================================

    if (loading) {

        return (

            <div
                style={
                    styles.loadingPage
                }
            >

                <div
                    style={
                        styles.spinner
                    }
                />


                <p>
                    Loading your daily health overview...
                </p>

            </div>

        );

    }


    // ==================================================
    // ERROR SCREEN
    // ==================================================

    if (error) {

        return (

            <div
                style={
                    styles.errorCard
                }
            >

                <h2>
                    Unable to load dashboard
                </h2>


                <p>
                    {error}
                </p>


                <button

                    type="button"

                    onClick={
                        loadDashboard
                    }

                    style={
                        styles.primaryButton
                    }
                >
                    Try Again
                </button>

            </div>

        );

    }


    // ==================================================
    // PAGE
    // ==================================================

    return (

        <div className="dashboard-page-content">

            {/* =========================================
                PAGE HEADING
            ========================================= */}

            <section
                className="dashboard-page-heading"
                style={
                    styles.pageHeading
                }
            >

                <div>

                    <h1
                        style={
                            styles.pageTitle
                        }
                    >
                        Daily Overview
                    </h1>


                    <p
                        style={
                            styles.pageSubtitle
                        }
                    >
                        Welcome back, {firstName}. Here is your health progress for today.
                    </p>

                </div>


                <div
                    className="dashboard-goal-badge"
                    style={
                        styles.goalBadge
                    }
                >
                    🎯 {profile.primaryGoal || 'Health Goal'}
                </div>

            </section>


            {/* =========================================
                TOP GRID
            ========================================= */}

            <section
                className="dashboard-top-grid"
                style={
                    styles.topGrid
                }
            >

                {/* =====================================
                    LEFT / MAIN
                ===================================== */}

                <div
                    className="dashboard-main-column"
                    style={
                        styles.mainColumn
                    }
                >

                    {/* TOP STAT CARDS */}

                    <div
                        className="dashboard-stat-grid"
                        style={
                            styles.statGrid
                        }
                    >

                        {/* BMI */}

                        <div
                            className="dashboard-stat-card"
                            style={
                                styles.card
                            }
                        >

                            <div
                                style={
                                    styles.cardLabel
                                }
                            >
                                CURRENT BMI
                            </div>


                            <div
                                style={
                                    styles.bmiRow
                                }
                            >

                                <div>

                                    <div
                                        style={
                                            styles.bigValue
                                        }
                                    >
                                        {
                                            profile.bmi ??
                                            '--'
                                        }
                                    </div>


                                    <div
                                        style={
                                            styles.smallMuted
                                        }
                                    >
                                        BMI
                                    </div>

                                </div>


                                <div
                                    style={
                                        styles.bmiIcon
                                    }
                                >
                                    ⚖
                                </div>

                            </div>


                            <div
                                style={
                                    styles.bmiTrack
                                }
                            >

                                <div
                                    style={{
                                        ...styles.bmiFill,

                                        width:
                                            profile.bmi
                                                ? `${Math.min(
                                                    100,
                                                    (
                                                        Number(
                                                            profile.bmi
                                                        ) /
                                                        40
                                                    ) *
                                                    100
                                                )}%`
                                                : '0%'
                                    }}
                                />

                            </div>


                            <div
                                style={
                                    styles.cardFooterRow
                                }
                            >

                                <span
                                    style={
                                        styles.statusText
                                    }
                                >
                                    {bmiStatus.text}
                                </span>


                                <span
                                    style={
                                        styles.smallMuted
                                    }
                                >
                                    Target weight: {
                                        profile.targetWeight ??
                                        '--'
                                    } kg
                                </span>

                            </div>

                        </div>


                        {/* CALORIES */}

                        <div
                            className="dashboard-stat-card"
                            style={
                                styles.card
                            }
                        >

                            <div
                                style={
                                    styles.cardLabel
                                }
                            >
                                CALORIES REMAINING
                            </div>


                            <div
                                style={
                                    styles.calorieCardBody
                                }
                            >

                                <div>

                                    <div
                                        style={
                                            styles.calorieRemaining
                                        }
                                    >
                                        {
                                            caloriesOver >
                                            0
                                                ? 0
                                                : Math.round(
                                                    caloriesRemaining
                                                )
                                        }
                                        <span
                                            style={
                                                styles.kcalText
                                            }
                                        >
                                            {' '}kcal
                                        </span>
                                    </div>


                                    <div
                                        style={
                                            styles.consumedBadge
                                        }
                                    >
                                        {
                                            Math.round(
                                                caloriesConsumed
                                            )
                                        } consumed
                                    </div>

                                </div>


                                <ProgressRing
                                    percentage={
                                        calorieProgress
                                    }
                                    size={
                                        86
                                    }
                                />

                            </div>


                            {caloriesOver >
                                0 && (

                                <div
                                    style={
                                        styles.overTarget
                                    }
                                >
                                    {
                                        Math.round(
                                            caloriesOver
                                        )
                                    } kcal above today's target
                                </div>

                            )}

                        </div>

                    </div>


                    {/* =================================
                        UPLOAD / SCANNER CTA
                    ================================= */}

                    <div
                        className="dashboard-scan-card"
                        style={
                            styles.scanCard
                        }
                    >

                        <div
                            style={
                                styles.scanIcon
                            }
                        >
                            📷
                        </div>


                        <h2
                            style={
                                styles.scanTitle
                            }
                        >
                            Upload Meal Photo
                        </h2>


                        <p
                            style={
                                styles.scanDescription
                            }
                        >
                            Scan a Malaysian meal to identify the food, estimate its portion, calculate calories and track it in your daily diary.
                        </p>


                        <div
                            className="dashboard-scan-actions"
                            style={
                                styles.scanActions
                            }
                        >

                            <button

                                type="button"

                                onClick={() =>
                                    navigate(
                                        '/ai-scanner'
                                    )
                                }

                                style={
                                    styles.primaryButton
                                }
                            >
                                📷 Start Scanning
                            </button>


                            <button

                                type="button"

                                onClick={() =>
                                    navigate(
                                        '/ai-scanner'
                                    )
                                }

                                style={
                                    styles.secondaryButton
                                }
                            >
                                Open AI Scanner
                            </button>

                        </div>

                    </div>


                    {/* =================================
                        MACRO PROGRESS
                    ================================= */}

                    <div
                        className="dashboard-section-card"
                        style={
                            styles.sectionCard
                        }
                    >

                        <div
                            className="dashboard-section-heading-row"
                            style={
                                styles.sectionHeadingRow
                            }
                        >

                            <div>

                                <h2
                                    style={
                                        styles.sectionTitle
                                    }
                                >
                                    Today's Nutrition
                                </h2>


                                <p
                                    style={
                                        styles.sectionSubtitle
                                    }
                                >
                                    Daily progress based on your personalized target.
                                </p>

                            </div>


                            <div
                                style={
                                    styles.targetPill
                                }
                            >
                                Target {
                                    Math.round(
                                        calorieTarget
                                    )
                                } kcal
                            </div>

                        </div>


                        <div
                            className="dashboard-macro-grid"
                            style={
                                styles.macroGrid
                            }
                        >

                            <MacroCard

                                icon="💪"

                                name="Protein"

                                consumed={
                                    consumed.protein
                                }

                                target={
                                    targets.protein
                                }

                                percentage={
                                    progress.protein
                                }
                            />


                            <MacroCard

                                icon="🌾"

                                name="Carbs"

                                consumed={
                                    consumed.carbs
                                }

                                target={
                                    targets.carbs
                                }

                                percentage={
                                    progress.carbs
                                }
                            />


                            <MacroCard

                                icon="🥑"

                                name="Fat"

                                consumed={
                                    consumed.fat
                                }

                                target={
                                    targets.fat
                                }

                                percentage={
                                    progress.fat
                                }
                            />

                        </div>

                    </div>

                </div>


                {/* =====================================
                    RIGHT COLUMN
                ===================================== */}

                <aside
                    className="dashboard-right-column"
                    style={
                        styles.rightColumn
                    }
                >

                    {/* DAILY CALORIE SUMMARY */}

                    <div
                        className="dashboard-side-card"
                        style={
                            styles.sideCard
                        }
                    >

                        <h3
                            style={
                                styles.sideCardTitle
                            }
                        >
                            Daily Calorie Goal
                        </h3>


                        <div
                            style={
                                styles.largeRingWrap
                            }
                        >

                            <ProgressRing
                                percentage={
                                    calorieProgress
                                }

                                size={
                                    138
                                }

                                showConsumed
                            />

                        </div>


                        <div
                            style={
                                styles.calorieNumbers
                            }
                        >

                            <div>

                                <strong>
                                    {
                                        Math.round(
                                            caloriesConsumed
                                        )
                                    }
                                </strong>

                                <span>
                                    Eaten
                                </span>

                            </div>


                            <div>

                                <strong>
                                    {
                                        Math.round(
                                            calorieTarget
                                        )
                                    }
                                </strong>

                                <span>
                                    Target
                                </span>

                            </div>

                        </div>

                    </div>


                    {/* USER GOAL */}

                    <div
                        className="dashboard-plan-card"
                        style={
                            styles.goalCard
                        }
                    >

                        <div
                            style={
                                styles.goalSmallLabel
                            }
                        >
                            YOUR CURRENT PLAN
                        </div>


                        <h3
                            style={
                                styles.goalTitle
                            }
                        >
                            {
                                profile.primaryGoal ||
                                'Personalized Health Plan'
                            }
                        </h3>


                        <p
                            style={
                                styles.goalDescription
                            }
                        >
                            Current weight: {
                                profile.currentWeight ??
                                '--'
                            } kg
                            <br />

                            Target weight: {
                                profile.targetWeight ??
                                '--'
                            } kg
                        </p>


                        <button

                            type="button"

                            onClick={() =>
                                navigate(
                                    '/recipes'
                                )
                            }

                            style={
                                styles.goalButton
                            }
                        >
                            View Recommended Recipes
                        </button>

                    </div>

                </aside>

            </section>


            {/* =========================================
                TODAY'S MEALS
            ========================================= */}

            <section
                className="dashboard-section-card dashboard-meals-section"
                style={{
                    ...styles.sectionCard,

                    marginTop:
                        '22px'
                }}
            >

                <div
                    className="dashboard-section-heading-row"
                    style={
                        styles.sectionHeadingRow
                    }
                >

                    <div>

                        <h2
                            style={
                                styles.sectionTitle
                            }
                        >
                            Today's Meals
                        </h2>


                        <p
                            style={
                                styles.sectionSubtitle
                            }
                        >
                            {meals.length} meal{
                                meals.length ===
                                1
                                    ? ''
                                    : 's'
                            } logged today
                        </p>

                    </div>


                    <button

                        type="button"

                        onClick={() =>
                            navigate(
                                '/ai-scanner'
                            )
                        }

                        style={
                            styles.smallPrimaryButton
                        }
                    >
                        + Log Meal
                    </button>

                </div>


                {meals.length ===
                    0 ? (

                    <div
                        style={
                            styles.emptyMeals
                        }
                    >

                        <div
                            style={
                                styles.emptyMealsIcon
                            }
                        >
                            🍽️
                        </div>


                        <h3
                            style={{
                                margin:
                                    '10px 0 6px'
                            }}
                        >
                            No meals logged yet
                        </h3>


                        <p
                            style={
                                styles.smallMuted
                            }
                        >
                            Scan your breakfast, lunch, dinner or snack to start tracking today's nutrition.
                        </p>


                        <button

                            type="button"

                            onClick={() =>
                                navigate(
                                    '/ai-scanner'
                                )
                            }

                            style={{
                                ...styles.primaryButton,

                                marginTop:
                                    '12px'
                            }}
                        >
                            Scan First Meal
                        </button>

                    </div>

                ) : (

                    <div
                        style={
                            styles.mealList
                        }
                    >

                        {meals.map(
                            (
                                meal
                            ) => (

                                <MealRow

                                    key={
                                        meal.id
                                    }

                                    meal={
                                        meal
                                    }

                                    deleting={
                                        deletingMealId ===
                                        meal.id
                                    }

                                    onDelete={() =>
                                        deleteMeal(
                                            meal.id
                                        )
                                    }
                                />

                            )
                        )}

                    </div>

                )}

            </section>

        </div>

    );

}


// ======================================================
// PROGRESS RING
// ======================================================

function ProgressRing({

    percentage = 0,
    size = 90,
    showConsumed = false

}) {

    const safePercentage =
        Math.min(
            100,

            Math.max(
                0,
                Number(
                    percentage ||
                    0
                )
            )
        );


    const thickness =
        size >=
        120
            ? 12
            : 9;


    return (

        <div
            style={{

                width:
                    `${size}px`,

                height:
                    `${size}px`,

                borderRadius:
                    '50%',

                background:
                    `conic-gradient(
                        #1261df 0deg,
                        #1261df ${
                            safePercentage *
                            3.6
                        }deg,
                        #e5edfb ${
                            safePercentage *
                            3.6
                        }deg,
                        #e5edfb 360deg
                    )`,

                display:
                    'flex',

                alignItems:
                    'center',

                justifyContent:
                    'center',

                flexShrink:
                    0

            }}
        >

            <div
                style={{

                    width:
                        `${size - thickness * 2}px`,

                    height:
                        `${size - thickness * 2}px`,

                    borderRadius:
                        '50%',

                    background:
                        '#fff',

                    display:
                        'flex',

                    flexDirection:
                        'column',

                    alignItems:
                        'center',

                    justifyContent:
                        'center'

                }}
            >

                <strong
                    style={{

                        color:
                            '#0759d9',

                        fontSize:
                            showConsumed
                                ? '25px'
                                : '17px'

                    }}
                >
                    {
                        Math.round(
                            percentage
                        )
                    }%
                </strong>


                {showConsumed && (

                    <span
                        style={{

                            color:
                                '#94a3b8',

                            fontSize:
                                '10px',

                            marginTop:
                                '2px'

                        }}
                    >
                        consumed
                    </span>

                )}

            </div>

        </div>

    );

}


// ======================================================
// MACRO CARD
// ======================================================

function MacroCard({

    icon,
    name,
    consumed = 0,
    target = 0,
    percentage = 0

}) {

    const safeProgress =
        Math.min(
            100,

            Math.max(
                0,

                Number(
                    percentage ||
                    0
                )
            )
        );


    return (

        <div
            style={
                styles.macroCard
            }
        >

            <div
                style={
                    styles.macroHeader
                }
            >

                <div
                    style={
                        styles.macroIcon
                    }
                >
                    {icon}
                </div>


                <div>

                    <div
                        style={
                            styles.macroName
                        }
                    >
                        {name}
                    </div>


                    <div
                        style={
                            styles.macroValue
                        }
                    >
                        {
                            roundDisplay(
                                consumed
                            )
                        }
                        {' / '}
                        {
                            roundDisplay(
                                target
                            )
                        } g
                    </div>

                </div>

            </div>


            <div
                style={
                    styles.progressTrack
                }
            >

                <div
                    style={{

                        ...styles.progressFill,

                        width:
                            `${safeProgress}%`

                    }}
                />

            </div>


            <div
                style={
                    styles.macroFooter
                }
            >

                <span>
                    {
                        Math.round(
                            percentage ||
                            0
                        )
                    }% of target
                </span>


                <span>
                    {
                        roundDisplay(
                            Math.max(
                                0,

                                Number(
                                    target ||
                                    0
                                ) -
                                Number(
                                    consumed ||
                                    0
                                )
                            )
                        )
                    } g left
                </span>

            </div>

        </div>

    );

}


 // ======================================================
 // MEAL PHOTO THUMBNAIL
 //
 // Scanner photos require an authenticated request.
 // Recipe images can use their normal public URL.
 // ======================================================

function MealPhoto({ meal }) {

    const [privateImageSrc, setPrivateImageSrc] =
        useState('');

    const [photoError, setPhotoError] =
        useState(false);

    const imageUrl =
        typeof meal.imageUrl === 'string'
            ? meal.imageUrl.trim()
            : '';

    
    const isPrivatePhoto =
        imageUrl.startsWith('/api/meal-photos/') ||
        imageUrl.startsWith('/api/recipe-photos/');


    // ==============================================
    // LOAD PRIVATE SCANNER PHOTO
    // ==============================================

    useEffect(() => {

        let active = true;
        let objectUrl = null;

        const controller = new AbortController();

        setPrivateImageSrc('');
        setPhotoError(false);

        if (!isPrivatePhoto) {
            return () => controller.abort();
        }

        const token = localStorage.getItem('token');

        if (!token) {
            setPhotoError(true);
            return () => controller.abort();
        }

        async function loadPrivatePhoto() {

            try {

                const response = await fetch(
                    `${API_BASE_URL}${imageUrl}`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        },
                        signal: controller.signal
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        'Meal photo not available.'
                    );
                }

                const photoBlob =
                    await response.blob();

                if (
                    !photoBlob.type.startsWith('image/')
                ) {
                    throw new Error(
                        'Invalid image response.'
                    );
                }

                if (!active) return;

                objectUrl =
                    URL.createObjectURL(photoBlob);

                setPrivateImageSrc(objectUrl);

            } catch (error) {

                if (
                    active &&
                    error.name !== 'AbortError'
                ) {
                    setPhotoError(true);
                }
            }
        }

        void loadPrivatePhoto();

        // Release temporary browser image URL.
        return () => {

            active = false;
            controller.abort();

            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };

    }, [imageUrl, isPrivatePhoto]);

    // ==============================================
    // HANDLE RECIPE IMAGE
    // ==============================================

    const publicImage =
        /^https?:\/\//i.test(imageUrl) ||
        imageUrl.startsWith('/generated-images/')
            ? imageUrl
            : '';

    const imageSource =
        isPrivatePhoto
            ? privateImageSrc
            : publicImage;

    // ==============================================
    // DISPLAY PHOTO IF AVAILABLE
    // ==============================================

    if (imageSource && !photoError) {

        return (

            <img
                src={imageSource}

                alt={`${meal.foodName || 'Meal'} photo`}

                loading="lazy"

                onError={() =>
                    setPhotoError(true)
                }

                style={{
                    ...styles.mealTypeIcon,

                    objectFit: 'cover',

                    border:
                        '1px solid #dbe3ee'
                }}
            />

        );
    }

    // ==============================================
    // FALLBACK WHEN PHOTO IS UNAVAILABLE
    // ==============================================

    const icons = {
        breakfast: '🌅',
        lunch: '☀️',
        dinner: '🌙',
        snack: '🍎'
    };

    return (

        <div
            style={styles.mealTypeIcon}
            aria-hidden="true"
        >

            {icons[meal.mealType] || '🍽️'}

        </div>

    );
}


// ======================================================
// MEAL ROW
// ======================================================

function MealRow({

    meal,
    deleting,
    onDelete

}) {



    const mealName =
        meal.mealType

            ? meal.mealType
                .charAt(0)
                .toUpperCase() +
                meal.mealType
                    .slice(1)

            : 'Meal';


    return (

        <div
            className="dashboard-meal-row"
            style={
                styles.mealRow
            }
        >

            <div
                style={
                    styles.mealLeft
                }
            >

                
            <MealPhoto meal={meal} />



                <div>

                    <div
                        style={
                            styles.mealType
                        }
                    >
                        {mealName}
                    </div>


                    <div
                        style={
                            styles.mealFoodName
                        }
                    >
                        {meal.foodName}
                    </div>


                    <div
                        style={
                            styles.mealMacroLine
                        }
                    >
                        Protein {
                            roundDisplay(
                                meal.protein
                            )
                        } g
                        {' • '}

                        Carbs {
                            roundDisplay(
                                meal.carbs
                            )
                        } g
                        {' • '}

                        Fat {
                            roundDisplay(
                                meal.fat
                            )
                        } g

                        {meal.portionGrams &&
                            ` • ${roundDisplay(
                                meal.portionGrams
                            )} g`}
                    </div>

                </div>

            </div>


            <div
                style={
                    styles.mealRight
                }
            >

                <div
                    style={
                        styles.mealCalories
                    }
                >
                    {
                        Math.round(
                            Number(
                                meal.calories ||
                                0
                            )
                        )
                    }

                    <span>
                        {' '}kcal
                    </span>
                </div>


                <button

                    type="button"

                    disabled={
                        deleting
                    }

                    onClick={
                        onDelete
                    }

                    style={
                        styles.deleteButton
                    }
                >
                    {
                        deleting
                            ? '...'
                            : 'Remove'
                    }
                </button>

            </div>

        </div>

    );

}


// ======================================================
// DISPLAY NUMBER
// ======================================================

function roundDisplay(
    value
) {

    const number =
        Number(
            value ||
            0
        );


    return (
        Math.round(
            number *
            10
        ) /
        10
    );

}


// ======================================================
// STYLES
// ======================================================

const styles = {

    pageHeading: {

        display:
            'flex',

        justifyContent:
            'space-between',

        alignItems:
            'center',

        gap:
            '20px',

        marginBottom:
            '24px'

    },


    pageTitle: {

        margin:
            0,

        fontSize:
            '26px',

        fontWeight:
            '800',

        color:
            '#172033'

    },


    pageSubtitle: {

        margin:
            '7px 0 0',

        color:
            '#64748b',

        fontSize:
            '14px'

    },


    goalBadge: {

        padding:
            '10px 15px',

        borderRadius:
            '999px',

        background:
            '#e7f0ff',

        color:
            '#0759d9',

        fontSize:
            '12px',

        fontWeight:
            '700',

        whiteSpace:
            'nowrap'

    },


    topGrid: {

        display:
            'grid',

        gridTemplateColumns:
            'minmax(0, 1fr) 310px',

        gap:
            '22px',

        alignItems:
            'start'

    },


    mainColumn: {

        minWidth:
            0

    },


    rightColumn: {

        display:
            'flex',

        flexDirection:
            'column',

        gap:
            '20px'

    },


    statGrid: {

        display:
            'grid',

        gridTemplateColumns:
            'repeat(2, minmax(0, 1fr))',

        gap:
            '18px'

    },


    card: {

        background:
            '#ffffff',

        border:
            '1px solid #e4eaf3',

        borderRadius:
            '18px',

        padding:
            '22px',

        boxShadow:
            '0 4px 16px rgba(15, 23, 42, 0.035)'

    },


    cardLabel: {

        color:
            '#64748b',

        fontSize:
            '11px',

        fontWeight:
            '800',

        letterSpacing:
            '0.6px'

    },


    bmiRow: {

        display:
            'flex',

        alignItems:
            'center',

        justifyContent:
            'space-between',

        marginTop:
            '15px'

    },


    bigValue: {

        fontSize:
            '29px',

        fontWeight:
            '800',

        color:
            '#0759d9'

    },


    bmiIcon: {

        width:
            '42px',

        height:
            '42px',

        borderRadius:
            '12px',

        background:
            '#edf4ff',

        display:
            'flex',

        alignItems:
            'center',

        justifyContent:
            'center',

        fontSize:
            '20px'

    },


    bmiTrack: {

        height:
            '6px',

        background:
            '#e6edf8',

        borderRadius:
            '999px',

        overflow:
            'hidden',

        marginTop:
            '18px'

    },


    bmiFill: {

        height:
            '100%',

        background:
            '#14a44d',

        borderRadius:
            '999px'

    },


    cardFooterRow: {

        display:
            'flex',

        justifyContent:
            'space-between',

        alignItems:
            'center',

        gap:
            '10px',

        marginTop:
            '10px'

    },


    statusText: {

        color:
            '#159447',

        fontSize:
            '11px',

        fontWeight:
            '700'

    },


    smallMuted: {

        color:
            '#8190a5',

        fontSize:
            '11px',

        lineHeight:
            1.5

    },


    calorieCardBody: {

        display:
            'flex',

        alignItems:
            'center',

        justifyContent:
            'space-between',

        gap:
            '15px',

        marginTop:
            '13px'

    },


    calorieRemaining: {

        fontSize:
            '30px',

        color:
            '#172033',

        fontWeight:
            '800'

    },


    kcalText: {

        fontSize:
            '15px',

        color:
            '#64748b',

        fontWeight:
            '600'

    },


    consumedBadge: {

        display:
            'inline-block',

        marginTop:
            '10px',

        padding:
            '5px 10px',

        background:
            '#ecfdf3',

        color:
            '#159447',

        borderRadius:
            '999px',

        fontSize:
            '10px',

        fontWeight:
            '700'

    },


    overTarget: {

        marginTop:
            '12px',

        color:
            '#c2410c',

        fontSize:
            '11px',

        fontWeight:
            '700'

    },


    scanCard: {

        marginTop:
            '18px',

        minHeight:
            '255px',

        background:
            '#ffffff',

        border:
            '2px dashed #c9d7ed',

        borderRadius:
            '20px',

        display:
            'flex',

        flexDirection:
            'column',

        alignItems:
            'center',

        justifyContent:
            'center',

        textAlign:
            'center',

        padding:
            '30px'

    },


    scanIcon: {

        width:
            '58px',

        height:
            '58px',

        borderRadius:
            '50%',

        background:
            '#edf4ff',

        display:
            'flex',

        alignItems:
            'center',

        justifyContent:
            'center',

        fontSize:
            '25px',

        marginBottom:
            '12px'

    },


    scanTitle: {

        margin:
            0,

        fontSize:
            '21px',

        color:
            '#172033'

    },


    scanDescription: {

        maxWidth:
            '560px',

        color:
            '#69778d',

        fontSize:
            '13px',

        lineHeight:
            1.7,

        margin:
            '10px 0 20px'

    },


    scanActions: {

        display:
            'flex',

        gap:
            '12px',

        justifyContent:
            'center',

        flexWrap:
            'wrap'

    },


    primaryButton: {

        border:
            'none',

        background:
            '#0759d9',

        color:
            '#ffffff',

        borderRadius:
            '10px',

        padding:
            '12px 20px',

        cursor:
            'pointer',

        fontWeight:
            '700',

        fontSize:
            '13px'

    },


    secondaryButton: {

        border:
            '1px solid #ced8e7',

        background:
            '#ffffff',

        color:
            '#26364c',

        borderRadius:
            '10px',

        padding:
            '12px 20px',

        cursor:
            'pointer',

        fontWeight:
            '700',

        fontSize:
            '13px'

    },


    sectionCard: {

        marginTop:
            '18px',

        background:
            '#ffffff',

        border:
            '1px solid #e4eaf3',

        borderRadius:
            '18px',

        padding:
            '22px',

        boxShadow:
            '0 4px 16px rgba(15, 23, 42, 0.035)'

    },


    sectionHeadingRow: {

        display:
            'flex',

        alignItems:
            'center',

        justifyContent:
            'space-between',

        gap:
            '18px',

        marginBottom:
            '20px'

    },


    sectionTitle: {

        margin:
            0,

        fontSize:
            '18px',

        color:
            '#172033'

    },


    sectionSubtitle: {

        margin:
            '5px 0 0',

        color:
            '#7c8ba1',

        fontSize:
            '12px'

    },


    targetPill: {

        padding:
            '7px 12px',

        background:
            '#edf4ff',

        borderRadius:
            '999px',

        color:
            '#0759d9',

        fontSize:
            '11px',

        fontWeight:
            '700'

    },


    macroGrid: {

        display:
            'grid',

        gridTemplateColumns:
            'repeat(3, minmax(0, 1fr))',

        gap:
            '14px'

    },


    macroCard: {

        border:
            '1px solid #e5eaf2',

        borderRadius:
            '14px',

        padding:
            '16px',

        background:
            '#fbfcff'

    },


    macroHeader: {

        display:
            'flex',

        alignItems:
            'center',

        gap:
            '11px'

    },


    macroIcon: {

        width:
            '36px',

        height:
            '36px',

        borderRadius:
            '10px',

        background:
            '#edf4ff',

        display:
            'flex',

        alignItems:
            'center',

        justifyContent:
            'center'

    },


    macroName: {

        fontWeight:
            '700',

        fontSize:
            '13px',

        color:
            '#26364c'

    },


    macroValue: {

        marginTop:
            '3px',

        fontSize:
            '11px',

        color:
            '#7c8ba1'

    },


    progressTrack: {

        height:
            '7px',

        borderRadius:
            '999px',

        background:
            '#e6edf7',

        overflow:
            'hidden',

        marginTop:
            '15px'

    },


    progressFill: {

        height:
            '100%',

        borderRadius:
            '999px',

        background:
            '#1261df'

    },


    macroFooter: {

        display:
            'flex',

        justifyContent:
            'space-between',

        gap:
            '8px',

        color:
            '#8794a8',

        fontSize:
            '9px',

        marginTop:
            '7px'

    },


    sideCard: {

        background:
            '#ffffff',

        border:
            '1px solid #e4eaf3',

        borderRadius:
            '18px',

        padding:
            '22px',

        boxShadow:
            '0 4px 16px rgba(15, 23, 42, 0.035)'

    },


    sideCardTitle: {

        margin:
            0,

        color:
            '#172033',

        fontSize:
            '16px'
    },


    largeRingWrap: {

        display:
            'flex',

        justifyContent:
            'center',

        margin:
            '22px 0'

    },


    calorieNumbers: {

        display:
            'grid',

        gridTemplateColumns:
            '1fr 1fr',

        textAlign:
            'center',

        borderTop:
            '1px solid #edf0f5',

        paddingTop:
            '14px',

        gap:
            '10px'

    },


    goalCard: {

        borderRadius:
            '18px',

        padding:
            '22px',

        background:
            'linear-gradient(135deg, #0759d9, #0446aa)',

        color:
            '#ffffff',

        boxShadow:
            '0 7px 22px rgba(7,89,217,0.20)'

    },


    goalSmallLabel: {

        opacity:
            0.75,

        fontSize:
            '9px',

        fontWeight:
            '800',

        letterSpacing:
            '0.7px'

    },


    goalTitle: {

        margin:
            '10px 0 8px',

        fontSize:
            '20px'

    },


    goalDescription: {

        fontSize:
            '12px',

        lineHeight:
            1.65,

        opacity:
            0.9

    },


    goalButton: {

        width:
            '100%',

        marginTop:
            '12px',

        border:
            'none',

        background:
            '#ffffff',

        color:
            '#0759d9',

        borderRadius:
            '9px',

        padding:
            '10px',

        cursor:
            'pointer',

        fontWeight:
            '800',

        fontSize:
            '11px'

    },


    mealList: {

        display:
            'flex',

        flexDirection:
            'column',

        gap:
            '10px'

    },


    mealRow: {

        display:
            'flex',

        
        flexWrap:
            'wrap',


        alignItems:
            'center',

        justifyContent:
            'space-between',

        gap:
            '16px',

        padding:
            '15px 16px',

        border:
            '1px solid #e6ebf3',

        background:
            '#fbfcff',

        borderRadius:
            '13px'

    },


    mealLeft: {

        display:
            'flex',

        
        flex:
            '1 1 210px',


        alignItems:
            'center',

        gap:
            '13px',

        minWidth:
            0

    },


    mealTypeIcon: {

        width:
            '68px',

        height:
            '68px',

        borderRadius:
            '11px',

        background:
            '#edf4ff',

        display:
            'flex',

        alignItems:
            'center',

        justifyContent:
            'center',

        flexShrink:
            0

    },


    mealType: {

        color:
            '#0759d9',

        fontWeight:
            '800',

        fontSize:
            '10px',

        textTransform:
            'uppercase'

    },


    mealFoodName: {

        color:
            '#1e293b',

        fontWeight:
            '700',

        fontSize:
            '14px',

        marginTop:
            '3px'

    },


    mealMacroLine: {

        color:
            '#8794a8',

        fontSize:
            '10px',

        marginTop:
            '4px'

    },


    mealRight: {

        display:
            'flex',

        
        marginLeft:
            'auto',


        alignItems:
            'center',

        gap:
            '15px',

        flexShrink:
            0

    },


    mealCalories: {

        color:
            '#172033',

        fontWeight:
            '800',

        fontSize:
            '17px'

    },


    deleteButton: {

        border:
            'none',

        background:
            '#fff1f2',

        color:
            '#dc2626',

        padding:
            '7px 10px',

        borderRadius:
            '8px',

        cursor:
            'pointer',

        fontSize:
            '10px',

        fontWeight:
            '700'

    },


    smallPrimaryButton: {

        border:
            'none',

        background:
            '#0759d9',

        color:
            '#fff',

        padding:
            '9px 14px',

        borderRadius:
            '9px',

        cursor:
            'pointer',

        fontWeight:
            '700',

        fontSize:
            '11px'

    },


    emptyMeals: {

        textAlign:
            'center',

        padding:
            '38px 20px',

        border:
            '1px dashed #cad5e5',

        borderRadius:
            '14px',

        background:
            '#fbfcff'

    },


    emptyMealsIcon: {

        fontSize:
            '31px'

    },


    loadingPage: {

        minHeight:
            '60vh',

        display:
            'flex',

        flexDirection:
            'column',

        alignItems:
            'center',

        justifyContent:
            'center',

        color:
            '#64748b',

        fontSize:
            '13px'

    },


    spinner: {

        width:
            '35px',

        height:
            '35px',

        border:
            '4px solid #dbe7fb',

        borderTop:
            '4px solid #0759d9',

        borderRadius:
            '50%',

        marginBottom:
            '12px',

        animation:
            'spin 1s linear infinite'

    },


    errorCard: {

        padding:
            '30px',

        background:
            '#ffffff',

        border:
            '1px solid #fecaca',

        borderRadius:
            '16px',

        color:
            '#7f1d1d'

    }

};