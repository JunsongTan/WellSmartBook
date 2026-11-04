import {
    NavLink,
    Outlet,
    useNavigate
} from 'react-router-dom';


export default function CoachLayout() {

    const navigate =
        useNavigate();


    // ==================================================
    // LOGOUT
    // ==================================================

    function logout() {

        localStorage.removeItem(
            'token'
        );

        localStorage.removeItem(
            'user'
        );


        navigate(
            '/login'
        );
    }


    return (
        <div className="coach-layout">

            <style>
                {coachLayoutCss}
            </style>


            {/* =========================================
                SIDEBAR
            ========================================= */}

            <aside className="coach-sidebar">

                {/* =====================================
                    LOGO
                ===================================== */}

                <div className="coach-logo">

                    <div className="coach-logo-icon">
                        ♥
                    </div>


                    <div className="coach-logo-copy">

                        <strong>
                            WellSmartBook
                        </strong>

                        <span>
                            Coach Portal
                        </span>

                    </div>

                </div>


                {/* =====================================
                    NAVIGATION
                ===================================== */}

                <nav className="coach-nav">

                    {/* DASHBOARD */}

                    <NavLink
                        to="/coach/dashboard"
                        className={
                            ({ isActive }) =>
                                isActive
                                    ? 'coach-nav-item active'
                                    : 'coach-nav-item'
                        }
                    >
                        <span className="coach-nav-icon">
                            ⌂
                        </span>

                        <span className="coach-nav-text">
                            Dashboard
                        </span>
                    </NavLink>


                    {/* GYM LOCATIONS */}

                    <NavLink
                        to="/coach/gyms"
                        className={
                            ({ isActive }) =>
                                isActive
                                    ? 'coach-nav-item active'
                                    : 'coach-nav-item'
                        }
                    >
                        <span className="coach-nav-icon">
                            ◉
                        </span>

                        <span className="coach-nav-text">
                            Gym Locations
                        </span>
                    </NavLink>


                    {/* SCHEDULE */}

                    <NavLink
                        to="/coach/schedule"
                        className={
                            ({ isActive }) =>
                                isActive
                                    ? 'coach-nav-item active'
                                    : 'coach-nav-item'
                        }
                    >
                        <span className="coach-nav-icon">
                            □
                        </span>

                        <span className="coach-nav-text">
                            Schedule
                        </span>
                    </NavLink>

                    
                    {/* =====================================
                        MUSCLE TRAINING TUTORIALS
                    ===================================== */}

                    <NavLink
                        to="/coach/muscle-tutorials"
                        className={
                            ({ isActive }) =>
                                isActive
                                    ? 'coach-nav-item active'
                                    : 'coach-nav-item'
                        }
                    >
                        <span className="coach-nav-icon">
                            ▣
                        </span>

                        <span className="coach-nav-text">
                            Muscle Tutorials
                        </span>
                    </NavLink>



                    
                    {/* =====================================
                        COACH PERFORMANCE
                    ===================================== */}

                    <NavLink
                        to="/coach/performance"
                        className={({ isActive }) =>
                            isActive
                                ? 'coach-nav-item active'
                                : 'coach-nav-item'
                        }
                    >
                        <span className="coach-nav-icon">
                            ↗
                        </span>

                        <span className="coach-nav-text">
                            Performance
                        </span>
                    </NavLink>


                </nav>


                {/* =====================================
                    SIDEBAR BOTTOM
                ===================================== */}

                <div className="coach-sidebar-bottom">

                    
                {/* =====================================
                    COACH SETTINGS
                ===================================== */}

                <NavLink
                    to="/coach/settings"
                    aria-label="Coach Settings"
                    className={({ isActive }) =>
                        isActive
                            ? 'coach-settings-button active'
                            : 'coach-settings-button'
                    }
                >
                    <span>⚙</span>

                    <span className="coach-bottom-text">
                        Settings
                    </span>
                </NavLink>



                    {/* LOGOUT */}

                    <button
                        type="button"
                        className="coach-logout-button"
                        onClick={
                            logout
                        }
                    >
                        <span>
                            ↪
                        </span>

                        <span className="coach-bottom-text">
                            Logout
                        </span>
                    </button>

                </div>

            </aside>


            {/* =========================================
                MAIN AREA
            ========================================= */}

            <section className="coach-main">

                {/* =====================================
                    TOP BAR
                ===================================== */}

                <header className="coach-topbar">

                    <div className="coach-topbar-title">

                        <strong>
                            Coach Portal
                        </strong>

                        <span>
                            WellSmartBook Fitness Management
                        </span>

                    </div>


                    <div className="coach-topbar-status">

                        <span className="status-dot" />

                        <span>
                            Active Coach
                        </span>

                    </div>

                </header>


                {/* =====================================
                    PAGE CONTENT
                ===================================== */}

                <main className="coach-page-content">

                    <Outlet />

                </main>

            </section>

        </div>
    );
}


// ======================================================
// CSS
// ======================================================

const coachLayoutCss = `

* {
    box-sizing: border-box;
}

html,
body,
#root {
    margin: 0;
    min-height: 100%;
}

.coach-layout {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 245px minmax(0, 1fr);
    background: #f6f8fc;
    color: #172033;
}

/* =====================================================
   SIDEBAR
===================================================== */

.coach-sidebar {
    position: sticky;
    top: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    padding: 24px 18px;
    border-right: 1px solid #e2e8f0;
    background: white;
    z-index: 30;
}

/* =====================================================
   LOGO
===================================================== */

.coach-logo {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 0 8px 26px;
}

.coach-logo-icon {
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0759d9;
    color: white;
    font-size: 16px;
}

.coach-logo-copy strong {
    display: block;
    color: #0759d9;
    font-size: 17px;
    line-height: 1.2;
}

.coach-logo-copy span {
    display: block;
    margin-top: 4px;
    color: #94a3b8;
    font-size: 8px;
}

/* =====================================================
   NAVIGATION
===================================================== */

.coach-nav {
    display: grid;
    gap: 6px;
}

.coach-nav-item {
    width: 100%;
    min-height: 43px;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 0 12px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: #64748b;
    text-decoration: none;
    text-align: left;
    font-family: inherit;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    transition:
        background .16s ease,
        color .16s ease;
}

.coach-nav-item:hover:not(.disabled) {
    background: #f1f5f9;
    color: #172033;
}

.coach-nav-item.active {
    background: #eaf2ff;
    color: #0759d9;
}

.coach-nav-icon {
    width: 20px;
    flex-shrink: 0;
    text-align: center;
    color: #94a3b8;
    font-size: 15px;
}

.coach-nav-item.active .coach-nav-icon {
    color: #0759d9;
}

.coach-nav-text {
    flex: 1;
}

.coach-nav-item small {
    margin-left: auto;
    padding: 3px 6px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #94a3b8;
    font-size: 6px;
    font-weight: 700;
}

.coach-nav-item.disabled {
    opacity: .52;
    cursor: not-allowed;
}

/* =====================================================
   BOTTOM
===================================================== */

.coach-sidebar-bottom {
    margin-top: auto;
    display: grid;
    gap: 6px;
}

.coach-settings-button,
.coach-logout-button {
    width: 100%;
    min-height: 40px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 12px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    text-align: left;
    font-family: inherit;
    font-size: 9px;
    font-weight: 700;
}


/* =====================================
   ACTIVE COACH SETTINGS LINK
===================================== */

.coach-settings-button {
    color: #64748b;
    opacity: 1;
    cursor: pointer;
    text-decoration: none;
}

.coach-settings-button:hover {
    background: #f1f5f9;
    color: #172033;
}

.coach-settings-button.active {
    background: #eaf2ff;
    color: #0759d9;
}


.coach-settings-button small {
    margin-left: auto;
    padding: 3px 6px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #94a3b8;
    font-size: 6px;
}

.coach-logout-button {
    color: #dc2626;
    cursor: pointer;
}

.coach-logout-button:hover {
    background: #fff1f2;
}

/* =====================================================
   MAIN
===================================================== */

.coach-main {
    min-width: 0;
    min-height: 100vh;
}

/* =====================================================
   TOP BAR
===================================================== */

.coach-topbar {
    position: sticky;
    top: 0;
    z-index: 20;
    height: 73px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 0 31px;
    border-bottom: 1px solid #e2e8f0;
    background: rgba(255,255,255,.96);
    backdrop-filter: blur(10px);
}

.coach-topbar-title strong {
    display: block;
    color: #172033;
    font-size: 12px;
}

.coach-topbar-title span {
    display: block;
    margin-top: 3px;
    color: #94a3b8;
    font-size: 8px;
}

.coach-topbar-status {
    display: flex;
    align-items: center;
    gap: 7px;
    color: #15803d;
    font-size: 8px;
    font-weight: 700;
}

.status-dot {
    width: 8px;
    height: 8px;
    flex-shrink: 0;
    border-radius: 50%;
    background: #22c55e;
}

/* =====================================================
   CONTENT
===================================================== */

.coach-page-content {
    width: 100%;
    padding: 28px 31px 45px;
}

/* =====================================================
   RESPONSIVE - TABLET
===================================================== */

@media(max-width: 900px) {

    .coach-layout {
        grid-template-columns: 78px minmax(0,1fr);
    }

    .coach-sidebar {
        padding: 18px 10px;
    }

    .coach-logo {
        justify-content: center;
        padding-left: 0;
        padding-right: 0;
    }

    .coach-logo-copy {
        display: none;
    }

    .coach-nav-item {
        justify-content: center;
        padding: 0;
    }

    .coach-nav-text,
    .coach-nav-item small {
        display: none;
    }

    .coach-nav-icon {
        width: auto;
        font-size: 17px;
    }

    .coach-settings-button,
    .coach-logout-button {
        justify-content: center;
        padding: 0;
    }

    .coach-bottom-text,
    .coach-settings-button small {
        display: none;
    }

}

/* =====================================================
   RESPONSIVE - MOBILE
===================================================== */

@media(max-width: 600px) {

    .coach-layout {
        grid-template-columns: 64px minmax(0,1fr);
    }

    .coach-sidebar {
        padding:
            14px 7px;
    }

    .coach-logo-icon {
        width: 38px;
        height: 38px;
    }

    .coach-topbar {
        height: 66px;
        padding: 0 16px;
    }

    .coach-topbar-title span {
        display: none;
    }

    .coach-topbar-status > span:last-child {
        display: none;
    }

    .coach-page-content {
        padding:
            20px 14px 35px;
    }

}

`;