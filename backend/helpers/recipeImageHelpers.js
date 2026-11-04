const fs =
    require('fs');

const path =
    require('path');

const crypto =
    require('crypto');

const {
    isTransientGeminiError
} =
    require('./geminiHelpers');


// ======================================================
// GENERATED RECIPE IMAGE DIRECTORY
// ======================================================

const GENERATED_IMAGES_DIR =
    path.join(
        __dirname,
        '..',
        'generated-images'
    );


if (
    !fs.existsSync(
        GENERATED_IMAGES_DIR
    )
) {

    fs.mkdirSync(
        GENERATED_IMAGES_DIR,
        {
            recursive: true
        }
    );
}


// ======================================================
// GENERATE MEAL IMAGE
// ======================================================

async function generateMealImage(
    ai,
    selectedOption
) {

    const imagePrompt = `
Create a realistic professional food photograph of:

${selectedOption.title}

${selectedOption.description || ''}

Cooking style:
${selectedOption.cookingStyle || ''}

Requirements:
finished cooked food only,
realistic food photography,
attractive home-cooked plating,
natural light,
45 degree angle,
landscape,
no people,
no hands,
no text,
no logos,
no watermark.
`;


    const primaryModel =
        process.env
            .GEMINI_IMAGE_MODEL ||
        'gemini-3.1-flash-lite-image';


    const fallbackModel =
        process.env
            .GEMINI_IMAGE_FALLBACK ||
        'gemini-3.1-flash-image';


    async function callImageModel(
        model
    ) {

        const interaction =
            await ai.interactions.create({

                model,

                input:
                    imagePrompt,

                response_format: {

                    type:
                        'image',

                    mime_type:
                        'image/jpeg',

                    aspect_ratio:
                        '16:9'

                }

            });


        if (
            !interaction.output_image ||
            !interaction.output_image.data
        ) {

            throw new Error(
                'Gemini returned no meal image.'
            );
        }


        return interaction.output_image;
    }


    let generatedImage;


    try {

        generatedImage =
            await callImageModel(
                primaryModel
            );

    } catch (
        error
    ) {

        if (
            !isTransientGeminiError(
                error
            )
        ) {

            throw error;
        }


        generatedImage =
            await callImageModel(
                fallbackModel
            );
    }


    const filename =
        `recipe-${crypto.randomUUID()}.jpg`;


    const filepath =
        path.join(
            GENERATED_IMAGES_DIR,
            filename
        );


    fs.writeFileSync(
        filepath,

        Buffer.from(
            generatedImage.data,
            'base64'
        )
    );


    const port =
        Number(
            process.env.PORT ||
            5000
        );


    return (
        `http://localhost:${port}/generated-images/${filename}`
    );
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    GENERATED_IMAGES_DIR,

    generateMealImage

};