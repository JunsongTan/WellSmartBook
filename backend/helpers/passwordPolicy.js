
 // ======================================================
 // WELLSMARTBOOK - STRONG PASSWORD POLICY
 //
 // Applies to:
 // - User registration
 // - Coach registration
 // - User password changes
 // - Coach password changes
 // ======================================================

const PASSWORD_MESSAGE =
    'Password must contain at least 12 characters, ' +
    'including one uppercase letter, one lowercase ' +
    'letter, one number and one symbol.';

function isStrongPassword(password) {

    if (typeof password !== 'string') {
        return false;
    }

    // Minimum 12 characters

    if (password.length < 12) {
        return false;
    }

    // Bcrypt supports a maximum of 72 UTF-8 bytes
    // without truncating password input.

    if (Buffer.byteLength(password, 'utf8') > 72) {
        return false;
    }

    // At least one uppercase letter

    if (!/[A-Z]/.test(password)) {
        return false;
    }

    // At least one lowercase letter

    if (!/[a-z]/.test(password)) {
        return false;
    }

    // At least one number

    if (!/[0-9]/.test(password)) {
        return false;
    }

    // At least one symbol

    
    if (!/[^A-Za-z0-9\s]/.test(password)) {
        return false;
    }


    return true;
}

module.exports = {
    isStrongPassword,
    PASSWORD_MESSAGE
};
