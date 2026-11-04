const jwt = require('jsonwebtoken');


// ======================================================
// USER / GENERAL AUTHENTICATION
// ======================================================

function authenticateToken(
    req,
    res,
    next
) {

    const authHeader =
        req.headers.authorization;


    const token =
        authHeader &&
        authHeader.startsWith(
            'Bearer '
        )
            ? authHeader.substring(7)
            : null;


    if (!token) {

        return res
            .status(401)
            .json({
                success: false,

                message:
                    'Authentication token is required.'
            });
    }


    if (!process.env.JWT_SECRET) {

        return res
            .status(500)
            .json({
                success: false,

                message:
                    'Server authentication configuration error.'
            });
    }


    jwt.verify(
        token,

        process.env.JWT_SECRET,

        (
            error,
            decoded
        ) => {

            if (error) {

                return res
                    .status(403)
                    .json({
                        success: false,

                        message:
                            'Invalid or expired token.'
                    });
            }


            req.user =
                decoded;


            next();
        }
    );
}


// ======================================================
// ACTIVE COACH AUTHENTICATION
//
// db is passed from index.js.
// This avoids creating another MySQL connection here.
// ======================================================

function createAuthenticateActiveCoach(
    db
) {

    return function authenticateActiveCoach(
        req,
        res,
        next
    ) {

        if (
            !req.user ||
            req.user.role !==
                'coach'
        ) {

            return res
                .status(403)
                .json({
                    success: false,

                    message:
                        'Coach account required.'
                });
        }


        db.query(
            `
            SELECT

                cp.*,

                u.full_name,
                u.username,
                u.email,
                u.profile_picture

            FROM coach_profiles cp

            INNER JOIN users u
                ON u.id =
                    cp.user_id

            WHERE cp.user_id = ?

            LIMIT 1
            `,
            [
                req.user.id
            ],

            (
                error,
                results
            ) => {

                if (error) {

                    console.error(
                        'Coach authentication:',
                        error
                    );


                    return res
                        .status(500)
                        .json({
                            success: false,

                            message:
                                'Unable to verify coach account.'
                        });
                }


                if (
                    results.length ===
                    0
                ) {

                    return res
                        .status(403)
                        .json({
                            success: false,

                            message:
                                'Coach profile not found.'
                        });
                }


                const coach =
                    results[0];


                if (
                    Number(
                        coach.is_active
                    ) !== 1
                ) {

                    return res
                        .status(403)
                        .json({
                            success: false,

                            code:
                                'COACH_BLOCKED',

                            message:
                                'Your coach account has been disabled by WellSmartBook administration.'
                        });
                }


                if (
                    coach.approval_status ===
                    'rejected'
                ) {

                    return res
                        .status(403)
                        .json({
                            success: false,

                            code:
                                'COACH_REJECTED',

                            message:
                                coach.rejection_reason ||
                                'Coach account is unavailable.'
                        });
                }


                req.coach =
                    coach;


                next();
            }
        );
    };
}


// ======================================================
// EXPORT
// ======================================================

module.exports = {

    authenticateToken,

    createAuthenticateActiveCoach

};