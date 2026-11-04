
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ======================================================
// MUSCLE GROUPS
// IDS MATCH MYSQL MUSCLE TUTORIALS
// ======================================================

const MUSCLE_INFO = {
    chest: {
        label: 'Chest',
        description: 'Muscles across the front of the upper chest.'
    },
    shoulders: {
        label: 'Shoulders',
        description: 'Deltoid muscles surrounding the shoulders.'
    },
    biceps: {
        label: 'Biceps',
        description: 'Muscles at the front of the upper arms.'
    },
    forearms: {
        label: 'Forearms',
        description: 'Muscles controlling grip and wrist movement.'
    },
    abs: {
        label: 'Abdominals',
        description: 'Muscles in the front of the core.'
    },
    quadriceps: {
        label: 'Quadriceps',
        description: 'Muscles at the front of the thighs.'
    },
    calves: {
        label: 'Calves',
        description: 'Muscles at the back of the lower legs.'
    },
    trapezius: {
        label: 'Trapezius',
        description: 'Muscles across the upper back and neck.'
    },
    triceps: {
        label: 'Triceps',
        description: 'Muscles at the back of the upper arms.'
    },
    back: {
        label: 'Back / Lats',
        description: 'Broad muscles on either side of the upper and middle back.'
    },
    lower_back: {
        label: 'Lower Back',
        description: 'Muscles supporting the lumbar region.'
    },
    glutes: {
        label: 'Glutes',
        description: 'Muscles around the buttocks and hips.'
    },
    hamstrings: {
        label: 'Hamstrings',
        description: 'Muscles at the back of the thighs.'
    }
};

// ======================================================
// CLICKABLE MUSCLE REGIONS
// ======================================================

const MUSCLE_AREAS = {

    front: [
        {
            id: 'shoulders',
            paths: [
                'M108 111 Q93 103 84 122 Q79 136 91 155 L110 143 Z',
                'M192 111 Q207 103 216 122 Q221 136 209 155 L190 143 Z'
            ]
        },
        {
            id: 'chest',
            paths: [
                'M117 116 Q133 113 146 123 L146 164 Q129 177 111 161 Z',
                'M183 116 Q167 113 154 123 L154 164 Q171 177 189 161 Z'
            ]
        },
        {
            id: 'biceps',
            paths: [
                'M82 154 L98 161 L87 207 L72 204 Z',
                'M218 154 L202 161 L213 207 L228 204 Z'
            ]
        },
        {
            id: 'forearms',
            paths: [
                'M72 210 L87 213 L70 270 L58 268 Z',
                'M228 210 L213 213 L230 270 L242 268 Z'
            ]
        },
        {
            id: 'abs',
            paths: [
                'M126 178 L146 178 L146 245 L132 242 L120 224 Z',
                'M154 178 L174 178 L180 224 L168 242 L154 245 Z'
            ]
        },
        {
            id: 'quadriceps',
            paths: [
                'M119 292 L147 297 L144 396 Q126 406 111 390 Z',
                'M181 292 L153 297 L156 396 Q174 406 189 390 Z'
            ]
        },
        {
            id: 'calves',
            paths: [
                'M111 412 Q127 405 141 412 L134 497 L120 508 Z',
                'M189 412 Q173 405 159 412 L166 497 L180 508 Z'
            ]
        }
    ],

    back: [
        {
            id: 'trapezius',
            paths: [
                'M128 108 L150 126 L172 108 L190 146 L156 164 L144 164 L110 146 Z'
            ]
        },
        {
            id: 'shoulders',
            paths: [
                'M108 111 Q93 103 84 122 Q79 136 91 155 L109 143 Z',
                'M192 111 Q207 103 216 122 Q221 136 209 155 L191 143 Z'
            ]
        },
        {
            id: 'triceps',
            paths: [
                'M82 154 L98 161 L87 207 L72 204 Z',
                'M218 154 L202 161 L213 207 L228 204 Z'
            ]
        },
        {
            id: 'back',
            paths: [
                'M112 166 L144 172 L139 218 L119 246 L106 213 Z',
                'M188 166 L156 172 L161 218 L181 246 L194 213 Z'
            ]
        },
        {
            id: 'lower_back',
            paths: [
                'M142 222 L158 222 L173 261 L150 271 L127 261 Z'
            ]
        },
        {
            id: 'glutes',
            paths: [
                'M119 273 Q134 270 148 280 L146 317 Q130 329 113 312 Z',
                'M181 273 Q166 270 152 280 L154 317 Q170 329 187 312 Z'
            ]
        },
        {
            id: 'hamstrings',
            paths: [
                'M116 327 L146 329 L141 402 L112 400 Z',
                'M184 327 L154 329 L159 402 L188 400 Z'
            ]
        },
        {
            id: 'calves',
            paths: [
                'M111 412 Q127 405 141 412 L134 497 L120 508 Z',
                'M189 412 Q173 405 159 412 L166 497 L180 508 Z'
            ]
        }
    ]
};

// ======================================================
// CLICKABLE HUMAN BODY COMPONENT
// ======================================================

function MuscleBody({
    view,
    selectedMuscle,
    onSelect
}) {

    return (

        <svg
            className="mm-body-svg"
            viewBox="0 0 300 570"
            role="group"
            aria-label={
                `${view === 'front' ? 'Front' : 'Back'} muscle diagram`
            }
        >

            {/* ======================================
                HUMAN BODY SILHOUETTE
            ====================================== */}

            <g className="mm-silhouette">

                {/* HEAD */}
                <ellipse
                    cx="150"
                    cy="48"
                    rx="24"
                    ry="30"
                />

                {/* NECK */}
                <path
                    d="M137 72 L163 72 L166 101 L134 101 Z"
                />

                {/* LEFT ARM */}
                <path
                    d="M100 107 Q87 113 81 131 L59 221 L49 276 Q47 291 58 294 Q71 296 76 280 L97 205 L113 132 Z"
                />

                {/* RIGHT ARM */}
                <path
                    d="M200 107 Q213 113 219 131 L241 221 L251 276 Q253 291 242 294 Q229 296 224 280 L203 205 L187 132 Z"
                />

                {/* TORSO */}
                <path
                    d="M131 99 Q112 97 101 108 L105 195 L116 251 L184 251 L195 195 L199 108 Q188 97 169 99 Z"
                />

                {/* HIPS */}
                <path
                    d="M116 247 Q150 256 184 247 L189 294 L174 325 L126 325 L111 294 Z"
                />

                {/* LEFT LEG */}
                <path
                    d="M118 298 L149 300 L144 408 L137 506 L116 507 L107 400 Z"
                />

                {/* RIGHT LEG */}
                <path
                    d="M182 298 L151 300 L156 408 L163 506 L184 507 L193 400 Z"
                />

                {/* LEFT FOOT */}
                <path
                    d="M116 499 L136 499 L135 538 Q118 544 104 539 L107 524 Z"
                />

                {/* RIGHT FOOT */}
                <path
                    d="M184 499 L164 499 L165 538 Q182 544 196 539 L193 524 Z"
                />

            </g>


            {/* ======================================
                INTERACTIVE MUSCLE REGIONS
            ====================================== */}

            {MUSCLE_AREAS[view].map(group => (

                <g
                    key={`${view}-${group.id}`}

                    className={
                        selectedMuscle === group.id
                            ? 'mm-muscle-zone selected'
                            : 'mm-muscle-zone'
                    }

                    role="button"
                    tabIndex={0}

                    aria-label={
                        `Select ${MUSCLE_INFO[group.id].label}`
                    }

                    aria-pressed={
                        selectedMuscle === group.id
                    }

                    onClick={() =>
                        onSelect(group.id)
                    }

                    onKeyDown={event => {

                        if (
                            event.key === 'Enter' ||
                            event.key === ' '
                        ) {

                            event.preventDefault();

                            onSelect(group.id);
                        }
                    }}
                >

                    <title>
                        {MUSCLE_INFO[group.id].label}
                    </title>

                    {group.paths.map((path, index) => (

                        <path
                            key={index}
                            d={path}
                        />

                    ))}

                </g>

            ))}


            {/* MUSCLE DETAIL LINES */}

            <g
                className="mm-figure-lines"
                aria-hidden="true"
            >

                <path
                    d="M150 167 L150 245"
                />

                <path
                    d="M128 200 L144 200 M156 200 L172 200"
                />

                <path
                    d="M130 221 L144 221 M156 221 L170 221"
                />

            </g>

        </svg>
    );
}


// ======================================================
// MAIN INTERACTIVE MUSCLE MAP PAGE
// ======================================================

export default function InteractiveMuscleMap() {

    const navigate = useNavigate();

    // ==================================================
    // STATES
    // ==================================================

    const [bodyView, setBodyView] =
        useState('front');

    const [selectedMuscle, setSelectedMuscle] =
        useState(null);


    // ==================================================
    // SELECTED MUSCLE INFORMATION
    // ==================================================

    const selectedInfo = selectedMuscle
        ? MUSCLE_INFO[selectedMuscle]
        : null;


    // ==================================================
    // SWITCH FRONT / BACK BODY
    // ==================================================

    function changeView(nextView) {

        setBodyView(nextView);

        setSelectedMuscle(null);
    }


    // ==================================================
    // OPEN EXERCISE TUTORIAL LIBRARY
    // ==================================================

    function openTutorials(muscle = '') {

        const destination = muscle
            ? `/muscle-map/tutorials?muscle=${encodeURIComponent(muscle)}`
            : '/muscle-map/tutorials';

        navigate(destination);
    }


    // ==================================================
    // RENDER
    // ==================================================

    return (

        <div className="mm-page">

            <style>
                {muscleMapCss}
            </style>


            {/* ==========================================
                PAGE HEADER
            ========================================== */}

            <header className="mm-header">

                <div>

                    <h1>
                        Interactive Muscle Map
                    </h1>

                    <p>
                        Click a muscle on the body to
                        explore training tutorials
                        shared by fitness coaches.
                    </p>

                </div>


                {/* BROWSE ALL TUTORIALS */}

                <button
                    type="button"
                    className="mm-header-library-button"
                    onClick={() =>
                        openTutorials()
                    }
                >
                    Browse All Tutorials →
                </button>

            </header>


            {/* ==========================================
                MAIN LAYOUT
            ========================================== */}

            <div className="mm-layout">


                {/* ======================================
                    LEFT - INTERACTIVE BODY
                ====================================== */}

                <section className="mm-panel">

                    <div className="mm-panel-heading">

                        <h2>
                            Select Muscle Group
                        </h2>

                        <p>
                            Choose front or back view,
                            then tap a highlighted region.
                        </p>

                    </div>


                    {/* FRONT / BACK BUTTONS */}

                    <div
                        className="mm-view-switch"
                        aria-label="Body view"
                    >

                        <button
                            type="button"

                            className={
                                bodyView === 'front'
                                    ? 'active'
                                    : ''
                            }

                            aria-pressed={
                                bodyView === 'front'
                            }

                            onClick={() =>
                                changeView('front')
                            }
                        >
                            Front Body
                        </button>


                        <button
                            type="button"

                            className={
                                bodyView === 'back'
                                    ? 'active'
                                    : ''
                            }

                            aria-pressed={
                                bodyView === 'back'
                            }

                            onClick={() =>
                                changeView('back')
                            }
                        >
                            Back Body
                        </button>

                    </div>


                    {/* HUMAN BODY DIAGRAM */}

                    <div className="mm-figure-stage">

                        <MuscleBody
                            view={bodyView}
                            selectedMuscle={selectedMuscle}
                            onSelect={setSelectedMuscle}
                        />


                        <div className="mm-figure-hint">

                            <span className="mm-hint-dot" />

                            Tap a muscle to select it

                        </div>

                    </div>


                    {/* MUSCLE SELECTION BUTTONS */}

                    <div className="mm-group-label">
                        Or select a muscle by name
                    </div>


                    <div className="mm-muscle-buttons">

                        {MUSCLE_AREAS[bodyView].map(group => (

                            <button
                                key={group.id}
                                type="button"

                                className={
                                    selectedMuscle === group.id
                                        ? 'active'
                                        : ''
                                }

                                aria-pressed={
                                    selectedMuscle === group.id
                                }

                                onClick={() =>
                                    setSelectedMuscle(group.id)
                                }
                            >

                                {MUSCLE_INFO[group.id].label}

                            </button>

                        ))}

                    </div>

                </section>


                {/* ======================================
                    RIGHT - EXPLORE TUTORIALS
                ====================================== */}

                <section
                    className="mm-panel mm-result-panel"
                    aria-live="polite"
                >

                    <div className="mm-panel-heading">

                        <h2>
                            Explore Muscle Map
                        </h2>

                        <p>
                            Exercise videos, photos and
                            instructions from coaches.
                        </p>

                    </div>


                    {/* ==================================
                        MUSCLE SELECTED
                    ================================== */}

                    {selectedInfo ? (

                        <div className="mm-selected-content">


                            {/* SELECTED MUSCLE HEADING */}

                            <div className="mm-selected-heading">

                                <div>

                                    <span className="mm-eyebrow">
                                        SELECTED MUSCLE
                                    </span>

                                    <h3>
                                        {selectedInfo.label}
                                    </h3>

                                    <p>
                                        {selectedInfo.description}
                                    </p>

                                </div>


                                <button
                                    type="button"
                                    className="mm-clear-button"

                                    onClick={() =>
                                        setSelectedMuscle(null)
                                    }
                                >
                                    Clear
                                </button>

                            </div>


                            <h4>
                                Coach Training Tutorials
                            </h4>


                            {/* VIEW MUSCLE TUTORIALS */}

                            <div className="mm-no-tutorials">

                                <div className="mm-empty-symbol">
                                    ▶
                                </div>

                                <strong>
                                    Explore {selectedInfo.label} Tutorials
                                </strong>

                                <p>
                                    Browse videos, exercise pictures
                                    and step-by-step instructions
                                    uploaded by WellSmartBook coaches.
                                </p>


                                <button
                                    type="button"
                                    className="mm-library-button"

                                    onClick={() =>
                                        openTutorials(selectedMuscle)
                                    }
                                >
                                    View {selectedInfo.label} Tutorials →
                                </button>


                                <p className="mm-library-note">
                                    Opens the full tutorial library
                                    filtered to {selectedInfo.label}.
                                </p>

                            </div>

                        </div>

                    ) : (

                        /* ==================================
                            NO MUSCLE SELECTED
                        ================================== */

                        <div className="mm-empty-selection">

                            <div className="mm-empty-symbol">
                                ⌖
                            </div>

                            <h3>
                                Select a Muscle
                            </h3>

                            <p>
                                Click a muscle on the left
                                to find relevant exercise guides,
                                or browse tutorials for every muscle.
                            </p>


                            <button
                                type="button"
                                className="mm-library-button"

                                onClick={() =>
                                    openTutorials()
                                }
                            >
                                Browse All Tutorials →
                            </button>

                        </div>

                    )}

                </section>

            </div>

        </div>
    );
}


// ======================================================
// ALL CSS INSIDE THIS JSX FILE
// ======================================================

const muscleMapCss = `

/* ======================================================
   MAIN PAGE
====================================================== */

.mm-page {
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    color: #142d50;
    min-width: 0;
}

.mm-page * {
    box-sizing: border-box;
}

/* ======================================================
   PAGE HEADER
====================================================== */

.mm-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    margin-bottom: 25px;
}

.mm-header > div {
    min-width: 0;
}

.mm-header h1 {
    margin: 0 0 8px;
    font-size: 28px;
    color: #102a53;
}

.mm-header p {
    margin: 0;
    font-size: 14px;
    color: #64748b;
    line-height: 1.6;
}

/* HEADER TUTORIAL LIBRARY BUTTON */

.mm-header-library-button {
    border: 1px solid #0759df;
    border-radius: 9px;
    padding: 12px 18px;
    background: #0759df;
    color: white;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    flex-shrink: 0;
}

.mm-header-library-button:hover {
    background: #0048bc;
}

/* ======================================================
   MAIN LAYOUT
====================================================== */

.mm-layout {
    display: grid;
    grid-template-columns:
        minmax(0, 1fr)
        minmax(0, 1fr);
    gap: 22px;
    align-items: start;
}

.mm-panel {
    min-width: 0;
    padding: 24px;
    background: white;
    border: 1px solid #e0e8f2;
    border-radius: 14px;
}

.mm-panel-heading h2 {
    margin: 0 0 6px;
    color: #122c4f;
    font-size: 19px;
}

.mm-panel-heading p {
    margin: 0 0 20px;
    color: #718096;
    font-size: 13px;
    line-height: 1.5;
}

/* ======================================================
   FRONT / BACK SWITCH
====================================================== */

.mm-view-switch {
    display: flex;
    gap: 10px;
    margin-bottom: 17px;
}

.mm-view-switch button {
    flex: 1;
    min-width: 0;
    padding: 12px 8px;
    border: 1px solid #d7e2f0;
    border-radius: 9px;
    color: #315071;
    background: white;
    font-size: 14px;
    cursor: pointer;
}

.mm-view-switch button.active {
    color: white;
    background: #0759df;
    border-color: #0759df;
    font-weight: 650;
}

/* ======================================================
   HUMAN BODY DIAGRAM
====================================================== */

.mm-figure-stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 14px 12px 17px;
    border: 1px solid #e6edf8;
    border-radius: 12px;
    background: #f5f8fe;
}

.mm-body-svg {
    display: block;
    width: min(100%, 320px);
    height: auto;
    max-height: 555px;
}

/* SILHOUETTE */

.mm-silhouette {
    fill: #e7edf5;
    stroke: #abbdd1;
    stroke-width: 2;
}

/* CLICKABLE MUSCLE REGIONS */

.mm-muscle-zone {
    cursor: pointer;
    outline: none;
}

.mm-muscle-zone path {
    fill: #bed0e5;
    stroke: #87a4c7;
    stroke-width: 1.6;
    transition:
        fill .15s ease,
        stroke .15s ease;
}

/* HOVER */

.mm-muscle-zone:hover path,
.mm-muscle-zone:focus-visible path {
    fill: #78aef5;
    stroke: #0759df;
    stroke-width: 2.7;
}

/* SELECTED MUSCLE */

.mm-muscle-zone.selected path {
    fill: #0759df;
    stroke: #003ca7;
    stroke-width: 2.4;
}

/* DETAIL LINES */

.mm-figure-lines {
    fill: none;
    stroke: #eff4fa;
    stroke-width: 2;
    pointer-events: none;
}

/* BODY HINT */

.mm-figure-hint {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #607892;
    font-size: 12px;
}

.mm-hint-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #0759df;
}

/* ======================================================
   MUSCLE NAME BUTTONS
====================================================== */

.mm-group-label {
    margin: 20px 0 10px;
    color: #526581;
    font-size: 13px;
    font-weight: 650;
}

.mm-muscle-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 9px;
}

.mm-muscle-buttons button {
    padding: 9px 12px;
    border: 1px solid #d7e2f0;
    border-radius: 20px;
    color: #315071;
    background: white;
    cursor: pointer;
    font-size: 12px;
}

.mm-muscle-buttons button:hover {
    border-color: #0759df;
}

.mm-muscle-buttons button.active {
    color: white;
    background: #0759df;
    border-color: #0759df;
}

/* ======================================================
   RIGHT PANEL
====================================================== */

.mm-result-panel {
    min-height: 660px;
}

/* EMPTY SELECTION */

.mm-empty-selection,
.mm-no-tutorials {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    border-radius: 12px;
    background: #f5f8fe;
    padding: 30px 22px;
}

.mm-empty-selection {
    min-height: 465px;
}

.mm-empty-symbol {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 65px;
    height: 65px;
    border-radius: 50%;
    background: #e2edff;
    color: #0759df;
    font-size: 32px;
    margin-bottom: 14px;
}

.mm-empty-selection h3 {
    margin: 0 0 8px;
    color: #132c4e;
    font-size: 20px;
}

.mm-empty-selection p,
.mm-no-tutorials p {
    margin: 0;
    max-width: 335px;
    color: #718096;
    font-size: 13px;
    line-height: 1.7;
}

/* ======================================================
   SELECTED MUSCLE INFORMATION
====================================================== */

.mm-selected-heading {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 22px 0;
    border-bottom: 1px solid #e9eef5;
}

.mm-eyebrow {
    font-size: 11px;
    color: #0759df;
    font-weight: 750;
}

.mm-selected-heading h3 {
    margin: 7px 0;
    color: #102a53;
    font-size: 25px;
}

.mm-selected-heading p {
    margin: 0;
    color: #64748b;
    font-size: 13px;
    line-height: 1.6;
}

.mm-clear-button {
    border: 1px solid #d7e2f0;
    border-radius: 8px;
    padding: 8px 12px;
    background: white;
    color: #315071;
    cursor: pointer;
}

.mm-clear-button:hover {
    background: #f2f6fd;
}

.mm-selected-content h4 {
    margin: 24px 0 15px;
    color: #132c4e;
    font-size: 16px;
}

.mm-no-tutorials {
    min-height: 265px;
}

.mm-no-tutorials strong {
    margin-bottom: 9px;
    color: #132c4e;
    font-size: 15px;
}

/* ======================================================
   TUTORIAL LIBRARY BUTTONS
====================================================== */

.mm-library-button {
    margin-top: 22px;
    border: 1px solid #0759df;
    border-radius: 9px;
    padding: 12px 20px;
    background: #0759df;
    color: white;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    max-width: 100%;
}

.mm-library-button:hover {
    background: #0048bc;
}

.mm-no-tutorials .mm-library-note {
    margin-top: 12px;
    color: #718096;
    font-size: 11px;
}

/* ======================================================
   ACCESSIBILITY
====================================================== */

.mm-page button:focus-visible {
    outline: 3px solid #83b4fa;
    outline-offset: 2px;
}

/* ======================================================
   TABLET
====================================================== */

@media (max-width: 900px) {

    .mm-layout {
        grid-template-columns: 1fr;
    }

    .mm-result-panel {
        min-height: 350px;
    }

    .mm-empty-selection {
        min-height: 280px;
    }

}

/* ======================================================
   MOBILE
====================================================== */

@media (max-width: 650px) {

    .mm-header {
        flex-direction: column;
        align-items: stretch;
        gap: 15px;
    }

    .mm-header-library-button {
        width: 100%;
    }

    .mm-library-button {
        width: 100%;
    }

    .mm-header h1 {
        font-size: 23px;
    }

    .mm-panel {
        padding: 15px;
    }

    .mm-body-svg {
        width: min(100%, 275px);
    }

    .mm-view-switch button {
        font-size: 13px;
    }

    .mm-selected-heading h3 {
        font-size: 22px;
    }

    .mm-no-tutorials {
        min-height: 220px;
    }

}

`;
