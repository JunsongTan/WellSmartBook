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


export default function Recipes() {

    const navigate =
        useNavigate();


    const [
        savedRecipes,
        setSavedRecipes
    ] = useState([]);


    const [
        summary,
        setSummary
    ] = useState(null);


    const [
        profile,
        setProfile
    ] = useState(null);


    const [
        loading,
        setLoading
    ] = useState(true);


    const [
        error,
        setError
    ] = useState('');


    const [
        searchText,
        setSearchText
    ] = useState('');


    const [
        selectedFilter,
        setSelectedFilter
    ] = useState(
        'all'
    );


    const [
        deletingId,
        setDeletingId
    ] = useState(null);

    
    const [
        favouritingId,
        setFavouritingId
    ] = useState(null);



    const [
        aiRecommendations,
        setAiRecommendations
    ] = useState([]);


    const [
        generatingRecommendations,
        setGeneratingRecommendations
    ] = useState(false);


    const [
        recommendationError,
        setRecommendationError
    ] = useState('');


    const [
        recommendationContext,
        setRecommendationContext
    ] = useState(null);


    const [
        recommendationsCached,
        setRecommendationsCached
    ] = useState(false);


    const [
        preparingAiRecipeTitle,
        setPreparingAiRecipeTitle
    ] = useState('');


    // ==================================================
    // LOAD PAGE
    // ==================================================

    const loadRecipesPage =
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
                        recipesResponse,
                        summaryResponse,
                        profileResponse
                    ] =
                        await Promise.all([

                            fetch(
                                `${API_BASE_URL}/api/saved-recipes`,
                                {
                                    headers
                                }
                            ),

                            fetch(
                                `${API_BASE_URL}/api/daily-summary`,
                                {
                                    headers
                                }
                            ),

                            fetch(
                                `${API_BASE_URL}/api/profile`,
                                {
                                    headers
                                }
                            )

                        ]);


                    if (
                        [
                            recipesResponse,
                            summaryResponse,
                            profileResponse
                        ].some(
                            (
                                response
                            ) =>
                                response.status ===
                                401 ||
                                response.status ===
                                403
                        )
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


                    const recipesData =
                        await recipesResponse.json();


                    const summaryData =
                        await summaryResponse.json();


                    const profileData =
                        await profileResponse.json();


                    if (
                        !recipesResponse.ok
                    ) {

                        throw new Error(
                            recipesData.message
                        );
                    }


                    if (
                        !summaryResponse.ok
                    ) {

                        throw new Error(
                            summaryData.message
                        );
                    }


                    if (
                        !profileResponse.ok
                    ) {

                        throw new Error(
                            profileData.message
                        );
                    }


                    setSavedRecipes(

                        Array.isArray(
                            recipesData.recipes
                        )
                            ? recipesData.recipes
                            : []

                    );


                    setSummary(
                        summaryData
                    );


                    setProfile(
                        profileData.user
                    );


                } catch (
                    loadError
                ) {

                    setError(
                        loadError.message ||
                        'Unable to load recipes.'
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

            loadRecipesPage();

        },

        [
            loadRecipesPage
        ]
    );


    // ==================================================
    // DATA
    // ==================================================

    const mealPeriod =
        getMealPeriod();


    const remaining =
        summary?.remaining ||
        {};


    const targets =
        summary?.targets ||
        {};


    const consumed =
        summary?.consumed ||
        {};


    const primaryGoal =
        summary
            ?.profile
            ?.primaryGoal ||
        profile
            ?.primaryGoal ||
        'Health Goal';


    const recommendationBudget =
        useMemo(
            () =>
                calculateMealBudget({

                    remainingCalories:
                        Number(
                            remaining.calories ||
                            0
                        ),

                    dailyTarget:
                        Number(
                            targets.calories ||
                            0
                        ),

                    mealPeriod,

                    goal:
                        primaryGoal

                }),

            [
                remaining.calories,
                targets.calories,
                mealPeriod,
                primaryGoal
            ]
        );


    // ==================================================
    // FILTER SAVED RECIPES
    // ==================================================

    const filteredRecipes =
        useMemo(
            () => {

                const search =
                    searchText
                        .trim()
                        .toLowerCase();


                return savedRecipes.filter(
                    (
                        recipe
                    ) => {

                        const title =
                            String(
                                recipe.title ||
                                ''
                            )
                                .toLowerCase();


                        const description =
                            String(
                                recipe.description ||
                                ''
                            )
                                .toLowerCase();


                        const tags =
                            Array.isArray(
                                recipe.tags
                            )
                                ? recipe.tags
                                    .join(
                                        ' '
                                    )
                                    .toLowerCase()
                                : '';


                        if (
                            search &&
                            !title.includes(
                                search
                            ) &&
                            !description.includes(
                                search
                            ) &&
                            !tags.includes(
                                search
                            )
                        ) {

                            return false;
                        }

                        
                        // =================================
                        // FAVORITES ONLY FILTER
                        // =================================

                        if (
                            selectedFilter ===
                            'favourites'
                        ) {

                            return isRecipeFavourite(
                                recipe
                            );
                        }



                        const calories =
                            Number(
                                recipe
                                    .nutrition
                                    ?.calories ||
                                0
                            );


                        if (
                            selectedFilter ===
                            'light'
                        ) {

                            return calories <=
                                450;
                        }


                        if (
                            selectedFilter ===
                            'medium'
                        ) {

                            return (
                                calories >
                                450 &&
                                calories <=
                                700
                            );
                        }


                        if (
                            selectedFilter ===
                            'high'
                        ) {

                            return calories >
                                700;
                        }


                        return true;

                    }
                );

            },

            [
                savedRecipes,
                searchText,
                selectedFilter
            ]
        );


    // ==================================================
    // SMART MATCH FROM SAVED RECIPES
    // ==================================================

    const recommendedSavedRecipes =
        useMemo(
            () => {

                const center =
                    (
                        recommendationBudget.min +
                        recommendationBudget.max
                    ) /
                    2;


                return [
                    ...savedRecipes
                ]
                    .map(
                        (
                            recipe
                        ) => {

                            const calories =
                                Number(
                                    recipe
                                        .nutrition
                                        ?.calories ||
                                    0
                                );


                            const protein =
                                Number(
                                    recipe
                                        .nutrition
                                        ?.proteinGrams ||
                                    0
                                );


                            let score =
                                Math.abs(
                                    calories -
                                    center
                                );


                            if (
                                Number(
                                    remaining.protein ||
                                    0
                                ) >
                                30
                            ) {

                                score -=
                                    protein *
                                    1.5;

                            }


                            return {

                                recipe,

                                score

                            };

                        }
                    )

                    .sort(
                        (
                            a,
                            b
                        ) =>
                            a.score -
                            b.score
                    )

                    .slice(
                        0,
                        3
                    )

                    .map(
                        (
                            result
                        ) =>
                            result.recipe
                    );

            },

            [
                savedRecipes,
                recommendationBudget,
                remaining.protein
            ]
        );


    // ==================================================
    // GENERATE PERSONALIZED OPTIONS
    // ==================================================

    async function generateAiRecommendations() {

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

            setGeneratingRecommendations(
                true
            );


            setRecommendationError(
                ''
            );


            const response =
                await fetch(

                    `${API_BASE_URL}/api/recommend-recipes`,

                    {

                        method:
                            'POST',

                        headers: {

                            'Content-Type':
                                'application/json',

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
                    'Unable to generate recommendations.'
                );
            }


            setAiRecommendations(

                Array.isArray(
                    data.recipes
                )
                    ? data.recipes
                    : []

            );


            setRecommendationContext(
                data.context ||
                null
            );


            setRecommendationsCached(
                Boolean(
                    data.cached
                )
            );


        } catch (
            generateError
        ) {

            setRecommendationError(
                generateError.message
            );


        } finally {

            setGeneratingRecommendations(
                false
            );

        }

    }


    // ==================================================
    // STEP 8
    // GENERATE COMPLETE SELECTED RECIPE
    // ==================================================

    async function chooseAiRecommendation(
        recipe
    ) {

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

            setPreparingAiRecipeTitle(
                recipe.title
            );


            setRecommendationError(
                ''
            );


            sessionStorage.setItem(

                'personalizedRecipeOption',

                JSON.stringify(
                    recipe
                )

            );


            if (
                recommendationContext
            ) {

                sessionStorage.setItem(

                    'personalizedRecipeContext',

                    JSON.stringify(
                        recommendationContext
                    )

                );
            }


            const response =
                await fetch(

                    `${API_BASE_URL}/api/generate-personalized-recipe-detail`,

                    {

                        method:
                            'POST',

                        headers: {

                            'Content-Type':
                                'application/json',

                            Authorization:
                                `Bearer ${token}`

                        },

                        body:
                            JSON.stringify({

                                selectedOption:
                                    recipe

                            })

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


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    'Unable to generate the complete recipe.'
                );
            }


            sessionStorage.setItem(

                'generatedRecipe',

                JSON.stringify(
                    data.recipe
                )

            );


            sessionStorage.setItem(

                'recipeOrigin',

                'personalized-recommendation'

            );


            navigate(

                '/recipe/generated',

                {

                    state: {

                        recipe:
                            data.recipe

                    }

                }

            );


        } catch (
            generateError
        ) {

            setRecommendationError(
                generateError.message
            );


        } finally {

            setPreparingAiRecipeTitle(
                ''
            );

        }

    }


    // ==================================================
    // OPEN SAVED RECIPE
    // ==================================================

    function openRecipe(
        recipe
    ) {

        navigate(

            '/recipe/generated',

            {

                state: {

                    recipe

                }

            }

        );

    }


    // ==================================================
    // DELETE SAVED RECIPE
    // ==================================================

    async function deleteRecipe(
        recipe
    ) {

        if (
            !window.confirm(
                `Remove "${recipe.title}" from your saved recipes?`
            )
        ) {

            return;
        }


        const token =
            localStorage.getItem(
                'token'
            );


        try {

            setDeletingId(
                recipe.id
            );


            const response =
                await fetch(

                    `${API_BASE_URL}/api/saved-recipes/${recipe.id}`,

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
                    data.message
                );
            }


            setSavedRecipes(
                (
                    current
                ) =>
                    current.filter(
                        (
                            item
                        ) =>
                            item.id !==
                            recipe.id
                    )
            );


        } catch (
            deleteError
        ) {

            alert(
                deleteError.message
            );


        } finally {

            setDeletingId(
                null
            );

        }

    }

    
    async function toggleRecipeFavourite(recipe) {

        if (favouritingId !== null) return;

        const token = localStorage.getItem('token');

        if (!token) {
            navigate('/login');
            return;
        }

        const nextFavourite = !isRecipeFavourite(recipe);

        setFavouritingId(recipe.id);

        try {

            const response = await fetch(
                `${API_BASE_URL}/api/saved-recipes/${recipe.id}/favourite`,
                {
                    method: 'PATCH',

                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },

                    body: JSON.stringify({
                        isFavourite: nextFavourite
                    })
                }
            );

            const data = await response.json();

            if (
                response.status === 401 ||
                response.status === 403
            ) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                navigate('/login');
                return;
            }

            if (!response.ok || data.success !== true) {
                throw new Error(
                    data.message ||
                    'Unable to update recipe favourite.'
                );
            }

            // Update the heart icon after MySQL succeeds.
            setSavedRecipes(current =>
                current.map(item =>
                    item.id === recipe.id
                        ? {
                            ...item,
                            isFavourite: Boolean(data.isFavourite)
                        }
                        : item
                )
            );

        } catch (error) {

            alert(
                error.message ||
                'Unable to update favourite.'
            );

        } finally {

            setFavouritingId(null);

        }
    }



    if (loading) {

        return (

            <div
                className="recipes-loading"
            >

                <style>
                    {recipesCss}
                </style>


                <div
                    className="recipes-spinner"
                />


                <p>
                    Loading recipes...
                </p>

            </div>

        );

    }


    if (error) {

        return (

            <div>

                <style>
                    {recipesCss}
                </style>


                <div
                    className="recipes-error-card"
                >

                    <h2>
                        Unable to load recipes
                    </h2>


                    <p>
                        {error}
                    </p>


                    <button
                        onClick={
                            loadRecipesPage
                        }
                    >
                        Try Again
                    </button>

                </div>

            </div>

        );

    }


    return (

        <div
            className="recipes-page"
        >

            <style>
                {recipesCss}
            </style>


            {/* HEADER */}

            <section
                className="recipes-header"
            >

                <div>

                    <h1>
                        Recipes
                    </h1>


                    <p>
                        Personalized recipes based on your goal and today's nutrition.
                    </p>

                </div>


                <button

                    className="scan-ingredients-button"

                    onClick={() =>
                        navigate(
                            '/ai-scanner'
                        )
                    }
                >
                    📷 Scan Ingredients
                </button>

            </section>


            {/* TODAY */}

            <section
                className="today-recommendation-hero"
            >

                <div>

                    <span
                        className="hero-small-label"
                    >
                        PERSONALIZED FOR TODAY
                    </span>


                    <h2>
                        {
                            capitalize(
                                mealPeriod
                            )
                        } recommendations
                    </h2>


                    <p>
                        Based on your <strong>{primaryGoal}</strong> goal and everything you have eaten today.
                    </p>


                    <div
                        className="recommendation-budget"
                    >

                        <BudgetBox
                            label="Suggested meal"
                            value={`${Math.round(
                                recommendationBudget.min
                            )} – ${Math.round(
                                recommendationBudget.max
                            )} kcal`}
                        />


                        <BudgetBox
                            label="Calories remaining"
                            value={`${Math.round(
                                Number(
                                    remaining.calories ||
                                    0
                                )
                            )} kcal`}
                        />


                        <BudgetBox
                            label="Diet preference"
                            value={
                                profile
                                    ?.dietaryPreference ||
                                'No Preference'
                            }
                        />

                    </div>

                </div>


                <div
                    className="remaining-grid"
                >

                    <RemainingMacro
                        icon="💪"
                        label="Protein left"
                        value={
                            remaining.protein
                        }
                    />


                    <RemainingMacro
                        icon="🌾"
                        label="Carbs left"
                        value={
                            remaining.carbs
                        }
                    />


                    <RemainingMacro
                        icon="🥑"
                        label="Fat left"
                        value={
                            remaining.fat
                        }
                    />

                </div>

            </section>


            {/* DAILY PROGRESS */}

            <section
                className="today-progress-strip"
            >

                <div>

                    <span>
                        Consumed
                    </span>

                    <strong>
                        {
                            Math.round(
                                Number(
                                    consumed.calories ||
                                    0
                                )
                            )
                        } kcal
                    </strong>

                </div>


                <div
                    className="progress-middle"
                >

                    <div
                        className="daily-progress-track"
                    >

                        <div
                            style={{

                                width:
                                    `${Math.min(
                                        100,

                                        Number(
                                            targets.calories ||
                                            0
                                        ) >
                                        0

                                            ? (
                                                Number(
                                                    consumed.calories ||
                                                    0
                                                ) /
                                                Number(
                                                    targets.calories
                                                )
                                            ) *
                                            100

                                            : 0
                                    )}%`

                            }}
                        />

                    </div>


                    <span>
                        {
                            Math.round(
                                Number(
                                    targets.calories ||
                                    0
                                )
                            )
                        } kcal daily target
                    </span>

                </div>


                <div>

                    <span>
                        Remaining
                    </span>

                    <strong
                        className="remaining-number"
                    >
                        {
                            Math.round(
                                Number(
                                    remaining.calories ||
                                    0
                                )
                            )
                        } kcal
                    </strong>

                </div>

            </section>


            {/* SMART SAVED RECIPES */}

            <section
                className="recipe-section"
            >

                <div
                    className="section-heading"
                >

                    <div>

                        <span>
                            SMART MATCH
                        </span>

                        <h2>
                            Best Fit From Your Recipes
                        </h2>

                        <p>
                            Saved recipes ranked against your remaining nutrition.
                        </p>

                    </div>


                    <div
                        className="badge"
                    >
                        ✓ No Gemini needed
                    </div>

                </div>


                {recommendedSavedRecipes.length >
                    0 ? (

                    <div
                        className="recipe-grid"
                    >

                        {recommendedSavedRecipes.map(
                            (
                                recipe,
                                index
                            ) => (

                                <SavedMatchCard

                                    key={
                                        recipe.id
                                    }

                                    recipe={
                                        recipe
                                    }

                                    rank={
                                        index +
                                        1
                                    }

                                    onOpen={() =>
                                        openRecipe(
                                            recipe
                                        )
                                    }
                                />

                            )
                        )}

                    </div>

                ) : (

                    <EmptyState

                        title="No saved recipes yet"

                        text="Generate a recipe from the ingredient scanner and save it first."

                        button="Scan Ingredients"

                        onClick={() =>
                            navigate(
                                '/ai-scanner'
                            )
                        }

                    />

                )}

            </section>


            {/* GEMINI */}

            <section
                className="ai-section"
            >

                <div
                    className="ai-heading"
                >

                    <div
                        className="gemini-icon"
                    >
                        ✨
                    </div>


                    <div>

                        <span>
                            GEMINI PERSONALIZATION
                        </span>


                        <h2>
                            Generate something new for {mealPeriod}
                        </h2>


                        <p>
                            Recommendations adapt to your remaining calories, macros, dietary preference, allergies and goal.
                        </p>

                    </div>


                    <button

                        disabled={
                            generatingRecommendations
                        }

                        onClick={
                            generateAiRecommendations
                        }
                    >
                        {
                            generatingRecommendations
                                ? 'Generating...'
                                : '✨ Generate Recommendations'
                        }
                    </button>

                </div>


                {recommendationError && (

                    <div
                        className="ai-error"
                    >
                        ⚠ {recommendationError}
                    </div>

                )}


                {recommendationsCached &&
                    aiRecommendations.length >
                    0 && (

                    <div
                        className="cache-message"
                    >
                        ✓ Loaded from the recent recommendation cache.
                    </div>

                )}


                {recommendationContext && (

                    <div
                        className="context-pills"
                    >

                        <span>
                            🍽 {
                                capitalize(
                                    recommendationContext.mealPeriod
                                )
                            }
                        </span>


                        <span>
                            🔥 {
                                Math.round(
                                    recommendationContext
                                        .caloriesRemaining
                                )
                            } kcal left
                        </span>


                        <span>
                            💪 {
                                roundOne(
                                    recommendationContext
                                        .proteinRemaining
                                )
                            }g protein left
                        </span>


                        <span>
                            Recommended {
                                Math.round(
                                    recommendationContext
                                        .recommendedCalories
                                        .min
                                )
                            }
                            {' – '}
                            {
                                Math.round(
                                    recommendationContext
                                        .recommendedCalories
                                        .max
                                )
                            } kcal
                        </span>

                    </div>

                )}


                {aiRecommendations.length >
                    0 && (

                    <div
                        className="ai-grid"
                    >

                        {aiRecommendations.map(
                            (
                                recipe,
                                index
                            ) => (

                                <article
                                    key={`${recipe.title}-${index}`}
                                    className="ai-card"
                                >

                                    <div
                                        className="ai-number"
                                    >
                                        {
                                            index +
                                            1
                                        }
                                    </div>


                                    <span
                                        className="ai-label"
                                    >
                                        AI RECOMMENDATION
                                    </span>


                                    <h3>
                                        {recipe.title}
                                    </h3>


                                    <p>
                                        {recipe.description}
                                    </p>


                                    <div
                                        className="match-reason"
                                    >

                                        <strong>
                                            Why it fits today
                                        </strong>

                                        <span>
                                            {
                                                recipe.matchReason
                                            }
                                        </span>

                                    </div>


                                    <div
                                        className="nutrition-grid"
                                    >

                                        <NutritionBox
                                            label="Calories"
                                            value={`${Math.round(
                                                recipe.estimatedCalories ||
                                                0
                                            )}`}
                                        />


                                        <NutritionBox
                                            label="Protein"
                                            value={`${roundOne(
                                                recipe.estimatedProteinGrams
                                            )}g`}
                                        />


                                        <NutritionBox
                                            label="Carbs"
                                            value={`${roundOne(
                                                recipe.estimatedCarbsGrams
                                            )}g`}
                                        />


                                        <NutritionBox
                                            label="Fat"
                                            value={`${roundOne(
                                                recipe.estimatedFatGrams
                                            )}g`}
                                        />

                                    </div>


                                    <div
                                        className="ai-meta"
                                    >

                                        <span>
                                            ⏱ {
                                                Number(
                                                    recipe.prepTimeMinutes ||
                                                    0
                                                ) +
                                                Number(
                                                    recipe.cookTimeMinutes ||
                                                    0
                                                )
                                            } min
                                        </span>


                                        <span>
                                            🍳 {
                                                recipe.cookingStyle
                                            }
                                        </span>

                                    </div>


                                    <div
                                        className="tags"
                                    >

                                        {(
                                            recipe.tags ||
                                            []
                                        )
                                            .slice(
                                                0,
                                                4
                                            )
                                            .map(
                                                (
                                                    tag,
                                                    tagIndex
                                                ) => (

                                                    <span
                                                        key={`${tag}-${tagIndex}`}
                                                    >
                                                        {tag}
                                                    </span>

                                                )
                                            )}

                                    </div>


                                    <button

                                        className="generate-detail-button"

                                        disabled={
                                            Boolean(
                                                preparingAiRecipeTitle
                                            )
                                        }

                                        onClick={() =>
                                            chooseAiRecommendation(
                                                recipe
                                            )
                                        }
                                    >

                                        {
                                            preparingAiRecipeTitle ===
                                            recipe.title

                                                ? '✨ Preparing Full Recipe...'

                                                : preparingAiRecipeTitle

                                                    ? 'Please Wait...'

                                                    : 'Choose & Generate Recipe →'
                                        }

                                    </button>

                                </article>

                            )
                        )}

                    </div>

                )}

            </section>


            {/* SAVED RECIPES */}

            <section
                className="recipe-section"
            >

                <div
                    className="section-heading"
                >

                    <div>

                        <span>
                            YOUR COLLECTION
                        </span>

                        <h2>
                            Saved Recipes
                        </h2>

                        <p>
                            Recipes saved from your cooking guides.
                        </p>

                    </div>


                    <div
                        className="badge"
                    >
                        {
                            savedRecipes.length
                        } saved
                    </div>

                </div>


                <div
                    className="controls"
                >

                    <input

                        value={
                            searchText
                        }

                        onChange={
                            (
                                event
                            ) =>
                                setSearchText(
                                    event.target.value
                                )
                        }

                        placeholder="🔎 Search recipes..."
                    />


                    <div
                        className="filters"
                    >

                        {[
                            ['all', 'All'],
                            ['light', '≤ 450 kcal'],
                            ['medium', '451–700 kcal'],
                            ['high', '700+ kcal'],
                            ['favourites', '♥ Favorites']
                        ].map(
                            (
                                [
                                    value,
                                    label
                                ]
                            ) => (

                                <button

                                    key={
                                        value
                                    }

                                    className={
                                        selectedFilter ===
                                        value
                                            ? 'active'
                                            : ''
                                    }

                                    onClick={() =>
                                        setSelectedFilter(
                                            value
                                        )
                                    }
                                >
                                    {label}
                                </button>

                            )
                        )}

                    </div>

                </div>


                {filteredRecipes.length >
                    0 ? (

                    <div
                        className="recipe-grid"
                    >

                        {filteredRecipes.map(
                            (
                                recipe
                            ) => (

                                <SavedRecipeCard

                                    key={
                                        recipe.id
                                    }

                                    recipe={
                                        recipe
                                    }
                                    
                                    favouriting={
                                        favouritingId === recipe.id
                                    }

                                    onToggleFavourite={() =>
                                        toggleRecipeFavourite(recipe)
                                    }


                                    deleting={
                                        deletingId ===
                                        recipe.id
                                    }

                                    onOpen={() =>
                                        openRecipe(
                                            recipe
                                        )
                                    }

                                    onDelete={() =>
                                        deleteRecipe(
                                            recipe
                                        )
                                    }
                                />

                            )
                        )}

                    </div>

                ) : (

                    
                    <EmptyState

                        title={
                            selectedFilter === 'favourites'
                                ? 'No favorite recipes found'
                                : 'No recipes found'
                        }

                        text={
                            savedRecipes.length === 0
                                ? 'Select a Gemini recipe to save it automatically.'
                                : selectedFilter === 'favourites'
                                    ? searchText.trim()
                                        ? 'No favorites match your search. Try a different search.'
                                        : 'Click the ♡ on a saved recipe to add it to Favorites.'
                                    : 'Try changing the search or calorie filter.'
                        }

                    />


                )}

            </section>

        </div>

    );

}


// ======================================================
// SMALL COMPONENTS
// ======================================================

function BudgetBox({
    label,
    value
}) {

    return (

        <div>

            <span>
                {label}
            </span>

            <strong>
                {value}
            </strong>

        </div>

    );

}


function RemainingMacro({
    icon,
    label,
    value
}) {

    return (

        <div>

            <b>
                {icon}
            </b>

            <span>
                {label}
            </span>

            <strong>
                {
                    roundOne(
                        value
                    )
                }g
            </strong>

        </div>

    );

}


function NutritionBox({
    label,
    value
}) {

    return (

        <div>

            <span>
                {label}
            </span>

            <strong>
                {value}
            </strong>

        </div>

    );

}


function SavedMatchCard({
    recipe,
    rank,
    onOpen
}) {

    return (

        <article
            className="saved-card"
        >

            <RecipeImage
                recipe={
                    recipe
                }
            />


            <div
                className="saved-body"
            >

                <span
                    className="match-rank"
                >
                    #{rank} Smart Match
                </span>


                <h3>
                    {recipe.title}
                </h3>


                <p>
                    {recipe.description}
                </p>


                <div
                    className="saved-meta"
                >

                    <span>
                        🔥 {
                            Math.round(
                                recipe
                                    ?.nutrition
                                    ?.calories ||
                                0
                            )
                        } kcal
                    </span>


                    <span>
                        💪 {
                            roundOne(
                                recipe
                                    ?.nutrition
                                    ?.proteinGrams
                            )
                        }g
                    </span>

                </div>


                <button
                    onClick={
                        onOpen
                    }
                >
                    View Recipe →
                </button>

            </div>

        </article>

    );

}


function SavedRecipeCard({

    recipe,
    deleting,
    favouriting,
    onToggleFavourite,
    onOpen,
    onDelete

}) {

    return (

        <article
            className="saved-card"
        >

            <div
                className="image-wrapper"
            >

                <RecipeImage
                    recipe={
                        recipe
                    }
                />


                
            <div className="recipe-card-actions">

                {/* ADD / REMOVE FAVOURITE */}

                <button
                    type="button"

                    className={
                        isRecipeFavourite(recipe)
                            ? 'favourite-button active'
                            : 'favourite-button'
                    }

                    title={
                        isRecipeFavourite(recipe)
                            ? 'Remove from favourites'
                            : 'Add to favourites'
                    }

                    aria-label={
                        isRecipeFavourite(recipe)
                            ? `Remove ${recipe.title} from favourites`
                            : `Add ${recipe.title} to favourites`
                    }

                    aria-pressed={isRecipeFavourite(recipe)}

                    disabled={favouriting || deleting}

                    onClick={onToggleFavourite}
                >

                    {favouriting
                        ? '…'
                        : isRecipeFavourite(recipe)
                            ? '♥'
                            : '♡'}

                </button>

                {/* DELETE RECIPE SEPARATELY */}

                <button
                    type="button"

                    className="remove-button"

                    title="Delete saved recipe"

                    aria-label={`Delete ${recipe.title}`}

                    disabled={deleting || favouriting}

                    onClick={onDelete}
                >

                    {deleting ? '…' : '🗑'}

                </button>

            </div>


            </div>


            <div
                className="saved-body"
            >

                <div
                    className="tags"
                >

                    {(
                        recipe.tags ||
                        []
                    )
                        .slice(
                            0,
                            2
                        )
                        .map(
                            (
                                tag,
                                index
                            ) => (

                                <span
                                    key={`${tag}-${index}`}
                                >
                                    {tag}
                                </span>

                            )
                        )}

                </div>


                <h3>
                    {recipe.title}
                </h3>


                <p>
                    {recipe.description}
                </p>


                <div
                    className="saved-meta"
                >

                    <span>
                        🔥 {
                            Math.round(
                                recipe
                                    ?.nutrition
                                    ?.calories ||
                                0
                            )
                        } kcal
                    </span>


                    <span>
                        ⏱ {
                            Number(
                                recipe.prepTimeMinutes ||
                                0
                            ) +
                            Number(
                                recipe.cookTimeMinutes ||
                                0
                            )
                        } min
                    </span>

                </div>


                <button
                    onClick={
                        onOpen
                    }
                >
                    Cook This Recipe
                </button>

            </div>

        </article>

    );

}



// =====================================================
// RECIPE IMAGE COMPONENT
//
// Supports:
// 1. Private uploaded recipe photos
// 2. Public generated recipe photos
// 3. Placeholder when no photo exists
// =====================================================

function RecipeImage({ recipe }) {

    const [privateSrc, setPrivateSrc] =
        useState('');

    const [failed, setFailed] =
        useState(false);

    const imageUrl =
        typeof recipe?.imageUrl === 'string'
            ? recipe.imageUrl.trim()
            : '';

    const isPrivatePhoto =
        imageUrl.startsWith(
            '/api/recipe-photos/'
        );

    // ==============================================
    // LOAD PRIVATE RECIPE PHOTO
    // ==============================================

    useEffect(() => {

        let active = true;
        let objectUrl = null;

        const controller = new AbortController();

        setPrivateSrc('');
        setFailed(false);

        if (isPrivatePhoto) {

            const token =
                localStorage.getItem('token');

            if (!token) {

                setFailed(true);

            } else {

                async function loadPhoto() {

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
                                'Recipe photo unavailable.'
                            );
                        }

                        const blob =
                            await response.blob();

                        if (!blob.type.startsWith('image/')) {

                            throw new Error(
                                'Invalid image response.'
                            );
                        }

                        if (!active) return;

                        objectUrl =
                            URL.createObjectURL(blob);

                        setPrivateSrc(objectUrl);

                    } catch (error) {

                        if (
                            active &&
                            error.name !== 'AbortError'
                        ) {

                            setFailed(true);
                        }
                    }
                }

                void loadPhoto();
            }
        }

        // ==========================================
        // CLEAN UP IMAGE WHEN COMPONENT UNMOUNTS
        // ==========================================

        return () => {

            active = false;

            controller.abort();

            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };

    }, [imageUrl, isPrivatePhoto]);

    // ==============================================
    // HANDLE PUBLIC IMAGE URLS
    // ==============================================

    const publicSrc =
        /^https?:\/\//i.test(imageUrl)
            ? imageUrl
            : imageUrl.startsWith(
                '/generated-images/'
            )
                ? `${API_BASE_URL}${imageUrl}`
                : '';

    const src =
        isPrivatePhoto
            ? privateSrc
            : publicSrc;

    // ==============================================
    // DISPLAY IMAGE
    // ==============================================

    if (src && !failed) {

        return (

            <img
                className="recipe-image"

                src={src}

                alt={
                    recipe?.title ||
                    'Saved recipe'
                }

                loading="lazy"

                onError={() =>
                    setFailed(true)
                }
            />

        );
    }

    // ==============================================
    // FALLBACK IF NO IMAGE OR IMAGE FAILED
    // ==============================================

    return (

        <div
            className="recipe-placeholder"
            aria-label="Recipe photo unavailable"
        >
            🍲
        </div>

    );
}



function EmptyState({

    title,
    text,
    button,
    onClick

}) {

    return (

        <div
            className="empty-state"
        >

            <div>
                🍲
            </div>

            <h3>
                {title}
            </h3>

            <p>
                {text}
            </p>


            {button && (

                <button
                    onClick={
                        onClick
                    }
                >
                    {button}
                </button>

            )}

        </div>

    );

}


function isRecipeFavourite(recipe) {

    const value =
        recipe?.isFavourite ??
        recipe?.isFavorite ??
        recipe?.is_favourite;

    return (
        value === true ||
        value === 1 ||
        value === '1'
    );
}



// ======================================================
// HELPERS
// ======================================================

function getMealPeriod() {

    const hour =
        new Date()
            .getHours();


    if (
        hour >=
        5 &&
        hour <
        11
    ) {
        return 'breakfast';
    }


    if (
        hour >=
        11 &&
        hour <
        16
    ) {
        return 'lunch';
    }


    if (
        hour >=
        16 &&
        hour <
        22
    ) {
        return 'dinner';
    }


    return 'snack';

}


function calculateMealBudget({

    remainingCalories,
    dailyTarget,
    mealPeriod,
    goal

}) {

    const remaining =
        Math.max(
            0,
            remainingCalories
        );


    if (
        remaining <=
        0
    ) {

        return {
            min:
                0,
            max:
                200
        };
    }


    let amount;


    if (
        mealPeriod ===
        'breakfast'
    ) {
        amount =
            remaining *
            0.30;

    } else if (
        mealPeriod ===
        'lunch'
    ) {
        amount =
            remaining *
            0.45;

    } else if (
        mealPeriod ===
        'dinner'
    ) {
        amount =
            remaining *
            0.70;

    } else {
        amount =
            remaining *
            0.25;
    }


    if (
        goal ===
        'Lose Weight'
    ) {
        amount *=
            0.95;
    }


    if (
        goal ===
        'Build Muscle'
    ) {
        amount *=
            1.05;
    }


    let minimum =
        dailyTarget *
        (
            mealPeriod ===
            'snack'
                ? 0.05
                : 0.15
        );


    amount =
        Math.max(
            minimum,
            amount
        );


    amount =
        Math.min(
            remaining,
            amount
        );


    const min =
        Math.min(
            remaining,
            amount *
            0.8
        );


    const max =
        Math.min(
            remaining,
            amount *
            1.2
        );


    return {

        min:
            roundOne(
                min
            ),

        max:
            roundOne(
                Math.max(
                    min,
                    max
                )
            )

    };

}


function capitalize(
    value
) {

    return String(
        value ||
        ''
    )
        .charAt(0)
        .toUpperCase() +
        String(
            value ||
            ''
        )
            .slice(1);

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


// ======================================================
// CSS
// ======================================================

const recipesCss = `

.recipes-page {
    padding-bottom: 50px;
}

.recipes-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    margin-bottom: 22px;
}

.recipes-header h1 {
    margin: 0;
    font-size: 27px;
    color: #172033;
}

.recipes-header p {
    margin: 6px 0 0;
    color: #64748b;
    font-size: 13px;
}

.scan-ingredients-button {
    border: 0;
    background: #0759d9;
    color: white;
    padding: 11px 17px;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 800;
}

.today-recommendation-hero {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 25px;
    background: linear-gradient(135deg,#0759d9,#0645a8);
    color: white;
    border-radius: 20px;
    padding: 26px;
}

.hero-small-label,
.section-heading > div > span,
.ai-heading > div:nth-child(2) > span {
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .7px;
}

.today-recommendation-hero h2 {
    margin: 7px 0;
}

.today-recommendation-hero p {
    font-size: 11px;
    opacity: .85;
}

.recommendation-budget {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
    margin-top: 18px;
}

.recommendation-budget > div {
    background: rgba(255,255,255,.13);
    padding: 10px 13px;
    border-radius: 10px;
    min-width: 140px;
}

.recommendation-budget span,
.remaining-grid span {
    display: block;
    font-size: 8px;
    opacity: .7;
}

.recommendation-budget strong,
.remaining-grid strong {
    display: block;
    margin-top: 4px;
    font-size: 13px;
}

.remaining-grid {
    display: grid;
    grid-template-columns: repeat(3,110px);
    gap: 7px;
}

.remaining-grid > div {
    background: rgba(255,255,255,.13);
    padding: 13px;
    border-radius: 12px;
    text-align: center;
}

.remaining-grid b {
    display: block;
    margin-bottom: 5px;
}

.today-progress-strip {
    margin-top: 14px;
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 20px;
    padding: 14px 18px;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
}

.today-progress-strip span {
    display: block;
    color: #64748b;
    font-size: 8px;
}

.today-progress-strip strong {
    display: block;
    margin-top: 3px;
}

.remaining-number {
    color: #0759d9;
}

.daily-progress-track {
    height: 8px;
    background: #e7edf7;
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: 5px;
}

.daily-progress-track div {
    height: 100%;
    background: #0759d9;
}

.recipe-section,
.ai-section {
    margin-top: 22px;
    padding: 22px;
    border-radius: 18px;
}

.recipe-section {
    background: white;
    border: 1px solid #e2e8f0;
}

.ai-section {
    background: linear-gradient(135deg,#faf5ff,#eff6ff);
    border: 1px solid #ddd6fe;
}

.section-heading {
    display: flex;
    justify-content: space-between;
    gap: 15px;
}

.section-heading h2,
.ai-heading h2 {
    margin: 5px 0;
    font-size: 19px;
    color: #172033;
}

.section-heading p,
.ai-heading p {
    margin: 0;
    color: #64748b;
    font-size: 10px;
}

.badge {
    background: #edf4ff;
    color: #0759d9;
    padding: 7px 10px;
    height: fit-content;
    border-radius: 999px;
    font-size: 8px;
    font-weight: 800;
}

.recipe-grid,
.ai-grid {
    margin-top: 18px;
    display: grid;
    grid-template-columns: repeat(3,1fr);
    gap: 14px;
}

.saved-card,
.ai-card {
    border: 1px solid #e2e8f0;
    border-radius: 15px;
    overflow: hidden;
    background: #fbfcff;
}

.recipe-image,
.recipe-placeholder {
    width: 100%;
    height: 165px;
}

.recipe-image {
    object-fit: cover;
    display: block;
}

.recipe-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #edf2f8;
    font-size: 45px;
}

.image-wrapper {
    position: relative;
}


.recipe-card-actions {
    position: absolute;
    top: 9px;
    right: 9px;
    display: flex;
    align-items: center;
    gap: 7px;
}

.favourite-button,
.remove-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    border: 1px solid #dbe3ee;
    background: #ffffff;
    border-radius: 50%;
    cursor: pointer;
    font-size: 19px;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.09);
}

.favourite-button {
    color: #dc2626;
}

.favourite-button.active {
    background: #fff1f2;
    border-color: #fecdd3;
}

.remove-button {
    color: #b42338;
    font-size: 15px;
}

.favourite-button:disabled,
.remove-button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.favourite-button:focus-visible,
.remove-button:focus-visible {
    outline: 2px solid #0759d9;
    outline-offset: 2px;
}


.saved-body,
.ai-card {
    padding: 15px;
}

.saved-card .saved-body h3,
.ai-card h3 {
    color: #172033;
    font-size: 14px;
    margin: 8px 0;
}

.saved-body p,
.ai-card > p {
    color: #64748b;
    font-size: 9px;
    line-height: 1.55;
    min-height: 40px;
}

.match-rank {
    color: #0759d9;
    font-size: 8px;
    font-weight: 800;
}

.saved-meta,
.ai-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin: 10px 0;
    color: #64748b;
    font-size: 8px;
}

.saved-body > button,
.generate-detail-button {
    width: 100%;
    padding: 10px;
    border: 0;
    border-radius: 9px;
    background: #0759d9;
    color: white;
    font-size: 9px;
    font-weight: 800;
    cursor: pointer;
}

.ai-heading {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 13px;
    align-items: center;
}

.gemini-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: white;
    display: flex;
    align-items: center;
    justify-content: center;
}

.ai-heading > button {
    border: 0;
    border-radius: 10px;
    padding: 11px 14px;
    background: linear-gradient(135deg,#6d28d9,#0759d9);
    color: white;
    font-weight: 800;
    cursor: pointer;
    font-size: 9px;
}

.ai-heading > button:disabled,
.generate-detail-button:disabled {
    opacity: .55;
    cursor: wait;
}

.ai-error {
    margin-top: 13px;
    background: #fff7ed;
    border: 1px solid #fed7aa;
    color: #c2410c;
    padding: 11px;
    border-radius: 9px;
    font-size: 9px;
}

.cache-message {
    margin-top: 12px;
    background: #ecfdf3;
    color: #15803d;
    padding: 9px;
    border-radius: 9px;
    font-size: 8px;
}

.context-pills {
    margin-top: 13px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.context-pills span {
    background: white;
    border: 1px solid #dae1ec;
    padding: 6px 8px;
    border-radius: 999px;
    font-size: 8px;
}

.ai-card {
    background: white;
}

.ai-number {
    width: 29px;
    height: 29px;
    background: linear-gradient(135deg,#6d28d9,#0759d9);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 9px;
    font-weight: 800;
}

.ai-label {
    display: block;
    color: #7c3aed;
    font-size: 7px;
    font-weight: 800;
    margin-top: 10px;
}

.match-reason {
    background: #f5f3ff;
    color: #5b21b6;
    padding: 9px;
    border-radius: 9px;
    font-size: 8px;
}

.match-reason strong,
.match-reason span {
    display: block;
}

.match-reason span {
    margin-top: 3px;
}

.nutrition-grid {
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 5px;
    margin-top: 10px;
}

.nutrition-grid div {
    background: #f8fafc;
    border-radius: 8px;
    padding: 8px 3px;
    text-align: center;
}

.nutrition-grid span {
    display: block;
    color: #94a3b8;
    font-size: 6px;
}

.nutrition-grid strong {
    font-size: 10px;
}

.tags {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
    margin: 9px 0;
}

.tags span {
    color: #0759d9;
    background: #eaf2ff;
    padding: 4px 6px;
    border-radius: 999px;
    font-size: 7px;
}

.controls {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 17px;
}

.controls > input {
    width: 330px;
    max-width: 100%;
    padding: 10px;
    border: 1px solid #d5deeb;
    border-radius: 9px;
}

.filters {
    display: flex;
    gap: 5px;
    flex-wrap: wrap;
}

.filters button {
    border: 1px solid #d5deeb;
    background: white;
    color: #64748b;
    border-radius: 999px;
    padding: 7px 9px;
    cursor: pointer;
    font-size: 8px;
}

.filters button.active {
    background: #0759d9;
    color: white;
}

.empty-state {
    margin-top: 18px;
    text-align: center;
    padding: 35px;
    border: 1px dashed #cbd5e1;
    border-radius: 13px;
}

.empty-state > div {
    font-size: 35px;
}

.empty-state p {
    color: #64748b;
    font-size: 10px;
}

.empty-state button {
    border: 0;
    background: #0759d9;
    color: white;
    padding: 9px 13px;
    border-radius: 8px;
    cursor: pointer;
}

.recipes-loading {
    min-height: 60vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

.recipes-spinner {
    width: 34px;
    height: 34px;
    border: 4px solid #dbeafe;
    border-top-color: #0759d9;
    border-radius: 50%;
    animation: recipe-spin .8s linear infinite;
}

@keyframes recipe-spin {
    to {
        transform: rotate(360deg);
    }
}

.recipes-error-card {
    padding: 25px;
    background: white;
    border: 1px solid #fecaca;
    border-radius: 14px;
}

@media(max-width: 1050px) {

    .today-recommendation-hero {
        grid-template-columns: 1fr;
    }

    .remaining-grid {
        grid-template-columns: repeat(3,1fr);
    }

    .recipe-grid,
    .ai-grid {
        grid-template-columns: 1fr;
    }

}

@media(max-width: 700px) {

    .recipes-header,
    .controls {
        flex-direction: column;
        align-items: stretch;
    }

    .remaining-grid,
    .today-progress-strip,
    .nutrition-grid {
        grid-template-columns: 1fr;
    }

    .ai-heading {
        grid-template-columns: 1fr;
    }

}

`;