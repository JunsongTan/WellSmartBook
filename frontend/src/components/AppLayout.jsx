import {
    useEffect,
    useState
} from 'react';

import {
    NavLink,
    Outlet,
    useNavigate
} from 'react-router-dom';

const API_BASE_URL =
    `http://${window.location.hostname}:5000`;


const navItems = [
    {
        label:
            'Dashboard',

        path:
            '/dashboard',

        icon:
            '▦'
    },

    {
        label:
            'AI Scanner',

        path:
            '/ai-scanner',

        icon:
            '✥'
    },

    {
        label:
            'Recipes',

        path:
            '/recipes',

        icon:
            '🍴'
    },

    {
        label:
            'Gym Map',

        path:
            '/gym-map',

        icon:
            '◫'
    },

    {
        label:
            'Coach Booking',

        path:
            '/coach-booking',

        icon:
            '▣'
    },
    
    {
        label: 'Muscle Map',
        path: '/muscle-map',
        icon: '♟'
    },

    
    {
        label:
            'Analytics Report',

        path:
            '/analytics-report',

        icon:
            '▤'
    }


];


export default function AppLayout() {

    const navigate =
        useNavigate();


    const [
        currentUser,
        setCurrentUser
    ] = useState(
        readStoredUser()
    );


    const [
        mobileMenuOpen,
        setMobileMenuOpen
    ] = useState(false);


    useEffect(
        () => {

            function refreshUser() {

                setCurrentUser(
                    readStoredUser()
                );
            }


            window.addEventListener(
                'profileUpdated',
                refreshUser
            );


            window.addEventListener(
                'storage',
                refreshUser
            );


            return () => {

                window.removeEventListener(
                    'profileUpdated',
                    refreshUser
                );


                window.removeEventListener(
                    'storage',
                    refreshUser
                );
            };
        },
        []
    );


    useEffect(
        () => {

            function handleResize() {

                if (
                    window.innerWidth >
                    760
                ) {

                    setMobileMenuOpen(
                        false
                    );
                }
            }


            window.addEventListener(
                'resize',
                handleResize
            );


            return () => {

                window.removeEventListener(
                    'resize',
                    handleResize
                );
            };
        },
        []
    );


    function closeMobileMenu() {

        setMobileMenuOpen(
            false
        );
    }


    function logout() {

        localStorage.removeItem(
            'token'
        );

        localStorage.removeItem(
            'user'
        );


        closeMobileMenu();


        navigate(
            '/login'
        );
    }


    return (
        <div className="wsb-shell">

            <style>
                {layoutCss}
            </style>


            <aside
                className={
                    mobileMenuOpen
                        ? 'wsb-sidebar mobile-open'
                        : 'wsb-sidebar'
                }
            >

                <button
                    type="button"
                    className="wsb-brand"
                    onClick={() => {

                        closeMobileMenu();

                        navigate(
                            '/dashboard'
                        );
                    }}
                >

                    <div className="wsb-logo-box">
                        ♥
                    </div>


                    <div>
                        <strong>
                            WellSmartBook
                        </strong>

                        <span>
                            Your Health Companion
                        </span>
                    </div>

                </button>


                <nav className="wsb-nav">

                    {navItems.map(
                        (
                            item
                        ) => (
                            <NavLink
                                key={
                                    item.path
                                }
                                to={
                                    item.path
                                }
                                onClick={
                                    closeMobileMenu
                                }
                                className={
                                    (
                                        {
                                            isActive
                                        }
                                    ) =>
                                        isActive
                                            ? 'wsb-nav-link active'
                                            : 'wsb-nav-link'
                                }
                            >
                                <span className="nav-icon">
                                    {item.icon}
                                </span>

                                <span>
                                    {item.label}
                                </span>
                            </NavLink>
                        )
                    )}

                </nav>


                <div className="wsb-sidebar-bottom">

                
                    <button
                        type="button"
                        className="bottom-link"
                    >
                        <span>
                            ?
                        </span>

                        Help Support
                    </button>


                    <button
                        type="button"
                        className="bottom-link"
                        onClick={
                            logout
                        }
                    >
                        <span>
                            ↪
                        </span>

                        Logout
                    </button>

                </div>

            </aside>


            {mobileMenuOpen && (

                <button
                    type="button"
                    className="wsb-mobile-overlay"
                    aria-label="Close navigation menu"
                    onClick={
                        closeMobileMenu
                    }
                />

            )}


            <div className="wsb-right">

                <header className="wsb-topbar">

                    <button
                        type="button"
                        className="wsb-mobile-menu-button"
                        aria-label="Open navigation menu"
                        aria-expanded={
                            mobileMenuOpen
                        }
                        onClick={() =>
                            setMobileMenuOpen(
                                true
                            )
                        }
                    >
                        ☰
                    </button>


                    <div className="topbar-actions">

                        <button
                            type="button"
                            className="small-header-button"
                            title="Notifications"
                        >
                            ♧
                        </button>


                        <button
                            type="button"
                            className="small-header-button"
                            title="Profile Settings"
                            onClick={() =>
                                navigate(
                                    '/profile'
                                )
                            }
                        >
                            ⚙
                        </button>


                        <button
                            type="button"
                            className="profile-avatar-button"
                            title="My Profile"
                            onClick={() =>
                                navigate(
                                    '/profile'
                                )
                            }
                        >

                            {currentUser
                                ?.profilePicture ? (

                                <img
                                    src={
                                        getProfileImageUrl(
                                            currentUser.profilePicture
                                        )
                                    }
                                    alt="Profile"
                                />

                            ) : (

                                <span>
                                    {
                                        getInitials(
                                            currentUser?.fullName ||
                                            currentUser?.username
                                        )
                                    }
                                </span>

                            )}

                        </button>

                    </div>

                </header>


                <main className="wsb-content">

                    <Outlet />

                </main>

            </div>

        </div>
    );
}


function readStoredUser() {

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


function getProfileImageUrl(
    value
) {

    if (!value) {

        return null;
    }


    const text =
        String(
            value
        ).trim();


    if (
        text.startsWith('data:') ||
        text.startsWith('blob:')
    ) {

        return text;
    }


    if (
        text.startsWith('http://') ||
        text.startsWith('https://')
    ) {

        try {

            const url =
                new URL(
                    text
                );


            if (
                url.hostname ===
                    'localhost' ||
                url.hostname ===
                    '127.0.0.1'
            ) {

                url.hostname =
                    window.location.hostname;


                return url.toString();
            }


            return text;

        } catch {

            return text;
        }
    }


    if (
        text.startsWith('/')
    ) {

        return `${API_BASE_URL}${text}`;
    }


    if (
        text.startsWith(
            'profile-images/'
        )
    ) {

        return `${API_BASE_URL}/${text}`;
    }


    return (
        `${API_BASE_URL}/profile-images/` +
        encodeURIComponent(
            text
        )
    );
}


function getInitials(
    value
) {

    return String(
        value ||
        'U'
    )
        .trim()
        .split(
            /\s+/
        )
        .slice(
            0,
            2
        )
        .map(
            (
                item
            ) =>
                item[0]
                    ?.toUpperCase()
        )
        .join('') ||
        'U';
}


const layoutCss = `

* {
    box-sizing: border-box;
}

.wsb-shell {
    min-height: 100vh;
    background: #f5f7fb;
}

.wsb-sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 280px;
    padding: 27px 20px 20px;
    background: #eef4ff;
    border-right: 1px solid #dbe3ef;
    display: flex;
    flex-direction: column;
    z-index: 50;
}

.wsb-brand {
    display: flex;
    align-items: flex-start;
    gap: 13px;
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    text-align: left;
    cursor: pointer;
}

.wsb-logo-box {
    width: 43px;
    height: 43px;
    flex-shrink: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 11px;
    background: #0b5be7;
    color: white;
    font-size: 19px;
}

.wsb-brand strong {
    display: block;
    margin-top: 1px;
    color: #0050c8;
    font-size: 20px;
    letter-spacing: .2px;
}

.wsb-brand span {
    display: block;
    margin-top: 17px;
    color: #55708d;
    font-size: 9px;
}

.wsb-nav {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-top: 53px;
}

.wsb-nav-link {
    display: flex;
    align-items: center;
    gap: 15px;
    min-height: 54px;
    padding: 0 13px;
    border-radius: 10px;
    color: #071d3f;
    text-decoration: none;
    font-size: 15px;
    font-weight: 600;
}

.wsb-nav-link:hover {
    background: rgba(255,255,255,.55);
}

.wsb-nav-link.active {
    background: white;
    color: #0759d9;
}

.nav-icon {
    width: 21px;
    text-align: center;
    font-size: 16px;
}

.wsb-sidebar-bottom {
    margin-top: auto;
}

.upgrade-button {
    width: 100%;
    margin-bottom: 23px;
    padding: 15px;
    border: 0;
    border-radius: 10px;
    background: #0b61e9;
    color: white;
    font-size: 16px;
    font-weight: 800;
    cursor: pointer;
}

.bottom-link {
    display: flex;
    align-items: center;
    gap: 11px;
    width: 100%;
    padding: 10px 7px;
    border: 0;
    background: transparent;
    color: #233a5a;
    text-align: left;
    cursor: pointer;
    font-size: 14px;
}

.bottom-link span {
    width: 14px;
    text-align: center;
}

.wsb-right {
    min-height: 100vh;
    margin-left: 280px;
}

.wsb-topbar {
    position: sticky;
    top: 0;
    z-index: 40;
    height: 72px;
    padding: 0 40px;
    background: white;
    border-bottom: 1px solid #e5eaf1;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.topbar-actions {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-left: auto;
}

.small-header-button {
    width: 38px;
    height: 38px;
    border: 0;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    color: #111827;
    font-size: 16px;
}

.small-header-button:hover {
    background: #f4f7fb;
}

.profile-avatar-button {
    width: 44px;
    height: 44px;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: 50%;
    background: #dcecff;
    color: #0759d9;
    cursor: pointer;
    font-size: 14px;
    font-weight: 800;
    display: flex;
    justify-content: center;
    align-items: center;
}

.profile-avatar-button:hover {
    box-shadow: 0 0 0 4px rgba(7,89,217,.08);
}

.profile-avatar-button img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.wsb-content {
    width: 100%;
    min-height: calc(100vh - 72px);
    padding: 39px 43px 60px;
    background: #f5f7fb;
}

/* ======================================================
   MOBILE NAVIGATION CONTROLS
   ====================================================== */

.wsb-mobile-menu-button {
    display: none;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 0;
    border-radius: 10px;
    background: #eef4ff;
    color: #0759d9;
    cursor: pointer;
    font-size: 20px;
    font-weight: 800;
    align-items: center;
    justify-content: center;
}

.wsb-mobile-overlay {
    display: none;
}


@media(max-width: 850px) {

    .wsb-sidebar {
        width: 76px;
        padding-left: 11px;
        padding-right: 11px;
    }

    .wsb-brand > div:last-child,
    .wsb-nav-link > span:last-child,
    .bottom-link:not(:last-child),
    .upgrade-button {
        display: none;
    }

    .wsb-brand {
        justify-content: center;
    }

    .wsb-nav-link {
        justify-content: center;
        padding: 0;
    }

    .wsb-right {
        margin-left: 76px;
    }

    .wsb-content {
        padding: 25px 20px 45px;
    }

    .wsb-topbar {
        padding: 0 20px;
    }

    .bottom-link {
        justify-content: center;
    }
}


/* ======================================================
   PHONE
   ====================================================== */

@media(max-width: 760px) {

    .wsb-sidebar {
        width: min(280px, 84vw);
        padding: 24px 18px 20px;
        transform: translateX(-100%);
        transition: transform .24s ease;
        box-shadow: 12px 0 32px rgba(15, 23, 42, .14);
        z-index: 80;
    }

    .wsb-sidebar.mobile-open {
        transform: translateX(0);
    }

    .wsb-sidebar .wsb-brand > div:last-child {
        display: block;
    }

    .wsb-sidebar .wsb-nav-link > span:last-child,
    .wsb-sidebar .bottom-link {
        display: inline;
    }

    .wsb-sidebar .wsb-brand {
        justify-content: flex-start;
    }

    .wsb-sidebar .wsb-nav-link {
        justify-content: flex-start;
        padding: 0 13px;
    }

    .wsb-sidebar .bottom-link {
        justify-content: flex-start;
    }

    .wsb-mobile-overlay {
        display: block;
        position: fixed;
        inset: 0;
        z-index: 70;
        padding: 0;
        border: 0;
        background: rgba(15, 23, 42, .42);
        cursor: pointer;
    }

    .wsb-right {
        margin-left: 0;
        width: 100%;
        min-width: 0;
    }

    .wsb-topbar {
        height: 64px;
        padding: 0 14px;
        gap: 12px;
    }

    .wsb-mobile-menu-button {
        display: inline-flex;
        flex-shrink: 0;
    }

    .topbar-actions {
        margin-left: auto;
        gap: 8px;
    }

    .small-header-button {
        width: 36px;
        height: 36px;
    }

    .profile-avatar-button {
        width: 38px;
        height: 38px;
    }

    .wsb-content {
        width: 100%;
        min-width: 0;
        min-height: calc(100vh - 64px);
        padding: 20px 14px 36px;
        overflow-x: hidden;
    }
}


/* ======================================================
   SMALL PHONE
   ====================================================== */

@media(max-width: 420px) {

    .wsb-topbar {
        padding-left: 10px;
        padding-right: 10px;
    }

    .wsb-content {
        padding-left: 10px;
        padding-right: 10px;
    }

    .topbar-actions {
        gap: 4px;
    }
}

`;