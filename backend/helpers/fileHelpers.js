const fs =
    require('fs');


// ======================================================
// SAFE DELETE FILE
// ======================================================

function safeDeleteFile(
    filePath
) {

    try {

        if (
            filePath &&
            fs.existsSync(
                filePath
            )
        ) {

            fs.unlinkSync(
                filePath
            );
        }

    } catch (
        error
    ) {

        console.warn(
            'File cleanup failed:',
            error.message
        );
    }
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    safeDeleteFile

};