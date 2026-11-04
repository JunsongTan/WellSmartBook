import {
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';


const API_BASE_URL =
    `http://${window.location.hostname}:5000`;


const DAYS = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
];


let googleMapsPromise =
    null;


// ======================================================
// GOOGLE MAPS LOADER
// ======================================================

function loadGoogleMaps() {

    if (
        window.google?.maps
    ) {

        return Promise.resolve(
            window.google
        );
    }


    if (
        googleMapsPromise
    ) {

        return googleMapsPromise;
    }


    googleMapsPromise =
        new Promise(
            (
                resolve,
                reject
            ) => {

                const apiKey =
                    import.meta.env
                        .VITE_GOOGLE_MAPS_API_KEY;


                if (!apiKey) {

                    reject(
                        new Error(
                            'Google Maps API key is missing.'
                        )
                    );


                    return;
                }


                const existing =
                    document.querySelector(
                        'script[data-wellsmartbook-maps]'
                    );


                if (existing) {

                    existing.addEventListener(
                        'load',
                        () =>
                            resolve(
                                window.google
                            )
                    );


                    existing.addEventListener(
                        'error',
                        () =>
                            reject(
                                new Error(
                                    'Unable to load Google Maps.'
                                )
                            )
                    );


                    return;
                }


                const script =
                    document.createElement(
                        'script'
                    );


                script.src =
                    `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
                        apiKey
                    )}&v=weekly&libraries=marker`;


                script.async =
                    true;

                script.defer =
                    true;


                script.dataset
                    .wellsmartbookMaps =
                    'true';


                script.onload =
                    () =>
                        resolve(
                            window.google
                        );


                script.onerror =
                    () =>
                        reject(
                            new Error(
                                'Unable to load Google Maps.'
                            )
                        );


                document.head.appendChild(
                    script
                );
            }
        );


    return googleMapsPromise;
}


// ======================================================
// LOCAL DATE
// ======================================================

function getLocalDateString() {

    const date =
        new Date();


    const year =
        date.getFullYear();


    const month =
        String(
            date.getMonth() + 1
        ).padStart(
            2,
            '0'
        );


    const day =
        String(
            date.getDate()
        ).padStart(
            2,
            '0'
        );


    return `${year}-${month}-${day}`;
}


// ======================================================
// FORMAT TIME
// ======================================================

function formatTime(
    value
) {

    if (!value) {

        return '';

    }


    const normalized =
        String(
            value
        ).slice(
            0,
            5
        );


    const [
        hourText,
        minute
    ] =
        normalized.split(':');


    const hour =
        Number(
            hourText
        );


    const suffix =
        hour >= 12
            ? 'PM'
            : 'AM';


    const displayHour =
        hour % 12 || 12;


    return `${displayHour}:${minute} ${suffix}`;
}


// ======================================================
// CAPITALIZE
// ======================================================

function capitalize(
    value
) {

    if (!value) {

        return '';

    }


    return (
        value.charAt(0)
            .toUpperCase() +
        value.slice(1)
    );
}


// ======================================================
// COMPONENT
// ======================================================

export default function CoachGymLocations() {

    const mapElementRef =
        useRef(null);


    const mapInstanceRef =
        useRef(null);


    const markersRef =
        useRef([]);


    // ==================================================
    // DATA
    // ==================================================

    const [
        gyms,
        setGyms
    ] = useState([]);


    const [
        selectedGymId,
        setSelectedGymId
    ] = useState(null);


    const [
        userLocation,
        setUserLocation
    ] = useState(null);


    const [
        availability,
        setAvailability
    ] = useState([]);


    const [
        loading,
        setLoading
    ] = useState(true);


    const [
        error,
        setError
    ] = useState('');


    // ==================================================
    // MODAL
    // ==================================================

    const [
        modalOpen,
        setModalOpen
    ] = useState(false);


    const [
        saving,
        setSaving
    ] = useState(false);


    const [
        formError,
        setFormError
    ] = useState('');


    const [
        formMessage,
        setFormMessage
    ] = useState('');


    const [
        availabilityType,
        setAvailabilityType
    ] = useState(
        'weekly'
    );


    const [
        selectedDays,
        setSelectedDays
    ] = useState([]);


    const [
        specificDate,
        setSpecificDate
    ] = useState(
        getLocalDateString()
    );


    const [
        startTime,
        setStartTime
    ] = useState(
        '09:00'
    );


    const [
        endTime,
        setEndTime
    ] = useState(
        '13:00'
    );


    const [
        duration,
        setDuration
    ] = useState(
        '60'
    );


    const token =
        localStorage.getItem(
            'token'
        );


    // ==================================================
    // SELECTED GYM
    // ==================================================

    const selectedGym =
        useMemo(
            () =>
                gyms.find(
                    (
                        gym
                    ) =>
                        Number(
                            gym.id
                        ) ===
                        Number(
                            selectedGymId
                        )
                ) ||
                null,

            [
                gyms,
                selectedGymId
            ]
        );


    // ==================================================
    // ALL AVAILABILITY FOR SELECTED GYM
    // ==================================================

    const selectedGymAvailability =
        useMemo(
            () =>
                availability.filter(
                    (
                        item
                    ) =>
                        Number(
                            item.gymId
                        ) ===
                        Number(
                            selectedGymId
                        )
                ),

            [
                availability,
                selectedGymId
            ]
        );


    // ==================================================
    // WEEKLY AVAILABILITY FOR SELECTED GYM
    // ==================================================

    const selectedGymWeeklyAvailability =
        useMemo(
            () =>
                selectedGymAvailability.filter(
                    (
                        item
                    ) =>
                        item.availabilityType ===
                        'weekly'
                ),

            [
                selectedGymAvailability
            ]
        );


    const hasWeeklyAvailability =
        selectedGymWeeklyAvailability
            .length > 0;


    // ==================================================
    // INITIAL LOAD
    // ==================================================

    useEffect(
        () => {

            requestLocation();

            loadAvailability();

        },
        []
    );


    useEffect(
        () => {

            loadGyms();

        },
        [
            userLocation
        ]
    );


    // ==================================================
    // LOCATION
    // ==================================================

    function requestLocation() {

        if (
            !navigator.geolocation
        ) {

            setUserLocation(
                null
            );


            return;
        }


        navigator.geolocation
            .getCurrentPosition(
                (
                    position
                ) => {

                    setUserLocation({
                        latitude:
                            position.coords
                                .latitude,

                        longitude:
                            position.coords
                                .longitude
                    });
                },

                () => {

                    setUserLocation(
                        null
                    );

                },

                {
                    enableHighAccuracy:
                        true,

                    timeout:
                        7000
                }
            );
    }


    // ==================================================
    // LOAD GYMS
    // ==================================================

    async function loadGyms() {

        try {

            setLoading(
                true
            );


            setError('');


            let url =
                `${API_BASE_URL}/api/gyms`;


            if (
                userLocation
            ) {

                url +=
                    `?latitude=${encodeURIComponent(
                        userLocation.latitude
                    )}&longitude=${encodeURIComponent(
                        userLocation.longitude
                    )}`;
            }


            const response =
                await fetch(
                    url,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );


            const data =
                await response.json();


            if (
                !response.ok
            ) {

                throw new Error(
                    data.message ||
                    'Unable to load gym locations.'
                );
            }


            const gymList =
                Array.isArray(
                    data.gyms
                )
                    ? data.gyms
                    : [];


            setGyms(
                gymList
            );


            if (
                gymList.length >
                    0 &&
                selectedGymId ===
                    null
            ) {

                setSelectedGymId(
                    gymList[0].id
                );
            }


        } catch (
            requestError
        ) {

            setError(
                requestError.message
            );


        } finally {

            setLoading(
                false
            );

        }
    }


    // ==================================================
    // LOAD AVAILABILITY
    // ==================================================

    async function loadAvailability() {

        try {

            const response =
                await fetch(
                    `${API_BASE_URL}/api/coach/availability`,
                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );


            const data =
                await response.json();


            if (
                !response.ok
            ) {

                throw new Error(
                    data.message ||
                    'Unable to load availability.'
                );
            }


            setAvailability(
                Array.isArray(
                    data.availability
                )
                    ? data.availability
                    : []
            );


        } catch (
            requestError
        ) {

            console.error(
                requestError
            );

        }
    }


    // ==================================================
    // GOOGLE MAP
    // ==================================================

    useEffect(
        () => {

            if (
                !mapElementRef.current ||
                gyms.length === 0
            ) {

                return;
            }


            let cancelled =
                false;


            async function renderMap() {

                try {

                    const google =
                        await loadGoogleMaps();


                    if (
                        cancelled
                    ) {

                        return;

                    }


                    const {
                        Map
                    } =
                        await google.maps
                            .importLibrary(
                                'maps'
                            );


                    const {
                        AdvancedMarkerElement
                    } =
                        await google.maps
                            .importLibrary(
                                'marker'
                            );


                    const mapId =
                        import.meta.env
                            .VITE_GOOGLE_MAPS_MAP_ID ||
                        'DEMO_MAP_ID';


                    if (
                        !mapInstanceRef.current
                    ) {

                        const firstGym =
                            gyms[0];


                        mapInstanceRef.current =
                            new Map(
                                mapElementRef.current,
                                {
                                    center: {
                                        lat:
                                            userLocation
                                                ?.latitude ??
                                            Number(
                                                firstGym.latitude
                                            ),

                                        lng:
                                            userLocation
                                                ?.longitude ??
                                            Number(
                                                firstGym.longitude
                                            )
                                    },

                                    zoom:
                                        13,

                                    mapId,

                                    mapTypeControl:
                                        false,

                                    streetViewControl:
                                        false,

                                    fullscreenControl:
                                        false
                                }
                            );
                    }


                    // ==================================
                    // REMOVE OLD MARKERS
                    // ==================================

                    markersRef.current
                        .forEach(
                            (
                                marker
                            ) => {

                                marker.map =
                                    null;

                            }
                        );


                    markersRef.current =
                        [];


                    const bounds =
                        new google.maps
                            .LatLngBounds();


                    // ==================================
                    // GYM MARKERS
                    // ==================================

                    gyms.forEach(
                        (
                            gym
                        ) => {

                            const position = {
                                lat:
                                    Number(
                                        gym.latitude
                                    ),

                                lng:
                                    Number(
                                        gym.longitude
                                    )
                            };


                            const markerContent =
                                document
                                    .createElement(
                                        'div'
                                    );


                            markerContent
                                .className =
                                'coach-map-marker';


                            markerContent
                                .innerHTML =
                                '<span>🏋</span>';


                            const marker =
                                new AdvancedMarkerElement({
                                    map:
                                        mapInstanceRef
                                            .current,

                                    position,

                                    title:
                                        gym.name,

                                    content:
                                        markerContent
                                });


                            marker.addListener(
                                'click',
                                () => {

                                    selectGym(
                                        gym
                                    );
                                }
                            );


                            markersRef.current
                                .push(
                                    marker
                                );


                            bounds.extend(
                                position
                            );
                        }
                    );


                    // ==================================
                    // CURRENT LOCATION
                    // ==================================

                    if (
                        userLocation
                    ) {

                        const currentContent =
                            document
                                .createElement(
                                    'div'
                                );


                        currentContent
                            .className =
                            'coach-current-marker';


                        currentContent
                            .innerHTML =
                            '<span></span>';


                        const currentMarker =
                            new AdvancedMarkerElement({
                                map:
                                    mapInstanceRef
                                        .current,

                                position: {
                                    lat:
                                        userLocation
                                            .latitude,

                                    lng:
                                        userLocation
                                            .longitude
                                },

                                title:
                                    'Your location',

                                content:
                                    currentContent
                            });


                        markersRef.current
                            .push(
                                currentMarker
                            );


                        bounds.extend({
                            lat:
                                userLocation
                                    .latitude,

                            lng:
                                userLocation
                                    .longitude
                        });
                    }


                    if (
                        gyms.length >
                        1
                    ) {

                        mapInstanceRef
                            .current
                            .fitBounds(
                                bounds,
                                60
                            );
                    }


                } catch (
                    mapError
                ) {

                    setError(
                        mapError.message
                    );

                }
            }


            renderMap();


            return () => {

                cancelled =
                    true;

            };

        },
        [
            gyms,
            userLocation
        ]
    );


    // ==================================================
    // SELECT GYM
    // ==================================================

    function selectGym(
        gym
    ) {

        setSelectedGymId(
            gym.id
        );


        if (
            mapInstanceRef.current
        ) {

            mapInstanceRef.current
                .panTo({
                    lat:
                        Number(
                            gym.latitude
                        ),

                    lng:
                        Number(
                            gym.longitude
                        )
                });


            mapInstanceRef.current
                .setZoom(
                    15
                );
        }
    }


    // ==================================================
    // OPEN MANAGE WORKING HOURS
    // ==================================================

    function openWorkingHoursModal() {

        setFormError('');
        setFormMessage('');


        setAvailabilityType(
            'weekly'
        );


        setSpecificDate(
            getLocalDateString()
        );


        // ==============================================
        // EXISTING WEEKLY AVAILABILITY
        // ==============================================

        if (
            selectedGymWeeklyAvailability
                .length > 0
        ) {

            const currentDays =
                selectedGymWeeklyAvailability
                    .map(
                        (
                            item
                        ) =>
                            item.dayOfWeek
                    )
                    .filter(
                        Boolean
                    );


            setSelectedDays(
                [
                    ...new Set(
                        currentDays
                    )
                ]
            );


            const firstRule =
                selectedGymWeeklyAvailability[0];


            setStartTime(
                String(
                    firstRule.startTime ||
                    '09:00'
                ).slice(
                    0,
                    5
                )
            );


            setEndTime(
                String(
                    firstRule.endTime ||
                    '13:00'
                ).slice(
                    0,
                    5
                )
            );


            setDuration(
                String(
                    firstRule
                        .slotDurationMinutes ||
                    60
                )
            );

        } else {

            // ==========================================
            // NEW AVAILABILITY
            // ==========================================

            setSelectedDays(
                []
            );


            setStartTime(
                '09:00'
            );


            setEndTime(
                '13:00'
            );


            setDuration(
                '60'
            );
        }


        setModalOpen(
            true
        );
    }


    // ==================================================
    // WEEKDAY TOGGLE
    // ==================================================

    function toggleDay(
        day
    ) {

        setFormError('');
        setFormMessage('');


        setSelectedDays(
            (
                current
            ) => {

                if (
                    current.includes(
                        day
                    )
                ) {

                    return current.filter(
                        (
                            item
                        ) =>
                            item !==
                            day
                    );
                }


                return [
                    ...current,
                    day
                ];
            }
        );
    }


    // ==================================================
    // SAVE WEEKLY SCHEDULE
    // ==================================================

    async function saveWeeklyAvailability() {

        // Empty weekday array is allowed.
        //
        // It means:
        // remove ALL recurring weekly availability
        // for this coach at this selected gym.

        if (
            selectedDays.length ===
                0 &&
            hasWeeklyAvailability
        ) {

            const confirmed =
                window.confirm(
                    'You have unselected every weekday. This will remove all recurring weekly availability at this gym. Continue?'
                );


            if (!confirmed) {

                return;

            }
        }


        const response =
            await fetch(
                `${API_BASE_URL}/api/coach/availability/weekly`,
                {
                    method:
                        'PUT',

                    headers: {
                        'Content-Type':
                            'application/json',

                        Authorization:
                            `Bearer ${token}`
                    },

                    body:
                        JSON.stringify({
                            gymId:
                                selectedGym.id,

                            days:
                                selectedDays,

                            startTime,

                            endTime,

                            slotDurationMinutes:
                                Number(
                                    duration
                                )
                        })
                }
            );


        const data =
            await response.json();


        if (
            !response.ok
        ) {

            throw new Error(
                data.message ||
                'Unable to update weekly availability.'
            );
        }


        return data;
    }


    // ==================================================
    // SAVE SPECIFIC DATE
    // ==================================================

    async function saveSpecificDateAvailability() {

        const response =
            await fetch(
                `${API_BASE_URL}/api/coach/availability`,
                {
                    method:
                        'POST',

                    headers: {
                        'Content-Type':
                            'application/json',

                        Authorization:
                            `Bearer ${token}`
                    },

                    body:
                        JSON.stringify({
                            gymId:
                                selectedGym.id,

                            availabilityType:
                                'specific_date',

                            dayOfWeek:
                                null,

                            specificDate,

                            startTime,

                            endTime,

                            slotDurationMinutes:
                                Number(
                                    duration
                                )
                        })
                }
            );


        const data =
            await response.json();


        if (
            !response.ok
        ) {

            throw new Error(
                data.message ||
                'Unable to save specific-date availability.'
            );
        }


        return data;
    }


    // ==================================================
    // SAVE FORM
    // ==================================================

    async function saveAvailability(
        event
    ) {

        event.preventDefault();


        setFormError('');
        setFormMessage('');


        if (
            !selectedGym
        ) {

            setFormError(
                'Please select a gym.'
            );


            return;
        }


        if (
            !startTime ||
            !endTime
        ) {

            setFormError(
                'Start time and end time are required.'
            );


            return;
        }


        if (
            startTime >=
            endTime
        ) {

            setFormError(
                'End time must be later than start time.'
            );


            return;
        }


        if (
            availabilityType ===
                'specific_date' &&
            !specificDate
        ) {

            setFormError(
                'Please choose a date.'
            );


            return;
        }


        try {

            setSaving(
                true
            );


            // ==========================================
            // WEEKLY SYNC
            // ==========================================

            if (
                availabilityType ===
                'weekly'
            ) {

                await saveWeeklyAvailability();

            } else {

                // ======================================
                // SPECIFIC DATE
                // ======================================

                await saveSpecificDateAvailability();

            }


            await loadAvailability();


            setFormMessage(
                availabilityType ===
                'weekly'
                    ? 'Weekly working hours updated successfully.'
                    : 'Specific-date availability published successfully.'
            );


            setTimeout(
                () => {

                    setModalOpen(
                        false
                    );


                    setFormMessage('');

                },
                800
            );


        } catch (
            requestError
        ) {

            setFormError(
                requestError.message
            );


        } finally {

            setSaving(
                false
            );

        }
    }


    // ==================================================
    // REMOVE ONE AVAILABILITY
    // ==================================================

    async function removeAvailability(
        id
    ) {

        const confirmed =
            window.confirm(
                'Remove this availability?'
            );


        if (!confirmed) {

            return;

        }


        try {

            const response =
                await fetch(
                    `${API_BASE_URL}/api/coach/availability/${id}`,
                    {
                        method:
                            'DELETE',

                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        }
                    }
                );


            const data =
                await response.json();


            if (
                !response.ok
            ) {

                throw new Error(
                    data.message ||
                    'Unable to remove availability.'
                );
            }


            await loadAvailability();


        } catch (
            requestError
        ) {

            window.alert(
                requestError.message
            );

        }
    }


    // ==================================================
    // RENDER
    // ==================================================

    return (
        <div className="coach-gym-page">

            <style>
                {coachGymCss}
            </style>


            {/* =========================================
                HEADING
            ========================================= */}

            <div className="gym-page-heading">

                <div>

                    <span>
                        FACILITY MANAGEMENT
                    </span>


                    <h1>
                        Gym Locations
                    </h1>


                    <p>
                        Select an active WellSmartBook gym and manage the hours you are available to coach there.
                    </p>

                </div>


                <div className="facility-count">

                    <strong>
                        {
                            gyms.length
                        }
                    </strong>


                    <span>
                        Active Facilities
                    </span>

                </div>

            </div>


            {error && (

                <div className="gym-error">

                    ⚠ {error}

                </div>

            )}


            {/* =========================================
                MAP + GYM LIST
            ========================================= */}

            <div className="gym-workspace">

                <div className="gym-map-card">

                    <div
                        ref={
                            mapElementRef
                        }
                        className="coach-google-map"
                    />


                    {loading && (

                        <div className="map-loading">

                            Loading gym locations...

                        </div>

                    )}

                </div>


                <aside className="gym-list-panel">

                    <div className="gym-list-header">

                        <strong>
                            Registered Facilities
                        </strong>


                        <span>
                            {
                                gyms.length
                            } locations
                        </span>

                    </div>


                    <div className="gym-list">

                        {gyms.map(
                            (
                                gym
                            ) => (

                                <button
                                    key={
                                        gym.id
                                    }
                                    type="button"
                                    className={
                                        Number(
                                            selectedGymId
                                        ) ===
                                        Number(
                                            gym.id
                                        )
                                            ? 'gym-list-item active'
                                            : 'gym-list-item'
                                    }
                                    onClick={() =>
                                        selectGym(
                                            gym
                                        )
                                    }
                                >

                                    <div className="gym-list-icon">

                                        🏋

                                    </div>


                                    <div>

                                        <strong>
                                            {
                                                gym.name
                                            }
                                        </strong>


                                        <span>
                                            {
                                                gym.fullAddress
                                            }
                                        </span>


                                        {
                                            gym.distanceKm !==
                                                null &&
                                            gym.distanceKm !==
                                                undefined
                                                ? (
                                                    <small>
                                                        {
                                                            gym.distanceKm
                                                        } km away
                                                    </small>
                                                )
                                                : null
                                        }

                                    </div>

                                </button>

                            )
                        )}


                        {!loading &&
                        gyms.length ===
                            0 && (

                            <div className="empty-gym-list">

                                No active gyms have been added by an administrator yet.

                            </div>

                        )}

                    </div>

                </aside>

            </div>


            {/* =========================================
                SELECTED FACILITY
            ========================================= */}

            {selectedGym && (

                <section className="selected-gym-section">

                    <div className="selected-gym-main">

                        <div className="selected-gym-icon">

                            🏋

                        </div>


                        <div>

                            <span>
                                SELECTED FACILITY
                            </span>


                            <h2>
                                {
                                    selectedGym.name
                                }
                            </h2>


                            <p>
                                {
                                    selectedGym.fullAddress
                                }
                            </p>

                        </div>

                    </div>


                    <button
                        type="button"
                        className={
                            hasWeeklyAvailability
                                ? 'add-hours-button editing'
                                : 'add-hours-button'
                        }
                        onClick={
                            openWorkingHoursModal
                        }
                    >

                        {
                            hasWeeklyAvailability
                                ? '✎ Edit Working Hours'
                                : '+ Add Working Hours'
                        }

                    </button>

                </section>

            )}


            {/* =========================================
                PUBLISHED AVAILABILITY
            ========================================= */}

            {selectedGym && (

                <section className="availability-section">

                    <div className="availability-heading">

                        <div>

                            <span>
                                PUBLISHED SCHEDULE
                            </span>


                            <h2>
                                Your Availability
                            </h2>

                        </div>


                        <strong>
                            {
                                selectedGymAvailability
                                    .length
                            } rules
                        </strong>

                    </div>


                    {selectedGymAvailability
                        .length === 0 ? (

                        <div className="availability-empty">

                            <div>
                                □
                            </div>


                            <strong>
                                No working hours yet
                            </strong>


                            <p>
                                Add availability so users can later find bookable coaching sessions at this facility.
                            </p>

                        </div>

                    ) : (

                        <div className="availability-grid">

                            {selectedGymAvailability
                                .map(
                                    (
                                        item
                                    ) => (

                                        <article
                                            key={
                                                item.id
                                            }
                                            className="availability-card"
                                        >

                                            <div>

                                                <span>
                                                    {
                                                        item.availabilityType ===
                                                        'weekly'

                                                            ? 'WEEKLY'

                                                            : 'ONE-OFF'
                                                    }
                                                </span>


                                                <h3>

                                                    {
                                                        item.availabilityType ===
                                                        'weekly'

                                                            ? capitalize(
                                                                item.dayOfWeek
                                                            )

                                                            : item.specificDate
                                                    }

                                                </h3>


                                                <p>

                                                    {
                                                        formatTime(
                                                            item.startTime
                                                        )
                                                    }

                                                    {' – '}

                                                    {
                                                        formatTime(
                                                            item.endTime
                                                        )
                                                    }

                                                </p>


                                                <small>

                                                    {
                                                        item.slotDurationMinutes
                                                    } min sessions

                                                </small>

                                            </div>


                                            <button
                                                type="button"
                                                onClick={() =>
                                                    removeAvailability(
                                                        item.id
                                                    )
                                                }
                                            >

                                                Remove

                                            </button>

                                        </article>

                                    )
                                )}

                        </div>

                    )}

                </section>

            )}


            {/* =========================================
                MODAL
            ========================================= */}

            {modalOpen && (

                <div
                    className="availability-modal-backdrop"
                    onMouseDown={
                        (
                            event
                        ) => {

                            if (
                                event.target ===
                                event.currentTarget
                            ) {

                                setModalOpen(
                                    false
                                );
                            }
                        }
                    }
                >

                    <form
                        className="availability-modal"
                        onSubmit={
                            saveAvailability
                        }
                    >

                        {/* =============================
                            MODAL HEADER
                        ============================= */}

                        <div className="availability-modal-header">

                            <div>

                                <span>
                                    {
                                        hasWeeklyAvailability
                                            ? 'MANAGE AVAILABILITY'
                                            : 'PUBLISH AVAILABILITY'
                                    }
                                </span>


                                <h2>

                                    {
                                        hasWeeklyAvailability
                                            ? 'Edit Working Hours'
                                            : 'Add Working Hours'
                                    }

                                </h2>


                                <p>
                                    {
                                        selectedGym
                                            ?.name
                                    }
                                </p>

                            </div>


                            <button
                                type="button"
                                onClick={() =>
                                    setModalOpen(
                                        false
                                    )
                                }
                            >
                                ×
                            </button>

                        </div>


                        {/* =============================
                            ALERTS
                        ============================= */}

                        {formError && (

                            <div className="availability-alert error">

                                ⚠ {formError}

                            </div>

                        )}


                        {formMessage && (

                            <div className="availability-alert success">

                                ✓ {formMessage}

                            </div>

                        )}


                        {/* =============================
                            TYPE TABS
                        ============================= */}

                        <div className="availability-type-tabs">

                            <button
                                type="button"
                                className={
                                    availabilityType ===
                                    'weekly'
                                        ? 'active'
                                        : ''
                                }
                                onClick={() =>
                                    setAvailabilityType(
                                        'weekly'
                                    )
                                }
                            >

                                Recurring Weekly

                            </button>


                            <button
                                type="button"
                                className={
                                    availabilityType ===
                                    'specific_date'
                                        ? 'active'
                                        : ''
                                }
                                onClick={() =>
                                    setAvailabilityType(
                                        'specific_date'
                                    )
                                }
                            >

                                Specific Date

                            </button>

                        </div>


                        {/* =============================
                            WEEKLY DAYS
                        ============================= */}

                        {availabilityType ===
                        'weekly' ? (

                            <>

                                <div className="availability-field">

                                    <label>
                                        Select Weekdays
                                    </label>


                                    <div className="weekday-grid">

                                        {DAYS.map(
                                            (
                                                day
                                            ) => (

                                                <button
                                                    key={
                                                        day
                                                    }
                                                    type="button"
                                                    className={
                                                        selectedDays.includes(
                                                            day
                                                        )
                                                            ? 'selected'
                                                            : ''
                                                    }
                                                    onClick={() =>
                                                        toggleDay(
                                                            day
                                                        )
                                                    }
                                                >

                                                    {
                                                        capitalize(
                                                            day
                                                        ).slice(
                                                            0,
                                                            3
                                                        )
                                                    }

                                                </button>

                                            )
                                        )}

                                    </div>

                                </div>


                                <div className="weekly-help">

                                    <span>
                                        ℹ
                                    </span>


                                    <p>
                                        Selected days will be active. Unselect a day and save to remove that recurring availability. You can also unselect every day to remove all weekly availability at this gym.
                                    </p>

                                </div>

                            </>

                        ) : (

                            <div className="availability-field">

                                <label>
                                    Date
                                </label>


                                <input
                                    type="date"
                                    min={
                                        getLocalDateString()
                                    }
                                    value={
                                        specificDate
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            setSpecificDate(
                                                event.target.value
                                            )
                                    }
                                />

                            </div>

                        )}


                        {/* =============================
                            TIMES
                        ============================= */}

                        <div className="time-fields">

                            <div className="availability-field">

                                <label>
                                    Start Time
                                </label>


                                <input
                                    type="time"
                                    value={
                                        startTime
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            setStartTime(
                                                event.target.value
                                            )
                                    }
                                />

                            </div>


                            <div className="availability-field">

                                <label>
                                    End Time
                                </label>


                                <input
                                    type="time"
                                    value={
                                        endTime
                                    }
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            setEndTime(
                                                event.target.value
                                            )
                                    }
                                />

                            </div>

                        </div>


                        {/* =============================
                            SESSION DURATION
                        ============================= */}

                        <div className="availability-field">

                            <label>
                                Session Duration
                            </label>


                            <select
                                value={
                                    duration
                                }
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setDuration(
                                            event.target.value
                                        )
                                }
                            >

                                <option value="30">
                                    30 minutes
                                </option>

                                <option value="45">
                                    45 minutes
                                </option>

                                <option value="60">
                                    60 minutes
                                </option>

                                <option value="90">
                                    90 minutes
                                </option>

                                <option value="120">
                                    120 minutes
                                </option>

                            </select>

                        </div>


                        {/* =============================
                            SUMMARY
                        ============================= */}

                        <div className="availability-preview">

                            <span>
                                SUMMARY
                            </span>


                            <strong>

                                {
                                    availabilityType ===
                                    'weekly'

                                        ? selectedDays.length >
                                            0

                                            ? selectedDays
                                                .map(
                                                    capitalize
                                                )
                                                .join(
                                                    ', '
                                                )

                                            : 'No recurring weekdays selected'

                                        : specificDate
                                }

                            </strong>


                            <p>

                                {
                                    formatTime(
                                        startTime
                                    )
                                }

                                {' – '}

                                {
                                    formatTime(
                                        endTime
                                    )
                                }

                                {' • '}

                                {
                                    duration
                                } min sessions

                            </p>


                            {
                                availabilityType ===
                                    'weekly' &&
                                selectedDays.length ===
                                    0 &&
                                hasWeeklyAvailability && (

                                    <small className="remove-all-warning">

                                        Saving will remove all recurring weekly availability at this gym.

                                    </small>

                                )
                            }

                        </div>


                        {/* =============================
                            ACTIONS
                        ============================= */}

                        <div className="availability-modal-actions">

                            <button
                                type="button"
                                className="cancel-button"
                                onClick={() =>
                                    setModalOpen(
                                        false
                                    )
                                }
                            >

                                Cancel

                            </button>


                            <button
                                type="submit"
                                className="publish-button"
                                disabled={
                                    saving
                                }
                            >

                                {
                                    saving
                                        ? 'Saving...'

                                        : availabilityType ===
                                            'weekly' &&
                                            hasWeeklyAvailability

                                            ? 'Save Changes'

                                            : 'Save & Publish'
                                }

                            </button>

                        </div>

                    </form>

                </div>

            )}

        </div>
    );
}


// ======================================================
// CSS
// ======================================================

const coachGymCss = `

.gym-page-heading {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 20px;
}

.gym-page-heading > div:first-child > span,
.selected-gym-main span,
.availability-heading span,
.availability-modal-header span,
.availability-preview > span {
    color: #0759d9;
    font-size: 7px;
    font-weight: 800;
    letter-spacing: .8px;
}

.gym-page-heading h1 {
    margin: 6px 0;
    font-size: 28px;
}

.gym-page-heading p {
    margin: 0;
    color: #64748b;
    font-size: 9px;
}

.facility-count {
    min-width: 120px;
    padding: 12px 16px;
    border: 1px solid #dbe3ef;
    border-radius: 12px;
    background: white;
    text-align: center;
}

.facility-count strong {
    display: block;
    color: #0759d9;
    font-size: 19px;
}

.facility-count span {
    color: #94a3b8;
    font-size: 7px;
}

.gym-error {
    margin-bottom: 15px;
    padding: 11px;
    border: 1px solid #fed7aa;
    border-radius: 9px;
    background: #fff7ed;
    color: #c2410c;
    font-size: 9px;
}

/* =====================================================
   MAP
===================================================== */

.gym-workspace {
    display: grid;
    grid-template-columns:
        minmax(0, 1.7fr)
        minmax(260px, .8fr);

    height: 470px;
    border: 1px solid #dbe3ef;
    border-radius: 16px;
    overflow: hidden;
    background: white;
}

.gym-map-card {
    position: relative;
}

.coach-google-map {
    width: 100%;
    height: 100%;
    min-height: 470px;
}

.map-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
        rgba(255,255,255,.8);
    color: #64748b;
    font-size: 9px;
}

.coach-map-marker {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 3px solid white;
    border-radius:
        50% 50% 50% 8px;
    transform:
        rotate(-45deg);
    background: #0759d9;
    box-shadow:
        0 4px 12px
        rgba(0,0,0,.22);
}

.coach-map-marker span {
    display: block;
    transform:
        rotate(45deg);
    font-size: 15px;
}

.coach-current-marker {
    width: 22px;
    height: 22px;
    display: flex;
    justify-content: center;
    align-items: center;
    border: 3px solid white;
    border-radius: 50%;
    background: #2563eb;
    box-shadow:
        0 0 0 6px
        rgba(37,99,235,.18);
}

/* =====================================================
   GYM LIST
===================================================== */

.gym-list-panel {
    border-left:
        1px solid #e2e8f0;
    overflow: hidden;
}

.gym-list-header {
    height: 65px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 17px;
    border-bottom:
        1px solid #e2e8f0;
}

.gym-list-header strong {
    font-size: 10px;
}

.gym-list-header span {
    color: #94a3b8;
    font-size: 7px;
}

.gym-list {
    height:
        calc(100% - 65px);
    overflow-y: auto;
}

.gym-list-item {
    width: 100%;
    display: grid;
    grid-template-columns:
        auto 1fr;
    gap: 10px;
    padding: 14px 16px;
    border: 0;
    border-bottom:
        1px solid #f1f5f9;
    background: white;
    text-align: left;
    cursor: pointer;
}

.gym-list-item:hover {
    background: #f8fafc;
}

.gym-list-item.active {
    background: #eef5ff;
    box-shadow:
        inset 3px 0
        #0759d9;
}

.gym-list-icon {
    width: 34px;
    height: 34px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-radius: 9px;
    background: #eaf2ff;
}

.gym-list-item strong {
    display: block;
    font-size: 9px;
}

.gym-list-item span {
    display: block;
    margin-top: 3px;
    color: #64748b;
    font-size: 7px;
    line-height: 1.45;
}

.gym-list-item small {
    display: block;
    margin-top: 5px;
    color: #0759d9;
    font-size: 7px;
}

.empty-gym-list {
    padding: 25px 15px;
    color: #94a3b8;
    text-align: center;
    font-size: 8px;
}

/* =====================================================
   SELECTED GYM
===================================================== */

.selected-gym-section {
    margin-top: 17px;
    display: flex;
    align-items: center;
    justify-content:
        space-between;
    gap: 15px;
    padding: 18px 20px;
    border:
        1px solid #dbe3ef;
    border-radius: 15px;
    background: white;
}

.selected-gym-main {
    display: flex;
    align-items: center;
    gap: 13px;
}

.selected-gym-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    background: #eaf2ff;
    font-size: 19px;
}

.selected-gym-main h2 {
    margin: 4px 0;
    font-size: 16px;
}

.selected-gym-main p {
    margin: 0;
    color: #64748b;
    font-size: 8px;
}

.add-hours-button {
    padding: 11px 15px;
    border: 0;
    border-radius: 9px;
    background: #0759d9;
    color: white;
    cursor: pointer;
    font-size: 9px;
    font-weight: 800;
}

.add-hours-button.editing {
    background: #eff6ff;
    color: #0759d9;
    border:
        1px solid #bfdbfe;
}

/* =====================================================
   AVAILABILITY
===================================================== */

.availability-section {
    margin-top: 17px;
    padding: 21px;
    border:
        1px solid #dbe3ef;
    border-radius: 15px;
    background: white;
}

.availability-heading {
    display: flex;
    justify-content:
        space-between;
    align-items: center;
}

.availability-heading h2 {
    margin: 5px 0 0;
    font-size: 17px;
}

.availability-heading > strong {
    color: #64748b;
    font-size: 8px;
}

.availability-empty {
    margin-top: 17px;
    padding: 35px;
    border:
        1px dashed #cbd5e1;
    border-radius: 12px;
    text-align: center;
}

.availability-empty > div {
    color: #94a3b8;
    font-size: 25px;
}

.availability-empty strong {
    display: block;
    margin-top: 8px;
    font-size: 10px;
}

.availability-empty p {
    margin:
        5px auto 0;
    max-width: 430px;
    color: #94a3b8;
    font-size: 8px;
}

.availability-grid {
    margin-top: 16px;
    display: grid;
    gap: 9px;
}

.availability-card {
    display: flex;
    align-items: center;
    justify-content:
        space-between;
    padding: 14px;
    border:
        1px solid #e2e8f0;
    border-radius: 11px;
}

.availability-card span {
    color: #0759d9;
    font-size: 6px;
    font-weight: 800;
}

.availability-card h3 {
    margin: 4px 0;
    font-size: 11px;
}

.availability-card p {
    margin: 0;
    color: #475569;
    font-size: 9px;
}

.availability-card small {
    color: #94a3b8;
    font-size: 7px;
}

.availability-card button {
    padding: 7px 9px;
    border:
        1px solid #fecaca;
    border-radius: 7px;
    background: white;
    color: #dc2626;
    cursor: pointer;
    font-size: 7px;
}

/* =====================================================
   MODAL
===================================================== */

.availability-modal-backdrop {
    position: fixed;
    z-index: 9999;
    inset: 0;
    padding: 25px;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
        rgba(15,23,42,.48);
}

.availability-modal {
    width:
        min(560px,100%);
    max-height: 92vh;
    overflow-y: auto;
    padding: 24px;
    border-radius: 17px;
    background: white;
    box-shadow:
        0 24px 60px
        rgba(15,23,42,.22);
}

.availability-modal-header {
    display: flex;
    justify-content:
        space-between;
    gap: 15px;
}

.availability-modal-header h2 {
    margin: 5px 0;
    font-size: 20px;
}

.availability-modal-header p {
    margin: 0;
    color: #64748b;
    font-size: 8px;
}

.availability-modal-header > button {
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 8px;
    background: #f1f5f9;
    color: #64748b;
    cursor: pointer;
    font-size: 17px;
}

.availability-alert {
    margin-top: 15px;
    padding: 10px;
    border-radius: 8px;
    font-size: 8px;
}

.availability-alert.error {
    background: #fff7ed;
    color: #c2410c;
}

.availability-alert.success {
    background: #ecfdf3;
    color: #15803d;
}

/* =====================================================
   TYPE TABS
===================================================== */

.availability-type-tabs {
    margin-top: 19px;
    display: grid;
    grid-template-columns:
        1fr 1fr;
    padding: 4px;
    border-radius: 10px;
    background: #f1f5f9;
}

.availability-type-tabs button {
    padding: 9px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: #64748b;
    cursor: pointer;
    font-size: 8px;
    font-weight: 700;
}

.availability-type-tabs button.active {
    background: white;
    color: #0759d9;
    box-shadow:
        0 2px 7px
        rgba(15,23,42,.08);
}

/* =====================================================
   FORM
===================================================== */

.availability-field {
    margin-top: 16px;
}

.availability-field label {
    display: block;
    margin-bottom: 6px;
    color: #334155;
    font-size: 8px;
    font-weight: 800;
}


.availability-field input,
.availability-field select {
    width: 100%;
    padding: 10px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    outline: 0;
    background: #ffffff !important;
    color: #172033 !important;
    font-size: 12px;
    font-weight: 600;
    color-scheme: light;
}

.availability-field select option {
    background: #ffffff;
    color: #172033;
}

.availability-field input[type="time"] {
    background: #ffffff !important;
    color: #172033 !important;
    color-scheme: light;
}


.availability-field input:focus,
.availability-field select:focus {
    border-color: #0759d9;
    box-shadow: 0 0 0 2px rgba(7, 89, 217, 0.12);
}

.time-fields {
    display: grid;
    grid-template-columns:
        1fr 1fr;
    gap: 10px;
}

.weekday-grid {
    display: grid;
    grid-template-columns:
        repeat(7,1fr);
    gap: 5px;
}

.weekday-grid button {
    padding: 9px 3px;
    border:
        1px solid #dbe3ef;
    border-radius: 8px;
    background: white;
    color: #64748b;
    cursor: pointer;
    font-size: 7px;
    font-weight: 800;
}

.weekday-grid button.selected {
    border-color:
        #0759d9;
    background:
        #eaf2ff;
    color:
        #0759d9;
}

.weekly-help {
    margin-top: 11px;
    display: grid;
    grid-template-columns:
        auto 1fr;
    gap: 8px;
    padding: 10px;
    border-radius: 9px;
    background: #f8fafc;
    color: #64748b;
}

.weekly-help p {
    margin: 0;
    font-size: 7px;
    line-height: 1.6;
}

/* =====================================================
   SUMMARY
===================================================== */

.availability-preview {
    margin-top: 18px;
    padding: 13px;
    border:
        1px solid #dbeafe;
    border-radius: 10px;
    background: #eff6ff;
}

.availability-preview strong {
    display: block;
    margin-top: 5px;
    color: #172033;
    font-size: 9px;
}

.availability-preview p {
    margin: 4px 0 0;
    color: #64748b;
    font-size: 8px;
}

.remove-all-warning {
    display: block;
    margin-top: 8px;
    color: #dc2626;
    font-size: 7px;
    font-weight: 700;
}

/* =====================================================
   ACTIONS
===================================================== */

.availability-modal-actions {
    margin-top: 20px;
    display: grid;
    grid-template-columns:
        auto 1fr;
    gap: 8px;
}

.cancel-button,
.publish-button {
    padding: 10px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 8px;
    font-weight: 800;
}

.cancel-button {
    border:
        1px solid #cbd5e1;
    background: white;
    color: #475569;
}

.publish-button {
    border: 0;
    background: #0759d9;
    color: white;
}

.publish-button:disabled {
    opacity: .6;
}

/* =====================================================
   RESPONSIVE
===================================================== */

@media(max-width: 900px) {

    .gym-workspace {
        height: auto;
        grid-template-columns:
            1fr;
    }

    .coach-google-map {
        height: 380px;
        min-height: 380px;
    }

    .gym-list-panel {
        border-top:
            1px solid #e2e8f0;
        border-left: 0;
    }

    .gym-list {
        max-height: 300px;
    }

}

@media(max-width: 600px) {

    .gym-page-heading,
    .selected-gym-section {
        align-items:
            flex-start;
        flex-direction:
            column;
    }

    .facility-count {
        width: 100%;
    }

    .add-hours-button {
        width: 100%;
    }

    .weekday-grid {
        grid-template-columns:
            repeat(4,1fr);
    }

    .time-fields {
        grid-template-columns:
            1fr;
    }

}


/* Gym Locations page heading */
.coach-gym-page .gym-page-heading h1 {
    color: #172033 ;
}

/* Registered Facilities heading */
.coach-gym-page .gym-list-header strong {
    color: #172033 ;
}

/* Gym names in the facilities list */
.coach-gym-page .gym-list-item strong {
    color: #172033 ;
}

/* Selected facility gym name */
.coach-gym-page .selected-gym-main h2 {
    color: #172033;
}

/* Your Availability heading */
.coach-gym-page .availability-heading h2 {
    color: #172033 ;
}

/* Empty availability message */
.coach-gym-page .availability-empty strong {
    color: #172033 ;
}

/* Published availability day headings */
.coach-gym-page .availability-card h3 {
    color: #172033;
}

/* Add Working Hours modal heading */
.coach-gym-page .availability-modal-header h2 {
    color: #172033;
}

`;