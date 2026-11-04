// ======================================================
// SHARED AUTH STATE
// ======================================================

// Stores OTP codes waiting for verification.
const otpStore =
    new Map();


// Stores emails that successfully completed OTP.
// Registration routes use this after verification.
const verifiedEmails =
    new Map();


module.exports = {
    otpStore,
    verifiedEmails
};