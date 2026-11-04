// ======================================================
// GEMINI HELPERS
// ======================================================


// ======================================================
// GEMINI CLIENT
// ======================================================

let geminiClient =
    null;


async function getGeminiClient() {

    if (
        !process.env
            .GEMINI_API_KEY
    ) {

        throw new Error(
            'GEMINI_API_KEY is missing from backend/.env'
        );
    }


    if (!geminiClient) {

        const {
            GoogleGenAI
        } =
            await import(
                '@google/genai'
            );


        geminiClient =
            new GoogleGenAI({
                apiKey:
                    process.env
                        .GEMINI_API_KEY
            });
    }


    return geminiClient;
}


// ======================================================
// GEMINI ERROR HELPERS
// ======================================================

function getErrorText(
    error
) {

    return String(
        error?.message ||
        error ||
        ''
    );
}


function isTransientGeminiError(
    error
) {

    const message =
        getErrorText(
            error
        ).toLowerCase();


    return (
        message.includes(
            '429'
        ) ||

        message.includes(
            '503'
        ) ||

        message.includes(
            '502'
        ) ||

        message.includes(
            '504'
        ) ||

        message.includes(
            'resource_exhausted'
        ) ||

        message.includes(
            'too many requests'
        ) ||

        message.includes(
            'unavailable'
        ) ||

        message.includes(
            'high demand'
        )
    );
}


// ======================================================
// GEMINI CACHES
// ======================================================

const optionsCache =
    new Map();


const detailCache =
    new Map();


const recommendationCache =
    new Map();


const CACHE_DURATION =
    30 *
    60 *
    1000;


const RECOMMENDATION_CACHE_DURATION =
    15 *
    60 *
    1000;


function getCachedValue(
    cache,
    key,
    duration = CACHE_DURATION
) {

    const entry =
        cache.get(
            key
        );


    if (!entry) {

        return null;
    }


    if (
        Date.now() -
        entry.createdAt >
        duration
    ) {

        cache.delete(
            key
        );


        return null;
    }


    return entry.value;
}


function setCachedValue(
    cache,
    key,
    value
) {

    cache.set(
        key,
        {
            value,

            createdAt:
                Date.now()
        }
    );
}


// ======================================================
// GEMINI STRUCTURED OUTPUT
// ======================================================

async function callStructuredModel({
    ai,
    model,
    prompt,
    schema,
    lowThinking = false
}) {

    const request = {

        model,

        input:
            prompt,

        response_format: {

            type:
                'text',

            mime_type:
                'application/json',

            schema
        }
    };


    if (
        lowThinking
    ) {

        request.generation_config = {

            thinking_level:
                'low'

        };
    }


    
    // ======================================================
    // MEASURE GEMINI MODEL RESPONSE TIME
    // ======================================================

    const startedAt = Date.now();

    console.log(
        `[Gemini] Starting ${model} ` +
        `(thinking: ${lowThinking ? 'low' : 'model default'})`
    );

    try {

        const interaction =
            await ai.interactions.create(request);

        // ==================================================
        // VALIDATE RESPONSE
        // ==================================================

        if (!interaction.output_text) {

            throw new Error(
                'Gemini returned an empty response.'
            );
        }

        // ==================================================
        // RECORD SUCCESSFUL REQUEST TIME
        // ==================================================

        const seconds =
            (
                (Date.now() - startedAt) / 1000
            ).toFixed(1);

        console.log(
            `[Gemini] ${model} completed in ${seconds}s`
        );

        return interaction.output_text;

    } catch (error) {

        // ==================================================
        // RECORD FAILED REQUEST TIME
        // ==================================================

        const seconds =
            (
                (Date.now() - startedAt) / 1000
            ).toFixed(1);

        console.error(
            `[Gemini] ${model} failed after ${seconds}s:`,
            getErrorText(error)
        );

        throw error;
    }

}


async function structuredWithFallback({
    ai,
    primaryModel,
    fallbackModel,
    prompt,
    schema,
    primaryLowThinking = false,
    fallbackLowThinking = false
}) {

    try {

        return await callStructuredModel({

            ai,

            model:
                primaryModel,

            prompt,

            schema,

            lowThinking:
                primaryLowThinking
        });

    } catch (
        error
    ) {

        console.error(
            `Gemini ${primaryModel} failed:`,
            getErrorText(
                error
            )
        );


        if (
            !isTransientGeminiError(
                error
            )
        ) {

            throw error;
        }


        console.warn(
            `Switching to ${fallbackModel}`
        );


        return await callStructuredModel({

            ai,

            model:
                fallbackModel,

            prompt,

            schema,

            lowThinking:
                fallbackLowThinking
        });
    }
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    getGeminiClient,

    getErrorText,

    isTransientGeminiError,

    optionsCache,

    detailCache,

    recommendationCache,

    RECOMMENDATION_CACHE_DURATION,

    getCachedValue,

    setCachedValue,

    callStructuredModel,

    structuredWithFallback

};