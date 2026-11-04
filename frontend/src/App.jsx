import {
    BrowserRouter,
    Navigate,
    Outlet,
    Route,
    Routes
} from 'react-router-dom';


// ======================================================
// AUTHENTICATION / REGISTRATION
// ======================================================

import Login from './components/Login';

import ForgotPassword from './components/ForgotPassword';

import Register from './components/Register';
import RegisterChoice from './components/RegisterChoice';
import CoachRegister from './components/CoachRegister';

import CoachSettings from './components/CoachSettings';



// ======================================================
// NORMAL USER PORTAL
// ======================================================

import AppLayout from './components/AppLayout';

import Dashboard from './components/Dashboard';
import AIScanner from './components/AIScanner';
import Recipes from './components/Recipes';
import RecipeDetail from './components/RecipeDetail';
import GymMap from './components/GymMap';
import CoachBooking from './components/CoachBooking';
import InteractiveMuscleMap from './components/InteractiveMuscleMap';
import ExerciseTutorialLibrary from './components/ExerciseTutorialLibrary';
import AnalyticsReport from './components/AnalyticsReport';
import Profile from './components/Profile';


// ======================================================
// COACH PORTAL
// ======================================================

import CoachLayout from './components/CoachLayout';
import CoachWelcome from './components/CoachWelcome';
import CoachGymLocations from './components/CoachGymLocations';
import CoachSchedule from './components/CoachSchedule';

import CoachPerformance from './components/CoachPerformance';

import CoachMuscleTutorial from './components/CoachMuscleTutorial';

import CoachUploadedTutorials from './components/CoachUploadedTutorials';
// ======================================================
// ADMIN PORTAL
// ======================================================
import AdminLayout from './components/AdminLayout';
import AdminDashboard from './components/AdminDashboard';
import AdminAccounts from './components/AdminAccounts';
import AdminGyms from './components/AdminGyms';

import AdminBookingTransactions from './components/AdminBookingTransactions';

import AdminSettings from './components/AdminSettings';





// ======================================================
// READ STORED USER
// ======================================================

function getStoredUser() {

    try {

        const stored =
            localStorage.getItem(
                'user'
            );


        return stored
            ? JSON.parse(
                stored
            )
            : null;

    } catch {

        return null;

    }
}


// ======================================================
// USER PROTECTED ROUTE
// ======================================================

function UserProtectedRoute() {

    const token =
        localStorage.getItem(
            'token'
        );


    const user =
        getStoredUser();


    // ==================================================
    // NOT LOGGED IN
    // ==================================================

    if (
        !token
    ) {

        return (
            <Navigate
                to="/login"
                replace
            />
        );

    }


    // ==================================================
    // COACH SHOULD NOT ENTER USER PORTAL
    // ==================================================

    if (
        user?.role ===
        'coach'
    ) {

        return (
            <Navigate
                to="/coach/dashboard"
                replace
            />
        );

    }


    // Do not allow admins into normal user pages.
    if (user?.role === 'admin') {
        return <Navigate to="/admin/dashboard" replace />;
    }

    if (!user || !['user', null, undefined].includes(user.role)) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}


// ======================================================
// COACH PROTECTED ROUTE
// ======================================================

function CoachProtectedRoute() {

    const token =
        localStorage.getItem(
            'token'
        );


    const user =
        getStoredUser();


    // ==================================================
    // NOT LOGGED IN
    // ==================================================

    if (
        !token
    ) {

        return (
            <Navigate
                to="/login"
                replace
            />
        );

    }


    if (user?.role === 'admin') {
        return <Navigate to="/admin/dashboard" replace />;
    }

    // ==================================================
    // ONLY COACH CAN ENTER
    // ==================================================

    if (
        user?.role !==
        'coach'
    ) {

        return (
            <Navigate
                to="/dashboard"
                replace
            />
        );

    }


    return (
        <Outlet />
    );
}


// ======================================================
// ADMIN PROTECTED ROUTE
// Frontend guard only. API must check JWT role too.
// ======================================================

function AdminProtectedRoute() {
    const token = localStorage.getItem('token');
    const user = getStoredUser();

    if (!token || !user) {
        return <Navigate to="/login" replace />;
    }
    if (user.role === 'user') {
        return <Navigate to="/dashboard" replace />;
    }
    if (user.role === 'coach') {
        return <Navigate to="/coach/dashboard" replace />;
    }
    if (user.role !== 'admin') {
        return <Navigate to="/login" replace />;
    }
    return <Outlet />;
}

// ======================================================
// HOME REDIRECT
// ======================================================

function HomeRedirect() {

    const token =
        localStorage.getItem(
            'token'
        );


    const user =
        getStoredUser();


    // ==================================================
    // NOT LOGGED IN
    // ==================================================

    if (
        !token
    ) {

        return (
            <Navigate
                to="/login"
                replace
            />
        );

    }


    if (user?.role === 'admin') {
        return <Navigate to="/admin/dashboard" replace />;
    }

    // ==================================================
    // COACH
    // ==================================================

    if (
        user?.role ===
        'coach'
    ) {

        return (
            <Navigate
                to="/coach/dashboard"
                replace
            />
        );

    }


    // ==================================================
    // NORMAL USER
    // ==================================================

    return (
        <Navigate
            to="/dashboard"
            replace
        />
    );
}


// ======================================================
// APP
// ======================================================

export default function App() {

    return (
        <BrowserRouter>

            <Routes>

                {/* =====================================
                    HOME
                ===================================== */}

                <Route
                    path="/"
                    element={
                        <HomeRedirect />
                    }
                />


                {/* =====================================
                    PUBLIC AUTHENTICATION
                ===================================== */}

                <Route
                    path="/login"
                    element={
                        <Login />
                    }
                />

                
                {/* =====================================
                    FORGOT PASSWORD - USERS AND COACHES
                ===================================== */}

                <Route
                    path="/forgot-password"
                    element={
                        <ForgotPassword />
                    }
                />



                {/* =====================================
                    REGISTRATION CHOICE
                ===================================== */}

                <Route
                    path="/register"
                    element={
                        <RegisterChoice />
                    }
                />


                {/* =====================================
                    USER REGISTRATION
                ===================================== */}

                <Route
                    path="/register/user"
                    element={
                        <Register />
                    }
                />


                {/* =====================================
                    COACH REGISTRATION
                ===================================== */}

                <Route
                    path="/register/coach"
                    element={
                        <CoachRegister />
                    }
                />


                {/* =====================================
                    NORMAL USER APPLICATION
                ===================================== */}

                <Route
                    element={
                        <UserProtectedRoute />
                    }
                >

                    <Route
                        element={
                            <AppLayout />
                        }
                    >

                        {/* =============================
                            USER DASHBOARD
                        ============================= */}

                        <Route
                            path="/dashboard"
                            element={
                                <Dashboard />
                            }
                        />


                        {/* =============================
                            AI SCANNER
                        ============================= */}

                        <Route
                            path="/ai-scanner"
                            element={
                                <AIScanner />
                            }
                        />


                        {/* =============================
                            RECIPES
                        ============================= */}

                        <Route
                            path="/recipes"
                            element={
                                <Recipes />
                            }
                        />


                        {/* =============================
                            GENERATED RECIPE
                        ============================= */}

                        <Route
                            path="/recipe/generated"
                            element={
                                <RecipeDetail />
                            }
                        />


                        {/* =============================
                            PROFILE
                        ============================= */}

                        <Route
                            path="/profile"
                            element={
                                <Profile />
                            }
                        />


                        {/* =============================
                            USER GYM MAP
                        ============================= */}

                        <Route
                            path="/gym-map"
                            element={
                                <GymMap />
                            }
                        />


                        {/* =============================
                            USER COACH BOOKINGS
                        ============================= */}

                        <Route
                            path="/coach-booking"
                            element={
                                <CoachBooking />
                            }
                        />
                        
                        {/* =====================================
                            INTERACTIVE MUSCLE MAP
                        ===================================== */}

                        <Route
                            path="/muscle-map"
                            element={<InteractiveMuscleMap />}
                        />
                        
                        {/* =====================================
                            USER EXERCISE TUTORIAL LIBRARY
                        ===================================== */}

                        <Route
                            path="/muscle-map/tutorials"
                            element={<ExerciseTutorialLibrary />}
                        />
                        
                        {/* =====================================
                            USER - ANALYTICS REPORT
                        ===================================== */}

                        <Route
                            path="/analytics-report"
                            element={<AnalyticsReport />}
                        />




                    </Route>

                </Route>


                {/* =====================================
                    COACH APPLICATION
                ===================================== */}

                <Route
                    element={
                        <CoachProtectedRoute />
                    }
                >

                    {/* =================================
                        COACH PORTAL LAYOUT

                        /coach/dashboard
                        /coach/gyms
                        /coach/schedule
                    ================================= */}

                    <Route
                        path="/coach"
                        element={
                            <CoachLayout />
                        }
                    >

                        {/* =============================
                            DEFAULT COACH PAGE

                            /coach
                            ↓
                            /coach/dashboard
                        ============================= */}

                        <Route
                            index
                            element={
                                <Navigate
                                    to="dashboard"
                                    replace
                                />
                            }
                        />


                        {/* =============================
                            COACH DASHBOARD
                        ============================= */}

                        <Route
                            path="dashboard"
                            element={
                                <CoachWelcome />
                            }
                        />
                        
                        {/* =====================================
                            COACH PROFILE SETTINGS
                        ===================================== */}

                        <Route
                            path="settings"
                            element={<CoachSettings />}
                        />



                        {/* =============================
                            COACH GYM LOCATIONS
                        ============================= */}

                        <Route
                            path="gyms"
                            element={
                                <CoachGymLocations />
                            }
                        />


                        {/* =============================
                            COACH SCHEDULE
                        ============================= */}

                        <Route
                            path="schedule"
                            element={
                                <CoachSchedule />
                            }
                        />
                        
                        {/* =====================================
                            COACH PERFORMANCE DASHBOARD
                        ===================================== */}

                        <Route
                            path="performance"
                            element={<CoachPerformance />}
                        />

                        
                        {/* =====================================
                            COACH MUSCLE TUTORIALS
                        ===================================== */}

                        <Route
                            path="muscle-tutorials"
                            element={<CoachMuscleTutorial />}
                        />
                        
                        {/* COACH - UPLOADED TUTORIALS */}

                        <Route
                            path="muscle-tutorials/uploads"
                            element={<CoachUploadedTutorials />}
                        />



                    </Route>

                </Route>

                
                {/* =====================================
                    ADMIN PORTAL
                ===================================== */}

                <Route element={<AdminProtectedRoute />}>

                    <Route
                        path="/admin"
                        element={<AdminLayout />}
                    >

                        <Route
                            index
                            element={
                                <Navigate to="dashboard" replace />
                            }
                        />

                        <Route
                            path="dashboard"
                            element={<AdminDashboard />}
                        />

                        {/* MANAGE USERS AND COACHES */}

                        <Route
                            path="accounts"
                            element={<AdminAccounts />}
                        />
                        
                        {/* =====================================
                            ADMIN - GYM OVERSIGHT
                        ===================================== */}

                        <Route
                            path="gyms"
                            element={<AdminGyms />}
                        />
                        
                        {/* =====================================
                            ADMIN - BOOKING TRANSACTIONS
                        ===================================== */}

                        <Route
                            path="booking-transactions"
                            element={<AdminBookingTransactions />}
                        />
                        
                        {/* =====================================
                            ADMIN SETTINGS
                        ===================================== */}

                        <Route
                        path="settings"
                        element={<AdminSettings />}
                        />




                    </Route>
                    

                </Route>


                {/* =====================================
                    UNKNOWN URL
                ===================================== */}

                <Route
                    path="*"
                    element={
                        <HomeRedirect />
                    }
                />

            </Routes>

        </BrowserRouter>
    );
}