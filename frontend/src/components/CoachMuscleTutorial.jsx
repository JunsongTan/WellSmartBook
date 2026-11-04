
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ======================================================
// COACH MUSCLE TUTORIALS - CREATE PAGE
// All styling is inside this JSX file.
// ======================================================

const API_BASE_URL = `http://${window.location.hostname}:5000`;
const UPLOADED_PAGE = '/coach/muscle-tutorials/uploads';
const MAX_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/webm'
];

const MUSCLES = [
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

// ======================================================
// FRONT AND BACK MUSCLE REGIONS
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

const EMPTY_FORM = {
    muscleGroup: '',
    title: '',
    description: '',
    instructions: '',
    sets: '',
    reps: ''
};

const muscleLabel = id =>
    MUSCLES.find(([value]) => value === id)?.[1] || id;

// ======================================================
// CLICKABLE BODY MODEL
// ======================================================

function MuscleBody({ view, selected, onSelect }) {
    return (
        <svg
            className="cmt-body"
            viewBox="0 0 300 570"
            role="group"
            aria-label={`${view === 'front' ? 'Front' : 'Back'} body muscle selector`}
        >
            <g className="cmt-silhouette" aria-hidden="true">
                <ellipse cx="150" cy="48" rx="24" ry="30" />
                <path d="M137 72 L163 72 L166 101 L134 101 Z" />
                <path d="M100 107 Q87 113 81 131 L59 221 L49 276 Q47 291 58 294 Q71 296 76 280 L97 205 L113 132 Z" />
                <path d="M200 107 Q213 113 219 131 L241 221 L251 276 Q253 291 242 294 Q229 296 224 280 L203 205 L187 132 Z" />
                <path d="M131 99 Q112 97 101 108 L105 195 L116 251 L184 251 L195 195 L199 108 Q188 97 169 99 Z" />
                <path d="M116 247 Q150 256 184 247 L189 294 L174 325 L126 325 L111 294 Z" />
                <path d="M118 298 L149 300 L144 408 L137 506 L116 507 L107 400 Z" />
                <path d="M182 298 L151 300 L156 408 L163 506 L184 507 L193 400 Z" />
                <path d="M116 499 L136 499 L135 538 Q118 544 104 539 L107 524 Z" />
                <path d="M184 499 L164 499 L165 538 Q182 544 196 539 L193 524 Z" />
            </g>

            {MUSCLE_AREAS[view].map(group => (
                <g
                    key={group.id}
                    className={`cmt-zone ${selected === group.id ? 'selected' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select ${muscleLabel(group.id)}`}
                    aria-pressed={selected === group.id}
                    onClick={() => onSelect(group.id)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelect(group.id);
                        }
                    }}
                >
                    <title>{muscleLabel(group.id)}</title>

                    {group.paths.map((d, i) => (
                        <path key={i} d={d} />
                    ))}
                </g>
            ))}

            <g className="cmt-body-lines" aria-hidden="true">
                <path d="M150 167 L150 245" />
                <path d="M128 200 L144 200 M156 200 L172 200" />
                <path d="M130 221 L144 221 M156 221 L170 221" />
            </g>
        </svg>
    );
}

// ======================================================
// CREATE TUTORIAL PAGE
// ======================================================

export default function CoachMuscleTutorial() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    const [bodyView, setBodyView] = useState('front');
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [tutorials, setTutorials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [listError, setListError] = useState('');
    const [success, setSuccess] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    // ==================================================
    // LOAD TUTORIAL COUNTS FROM MYSQL
    // ==================================================

    useEffect(() => {
        const controller = new AbortController();

        async function loadTutorials() {
            setLoading(true);
            setListError('');

            try {
                const token = localStorage.getItem('token');

                if (!token) {
                    throw new Error('Please log in as a coach.');
                }

                const response = await fetch(
                    `${API_BASE_URL}/api/coach/muscle-tutorials`,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        },
                        signal: controller.signal
                    }
                );

                const data = await response.json();

                if (!response.ok || data.success === false) {
                    throw new Error(
                        data.message || 'Unable to load tutorials.'
                    );
                }

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
                    setListError(
                        err.message || 'Unable to load tutorial counts.'
                    );
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        loadTutorials();

        return () => controller.abort();
    }, [refreshKey]);

    // ==================================================
    // IMAGE / VIDEO PREVIEW
    // ==================================================

    useEffect(() => {
        if (!selectedFile) {
            setPreviewUrl('');
            return;
        }

        const url = URL.createObjectURL(selectedFile);
        setPreviewUrl(url);

        return () => URL.revokeObjectURL(url);
    }, [selectedFile]);

    // ==================================================
    // FORM FUNCTIONS
    // ==================================================

    function updateField(name, value) {
        setForm(previous => ({
            ...previous,
            [name]: value
        }));
    }

    function selectMuscle(id) {
        updateField('muscleGroup', id);

        if (
            !id ||
            MUSCLE_AREAS[bodyView].some(m => m.id === id)
        ) {
            return;
        }

        setBodyView(
            MUSCLE_AREAS.front.some(m => m.id === id)
                ? 'front'
                : 'back'
        );
    }

    function changeBodyView(view) {
        setBodyView(view);

        if (
            !MUSCLE_AREAS[view].some(
                m => m.id === form.muscleGroup
            )
        ) {
            updateField('muscleGroup', '');
        }
    }

    function removeFile() {
        setSelectedFile(null);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    function chooseFile(event) {
        const file = event.target.files?.[0];

        setError('');
        setSuccess('');

        if (!file) {
            setSelectedFile(null);
            return;
        }

        if (!ALLOWED_TYPES.includes(file.type)) {
            setError(
                'Only JPG, PNG, WEBP, MP4 and WEBM files are supported.'
            );
            removeFile();
            return;
        }

        if (file.size > MAX_SIZE) {
            setError('Maximum upload size is 50 MB.');
            removeFile();
            return;
        }

        setSelectedFile(file);
    }

    // ==================================================
    // PUBLISH EXERCISE TUTORIAL
    // ==================================================

    async function publishTutorial(event) {
        event.preventDefault();

        if (uploading) return;

        setError('');
        setSuccess('');

        if (!form.muscleGroup) {
            return setError('Please select a muscle group.');
        }

        if (!form.title.trim()) {
            return setError('Please enter an exercise title.');
        }

        if (!form.instructions.trim()) {
            return setError('Please enter exercise instructions.');
        }

        if (!selectedFile) {
            return setError('Please upload an image or video.');
        }

        if (
            !ALLOWED_TYPES.includes(selectedFile.type) ||
            selectedFile.size > MAX_SIZE
        ) {
            return setError(
                'Choose a supported media file under 50 MB.'
            );
        }

        const token = localStorage.getItem('token');

        if (!token) {
            return setError('Please log in again.');
        }

        const payload = new FormData();

        for (const key of [
            'muscleGroup',
            'title',
            'description',
            'instructions',
            'sets',
            'reps'
        ]) {
            payload.append(
                key,
                String(form[key] ?? '').trim()
            );
        }

        payload.append('media', selectedFile);

        setUploading(true);

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/coach/muscle-tutorials`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    body: payload
                }
            );

            const data = await response.json();

            if (!response.ok || data.success === false) {
                throw new Error(
                    data.message || 'Unable to publish tutorial.'
                );
            }

            setSuccess(
                'Tutorial published successfully! Open Uploaded Tutorials to view or edit it.'
            );

            setForm({ ...EMPTY_FORM });
            setBodyView('front');
            removeFile();

            setRefreshKey(n => n + 1);
        } catch (err) {
            setError(
                err.message || 'Unable to publish tutorial.'
            );
        } finally {
            setUploading(false);
        }
    }

    // ==================================================
    // TUTORIAL STATISTICS
    // ==================================================

    const publishedCount = tutorials.filter(
        t => t.status === 'published'
    ).length;

    const videoCount = tutorials.filter(
        t => t.mediaType === 'video'
    ).length;

    // ==================================================
    // PAGE INTERFACE
    // ==================================================

    return (
        <main className="cmt-page">
            <style>{coachMuscleCss}</style>

            {/* PAGE HEADER */}

            <header className="cmt-page-header">
                <div>
                    <span className="cmt-overline">
                        COACH TRAINING CONTENT
                    </span>

                    <h1>Muscle Training Tutorials</h1>

                    <p>
                        Create tutorials with exercise videos,
                        pictures and step-by-step instructions.
                    </p>
                </div>

                <button
                    type="button"
                    className="cmt-outline"
                    onClick={() => setRefreshKey(n => n + 1)}
                    disabled={loading}
                >
                    ↻ Refresh
                </button>
            </header>

            {/* SUMMARY CARDS */}

            <div className="cmt-stats">
                <div className="cmt-stat">
                    <span>Total Tutorials</span>
                    <strong>
                        {loading ? '...' : tutorials.length}
                    </strong>
                    <small>Exercise tutorials created</small>
                </div>

                <div className="cmt-stat cmt-stat-green">
                    <span>Published Tutorials</span>
                    <strong>
                        {loading ? '...' : publishedCount}
                    </strong>
                    <small>Available to users</small>
                </div>

                <div className="cmt-stat">
                    <span>Video Tutorials</span>
                    <strong>
                        {loading ? '...' : videoCount}
                    </strong>
                    <small>Uploaded exercise videos</small>
                </div>
            </div>

            {listError && (
                <div
                    className="cmt-alert cmt-error"
                    role="alert"
                >
                    Unable to update tutorial totals: {listError}
                </div>
            )}

            {/* FULL-WIDTH CREATE TUTORIAL CARD */}

            <section className="cmt-main-card">

                {/* PAGE NAVIGATION */}

                <div className="cmt-page-tabs">
                    <button
                        type="button"
                        className="active"
                        aria-current="page"
                    >
                        ＋ Create Tutorial
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate(UPLOADED_PAGE)}
                    >
                        ▣ Uploaded Tutorials
                    </button>
                </div>

                <div className="cmt-card-head">
                    <div>
                        <h2>Create Tutorial</h2>

                        <p>
                            Select a muscle, enter the exercise details,
                            then upload an image or video.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="cmt-outline"
                        onClick={() => navigate(UPLOADED_PAGE)}
                    >
                        View Uploaded Tutorials →
                    </button>
                </div>

                {/* ERROR AND SUCCESS MESSAGES */}

                {error && (
                    <div
                        className="cmt-alert cmt-error"
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                {success && (
                    <div
                        className="cmt-alert cmt-success"
                        role="status"
                    >
                        {success}

                        <button
                            type="button"
                            onClick={() => navigate(UPLOADED_PAGE)}
                        >
                            View Tutorials →
                        </button>
                    </div>
                )}

                <form
                    className="cmt-form-grid"
                    onSubmit={publishTutorial}
                >
                    {/* ==================================
                        LEFT: INTERACTIVE MUSCLE MAP
                    ================================== */}

                    <div className="cmt-subpanel">
                        <h3>1. Select Muscle Group</h3>

                        <p className="cmt-helper">
                            Click a muscle on the diagram or
                            use the dropdown below.
                        </p>

                        {/* FRONT / BACK VIEW */}

                        <div className="cmt-view-switch">
                            <button
                                type="button"
                                className={
                                    bodyView === 'front'
                                        ? 'active'
                                        : ''
                                }
                                aria-pressed={bodyView === 'front'}
                                onClick={() => changeBodyView('front')}
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
                                aria-pressed={bodyView === 'back'}
                                onClick={() => changeBodyView('back')}
                            >
                                Back Body
                            </button>
                        </div>

                        {/* CLICKABLE BODY DIAGRAM */}

                        <div className="cmt-map-stage">
                            <MuscleBody
                                view={bodyView}
                                selected={form.muscleGroup}
                                onSelect={selectMuscle}
                            />

                            <span className="cmt-map-hint">
                                ● Tap a muscle to select it
                            </span>
                        </div>

                        {/* MUSCLE DROPDOWN */}

                        <label className="cmt-field">
                            <span>Muscle Group *</span>

                            <select
                                required
                                value={form.muscleGroup}
                                onChange={e =>
                                    selectMuscle(e.target.value)
                                }
                            >
                                <option value="">
                                    Select a muscle group
                                </option>

                                {MUSCLES.map(([id, name]) => (
                                    <option key={id} value={id}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        {/* SELECTED MUSCLE */}

                        <div className="cmt-selected">
                            <span>Selected Muscle</span>

                            <strong>
                                {form.muscleGroup
                                    ? `✓ ${muscleLabel(form.muscleGroup)}`
                                    : 'None selected'}
                            </strong>
                        </div>
                    </div>

                    {/* ==================================
                        RIGHT: EXERCISE INFORMATION
                    ================================== */}

                    <div className="cmt-subpanel cmt-details">

                        <h3>2. Exercise Information</h3>

                        {/* EXERCISE TITLE */}

                        <label className="cmt-field">
                            <span>Exercise Title *</span>

                            <input
                                required
                                maxLength={200}
                                placeholder="e.g. Barbell Bench Press"
                                value={form.title}
                                onChange={e =>
                                    updateField('title', e.target.value)
                                }
                            />
                        </label>

                        {/* DESCRIPTION */}

                        <label className="cmt-field">
                            <span>Description</span>

                            <textarea
                                rows={3}
                                maxLength={2000}
                                placeholder="Describe the exercise and its benefits..."
                                value={form.description}
                                onChange={e =>
                                    updateField('description', e.target.value)
                                }
                            />
                        </label>

                        {/* INSTRUCTIONS */}

                        <label className="cmt-field">
                            <span>Step-by-Step Instructions *</span>

                            <textarea
                                required
                                rows={6}
                                maxLength={10000}
                                placeholder={
                                    'Step 1: Get into the starting position.\n' +
                                    'Step 2: Perform the movement slowly.\n' +
                                    'Step 3: Return to the starting position.'
                                }
                                value={form.instructions}
                                onChange={e =>
                                    updateField('instructions', e.target.value)
                                }
                            />

                            <small>
                                Put each training step on a new line.
                            </small>
                        </label>

                        {/* SETS AND REPETITIONS */}

                        <div className="cmt-two-fields">
                            <label className="cmt-field">
                                <span>Recommended Sets</span>

                                <input
                                    type="number"
                                    min="1"
                                    max="50"
                                    placeholder="e.g. 3"
                                    value={form.sets}
                                    onChange={e =>
                                        updateField('sets', e.target.value)
                                    }
                                />
                            </label>

                            <label className="cmt-field">
                                <span>Repetitions</span>

                                <input
                                    maxLength={50}
                                    placeholder="e.g. 8-12"
                                    value={form.reps}
                                    onChange={e =>
                                        updateField('reps', e.target.value)
                                    }
                                />
                            </label>
                        </div>

                        {/* ==================================
                            IMAGE / VIDEO UPLOAD
                        ================================== */}

                        <h3 className="cmt-upload-title">
                            3. Upload Exercise Video or Picture *
                        </h3>

                        <div className="cmt-upload-area">
                            <span className="cmt-upload-icon">↑</span>

                            <strong>Select an image or video</strong>

                            <small>
                                JPG, PNG, WEBP, MP4 or WEBM · Maximum 50 MB
                            </small>

                            <input
                                ref={fileInputRef}
                                type="file"
                                required
                                accept=".jpg,.jpeg,.png,.webp,.mp4,.webm"
                                onChange={chooseFile}
                            />
                        </div>

                        {/* FILE PREVIEW */}

                        {selectedFile && previewUrl && (
                            <div className="cmt-preview">

                                <div className="cmt-preview-heading">
                                    <strong>
                                        Preview: {selectedFile.name}
                                    </strong>

                                    <button
                                        type="button"
                                        onClick={removeFile}
                                    >
                                        Remove
                                    </button>
                                </div>

                                {selectedFile.type.startsWith('image/')
                                    ? (
                                        <img
                                            src={previewUrl}
                                            alt="Selected training exercise"
                                        />
                                    )
                                    : (
                                        <video
                                            src={previewUrl}
                                            controls
                                            playsInline
                                            preload="metadata"
                                        />
                                    )}
                            </div>
                        )}

                        {/* PUBLISH */}

                        <button
                            type="submit"
                            className="cmt-publish"
                            disabled={uploading}
                        >
                            {uploading
                                ? 'Uploading Tutorial...'
                                : 'Publish Tutorial'}
                        </button>

                        <p className="cmt-footnote">
                            Published tutorials will appear in
                            the user Exercise Tutorial Library.
                        </p>
                    </div>
                </form>
            </section>
        </main>
    );
}

// ======================================================
// ALL CSS INSIDE COACHMUSCLETUTORIAL.JSX
// ======================================================

const coachMuscleCss = `

.cmt-page {
    width: 100%;
    max-width: 1500px;
    margin: 0 auto;
    color: #152d50;
}

.cmt-page * {
    box-sizing: border-box;
}

/* PAGE HEADER */

.cmt-page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    margin-bottom: 24px;
}

.cmt-overline {
    color: #0759df;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1px;
}

.cmt-page-header h1 {
    margin: 7px 0 8px;
    font-size: 28px;
    color: #102a53;
}

.cmt-page-header p {
    margin: 0;
    color: #718096;
    font-size: 13px;
    line-height: 1.6;
}

/* STATISTICS */

.cmt-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 24px;
}

.cmt-stat {
    display: flex;
    flex-direction: column;
    gap: 11px;
    padding: 22px;
    border: 1px solid #dce6ff;
    border-radius: 12px;
    background: #edf3ff;
}

.cmt-stat span {
    color: #526581;
    font-size: 13px;
}

.cmt-stat strong {
    font-size: 30px;
    color: #0759df;
}

.cmt-stat small {
    color: #718096;
    font-size: 12px;
}

.cmt-stat-green {
    background: #e9f9f1;
    border-color: #d0ecdf;
}

.cmt-stat-green strong {
    color: #098047;
}

/* MAIN CARD */

.cmt-main-card {
    background: #fff;
    border: 1px solid #e0e8f2;
    border-radius: 14px;
    padding: 23px;
    min-width: 0;
}

/* CREATE / UPLOADED NAVIGATION */

.cmt-page-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 24px;
}

.cmt-page-tabs button {
    padding: 12px 19px;
    border: 1px solid #d7e2f0;
    border-radius: 9px;
    background: #fff;
    color: #315071;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
}

.cmt-page-tabs button.active {
    background: #0759df;
    border-color: #0759df;
    color: #fff;
    cursor: default;
}

.cmt-card-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 23px;
}

.cmt-card-head h2 {
    margin: 0 0 7px;
    color: #102a53;
    font-size: 22px;
}

.cmt-card-head p {
    margin: 0;
    color: #718096;
    font-size: 13px;
    line-height: 1.6;
}

.cmt-outline {
    padding: 11px 16px;
    background: #fff;
    color: #0759df;
    border: 1px solid #b7cdf2;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
}

.cmt-outline:hover {
    background: #f0f6ff;
}

/* FORM LAYOUT */

.cmt-form-grid {
    display: grid;
    grid-template-columns: minmax(0,0.9fr) minmax(0,1.1fr);
    gap: 18px;
    align-items: start;
}

.cmt-subpanel {
    min-width: 0;
    padding: 20px;
    background: #f8faff;
    border: 1px solid #e0e8f2;
    border-radius: 12px;
}

.cmt-details {
    background: #fff;
}

.cmt-subpanel h3 {
    margin: 0 0 15px;
    color: #102a53;
    font-size: 16px;
}

.cmt-subpanel .cmt-helper {
    margin: -5px 0 15px;
    color: #718096;
    font-size: 12px;
    line-height: 1.6;
}

/* FRONT / BACK SWITCH */

.cmt-view-switch {
    display: flex;
    gap: 10px;
    margin-bottom: 13px;
}

.cmt-view-switch button {
    flex: 1;
    min-width: 0;
    padding: 12px 8px;
    background: #fff;
    color: #315071;
    border: 1px solid #d7e2f0;
    border-radius: 9px;
    font-weight: 650;
    cursor: pointer;
}

.cmt-view-switch button.active {
    color: #fff;
    background: #0759df;
    border-color: #0759df;
}

/* INTERACTIVE BODY */

.cmt-map-stage {
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    padding: 12px;
    background: #f1f6fd;
    border: 1px solid #e0e8f2;
    border-radius: 11px;
    margin-bottom: 17px;
}

.cmt-body {
    display: block;
    width: min(100%,270px);
    height: auto;
    max-height: 520px;
}

.cmt-silhouette {
    fill: #e7edf5;
    stroke: #abbdd1;
    stroke-width: 2;
}

.cmt-zone {
    cursor: pointer;
    outline: none;
}

.cmt-zone path {
    fill: #bed0e5;
    stroke: #87a4c7;
    stroke-width: 1.6;
    transition: fill .15s, stroke .15s;
}

.cmt-zone:hover path,
.cmt-zone:focus-visible path {
    fill: #78aef5;
    stroke: #0759df;
    stroke-width: 2.7;
}

.cmt-zone.selected path {
    fill: #0759df;
    stroke: #003ca7;
    stroke-width: 2.4;
}

.cmt-body-lines {
    fill: none;
    stroke: #eff4fa;
    stroke-width: 2;
    pointer-events: none;
}

.cmt-map-hint {
    color: #607892;
    font-size: 12px;
    margin-top: 4px;
}

.cmt-selected {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 13px;
    padding: 12px 14px;
    background: #eaf2ff;
    border-radius: 8px;
}

.cmt-selected span {
    font-size: 12px;
    color: #526581;
}

.cmt-selected strong {
    color: #0759df;
    font-size: 13px;
}

/* FORM FIELDS */

.cmt-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
    font-size: 13px;
    font-weight: 700;
    color: #233b58;
}

.cmt-field input,
.cmt-field select,
.cmt-field textarea {
    display: block;
    width: 100%;
    min-width: 0;
    padding: 12px;
    border: 1px solid #d7e2f0;
    border-radius: 9px;
    background: #fff;
    color: #172b4d;
    font: inherit;
    font-size: 13px;
    outline: none;
}

.cmt-field textarea {
    resize: vertical;
    line-height: 1.7;
}

.cmt-field small {
    color: #718096;
    font-size: 11px;
    font-weight: 400;
}

.cmt-field input:focus,
.cmt-field select:focus,
.cmt-field textarea:focus {
    border-color: #0759df;
    box-shadow: 0 0 0 3px rgba(7,89,223,.1);
}

.cmt-two-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

/* MEDIA UPLOAD */

.cmt-upload-title {
    margin-top: 9px!important;
}

.cmt-upload-area {
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 10px;
    padding: 21px;
    background: #f5f8ff;
    border: 2px dashed #b9cdea;
    border-radius: 12px;
    text-align: center;
}

.cmt-upload-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: #dceaff;
    color: #0759df;
    font-size: 28px;
}

.cmt-upload-area strong {
    font-size: 13px;
}

.cmt-upload-area small {
    font-size: 11px;
    color: #718096;
}

.cmt-upload-area input[type=file] {
    max-width: 100%;
    font-size: 12px;
}

/* FILE PREVIEW */

.cmt-preview {
    padding: 13px;
    margin-top: 12px;
    background: #f8faff;
    border: 1px solid #d7e2f0;
    border-radius: 10px;
}

.cmt-preview-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
}

.cmt-preview-heading strong {
    font-size: 12px;
    overflow-wrap: anywhere;
}

.cmt-preview-heading button {
    border: 0;
    background: transparent;
    color: #b42318;
    cursor: pointer;
}

.cmt-preview img,
.cmt-preview video {
    width: 100%;
    max-height: 290px;
    object-fit: contain;
    border-radius: 8px;
    background: #edf3fa;
}

/* PUBLISH BUTTON */

.cmt-publish {
    display: block;
    width: 100%;
    margin-top: 17px;
    padding: 14px;
    border: 0;
    border-radius: 9px;
    background: #0759df;
    color: #fff;
    font-size: 14px;
    font-weight: 750;
    cursor: pointer;
}

.cmt-publish:hover {
    background: #0048bc;
}

.cmt-publish:disabled {
    opacity: .55;
    cursor: wait;
}

.cmt-footnote {
    text-align: center;
    color: #718096;
    font-size: 11px;
    line-height: 1.5;
}

/* MESSAGES */

.cmt-alert {
    padding: 13px 15px;
    border-radius: 9px;
    margin-bottom: 18px;
    font-size: 13px;
    line-height: 1.6;
}

.cmt-error {
    background: #fff0f0;
    color: #a72525;
    border: 1px solid #f1c7c7;
}

.cmt-success {
    background: #e5f8ef;
    color: #087645;
    border: 1px solid #b8e9ce;
}

.cmt-success button {
    margin-left: 8px;
    color: #0759df;
    background: transparent;
    border: 0;
    font-weight: 700;
    cursor: pointer;
}

.cmt-page button:focus-visible {
    outline: 3px solid #83b4fa;
    outline-offset: 2px;
}

/* TABLET */

@media (max-width: 1050px) {
    .cmt-form-grid {
        grid-template-columns: 1fr;
    }

    .cmt-body {
        width: min(100%,300px);
    }
}

/* MOBILE */

@media (max-width: 650px) {
    .cmt-page-header,
    .cmt-card-head {
        flex-direction: column;
        align-items: stretch;
    }

    .cmt-page-header h1 {
        font-size: 23px;
    }

    .cmt-stats {
        grid-template-columns: 1fr;
        gap: 10px;
    }

    .cmt-stat {
        padding: 16px;
        gap: 8px;
    }

    .cmt-stat strong {
        font-size: 26px;
    }

    .cmt-main-card {
        padding: 13px;
    }

    .cmt-page-tabs {
        display: grid;
        grid-template-columns: 1fr 1fr;
    }

    .cmt-page-tabs button {
        padding: 11px 6px;
        font-size: 12px;
    }

    .cmt-subpanel {
        padding: 13px;
    }

    .cmt-two-fields {
        grid-template-columns: 1fr;
        gap: 0;
    }

    .cmt-body {
        width: min(100%,250px);
    }

    .cmt-outline {
        white-space: normal;
    }
}

`;
