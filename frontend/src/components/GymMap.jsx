import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';

import { useNavigate } from 'react-router-dom';

const API_BASE_URL =
    `http://${window.location.hostname}:5000`;

const GOOGLE_MAPS_API_KEY =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const GOOGLE_MAPS_MAP_ID =
    import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ||
    'DEMO_MAP_ID';

const DEFAULT_CENTER = {
    lat: 4.2105,
    lng: 101.9758
};

let googleMapsLoaderPromise = null;

// ======================================================
// GOOGLE MAPS LOADER
// ======================================================

function loadGoogleMaps() {
    if (window.google?.maps?.Map) {
        return Promise.resolve(window.google.maps);
    }

    if (googleMapsLoaderPromise) {
        return googleMapsLoaderPromise;
    }

    googleMapsLoaderPromise = new Promise((resolve, reject) => {
        if (!GOOGLE_MAPS_API_KEY) {
            reject(
                new Error(
                    'Google Maps API key is missing. Check frontend/.env.'
                )
            );
            return;
        }

        const existingScript =
            document.getElementById(
                'wellsmartbook-google-maps'
            );

        if (existingScript) {
            const waitForGoogle = setInterval(() => {
                if (window.google?.maps?.Map) {
                    clearInterval(waitForGoogle);
                    resolve(window.google.maps);
                }
            }, 100);

            setTimeout(() => {
                clearInterval(waitForGoogle);

                if (!window.google?.maps?.Map) {
                    reject(
                        new Error(
                            'Google Maps did not finish loading.'
                        )
                    );
                }
            }, 10000);

            return;
        }

        const callbackName =
            '__wellSmartBookGoogleMapsLoaded';

        window[callbackName] = () => {
            resolve(window.google.maps);

            try {
                delete window[callbackName];
            } catch {
                // Ignore cleanup issue.
            }
        };

        const script = document.createElement('script');

        script.id = 'wellsmartbook-google-maps';
        script.src =
            'https://maps.googleapis.com/maps/api/js' +
            `?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}` +
            '&v=weekly' +
            '&loading=async' +
            '&libraries=marker' +
            `&callback=${callbackName}`;

        script.async = true;
        script.defer = true;

        script.onerror = () => {
            googleMapsLoaderPromise = null;
            reject(
                new Error(
                    'Unable to load Google Maps. Check your API key and Google Cloud configuration.'
                )
            );
        };

        document.head.appendChild(script);
    });

    return googleMapsLoaderPromise;
}

// ======================================================
// DATE / DISPLAY HELPERS
// ======================================================

function getMalaysiaDateString() {
    const formatter = new Intl.DateTimeFormat(
        'en-GB',
        {
            timeZone: 'Asia/Kuala_Lumpur',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }
    );

    const values = {};

    formatter
        .formatToParts(new Date())
        .forEach((part) => {
            values[part.type] = part.value;
        });

    return `${values.year}-${values.month}-${values.day}`;
}

function formatSlotTime(value) {
    if (!value) return '';

    const [hourText, minute] =
        String(value)
            .slice(0, 5)
            .split(':');

    const hour = Number(hourText);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minute} ${suffix}`;
}

function parseBookingHoldExpiry(value) {
    if (!value) return null;

    const text = String(value).trim();

    const malaysiaDateTime =
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(
            text
        )
            ? `${text.replace(' ', 'T')}+08:00`
            : text;

    const timestamp = new Date(
        malaysiaDateTime
    ).getTime();

    return Number.isFinite(timestamp)
        ? timestamp
        : null;
}

function formatBookingCountdown(totalSeconds) {
    const safeSeconds = Math.max(
        0,
        Number(totalSeconds || 0)
    );

    const minutes = Math.floor(
        safeSeconds / 60
    );

    const seconds = Math.floor(
        safeSeconds % 60
    );

    return (
        `${String(minutes).padStart(2, '0')}:` +
        `${String(seconds).padStart(2, '0')}`
    );
}


 // ======================================================
 // GYM PHOTOS - RESOLVE BACKEND IMAGE PATHS
 // ======================================================

function getGymImageUrl(value) {

    if (typeof value !== 'string') {
        return '';
    }

    const photoPath = value.trim();

    if (!photoPath) {
        return '';
    }

    // Support photos hosted on external websites.

    if (/^https?:\/\//i.test(photoPath)) {
        return photoPath;
    }

    // Photos uploaded by administrators.

    if (photoPath.startsWith('/api/gym-images/')) {

        return `${API_BASE_URL}${photoPath}`;
    }

    if (photoPath.startsWith('api/gym-images/')) {

        return `${API_BASE_URL}/${photoPath}`;
    }

    return '';
}


function getCoachImageUrl(value) {
    if (!value) return null;

    const text = String(value).trim();

    if (
        text.startsWith('http://') ||
        text.startsWith('https://') ||
        text.startsWith('data:')
    ) {
        return text;
    }

    if (text.startsWith('/')) {
        return `${API_BASE_URL}${text}`;
    }

    if (text.startsWith('profile-images/')) {
        return `${API_BASE_URL}/${text}`;
    }

    return `${API_BASE_URL}/profile-images/${encodeURIComponent(
        text
    )}`;
}

function getTodayOpeningHours(openingHours) {
    if (
        !openingHours ||
        typeof openingHours !== 'object'
    ) {
        return 'Hours not provided';
    }

    const days = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday'
    ];

    const today = days[new Date().getDay()];

    return (
        openingHours[today] ||
        'Hours not provided'
    );
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function GymMap() {
    const navigate = useNavigate();

    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markersRef = useRef([]);

    const [mapReady, setMapReady] = useState(false);
    const [gyms, setGyms] = useState([]);
    const [loadingGyms, setLoadingGyms] = useState(true);
    const [loadingMap, setLoadingMap] = useState(true);
    const [locating, setLocating] = useState(false);
    const [error, setError] = useState('');
    const [locationMessage, setLocationMessage] = useState('');
    const [userLocation, setUserLocation] = useState(null);
    const [selectedGym, setSelectedGym] = useState(null);
    const [searchText, setSearchText] = useState('');

    // ==================================================
    // CREATE MAP
    // ==================================================

    useEffect(() => {
        let cancelled = false;

        async function initialiseMap() {
            try {
                setLoadingMap(true);

                await loadGoogleMaps();

                if (
                    cancelled ||
                    !mapContainerRef.current
                ) {
                    return;
                }

                const map =
                    new window.google.maps.Map(
                        mapContainerRef.current,
                        {
                            center: DEFAULT_CENTER,
                            zoom: 6,
                            mapId: GOOGLE_MAPS_MAP_ID,
                            mapTypeControl: false,
                            streetViewControl: false,
                            fullscreenControl: true,
                            zoomControl: true,
                            clickableIcons: false,
                            gestureHandling: 'greedy',
                            backgroundColor: '#e8eef7'
                        }
                    );

                mapRef.current = map;
                setMapReady(true);
            } catch (mapError) {
                console.error('Google Maps:', mapError);
                setError(
                    mapError.message ||
                    'Unable to load Google Maps.'
                );
            } finally {
                if (!cancelled) {
                    setLoadingMap(false);
                }
            }
        }

        initialiseMap();

        return () => {
            cancelled = true;
        };
    }, []);

    // ==================================================
    // LOAD ACTIVE DATABASE GYMS
    // ==================================================

    const loadGyms = useCallback(
        async (location = null) => {
            const token =
                localStorage.getItem('token');

            if (!token) {
                navigate('/login');
                return;
            }

            try {
                setLoadingGyms(true);
                setError('');

                let query = '';

                if (location) {
                    query =
                        `?latitude=${encodeURIComponent(
                            location.latitude
                        )}` +
                        `&longitude=${encodeURIComponent(
                            location.longitude
                        )}`;
                }

                const response = await fetch(
                    `${API_BASE_URL}/api/gyms${query}`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );

                let data = {};

                try {
                    data = await response.json();
                } catch {
                    data = {};
                }

                if (
                    response.status === 401 ||
                    response.status === 403
                ) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    navigate('/login');
                    return;
                }

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        'Unable to load gym facilities.'
                    );
                }

                setGyms(
                    Array.isArray(data.gyms)
                        ? data.gyms
                        : []
                );
            } catch (loadError) {
                console.error('Load gyms:', loadError);
                setError(
                    loadError.message ||
                    'Unable to load gym facilities.'
                );
            } finally {
                setLoadingGyms(false);
            }
        },
        [navigate]
    );

    useEffect(() => {
        loadGyms();
    }, [loadGyms]);

    // ==================================================
    // USER LOCATION
    // ==================================================

    const locateUser = useCallback(() => {
        if (!navigator.geolocation) {
            setLocationMessage(
                'Your browser does not support location services.'
            );
            return;
        }

        setLocating(true);
        setLocationMessage('');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const location = {
                    latitude:
                        position.coords.latitude,
                    longitude:
                        position.coords.longitude
                };

                setUserLocation(location);
                await loadGyms(location);

                if (mapRef.current) {
                    mapRef.current.panTo({
                        lat: location.latitude,
                        lng: location.longitude
                    });
                    mapRef.current.setZoom(14);
                }

                setLocating(false);
            },
            (locationError) => {
                console.warn(
                    'Browser location:',
                    locationError
                );

                setLocating(false);

                if (locationError.code === 1) {
                    setLocationMessage(
                        'Location permission was denied. You can still browse registered gym facilities.'
                    );
                } else if (locationError.code === 2) {
                    setLocationMessage(
                        'Your current location is unavailable. You can still browse registered gym facilities.'
                    );
                } else {
                    setLocationMessage(
                        'Location request timed out. You can still browse registered gym facilities.'
                    );
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    }, [loadGyms]);

    useEffect(() => {
        locateUser();
    }, [locateUser]);

    // ==================================================
    // SEARCH
    // ==================================================

    const filteredGyms = useMemo(() => {
        const search =
            searchText.trim().toLowerCase();

        if (!search) return gyms;

        return gyms.filter((gym) => {
            const searchable = [
                gym.name,
                gym.fullAddress,
                gym.description,
                ...(gym.amenities || [])
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return searchable.includes(search);
        });
    }, [gyms, searchText]);

    // ==================================================
    // MAP MARKERS
    // ==================================================

    useEffect(() => {
        if (
            !mapReady ||
            !mapRef.current ||
            !window.google?.maps?.marker
                ?.AdvancedMarkerElement
        ) {
            return;
        }

        markersRef.current.forEach((marker) => {
            marker.map = null;
        });
        markersRef.current = [];

        const map = mapRef.current;
        const bounds =
            new window.google.maps.LatLngBounds();

        let markerCount = 0;

        if (userLocation) {
            const userMarkerElement =
                document.createElement('div');

            userMarkerElement.className =
                'wsb-current-location-marker';

            userMarkerElement.innerHTML = `
                <div class="wsb-current-location-ring">
                    <div class="wsb-current-location-dot"></div>
                </div>
            `;

            const userMarker =
                new window.google.maps.marker
                    .AdvancedMarkerElement({
                        map,
                        position: {
                            lat: userLocation.latitude,
                            lng: userLocation.longitude
                        },
                        title:
                            'Your current location',
                        content:
                            userMarkerElement
                    });

            markersRef.current.push(userMarker);
            bounds.extend({
                lat: userLocation.latitude,
                lng: userLocation.longitude
            });
            markerCount += 1;
        }

        filteredGyms.forEach((gym) => {
            const latitude = Number(gym.latitude);
            const longitude = Number(gym.longitude);

            if (
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude)
            ) {
                return;
            }

            const markerElement =
                createGymMarkerElement(
                    selectedGym?.id === gym.id
                );

            const marker =
                new window.google.maps.marker
                    .AdvancedMarkerElement({
                        map,
                        position: {
                            lat: latitude,
                            lng: longitude
                        },
                        title: gym.name,
                        content: markerElement
                    });

            marker.addListener('click', () => {
                openGym(gym);
            });

            markersRef.current.push(marker);
            bounds.extend({
                lat: latitude,
                lng: longitude
            });
            markerCount += 1;
        });

        if (!selectedGym && markerCount > 0) {
            if (markerCount === 1) {
                map.setCenter(bounds.getCenter());
                map.setZoom(14);
            } else {
                map.fitBounds(bounds, 70);
            }
        }
    }, [
        mapReady,
        filteredGyms,
        userLocation,
        selectedGym
    ]);

    function openGym(gym) {
        setSelectedGym(gym);

        if (mapRef.current) {
            mapRef.current.panTo({
                lat: Number(gym.latitude),
                lng: Number(gym.longitude)
            });
            mapRef.current.setZoom(15);
        }
    }

    function closeGym() {
        setSelectedGym(null);
    }

    // ==================================================
    // PAGE
    // ==================================================

    return (
        <div className="gym-map-page">
            <style>{gymMapCss}</style>

            <section className="gym-page-header">
                <div>
                    <span className="page-eyebrow">
                        FITNESS FACILITIES
                    </span>
                    <h1>Find a Facility</h1>
                    <p>
                        Discover registered WellSmartBook gyms near your current location.
                    </p>
                </div>

                <button
                    type="button"
                    className="locate-me-button"
                    disabled={locating}
                    onClick={locateUser}
                >
                    <span>⌖</span>
                    {locating
                        ? 'Locating...'
                        : 'Locate Me'}
                </button>
            </section>

            <section className="gym-toolbar">
                <div className="gym-search-box">
                    <span className="search-icon">
                        ⌕
                    </span>
                    <input
                        type="text"
                        value={searchText}
                        onChange={(event) =>
                            setSearchText(
                                event.target.value
                            )
                        }
                        placeholder="Search gym, address or amenity..."
                    />
                </div>

                <div className="active-facility-count">
                    <strong>
                        {filteredGyms.length}
                    </strong>
                    <span>Active Facilities</span>
                </div>
            </section>

            {locationMessage && (
                <div className="gym-info-message">
                    ℹ {locationMessage}
                </div>
            )}

            {error && (
                <div className="gym-error-message">
                    <span>⚠ {error}</span>
                    <button
                        type="button"
                        onClick={() =>
                            loadGyms(userLocation)
                        }
                    >
                        Retry
                    </button>
                </div>
            )}

            <section className="google-map-wrapper">
                <div
                    ref={mapContainerRef}
                    className="google-map-container"
                />

                {(loadingMap || loadingGyms) && (
                    <div className="map-loading-overlay">
                        <div className="map-loading-spinner" />
                        <p>
                            {loadingMap
                                ? 'Loading Google Maps...'
                                : 'Loading registered facilities...'}
                        </p>
                    </div>
                )}

                {selectedGym && (
                    <GymDetailPanel
                        gym={selectedGym}
                        onClose={closeGym}
                    />
                )}
            </section>

            <section className="facility-directory">
                <div className="directory-heading">
                    <span className="page-eyebrow">
                        {userLocation
                            ? 'NEARBY FACILITIES'
                            : 'FACILITY DIRECTORY'}
                    </span>
                    <h2>
                        {userLocation
                            ? 'Gyms Near You'
                            : 'Registered Gyms'}
                    </h2>
                    <p>
                        Only facilities registered and activated in WellSmartBook are displayed.
                    </p>
                </div>

                {!loadingGyms &&
                filteredGyms.length === 0 ? (
                    <div className="empty-gym-state">
                        <div className="empty-gym-icon">
                            🏢
                        </div>
                        <h3>
                            No gym facilities found
                        </h3>
                        <p>
                            {searchText
                                ? 'No registered gym matches your search.'
                                : 'There are currently no active gym facilities registered by the administrator.'}
                        </p>
                    </div>
                ) : (
                    <div className="gym-card-grid">
                        {filteredGyms.map((gym) => (
                            <GymCard
                                key={gym.id}
                                gym={gym}
                                selected={
                                    selectedGym?.id ===
                                    gym.id
                                }
                                onClick={() =>
                                    openGym(gym)
                                }
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

// ======================================================
// CUSTOM GYM MARKER
// ======================================================

function createGymMarkerElement(selected) {
    const marker =
        document.createElement('div');

    marker.className = selected
        ? 'wsb-google-gym-marker selected'
        : 'wsb-google-gym-marker';

    marker.innerHTML = `
        <div class="wsb-google-gym-circle">
            <span>🏋</span>
        </div>
        <div class="wsb-google-gym-pointer"></div>
    `;

    return marker;
}

// ======================================================
// GYM DETAIL + COACH / SLOT DISCOVERY
// ======================================================

function GymDetailPanel({ gym, onClose }) {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');

    const [coaches, setCoaches] = useState([]);
    const [loadingCoaches, setLoadingCoaches] =
        useState(true);
    const [coachError, setCoachError] =
        useState('');
    const [selectedCoachId, setSelectedCoachId] =
        useState(null);

    const [selectedDate, setSelectedDate] =
        useState(getMalaysiaDateString());
    const [slots, setSlots] = useState([]);
    const [loadingSlots, setLoadingSlots] =
        useState(false);
    const [slotError, setSlotError] =
        useState('');
    const [selectedSlots, setSelectedSlots] =
        useState([]);

    const [creatingHold, setCreatingHold] =
        useState(false);
    const [holdError, setHoldError] =
        useState('');
    const [activeHold, setActiveHold] =
        useState(null);
    const [holdSecondsRemaining, setHoldSecondsRemaining] =
        useState(0);
    const [slotRefreshKey, setSlotRefreshKey] =
        useState(0);

    const [startingPayment, setStartingPayment] =
        useState(false);
    const [paymentError, setPaymentError] =
        useState('');

    const todayHours =
        getTodayOpeningHours(gym.openingHours);

    const directionsUrl =
        'https://www.google.com/maps/dir/?api=1' +
        `&destination=${encodeURIComponent(
            `${gym.latitude},${gym.longitude}`
        )}`;

    const selectedCoach = useMemo(
        () =>
            coaches.find(
                (coach) =>
                    Number(coach.id) ===
                    Number(selectedCoachId)
            ) || null,
        [coaches, selectedCoachId]
    );

    function handleAuthExpired() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    }

    // ==================================================
    // LOAD COACHES AT SELECTED GYM
    // ==================================================

    useEffect(() => {
        let active = true;

        async function loadCoaches() {
            try {
                setLoadingCoaches(true);
                setCoachError('');
                setCoaches([]);
                setSelectedCoachId(null);
                setSlots([]);
                setSelectedSlots([]);
                setHoldError('');
                setPaymentError('');
                setActiveHold(null);
                setHoldSecondsRemaining(0);
                setSelectedDate(
                    getMalaysiaDateString()
                );

                const response = await fetch(
                    `${API_BASE_URL}/api/gyms/${gym.id}/coaches`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );

                let data = {};

                try {
                    data = await response.json();
                } catch {
                    data = {};
                }

                if (
                    response.status === 401 ||
                    response.status === 403
                ) {
                    handleAuthExpired();
                    return;
                }

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        'Unable to load coaches.'
                    );
                }

                if (!active) return;

                const coachList =
                    Array.isArray(data.coaches)
                        ? data.coaches
                        : [];

                setCoaches(coachList);

                if (coachList.length > 0) {
                    setSelectedCoachId(
                        coachList[0].id
                    );
                }
            } catch (requestError) {
                if (active) {
                    setCoachError(
                        requestError.message ||
                        'Unable to load coaches.'
                    );
                }
            } finally {
                if (active) {
                    setLoadingCoaches(false);
                }
            }
        }

        loadCoaches();

        return () => {
            active = false;
        };
    }, [gym.id]);

    // ==================================================
    // LOAD REAL AVAILABLE SLOTS
    // ==================================================

    useEffect(() => {
        if (!selectedCoachId || !selectedDate) {
            setSlots([]);
            setSelectedSlots([]);
            return;
        }

        let active = true;

        async function loadSlots() {
            try {
                setLoadingSlots(true);
                setSlotError('');
                setSlots([]);

                if (!activeHold) {
                    setSelectedSlots([]);
                }

                const response = await fetch(
                    `${API_BASE_URL}/api/coaches/${selectedCoachId}/slots` +
                    `?gymId=${encodeURIComponent(
                        gym.id
                    )}` +
                    `&date=${encodeURIComponent(
                        selectedDate
                    )}`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );

                let data = {};

                try {
                    data = await response.json();
                } catch {
                    data = {};
                }

                if (
                    response.status === 401 ||
                    response.status === 403
                ) {
                    handleAuthExpired();
                    return;
                }

                if (!response.ok) {
                    throw new Error(
                        data.message ||
                        'Unable to load available time slots.'
                    );
                }

                if (active) {
                    setSlots(
                        Array.isArray(data.slots)
                            ? data.slots
                            : []
                    );
                }
            } catch (requestError) {
                if (active) {
                    setSlotError(
                        requestError.message ||
                        'Unable to load available time slots.'
                    );
                }
            } finally {
                if (active) {
                    setLoadingSlots(false);
                }
            }
        }

        loadSlots();

        return () => {
            active = false;
        };
    }, [
        gym.id,
        selectedCoachId,
        selectedDate,
        slotRefreshKey
    ]);

    // ==================================================
    // 15-MINUTE BOOKING HOLD COUNTDOWN
    // ==================================================

    useEffect(() => {
        if (!activeHold?.expiresAtMs) {
            setHoldSecondsRemaining(0);
            return undefined;
        }

        let expiryHandled = false;

        function updateCountdown() {
            const remaining = Math.max(
                0,
                Math.ceil(
                    (
                        activeHold.expiresAtMs -
                        Date.now()
                    ) /
                    1000
                )
            );

            setHoldSecondsRemaining(
                remaining
            );

            if (
                remaining <= 0 &&
                !expiryHandled
            ) {
                expiryHandled = true;

                setActiveHold(null);
                setSelectedSlots([]);
                setHoldError(
                    'Your 15-minute booking hold expired. Please choose the slot again.'
                );
                setSlotRefreshKey(
                    (value) => value + 1
                );
            }
        }

        updateCountdown();

        const timer = window.setInterval(
            updateCountdown,
            1000
        );

        return () => {
            window.clearInterval(timer);
        };
    }, [
        activeHold?.holdKey,
        activeHold?.expiresAtMs
    ]);

    // ==================================================
    // CREATE MULTI-SLOT 15-MINUTE HOLD
    // ==================================================

    async function createBookingHold() {
        if (
            !selectedCoach ||
            selectedSlots.length === 0 ||
            creatingHold ||
            activeHold
        ) {
            return;
        }

        if (!token) {
            handleAuthExpired();
            return;
        }

        try {
            setCreatingHold(true);
            setHoldError('');
            setPaymentError('');

            const response = await fetch(
                `${API_BASE_URL}/api/bookings/hold-batch`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json',

                        Authorization:
                            `Bearer ${token}`
                    },

                    body: JSON.stringify({
                        coachId:
                            selectedCoach.id,

                        gymId:
                            gym.id,

                        date:
                            selectedDate,

                        slots:
                            selectedSlots.map(
                                (slot) => ({
                                    startTime:
                                        slot.startTime,

                                    endTime:
                                        slot.endTime
                                })
                            )
                    })
                }
            );

            let data = {};

            try {
                data = await response.json();
            } catch {
                data = {};
            }

            if (
                response.status === 401 ||
                response.status === 403
            ) {
                handleAuthExpired();
                return;
            }

            if (!response.ok) {
                if (response.status === 409) {
                    setSelectedSlots([]);
                    setSlotRefreshKey(
                        (value) => value + 1
                    );
                }

                throw new Error(
                    data.message ||
                    'Unable to reserve the selected coach times.'
                );
            }

            if (
                !Array.isArray(
                    data.hold?.bookingIds
                ) ||
                data.hold.bookingIds.length === 0
            ) {
                throw new Error(
                    'The booking hold response was incomplete.'
                );
            }

            const expiresAtMs =
                parseBookingHoldExpiry(
                    data.hold.holdExpiresAt
                ) ||
                Date.now() +
                    15 *
                    60 *
                    1000;

            const remaining = Math.max(
                0,
                Math.ceil(
                    (
                        expiresAtMs -
                        Date.now()
                    ) /
                    1000
                )
            );

            setActiveHold({
                ...data.hold,
                expiresAtMs,
                slotCount:
                    data.hold.bookingIds.length,
                holdKey:
                    data.hold.bookingIds.join(
                        ','
                    )
            });

            setHoldSecondsRemaining(
                remaining
            );

        } catch (requestError) {
            console.error(
                'Create booking hold:',
                requestError
            );

            setHoldError(
                requestError.message ||
                'Unable to reserve the selected coach times.'
            );

        } finally {
            setCreatingHold(false);
        }
    }

    // ==================================================
    // START STRIPE CHECKOUT FOR ALL HELD SLOTS
    // ==================================================

    async function startStripeCheckout() {
        if (
            !Array.isArray(
                activeHold?.bookingIds
            ) ||
            activeHold.bookingIds.length === 0 ||
            startingPayment
        ) {
            return;
        }

        if (!token) {
            handleAuthExpired();
            return;
        }

        try {
            setStartingPayment(true);
            setPaymentError('');

            const response = await fetch(
                `${API_BASE_URL}/api/bookings/checkout`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json',

                        Authorization:
                            `Bearer ${token}`
                    },

                    body:
                        JSON.stringify({
                            bookingIds:
                                activeHold.bookingIds
                        })
                }
            );

            let data = {};

            try {
                data = await response.json();
            } catch {
                data = {};
            }

            if (
                response.status === 401 ||
                response.status === 403
            ) {
                handleAuthExpired();
                return;
            }

            if (!response.ok) {
                if (response.status === 409) {
                    setActiveHold(null);
                    setSelectedSlots([]);
                    setHoldSecondsRemaining(0);
                    setSlotRefreshKey(
                        (value) => value + 1
                    );
                }

                throw new Error(
                    data.message ||
                    'Unable to start Stripe Checkout.'
                );
            }

            if (!data.checkoutUrl) {
                throw new Error(
                    'Stripe Checkout URL was not returned by the server.'
                );
            }

            window.location.assign(
                data.checkoutUrl
            );

        } catch (requestError) {
            console.error(
                'Start Stripe Checkout:',
                requestError
            );

            setPaymentError(
                requestError.message ||
                'Unable to start payment.'
            );

        } finally {
            setStartingPayment(false);
        }
    }

    return (
        <aside className="gym-detail-panel">
            <div className="gym-detail-header">
                <div>
                    <span className="gym-detail-eyebrow">
                        FACILITY DETAILS
                    </span>
                    <h2>{gym.name}</h2>
                </div>

                <button
                    type="button"
                    className="close-detail-button"
                    onClick={onClose}
                >
                    ×
                </button>
            </div>

            
            {/* ======================================
                GYM DETAIL PHOTO
            ====================================== */}

            {getGymImageUrl(gym.imageUrl) ? (

                <img
                    className="gym-detail-image"
                    src={getGymImageUrl(gym.imageUrl)}
                    alt={gym.name}
                />

            ) : (

                <div className="gym-detail-placeholder">
                    🏋️
                </div>

            )}


            {gym.distanceKm !== null &&
            gym.distanceKm !== undefined && (
                <div className="gym-distance-pill">
                    ⌖ {gym.distanceKm} km away
                </div>
            )}

            {gym.description && (
                <p className="gym-description">
                    {gym.description}
                </p>
            )}

            <FacilityDetailRow
                icon="⌖"
                label="Address"
                value={gym.fullAddress}
            />

            <FacilityDetailRow
                icon="◷"
                label="Today's Opening Hours"
                value={todayHours}
            />

            {gym.phone && (
                <FacilityDetailRow
                    icon="☎"
                    label="Phone"
                    value={gym.phone}
                />
            )}

            {gym.email && (
                <FacilityDetailRow
                    icon="✉"
                    label="Email"
                    value={gym.email}
                />
            )}

            {gym.websiteUrl && (
                <FacilityDetailRow
                    icon="↗"
                    label="Website"
                    value={gym.websiteUrl}
                />
            )}

            {Array.isArray(gym.amenities) &&
            gym.amenities.length > 0 && (
                <section className="gym-amenity-section">
                    <h3>Amenities</h3>
                    <div className="gym-amenity-list">
                        {gym.amenities.map(
                            (amenity, index) => (
                                <span
                                    key={`${amenity}-${index}`}
                                >
                                    {amenity}
                                </span>
                            )
                        )}
                    </div>
                </section>
            )}

            <a
                className="google-directions-button"
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
            >
                Open Directions in Google Maps
                <span>↗</span>
            </a>

            <section className="coach-discovery-section">
                <div className="coach-discovery-heading">
                    <div>
                        <span>COACHING</span>
                        <h3>Available Coaches</h3>
                        <p>
                            Choose a coach, date and available session time.
                        </p>
                    </div>

                    {!loadingCoaches && (
                        <strong>{coaches.length}</strong>
                    )}
                </div>

                {loadingCoaches ? (
                    <div className="coach-booking-loading">
                        Loading coaches...
                    </div>
                ) : coachError ? (
                    <div className="coach-booking-error">
                        ⚠ {coachError}
                    </div>
                ) : coaches.length === 0 ? (
                    <div className="coach-empty-state">
                        <div>👤</div>
                        <strong>
                            No coaches available yet
                        </strong>
                        <p>
                            No active coach has published future availability at this gym.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="coach-card-list">
                            {coaches.map((coach) => {
                                const imageUrl =
                                    getCoachImageUrl(
                                        coach.profilePicture
                                    );

                                const selected =
                                    Number(
                                        selectedCoachId
                                    ) ===
                                    Number(coach.id);

                                return (
                                    <button
                                        type="button"
                                        key={coach.id}
                                        className={
                                            selected
                                                ? 'coach-option-card selected'
                                                : 'coach-option-card'
                                        }
                                        disabled={Boolean(
                                            activeHold
                                        )}
                                        onClick={() => {
                                            setHoldError('');
                                            setSelectedCoachId(
                                                coach.id
                                            );
                                        }}
                                    >
                                        <div className="coach-avatar">
                                            {imageUrl ? (
                                                <img
                                                    src={imageUrl}
                                                    alt={
                                                        coach.fullName
                                                    }
                                                />
                                            ) : (
                                                <span>
                                                    {String(
                                                        coach.fullName ||
                                                        'C'
                                                    )
                                                        .charAt(0)
                                                        .toUpperCase()}
                                                </span>
                                            )}
                                        </div>

                                        <div className="coach-option-copy">
                                            <strong>
                                                {coach.fullName}
                                            </strong>
                                            <span>
                                                {coach.specialization ||
                                                    'Fitness Coach'}
                                            </span>
                                            <small>
                                                {coach.yearsExperience ||
                                                    0}{' '}
                                                years experience
                                            </small>
                                        </div>

                                        <div className="coach-price">
                                            <strong>
                                                RM{' '}
                                                {Number(
                                                    coach.sessionPrice ||
                                                    0
                                                ).toFixed(2)}
                                            </strong>
                                            <span>
                                                / session
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {selectedCoach && (
                            <section className="slot-picker-section">
                                <div className="selected-coach-summary">
                                    <span>
                                        SELECTED COACH
                                    </span>
                                    <strong>
                                        {selectedCoach.fullName}
                                    </strong>

                                    {selectedCoach.bio && (
                                        <p>
                                            {selectedCoach.bio}
                                        </p>
                                    )}
                                </div>

                                <label className="booking-date-field">
                                    <span>
                                        Choose Session Date
                                    </span>
                                    <input
                                        type="date"
                                        min={
                                            getMalaysiaDateString()
                                        }
                                        value={selectedDate}
                                        disabled={Boolean(
                                            activeHold
                                        )}
                                        onChange={(event) => {
                                            setHoldError('');
                                            setSelectedSlots([]);
                                            setSelectedDate(
                                                event.target.value
                                            );
                                        }}
                                    />
                                </label>

                                <div className="slot-section-heading">
                                    <div>
                                        <strong>
                                            Available Time Slots
                                        </strong>
                                        <small>
                                            Select one or more times before continuing.
                                        </small>
                                    </div>

                                    {!loadingSlots && (
                                        <span>
                                            {slots.length}{' '}
                                            available
                                        </span>
                                    )}
                                </div>

                                {loadingSlots ? (
                                    <div className="coach-booking-loading compact">
                                        Checking availability...
                                    </div>
                                ) : slotError ? (
                                    <div className="coach-booking-error">
                                        ⚠ {slotError}
                                    </div>
                                ) : slots.length === 0 ? (
                                    <div className="slot-empty-state">
                                        <strong>
                                            No available slots
                                        </strong>
                                        <p>
                                            Choose another date or another coach.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="slot-grid">
                                        {slots.map((slot) => {
                                            const key =
                                                `${slot.startTime}-${slot.endTime}`;

                                            const selected =
                                                selectedSlots.some(
                                                    (selectedSlot) =>
                                                        selectedSlot.startTime ===
                                                            slot.startTime &&
                                                        selectedSlot.endTime ===
                                                            slot.endTime
                                                );

                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    className={
                                                        selected
                                                            ? 'slot-button selected'
                                                            : 'slot-button'
                                                    }
                                                    disabled={Boolean(
                                                        activeHold
                                                    )}
                                                    onClick={() => {
                                                        setHoldError('');
                                                        setPaymentError('');

                                                        setSelectedSlots(
                                                            (current) => {
                                                                const exists =
                                                                    current.some(
                                                                        (selectedSlot) =>
                                                                            selectedSlot.startTime ===
                                                                                slot.startTime &&
                                                                            selectedSlot.endTime ===
                                                                                slot.endTime
                                                                    );

                                                                if (exists) {
                                                                    return current.filter(
                                                                        (selectedSlot) =>
                                                                            !(
                                                                                selectedSlot.startTime ===
                                                                                    slot.startTime &&
                                                                                selectedSlot.endTime ===
                                                                                    slot.endTime
                                                                            )
                                                                    );
                                                                }

                                                                return [
                                                                    ...current,
                                                                    slot
                                                                ].sort(
                                                                    (a, b) =>
                                                                        String(
                                                                            a.startTime
                                                                        ).localeCompare(
                                                                            String(
                                                                                b.startTime
                                                                            )
                                                                        )
                                                                );
                                                            }
                                                        );
                                                    }}
                                                >
                                                    <strong>
                                                        {formatSlotTime(
                                                            slot.startTime
                                                        )}
                                                    </strong>
                                                    <span>
                                                        to{' '}
                                                        {formatSlotTime(
                                                            slot.endTime
                                                        )}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {holdError && (
                                    <div className="booking-hold-error">
                                        ⚠ {holdError}
                                    </div>
                                )}

                                {selectedSlots.length > 0 && (
                                    <div className="selected-slot-summary">
                                        <span>
                                            SELECTED SESSIONS
                                        </span>

                                        <strong>
                                            {selectedDate}
                                            {' • '}
                                            {selectedSlots.length}{' '}
                                            session
                                            {selectedSlots.length > 1
                                                ? 's'
                                                : ''}
                                        </strong>

                                        <div className="multi-slot-summary-list">
                                            {selectedSlots.map(
                                                (slot) => (
                                                    <div
                                                        key={`${slot.startTime}-${slot.endTime}`}
                                                        className="multi-slot-summary-row"
                                                    >
                                                        <span>
                                                            {formatSlotTime(
                                                                slot.startTime
                                                            )}
                                                            {' – '}
                                                            {formatSlotTime(
                                                                slot.endTime
                                                            )}
                                                        </span>

                                                        <strong>
                                                            RM{' '}
                                                            {Number(
                                                                slot.amount ||
                                                                selectedCoach.sessionPrice ||
                                                                0
                                                            ).toFixed(2)}
                                                        </strong>
                                                    </div>
                                                )
                                            )}
                                        </div>

                                        {!activeHold ? (
                                            <>
                                                <div className="multi-slot-total">
                                                    <span>
                                                        Total
                                                    </span>
                                                    <strong>
                                                        RM{' '}
                                                        {selectedSlots
                                                            .reduce(
                                                                (
                                                                    total,
                                                                    slot
                                                                ) =>
                                                                    total +
                                                                    Number(
                                                                        slot.amount ||
                                                                        selectedCoach.sessionPrice ||
                                                                        0
                                                                    ),
                                                                0
                                                            )
                                                            .toFixed(2)}
                                                    </strong>
                                                </div>

                                                <button
                                                    type="button"
                                                    disabled={creatingHold}
                                                    className="continue-booking-button"
                                                    onClick={
                                                        createBookingHold
                                                    }
                                                >
                                                    {creatingHold
                                                        ? 'Securing Sessions...'
                                                        : `Continue with ${selectedSlots.length} Session${selectedSlots.length > 1 ? 's' : ''}`}
                                                </button>

                                                <small>
                                                    All selected times are reserved together for 15 minutes. If any one of them is no longer available, none of the selected sessions will be held.
                                                </small>
                                            </>
                                        ) : (
                                            <div className="booking-hold-success">
                                                <div className="booking-hold-success-heading">
                                                    <div>
                                                        <span>
                                                            SESSIONS HELD
                                                        </span>
                                                        <strong>
                                                            {activeHold.slotCount}{' '}
                                                            coach session
                                                            {activeHold.slotCount > 1
                                                                ? 's are'
                                                                : ' is'}{' '}
                                                            reserved
                                                        </strong>
                                                    </div>

                                                    <div className="booking-hold-countdown">
                                                        <small>
                                                            TIME LEFT
                                                        </small>
                                                        <strong>
                                                            {formatBookingCountdown(
                                                                holdSecondsRemaining
                                                            )}
                                                        </strong>
                                                    </div>
                                                </div>

                                                <div className="booking-hold-details">
                                                    <span>
                                                        {activeHold.slotCount}{' '}
                                                        sessions
                                                    </span>
                                                    <span>
                                                        {activeHold.totalDurationMinutes}{' '}
                                                        total minutes
                                                    </span>
                                                    <span>
                                                        {activeHold.currency ||
                                                            'MYR'}{' '}
                                                        {Number(
                                                            activeHold.totalAmount ||
                                                            0
                                                        ).toFixed(2)}
                                                    </span>
                                                </div>

                                                {paymentError && (
                                                    <div className="booking-payment-error">
                                                        ⚠ {paymentError}
                                                    </div>
                                                )}

                                                <button
                                                    type="button"
                                                    disabled={
                                                        startingPayment ||
                                                        holdSecondsRemaining <= 0
                                                    }
                                                    className="continue-payment-button"
                                                    onClick={
                                                        startStripeCheckout
                                                    }
                                                >
                                                    {startingPayment
                                                        ? 'Opening Secure Checkout...'
                                                        : `Pay ${activeHold.currency || 'MYR'} ${Number(activeHold.totalAmount || 0).toFixed(2)} Securely`}
                                                </button>

                                                <small>
                                                    One Stripe payment covers every selected session. After successful payment, WellSmartBook will confirm all sessions and email the booking details to your registered Gmail address.
                                                </small>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </section>
                        )}
                    </>
                )}
            </section>
        </aside>
    );
}

// ======================================================
// DETAIL ROW
// ======================================================

function FacilityDetailRow({
    icon,
    label,
    value
}) {
    return (
        <div className="facility-detail-row">
            <div className="facility-detail-icon">
                {icon}
            </div>
            <div className="facility-detail-copy">
                <span>{label}</span>
                <strong>{value}</strong>
            </div>
        </div>
    );
}

// ======================================================
// GYM DIRECTORY CARD
// ======================================================

function GymCard({ gym, selected, onClick }) {
    return (
        <button
            type="button"
            className={
                selected
                    ? 'gym-facility-card selected'
                    : 'gym-facility-card'
            }
            onClick={onClick}
        >
            
            {/* ======================================
                GYM CARD PHOTO
            ====================================== */}

            <div className="gym-card-image">

                {getGymImageUrl(gym.imageUrl) ? (

                    <img
                        src={getGymImageUrl(gym.imageUrl)}
                        alt={gym.name}
                        loading="lazy"
                    />

                ) : (

                    <div className="gym-card-placeholder">
                        🏋️
                    </div>

                )}

            </div>


            <div className="gym-card-content">
                <div className="gym-card-title-row">
                    <h3>{gym.name}</h3>

                    {gym.distanceKm !== null &&
                    gym.distanceKm !== undefined && (
                        <span className="gym-card-distance">
                            {gym.distanceKm} km
                        </span>
                    )}
                </div>

                <p className="gym-card-address">
                    <span>⌖</span>
                    {gym.fullAddress}
                </p>

                <p className="gym-card-hours">
                    <span>◷</span>
                    {getTodayOpeningHours(
                        gym.openingHours
                    )}
                </p>

                <div className="gym-card-footer">
                    <div className="gym-preview-amenities">
                        {(gym.amenities || [])
                            .slice(0, 2)
                            .map((amenity, index) => (
                                <span
                                    key={`${amenity}-${index}`}
                                >
                                    {amenity}
                                </span>
                            ))}
                    </div>

                    <strong>
                        View Details →
                    </strong>
                </div>
            </div>
        </button>
    );
}

// ======================================================
// CSS
// ======================================================

const gymMapCss = `
.gym-map-page {
    width: 100%;
    padding-bottom: 50px;
}

.gym-page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    margin-bottom: 17px;
}

.page-eyebrow {
    display: block;
    color: #0759d9;
    font-size: 8px;
    font-weight: 800;
    letter-spacing: .8px;
}

.gym-page-header h1 {
    margin: 5px 0;
    color: #172033;
    font-size: 27px;
}

.gym-page-header p {
    margin: 0;
    color: #64748b;
    font-size: 10px;
}

.locate-me-button {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 10px 15px;
    border: 0;
    border-radius: 999px;
    background: #e5efff;
    color: #0759d9;
    cursor: pointer;
    font-size: 9px;
    font-weight: 800;
}

.locate-me-button:hover {
    background: #d8e9ff;
}

.locate-me-button:disabled {
    opacity: .55;
    cursor: wait;
}

.gym-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    margin-bottom: 13px;
}

.gym-search-box {
    width: min(540px,100%);
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 0 13px;
    border: 1px solid #dbe3ef;
    border-radius: 11px;
    background: white;
}

.search-icon {
    color: #64748b;
    font-size: 17px;
}

.gym-search-box input {
    width: 100%;
    padding: 11px 0;
    border: 0;
    outline: none;
    background: transparent;
    color: #172033;
    font-size: 10px;
}

.active-facility-count {
    text-align: right;
}

.active-facility-count strong {
    display: block;
    color: #0759d9;
    font-size: 18px;
}

.active-facility-count span {
    color: #64748b;
    font-size: 7px;
}

.gym-info-message,
.gym-error-message {
    margin-bottom: 12px;
    padding: 10px 12px;
    border-radius: 9px;
    font-size: 9px;
}

.gym-info-message {
    border: 1px solid #bfdbfe;
    background: #eff6ff;
    color: #1d4ed8;
}

.gym-error-message {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid #fed7aa;
    background: #fff7ed;
    color: #c2410c;
}

.gym-error-message button {
    border: 0;
    background: transparent;
    color: #c2410c;
    font-size: 8px;
    font-weight: 800;
    cursor: pointer;
}

.google-map-wrapper {
    position: relative;
    width: 100%;
    height: 560px;
    overflow: hidden;
    border: 1px solid #dbe3ef;
    border-radius: 20px;
    background: #e5e7eb;
}

.google-map-container {
    width: 100%;
    height: 100%;
}

.map-loading-overlay {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 10px;
    background: rgba(255,255,255,.78);
    color: #64748b;
    pointer-events: none;
}

.map-loading-overlay p {
    margin: 0;
    font-size: 9px;
}

.map-loading-spinner {
    width: 35px;
    height: 35px;
    border: 4px solid #dbeafe;
    border-top-color: #0759d9;
    border-radius: 50%;
    animation: gym-map-spin .8s linear infinite;
}

@keyframes gym-map-spin {
    to {
        transform: rotate(360deg);
    }
}

.wsb-google-gym-marker {
    cursor: pointer;
    transform-origin: center bottom;
    transition: transform .15s ease;
}

.wsb-google-gym-marker:hover,
.wsb-google-gym-marker.selected {
    transform: scale(1.15);
}

.wsb-google-gym-circle {
    width: 42px;
    height: 42px;
    border: 3px solid white;
    border-radius: 50%;
    background: #0759d9;
    color: white;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 6px 18px rgba(15,23,42,.30);
    font-size: 17px;
}

.wsb-google-gym-marker.selected
.wsb-google-gym-circle {
    background: #063b9a;
}

.wsb-google-gym-pointer {
    width: 0;
    height: 0;
    margin: -4px auto 0;
    border-left: 6px solid transparent;
    border-right: 6px solid transparent;
    border-top: 9px solid #0759d9;
}

.wsb-google-gym-marker.selected
.wsb-google-gym-pointer {
    border-top-color: #063b9a;
}

.wsb-current-location-marker {
    display: flex;
    justify-content: center;
    align-items: center;
}

.wsb-current-location-ring {
    width: 31px;
    height: 31px;
    border: 4px solid white;
    border-radius: 50%;
    background: rgba(37,99,235,.18);
    box-shadow:
        0 0 0 8px rgba(37,99,235,.12),
        0 4px 12px rgba(15,23,42,.22);
    display: flex;
    justify-content: center;
    align-items: center;
}

.wsb-current-location-dot {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: #2563eb;
}

.gym-detail-panel {
    position: absolute;
    top: 17px;
    right: 17px;
    z-index: 30;
    width: 430px;
    max-height: calc(100% - 34px);
    overflow-y: auto;
    padding: 17px;
    border: 1px solid rgba(226,232,240,.9);
    border-radius: 17px;
    background: rgba(255,255,255,.97);
    box-shadow: 0 18px 48px rgba(15,23,42,.20);
    backdrop-filter: blur(12px);
}

.gym-detail-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
}

.gym-detail-eyebrow {
    color: #0759d9;
    font-size: 7px;
    font-weight: 800;
    letter-spacing: .7px;
}

.gym-detail-header h2 {
    margin: 4px 0 0;
    color: #172033;
    font-size: 17px;
    line-height: 1.3;
}

.close-detail-button {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
    border: 0;
    border-radius: 50%;
    background: #f1f5f9;
    color: #475569;
    cursor: pointer;
    font-size: 18px;
}

.close-detail-button:hover {
    background: #e2e8f0;
}

.gym-detail-image,
.gym-detail-placeholder {
    width: 100%;
    height: 145px;
    margin-top: 13px;
    border-radius: 11px;
}

.gym-detail-image {
    object-fit: cover;
}

.gym-detail-placeholder {
    background:
        linear-gradient(
            135deg,
            #edf4ff,
            #dbeafe
        );
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 43px;
}

.gym-distance-pill {
    display: inline-block;
    margin-top: 10px;
    padding: 5px 8px;
    border-radius: 999px;
    background: #ecfdf3;
    color: #15803d;
    font-size: 8px;
    font-weight: 800;
}

.gym-description {
    margin: 11px 0;
    color: #64748b;
    font-size: 9px;
    line-height: 1.6;
}

.facility-detail-row {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 9px;
    padding: 10px 0;
    border-bottom: 1px solid #edf1f5;
}

.facility-detail-icon {
    width: 29px;
    height: 29px;
    border-radius: 8px;
    background: #edf4ff;
    color: #0759d9;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 11px;
}

.facility-detail-copy span {
    display: block;
    color: #94a3b8;
    font-size: 7px;
}

.facility-detail-copy strong {
    display: block;
    margin-top: 2px;
    color: #334155;
    font-size: 9px;
    line-height: 1.5;
    word-break: break-word;
}

.gym-amenity-section {
    margin-top: 13px;
}

.gym-amenity-section h3 {
    margin: 0;
    color: #334155;
    font-size: 9px;
}

.gym-amenity-list {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 8px;
}

.gym-amenity-list span {
    padding: 5px 7px;
    border-radius: 999px;
    background: #edf4ff;
    color: #0759d9;
    font-size: 7px;
}

.google-directions-button {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 6px;
    margin-top: 14px;
    padding: 10px;
    border-radius: 9px;
    background: #0759d9;
    color: white;
    text-align: center;
    text-decoration: none;
    font-size: 9px;
    font-weight: 800;
}

.google-directions-button:hover {
    background: #064cc0;
}

.coach-discovery-section {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #dbe3ef;
}

.coach-discovery-heading {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
}

.coach-discovery-heading > div > span,
.selected-coach-summary > span,

.slot-section-heading > div {
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.slot-section-heading small {
    font-size: 7px;
    color: #64748b;
    font-weight: 500;
}

.multi-slot-summary-list {
    display: grid;
    gap: 7px;
    margin: 12px 0;
}

.multi-slot-summary-row,
.multi-slot-total {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.multi-slot-summary-row {
    padding: 8px 10px;
    border: 1px solid #dbe4f0;
    border-radius: 8px;
    background: #ffffff;
    font-size: 8px;
}

.multi-slot-summary-row strong {
    color: #0759d9;
    font-size: 8px;
}

.multi-slot-total {
    margin: 10px 0;
    padding-top: 10px;
    border-top: 1px solid #cbd5e1;
    font-size: 9px;
}

.multi-slot-total strong {
    color: #0759d9;
    font-size: 12px;
}

.selected-slot-summary > span {
    color: #0759d9;
    font-size: 7px;
    font-weight: 800;
    letter-spacing: .7px;
}

.coach-discovery-heading h3 {
    margin: 4px 0;
    color: #172033;
    font-size: 14px;
}

.coach-discovery-heading p {
    margin: 0;
    color: #94a3b8;
    font-size: 7px;
    line-height: 1.5;
}

.coach-discovery-heading > strong {
    min-width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: #eaf2ff;
    color: #0759d9;
    font-size: 10px;
}

.coach-booking-loading,
.coach-booking-error {
    margin-top: 12px;
    padding: 12px;
    border-radius: 9px;
    font-size: 8px;
}

.coach-booking-loading {
    background: #f8fafc;
    color: #64748b;
    text-align: center;
}

.coach-booking-loading.compact {
    padding: 9px;
}

.coach-booking-error {
    border: 1px solid #fed7aa;
    background: #fff7ed;
    color: #c2410c;
}

.coach-empty-state,
.slot-empty-state {
    margin-top: 12px;
    padding: 18px 12px;
    border: 1px dashed #cbd5e1;
    border-radius: 10px;
    text-align: center;
}

.coach-empty-state > div {
    font-size: 24px;
}

.coach-empty-state strong,
.slot-empty-state strong {
    display: block;
    margin-top: 6px;
    color: #334155;
    font-size: 9px;
}

.coach-empty-state p,
.slot-empty-state p {
    margin: 4px 0 0;
    color: #94a3b8;
    font-size: 7px;
    line-height: 1.5;
}

.coach-card-list {
    display: grid;
    gap: 8px;
    margin-top: 12px;
}

.coach-option-card {
    width: 100%;
    display: grid;
    grid-template-columns:
        auto
        minmax(0,1fr)
        auto;

    align-items: center;
    gap: 9px;
    padding: 10px;

    border: 1px solid #e2e8f0;
    border-radius: 10px;

    background: white;

    text-align: left;
    cursor: pointer;

    transition:
        border-color .15s ease,
        background .15s ease;
}

.coach-option-card:hover {
    border-color: #93c5fd;
}

.coach-option-card.selected {
    border-color: #0759d9;
    background: #f3f7ff;
}

.coach-avatar {
    width: 40px;
    height: 40px;
    overflow: hidden;

    display: flex;
    align-items: center;
    justify-content: center;

    border-radius: 50%;

    background: #dbeafe;
    color: #0759d9;

    font-size: 14px;
    font-weight: 800;
}

.coach-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.coach-option-copy {
    min-width: 0;
}

.coach-option-copy strong {
    display: block;
    color: #172033;
    font-size: 9px;
}

.coach-option-copy span,
.coach-option-copy small {
    display: block;
    margin-top: 2px;
    color: #64748b;
    font-size: 7px;
}

.coach-price {
    text-align: right;
}

.coach-price strong {
    display: block;
    color: #0759d9;
    font-size: 9px;
}

.coach-price span {
    display: block;
    margin-top: 2px;
    color: #94a3b8;
    font-size: 6px;
}

.slot-picker-section {
    margin-top: 12px;
    padding: 12px;

    border: 1px solid #dbeafe;
    border-radius: 11px;

    background: #fbfdff;
}

.selected-coach-summary strong {
    display: block;
    margin-top: 4px;
    color: #172033;
    font-size: 10px;
}

.selected-coach-summary p {
    margin: 4px 0 0;
    color: #64748b;
    font-size: 7px;
    line-height: 1.5;
}

.booking-date-field {
    display: block;
    margin-top: 12px;
}

.booking-date-field > span {
    display: block;
    margin-bottom: 5px;

    color: #334155;

    font-size: 8px;
    font-weight: 800;
}

.booking-date-field input {
    width: 100%;

    padding: 9px 10px;

    border: 1px solid #cbd5e1;
    border-radius: 8px;

    background: white;
    color: #172033;

    font-size: 8px;
}

.slot-section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;

    gap: 10px;
    margin-top: 13px;
}

.slot-section-heading strong {
    font-size: 9px;
}

.slot-section-heading span {
    color: #64748b;
    font-size: 7px;
}

.slot-grid {
    display: grid;
    grid-template-columns:
        repeat(2,1fr);

    gap: 7px;
    margin-top: 8px;
}

.slot-button {
    padding: 9px 6px;

    border: 1px solid #dbe3ef;
    border-radius: 8px;

    background: white;
    color: #334155;

    cursor: pointer;
    text-align: center;
}

.slot-button:hover {
    border-color: #93c5fd;
}

.slot-button.selected {
    border-color: #0759d9;
    background: #eaf2ff;
    color: #0759d9;
}

.slot-button strong,
.slot-button span {
    display: block;
}

.slot-button strong {
    font-size: 8px;
}

.slot-button span {
    margin-top: 2px;
    font-size: 6px;
}

.selected-slot-summary {
    margin-top: 12px;
    padding: 11px;

    border-radius: 9px;

    background: #eef6ff;
}

.selected-slot-summary strong {
    display: block;

    margin-top: 4px;

    color: #172033;
    font-size: 9px;
}

.selected-slot-summary p {
    margin: 4px 0 0;

    color: #475569;
    font-size: 7px;
}

.continue-booking-button,
.continue-payment-button {
    width: 100%;

    margin-top: 10px;
    padding: 10px;

    border: 0;
    border-radius: 8px;

    color: white;

    font-size: 8px;
    font-weight: 800;
}

.continue-booking-button {
    background: #0759d9;
    cursor: pointer;
}

.continue-booking-button:hover:not(:disabled) {
    background: #064cc0;
}

.continue-booking-button:disabled {
    background: #94a3b8;
    cursor: wait;
}

.continue-payment-button {
    background: #16a36a;
    cursor: pointer;
}

.continue-payment-button:hover:not(:disabled) {
    background: #12875a;
}

.continue-payment-button:disabled {
    background: #94a3b8;
    cursor: wait;
}

.booking-payment-error {
    margin-top: 9px;
    padding: 9px 10px;

    border: 1px solid #fecaca;
    border-radius: 8px;

    background: #fef2f2;
    color: #b91c1c;

    font-size: 7px;
    line-height: 1.5;
}

.booking-hold-error {
    margin-top: 10px;
    padding: 9px 10px;

    border: 1px solid #fecaca;
    border-radius: 8px;

    background: #fef2f2;
    color: #b91c1c;

    font-size: 7px;
    line-height: 1.5;
}

.booking-hold-success {
    margin-top: 11px;
    padding: 11px;

    border: 1px solid #bbf7d0;
    border-radius: 9px;

    background: #f0fdf4;
}

.booking-hold-success-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.booking-hold-success-heading > div:first-child > span {
    display: block;
    color: #15803d;
    font-size: 6px;
    font-weight: 900;
    letter-spacing: .6px;
}

.booking-hold-success-heading > div:first-child > strong {
    display: block;
    margin-top: 3px;
    color: #166534;
    font-size: 8px;
}

.booking-hold-countdown {
    min-width: 67px;
    padding: 6px 8px;

    border-radius: 8px;
    background: white;

    text-align: center;
}

.selected-slot-summary .booking-hold-countdown small {
    margin: 0;
    color: #64748b;
    font-size: 5px;
    font-weight: 800;
}

.booking-hold-countdown strong {
    margin-top: 2px;
    color: #15803d;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
}

.booking-hold-details {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-top: 9px;
}

.booking-hold-details span {
    padding: 4px 6px;
    border-radius: 999px;
    background: white;
    color: #475569;
    font-size: 6px;
    font-weight: 700;
}

.coach-option-card:disabled,
.slot-button:disabled,
.booking-date-field input:disabled {
    opacity: .62;
    cursor: not-allowed;
}

.selected-slot-summary small {
    display: block;

    margin-top: 6px;

    color: #64748b;

    font-size: 6px;
    line-height: 1.5;
}

.facility-directory {
    margin-top: 25px;
}

.directory-heading h2 {
    margin: 5px 0;
    color: #172033;
    font-size: 19px;
}

.directory-heading p {
    margin: 0;
    color: #64748b;
    font-size: 9px;
}

.gym-card-grid {
    display: grid;
    grid-template-columns: repeat(3,1fr);
    gap: 13px;
    margin-top: 15px;
}

.gym-facility-card {
    padding: 0;
    overflow: hidden;
    border: 1px solid #e2e8f0;
    border-radius: 15px;
    background: white;
    text-align: left;
    cursor: pointer;
    transition:
        transform .18s ease,
        border-color .18s ease,
        box-shadow .18s ease;
}

.gym-facility-card:hover,
.gym-facility-card.selected {
    transform: translateY(-3px);
    border-color: #0759d9;
    box-shadow: 0 10px 27px rgba(15,23,42,.09);
}

.gym-card-image {
    width: 100%;
    height: 140px;
}

.gym-card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.gym-card-placeholder {
    width: 100%;
    height: 100%;
    background:
        linear-gradient(
            135deg,
            #edf4ff,
            #dbeafe
        );
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 38px;
}

.gym-card-content {
    padding: 14px;
}

.gym-card-title-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: flex-start;
}

.gym-card-title-row h3 {
    margin: 0;
    color: #172033;
    font-size: 13px;
    line-height: 1.35;
}

.gym-card-distance {
    flex-shrink: 0;
    padding: 4px 7px;
    border-radius: 999px;
    background: #ecfdf3;
    color: #15803d;
    font-size: 7px;
    font-weight: 800;
}

.gym-card-address {
    min-height: 31px;
    margin: 7px 0;
    color: #64748b;
    font-size: 8px;
    line-height: 1.55;
}

.gym-card-address span,
.gym-card-hours span {
    margin-right: 4px;
}

.gym-card-hours {
    margin: 0;
    color: #475569;
    font-size: 8px;
}

.gym-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 8px;
    margin-top: 11px;
}

.gym-preview-amenities {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
}

.gym-preview-amenities span {
    padding: 5px 7px;
    border-radius: 999px;
    background: #edf4ff;
    color: #0759d9;
    font-size: 7px;
}

.gym-card-footer > strong {
    flex-shrink: 0;
    color: #0759d9;
    font-size: 8px;
}

.empty-gym-state {
    margin-top: 15px;
    padding: 42px 25px;
    border: 1px dashed #cbd5e1;
    border-radius: 15px;
    background: white;
    text-align: center;
}

.empty-gym-icon {
    font-size: 37px;
}

.empty-gym-state h3 {
    margin: 10px 0 5px;
    color: #172033;
    font-size: 15px;
}

.empty-gym-state p {
    margin: 0;
    color: #64748b;
    font-size: 9px;
}

@media(max-width: 1100px) {
    .gym-card-grid {
        grid-template-columns: repeat(2,1fr);
    }
}

@media(max-width: 760px) {
    .gym-page-header,
    .gym-toolbar {
        flex-direction: column;
        align-items: stretch;
    }

    .active-facility-count {
        text-align: left;
    }

    .gym-card-grid {
        grid-template-columns: 1fr;
    }

    .google-map-wrapper {
        height: 580px;
    }

    .gym-detail-panel {
        left: 12px;
        right: 12px;
        top: auto;
        bottom: 12px;
        width: auto;
        max-height: 78%;
    }

    .slot-grid {
        grid-template-columns: 1fr;
    }
}
`;