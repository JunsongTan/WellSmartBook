const axios =
    require('axios');

const FormData =
    require('form-data');


// ======================================================
// VISION SERVICE CONFIG
// ======================================================

const VISION_BASE_URL =
    process.env.VISION_BASE_URL ||
    'http://127.0.0.1:8000';


// ======================================================
// SEND IMAGE TO VISION SERVICE
// ======================================================

async function sendImageToVisionService(
    file,
    endpoint
) {

    const form =
        new FormData();


    form.append(
        'image',
        file.buffer,
        {
            filename:
                file.originalname,

            contentType:
                file.mimetype
        }
    );


    const response =
        await axios.post(
            `${VISION_BASE_URL}${endpoint}`,
            form,
            {
                headers: {
                    ...form.getHeaders()
                },

                timeout:
                    120000
            }
        );


    return response.data;
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    sendImageToVisionService

};