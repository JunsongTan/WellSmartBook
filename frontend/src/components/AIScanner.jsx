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


// ======================================================
// AI SCANNER
// ======================================================

export default function AIScanner() {

    const navigate =
        useNavigate();


    const [
        activeTab,
        setActiveTab
    ] = useState(
        'calorie'
    );


    const [
        nutritionFoods,
        setNutritionFoods
    ] = useState([]);


    const [
        pageMessage,
        setPageMessage
    ] = useState('');


    // ==================================================
    // MEAL CALORIE SCANNER STATE
    // ==================================================

    const [
        mealFile,
        setMealFile
    ] = useState(null);


    const [
        mealPreview,
        setMealPreview
    ] = useState('');


    const [
        mealAnalyzing,
        setMealAnalyzing
    ] = useState(false);


    const [
        mealAnalysis,
        setMealAnalysis
    ] = useState(null);


    const [
        selectedFoodKey,
        setSelectedFoodKey
    ] = useState('');


    const [
        selectedPortion,
        setSelectedPortion
    ] = useState(
        'regular'
    );


    const [
        customPortion,
        setCustomPortion
    ] = useState('');


    const [
        useCustomPortion,
        setUseCustomPortion
    ] = useState(false);


    const [
        nutritionResult,
        setNutritionResult
    ] = useState(null);


    const [
        calculatingNutrition,
        setCalculatingNutrition
    ] = useState(false);


    const [
        mealType,
        setMealType
    ] = useState(
        detectMealType()
    );


    const [
        loggingMeal,
        setLoggingMeal
    ] = useState(false);


    const [
        mealLogged,
        setMealLogged
    ] = useState(false);


    // ==================================================
    // RAW INGREDIENT SCANNER STATE
    // ==================================================

    const [
        ingredientFile,
        setIngredientFile
    ] = useState(null);


    const [
        ingredientPreview,
        setIngredientPreview
    ] = useState('');


    const [
        ingredientScanning,
        setIngredientScanning
    ] = useState(false);


    const [
        ingredients,
        setIngredients
    ] = useState([]);


    const [
        newIngredient,
        setNewIngredient
    ] = useState('');


    const [
        recipeOptions,
        setRecipeOptions
    ] = useState([]);


    const [
        generatingOptions,
        setGeneratingOptions
    ] = useState(false);


    const [
        preparingRecipeIndex,
        setPreparingRecipeIndex
    ] = useState(null);


    const [
        scannerError,
        setScannerError
    ] = useState('');


    // ==================================================
    // LOAD AVAILABLE NUTRITION FOODS
    // ==================================================

    useEffect(
        () => {

            loadNutritionFoods();

        },
        []
    );


    async function loadNutritionFoods() {

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

            const response =
                await fetch(

                    `${API_BASE_URL}/api/nutrition-foods`,

                    {

                        headers: {

                            Authorization:
                                `Bearer ${token}`

                        }

                    }

                );


            if (
                response.status === 401 ||
                response.status === 403
            ) {

                localStorage.removeItem(
                    'token'
                );

                navigate(
                    '/login'
                );

                return;
            }


            const data =
                await response.json();


            if (
                response.ok &&
                Array.isArray(
                    data.foods
                )
            ) {

                setNutritionFoods(
                    data.foods
                );

            }

        } catch (error) {

            console.error(
                'Nutrition food loading error:',
                error
            );

        }

    }


    // ==================================================
    // NORMALIZED TOP PREDICTIONS
    // ==================================================

    const topPredictions =
        useMemo(
            () => {

                if (
                    !mealAnalysis?.classification
                ) {

                    return [];
                }


                const classification =
                    mealAnalysis.classification;


                const possibleLists = [

                    classification.top3,

                    classification.top_predictions,

                    classification.predictions,

                    classification.results

                ];


                const found =
                    possibleLists.find(
                        Array.isArray
                    );


                if (found) {

                    return found
                        .map(
                            (
                                prediction
                            ) => ({

                                item:
                                    prediction.item ||
                                    prediction.label ||
                                    prediction.name ||
                                    prediction.class_name ||
                                    '',

                                confidence:
                                    normalizeConfidence(
                                        prediction.confidence ??
                                        prediction.score ??
                                        prediction.probability
                                    )

                            })
                        )
                        .filter(
                            (
                                prediction
                            ) =>
                                prediction.item
                        )
                        .slice(
                            0,
                            3
                        );

                }


                const primary =
                    classification.prediction;


                if (primary) {

                    return [

                        {

                            item:
                                primary.item ||
                                primary.label ||
                                primary.name ||
                                primary.class_name ||
                                '',

                            confidence:
                                normalizeConfidence(
                                    primary.confidence ??
                                    primary.score ??
                                    primary.probability
                                )

                        }

                    ].filter(
                        (
                            prediction
                        ) =>
                            prediction.item
                    );

                }


                return [];

            },

            [
                mealAnalysis
            ]
        );


    const primaryPrediction =
        mealAnalysis
            ?.classification
            ?.prediction;


    const primaryConfidence =
        normalizeConfidence(

            primaryPrediction
                ?.confidence ??
            primaryPrediction
                ?.score ??
            primaryPrediction
                ?.probability

        );


    // ==================================================
    // MEAL IMAGE SELECT
    // ==================================================

    function handleMealFile(
        file
    ) {

        if (!file) {

            return;
        }


        
    const allowedMealImageTypes = [
        'image/jpeg',
        'image/png',
        'image/webp'
    ];

    if (!allowedMealImageTypes.includes(file.type)) {

        setScannerError(
            'Please choose a JPEG, PNG or WebP meal photo.'
        );

        return;
    }

    if (file.size > 5 * 1024 * 1024) {

        setScannerError(
            'Meal photo must be 5 MB or smaller.'
        );

        return;
    }



        setScannerError(
            ''
        );


        setMealFile(
            file
        );


        setMealAnalysis(
            null
        );


        setNutritionResult(
            null
        );


        setSelectedFoodKey(
            ''
        );


        setMealLogged(
            false
        );


        createPreview(
            file,
            setMealPreview
        );


        analyzeMeal(
            file
        );

    }


    // ==================================================
    // ANALYZE MALAYSIAN MEAL
    // ==================================================

    async function analyzeMeal(
        fileToAnalyze =
            mealFile
    ) {

        if (!fileToAnalyze) {

            return;
        }


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

            setMealAnalyzing(
                true
            );


            setScannerError(
                ''
            );


            setMealLogged(
                false
            );


            const formData =
                new FormData();


            formData.append(
                'image',
                fileToAnalyze
            );


            const response =
                await fetch(

                    `${API_BASE_URL}/api/analyze-meal`,

                    {

                        method:
                            'POST',

                        headers: {

                            Authorization:
                                `Bearer ${token}`

                        },

                        body:
                            formData

                    }

                );


            const data =
                await response.json();


            if (
                response.status === 401 ||
                response.status === 403
            ) {

                localStorage.removeItem(
                    'token'
                );


                navigate(
                    '/login'
                );

                return;
            }


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    'Unable to analyze meal.'
                );
            }


            setMealAnalysis(
                data
            );


            if (
                data.nutritionAvailable &&
                data.nutritionReference
            ) {

                const foodKey =
                    data
                        .nutritionReference
                        .foodKey;


                setSelectedFoodKey(
                    foodKey
                );


                setSelectedPortion(
                    'regular'
                );


                setUseCustomPortion(
                    false
                );


                await calculateNutrition(
                    foodKey,
                    'regular',
                    ''
                );

            
            } else {

                // The AI predicted a food, but the nutrition
                // database does not contain an exact match.
                // Do not select another food automatically.

                setSelectedFoodKey('');

                setNutritionResult(null);

                setSelectedPortion('regular');

                setUseCustomPortion(false);

                setCustomPortion('');

            }



        } catch (error) {

            console.error(
                'Meal analysis error:',
                error
            );


            setScannerError(
                error.message
            );


        } finally {

            setMealAnalyzing(
                false
            );

        }

    }


    // ==================================================
    // CALCULATE NUTRITION
    // ==================================================

    async function calculateNutrition(

        foodKey =
            selectedFoodKey,

        portion =
            selectedPortion,

        grams =
            customPortion

    ) {

        if (!foodKey) {

            return;
        }


        const token =
            localStorage.getItem(
                'token'
            );


        try {

            setCalculatingNutrition(
                true
            );


            setScannerError(
                ''
            );


            const requestBody = {

                foodKey

            };


            if (
                useCustomPortion &&
                grams !==
                ''
            ) {

                requestBody.portionGrams =
                    Number(
                        grams
                    );

            } else {

                requestBody.portion =
                    portion;

            }


            const response =
                await fetch(

                    `${API_BASE_URL}/api/calculate-nutrition`,

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
                            JSON.stringify(
                                requestBody
                            )

                    }

                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    'Unable to calculate nutrition.'
                );
            }


            setNutritionResult(
                data
            );


            setMealLogged(
                false
            );


        } catch (error) {

            setNutritionResult(
                null
            );


            setScannerError(
                error.message
            );


        } finally {

            setCalculatingNutrition(
                false
            );

        }

    }


    // ==================================================
    // FOOD SELECTION CHANGE
    // ==================================================

    async function changeFood(
        foodKey
    ) {

        setSelectedFoodKey(
            foodKey
        );


        setUseCustomPortion(
            false
        );


        setCustomPortion(
            ''
        );


        setSelectedPortion(
            'regular'
        );


        await calculateNutrition(
            foodKey,
            'regular',
            ''
        );

    }


    // ==================================================
    // PORTION CHANGE
    // ==================================================

    async function changePortion(
        portion
    ) {

        setUseCustomPortion(
            false
        );


        setCustomPortion(
            ''
        );


        setSelectedPortion(
            portion
        );


        await calculateNutrition(
            selectedFoodKey,
            portion,
            ''
        );

    }


    // ==================================================
    // CUSTOM PORTION
    // ==================================================

    async function applyCustomPortion() {

        if (
            !customPortion ||
            Number(
                customPortion
            ) <=
            0
        ) {

            setScannerError(
                'Enter a valid portion weight in grams.'
            );

            return;
        }


        setUseCustomPortion(
            true
        );


        const token =
            localStorage.getItem(
                'token'
            );


        try {

            setCalculatingNutrition(
                true
            );


            setScannerError(
                ''
            );


            const response =
                await fetch(

                    `${API_BASE_URL}/api/calculate-nutrition`,

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
                                    selectedFoodKey,

                                portionGrams:
                                    Number(
                                        customPortion
                                    )

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


            setNutritionResult(
                data
            );


            setMealLogged(
                false
            );


        } catch (error) {

            setScannerError(
                error.message
            );


        } finally {

            setCalculatingNutrition(
                false
            );

        }

    }


    
    // ======================================================
    // LOG MEAL TO DIARY WITH ORIGINAL UPLOADED PHOTO
    // ======================================================

    async function logMeal() {

        if (loggingMeal || mealLogged) {
            return;
        }

        // ==============================================
        // CHECK NUTRITION RESULT
        // ==============================================

        if (!nutritionResult) {

            setScannerError(
                'Calculate meal nutrition before logging it.'
            );

            return;
        }

        // ==============================================
        // CHECK ORIGINAL PHOTO
        // ==============================================

        if (!mealFile) {

            setScannerError(
                'Please choose a meal photo first.'
            );

            return;
        }

        const allowedTypes = [
            'image/jpeg',
            'image/png',
            'image/webp'
        ];

        if (!allowedTypes.includes(mealFile.type)) {

            setScannerError(
                'Choose a JPEG, PNG or WebP meal photo.'
            );

            return;
        }

        if (mealFile.size > 5 * 1024 * 1024) {

            setScannerError(
                'Meal photo must be 5 MB or smaller.'
            );

            return;
        }

        // ==============================================
        // CHECK LOGIN TOKEN
        // ==============================================

        const token = localStorage.getItem('token');

        if (!token) {

            navigate('/login');

            return;
        }

        // ==============================================
        // GET AI CONFIDENCE
        // ==============================================

        const prediction =
            mealAnalysis?.classification?.prediction;

        const confidence = normalizeConfidenceRaw(
            prediction?.confidence ??
            prediction?.score ??
            prediction?.probability
        );

        // ==============================================
        // PREPARE MULTIPART FORM DATA
        //
        // IMPORTANT:
        // Send mealFile, not mealPreview.
        // ==============================================

        const formData = new FormData();

        // ORIGINAL UPLOADED PHOTO
        formData.append(
            'image',
            mealFile,
            mealFile.name
        );

        // FOOD INFORMATION
        formData.append(
            'foodKey',
            nutritionResult.food.foodKey || ''
        );

        formData.append(
            'foodName',
            nutritionResult.food.displayName
        );

        formData.append(
            'mealType',
            mealType
        );

        formData.append(
            'sourceType',
            'meal_scanner'
        );

        // PORTION INFORMATION
        const grams = nutritionResult.portion?.grams;

        if (grams !== null && grams !== undefined) {

            formData.append(
                'portionGrams',
                String(grams)
            );
        }

        // ==============================================
        // NUTRITION RESULTS
        // ==============================================

        formData.append(
            'calories',
            String(nutritionResult.nutrition.calories)
        );

        formData.append(
            'protein',
            String(nutritionResult.nutrition.protein ?? 0)
        );

        formData.append(
            'carbs',
            String(nutritionResult.nutrition.carbs ?? 0)
        );

        formData.append(
            'fat',
            String(nutritionResult.nutrition.fat ?? 0)
        );

        // AI CONFIDENCE IS OPTIONAL
        if (confidence !== null) {

            formData.append(
                'aiConfidence',
                String(confidence)
            );
        }

        // ==============================================
        // SEND MEAL AND IMAGE TO BACKEND
        // ==============================================

        try {

            setLoggingMeal(true);

            setScannerError('');

            setPageMessage('');

            const response = await fetch(
                `${API_BASE_URL}/api/meal-logs`,
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

            // ==========================================
            // HANDLE EXPIRED LOGIN
            // ==========================================

            if (
                response.status === 401 ||
                response.status === 403
            ) {

                localStorage.removeItem('token');

                navigate('/login');

                return;
            }

            // ==========================================
            // CHECK SAVE RESULT
            // ==========================================

            if (
                !response.ok ||
                data.success !== true
            ) {

                throw new Error(
                    data.message ||
                    'Unable to log meal.'
                );
            }

            // ==========================================
            // SUCCESS
            // ==========================================

            setMealLogged(true);

            setPageMessage(
                `${nutritionResult.food.displayName} was added to today's ${mealType}.`
            );

        } catch (error) {

            setScannerError(
                error.message ||
                'Unable to log meal.'
            );

        } finally {

            setLoggingMeal(false);

        }
    }



    // ==================================================
    // RESET MEAL SCANNER
    // ==================================================

    function resetMealScanner() {

        setMealFile(
            null
        );


        setMealPreview(
            ''
        );


        setMealAnalysis(
            null
        );


        setSelectedFoodKey(
            ''
        );


        setSelectedPortion(
            'regular'
        );


        setCustomPortion(
            ''
        );


        setUseCustomPortion(
            false
        );


        setNutritionResult(
            null
        );


        setMealLogged(
            false
        );


        setScannerError(
            ''
        );


        setPageMessage(
            ''
        );

    }


    // ==================================================
    // RAW INGREDIENT FILE
    // ==================================================

    function handleIngredientFile(
        file
    ) {

        if (!file) {

            return;
        }


        if (
            !file.type.startsWith(
                'image/'
            )
        ) {

            setScannerError(
                'Please choose an image file.'
            );

            return;
        }


        setIngredientFile(
            file
        );


        setIngredients(
            []
        );


        setRecipeOptions(
            []
        );


        createPreview(
            file,
            setIngredientPreview
        );


        scanIngredients(
            file
        );

    }


    // ==================================================
    // SCAN INGREDIENTS
    // ==================================================

    async function scanIngredients(
        fileToScan =
            ingredientFile
    ) {

        if (!fileToScan) {

            return;
        }


        try {

            setIngredientScanning(
                true
            );


            setScannerError(
                ''
            );


            setRecipeOptions(
                []
            );


            const formData =
                new FormData();


            formData.append(
                'image',
                fileToScan
            );


            const response =
                await fetch(

                    `${API_BASE_URL}/api/scan-food`,

                    {

                        method:
                            'POST',

                        body:
                            formData

                    }

                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    'Ingredient scan failed.'
                );
            }


            const possibleResults = [

                data.results,
                data.ingredients,
                data.detections

            ];


            const resultList =
                possibleResults.find(
                    Array.isArray
                ) ||
                [];


            const cleaned =
                resultList

                    .map(
                        (
                            result
                        ) => ({

                            name:
                                result.item ||
                                result.name ||
                                result.label ||
                                result.class_name ||
                                '',

                            confidence:
                                normalizeConfidence(

                                    result.confidence ??
                                    result.score ??
                                    result.probability

                                ),

                            source:
                                'ai'

                        })
                    )

                    .filter(
                        (
                            result
                        ) =>
                            result.name
                    );


            const unique =
                [];


            const seen =
                new Set();


            cleaned.forEach(
                (
                    item
                ) => {

                    const key =
                        item.name
                            .trim()
                            .toLowerCase();


                    if (
                        !seen.has(
                            key
                        )
                    ) {

                        seen.add(
                            key
                        );


                        unique.push(
                            item
                        );

                    }

                }
            );


            setIngredients(
                unique
            );


            if (
                unique.length ===
                0
            ) {

                setScannerError(
                    'No ingredients were confidently detected. You can add ingredients manually below.'
                );

            }


        } catch (error) {

            console.error(
                'Ingredient scanner error:',
                error
            );


            setScannerError(
                error.message
            );


        } finally {

            setIngredientScanning(
                false
            );

        }

    }


    // ==================================================
    // REMOVE INGREDIENT
    // ==================================================

    function removeIngredient(
        index
    ) {

        setIngredients(
            (
                current
            ) =>
                current.filter(
                    (
                        _,
                        ingredientIndex
                    ) =>
                        ingredientIndex !==
                        index
                )
        );


        setRecipeOptions(
            []
        );

    }


    // ==================================================
    // ADD INGREDIENT MANUALLY
    // ==================================================

    function addIngredient() {

        const cleaned =
            newIngredient.trim();


        if (!cleaned) {

            return;
        }


        const alreadyExists =
            ingredients.some(
                (
                    ingredient
                ) =>
                    ingredient
                        .name
                        .toLowerCase() ===
                    cleaned.toLowerCase()
            );


        if (alreadyExists) {

            setNewIngredient(
                ''
            );

            return;
        }


        setIngredients(
            (
                current
            ) => [

                ...current,

                {

                    name:
                        cleaned,

                    confidence:
                        null,

                    source:
                        'manual'

                }

            ]
        );


        setNewIngredient(
            ''
        );


        setRecipeOptions(
            []
        );

    }


    // ==================================================
    // GENERATE RECIPE OPTIONS
    // ==================================================

    async function generateRecipes() {

        const ingredientNames =
            ingredients

                .map(
                    (
                        ingredient
                    ) =>
                        ingredient.name
                )

                .filter(
                    Boolean
                );


        if (
            ingredientNames.length ===
            0
        ) {

            setScannerError(
                'Add at least one ingredient before generating recipes.'
            );

            return;
        }


        const token =
            localStorage.getItem(
                'token'
            );


        try {

            setGeneratingOptions(
                true
            );


            setScannerError(
                ''
            );


            const response =
                await fetch(

                    `${API_BASE_URL}/api/generate-recipe-options`,

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

                                ingredients:
                                    ingredientNames

                            })

                    }

                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    'Unable to generate recipe recommendations.'
                );
            }


            setRecipeOptions(
                Array.isArray(
                    data.recipes
                )
                    ? data.recipes
                    : []
            );


        } catch (error) {

            setScannerError(
                error.message
            );


        } finally {

            setGeneratingOptions(
                false
            );

        }

    }


    // ==================================================
    // SELECT RECIPE
    // ==================================================

    async function selectRecipe(
        recipe,
        index
    ) {

        const ingredientNames =
            ingredients.map(
                (
                    ingredient
                ) =>
                    ingredient.name
            );


        const token =
            localStorage.getItem(
                'token'
            );


        try {

            setPreparingRecipeIndex(
                index
            );


            setScannerError(
                ''
            );


            const response =
                await fetch(

                    `${API_BASE_URL}/api/generate-recipe-detail`,

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

                                ingredients:
                                    ingredientNames,

                                selectedOption:
                                    recipe

                            })

                    }

                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    'Unable to prepare the selected recipe.'
                );
            }


            sessionStorage.setItem(

                'generatedRecipe',

                JSON.stringify(
                    data.recipe
                )

            );


            sessionStorage.setItem(

                'recipeIngredients',

                JSON.stringify(
                    ingredientNames
                )

            );


            navigate(
                '/recipe/generated'
            );


        } catch (error) {

            setScannerError(
                error.message
            );


        } finally {

            setPreparingRecipeIndex(
                null
            );

        }

    }


    // ==================================================
    // RESET INGREDIENT SCANNER
    // ==================================================

    function resetIngredientScanner() {

        setIngredientFile(
            null
        );


        setIngredientPreview(
            ''
        );


        setIngredients(
            []
        );


        setNewIngredient(
            ''
        );


        setRecipeOptions(
            []
        );


        setScannerError(
            ''
        );

    }


    // ==================================================
    // PAGE
    // ==================================================

    return (

        <div
            className="ai-scanner-page"
        >

            <style>
                {scannerCss}
            </style>


            {/* =========================================
                HEADER
            ========================================= */}

            <div
                className="scanner-page-header"
            >

                <div>

                    <h1>
                        AI Scanner
                    </h1>


                    <p>
                        Recognize Malaysian meals, estimate nutrition, or scan raw ingredients for AI-powered recipes.
                    </p>

                </div>

            </div>


            {/* =========================================
                TABS
            ========================================= */}

            <div
                className="scanner-tabs-wrap"
            >

                <div
                    className="scanner-tabs"
                >

                    <button

                        type="button"

                        className={
                            activeTab ===
                            'calorie'
                                ? 'scanner-tab active'
                                : 'scanner-tab'
                        }

                        onClick={() => {

                            setActiveTab(
                                'calorie'
                            );

                            setScannerError(
                                ''
                            );

                        }}
                    >
                        🔥 Meal Calorie Estimator
                    </button>


                    <button

                        type="button"

                        className={
                            activeTab ===
                            'ingredients'
                                ? 'scanner-tab active'
                                : 'scanner-tab'
                        }

                        onClick={() => {

                            setActiveTab(
                                'ingredients'
                            );

                            setScannerError(
                                ''
                            );

                        }}
                    >
                        🥕 Raw Ingredient Scanner
                    </button>

                </div>

            </div>


            {/* =========================================
                GLOBAL MESSAGE
            ========================================= */}

            {pageMessage && (

                <div
                    className="success-message"
                >
                    ✓ {pageMessage}
                </div>

            )}


            {scannerError && (

                <div
                    className="scanner-error"
                >
                    ⚠ {scannerError}
                </div>

            )}


            {/* =========================================
                CALORIE SCANNER
            ========================================= */}

            {activeTab ===
                'calorie' && (

                <div>

                    {!mealFile && (

                        <ImageUploader

                            title="Scan Your Meal"

                            description="Upload a photo of a Malaysian meal. WellSmartBook will identify the dish and estimate calories and macronutrients."

                            buttonText="Choose Meal Photo"

                            onFile={
                                handleMealFile
                            }
                        />

                    )}


                    {mealFile && (

                        <div
                            className="meal-analysis-grid"
                        >

                            {/* =========================
                                IMAGE SIDE
                            ========================= */}

                            <div>

                                <div
                                    className="meal-image-card"
                                >

                                    <img

                                        src={
                                            mealPreview
                                        }

                                        alt="Selected meal"

                                    />


                                    {mealAnalyzing && (

                                        <div
                                            className="image-processing-overlay"
                                        >

                                            <div
                                                className="loading-spinner"
                                            />


                                            <strong>
                                                AI analyzing meal...
                                            </strong>


                                            <span>
                                                Running Malaysian food recognition
                                            </span>

                                        </div>

                                    )}


                                    
                                    {!mealAnalyzing && mealAnalysis && (

                                        <div
                                            className="image-recognized-badge"
                                            style={
                                                !mealAnalysis.nutritionAvailable
                                                    ? { background: '#b45309' }
                                                    : undefined
                                            }
                                        >
                                            {mealAnalysis.nutritionAvailable
                                                ? 'Nutrition match found'
                                                : 'AI prediction only'}
                                        </div>

                                    )}


                                </div>


                                <div
                                    className="image-actions"
                                >

                                    <label
                                        className="blue-button"
                                    >
                                        Choose Another Meal

                                        <input

                                            type="file"

                                            accept="image/*"

                                            hidden

                                            onChange={
                                                (
                                                    event
                                                ) =>
                                                    handleMealFile(
                                                        event
                                                            .target
                                                            .files?.[0]
                                                    )
                                            }

                                        />

                                    </label>


                                    <button

                                        type="button"

                                        className="outline-button"

                                        onClick={
                                            resetMealScanner
                                        }
                                    >
                                        Reset
                                    </button>

                                </div>

                            </div>


                            {/* =========================
                                RESULT SIDE
                            ========================= */}

                            <div
                                className="meal-result-column"
                            >

                                {mealAnalyzing && (

                                    <ResultLoadingCard />

                                )}


                                {!mealAnalyzing &&
                                    mealAnalysis && (

                                    <>

                                        {/* AI RESULT */}

                                        <div
                                            className="result-card"
                                        >

                                            <div
                                                className="result-card-heading"
                                            >

                                                <div>

                                                    <span
                                                        className="small-label"
                                                    >
                                                        AI PREDICTION
                                                    </span>


                                                    <h2>
                                                        {
                                                            formatFoodName(

                                                                primaryPrediction
                                                                    ?.item ||
                                                                primaryPrediction
                                                                    ?.label ||
                                                                selectedFoodKey ||
                                                                'Meal'

                                                            )
                                                        }
                                                    </h2>


                                                    <p>
                                                        Confidence:{' '}

                                                        <strong
                                                            className="green-text"
                                                        >
                                                            {
                                                                Math.round(
                                                                    primaryConfidence
                                                                )
                                                            }%
                                                        </strong>
                                                    </p>

                                                </div>


                                                
                                                <div
                                                    className="recognized-pill"
                                                    style={
                                                        !mealAnalysis.nutritionAvailable
                                                            ? {
                                                                background: '#fff7ed',
                                                                color: '#9a3412'
                                                            }
                                                            : undefined
                                                    }
                                                >
                                                    {mealAnalysis.nutritionAvailable
                                                        ? 'Nutrition match'
                                                        : 'No nutrition match'}
                                                </div>


                                            </div>


                                            {topPredictions.length >
                                                0 && (

                                                <div>

                                                    <div
                                                        className="top-predictions-title"
                                                    >
                                                        TOP PREDICTIONS
                                                    </div>


                                                    <div
                                                        className="prediction-chips"
                                                    >

                                                        {topPredictions.map(
                                                            (
                                                                prediction,
                                                                index
                                                            ) => (

                                                                <button

                                                                    type="button"

                                                                    key={
                                                                        `${prediction.item}-${index}`
                                                                    }

                                                                    className="prediction-chip"

                                                                    onClick={() => {

                                                                        const predictionKey =
                                                                            normalizeFoodKey(
                                                                                prediction.item
                                                                            );


                                                                        const supported =
                                                                            nutritionFoods.find(
                                                                                (
                                                                                    food
                                                                                ) =>
                                                                                    food.foodKey ===
                                                                                    predictionKey
                                                                            );


                                                                        if (supported) {

                                                                            changeFood(
                                                                                predictionKey
                                                                            );

                                                                        }

                                                                    }}
                                                                >
                                                                    {
                                                                        formatFoodName(
                                                                            prediction.item
                                                                        )
                                                                    }

                                                                    {' '}

                                                                    {
                                                                        Math.round(
                                                                            prediction.confidence
                                                                        )
                                                                    }%
                                                                </button>

                                                            )
                                                        )}

                                                    </div>

                                                </div>

                                            )}

                                        </div>


                                        {/* NUTRITION WARNING */}

                                        {!mealAnalysis
                                            .nutritionAvailable && (

                                            <div
                                                className="info-message"
                                            >
                                                
                                                The AI predicted a dish, but there is no matching nutrition record. Calories cannot be calculated automatically. Only correct the food manually if the photo really shows a supported dish.

                                            </div>

                                        )}


                                        
                                        {/* ============================================
                                            OPTIONAL FOOD CORRECTION
                                            AUTOMATIC RECOGNITION IS THE DEFAULT
                                        ============================================ */}

                                        <details className="result-card">

                                            <summary
                                                className="field-label"
                                                style={{ cursor: 'pointer' }}
                                            >
                                                Correct food manually (optional)
                                            </summary>

                                            <select
                                                value={selectedFoodKey}
                                                onChange={(event) =>
                                                    changeFood(event.target.value)
                                                }
                                                className="scanner-select"
                                                aria-label="Choose the actual food, only if different"
                                            >

                                                <option value="">
                                                    Select only if the photo matches
                                                </option>

                                                {nutritionFoods.map((food) => (

                                                    <option
                                                        key={food.foodKey}
                                                        value={food.foodKey}
                                                    >
                                                        {food.displayName}
                                                    </option>

                                                ))}

                                            </select>

                                        </details>


                                        {/* PORTION */}

                                        {selectedFoodKey && (

                                            <div
                                                className="result-card"
                                            >

                                                <div
                                                    className="field-label"
                                                >
                                                    Portion Size
                                                </div>


                                                <div
                                                    className="portion-buttons"
                                                >

                                                    {[
                                                        'small',
                                                        'regular',
                                                        'large'
                                                    ].map(
                                                        (
                                                            portion
                                                        ) => (

                                                            <button

                                                                type="button"

                                                                key={
                                                                    portion
                                                                }

                                                                className={
                                                                    !useCustomPortion &&
                                                                    selectedPortion ===
                                                                    portion
                                                                        ? 'portion-button active'
                                                                        : 'portion-button'
                                                                }

                                                                onClick={() =>
                                                                    changePortion(
                                                                        portion
                                                                    )
                                                                }
                                                            >
                                                                {
                                                                    capitalize(
                                                                        portion
                                                                    )
                                                                }
                                                            </button>

                                                        )
                                                    )}

                                                </div>


                                                <div
                                                    className="custom-portion-row"
                                                >

                                                    <input

                                                        type="number"

                                                        min="1"

                                                        max="2000"

                                                        value={
                                                            customPortion
                                                        }

                                                        onChange={
                                                            (
                                                                event
                                                            ) =>
                                                                setCustomPortion(
                                                                    event.target.value
                                                                )
                                                        }

                                                        placeholder="Custom grams"

                                                        className="custom-portion-input"
                                                    />


                                                    <button

                                                        type="button"

                                                        className="small-outline-button"

                                                        onClick={
                                                            applyCustomPortion
                                                        }
                                                    >
                                                        Apply
                                                    </button>

                                                </div>

                                            </div>

                                        )}


                                        {/* NUTRITION RESULT */}

                                        {calculatingNutrition && (

                                            <div
                                                className="result-card center-card"
                                            >
                                                Calculating nutrition...
                                            </div>

                                        )}


                                        {!calculatingNutrition &&
                                            nutritionResult && (

                                            <NutritionResult

                                                result={
                                                    nutritionResult
                                                }

                                            />

                                        )}


                                        {/* MEAL TYPE */}

                                        {nutritionResult && (

                                            <div
                                                className="result-card"
                                            >

                                                <div
                                                    className="field-label"
                                                >
                                                    Add To
                                                </div>


                                                <div
                                                    className="meal-type-buttons"
                                                >

                                                    {[
                                                        'breakfast',
                                                        'lunch',
                                                        'dinner',
                                                        'snack'
                                                    ].map(
                                                        (
                                                            type
                                                        ) => (

                                                            <button

                                                                type="button"

                                                                key={
                                                                    type
                                                                }

                                                                onClick={() =>
                                                                    setMealType(
                                                                        type
                                                                    )
                                                                }

                                                                className={
                                                                    mealType ===
                                                                    type
                                                                        ? 'meal-type-button active'
                                                                        : 'meal-type-button'
                                                                }
                                                            >
                                                                {
                                                                    mealTypeIcon(
                                                                        type
                                                                    )
                                                                }

                                                                {' '}

                                                                {
                                                                    capitalize(
                                                                        type
                                                                    )
                                                                }
                                                            </button>

                                                        )
                                                    )}

                                                </div>


                                                <button

                                                    type="button"

                                                    disabled={
                                                        loggingMeal ||
                                                        mealLogged
                                                    }

                                                    className={
                                                        mealLogged
                                                            ? 'log-button logged'
                                                            : 'log-button'
                                                    }

                                                    onClick={
                                                        logMeal
                                                    }
                                                >

                                                    {mealLogged
                                                        ? '✓ Added to Daily Diary'
                                                        : loggingMeal
                                                            ? 'Saving Meal...'
                                                            : '✓ Log Meal to Diary'}

                                                </button>


                                                {mealLogged && (

                                                    <button

                                                        type="button"

                                                        className="dashboard-link-button"

                                                        onClick={() =>
                                                            navigate(
                                                                '/dashboard'
                                                            )
                                                        }
                                                    >
                                                        View Updated Dashboard →
                                                    </button>

                                                )}

                                            </div>

                                        )}

                                    </>

                                )}

                            </div>

                        </div>

                    )}

                </div>

            )}


            {/* =========================================
                RAW INGREDIENT SCANNER
            ========================================= */}

            {activeTab ===
                'ingredients' && (

                <div>

                    {!ingredientFile && (

                        <ImageUploader

                            title="Scan Your Pantry"

                            description="Upload a photo of your raw ingredients. WellSmartBook will detect what you have, let you correct the AI, and generate recipe ideas."

                            buttonText="Upload Raw Ingredients"

                            onFile={
                                handleIngredientFile
                            }
                        />

                    )}


                    {ingredientFile && (

                        <div>

                            <div
                                className="ingredient-layout"
                            >

                                {/* IMAGE */}

                                <div>

                                    <div
                                        className="ingredient-image-card"
                                    >

                                        <img

                                            src={
                                                ingredientPreview
                                            }

                                            alt="Raw ingredients"

                                        />


                                        {ingredientScanning && (

                                            <div
                                                className="image-processing-overlay"
                                            >

                                                <div
                                                    className="loading-spinner"
                                                />


                                                <strong>
                                                    Detecting ingredients...
                                                </strong>


                                                <span>
                                                    Running ingredient recognition
                                                </span>

                                            </div>

                                        )}

                                    </div>


                                    <div
                                        className="image-actions"
                                    >

                                        <label
                                            className="blue-button"
                                        >
                                            Choose Another Photo

                                            <input

                                                hidden

                                                type="file"

                                                accept="image/*"

                                                onChange={
                                                    (
                                                        event
                                                    ) =>
                                                        handleIngredientFile(
                                                            event
                                                                .target
                                                                .files?.[0]
                                                        )
                                                }

                                            />

                                        </label>


                                        <button

                                            type="button"

                                            className="outline-button"

                                            onClick={
                                                resetIngredientScanner
                                            }
                                        >
                                            Reset
                                        </button>

                                    </div>

                                </div>


                                {/* DETECTED INGREDIENTS */}

                                <div
                                    className="result-card ingredient-result-card"
                                >

                                    <span
                                        className="small-label"
                                    >
                                        HUMAN-IN-THE-LOOP CHECK
                                    </span>


                                    <h2>
                                        Detected Ingredients
                                    </h2>


                                    <p
                                        className="muted-text"
                                    >
                                        Remove anything the AI got wrong and add missing ingredients before generating recipes.
                                    </p>


                                    {ingredients.length ===
                                        0 &&
                                        !ingredientScanning && (

                                        <div
                                            className="empty-ingredient-state"
                                        >
                                            No ingredients listed yet.
                                        </div>

                                    )}


                                    <div
                                        className="ingredient-tags"
                                    >

                                        {ingredients.map(
                                            (
                                                ingredient,
                                                index
                                            ) => (

                                                <div
                                                    key={`${ingredient.name}-${index}`}
                                                    className="ingredient-tag"
                                                >

                                                    <div>

                                                        <strong>
                                                            {
                                                                formatFoodName(
                                                                    ingredient.name
                                                                )
                                                            }
                                                        </strong>


                                                        {ingredient
                                                            .confidence !==
                                                            null && (

                                                            <span>
                                                                {
                                                                    Math.round(
                                                                        ingredient.confidence
                                                                    )
                                                                }%
                                                            </span>

                                                        )}


                                                        {ingredient
                                                            .source ===
                                                            'manual' && (

                                                            <span>
                                                                Added
                                                            </span>

                                                        )}

                                                    </div>


                                                    <button

                                                        type="button"

                                                        onClick={() =>
                                                            removeIngredient(
                                                                index
                                                            )
                                                        }
                                                    >
                                                        ×
                                                    </button>

                                                </div>

                                            )
                                        )}

                                    </div>


                                    <div
                                        className="add-ingredient-row"
                                    >

                                        <input

                                            type="text"

                                            placeholder="Add missing ingredient..."

                                            value={
                                                newIngredient
                                            }

                                            onChange={
                                                (
                                                    event
                                                ) =>
                                                    setNewIngredient(
                                                        event.target.value
                                                    )
                                            }

                                            onKeyDown={
                                                (
                                                    event
                                                ) => {

                                                    if (
                                                        event.key ===
                                                        'Enter'
                                                    ) {

                                                        event.preventDefault();


                                                        addIngredient();

                                                    }

                                                }
                                            }
                                        />


                                        <button

                                            type="button"

                                            onClick={
                                                addIngredient
                                            }
                                        >
                                            + Add
                                        </button>

                                    </div>


                                    <button

                                        type="button"

                                        disabled={
                                            generatingOptions ||
                                            ingredientScanning ||
                                            ingredients.length ===
                                            0
                                        }

                                        className="generate-recipe-button"

                                        onClick={
                                            generateRecipes
                                        }
                                    >

                                        {generatingOptions
                                            ? 'Gemini is preparing ideas...'
                                            : '✨ Generate Recipe Ideas'}

                                    </button>


                                    <p
                                        className="tiny-note"
                                    >
                                        Your current Gemini free-tier quota may temporarily prevent recipe generation. Ingredient scanning will still work normally.
                                    </p>

                                </div>

                            </div>


                            {/* RECIPE OPTIONS */}

                            {recipeOptions.length >
                                0 && (

                                <section
                                    className="recipe-options-section"
                                >

                                    <div
                                        className="recipe-options-heading"
                                    >

                                        <div>

                                            <span
                                                className="small-label"
                                            >
                                                GEMINI AI
                                            </span>


                                            <h2>
                                                Choose a Recipe
                                            </h2>


                                            <p>
                                                Select one idea to create the complete cooking guide.
                                            </p>

                                        </div>

                                    </div>


                                    <div
                                        className="recipe-option-grid"
                                    >

                                        {recipeOptions.map(
                                            (
                                                recipe,
                                                index
                                            ) => (

                                                <div

                                                    key={`${recipe.title}-${index}`}

                                                    className="recipe-option-card"
                                                >

                                                    <div
                                                        className="recipe-number"
                                                    >
                                                        {
                                                            index +
                                                            1
                                                        }
                                                    </div>


                                                    <h3>
                                                        {
                                                            recipe.title
                                                        }
                                                    </h3>


                                                    <p>
                                                        {
                                                            recipe.description
                                                        }
                                                    </p>


                                                    <div
                                                        className="recipe-meta"
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
                                                            🔥 {
                                                                Math.round(
                                                                    recipe.estimatedCalories ||
                                                                    0
                                                                )
                                                            } kcal
                                                        </span>

                                                    </div>


                                                    <div
                                                        className="recipe-tags"
                                                    >

                                                        {(
                                                            recipe.tags ||
                                                            []
                                                        ).map(
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

                                                        type="button"

                                                        disabled={
                                                            preparingRecipeIndex !==
                                                            null
                                                        }

                                                        className="select-recipe-button"

                                                        onClick={() =>
                                                            selectRecipe(
                                                                recipe,
                                                                index
                                                            )
                                                        }
                                                    >

                                                        {preparingRecipeIndex ===
                                                        index
                                                            ? 'Preparing Recipe...'
                                                            : 'Cook This Recipe →'}

                                                    </button>

                                                </div>

                                            )
                                        )}

                                    </div>

                                </section>

                            )}

                        </div>

                    )}

                </div>

            )}

        </div>

    );

}


// ======================================================
// IMAGE UPLOADER
// ======================================================

function ImageUploader({

    title,
    description,
    buttonText,
    onFile

}) {

    const inputRef =
        useRef(null);


    const [
        dragging,
        setDragging
    ] = useState(false);


    return (

        <div

            className={
                dragging
                    ? 'upload-zone dragging'
                    : 'upload-zone'
            }

            onDragOver={
                (
                    event
                ) => {

                    event.preventDefault();


                    setDragging(
                        true
                    );

                }
            }

            onDragLeave={() =>
                setDragging(
                    false
                )
            }

            onDrop={
                (
                    event
                ) => {

                    event.preventDefault();


                    setDragging(
                        false
                    );


                    onFile(
                        event
                            .dataTransfer
                            .files?.[0]
                    );

                }
            }
        >

            <div
                className="upload-icon"
            >
                📷
            </div>


            <h2>
                {title}
            </h2>


            <p>
                {description}
            </p>


            <button

                type="button"

                className="blue-button"

                onClick={() =>
                    inputRef
                        .current
                        ?.click()
                }
            >
                📷 {buttonText}
            </button>


            <span
                className="upload-hint"
            >
                or drag and drop an image here
            </span>


            <input

                ref={
                    inputRef
                }

                hidden

                type="file"

                accept="image/*"

                onChange={
                    (
                        event
                    ) =>
                        onFile(
                            event
                                .target
                                .files?.[0]
                        )
                }

            />

        </div>

    );

}


// ======================================================
// LOADING RESULT
// ======================================================

function ResultLoadingCard() {

    return (

        <div
            className="result-card loading-result-card"
        >

            <div
                className="loading-spinner"
            />


            <h3>
                Analyzing Meal
            </h3>


            <p>
                Recognizing the dish and checking nutrition reference data...
            </p>

        </div>

    );

}


// ======================================================
// NUTRITION RESULT
// ======================================================

function NutritionResult({
    result
}) {

    const nutrition =
        result.nutrition;


    return (

        <div
            className="nutrition-result-card"
        >

            <span
                className="small-label"
            >
                ESTIMATED TOTAL CALORIES
            </span>


            <div
                className="total-calories"
            >
                🔥 {
                    Math.round(
                        nutrition.calories
                    )
                }

                <span>
                    {' '}kcal
                </span>
            </div>


            <div
                className="portion-summary"
            >
                Estimated portion:{' '}

                <strong>
                    {
                        result.portion.grams
                    }g
                </strong>
            </div>


            <div
                className="macro-result-grid"
            >

                <MacroResult

                    label="Protein"

                    value={
                        nutrition.protein
                    }

                    icon="💪"
                />


                <MacroResult

                    label="Carbs"

                    value={
                        nutrition.carbs
                    }

                    icon="🌾"
                />


                <MacroResult

                    label="Fat"

                    value={
                        nutrition.fat
                    }

                    icon="🥑"
                />

            </div>


            <p
                className="nutrition-source"
            >
                Nutrition reference: {
                    result.source ||
                    'WellSmartBook food database'
                }
            </p>

        </div>

    );

}


// ======================================================
// MACRO RESULT
// ======================================================

function MacroResult({

    label,
    value,
    icon

}) {

    return (

        <div
            className="macro-result"
        >

            <div
                className="macro-result-icon"
            >
                {icon}
            </div>


            <strong>
                {
                    roundDisplay(
                        value
                    )
                }g
            </strong>


            <span>
                {label}
            </span>

        </div>

    );

}


// ======================================================
// HELPERS
// ======================================================

function createPreview(
    file,
    callback
) {

    const reader =
        new FileReader();


    reader.onload =
        () => {

            callback(
                reader.result
            );

        };


    reader.readAsDataURL(
        file
    );

}


function normalizeFoodKey(
    value
) {

    return String(
        value ||
        ''
    )
        .trim()
        .toLowerCase()
        .replace(
            /[\s-]+/g,
            '_'
        )
        .replace(
            /[^a-z0-9_]/g,
            ''
        );

}


function formatFoodName(
    value
) {

    return String(
        value ||
        ''
    )
        .replace(
            /_/g,
            ' '
        )
        .replace(
            /\b\w/g,
            (
                character
            ) =>
                character.toUpperCase()
        );

}


function normalizeConfidence(
    value
) {

    let numeric =
        Number(
            value ||
            0
        );


    if (
        numeric <=
        1
    ) {

        numeric *=
            100;

    }


    return Math.max(
        0,

        Math.min(
            100,
            numeric
        )
    );

}


function normalizeConfidenceRaw(
    value
) {

    let numeric =
        Number(
            value
        );


    if (
        !Number.isFinite(
            numeric
        )
    ) {

        return null;
    }


    if (
        numeric >
        1
    ) {

        numeric /=
            100;

    }


    return Math.max(
        0,

        Math.min(
            1,
            numeric
        )
    );

}


function capitalize(
    value
) {

    if (!value) {

        return '';
    }


    return (
        value.charAt(0)
            .toUpperCase() +
        value.slice(1)
    );

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


function mealTypeIcon(
    type
) {

    const icons = {

        breakfast:
            '🌅',

        lunch:
            '☀️',

        dinner:
            '🌙',

        snack:
            '🍎'

    };


    return icons[
        type
    ] ||
    '🍽️';

}


function roundDisplay(
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

const scannerCss = `

.ai-scanner-page {
    width: 100%;
}

.scanner-page-header {
    margin-bottom: 22px;
}

.scanner-page-header h1 {
    margin: 0;
    color: #172033;
    font-size: 26px;
    font-weight: 800;
}

.scanner-page-header p {
    margin: 7px 0 0;
    color: #64748b;
    font-size: 14px;
}

.scanner-tabs-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 26px;
}

.scanner-tabs {
    display: flex;
    background: #e8f0ff;
    padding: 4px;
    border-radius: 999px;
    gap: 3px;
}

.scanner-tab {
    border: none;
    background: transparent;
    color: #64748b;
    padding: 11px 22px;
    border-radius: 999px;
    cursor: pointer;
    font-weight: 700;
    font-size: 12px;
    transition: 0.2s;
}

.scanner-tab.active {
    background: #ffffff;
    color: #0759d9;
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.09);
}

.success-message,
.scanner-error,
.info-message {
    padding: 13px 16px;
    border-radius: 11px;
    font-size: 12px;
    margin-bottom: 15px;
}

.success-message {
    background: #ecfdf3;
    color: #15803d;
    border: 1px solid #bbf7d0;
}

.scanner-error {
    background: #fff7ed;
    color: #c2410c;
    border: 1px solid #fed7aa;
}

.info-message {
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
}

.upload-zone {
    min-height: 420px;
    background: #ffffff;
    border: 2px dashed #bfd0e8;
    border-radius: 22px;
    padding: 50px 30px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    transition: 0.2s;
}

.upload-zone.dragging {
    border-color: #0759d9;
    background: #f4f8ff;
    transform: scale(1.005);
}

.upload-icon {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: #edf4ff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30px;
    margin-bottom: 15px;
}

.upload-zone h2 {
    color: #172033;
    margin: 0;
    font-size: 23px;
}

.upload-zone p {
    color: #64748b;
    max-width: 570px;
    line-height: 1.7;
    font-size: 13px;
    margin: 12px 0 20px;
}

.upload-hint {
    margin-top: 12px;
    color: #94a3b8;
    font-size: 10px;
}

.blue-button,
.outline-button,
.small-outline-button {
    border-radius: 10px;
    padding: 11px 17px;
    cursor: pointer;
    font-weight: 700;
    font-size: 12px;
    transition: 0.2s;
}

.blue-button {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    background: #0759d9;
    color: white;
    border: none;
}

.outline-button,
.small-outline-button {
    background: #ffffff;
    color: #26364c;
    border: 1px solid #cbd5e1;
}

.blue-button:hover {
    background: #064ab5;
}

.meal-analysis-grid,
.ingredient-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(330px, 0.75fr);
    gap: 20px;
    align-items: start;
}

.meal-image-card,
.ingredient-image-card {
    position: relative;
    overflow: hidden;
    border-radius: 19px;
    background: #e9eef6;
    min-height: 420px;
    border: 1px solid #dbe3ee;
}

.meal-image-card img,
.ingredient-image-card img {
    width: 100%;
    height: 520px;
    object-fit: cover;
    display: block;
}

.image-processing-overlay {
    position: absolute;
    inset: 0;
    background: rgba(11, 31, 58, 0.72);
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 9px;
    text-align: center;
}

.image-processing-overlay strong {
    font-size: 16px;
}

.image-processing-overlay span {
    font-size: 11px;
    opacity: 0.8;
}

.image-recognized-badge {
    position: absolute;
    left: 16px;
    bottom: 16px;
    background: rgba(22, 163, 74, 0.93);
    color: #ffffff;
    font-size: 10px;
    font-weight: 800;
    padding: 8px 11px;
    border-radius: 999px;
}

.loading-spinner {
    width: 34px;
    height: 34px;
    border: 4px solid rgba(255,255,255,0.35);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: scanner-spin 0.85s linear infinite;
}

.loading-result-card .loading-spinner {
    border-color: #dbeafe;
    border-top-color: #0759d9;
}

@keyframes scanner-spin {
    to {
        transform: rotate(360deg);
    }
}

.image-actions {
    display: flex;
    gap: 10px;
    margin-top: 13px;
}

.image-actions .blue-button {
    flex: 1;
}

.meal-result-column {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.result-card,
.nutrition-result-card,
.recipe-options-section {
    background: #ffffff;
    border: 1px solid #e0e7f0;
    border-radius: 17px;
    padding: 20px;
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.035);
}

.result-card-heading {
    display: flex;
    justify-content: space-between;
    gap: 15px;
    align-items: flex-start;
}

.small-label {
    color: #64748b;
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.6px;
}

.result-card h2 {
    margin: 8px 0 5px;
    font-size: 23px;
    color: #172033;
}

.result-card p {
    margin: 0;
    color: #64748b;
    font-size: 12px;
}

.green-text {
    color: #15803d;
}

.recognized-pill {
    color: #15803d;
    background: #dcfce7;
    padding: 9px 11px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 800;
}

.top-predictions-title {
    margin-top: 22px;
    margin-bottom: 9px;
    text-align: center;
    color: #64748b;
    font-size: 9px;
    font-weight: 800;
}

.prediction-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    justify-content: center;
}

.prediction-chip {
    border: 1px solid #d7e0ec;
    background: #ffffff;
    padding: 8px 10px;
    border-radius: 999px;
    color: #475569;
    cursor: pointer;
    font-size: 10px;
}

.field-label {
    display: block;
    text-align: center;
    color: #475569;
    font-size: 11px;
    font-weight: 800;
    margin-bottom: 10px;
}

.scanner-select {
    width: 100%;
    padding: 12px 13px;
    border: 1px solid #ccd7e6;
    background: #ffffff;
    border-radius: 10px;
    outline: none;
    color: #172033;
}

.portion-buttons {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
}

.portion-button {
    padding: 11px;
    border-radius: 10px;
    border: 1px solid #ccd7e6;
    background: #ffffff;
    color: #172033 !important;
    cursor: pointer;
    font-weight: 700;
}


.portion-button.active {
    background: #edf4ff;
    color: #0759d9;
    border-color: #0759d9;
}

.custom-portion-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
    margin-top: 10px;
}

.custom-portion-input,
.add-ingredient-row input {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #ccd7e6;
    border-radius: 10px;
    padding: 11px;
    outline: none;
    background: #ffffff;
    color: #172033 !important;
}

.custom-portion-input::placeholder,
.add-ingredient-row input::placeholder {
    color: #64748b !important;
    opacity: 1;
}

.nutrition-result-card {
    text-align: center;
    background: #f6f9ff;
}

.total-calories {
    color: #0759d9;
    font-size: 31px;
    font-weight: 800;
    margin-top: 9px;
}

.total-calories span {
    color: #64748b;
    font-size: 14px;
    font-weight: 600;
}

.portion-summary {
    color: #64748b;
    font-size: 11px;
    margin-top: 6px;
}

.macro-result-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-top: 18px;
}

.macro-result {
    background: #ffffff;
    border-radius: 12px;
    padding: 13px 8px;
    border: 1px solid #e5eaf2;
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.macro-result-icon {
    margin-bottom: 4px;
}

.macro-result strong {
    color: #172033;
    font-size: 15px;
}

.macro-result span {
    color: #64748b;
    font-size: 9px;
}

.nutrition-source {
    color: #94a3b8;
    font-size: 8px;
    margin: 13px 0 0;
}

.meal-type-buttons {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
}

.meal-type-button {
    border: 1px solid #d6dfeb;
    background: #ffffff;
    color: #172033 !important;
    padding: 9px 4px;
    border-radius: 9px;
    font-size: 11px;
    cursor: pointer;
    font-weight: 700;
}


.meal-type-button.active {
    color: #0759d9;
    border-color: #0759d9;
    background: #edf4ff;
}



.log-button {
    margin-top: 16px;
    width: 100%;
    border: none;
    background: #087a39;
    color: #ffffff;
    padding: 13px;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 800;
}

.log-button.logged {
    background: #16a34a;
    cursor: default;
}

.log-button:disabled {
    opacity: 0.8;
}

.dashboard-link-button {
    width: 100%;
    border: none;
    background: transparent;
    color: #0759d9;
    font-weight: 700;
    cursor: pointer;
    margin-top: 10px;
    font-size: 10px;
}

.center-card,
.loading-result-card {
    text-align: center;
}

.loading-result-card {
    min-height: 220px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.loading-result-card h3 {
    margin: 13px 0 6px;
}

.loading-result-card p {
    max-width: 280px;
}

.ingredient-result-card h2 {
    margin-bottom: 7px;
}

.muted-text {
    color: #64748b !important;
    line-height: 1.6;
}

.ingredient-tags {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 17px 0;
}

.ingredient-tag {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f6f9ff;
    border: 1px solid #dce6f4;
    border-radius: 10px;
    padding: 10px 11px;
}

.ingredient-tag > div {
    display: flex;
    align-items: center;
    gap: 8px;
}

.ingredient-tag strong {
    color: #26364c;
    font-size: 11px;
}

.ingredient-tag span {
    background: #dcfce7;
    color: #15803d;
    padding: 4px 7px;
    border-radius: 999px;
    font-size: 8px;
    font-weight: 700;
}

.ingredient-tag button {
    border: none;
    background: #fee2e2;
    color: #dc2626;
    width: 25px;
    height: 25px;
    border-radius: 7px;
    cursor: pointer;
    font-size: 16px;
}

.empty-ingredient-state {
    padding: 18px;
    background: #f8fafc;
    border-radius: 10px;
    color: #94a3b8;
    text-align: center;
    font-size: 11px;
    margin-top: 15px;
}

.add-ingredient-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px;
}

.add-ingredient-row button {
    border: none;
    background: #e8f0ff;
    color: #0759d9;
    font-weight: 800;
    padding: 0 15px;
    border-radius: 10px;
    cursor: pointer;
}

.generate-recipe-button {
    margin-top: 13px;
    width: 100%;
    border: none;
    background: #0759d9;
    color: #ffffff;
    padding: 13px;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 800;
}

.generate-recipe-button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.tiny-note {
    color: #94a3b8 !important;
    margin-top: 9px !important;
    font-size: 8px !important;
    line-height: 1.5;
}

.recipe-options-section {
    margin-top: 22px;
}

.recipe-options-heading h2 {
    color: #172033;
    margin: 7px 0 5px;
}

.recipe-options-heading p {
    color: #64748b;
    margin: 0;
    font-size: 12px;
}

.recipe-option-grid {
    margin-top: 19px;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
}

.recipe-option-card {
    border: 1px solid #e1e7ef;
    border-radius: 15px;
    padding: 18px;
    background: #fbfcff;
    position: relative;
}

.recipe-number {
    width: 29px;
    height: 29px;
    background: #0759d9;
    color: #ffffff;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 800;
}

.recipe-option-card h3 {
    color: #172033;
    font-size: 15px;
    margin: 13px 0 7px;
}

.recipe-option-card > p {
    color: #64748b;
    font-size: 10px;
    line-height: 1.6;
    min-height: 48px;
}

.recipe-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 9px;
    color: #475569;
    margin-top: 12px;
}

.recipe-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 11px;
}

.recipe-tags span {
    background: #edf4ff;
    color: #0759d9;
    border-radius: 999px;
    padding: 4px 7px;
    font-size: 8px;
    font-weight: 700;
}

.select-recipe-button {
    width: 100%;
    margin-top: 14px;
    background: #0759d9;
    color: #ffffff;
    border: none;
    border-radius: 9px;
    padding: 10px;
    font-size: 10px;
    cursor: pointer;
    font-weight: 800;
}

.select-recipe-button:disabled {
    opacity: 0.55;
}

@media (max-width: 1000px) {

    .meal-analysis-grid,
    .ingredient-layout {
        grid-template-columns: 1fr;
    }

    .recipe-option-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 650px) {

    .scanner-tabs {
        width: 100%;
        flex-direction: column;
        border-radius: 15px;
    }

    .scanner-tab {
        width: 100%;
        border-radius: 11px;
    }

    .meal-image-card img,
    .ingredient-image-card img {
        height: 340px;
    }

    .macro-result-grid {
        grid-template-columns: 1fr;
    }

    .meal-type-buttons {
        grid-template-columns: repeat(2, 1fr);
    }

    .portion-buttons {
        grid-template-columns: 1fr;
    }
}

`;