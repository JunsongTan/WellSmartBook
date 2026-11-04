import {
    useEffect,
    useMemo,
    useState
} from 'react';

import {
    useNavigate
} from 'react-router-dom';


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


const DAY_LABELS = [
    'MON',
    'TUE',
    'WED',
    'THU',
    'FRI',
    'SAT',
    'SUN'
];


const CALENDAR_START_HOUR =
    6;


const CALENDAR_END_HOUR =
    22;


const HOUR_HEIGHT =
    62;


// ======================================================
// DATE HELPERS
// ======================================================

function startOfWeek(
    input
) {

    const date =
        new Date(
            input
        );


    date.setHours(
        0,
        0,
        0,
        0
    );


    const currentDay =
        date.getDay();


    const mondayOffset =
        currentDay === 0
            ? -6
            : 1 - currentDay;


    date.setDate(
        date.getDate() +
        mondayOffset
    );


    return date;
}


function addDays(
    input,
    amount
) {

    const date =
        new Date(
            input
        );


    date.setDate(
        date.getDate() +
        amount
    );


    return date;
}


function formatDateKey(
    input
) {

    const date =
        new Date(
            input
        );


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


function formatMonthRange(
    startDate
) {

    const endDate =
        addDays(
            startDate,
            6
        );


    const sameMonth =
        startDate.getMonth() ===
            endDate.getMonth() &&
        startDate.getFullYear() ===
            endDate.getFullYear();


    if (
        sameMonth
    ) {

        return `${
            startDate.toLocaleDateString(
                'en-MY',
                {
                    month:
                        'short'
                }
            )
        } ${
            startDate.getDate()
        } - ${
            endDate.getDate()
        }, ${
            startDate.getFullYear()
        }`;
    }


    return `${
        startDate.toLocaleDateString(
            'en-MY',
            {
                month:
                    'short',
                day:
                    'numeric'
            }
        )
    } - ${
        endDate.toLocaleDateString(
            'en-MY',
            {
                month:
                    'short',
                day:
                    'numeric',
                year:
                    'numeric'
            }
        )
    }`;
}


function formatHour(
    hour
) {

    const suffix =
        hour >= 12
            ? 'PM'
            : 'AM';


    const displayHour =
        hour % 12 ||
        12;


    return `${displayHour}:00 ${suffix}`;
}


function formatTime(
    value
) {

    if (!value) {

        return '';

    }


    const [
        hourText,
        minute
    ] =
        String(
            value
        )
            .slice(
                0,
                5
            )
            .split(':');


    const hour =
        Number(
            hourText
        );


    const suffix =
        hour >= 12
            ? 'PM'
            : 'AM';


    const displayHour =
        hour % 12 ||
        12;


    return `${displayHour}:${minute} ${suffix}`;
}


function timeToMinutes(
    value
) {

    if (!value) {

        return 0;

    }


    const [
        hour,
        minute
    ] =
        String(
            value
        )
            .slice(
                0,
                5
            )
            .split(':')
            .map(
                Number
            );


    return (
        hour *
        60
    ) +
        minute;
}


function capitalize(
    value
) {

    if (!value) {

        return '';

    }


    return (
        value.charAt(
            0
        ).toUpperCase() +
        value.slice(
            1
        )
    );
}


// ======================================================
// COMPONENT
// ======================================================

export default function CoachSchedule() {

    const navigate =
        useNavigate();


    const token =
        localStorage.getItem(
            'token'
        );


    const [
        gyms,
        setGyms
    ] = useState([]);


    const [
        availability,
        setAvailability
    ] = useState([]);


    const [
        bookings,
        setBookings
    ] = useState([]);


    const [
        loadingBookings,
        setLoadingBookings
    ] = useState(false);


    const [
        bookingError,
        setBookingError
    ] = useState('');


    const [
        nowTick,
        setNowTick
    ] = useState(
        Date.now()
    );


    const [
        selectedGymId,
        setSelectedGymId
    ] = useState('');


    const [
        weekStart,
        setWeekStart
    ] = useState(
        startOfWeek(
            new Date()
        )
    );


    const [
        loading,
        setLoading
    ] = useState(true);


    const [
        error,
        setError
    ] = useState('');


    // ==================================================
    // LOAD
    // ==================================================

    useEffect(
        () => {

            loadScheduleData();

        },
        []
    );


    async function loadScheduleData() {

        try {

            setLoading(
                true
            );


            setError('');


            const [
                gymResponse,
                availabilityResponse
            ] =
                await Promise.all([
                    fetch(
                        `${API_BASE_URL}/api/gyms`,
                        {
                            headers: {
                                Authorization:
                                    `Bearer ${token}`
                            }
                        }
                    ),

                    fetch(
                        `${API_BASE_URL}/api/coach/availability`,
                        {
                            headers: {
                                Authorization:
                                    `Bearer ${token}`
                            }
                        }
                    )
                ]);


            const [
                gymData,
                availabilityData
            ] =
                await Promise.all([
                    gymResponse.json(),
                    availabilityResponse.json()
                ]);


            if (
                !gymResponse.ok
            ) {

                throw new Error(
                    gymData.message ||
                    'Unable to load gym locations.'
                );
            }


            if (
                !availabilityResponse.ok
            ) {

                throw new Error(
                    availabilityData.message ||
                    'Unable to load coach availability.'
                );
            }


            const gymList =
                Array.isArray(
                    gymData.gyms
                )
                    ? gymData.gyms
                    : [];


            const availabilityList =
                Array.isArray(
                    availabilityData.availability
                )
                    ? availabilityData.availability
                    : [];


            setGyms(
                gymList
            );


            setAvailability(
                availabilityList
            );


            if (
                gymList.length >
                0
            ) {

                setSelectedGymId(
                    String(
                        gymList[0].id
                    )
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
    // LIVE CLOCK FOR PENDING BOOKING HOLDS
    // ==================================================

    useEffect(
        () => {

            const timer =
                window.setInterval(
                    () => {

                        setNowTick(
                            Date.now()
                        );

                    },
                    1000
                );


            return () => {

                window.clearInterval(
                    timer
                );
            };

        },
        []
    );


    // ==================================================
    // LOAD REAL BOOKINGS FOR SELECTED GYM / WEEK
    // ==================================================

    useEffect(
        () => {

            if (
                !selectedGymId
            ) {

                setBookings([]);
                setBookingError('');

                return;
            }


            let active =
                true;


            setBookings([]);
            setBookingError('');


            const startDate =
                formatDateKey(
                    weekStart
                );


            const endDate =
                formatDateKey(
                    addDays(
                        weekStart,
                        6
                    )
                );


            async function loadBookings(
                silent = false
            ) {

                try {

                    if (!silent) {

                        setLoadingBookings(
                            true
                        );
                    }


                    setBookingError('');


                    const response =
                        await fetch(
                            `${API_BASE_URL}/api/coach/bookings` +
                            `?gymId=${encodeURIComponent(
                                selectedGymId
                            )}` +
                            `&startDate=${encodeURIComponent(
                                startDate
                            )}` +
                            `&endDate=${encodeURIComponent(
                                endDate
                            )}`,
                            {
                                headers: {
                                    Authorization:
                                        `Bearer ${token}`
                                }
                            }
                        );


                    let data =
                        {};


                    try {

                        data =
                            await response.json();

                    } catch {

                        data =
                            {};
                    }


                    if (
                        response.status === 401 ||
                        response.status === 403
                    ) {

                        localStorage.removeItem(
                            'token'
                        );

                        localStorage.removeItem(
                            'user'
                        );

                        navigate(
                            '/login'
                        );

                        return;
                    }


                    if (
                        !response.ok
                    ) {

                        throw new Error(
                            data.message ||
                            'Unable to load coach bookings.'
                        );
                    }


                    if (
                        active
                    ) {

                        setBookings(
                            Array.isArray(
                                data.bookings
                            )
                                ? data.bookings
                                : []
                        );
                    }

                } catch (
                    requestError
                ) {

                    if (
                        active
                    ) {

                        setBookingError(
                            requestError.message ||
                            'Unable to load coach bookings.'
                        );
                    }

                } finally {

                    if (
                        active &&
                        !silent
                    ) {

                        setLoadingBookings(
                            false
                        );
                    }
                }
            }


            loadBookings();


            const refreshTimer =
                window.setInterval(
                    () => {

                        loadBookings(
                            true
                        );

                    },
                    15000
                );


            return () => {

                active =
                    false;

                window.clearInterval(
                    refreshTimer
                );
            };

        },
        [
            selectedGymId,
            weekStart,
            token,
            navigate
        ]
    );


    // ==================================================
    // CURRENT WEEK DATES
    // ==================================================

    const weekDates =
        useMemo(
            () =>
                DAYS.map(
                    (
                        day,
                        index
                    ) => ({
                        day,
                        label:
                            DAY_LABELS[
                                index
                            ],

                        date:
                            addDays(
                                weekStart,
                                index
                            )
                    })
                ),

            [
                weekStart
            ]
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
                        String(
                            gym.id
                        ) ===
                        String(
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
    // ACTIVE BOOKINGS FOR THIS WEEK
    //
    // Pending holds disappear from the UI immediately
    // when their 15-minute timer reaches zero.
    // ==================================================

    const visibleBookings =
        useMemo(
            () =>
                bookings.filter(
                    (
                        booking
                    ) => {

                        if (
                            booking.status !==
                            'pending_payment'
                        ) {

                            return true;
                        }


                        const expiresAt =
                            Number(
                                booking.holdExpiresAtUnix ||
                                0
                            ) *
                            1000;


                        return (
                            Number.isFinite(
                                expiresAt
                            ) &&
                            expiresAt >
                                nowTick
                        );
                    }
                ),

            [
                bookings,
                nowTick
            ]
        );


    const nextSession =
        useMemo(
            () => {

                const now =
                    nowTick;


                return (
                    visibleBookings
                        .map(
                            (
                                booking
                            ) => ({

                                ...booking,

                                sessionTimestamp:
                                    new Date(
                                        `${booking.sessionDate}T${String(
                                            booking.startTime ||
                                            '00:00'
                                        ).slice(
                                            0,
                                            5
                                        )}:00+08:00`
                                    ).getTime()
                            })
                        )
                        .filter(
                            (
                                booking
                            ) =>
                                Number.isFinite(
                                    booking.sessionTimestamp
                                ) &&
                                booking.sessionTimestamp >=
                                    now
                        )
                        .sort(
                            (
                                first,
                                second
                            ) =>
                                first.sessionTimestamp -
                                second.sessionTimestamp
                        )[0] ||
                    null
                );
            },

            [
                visibleBookings,
                nowTick
            ]
        );


    // ==================================================
    // AVAILABILITY FOR SELECTED GYM
    // ==================================================

    const selectedGymAvailability =
        useMemo(
            () =>
                availability.filter(
                    (
                        item
                    ) =>
                        String(
                            item.gymId
                        ) ===
                        String(
                            selectedGymId
                        )
                ),

            [
                availability,
                selectedGymId
            ]
        );


    // ==================================================
    // RULES FOR ONE DAY
    // ==================================================

    function getRulesForDate(
        dayName,
        date
    ) {

        const dateKey =
            formatDateKey(
                date
            );


        return selectedGymAvailability
            .filter(
                (
                    item
                ) => {

                    if (
                        item.availabilityType ===
                        'weekly'
                    ) {

                        return (
                            item.dayOfWeek ===
                            dayName
                        );
                    }


                    if (
                        item.availabilityType ===
                        'specific_date'
                    ) {

                        return (
                            item.specificDate ===
                            dateKey
                        );
                    }


                    return false;
                }
            );
    }


    // ==================================================
    // BOOKINGS FOR ONE DAY
    // ==================================================

    function getBookingsForDate(
        date
    ) {

        const dateKey =
            formatDateKey(
                date
            );


        return visibleBookings
            .filter(
                (
                    booking
                ) =>
                    booking.sessionDate ===
                    dateKey
            );
    }


    function getHoldRemaining(
        booking
    ) {

        if (
            booking.status !==
            'pending_payment'
        ) {

            return '';
        }


        const expiresAt =
            Number(
                booking.holdExpiresAtUnix ||
                0
            ) *
            1000;


        if (
            !Number.isFinite(
                expiresAt
            )
        ) {

            return '';
        }


        const totalSeconds =
            Math.max(
                0,
                Math.floor(
                    (
                        expiresAt -
                        nowTick
                    ) /
                    1000
                )
            );


        const minutes =
            Math.floor(
                totalSeconds /
                60
            );


        const seconds =
            totalSeconds %
            60;


        return (
            `${minutes}:` +
            String(
                seconds
            ).padStart(
                2,
                '0'
            )
        );
    }


    function getBookingStatusLabel(
        status
    ) {

        if (
            status ===
            'pending_payment'
        ) {

            return 'PENDING PAYMENT';
        }


        if (
            status ===
            'confirmed'
        ) {

            return 'CONFIRMED';
        }


        if (
            status ===
            'completed'
        ) {

            return 'COMPLETED';
        }


        return String(
            status || ''
        )
            .replace(
                /_/g,
                ' '
            )
            .toUpperCase();
    }


    // ==================================================
    // BLOCK POSITION
    // ==================================================

    function getBlockStyle(
        item
    ) {

        const startMinutes =
            timeToMinutes(
                item.startTime
            );


        const endMinutes =
            timeToMinutes(
                item.endTime
            );


        const calendarStart =
            CALENDAR_START_HOUR *
            60;


        const calendarEnd =
            CALENDAR_END_HOUR *
            60;


        const visibleStart =
            Math.max(
                startMinutes,
                calendarStart
            );


        const visibleEnd =
            Math.min(
                endMinutes,
                calendarEnd
            );


        const minutesFromTop =
            visibleStart -
            calendarStart;


        const durationMinutes =
            Math.max(
                visibleEnd -
                visibleStart,
                15
            );


        const top =
            (
                minutesFromTop /
                60
            ) *
            HOUR_HEIGHT;


        const height =
            Math.max(
                (
                    durationMinutes /
                    60
                ) *
                    HOUR_HEIGHT,
                30
            );


        return {
            top:
                `${top}px`,

            height:
                `${height}px`
        };
    }


    // ==================================================
    // WEEK NAVIGATION
    // ==================================================

    function previousWeek() {

        setWeekStart(
            (
                current
            ) =>
                addDays(
                    current,
                    -7
                )
        );
    }


    function nextWeek() {

        setWeekStart(
            (
                current
            ) =>
                addDays(
                    current,
                    7
                )
        );
    }


    function goToCurrentWeek() {

        setWeekStart(
            startOfWeek(
                new Date()
            )
        );
    }


    // ==================================================
    // RENDER
    // ==================================================

    if (
        loading
    ) {

        return (
            <div className="schedule-loading">

                <style>
                    {scheduleCss}
                </style>

                Loading schedule...

            </div>
        );
    }


    return (
        <div className="coach-schedule-page">

            <style>
                {scheduleCss}
            </style>


            {/* =========================================
                HEADER
            ========================================= */}

            <section className="schedule-page-header">

                <div>

                    <span className="schedule-eyebrow">
                        COACH SCHEDULE
                    </span>


                    <h1>
                        Weekly Schedule
                    </h1>


                    <p>
                        Review the availability you have published for each WellSmartBook gym.
                    </p>

                </div>


                <button
                    type="button"
                    className="manage-availability-button"
                    onClick={() =>
                        navigate(
                            '/coach/gyms'
                        )
                    }
                >
                    Manage Availability
                </button>

            </section>


            {error && (

                <div className="schedule-error">

                    ⚠ {error}

                </div>

            )}


            {/* =========================================
                GYM SELECTOR
            ========================================= */}

            <section className="schedule-gym-selector">

                <div>

                    <label>
                        SELECT OPERATING GYM LOCATION
                    </label>


                    <div className="schedule-select-wrap">

                        <span>
                            ◉
                        </span>


                        <select
                            value={
                                selectedGymId
                            }
                            onChange={
                                (
                                    event
                                ) =>
                                    setSelectedGymId(
                                        event.target.value
                                    )
                            }
                        >

                            {gyms.map(
                                (
                                    gym
                                ) => (

                                    <option
                                        key={
                                            gym.id
                                        }
                                        value={
                                            gym.id
                                        }
                                    >
                                        {
                                            gym.name
                                        }
                                    </option>

                                )
                            )}

                        </select>

                    </div>

                </div>


                {selectedGym && (

                    <div className="selected-location-copy">

                        <span>
                            CURRENT LOCATION
                        </span>


                        <strong>
                            {
                                selectedGym.name
                            }
                        </strong>


                        <small>
                            {
                                selectedGym.fullAddress
                            }
                        </small>

                    </div>

                )}

            </section>


            {/* =========================================
                MAIN GRID
            ========================================= */}

            <div className="schedule-layout">

                {/* =====================================
                    CALENDAR
                ===================================== */}

                <section className="schedule-calendar-card">

                    <div className="calendar-toolbar">

                        <div>

                            <h2>
                                Weekly Schedule
                            </h2>


                            <p>

                                {
                                    selectedGym
                                        ? `Availability for ${selectedGym.name}`
                                        : 'Select a gym location'
                                }

                            </p>

                        </div>


                        <div className="week-navigation">

                            <button
                                type="button"
                                onClick={
                                    previousWeek
                                }
                                aria-label="Previous week"
                            >
                                ‹
                            </button>


                            <button
                                type="button"
                                className="current-week-button"
                                onClick={
                                    goToCurrentWeek
                                }
                            >

                                {
                                    formatMonthRange(
                                        weekStart
                                    )
                                }

                            </button>


                            <button
                                type="button"
                                onClick={
                                    nextWeek
                                }
                                aria-label="Next week"
                            >
                                ›
                            </button>

                        </div>

                    </div>


                    <div className="calendar-shell">

                        {/* =============================
                            DAY HEADERS
                        ============================= */}

                        <div className="calendar-header-row">

                            <div className="timezone-cell">
                                MYT
                            </div>


                            {weekDates.map(
                                (
                                    item
                                ) => {

                                    const today =
                                        formatDateKey(
                                            new Date()
                                        ) ===
                                        formatDateKey(
                                            item.date
                                        );


                                    return (

                                        <div
                                            key={
                                                item.day
                                            }
                                            className={
                                                today
                                                    ? 'day-header today'
                                                    : 'day-header'
                                            }
                                        >

                                            <span>
                                                {
                                                    item.label
                                                }
                                            </span>


                                            <strong>
                                                {
                                                    item.date
                                                        .getDate()
                                                }
                                            </strong>

                                        </div>

                                    );
                                }
                            )}

                        </div>


                        {/* =============================
                            CALENDAR BODY
                        ============================= */}

                        <div className="calendar-body">

                            {/* TIME COLUMN */}

                            <div className="calendar-time-column">

                                {Array.from(
                                    {
                                        length:
                                            CALENDAR_END_HOUR -
                                            CALENDAR_START_HOUR +
                                            1
                                    },
                                    (
                                        _,
                                        index
                                    ) => {

                                        const hour =
                                            CALENDAR_START_HOUR +
                                            index;


                                        return (

                                            <div
                                                key={
                                                    hour
                                                }
                                                className="calendar-time-label"
                                                style={{
                                                    height:
                                                        `${HOUR_HEIGHT}px`
                                                }}
                                            >
                                                {
                                                    formatHour(
                                                        hour
                                                    )
                                                }
                                            </div>

                                        );
                                    }
                                )}

                            </div>


                            {/* DAY COLUMNS */}

                            {weekDates.map(
                                (
                                    item
                                ) => {

                                    const rules =
                                        getRulesForDate(
                                            item.day,
                                            item.date
                                        );


                                    const dayBookings =
                                        getBookingsForDate(
                                            item.date
                                        );


                                    const today =
                                        formatDateKey(
                                            new Date()
                                        ) ===
                                        formatDateKey(
                                            item.date
                                        );


                                    return (

                                        <div
                                            key={
                                                item.day
                                            }
                                            className={
                                                today
                                                    ? 'calendar-day-column today'
                                                    : 'calendar-day-column'
                                            }
                                        >

                                            {Array.from(
                                                {
                                                    length:
                                                        CALENDAR_END_HOUR -
                                                        CALENDAR_START_HOUR +
                                                        1
                                                },
                                                (
                                                    _,
                                                    index
                                                ) => (

                                                    <div
                                                        key={
                                                            index
                                                        }
                                                        className="calendar-hour-line"
                                                        style={{
                                                            height:
                                                                `${HOUR_HEIGHT}px`
                                                        }}
                                                    />

                                                )
                                            )}


                                            {/* AVAILABILITY BLOCKS */}

                                            {rules.map(
                                                (
                                                    rule
                                                ) => (

                                                    <article
                                                        key={
                                                            rule.id
                                                        }
                                                        className={
                                                            rule.availabilityType ===
                                                            'specific_date'

                                                                ? 'schedule-block specific'

                                                                : 'schedule-block weekly'
                                                        }
                                                        style={
                                                            getBlockStyle(
                                                                rule
                                                            )
                                                        }
                                                    >

                                                        <span>

                                                            {
                                                                rule.availabilityType ===
                                                                'weekly'

                                                                    ? 'AVAILABLE'

                                                                    : 'DATE AVAILABILITY'
                                                            }

                                                        </span>


                                                        <strong>

                                                            {
                                                                formatTime(
                                                                    rule.startTime
                                                                )
                                                            }

                                                            {' – '}

                                                            {
                                                                formatTime(
                                                                    rule.endTime
                                                                )
                                                            }

                                                        </strong>


                                                        <small>

                                                            {
                                                                rule.slotDurationMinutes
                                                            } min slots

                                                        </small>

                                                    </article>

                                                )
                                            )}


                                            {/* REAL BOOKING BLOCKS */}

                                            {dayBookings.map(
                                                (
                                                    booking
                                                ) => (

                                                    <article
                                                        key={
                                                            `booking-${booking.bookingId}`
                                                        }
                                                        className={
                                                            `booking-calendar-block ${booking.status}`
                                                        }
                                                        style={
                                                            getBlockStyle(
                                                                booking
                                                            )
                                                        }
                                                    >

                                                        <span>
                                                            {
                                                                getBookingStatusLabel(
                                                                    booking.status
                                                                )
                                                            }
                                                        </span>


                                                        <strong>
                                                            {
                                                                formatTime(
                                                                    booking.startTime
                                                                )
                                                            }
                                                            {' – '}
                                                            {
                                                                formatTime(
                                                                    booking.endTime
                                                                )
                                                            }
                                                        </strong>


                                                        <small>
                                                            {
                                                                booking.clientName ||
                                                                'Client'
                                                            }
                                                        </small>


                                                        {
                                                            booking.status ===
                                                            'pending_payment' && (

                                                                <small>
                                                                    Hold {
                                                                        getHoldRemaining(
                                                                            booking
                                                                        )
                                                                    }
                                                                </small>
                                                            )
                                                        }

                                                    </article>

                                                )
                                            )}

                                        </div>

                                    );
                                }
                            )}

                        </div>

                    </div>


                    <div className="calendar-footer">

                        <div className="calendar-legend">

                            <span>
                                <i className="legend-blue" />
                                Weekly availability
                            </span>


                            <span>
                                <i className="legend-green" />
                                Specific-date availability
                            </span>


                            <span>
                                <i className="legend-amber" />
                                Pending payment
                            </span>


                            <span>
                                <i className="legend-booked" />
                                Confirmed booking
                            </span>

                        </div>


                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    '/coach/gyms'
                                )
                            }
                        >
                            ✎ Manage Availability
                        </button>

                    </div>

                </section>


                {/* =====================================
                    BOOKINGS PANEL
                ===================================== */}

                <aside className="schedule-bookings-card">

                    <div className="booking-panel-heading">

                        <div>

                            <span>
                                SESSION MANAGEMENT
                            </span>


                            <h2>
                                Bookings at this Location
                            </h2>


                            <p>

                                {
                                    selectedGym
                                        ? selectedGym.name
                                        : 'No location selected'
                                }

                            </p>

                        </div>


                        <div className="booking-total">

                            <strong>
                                {
                                    visibleBookings.length
                                }
                            </strong>

                            <span>
                                Total
                            </span>

                        </div>

                    </div>


                    {
                        loadingBookings ? (

                            <div className="booking-panel-loading">
                                Loading bookings...
                            </div>

                        ) : bookingError ? (

                            <div className="booking-panel-error">
                                ⚠ {bookingError}
                            </div>

                        ) : visibleBookings.length ===
                            0 ? (

                            <div className="booking-empty">

                                <div className="booking-empty-icon">
                                    □
                                </div>


                                <strong>
                                    No bookings yet
                                </strong>


                                <p>
                                    Pending payment holds and confirmed coaching sessions will appear here automatically.
                                </p>

                            </div>

                        ) : (

                            <div className="booking-list">

                                {visibleBookings.map(
                                    (
                                        booking
                                    ) => (

                                        <article
                                            key={
                                                booking.bookingId
                                            }
                                            className="booking-item"
                                        >

                                            <div className="booking-item-top">

                                                <div>

                                                    <span className="booking-date-label">
                                                        {
                                                            booking.sessionDate
                                                        }
                                                    </span>


                                                    <strong>
                                                        {
                                                            formatTime(
                                                                booking.startTime
                                                            )
                                                        }
                                                        {' – '}
                                                        {
                                                            formatTime(
                                                                booking.endTime
                                                            )
                                                        }
                                                    </strong>

                                                </div>


                                                <span
                                                    className={
                                                        `booking-status-badge ${booking.status}`
                                                    }
                                                >
                                                    {
                                                        getBookingStatusLabel(
                                                            booking.status
                                                        )
                                                    }
                                                </span>

                                            </div>


                                            <div className="booking-client">

                                                <strong>
                                                    {
                                                        booking.clientName ||
                                                        'Client'
                                                    }
                                                </strong>

                                                <span>
                                                    {
                                                        booking.durationMinutes
                                                    } min
                                                    {' • '}
                                                    {
                                                        booking.currency ||
                                                        'MYR'
                                                    }{' '}
                                                    {
                                                        Number(
                                                            booking.amount ||
                                                            0
                                                        ).toFixed(
                                                            2
                                                        )
                                                    }
                                                </span>

                                            </div>


                                            <div className="booking-payment-row">

                                                <span
                                                    className={
                                                        `payment-status-badge ${booking.paymentStatus}`
                                                    }
                                                >
                                                    Payment:{' '}
                                                    {
                                                        String(
                                                            booking.paymentStatus ||
                                                            'unpaid'
                                                        )
                                                            .replace(
                                                                /_/g,
                                                                ' '
                                                            )
                                                            .toUpperCase()
                                                    }
                                                </span>


                                                {
                                                    booking.status ===
                                                    'pending_payment' && (

                                                        <span className="hold-countdown">
                                                            Hold{' '}
                                                            {
                                                                getHoldRemaining(
                                                                    booking
                                                                )
                                                            }
                                                        </span>
                                                    )
                                                }

                                            </div>

                                        </article>

                                    )
                                )}

                            </div>
                        )
                    }


                    <div className="booking-summary">

                        <div>

                            <span>
                                NEXT SESSION
                            </span>


                            <strong>
                                {
                                    nextSession
                                        ? `${nextSession.sessionDate} ${formatTime(
                                            nextSession.startTime
                                        )}`
                                        : '—'
                                }
                            </strong>

                        </div>


                        <div>

                            <span>
                                THIS WEEK
                            </span>


                            <strong>
                                {
                                    visibleBookings.length
                                } {
                                    visibleBookings.length ===
                                    1
                                        ? 'session'
                                        : 'sessions'
                                }
                            </strong>

                        </div>

                    </div>

                </aside>

            </div>

        </div>
    );
}


// ======================================================
// CSS
// ======================================================

const scheduleCss = `

.coach-schedule-page {
    color: #172033;
}

.schedule-loading {
    min-height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    font-size: 10px;
}

.schedule-page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 18px;
}

.schedule-eyebrow,
.schedule-gym-selector label,
.selected-location-copy > span,
.booking-panel-heading > div:first-child > span {
    color: #0759d9;
    font-size: 7px;
    font-weight: 800;
    letter-spacing: .8px;
}

.schedule-page-header h1 {
    margin: 5px 0;
    font-size: 28px;
}

.schedule-page-header p {
    margin: 0;
    color: #64748b;
    font-size: 9px;
}

.manage-availability-button {
    padding: 10px 14px;
    border: 0;
    border-radius: 9px;
    background: #0759d9;
    color: white;
    cursor: pointer;
    font-size: 8px;
    font-weight: 800;
}

.schedule-error {
    margin-bottom: 15px;
    padding: 11px;
    border: 1px solid #fed7aa;
    border-radius: 9px;
    background: #fff7ed;
    color: #c2410c;
    font-size: 9px;
}

/* =====================================================
   GYM SELECTOR
===================================================== */

.schedule-gym-selector {
    margin-bottom: 16px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 18px;
    padding: 16px 18px;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    background: white;
}

.schedule-gym-selector label {
    display: block;
    margin-bottom: 6px;
}

.schedule-select-wrap {
    min-width: 240px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 11px;
    border-radius: 9px;
    background: #eaf2ff;
}

.schedule-select-wrap > span {
    color: #0759d9;
}

.schedule-select-wrap select {
    flex: 1;
    padding: 10px 0;
    border: 0;
    outline: 0;
    background: transparent;
    color: #172033;
    font-size: 9px;
    font-weight: 700;
}

.selected-location-copy {
    max-width: 360px;
    text-align: right;
}

.selected-location-copy strong {
    display: block;
    margin-top: 4px;
    font-size: 10px;
}

.selected-location-copy small {
    display: block;
    margin-top: 3px;
    color: #94a3b8;
    font-size: 7px;
}

/* =====================================================
   LAYOUT
===================================================== */

.schedule-layout {
    display: grid;
    grid-template-columns:
        minmax(0, 1fr)
        280px;

    gap: 15px;
    align-items: stretch;
}

/* =====================================================
   CALENDAR
===================================================== */

.schedule-calendar-card {
    min-width: 0;
    padding: 18px;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    background: white;
}

.calendar-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    margin-bottom: 14px;
}

.calendar-toolbar h2 {
    margin: 0;
    font-size: 18px;
}

.calendar-toolbar p {
    margin: 3px 0 0;
    color: #64748b;
    font-size: 8px;
}

.week-navigation {
    display: flex;
    align-items: center;
    gap: 6px;
}

.week-navigation button {
    height: 34px;
    min-width: 34px;
    border: 1px solid #dbe3ef;
    border-radius: 8px;
    background: white;
    color: #475569;
    cursor: pointer;
}

.week-navigation button:hover {
    background: #f8fafc;
}

.week-navigation .current-week-button {
    min-width: 150px;
    padding: 0 10px;
    background: #f8fafc;
    font-size: 8px;
    font-weight: 700;
}

.calendar-shell {
    overflow-x: auto;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
}

.calendar-header-row {
    min-width: 760px;
    display: grid;
    grid-template-columns:
        70px
        repeat(7, minmax(90px, 1fr));

    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
}

.timezone-cell,
.day-header {
    min-height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.timezone-cell {
    color: #64748b;
    font-size: 7px;
}

.day-header {
    flex-direction: column;
    gap: 3px;
    border-left: 1px solid #edf2f7;
}

.day-header span {
    color: #64748b;
    font-size: 7px;
}

.day-header strong {
    font-size: 10px;
}

.day-header.today strong {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #0759d9;
    color: white;
}

.calendar-body {
    min-width: 760px;
    display: grid;
    grid-template-columns:
        70px
        repeat(7, minmax(90px, 1fr));
}

.calendar-time-column {
    background: white;
}

.calendar-time-label {
    padding: 7px 6px 0;
    border-bottom: 1px solid #edf2f7;
    color: #94a3b8;
    font-size: 6px;
}

.calendar-day-column {
    position: relative;
    border-left: 1px solid #edf2f7;
    background: white;
}

.calendar-day-column.today {
    background: #f8fbff;
}

.calendar-hour-line {
    border-bottom: 1px solid #edf2f7;
}

.schedule-block {
    position: absolute;
    z-index: 2;
    left: 5px;
    right: 5px;
    padding: 7px;
    overflow: hidden;
    border-radius: 7px;
    color: white;
    box-shadow: 0 3px 8px rgba(15,23,42,.12);
}

.schedule-block.weekly {
    background: #0759d9;
}

.schedule-block.specific {
    background: #16a36a;
}

.booking-calendar-block {
    position: absolute;
    z-index: 5;
    left: 8px;
    right: 8px;
    padding: 6px;
    overflow: hidden;
    border: 2px solid white;
    border-radius: 7px;
    color: white;
    box-shadow: 0 4px 11px rgba(15,23,42,.20);
}

.booking-calendar-block.pending_payment {
    background: #d97706;
}

.booking-calendar-block.confirmed {
    background: #15803d;
}

.booking-calendar-block.completed {
    background: #475569;
}

.booking-calendar-block > span,
.booking-calendar-block > strong,
.booking-calendar-block > small {
    display: block;
}

.booking-calendar-block > span {
    font-size: 5px;
    font-weight: 800;
    letter-spacing: .4px;
}

.booking-calendar-block > strong {
    margin-top: 3px;
    font-size: 6px;
    line-height: 1.3;
}

.booking-calendar-block > small {
    margin-top: 2px;
    font-size: 5px;
    opacity: .9;
}

.schedule-block > span {
    display: block;
    font-size: 5px;
    font-weight: 800;
    letter-spacing: .5px;
    opacity: .82;
}

.schedule-block > strong {
    display: block;
    margin-top: 4px;
    font-size: 7px;
    line-height: 1.35;
}

.schedule-block > small {
    display: block;
    margin-top: 3px;
    font-size: 5px;
    opacity: .8;
}

.calendar-footer {
    margin-top: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.calendar-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
}

.calendar-legend span {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #64748b;
    font-size: 7px;
}

.calendar-legend i {
    width: 9px;
    height: 9px;
    display: block;
    border-radius: 3px;
}

.legend-blue {
    background: #0759d9;
}

.legend-green {
    background: #16a36a;
}

.legend-amber {
    background: #d97706;
}

.legend-booked {
    background: #15803d;
}

.calendar-footer button {
    padding: 9px 13px;
    border: 0;
    border-radius: 8px;
    background: #0759d9;
    color: white;
    cursor: pointer;
    font-size: 8px;
    font-weight: 800;
}

/* =====================================================
   BOOKINGS
===================================================== */

.schedule-bookings-card {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    padding: 18px;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    background: white;
}

.booking-panel-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
}

.booking-panel-heading h2 {
    margin: 5px 0;
    font-size: 15px;
}

.booking-panel-heading p {
    margin: 0;
    color: #64748b;
    font-size: 7px;
}

.booking-total {
    min-width: 46px;
    padding: 7px;
    border-radius: 10px;
    background: #eaf2ff;
    text-align: center;
}

.booking-total strong {
    display: block;
    color: #0759d9;
    font-size: 13px;
}

.booking-total span {
    color: #64748b;
    font-size: 6px;
}

.booking-panel-loading,
.booking-panel-error {
    margin-top: 15px;
    padding: 12px;
    border-radius: 9px;
    font-size: 8px;
}

.booking-panel-loading {
    background: #f8fafc;
    color: #64748b;
    text-align: center;
}

.booking-panel-error {
    border: 1px solid #fed7aa;
    background: #fff7ed;
    color: #c2410c;
}

.booking-list {
    display: grid;
    gap: 9px;
    margin-top: 15px;
    max-height: 520px;
    overflow-y: auto;
    padding-right: 2px;
}

.booking-item {
    padding: 11px;
    border: 1px solid #e2e8f0;
    border-radius: 11px;
    background: #fbfdff;
}

.booking-item-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
}

.booking-date-label {
    display: block;
    color: #64748b;
    font-size: 6px;
}

.booking-item-top strong {
    display: block;
    margin-top: 3px;
    color: #172033;
    font-size: 8px;
}

.booking-status-badge {
    flex-shrink: 0;
    padding: 4px 6px;
    border-radius: 999px;
    font-size: 5px;
    font-weight: 800;
    letter-spacing: .35px;
}

.booking-status-badge.pending_payment {
    background: #fff7ed;
    color: #c2410c;
}

.booking-status-badge.confirmed {
    background: #ecfdf3;
    color: #15803d;
}

.booking-status-badge.completed {
    background: #f1f5f9;
    color: #475569;
}

.booking-client {
    margin-top: 9px;
}

.booking-client strong,
.booking-client span {
    display: block;
}

.booking-client strong {
    color: #334155;
    font-size: 8px;
}

.booking-client span {
    margin-top: 3px;
    color: #64748b;
    font-size: 6px;
}

.booking-payment-row {
    margin-top: 9px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
}

.payment-status-badge {
    padding: 4px 6px;
    border-radius: 999px;
    background: #f1f5f9;
    color: #475569;
    font-size: 5px;
    font-weight: 800;
}

.payment-status-badge.unpaid,
.payment-status-badge.pending {
    background: #fff7ed;
    color: #c2410c;
}

.payment-status-badge.paid {
    background: #ecfdf3;
    color: #15803d;
}

.hold-countdown {
    color: #c2410c;
    font-size: 6px;
    font-weight: 800;
}

.booking-empty {
    margin-top: 20px;
    padding: 35px 13px;
    border: 1px dashed #cbd5e1;
    border-radius: 12px;
    text-align: center;
}

.booking-empty-icon {
    width: 42px;
    height: 42px;
    margin: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: #f1f5f9;
    color: #94a3b8;
}

.booking-empty strong {
    display: block;
    margin-top: 10px;
    font-size: 10px;
}

.booking-empty p {
    margin: 6px 0 0;
    color: #94a3b8;
    font-size: 7px;
    line-height: 1.6;
}

.booking-summary {
    margin-top: auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 7px;
    padding-top: 20px;
}

.booking-summary > div {
    padding: 12px;
    border-radius: 10px;
    background: #f8fafc;
}

.booking-summary span {
    display: block;
    color: #94a3b8;
    font-size: 6px;
}

.booking-summary strong {
    display: block;
    margin-top: 5px;
    font-size: 11px;
}

/* =====================================================
   RESPONSIVE
===================================================== */

@media(max-width: 1100px) {

    .schedule-layout {
        grid-template-columns:
            1fr;
    }

    .schedule-bookings-card {
        min-height: 280px;
    }

}

@media(max-width: 700px) {

    .schedule-page-header,
    .schedule-gym-selector,
    .calendar-toolbar,
    .calendar-footer {
        align-items: flex-start;
        flex-direction: column;
    }

    .manage-availability-button,
    .schedule-select-wrap {
        width: 100%;
    }

    .selected-location-copy {
        text-align: left;
    }

    .week-navigation {
        width: 100%;
    }

    .week-navigation .current-week-button {
        flex: 1;
    }

}

`;