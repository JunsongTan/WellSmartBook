const multer =
    require('multer');


// ======================================================
// GENERAL IMAGE UPLOAD
//
// Used for:
// - Ingredient scanner
// - Meal classifier
// - Meal analysis
// ======================================================

const upload =
    multer({

        storage:
            multer.memoryStorage(),

        limits: {

            fileSize:
                10 *
                1024 *
                1024

        },

        fileFilter: (
            req,
            file,
            callback
        ) => {

            if (
                !file.mimetype
                    .startsWith(
                        'image/'
                    )
            ) {

                return callback(
                    new Error(
                        'Only image files are allowed.'
                    )
                );
            }


            callback(
                null,
                true
            );
        }

    });


// ======================================================
// PROFILE PICTURE UPLOAD
// ======================================================

const profileUpload =
    multer({

        storage:
            multer.memoryStorage(),

        limits: {

            fileSize:
                5 *
                1024 *
                1024

        },

        fileFilter: (
            req,
            file,
            callback
        ) => {

            const allowed = [

                'image/jpeg',
                'image/png',
                'image/webp'

            ];


            if (
                !allowed.includes(
                    file.mimetype
                )
            ) {

                return callback(
                    new Error(
                        'Profile picture must be JPG, PNG or WEBP.'
                    )
                );
            }


            callback(
                null,
                true
            );
        }

    });


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    upload,

    profileUpload,

    MulterError:
        multer.MulterError

};