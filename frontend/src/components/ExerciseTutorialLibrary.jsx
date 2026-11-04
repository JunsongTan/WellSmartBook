
import { useEffect, useState } from 'react';
import {
    useNavigate,
    useSearchParams
} from 'react-router-dom';

// ======================================================
// USER EXERCISE TUTORIAL LIBRARY
// ======================================================

const API_BASE_URL =
    `http://${window.location.hostname}:5000`;

const MUSCLE_GROUPS = [
    ['chest', 'Chest'],
    ['shoulders', 'Shoulders'],
    ['biceps', 'Biceps'],
    ['forearms', 'Forearms'],
    ['abs', 'Abdominals'],
    ['quadriceps', 'Quadriceps'],
    ['calves', 'Calves'],
    ['trapezius', 'Trapezius'],
    ['triceps', 'Triceps'],
    ['back', 'Back / Lats'],
    ['lower_back', 'Lower Back'],
    ['glutes', 'Glutes'],
    ['hamstrings', 'Hamstrings']
];

const muscleLabel = id =>
    MUSCLE_GROUPS.find(
        ([value]) => value === id
    )?.[1] || id;


// ======================================================
// MEDIA URL HELPER
// ======================================================

function mediaUrl(path) {

    const value = String(path || '');

    if (
        !/^\/api\/muscle-tutorial-media\/[a-f0-9-]{36}\.(jpg|png|webp|mp4|webm)$/i.test(
            value
        )
    ) {
        return '';
    }

    return `${API_BASE_URL}${value}`;
}


// ======================================================
// TUTORIAL IMAGE / VIDEO COMPONENT
// ======================================================

function TutorialMedia({
    tutorial,
    large = false
}) {

    const src = mediaUrl(tutorial.mediaUrl);

    if (!src) {

        return (
            <div className="etl-media-missing">
                Media unavailable
            </div>
        );
    }

    if (tutorial.mediaType === 'video') {

        return (
            <video
                className={
                    large
                        ? 'etl-large-media'
                        : 'etl-card-media'
                }
                src={src}
                controls={large}
                muted={!large}
                playsInline
                preload="metadata"
            />
        );
    }

    return (
        <img
            className={
                large
                    ? 'etl-large-media'
                    : 'etl-card-media'
            }
            src={src}
            alt={
                tutorial.title ||
                'Exercise tutorial'
            }
            loading="lazy"
        />
    );
}


// ======================================================
// MAIN EXERCISE TUTORIAL LIBRARY
// ======================================================

export default function ExerciseTutorialLibrary() {

    const navigate = useNavigate();

    const [searchParams, setSearchParams] =
        useSearchParams();


    // ==================================================
    // INITIAL MUSCLE FROM INTERACTIVE MAP
    // ==================================================

    const requestedMuscle =
        searchParams.get('muscle') || '';

    const initialMuscle =
        MUSCLE_GROUPS.some(
            ([id]) => id === requestedMuscle
        )
            ? requestedMuscle
            : '';


    // ==================================================
    // STATES
    // ==================================================

    const [muscle, setMuscle] =
        useState(initialMuscle);

    const [searchInput, setSearchInput] =
        useState('');

    const [searchQuery, setSearchQuery] =
        useState('');

    const [savedOnly, setSavedOnly] =
        useState(false);

    const [tutorials, setTutorials] =
        useState([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState('');

    const [actionError, setActionError] =
        useState('');

    const [savingId, setSavingId] =
        useState(null);

    const [selectedId, setSelectedId] =
        useState(null);

    const [refreshKey, setRefreshKey] =
        useState(0);


    // ==================================================
    // SEARCH DELAY
    // ==================================================

    useEffect(() => {

        const timer = setTimeout(() => {

            setSearchQuery(
                searchInput.trim()
            );

            setSelectedId(null);

        }, 350);

        return () => clearTimeout(timer);

    }, [searchInput]);


    // ==================================================
    // LOAD ALL COACH TUTORIALS FROM MYSQL
    // ==================================================

    useEffect(() => {

        const controller =
            new AbortController();

        async function loadTutorials() {

            setLoading(true);
            setError('');

            try {

                const token =
                    localStorage.getItem('token');

                if (!token) {

                    throw new Error(
                        'Please log in to browse tutorials.'
                    );
                }


                // ======================================
                // PREPARE API FILTERS
                // ======================================

                const params =
                    new URLSearchParams();

                if (muscle) {

                    params.set(
                        'muscle',
                        muscle
                    );
                }

                if (searchQuery) {

                    params.set(
                        'search',
                        searchQuery
                    );
                }

                if (savedOnly) {

                    params.set(
                        'savedOnly',
                        '1'
                    );
                }


                // ======================================
                // FETCH PUBLISHED TUTORIALS
                // ======================================

                const response = await fetch(

                    `${API_BASE_URL}/api/muscle-tutorials?${params.toString()}`,

                    {
                        headers: {
                            Authorization:
                                `Bearer ${token}`
                        },

                        signal: controller.signal
                    }
                );

                const data =
                    await response.json();

                if (
                    !response.ok ||
                    data.success === false
                ) {

                    throw new Error(
                        data.message ||
                        'Unable to load tutorials.'
                    );
                }


                // ======================================
                // UPDATE TUTORIAL LIST
                // ======================================

                if (!controller.signal.aborted) {

                    setTutorials(
                        Array.isArray(data.tutorials)
                            ? data.tutorials
                            : []
                    );
                }

            } catch (err) {

                if (
                    !controller.signal.aborted &&
                    err.name !== 'AbortError'
                ) {

                    setError(
                        err.message ||
                        'Unable to load tutorials.'
                    );
                }

            } finally {

                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        loadTutorials();

        return () => {
            controller.abort();
        };

    }, [
        muscle,
        searchQuery,
        savedOnly,
        refreshKey
    ]);


    // ==================================================
    // CHANGE MUSCLE FILTER
    // ==================================================

    function changeMuscle(value) {

        setMuscle(value);
        setSelectedId(null);
        setActionError('');

        setSearchParams(
            value
                ? { muscle: value }
                : {}
        );
    }


    // ==================================================
    // SHOW SAVED TUTORIALS
    // ==================================================

    function changeSavedOnly() {

        setSavedOnly(
            previous => !previous
        );

        setSelectedId(null);
        setActionError('');
    }


    // ==================================================
    // SAVE OR UNSAVE TUTORIAL
    // ==================================================

    async function toggleSaved(tutorial) {

        if (savingId !== null) {
            return;
        }

        setSavingId(tutorial.tutorialId);
        setActionError('');

        try {

            const token =
                localStorage.getItem('token');

            if (!token) {

                throw new Error(
                    'Please log in again.'
                );
            }

            const nextSaved =
                !tutorial.isSaved;


            // ======================================
            // CALL SAVE / UNSAVE API
            // ======================================

            const response = await fetch(

                `${API_BASE_URL}/api/muscle-tutorials/${tutorial.tutorialId}/save`,

                {
                    method:
                        nextSaved
                            ? 'POST'
                            : 'DELETE',

                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            );

            const data =
                await response.json();

            if (
                !response.ok ||
                data.success === false
            ) {

                throw new Error(
                    data.message ||
                    'Unable to update saved tutorials.'
                );
            }


            // ======================================
            // UPDATE LOCAL LIST
            // ======================================

            setTutorials(previous =>

                previous
                    .map(item =>

                        item.tutorialId ===
                        tutorial.tutorialId

                            ? {
                                ...item,
                                isSaved: nextSaved
                            }

                            : item
                    )

                    .filter(item =>

                        !savedOnly ||
                        item.isSaved
                    )
            );


            // ======================================
            // CLOSE DETAIL IF REMOVED FROM SAVED
            // ======================================

            if (
                savedOnly &&
                !nextSaved
            ) {

                setSelectedId(null);
            }

        } catch (err) {

            setActionError(
                err.message ||
                'Unable to update saved tutorials.'
            );

        } finally {

            setSavingId(null);
        }
    }


    // ==================================================
    // SELECTED TUTORIAL
    // ==================================================

    const selectedTutorial =
        tutorials.find(
            item =>
                item.tutorialId === selectedId
        );


    // ==================================================
    // RENDER
    // ==================================================

    return (

        <main className="etl-page">

            <style>
                {libraryCss}
            </style>


            {/* ==========================================
                PAGE HEADER
            ========================================== */}

            <header className="etl-header">

                <div>

                    <span className="etl-eyebrow">
                        WELLSMARTBOOK TRAINING GUIDES
                    </span>

                    <h1>
                        Exercise Tutorial Library
                    </h1>

                    <p>
                        Explore training videos, pictures
                        and instructions shared by
                        fitness coaches.
                    </p>

                </div>


                <button
                    type="button"
                    className="etl-outline"
                    onClick={() =>
                        navigate('/muscle-map')
                    }
                >
                    ← Back to Muscle Map
                </button>

            </header>


            {/* ==========================================
                ERROR MESSAGE
            ========================================== */}

            {actionError && (

                <div
                    className="etl-alert"
                    role="alert"
                >
                    {actionError}
                </div>

            )}


            {/* ==========================================
                LARGE TUTORIAL DETAIL VIEW
            ========================================== */}

            {selectedTutorial ? (

                <section className="etl-detail">


                    {/* DETAIL ACTIONS */}

                    <div className="etl-detail-top">

                        <button
                            type="button"
                            className="etl-outline"
                            onClick={() =>
                                setSelectedId(null)
                            }
                        >
                            ← All Tutorials
                        </button>


                        <button
                            type="button"

                            className={
                                `etl-save ${
                                    selectedTutorial.isSaved
                                        ? 'saved'
                                        : ''
                                }`
                            }

                            disabled={
                                savingId !== null
                            }

                            onClick={() =>
                                toggleSaved(
                                    selectedTutorial
                                )
                            }
                        >
                            {selectedTutorial.isSaved
                                ? '♥ Saved'
                                : '♡ Save Tutorial'}
                        </button>

                    </div>


                    {/* LARGE MEDIA AND INSTRUCTIONS */}

                    <div className="etl-detail-layout">


                        {/* VIDEO / PICTURE */}

                        <div className="etl-detail-main">

                            <div className="etl-detail-player">

                                <TutorialMedia
                                    tutorial={selectedTutorial}
                                    large
                                />

                            </div>


                            <div className="etl-detail-copy">

                                <span className="etl-tag">
                                    {muscleLabel(
                                        selectedTutorial.muscleGroup
                                    )}
                                </span>

                                <h2>
                                    {selectedTutorial.title}
                                </h2>

                                <p className="etl-coach">
                                    Posted by{' '}
                                    {selectedTutorial.coachName ||
                                        'Fitness Coach'}
                                </p>


                                {selectedTutorial.description && (

                                    <p>
                                        {selectedTutorial.description}
                                    </p>

                                )}


                                <div className="etl-meta">

                                    {selectedTutorial.sets != null && (

                                        <span>
                                            Sets: {selectedTutorial.sets}
                                        </span>

                                    )}


                                    {selectedTutorial.reps && (

                                        <span>
                                            Reps: {selectedTutorial.reps}
                                        </span>

                                    )}

                                </div>

                            </div>

                        </div>


                        {/* STEP-BY-STEP GUIDE */}

                        <aside className="etl-steps">

                            <h3>
                                Step-by-Step Instructions
                            </h3>

                            <p>
                                {selectedTutorial.instructions ||
                                    'No instructions provided.'}
                            </p>

                        </aside>

                    </div>

                </section>

            ) : (

                <>

                    {/* ==================================
                        SEARCH AND FILTER SECTION
                    ================================== */}

                    <section className="etl-filters">


                        {/* SEARCH BY TITLE */}

                        <label className="etl-search-label">

                            <span>
                                Search Exercise Title
                            </span>

                            <input
                                type="search"
                                placeholder="Search exercise title..."
                                value={searchInput}
                                maxLength={120}
                                onChange={event =>
                                    setSearchInput(
                                        event.target.value
                                    )
                                }
                            />

                        </label>


                        {/* FILTER AND SAVED BUTTON */}

                        <div className="etl-filter-row">


                            {/* MUSCLE GROUP FILTER */}

                            <label className="etl-muscle-filter">

                                <span>
                                    Filter by Muscle Group
                                </span>

                                <select
                                    value={muscle}
                                    onChange={event =>
                                        changeMuscle(
                                            event.target.value
                                        )
                                    }
                                >

                                    <option value="">
                                        All Muscle Groups
                                    </option>


                                    {MUSCLE_GROUPS.map(
                                        ([id, label]) => (

                                            <option
                                                key={id}
                                                value={id}
                                            >
                                                {label}
                                            </option>

                                        )
                                    )}

                                </select>

                            </label>


                            {/* SAVED TUTORIAL BUTTON */}

                            <button
                                type="button"

                                className={
                                    `etl-saved-filter ${
                                        savedOnly
                                            ? 'active'
                                            : ''
                                    }`
                                }

                                aria-pressed={savedOnly}

                                onClick={changeSavedOnly}
                            >
                                ♥{' '}
                                {savedOnly
                                    ? 'Showing Saved Tutorials'
                                    : 'Saved Tutorials'}
                            </button>

                        </div>

                    </section>


                    {/* ==================================
                        LIST HEADING
                    ================================== */}

                    <div className="etl-list-header">

                        <div>

                            <h2>
                                {savedOnly
                                    ? 'My Saved Tutorials'
                                    : 'All Exercise Tutorials'}
                            </h2>

                            <p>
                                {muscle
                                    ? `Muscle: ${muscleLabel(muscle)}`
                                    : 'Published tutorials from all coaches'}
                            </p>

                        </div>

                        <span>
                            {loading
                                ? 'Loading...'
                                : `${tutorials.length} tutorials`}
                        </span>

                    </div>


                    {/* ==================================
                        LOAD ERROR
                    ================================== */}

                    {error && (

                        <div
                            className="etl-alert"
                            role="alert"
                        >

                            {error}

                            <button
                                type="button"

                                onClick={() =>
                                    setRefreshKey(
                                        value => value + 1
                                    )
                                }
                            >
                                Try Again
                            </button>

                        </div>

                    )}


                    {/* ==================================
                        TUTORIAL RESULTS
                    ================================== */}

                    {loading ? (

                        <div
                            className="etl-empty"
                            role="status"
                        >
                            Loading tutorials...
                        </div>

                    ) : error ? (

                        null

                    ) : tutorials.length === 0 ? (

                        <div className="etl-empty">

                            <h3>
                                {savedOnly
                                    ? 'No saved tutorials found'
                                    : 'No matching tutorials'}
                            </h3>

                            <p>
                                {savedOnly
                                    ? 'Save a tutorial using its heart button, then find it here.'
                                    : 'Try another muscle group or search term.'}
                            </p>

                        </div>

                    ) : (

                        <div className="etl-grid">


                            {tutorials.map(tutorial => (

                                <article
                                    className="etl-card"
                                    key={tutorial.tutorialId}
                                >


                                    {/* MEDIA THUMBNAIL */}

                                    <div className="etl-card-player">

                                        <TutorialMedia
                                            tutorial={tutorial}
                                        />

                                    </div>


                                    {/* TUTORIAL DETAILS */}

                                    <div className="etl-card-content">


                                        <div className="etl-card-tags">

                                            <span className="etl-tag">

                                                {muscleLabel(
                                                    tutorial.muscleGroup
                                                )}

                                            </span>


                                            {/* SAVE BUTTON */}

                                            <button
                                                type="button"

                                                className={
                                                    `etl-save ${
                                                        tutorial.isSaved
                                                            ? 'saved'
                                                            : ''
                                                    }`
                                                }

                                                disabled={
                                                    savingId !== null
                                                }

                                                onClick={() =>
                                                    toggleSaved(tutorial)
                                                }

                                                aria-label={
                                                    tutorial.isSaved

                                                        ? `Remove ${tutorial.title} from saved tutorials`

                                                        : `Save ${tutorial.title}`
                                                }
                                            >
                                                {tutorial.isSaved
                                                    ? '♥ Saved'
                                                    : '♡ Save'}
                                            </button>

                                        </div>


                                        <h3>
                                            {tutorial.title}
                                        </h3>


                                        <p className="etl-coach">

                                            By{' '}
                                            {tutorial.coachName ||
                                                'Fitness Coach'}

                                        </p>


                                        <p className="etl-desc">

                                            {tutorial.description ||
                                                'View the tutorial for exercise instructions.'}

                                        </p>


                                        {/* SETS / REPS AND VIEW BUTTON */}

                                        <div className="etl-card-bottom">

                                            <span>

                                                {tutorial.sets
                                                    ? `${tutorial.sets} sets`
                                                    : ''}

                                                {tutorial.sets && tutorial.reps
                                                    ? ' · '
                                                    : ''}

                                                {tutorial.reps
                                                    ? `${tutorial.reps} reps`
                                                    : ''}

                                            </span>


                                            <button
                                                type="button"
                                                className="etl-primary"

                                                onClick={() =>
                                                    setSelectedId(
                                                        tutorial.tutorialId
                                                    )
                                                }
                                            >
                                                View Tutorial →
                                            </button>

                                        </div>

                                    </div>

                                </article>

                            ))}

                        </div>

                    )}

                </>

            )}

        </main>
    );
}


// ======================================================
// ALL CSS INSIDE THIS JSX FILE
// ======================================================

const libraryCss = `

.etl-page {
    width: 100%;
    max-width: 1500px;
    margin: 0 auto;
    color: #142c4e;
    min-width: 0;
}

.etl-page * {
    box-sizing: border-box;
}

/* ======================================================
   HEADER
====================================================== */

.etl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 24px;
}

.etl-eyebrow {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .9px;
    color: #0759df;
}

.etl-header h1 {
    margin: 8px 0;
    font-size: 28px;
    color: #102a53;
}

.etl-header p {
    margin: 0;
    color: #718096;
    font-size: 13px;
    line-height: 1.6;
}

/* ======================================================
   BUTTONS
====================================================== */

.etl-primary,
.etl-outline,
.etl-save,
.etl-saved-filter {
    cursor: pointer;
    font-family: inherit;
    border-radius: 9px;
    font-weight: 700;
    font-size: 13px;
    padding: 11px 14px;
}

.etl-primary {
    background: #0759df;
    border: 1px solid #0759df;
    color: white;
}

.etl-primary:hover {
    background: #0049bc;
}

.etl-outline {
    background: white;
    color: #24517b;
    border: 1px solid #d7e2f0;
}

.etl-outline:hover {
    background: #f0f6ff;
}

.etl-save {
    background: white;
    border: 1px solid #d7e2f0;
    color: #24517b;
    white-space: nowrap;
}

.etl-save.saved {
    color: #ae1853;
    border-color: #f3bad0;
    background: #fff1f6;
}

.etl-save:hover {
    border-color: #0759df;
}

.etl-page button:disabled {
    opacity: .5;
    cursor: wait;
}

.etl-page button:focus-visible,
.etl-page input:focus-visible,
.etl-page select:focus-visible {
    outline: 3px solid #83b4fa;
    outline-offset: 2px;
}

/* ======================================================
   SEARCH AND FILTER BAR
====================================================== */

.etl-filters {
    background: #fff;
    border: 1px solid #e0e8f2;
    border-radius: 13px;
    padding: 20px;
    margin-bottom: 24px;
}

.etl-search-label,
.etl-muscle-filter {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
}

.etl-search-label {
    margin-bottom: 15px;
}

.etl-search-label input,
.etl-muscle-filter select {
    width: 100%;
    min-width: 0;
    border: 1px solid #d7e2f0;
    border-radius: 9px;
    padding: 12px;
    background: #fff;
    color: #172b4d;
    font: inherit;
    font-size: 13px;
}

.etl-filter-row {
    display: flex;
    align-items: end;
    gap: 12px;
    flex-wrap: wrap;
}

.etl-muscle-filter {
    flex: 1;
    min-width: 180px;
}

.etl-saved-filter {
    background: white;
    border: 1px solid #b9cdea;
    color: #0759df;
    min-height: 43px;
}

.etl-saved-filter.active {
    color: white;
    background: #0759df;
    border-color: #0759df;
}

/* ======================================================
   LIST HEADING
====================================================== */

.etl-list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 0 0 17px;
}

.etl-list-header h2 {
    font-size: 21px;
    margin: 0 0 5px;
}

.etl-list-header p,
.etl-list-header > span {
    font-size: 12px;
    color: #718096;
    margin: 0;
}

/* ======================================================
   TUTORIAL CARDS
====================================================== */

.etl-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
}

.etl-card {
    min-width: 0;
    overflow: hidden;
    border: 1px solid #e0e8f2;
    border-radius: 13px;
    background: white;
}

.etl-card-player {
    background: #eef3fa;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 235px;
}

.etl-card-media {
    display: block;
    width: 100%;
    height: 275px;
    object-fit: contain;
    background: #eef3fa;
}

.etl-media-missing {
    padding: 50px;
    text-align: center;
    color: #718096;
}

.etl-card-content {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.etl-card-tags {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 9px;
}

.etl-tag {
    display: inline-flex;
    align-items: center;
    border-radius: 20px;
    padding: 7px 11px;
    background: #e7f0ff;
    color: #0759df;
    font-size: 11px;
    font-weight: 700;
}

.etl-card h3 {
    font-size: 19px;
    color: #102a53;
    margin: 0;
    overflow-wrap: anywhere;
}

.etl-coach {
    font-size: 12px;
    color: #0759df;
    margin: 0;
    font-weight: 650;
}

.etl-desc {
    font-size: 13px;
    line-height: 1.7;
    color: #64748b;
    margin: 0;
    overflow-wrap: anywhere;
}

.etl-card-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: auto;
    padding-top: 8px;
    flex-wrap: wrap;
}

.etl-card-bottom > span {
    color: #64748b;
    font-size: 12px;
}

/* ======================================================
   FULL-WIDTH TUTORIAL DETAIL
====================================================== */

.etl-detail {
    background: #fff;
    border: 1px solid #e0e8f2;
    border-radius: 13px;
    padding: 23px;
    min-width: 0;
}

.etl-detail-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 22px;
}

.etl-detail-layout {
    display: grid;
    grid-template-columns:
        minmax(0, 1.5fr)
        minmax(250px, .8fr);
    gap: 22px;
    align-items: start;
}

.etl-detail-main {
    min-width: 0;
}

.etl-detail-player {
    width: 100%;
    background: #eef3fa;
    border-radius: 10px;
    overflow: hidden;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 240px;
}

.etl-large-media {
    display: block;
    width: 100%;
    max-height: 590px;
    aspect-ratio: 16 / 9;
    object-fit: contain;
    background: #0a1728;
}

.etl-detail-copy {
    padding: 19px 0;
}

.etl-detail-copy h2 {
    margin: 12px 0 8px;
    font-size: 26px;
    overflow-wrap: anywhere;
}

.etl-detail-copy > p:not(.etl-coach) {
    font-size: 14px;
    color: #526581;
    line-height: 1.8;
}

.etl-meta {
    display: flex;
    gap: 9px;
    flex-wrap: wrap;
    margin-top: 15px;
}

.etl-meta span {
    background: #edf3ff;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 12px;
    color: #315071;
    font-weight: 650;
}

/* ======================================================
   STEP-BY-STEP INSTRUCTIONS
====================================================== */

.etl-steps {
    background: #f5f8fe;
    border: 1px solid #e0e8f2;
    border-radius: 11px;
    padding: 21px;
    min-width: 0;
}

.etl-steps h3 {
    font-size: 17px;
    margin: 0 0 15px;
}

.etl-steps p {
    white-space: pre-line;
    overflow-wrap: anywhere;
    line-height: 1.85;
    color: #526581;
    font-size: 13px;
    margin: 0;
}

/* ======================================================
   ERROR / EMPTY STATES
====================================================== */

.etl-alert {
    background: #fff0f0;
    color: #ad2525;
    border: 1px solid #f5c2c2;
    border-radius: 10px;
    padding: 14px;
    margin-bottom: 17px;
    font-size: 13px;
}

.etl-alert button {
    margin-left: 12px;
    padding: 6px 10px;
    border: 1px solid #f5c2c2;
    background: white;
    border-radius: 6px;
    cursor: pointer;
}

.etl-empty {
    text-align: center;
    background: #fff;
    border: 1px solid #e0e8f2;
    border-radius: 13px;
    padding: 60px 20px;
    color: #718096;
}

.etl-empty h3 {
    color: #102a53;
    font-size: 18px;
    margin: 0 0 8px;
}

.etl-empty p {
    font-size: 13px;
    margin: 0;
}

/* ======================================================
   TABLET
====================================================== */

@media (max-width: 1000px) {

    .etl-detail-layout {
        grid-template-columns: 1fr;
    }

}

@media (max-width: 850px) {

    .etl-grid {
        grid-template-columns: 1fr;
    }

}

/* ======================================================
   MOBILE
====================================================== */

@media (max-width: 650px) {

    .etl-header {
        flex-direction: column;
        align-items: stretch;
    }

    .etl-header h1 {
        font-size: 23px;
    }

    .etl-filters {
        padding: 14px;
    }

    .etl-muscle-filter {
        min-width: 100%;
    }

    .etl-saved-filter {
        width: 100%;
    }

    .etl-list-header h2 {
        font-size: 18px;
    }

    .etl-card-content {
        padding: 15px;
    }

    .etl-card-media {
        height: 230px;
    }

    .etl-detail {
        padding: 13px;
    }

    .etl-detail-top {
        flex-wrap: wrap;
    }

    .etl-detail-copy h2 {
        font-size: 22px;
    }

    .etl-steps {
        padding: 15px;
    }

    .etl-card-bottom .etl-primary {
        width: 100%;
    }

}

`;
