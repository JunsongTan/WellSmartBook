require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');

const {
    authenticateToken: verifyJwtToken,
    createAuthenticateActiveCoach
} = require('./auth/authMiddleware');


const createAuthRouter =
    require('./auth/authRoutes');

const createCoachAuthRouter =
    require('./auth/coachAuthRoutes');


// ======================================================
// FORGOT PASSWORD - EMAIL OTP
// ======================================================

const createPasswordResetRouter =
    require('./routes/passwordResetRoutes');


const createSavedRecipeRouter =
    require('./routes/savedRecipeRoutes');

const createProfileRouter =
    require('./routes/profileRoutes');

const createRecipeGenerationRouter =
    require('./routes/recipeGenerationRoutes');

const createPersonalizedRecipeRouter =
    require('./routes/personalizedRecipeRoutes');

const createVisionRouter =
    require('./routes/visionRoutes');

const createNutritionRouter =
    require('./routes/nutritionRoutes');

const createMealLogRouter =
    require('./routes/mealLogRoutes');

const createGymRouter =
    require('./routes/gymRoutes');

const createCoachSlotRouter =
    require('./routes/coachSlotRoutes');

const createBookingHoldRouter =
    require('./routes/bookingHoldRoutes');

const createCoachBookingRouter =
    require('./routes/coachBookingRoutes');

const createStripeCheckoutRouter =
    require('./routes/stripeCheckoutRoutes');

const createCoachAvailabilityRouter =
    require('./routes/coachAvailabilityRoutes');


const createPendingPaymentActionsRouter =
    require('./routes/pendingPaymentActionsRoutes');

const createMuscleTutorialRouter =
    require('./routes/muscleTutorialRoutes');


const createCoachMuscleTutorialRouter =
    require('./routes/coachMuscleTutorialRoutes');


const createCoachPerformanceRouter =
    require('./routes/coachPerformanceRoutes');


const createCoachSettingsRouter =
    require('./routes/coachSettingsRoutes');



const createSystemRouter =
    require('./routes/systemRoutes');


const createAdminDashboardRouter =
    require('./routes/adminDashboardRoutes');


const createAdminAccountsRouter =
    require('./routes/adminAccountsRoutes');


const createAdminManagementRouter =
    require('./routes/adminManagementRoutes');


const createAdminGymRouter =
    require('./routes/adminGymRoutes');

const createAdminGymEditRouter =
    require('./routes/adminGymEditRoutes');


const createAdminBookingTransactionsRouter =
    require('./routes/adminBookingTransactionsRoutes');


const createAdminSettingsRouter =
    require('./routes/adminSettingsRoutes');

const createAnalyticsReportRouter =
    require('./routes/analyticsReportRoutes');


const createStripeBookingWorkflow =
    require('./workflows/stripeBookingWorkflow');

const handleStripeWebhook =
    require('./workflows/stripeWebhookHandler');


 // ======================================================
 // COACH DAILY EMAIL SUMMARY SCHEDULER
 // ======================================================

const {
    startCoachDailySummaryScheduler
} = require('./helpers/coachDailySummaryScheduler');


// ======================================================
// COACH TWO-HOUR REMINDER SCHEDULER
// ======================================================

const {
    startCoachTwoHourReminderScheduler
} = require('./helpers/coachTwoHourReminderScheduler');

    

const {
    normalizeDateOnly,
    calculateAge,
    normalizeAllergies
} =
    require('./helpers/generalHelpers');

const {
    calculatePersonalTargets,
    formatUserForClient
} =
    require('./helpers/userHelpers');

const {
    GENERATED_IMAGES_DIR,
} =
    require('./helpers/recipeImageHelpers');


const {
    PROFILE_IMAGES_DIR
} =
    require('./helpers/profileImageHelpers');

const {
    MulterError
} =
    require('./helpers/uploadHelpers');



const app = express();


const stripe =
    process.env.STRIPE_SECRET_KEY
        ? new Stripe(
            process.env.STRIPE_SECRET_KEY
        )
        : null;

let confirmStripeBooking;

let expireStripeBooking;

// ======================================================
// CONFIG
// ======================================================

const PORT = Number(
    process.env.PORT || 5000
);

app.use(cors());

// ======================================================
// STRIPE WEBHOOK
//
// IMPORTANT:
// Must be BEFORE express.json().
// Stripe requires the original raw request body.
// ======================================================

app.post(
    '/api/stripe/webhook',

    express.raw({
        type:
            'application/json'
    }),

    (
        req,
        res
    ) =>
        handleStripeWebhook(
            req,
            res,
            {
                stripe,
                confirmStripeBooking,
                expireStripeBooking
            }
        )
);


// Normal JSON parsing comes AFTER Stripe webhook.

app.use(
    express.json({
        limit: '10mb'
    })
);


// ======================================================
// GENERATED RECIPE IMAGES
// ======================================================


app.use(
    '/generated-images',
    express.static(
        GENERATED_IMAGES_DIR
    )
);


// ======================================================
// PROFILE IMAGES
// ======================================================


app.use(
    '/profile-images',
    express.static(
        PROFILE_IMAGES_DIR
    )
);


// ======================================================
// MYSQL
// ======================================================

const db =
    mysql.createConnection({
        host:
            process.env.DB_HOST ||
            'localhost',

        user:
            process.env.DB_USER ||
            'root',

        password:
            process.env.DB_PASSWORD ||
            '',

        database:
            process.env.DB_NAME ||
            'wellsmartbook_db',

        port:
            Number(
                process.env.DB_PORT ||
                3306
            )
    });


db.connect(
    (error) => {

        if (error) {
            console.error(
                '❌ Database connection failed:',
                error.message
            );

            return;
        }


        console.log(
            `✅ Connected to MySQL Database on port ${
                process.env.DB_PORT ||
                3306
            }`
        );
    }
);


// ======================================================
// VERIFY ACTIVE ACCOUNT ON PROTECTED ROUTES
//
// Checks JWT, account existence, current role,
// and whether the account is enabled.
// ======================================================

function authenticateToken(req, res, next) {

    verifyJwtToken(req, res, () => {

        const userId = Number(req.user?.id);

        if (
            !Number.isSafeInteger(userId) ||
            userId <= 0
        ) {
            return res.status(401).json({
                success: false,
                message: 'Invalid login session.'
            });
        }

        db.query(
            `
            SELECT role, is_active
            FROM users
            WHERE id = ?
            LIMIT 1
            `,
            [userId],

            (error, rows) => {

                if (error) {
                    console.error(
                        'Account status check:',
                        error
                    );

                    return res.status(503).json({
                        success: false,
                        message:
                            'Unable to verify account status.'
                    });
                }

                const account = rows?.[0];

                // ======================================
                // BLOCK DISABLED OR DELETED ACCOUNTS
                // ======================================

                if (
                    !account ||
                    Number(account.is_active) !== 1
                ) {
                    return res.status(403).json({
                        success: false,
                        message:
                            'This account is disabled or no longer exists.'
                    });
                }

                // ======================================
                // VERIFY ROLE HAS NOT CHANGED
                // ======================================

                const currentRole =
                    account.role || 'user';

                if (currentRole !== req.user?.role) {
                    return res.status(401).json({
                        success: false,
                        message:
                            'Account role changed. Please log in again.'
                    });
                }

                next();
            }
        );
    });
}


// ======================================================
// AUTH MIDDLEWARE
// ======================================================

const authenticateActiveCoach =
    createAuthenticateActiveCoach(
        db
    );

// ======================================================
// BOOKING TRANSACTION POOL
//
// SAME DATABASE: wellsmartbook_db
//
// Each booking request gets its own MySQL connection.
// This prevents concurrent booking transactions from
// sharing the same connection.
// ======================================================

const bookingPool =
    mysql.createPool({

        host:
            process.env.DB_HOST ||
            'localhost',

        user:
            process.env.DB_USER ||
            'root',

        password:
            process.env.DB_PASSWORD ||
            '',

        database:
            process.env.DB_NAME ||
            'wellsmartbook_db',

        port:
            Number(
                process.env.DB_PORT ||
                3306
            ),

        waitForConnections:
            true,

        connectionLimit:
            10,

        queueLimit:
            0
    });



// ======================================================
// OTP
// ======================================================

const transporter =
    nodemailer.createTransport({

        service:
            'gmail',

        auth: {

            user:
                process.env.EMAIL_USER,

            pass:
                process.env.EMAIL_PASS

        }

    });


({
    confirmStripeBooking,
    expireStripeBooking
} =
    createStripeBookingWorkflow({

        bookingPool,

        transporter

    })
);



// ======================================================
// VERIFY EMAIL CONNECTION WHEN SERVER STARTS
// ======================================================

transporter.verify(
    (
        error,
        success
    ) => {

        if (error) {

            console.error(
                '❌ Email transporter error:',
                error.message
            );

            return;
        }


        console.log(
            '✅ Email transporter is ready:',
            success
        );
    }
);

// ======================================================
// AUTH ROUTES
// ======================================================

app.use(
    '/api',

    createAuthRouter({
        db,
        transporter,

        normalizeDateOnly,
        calculateAge,
        calculatePersonalTargets,
        normalizeAllergies,
        formatUserForClient
    })
);


// ======================================================
// FORGOT PASSWORD - USER AND COACH
// ======================================================

app.use(
    '/api',

    createPasswordResetRouter({
        bookingPool,
        transporter
    })
);

// ======================================================
// COACH AUTH ROUTES
// ======================================================

app.use(
    '/api',

    createCoachAuthRouter({
        db,
        authenticateToken,
        authenticateActiveCoach
    })
);

// ======================================================
// SAVED RECIPE ROUTES
// ======================================================

app.use(
    '/api',

    createSavedRecipeRouter({
        db,
        authenticateToken
    })
);

// ======================================================
// CREATE PROFILE ROUTE
// ======================================================

app.use(
    '/api',

    createProfileRouter({
        db,
        authenticateToken
    })
);

// ======================================================
// CREATE RECIPEGENERATION ROUTE
// ======================================================

app.use(
    '/api',

    createRecipeGenerationRouter({
        authenticateToken
    })
);

// ======================================================
// PERSONALIZED RECIPE ROUTE
// ======================================================

app.use(
    '/api',

    createPersonalizedRecipeRouter({
        db,
        authenticateToken
    })
);

// ======================================================
// CREATE VISION ROUTE
// ======================================================

app.use(
    '/api',

    createVisionRouter({
        db,
        authenticateToken
    })
);

// ======================================================
// CREATE NUTRITION ROUTE
// ======================================================

app.use(
    '/api',

    createNutritionRouter({
        db,
        authenticateToken
    })
);

// ======================================================
// CREATE MEAL LOG ROUTE
// ======================================================

app.use(
    '/api',

    createMealLogRouter({
        db,
        authenticateToken
    })
);

// ======================================================
// CREATE GYM ROUTE
// ======================================================

app.use(
    '/api',

    createGymRouter({
        db,
        authenticateToken
    })
);

// ======================================================
// CREATE COACH SLOT ROUTE
// ======================================================

app.use(
    '/api',

    createCoachSlotRouter({
        db,
        authenticateToken
    })
);

// ======================================================
// CREATE BOOKING HOLDING ROUTE
// ======================================================

app.use(
    '/api',

    createBookingHoldRouter({
        bookingPool,
        authenticateToken
    })
);

// ======================================================
// CREATE  COACH BOOKING ROUTE
// ======================================================

app.use(
    '/api',

    createCoachBookingRouter({
        db,
        authenticateToken,
        authenticateActiveCoach
    })
);

// ======================================================
// CREATE STRIPE CHECKOUT ROUTE
// ======================================================

app.use(
    '/api',

    createStripeCheckoutRouter({
        bookingPool,
        stripe,
        authenticateToken
    })
);


// ======================================================
// USER - PENDING PAYMENT ACTIONS
// ======================================================

app.use(
    '/api',

    createPendingPaymentActionsRouter({
        bookingPool,
        stripe,
        authenticateToken
    })
);


// ======================================================
// CREATE COACH AVAILABILITY ROUTE
// ======================================================

app.use(
    '/api',

    createCoachAvailabilityRouter({
        db,
        authenticateToken,
        authenticateActiveCoach
    })
);


// ======================================================
// CREATE MUSCLE TUTORIAL ROUTES
// ======================================================

app.use(
    '/api',

    createMuscleTutorialRouter({
        db,
        authenticateToken
    })
);


// ======================================================
// CREATE COACH MUSCLE TUTORIAL UPLOAD ROUTES
// ======================================================

app.use(
    '/api',

    createCoachMuscleTutorialRouter({
        db,
        authenticateToken,
        authenticateActiveCoach
    })
);



// ======================================================
// COACH PERFORMANCE ROUTES
// ======================================================

app.use(
    '/api',

    createCoachPerformanceRouter({
        db,
        authenticateToken,
        authenticateActiveCoach
    })
);


// ======================================================
// COACH PROFILE SETTINGS ROUTES
// ======================================================

app.use(
    '/api',

    createCoachSettingsRouter({
        db,
        bookingPool,
        authenticateToken,
        authenticateActiveCoach
    })
);


// ======================================================
// ADMIN DASHBOARD ROUTES
// ======================================================

app.use(
    '/api',

    createAdminDashboardRouter({
        db,
        authenticateToken
    })
);


// ======================================================
// ADMIN - MANAGE USERS AND COACHES
// ======================================================

app.use(
    '/api',

    createAdminAccountsRouter({
        db,
        authenticateToken
    })
);



// ======================================================
// ADMIN - ADMINISTRATOR MANAGEMENT
// ======================================================

app.use(
    '/api',

    createAdminManagementRouter({
        db,
        authenticateToken
    })
);


// ======================================================
// ADMIN - GYM OVERSIGHT
// ======================================================

app.use(
    '/api',

    createAdminGymRouter({
        db,
        bookingPool,
        authenticateToken
    })
);


// ======================================================
// ADMIN - EDIT GYM DETAILS
// ======================================================

app.use(
    '/api',

    createAdminGymEditRouter({
        db,
        authenticateToken
    })
);


// ======================================================
// ADMIN - BOOKING TRANSACTIONS (READ ONLY)
// ======================================================

app.use(
    '/api',

    createAdminBookingTransactionsRouter({
        db,
        authenticateToken
    })
);


// ======================================================
// ADMIN - ACCOUNT SETTINGS
// ======================================================

app.use(
    '/api',

    createAdminSettingsRouter({
        db,
        authenticateToken
    })
);


// ======================================================
// USER - ANALYTICS REPORT (READ ONLY)
// ======================================================

app.use(
    '/api',

    createAnalyticsReportRouter({
        db,
        bookingPool,
        authenticateToken
    })
);


// ======================================================
// HEALTH CREATE SYSTEM ROUTE
// ======================================================

app.use(
    '/api',

    createSystemRouter()
);


// ======================================================
// ERROR HANDLER
// ======================================================

app.use(
    (
        error,
        req,
        res,
        next
    ) => {

        console.error(
            'Unhandled Error:',
            error
        );


        if (
            error instanceof
            MulterError
        ) {
            return res
                .status(400)
                .json({
                    message:
                        error.code ===
                        'LIMIT_FILE_SIZE'
                            ? 'Image file is too large.'
                            : error.message
                });
        }


        return res
            .status(500)
            .json({
                success: false,

                message:
                    error.message ||
                    'Unexpected server error.'
            });
    }
);


// ======================================================
// START
// ======================================================

app.listen(
    PORT,

    () => {

        console.log();
        console.log(
            '======================================='
        );

        console.log(
            ' WellSmartBook Backend'
        );

        console.log(
            '======================================='
        );

        console.log(
            `http://localhost:${PORT}`
        );

        console.log();

        console.log(
            'PROFILE'
        );

        console.log(
            'GET   /api/profile'
        );

        console.log(
            'PATCH /api/profile'
        );

        console.log(
            'POST  /api/profile-picture'
        );

        console.log(
            'PATCH /api/profile/password'
        );

        console.log();

        console.log(
            'RECIPES'
        );

        console.log(
            'POST /api/generate-recipe-options'
        );

        console.log(
            'POST /api/generate-recipe-detail'
        );

        console.log(
            'POST /api/recommend-recipes'
        );

        console.log(
            'POST /api/generate-personalized-recipe-detail'
        );

        console.log();

        console.log(
            '======================================='
        );

        
        // ======================================================
        // START COACH DAILY SUMMARY SCHEDULER
        //
        // Uses existing booking database and Gmail.
        // Controlled by COACH_DAILY_SUMMARY_ENABLED.
        // ======================================================

        startCoachDailySummaryScheduler({
            bookingPool,
            transporter
        });

        
        // ======================================================
        // START COACH TWO-HOUR REMINDER SCHEDULER
        //
        // Uses existing MySQL booking pool and Gmail.
        // Controlled by COACH_TWO_HOUR_REMINDER_ENABLED.
        // ======================================================

        startCoachTwoHourReminderScheduler({
            bookingPool,
            transporter
        });


    }
);