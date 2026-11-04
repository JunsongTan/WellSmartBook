const fs =
    require('fs');

const path =
    require('path');

const crypto =
    require('crypto');


// ======================================================
// PROFILE IMAGE DIRECTORY
// ======================================================

const PROFILE_IMAGES_DIR =
    path.join(
        __dirname,
        '..',
        'profile-images'
    );


if (
    !fs.existsSync(
        PROFILE_IMAGES_DIR
    )
) {

    fs.mkdirSync(
        PROFILE_IMAGES_DIR,
        {
            recursive: true
        }
    );
}


// ======================================================
// PROFILE IMAGE EXTENSIONS
// ======================================================

const PROFILE_IMAGE_EXTENSIONS = {

    'image/jpeg':
        '.jpg',

    'image/png':
        '.png',

    'image/webp':
        '.webp'

};


// ======================================================
// SAVE PROFILE IMAGE
// ======================================================

function saveProfileImage(
    userId,
    file
) {

    const extension =
        PROFILE_IMAGE_EXTENSIONS[
            file?.mimetype
        ];


    if (!extension) {

        throw new Error(
            'Unsupported profile image type.'
        );
    }


    const filename =
        `profile-${userId}-${crypto.randomUUID()}${extension}`;


    const filePath =
        path.join(
            PROFILE_IMAGES_DIR,
            filename
        );


    fs.writeFileSync(
        filePath,
        file.buffer
    );


    const port =
        Number(
            process.env.PORT ||
            5000
        );


    const imageUrl =
        `http://localhost:${port}/profile-images/${filename}`;


    return {

        filename,

        filePath,

        imageUrl

    };
}


// ======================================================
// GET LOCAL PROFILE IMAGE PATH FROM URL
// ======================================================

function getProfileImagePathFromUrl(
    imageUrl
) {

    const value =
        String(
            imageUrl ||
            ''
        );


    if (
        !value.includes(
            '/profile-images/'
        )
    ) {

        return null;
    }


    const filename =
        value
            .split(
                '/profile-images/'
            )[1];


    if (!filename) {

        return null;
    }


    return path.join(
        PROFILE_IMAGES_DIR,
        path.basename(
            filename
        )
    );
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    PROFILE_IMAGES_DIR,

    saveProfileImage,

    getProfileImagePathFromUrl

};