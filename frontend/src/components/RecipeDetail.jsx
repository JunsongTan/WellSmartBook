import {
    useEffect,
    useMemo,
    useState,
    useRef
} from 'react';


import {
    useLocation,
    useNavigate
} from 'react-router-dom';


const API_BASE_URL =
    `http://${window.location.hostname}:5000`;


// =====================================================
// RECIPE HERO IMAGE
// Load private recipe photos using authentication.
// =====================================================

function RecipeHeroPhoto({ imageUrl, title }) {

    const [privateSrc, setPrivateSrc] = useState('');
    const [failed, setFailed] = useState(false);

    const isPrivate =
        typeof imageUrl === 'string' &&
        imageUrl.startsWith('/api/recipe-photos/');

    useEffect(() => {

        const controller = new AbortController();

        let active = true;
        let objectUrl = null;

        setPrivateSrc('');
        setFailed(false);

        if (isPrivate) {

            const token = localStorage.getItem('token');

            if (!token) {

                setFailed(true);

            } else {

                async function loadPhoto() {

                    try {

                        const response = await fetch(
                            `${API_BASE_URL}${imageUrl}`,
                            {
                                headers: {
                                    Authorization: `Bearer ${token}`
                                },
                                signal: controller.signal
                            }
                        );

                        if (!response.ok) {
                            throw new Error('Photo unavailable');
                        }

                        const blob = await response.blob();

                        if (!blob.type.startsWith('image/')) {
                            throw new Error('Invalid image');
                        }

                        if (!active) return;

                        objectUrl = URL.createObjectURL(blob);

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

        return () => {

            active = false;
            controller.abort();

            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };

    }, [imageUrl, isPrivate]);

    // Support existing public generated images.
    const publicSrc =
        typeof imageUrl === 'string' &&
        /^https?:\/\//i.test(imageUrl)
            ? imageUrl
            : typeof imageUrl === 'string' &&
              imageUrl.startsWith('/generated-images/')
                ? `${API_BASE_URL}${imageUrl}`
                : '';

    const src = isPrivate ? privateSrc : publicSrc;

    if (src && !failed) {

        return (
            <img
                src={src}
                alt={`${title || 'Recipe'} photo`}
                onError={() => setFailed(true)}
            />
        );
    }

    return (
        <div
            className="hero-placeholder"
            aria-label="Recipe image unavailable"
        >
            🍲
        </div>
    );
}

export default function RecipeDetail() {

    const navigate =
        useNavigate();


    const location =
        useLocation();


    const [
        recipe,
        setRecipe
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
        savingRecipe,
        setSavingRecipe
    ] = useState(false);


    const [
        recipeSaved,
        setRecipeSaved
    ] = useState(false);

    
    const [
        updatingFavourite,
        setUpdatingFavourite
    ] = useState(false);

    const [
        favouriteMessage,
        setFavouriteMessage
    ] = useState('');

    // Get the current recipe's Favorite status.
    const isFavourite =
        recipe?.isFavourite === true ||
        recipe?.isFavourite === 1 ||
        recipe?.isFavourite === '1' ||
        recipe?.is_favourite === 1 ||
        recipe?.is_favourite === '1';


    // =====================================================
    // RECIPE PHOTO UPLOAD STATES
    // =====================================================

    const [
        recipePhotoFile,
        setRecipePhotoFile
    ] = useState(null);

    const [
        uploadingRecipePhoto,
        setUploadingRecipePhoto
    ] = useState(false);

    const [
        recipePhotoMessage,
        setRecipePhotoMessage
    ] = useState('');

    const recipePhotoInputRef = useRef(null);


    const [
        saveMessage,
        setSaveMessage
    ] = useState('');


    const [
        mealType,
        setMealType
    ] = useState(
        detectMealType()
    );


    const [
        servingsEaten,
        setServingsEaten
    ] = useState(1);


    const [
        loggingMeal,
        setLoggingMeal
    ] = useState(false);


    const [
        mealLogged,
        setMealLogged
    ] = useState(false);


    const [
        logMessage,
        setLogMessage
    ] = useState('');

    
    // Prevent duplicate automatic save requests.
    const autoSaveAttempts = useRef(new Set());



    // ==================================================
    // LOAD
    // ==================================================

    useEffect(
        () => {

            try {
                // Reset the previous recipe's save state.
                setRecipeSaved(false);
                setSaveMessage('');
                setFavouriteMessage('');

                if (
                    location.state?.recipe
                ) {

                    setRecipe(
                        location.state.recipe
                    );


                    if (
                        location.state
                            .recipe
                            .id
                    ) {

                        setRecipeSaved(
                            true
                        );
                    }


                    return;
                }


                const stored =
                    sessionStorage.getItem(
                        'generatedRecipe'
                    );


                if (!stored) {

                    setError(
                        'No recipe was found.'
                    );

                    return;
                }


                setRecipe(
                    JSON.parse(
                        stored
                    )
                );


            } catch {

                setError(
                    'Unable to load this recipe.'
                );


            } finally {

                setLoading(
                    false
                );

            }

        },

        [
            location.state
        ]
    );


    const nutrition =
        recipe?.nutrition ||
        {};


    const caloriesPerServing =
        Number(
            nutrition.calories ||
            0
        );


    const proteinPerServing =
        Number(
            nutrition.proteinGrams ||
            nutrition.protein ||
            0
        );


    const carbsPerServing =
        Number(
            nutrition.carbsGrams ||
            nutrition.carbs ||
            0
        );


    const fatPerServing =
        Number(
            nutrition.fatGrams ||
            nutrition.fat ||
            0
        );


    const mealNutrition =
        useMemo(
            () => ({

                calories:
                    roundOne(
                        caloriesPerServing *
                        servingsEaten
                    ),

                protein:
                    roundOne(
                        proteinPerServing *
                        servingsEaten
                    ),

                carbs:
                    roundOne(
                        carbsPerServing *
                        servingsEaten
                    ),

                fat:
                    roundOne(
                        fatPerServing *
                        servingsEaten
                    )

            }),

            [
                caloriesPerServing,
                proteinPerServing,
                carbsPerServing,
                fatPerServing,
                servingsEaten
            ]
        );



    // =====================================================
    // SAVE COMPLETE GEMINI RECIPE TO MYSQL
    // =====================================================

    async function saveRecipe() {

        if (!recipe || savingRecipe || recipeSaved) return;

        const token = localStorage.getItem('token');

        if (!token) {
            navigate('/login');
            return;
        }

        setSavingRecipe(true);
        setSaveMessage('');

        try {

            const response = await fetch(
                `${API_BASE_URL}/api/saved-recipes`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },

                    body: JSON.stringify({

                        title: recipe.title,

                        description: recipe.description,

                        imageUrl: recipe.imageUrl || null,

                        servings: recipe.servings || 1,

                        prepTimeMinutes:
                            recipe.prepTimeMinutes ?? 0,

                        cookTimeMinutes:
                            recipe.cookTimeMinutes ?? 0,

                        caloriesPerServing,

                        proteinPerServing,

                        carbsPerServing,

                        fatPerServing,

                        ingredients: recipe.ingredients || [],

                        instructions: recipe.instructions || [],

                        tags: recipe.tags || []

                    })
                }
            );

            const data = await response
                .json()
                .catch(() => ({}));

            // =============================================
            // EXPIRED LOGIN
            // =============================================

            if (
                response.status === 401 ||
                response.status === 403
            ) {

                localStorage.removeItem('token');
                localStorage.removeItem('user');

                navigate('/login');

                return;
            }

            // =============================================
            // RECIPE ALREADY SAVED
            //
            // Reuse its existing database ID.
            // Do not insert another recipe.
            // =============================================

            if (response.status === 409) {

                const existingId = Number(data.recipeId);

                if (
                    !Number.isSafeInteger(existingId) ||
                    existingId <= 0
                ) {

                    throw new Error(
                        'Unable to identify the existing recipe.'
                    );
                }

                
                // Get the existing recipe's Favorite status.
                const existingResponse = await fetch(
                    `${API_BASE_URL}/api/saved-recipes`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                const existingData = await existingResponse
                    .json()
                    .catch(() => ({}));

                if (!existingResponse.ok) {
                    throw new Error(
                        existingData.message ||
                        'Could not check the existing recipe favourite status.'
                    );
                }

                const existingRecipe = (
                    Array.isArray(existingData.recipes)
                        ? existingData.recipes
                        : []
                ).find(item =>
                    Number(item.id) === existingId
                );

                if (!existingRecipe) {
                    throw new Error(
                        'Existing recipe was not found in My Recipes.'
                    );
                }

                // Restore the actual saved Favorite status.
                
                setRecipe(current =>
                    current
                        ? {
                            ...current,

                            id: existingId,

                            // Restore the existing photo from MySQL.
                            imageUrl:
                                existingRecipe.imageUrl ||
                                current.imageUrl ||
                                null,

                            // Preserve the existing Favorite status.
                            isFavourite:
                                existingRecipe.isFavourite === true ||
                                existingRecipe.isFavourite === 1 ||
                                existingRecipe.isFavourite === '1'
                        }
                        : current
                );


                setRecipeSaved(true);


                setSaveMessage(
                    'This recipe is already in Saved Recipes.'
                );

                return;
            }

            // =============================================
            // CHECK SUCCESSFUL INSERT
            // =============================================

            if (
                !response.ok ||
                data.success !== true ||
                !Number.isSafeInteger(
                    Number(data.recipeId)
                ) ||
                Number(data.recipeId) <= 0
            ) {

                throw new Error(
                    data.message ||
                    'Unable to save this recipe.'
                );
            }

            // =============================================
            // SAVED SUCCESSFULLY
            //
            // New recipes are NOT favourites yet.
            // =============================================

            setRecipe(current =>
                current
                    ? {
                        ...current,

                        id: Number(data.recipeId),

                        isFavourite: false
                    }
                    : current
            );

            setRecipeSaved(true);

            setSaveMessage(
                'Recipe automatically saved to My Recipes.'
            );

        } catch (saveError) {

            setSaveMessage(
                saveError.message ||
                'Unable to save this recipe.'
            );

        } finally {

            setSavingRecipe(false);

        }
    }

    
    // =====================================================
    // ADD / REMOVE RECIPE FROM FAVORITES
    // =====================================================

    async function toggleRecipeFavourite() {

        const recipeId = Number(recipe?.id);

        // Recipe must be saved before it can be favorited.
        if (
            !recipeSaved ||
            savingRecipe ||
            updatingFavourite ||
            !Number.isSafeInteger(recipeId) ||
            recipeId <= 0
        ) {
            return;
        }

        const token = localStorage.getItem('token');

        if (!token) {
            navigate('/login');
            return;
        }

        const nextFavourite = !isFavourite;

        setUpdatingFavourite(true);
        setFavouriteMessage('');

        try {

            const response = await fetch(
                `${API_BASE_URL}/api/saved-recipes/${recipeId}/favourite`,
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

            const data = await response
                .json()
                .catch(() => ({}));

            if (
                response.status === 401 ||
                response.status === 403
            ) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');

                navigate('/login');
                return;
            }

            if (
                !response.ok ||
                data.success !== true ||
                typeof data.isFavourite !== 'boolean'
            ) {
                throw new Error(
                    data.message ||
                    'Unable to update this recipe favourite.'
                );
            }

            // Update the heart only after MySQL succeeds.
            setRecipe(current =>
                Number(current?.id) === recipeId
                    ? {
                        ...current,
                        isFavourite: data.isFavourite
                    }
                    : current
            );

            setFavouriteMessage(
                data.isFavourite
                    ? 'Recipe added to Favorites.'
                    : 'Recipe removed from Favorites. It is still saved.'
            );

        } catch (error) {

            setFavouriteMessage(
                error.message ||
                'Unable to update Favorites.'
            );

        } finally {

            setUpdatingFavourite(false);
        }
    }

    
    // =====================================================
    // UPLOAD PHOTO FOR AN EXISTING SAVED RECIPE
    // =====================================================

    async function uploadRecipePhoto() {

        const recipeId = Number(recipe?.id);

        // Recipe must already be saved in MySQL.
        if (
            !recipeSaved ||
            !Number.isSafeInteger(recipeId) ||
            recipeId <= 0
        ) {

            setRecipePhotoMessage(
                'Save the recipe first.'
            );

            return;
        }

        if (uploadingRecipePhoto) return;

        if (!recipePhotoFile) {

            setRecipePhotoMessage(
                'Please choose a recipe photo.'
            );

            return;
        }

        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp'
        ];

        if (!allowedTypes.includes(recipePhotoFile.type)) {

            setRecipePhotoMessage(
                'Choose a JPEG, PNG or WebP photo.'
            );

            return;
        }

        if (recipePhotoFile.size > 5 * 1024 * 1024) {

            setRecipePhotoMessage(
                'Recipe photo must be 5 MB or smaller.'
            );

            return;
        }

        const token = localStorage.getItem('token');

        if (!token) {

            navigate('/login');
            return;
        }

        // ==========================================
        // PREPARE UPLOAD FORM
        // ==========================================

        const formData = new FormData();

        formData.append(
            'image',
            recipePhotoFile,
            recipePhotoFile.name
        );

        setUploadingRecipePhoto(true);
        setRecipePhotoMessage('');

        try {

            // ======================================
            // UPLOAD TO BACKEND
            // ======================================

            const response = await fetch(
                `${API_BASE_URL}/api/saved-recipes/${recipeId}/photo`,
                {
                    method: 'POST',

                    headers: {
                        Authorization: `Bearer ${token}`
                    },

                    body: formData
                }
            );

            const data = await response
                .json()
                .catch(() => ({}));

            // ======================================
            // HANDLE AUTHENTICATION
            // ======================================

            if (response.status === 401) {

                localStorage.removeItem('token');
                navigate('/login');

                return;
            }

            if (response.status === 403) {

                setRecipePhotoMessage(
                    data.message ||
                    'Photo upload not permitted.'
                );

                return;
            }

            // ======================================
            // CHECK UPLOAD RESULT
            // ======================================

            if (
                !response.ok ||
                data.success !== true ||
                typeof data.imageUrl !== 'string' ||
                !data.imageUrl.startsWith('/api/recipe-photos/')
            ) {

                throw new Error(
                    data.message ||
                    'Unable to upload recipe photo.'
                );
            }

            // ======================================
            // UPDATE RECIPE IMAGE ON THE PAGE
            // ======================================

            setRecipe(current =>
                Number(current?.id) === recipeId
                    ? {
                        ...current,
                        imageUrl: data.imageUrl
                    }
                    : current
            );

            // Clear the selected file.
            setRecipePhotoFile(null);

            if (recipePhotoInputRef.current) {
                recipePhotoInputRef.current.value = '';
            }

            setRecipePhotoMessage(
                'Recipe photo uploaded successfully.'
            );

        } catch (error) {

            setRecipePhotoMessage(
                error.message ||
                'Unable to upload recipe photo.'
            );

        } finally {

            setUploadingRecipePhoto(false);
        }
    }



    
    // =====================================================
    // AUTOMATICALLY SAVE A SELECTED GEMINI RECIPE
    //
    // Runs when a complete generated recipe is loaded.
    // Does not re-save recipes that already have a DB ID.
    // =====================================================

    useEffect(() => {

        if (
            !recipe ||
            recipe.id ||
            recipeSaved
        ) {
            return;
        }

        // Unique key for the selected full recipe.
        const key = JSON.stringify([
            recipe.title,
            recipe.ingredients,
            recipe.instructions
        ]);

        // Avoid repeating the automatic save request.
        if (autoSaveAttempts.current.has(key)) {
            return;
        }

        autoSaveAttempts.current.add(key);

        // Save without requiring another button click.
        void saveRecipe();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recipe, recipeSaved]);




    // ==================================================
    // LOG MEAL
    // ==================================================

    async function logRecipeMeal() {

        const token =
            localStorage.getItem(
                'token'
            );


        try {

            setLoggingMeal(
                true
            );


            setLogMessage(
                ''
            );


            const response =
                await fetch(

                    `${API_BASE_URL}/api/meal-logs`,

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

                                foodKey:
                                    null,

                                foodName:
                                    recipe.title,

                                mealType,

                                sourceType:
                                    'recipe',

                                portionGrams:
                                    null,

                                calories:
                                    mealNutrition.calories,

                                protein:
                                    mealNutrition.protein,

                                carbs:
                                    mealNutrition.carbs,

                                fat:
                                    mealNutrition.fat,

                                aiConfidence:
                                    null,

                                imageUrl:
                                    recipe.imageUrl ||
                                    null

                            })

                    }

                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message
                );
            }


            setMealLogged(
                true
            );


            setLogMessage(
                `${recipe.title} added to today's ${mealType}.`
            );


        } catch (
            logError
        ) {

            setLogMessage(
                logError.message
            );


        } finally {

            setLoggingMeal(
                false
            );

        }

    }


    if (loading) {

        return (

            <div
                className="recipe-loading"
            >

                <style>
                    {recipeCss}
                </style>

                Loading recipe...

            </div>

        );

    }


    if (
        error ||
        !recipe
    ) {

        return (

            <div>

                <style>
                    {recipeCss}
                </style>


                <div
                    className="error-card"
                >

                    <h2>
                        Recipe unavailable
                    </h2>


                    <p>
                        {error}
                    </p>


                    <button
                        onClick={() =>
                            navigate(
                                '/recipes'
                            )
                        }
                    >
                        Return to Recipes
                    </button>

                </div>

            </div>

        );

    }


    const ingredients =
        Array.isArray(
            recipe.ingredients
        )
            ? recipe.ingredients
            : [];


    const instructions =
        Array.isArray(
            recipe.instructions
        )
            ? recipe.instructions
            : [];


    return (

        <div
            className="recipe-page"
        >

            <style>
                {recipeCss}
            </style>


            <div
                className="breadcrumb"
            >

                <button
                    onClick={() =>
                        navigate(
                            '/recipes'
                        )
                    }
                >
                    Recipes
                </button>

                <span>
                    ›
                </span>

                <span>
                    {recipe.title}
                </span>

            </div>


            {/* HERO */}

            <section
                className="recipe-hero"
            >

                
            <RecipeHeroPhoto
                imageUrl={recipe.imageUrl}
                title={recipe.title}
            />



                <div
                    className="hero-overlay"
                />


                <div
                    className="hero-content"
                >

                    <div
                        className="hero-tags"
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


                    <h1>
                        {recipe.title}
                    </h1>


                    <p>
                        {recipe.description}
                    </p>


                    <div
                        className="hero-meta"
                    >

                        <span>
                            🔥 {
                                Math.round(
                                    caloriesPerServing
                                )
                            } kcal
                        </span>


                        <span>
                            ⏱ Prep {
                                recipe.prepTimeMinutes ||
                                0
                            } min
                        </span>


                        <span>
                            🍳 Cook {
                                recipe.cookTimeMinutes ||
                                0
                            } min
                        </span>


                        <span>
                            🍽 {
                                recipe.servings ||
                                1
                            } serving(s)
                        </span>

                    </div>

                </div>


                
                
                {/* =======================================
                    SAVED STATUS AND FAVORITE BUTTON
                ======================================= */}

                <div className="recipe-hero-actions">

                    {/* SAVED STATUS */}

                    <div
                        className="recipe-save-indicator"
                        role="status"
                        aria-live="polite"
                    >

                        {recipeSaved
                            ? '✓ Saved'
                            : savingRecipe
                                ? 'Saving...'
                                : 'Not saved'}

                    </div>

                    {/* FAVORITE BUTTON */}

                    <button
                        type="button"

                        className={
                            isFavourite
                                ? 'recipe-favourite-button active'
                                : 'recipe-favourite-button'
                        }

                        aria-label={
                            isFavourite
                                ? 'Remove from Favorites'
                                : 'Add to Favorites'
                        }

                        aria-pressed={isFavourite}

                        title={
                            recipeSaved
                                ? isFavourite
                                    ? 'Remove from Favorites'
                                    : 'Add to Favorites'
                                : 'Recipe must be saved first'
                        }

                        disabled={
                            !recipeSaved ||
                            savingRecipe ||
                            updatingFavourite ||
                            !Number.isSafeInteger(Number(recipe?.id))
                        }

                        onClick={toggleRecipeFavourite}
                    >

                        {updatingFavourite
                            ? '…'
                            : isFavourite
                                ? '♥'
                                : '♡'}

                    </button>

                </div>



            </section>

            
            {/* ==========================================
                RECIPE PHOTO UPLOAD
            ========================================== */}

            <section className="recipe-photo-uploader">

                <div>

                    <h3>
                        Recipe Photo
                    </h3>

                    <p>
                        Upload a photo of the finished dish.
                        JPEG, PNG or WebP, maximum 5 MB.
                        The photo is private to your account.
                    </p>

                </div>

                {/* CHOOSE PHOTO */}

                <input
                    ref={recipePhotoInputRef}

                    type="file"

                    accept="image/jpeg,image/png,image/webp"

                    aria-label="Choose recipe photo"

                    disabled={
                        !recipeSaved ||
                        uploadingRecipePhoto
                    }

                    onChange={event => {

                        setRecipePhotoFile(
                            event.target.files?.[0] || null
                        );

                        setRecipePhotoMessage('');

                    }}
                />

                {/* UPLOAD BUTTON */}

                <button
                    type="button"

                    className="recipe-photo-upload-btn"

                    onClick={uploadRecipePhoto}

                    disabled={
                        !recipeSaved ||
                        uploadingRecipePhoto ||
                        !recipePhotoFile
                    }
                >

                    {uploadingRecipePhoto
                        ? 'Uploading...'
                        : 'Upload Recipe Photo'}

                </button>

                {/* SAVING STATUS */}

                {!recipeSaved && (

                    <p>
                        Recipe photo upload is available
                        after automatic saving.
                    </p>

                )}

                {/* UPLOAD RESULT */}

                {recipePhotoMessage && (

                    <p
                        role="status"
                        className="recipe-photo-message"
                    >
                        {recipePhotoMessage}
                    </p>

                )}

            </section>



            {/* PERSONALIZATION */}

            {recipe
                .personalization
                ?.matchReason && (

                <section
                    className="personalization-banner"
                >

                    <div
                        className="personalization-icon"
                    >
                        ✨
                    </div>


                    <div>

                        <span>
                            PERSONALIZED FOR TODAY
                        </span>


                        <h3>
                            Why WellSmartBook recommended this
                        </h3>


                        <p>
                            {
                                recipe
                                    .personalization
                                    .matchReason
                            }
                        </p>


                        {recipe
                            .personalization
                            ?.remainingWhenGenerated && (

                            <div
                                className="personalization-meta"
                            >

                                <span>
                                    🔥 {
                                        Math.round(
                                            recipe
                                                .personalization
                                                .remainingWhenGenerated
                                                .calories
                                        )
                                    } kcal were remaining
                                </span>


                                <span>
                                    💪 {
                                        roundOne(
                                            recipe
                                                .personalization
                                                .remainingWhenGenerated
                                                .protein
                                        )
                                    }g protein remaining
                                </span>

                            </div>

                        )}

                    </div>

                </section>

            )}


            {saveMessage && (

                <div
                    className="message"
                >
                    {saveMessage}
                </div>

            )}
            
            {/* FAVORITE SUCCESS / ERROR MESSAGE */}

            {favouriteMessage && (

                <div
                    className="message"
                    role="status"
                >
                    {favouriteMessage}
                </div>

            )}



            {/* NUTRITION */}

            <section
                className="nutrition-strip"
            >

                <NutritionCard
                    icon="🔥"
                    label="Calories"
                    value={
                        Math.round(
                            caloriesPerServing
                        )
                    }
                    unit="kcal"
                />


                <NutritionCard
                    icon="💪"
                    label="Protein"
                    value={
                        roundOne(
                            proteinPerServing
                        )
                    }
                    unit="g"
                />


                <NutritionCard
                    icon="🌾"
                    label="Carbs"
                    value={
                        roundOne(
                            carbsPerServing
                        )
                    }
                    unit="g"
                />


                <NutritionCard
                    icon="🥑"
                    label="Fat"
                    value={
                        roundOne(
                            fatPerServing
                        )
                    }
                    unit="g"
                />

            </section>


            {/* CONTENT */}

            <section
                className="content-grid"
            >

                <aside
                    className="panel"
                >

                    <span
                        className="small-label"
                    >
                        WHAT YOU NEED
                    </span>


                    <h2>
                        🧺 Ingredients
                    </h2>


                    <div
                        className="ingredients"
                    >

                        {ingredients.map(
                            (
                                ingredient,
                                index
                            ) => (

                                <label
                                    className="ingredient"
                                    key={`${ingredient.name}-${index}`}
                                >

                                    <input
                                        type="checkbox"
                                    />


                                    <div>

                                        <strong>
                                            {
                                                ingredient.amount
                                            }
                                        </strong>

                                        {' '}

                                        {
                                            ingredient.name
                                        }


                                        {ingredient.source && (

                                            <small
                                                className={
                                                    `source ${ingredient.source}`
                                                }
                                            >

                                                {
                                                    getSourceLabel(
                                                        ingredient.source
                                                    )
                                                }

                                            </small>

                                        )}

                                    </div>

                                </label>

                            )
                        )}

                    </div>

                </aside>


                <main
                    className="panel"
                >

                    <span
                        className="small-label"
                    >
                        COOKING GUIDE
                    </span>


                    <h2>
                        📖 Cooking Instructions
                    </h2>


                    <div
                        className="steps"
                    >

                        {instructions.map(
                            (
                                step,
                                index
                            ) => (

                                <div
                                    className="step"
                                    key={
                                        step.stepNumber ||
                                        index
                                    }
                                >

                                    <div
                                        className="step-number"
                                    >
                                        {
                                            step.stepNumber ||
                                            index +
                                            1
                                        }
                                    </div>


                                    <div
                                        className="step-body"
                                    >

                                        <h3>
                                            {
                                                step.title ||
                                                `Step ${index + 1}`
                                            }
                                        </h3>


                                        <p>
                                            {
                                                step.instruction ||
                                                step.description
                                            }
                                        </p>

                                    </div>

                                </div>

                            )
                        )}

                    </div>

                </main>

            </section>


            {/* LOG */}

            <section
                className="log-section"
            >

                <span
                    className="small-label"
                >
                    DAILY NUTRITION
                </span>


                <h2>
                    Ate this recipe?
                </h2>


                <p>
                    Add it to today's diary and your dashboard will update automatically.
                </p>


                <div
                    className="log-controls"
                >

                    <div>

                        <label>
                            Amount eaten
                        </label>


                        <select

                            value={
                                servingsEaten
                            }

                            onChange={
                                (
                                    event
                                ) => {

                                    setServingsEaten(
                                        Number(
                                            event.target.value
                                        )
                                    );


                                    setMealLogged(
                                        false
                                    );

                                }
                            }
                        >

                            <option
                                value={0.5}
                            >
                                ½ serving
                            </option>

                            <option
                                value={1}
                            >
                                1 serving
                            </option>

                            <option
                                value={1.5}
                            >
                                1½ servings
                            </option>

                            <option
                                value={2}
                            >
                                2 servings
                            </option>

                        </select>

                    </div>


                    <div>

                        <label>
                            Meal type
                        </label>


                        <select

                            value={
                                mealType
                            }

                            onChange={
                                (
                                    event
                                ) => {

                                    setMealType(
                                        event.target.value
                                    );


                                    setMealLogged(
                                        false
                                    );

                                }
                            }
                        >

                            <option value="breakfast">
                                🌅 Breakfast
                            </option>

                            <option value="lunch">
                                ☀️ Lunch
                            </option>

                            <option value="dinner">
                                🌙 Dinner
                            </option>

                            <option value="snack">
                                🍎 Snack
                            </option>

                        </select>

                    </div>

                </div>


                <div
                    className="meal-preview"
                >

                    <NutritionPreview
                        label="Calories"
                        value={`${Math.round(
                            mealNutrition.calories
                        )} kcal`}
                    />


                    <NutritionPreview
                        label="Protein"
                        value={`${mealNutrition.protein} g`}
                    />


                    <NutritionPreview
                        label="Carbs"
                        value={`${mealNutrition.carbs} g`}
                    />


                    <NutritionPreview
                        label="Fat"
                        value={`${mealNutrition.fat} g`}
                    />

                </div>


                <div
                    className="actions"
                >

                    <button

                        className="log-button"

                        disabled={
                            loggingMeal ||
                            mealLogged
                        }

                        onClick={
                            logRecipeMeal
                        }
                    >
                        {
                            mealLogged
                                ? '✓ Added to Daily Log'
                                : loggingMeal
                                    ? 'Adding...'
                                    : '🍽 Log This Meal'
                        }
                    </button>


                    <button

                        className="save-button"

                        disabled={
                            savingRecipe ||
                            recipeSaved
                        }

                        onClick={
                            saveRecipe
                        }
                    >
                        {
                            recipeSaved
                                ? '✓ Saved to My Recipes'
                                : savingRecipe
                                    ? 'Saving automatically...'
                                    : '↻ Retry Save'
                        }
                    </button>

                </div>


                {logMessage && (

                    <div
                        className="message"
                    >
                        {logMessage}
                    </div>

                )}


                {mealLogged && (

                    <button

                        className="dashboard-button"

                        onClick={() =>
                            navigate(
                                '/dashboard'
                            )
                        }
                    >
                        View Updated Dashboard →
                    </button>

                )}

            </section>

        </div>

    );

}


// ======================================================
// SMALL COMPONENTS
// ======================================================

function NutritionCard({

    icon,
    label,
    value,
    unit

}) {

    return (

        <div
            className="nutrition-card"
        >

            <div>
                {icon}
            </div>


            <span>
                {label}
            </span>


            <strong>
                {value}

                <small>
                    {' '}
                    {unit}
                </small>
            </strong>

        </div>

    );

}


function NutritionPreview({
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


// ======================================================
// HELPERS
// ======================================================

function getSourceLabel(
    source
) {

    if (
        source ===
        'user'
    ) {

        return 'Scanned';
    }


    if (
        source ===
        'recommended'
    ) {

        return 'AI Recipe';
    }


    if (
        source ===
        'pantry'
    ) {

        return 'Pantry';
    }


    return source;

}


function detectMealType() {

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

const recipeCss = `

.recipe-page {
    padding-bottom: 50px;
}

.breadcrumb {
    display: flex;
    gap: 8px;
    color: #64748b;
    font-size: 10px;
    margin-bottom: 14px;
}

.breadcrumb button {
    border: 0;
    background: transparent;
    padding: 0;
    color: #0759d9;
    cursor: pointer;
}

.recipe-hero {
    min-height: 390px;
    border-radius: 22px;
    overflow: hidden;
    position: relative;
    background: linear-gradient(135deg,#164e63,#0759d9);
}

.recipe-hero > img,
.hero-placeholder {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
}

.recipe-hero > img {
    object-fit: cover;
}

.hero-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 100px;
}

.hero-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(
        180deg,
        rgba(0,0,0,.05),
        rgba(0,0,0,.78)
    );
}

.hero-content {
    position: absolute;
    left: 30px;
    right: 80px;
    bottom: 27px;
    z-index: 2;
    color: white;
}

.hero-content h1 {
    font-size: 34px;
    margin: 8px 0;
}

.hero-content > p {
    max-width: 750px;
    font-size: 12px;
    line-height: 1.6;
    opacity: .9;
}

.hero-tags,
.hero-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.hero-tags span {
    background: rgba(255,255,255,.18);
    border-radius: 999px;
    padding: 5px 8px;
    font-size: 8px;
}

.hero-meta span {
    background: rgba(255,255,255,.94);
    color: #334155;
    padding: 7px 9px;
    border-radius: 999px;
    font-size: 8px;
    font-weight: 700;
}



/* ==========================================
   RECIPE SAVED STATUS + FAVORITE HEART
========================================== */

.recipe-hero-actions {
    position: absolute;
    z-index: 3;
    top: 20px;
    right: 20px;

    display: flex;
    align-items: center;
    gap: 9px;
}

.recipe-save-indicator {
    padding: 11px 15px;

    border-radius: 999px;

    background: white;
    color: #0759d9;

    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
}

.recipe-favourite-button {
    display: inline-flex;
    justify-content: center;
    align-items: center;

    width: 42px;
    height: 42px;

    border: 1px solid #e2e8f0;
    border-radius: 50%;

    background: #ffffff;
    color: #dc2626;

    font-size: 24px;
    line-height: 1;

    cursor: pointer;
}

.recipe-favourite-button.active {
    border-color: #fecdd3;
    background: #fff1f2;
}

.recipe-favourite-button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.recipe-favourite-button:focus-visible {
    outline: 3px solid #93c5fd;
    outline-offset: 3px;
}


/* ==========================================
   RECIPE PHOTO UPLOADER
========================================== */

.recipe-photo-uploader {
    display: flex;
    flex-wrap: wrap;
    align-items: center;

    gap: 12px 16px;
    margin: 16px 0;
    padding: 20px;

    border: 1px solid #d9e5f4;
    border-radius: 16px;
    background: #ffffff;
}

.recipe-photo-uploader > div {
    flex: 1 1 100%;
}

.recipe-photo-uploader h3 {
    margin: 0 0 6px;
    font-size: 17px;
    color: #132b4e;
}

.recipe-photo-uploader p {
    margin: 0;
    color: #64748b;
    font-size: 12px;
    line-height: 1.6;
}

.recipe-photo-uploader input[type="file"] {
    flex: 1 1 250px;
    max-width: 100%;
    font-size: 12px;
}

.recipe-photo-upload-btn {
    border: 0;
    border-radius: 10px;

    padding: 12px 18px;

    background: #0759d9;
    color: #ffffff;

    font-size: 13px;
    font-weight: 700;

    cursor: pointer;
}

.recipe-photo-upload-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.recipe-photo-uploader .recipe-photo-message {
    flex-basis: 100%;
    color: #0759d9;
    font-weight: 600;
}

/* MOBILE RESPONSIVE */

@media (max-width: 600px) {

    .recipe-photo-uploader {
        padding: 15px;
    }

    .recipe-photo-upload-btn {
        width: 100%;
    }

}


/* MOBILE RESPONSIVE */

@media (max-width: 600px) {

    .recipe-hero-actions {
        top: 12px;
        right: 12px;
        gap: 6px;
    }

    .recipe-save-indicator {
        padding: 9px 12px;
        font-size: 11px;
    }

    .recipe-favourite-button {
        width: 36px;
        height: 36px;
        font-size: 21px;
    }
}



.personalization-banner {
    margin-top: 15px;
    display: flex;
    gap: 13px;
    padding: 16px 18px;
    border: 1px solid #ddd6fe;
    border-radius: 14px;
    background: linear-gradient(135deg,#faf5ff,#eff6ff);
}

.personalization-icon {
    width: 40px;
    height: 40px;
    background: white;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.personalization-banner > div:nth-child(2) > span {
    color: #7c3aed;
    font-size: 8px;
    font-weight: 800;
}

.personalization-banner h3 {
    margin: 4px 0;
    font-size: 14px;
}

.personalization-banner p {
    margin: 0;
    color: #64748b;
    font-size: 10px;
    line-height: 1.6;
}

.personalization-meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-top: 9px;
}

.personalization-meta span {
    background: white;
    color: #475569;
    padding: 5px 7px;
    border-radius: 999px;
    font-size: 7px;
}

.message {
    margin-top: 12px;
    padding: 10px 12px;
    background: #ecfdf3;
    color: #15803d;
    border-radius: 9px;
    font-size: 9px;
}

.nutrition-strip {
    margin-top: 17px;
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 11px;
}

.nutrition-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 13px;
    padding: 14px;
    text-align: center;
}

.nutrition-card > div {
    font-size: 20px;
}

.nutrition-card span {
    display: block;
    color: #64748b;
    font-size: 8px;
}

.nutrition-card strong {
    display: block;
    font-size: 17px;
    margin-top: 3px;
}

.nutrition-card small {
    color: #64748b;
    font-size: 9px;
}

.content-grid {
    margin-top: 18px;
    display: grid;
    grid-template-columns: .37fr .63fr;
    gap: 18px;
    align-items: start;
}

.panel,
.log-section {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 17px;
    padding: 21px;
}

.small-label {
    color: #64748b;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .6px;
}

.panel h2,
.log-section h2 {
    margin: 6px 0 16px;
    font-size: 18px;
}

.ingredients {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.ingredient {
    display: flex;
    gap: 8px;
    padding: 10px;
    background: #fbfcff;
    border: 1px solid #e5eaf1;
    border-radius: 10px;
    font-size: 10px;
}

.source {
    margin-left: 5px;
    padding: 3px 5px;
    border-radius: 999px;
    font-size: 7px;
    font-weight: 800;
}

.source.user {
    background: #dbeafe;
    color: #0759d9;
}

.source.pantry {
    background: #dcfce7;
    color: #15803d;
}

.source.recommended {
    background: #f3e8ff;
    color: #6d28d9;
}

.steps {
    display: flex;
    flex-direction: column;
    gap: 13px;
}

.step {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 12px;
}

.step-number {
    width: 33px;
    height: 33px;
    border-radius: 50%;
    background: #0759d9;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 800;
}

.step-body {
    background: #fbfcff;
    border: 1px solid #e5eaf1;
    padding: 13px;
    border-radius: 11px;
}

.step-body h3 {
    margin: 0 0 5px;
    font-size: 12px;
}

.step-body p {
    margin: 0;
    color: #64748b;
    font-size: 10px;
    line-height: 1.65;
}

.log-section {
    margin-top: 18px;
}

.log-section > p {
    color: #64748b;
    font-size: 10px;
}

.log-controls {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 11px;
}

.log-controls label {
    display: block;
    font-size: 9px;
    font-weight: 800;
    margin-bottom: 6px;
}

.log-controls select {
    width: 100%;
    border: 1px solid #cbd5e1;
    padding: 10px;
    border-radius: 9px;
}

.meal-preview {
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 8px;
    margin-top: 12px;
}

.meal-preview div {
    background: #f6f9ff;
    padding: 11px;
    border-radius: 9px;
    text-align: center;
}

.meal-preview span {
    display: block;
    color: #64748b;
    font-size: 7px;
}

.meal-preview strong {
    display: block;
    margin-top: 3px;
    font-size: 12px;
}

.actions {
    margin-top: 13px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px;
}

.log-button,
.save-button,
.dashboard-button {
    padding: 11px;
    border-radius: 9px;
    font-weight: 800;
    cursor: pointer;
    font-size: 10px;
}

.log-button {
    border: 0;
    background: #087a39;
    color: white;
}

.save-button {
    border: 1px solid #0759d9;
    background: white;
    color: #0759d9;
}

.dashboard-button {
    border: 0;
    background: transparent;
    color: #0759d9;
    width: 100%;
    margin-top: 8px;
}

.recipe-loading {
    min-height: 60vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.error-card {
    background: white;
    border: 1px solid #fecaca;
    border-radius: 14px;
    padding: 25px;
}

.error-card button {
    border: 0;
    background: #0759d9;
    color: white;
    padding: 10px 14px;
    border-radius: 8px;
}

@media(max-width: 900px) {

    .content-grid {
        grid-template-columns: 1fr;
    }

    .nutrition-strip {
        grid-template-columns: repeat(2,1fr);
    }

}

@media(max-width: 600px) {

    .nutrition-strip,
    .meal-preview,
    .actions,
    .log-controls {
        grid-template-columns: 1fr;
    }

    .hero-content {
        left: 18px;
        right: 18px;
    }

    .hero-content h1 {
        font-size: 27px;
    }

}

`;