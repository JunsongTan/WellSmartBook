
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = `http://${window.location.hostname}:5000`;

// ======================================================
// MUSCLE GROUPS
// ======================================================

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

const muscleName = id =>
    MUSCLES.find(item => item[0] === id)?.[1] || id;

// ======================================================
// MEDIA HELPERS
// ======================================================

function mediaSource(path) {

    if (
        !/^\/api\/muscle-tutorial-media\/[a-f0-9-]{36}\.(jpg|png|webp|mp4|webm)$/i.test(
            String(path || '')
        )
    ) {
        return '';
    }

    return API_BASE_URL + path;
}

function Media({ tutorial, className = '' }) {

    const src = mediaSource(tutorial.mediaUrl);

    if (!src) {
        return (
            <div className="cut-media-missing">
                Media unavailable
            </div>
        );
    }

    if (tutorial.mediaType === 'video') {
        return (
            <video
                className={className}
                src={src}
                controls
                playsInline
                preload="metadata"
            />
        );
    }

    return (
        <img
            className={className}
            src={src}
            alt={tutorial.title}
            loading="lazy"
        />
    );
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function CoachUploadedTutorials() {

    const navigate = useNavigate();

    const [tutorials, setTutorials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    const [search, setSearch] = useState('');
    const [muscle, setMuscle] = useState('all');

    const [editing, setEditing] = useState(null);
    const [editFile, setEditFile] = useState(null);
    const [editPreview, setEditPreview] = useState('');
    const [editError, setEditError] = useState('');
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    // ==================================================
    // LOAD COACH TUTORIALS
    // ==================================================

    useEffect(() => {

        const controller = new AbortController();

        async function load() {

            setLoading(true);
            setError('');

            try {

                const token = localStorage.getItem('token');

                if (!token) {
                    throw new Error(
                        'Please log in as a coach.'
                    );
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
                    setError(err.message);
                }

            } finally {

                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        }

        load();

        return () => controller.abort();

    }, [refreshKey]);

    // ==================================================
    // NEW MEDIA PREVIEW FOR EDITING
    // ==================================================

    useEffect(() => {

        if (!editFile) {
            setEditPreview('');
            return;
        }

        const url = URL.createObjectURL(editFile);
        setEditPreview(url);

        return () => URL.revokeObjectURL(url);

    }, [editFile]);

    // ==================================================
    // SEARCH AND FILTER
    // ==================================================

    const filtered = useMemo(() => {

        return tutorials.filter(t => {

            const matchesMuscle =
                muscle === 'all' ||
                t.muscleGroup === muscle;

            const matchesSearch =
                String(t.title || '')
                    .toLowerCase()
                    .includes(search.trim().toLowerCase());

            return matchesMuscle && matchesSearch;

        });

    }, [tutorials, search, muscle]);

    // ==================================================
    // OPEN EDIT FORM
    // ==================================================

    function startEdit(t) {

        setEditing({
            tutorialId: t.tutorialId,
            muscleGroup: t.muscleGroup,
            title: t.title || '',
            description: t.description || '',
            instructions: t.instructions || '',
            sets: t.sets ?? '',
            reps: t.reps || '',
            mediaUrl: t.mediaUrl,
            mediaType: t.mediaType
        });

        setEditFile(null);
        setEditError('');
    }

    function updateEdit(field, value) {

        setEditing(prev => ({
            ...prev,
            [field]: value
        }));
    }

    function closeEdit() {

        if (saving) return;

        setEditing(null);
        setEditFile(null);
        setEditError('');
    }

    // ==================================================
    // SAVE EDITED TUTORIAL
    // ==================================================

    async function saveEdit(event) {

        event.preventDefault();

        if (!editing || saving) return;

        setSaving(true);
        setEditError('');

        try {

            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Please log in again.');
            }

            if (
                editFile &&
                (
                    editFile.size > 50 * 1024 * 1024 ||
                    ![
                        'image/jpeg',
                        'image/png',
                        'image/webp',
                        'video/mp4',
                        'video/webm'
                    ].includes(editFile.type)
                )
            ) {
                throw new Error(
                    'Choose JPG, PNG, WEBP, MP4 or WEBM, up to 50 MB.'
                );
            }

            // ==========================================
            // PREPARE FORM DATA
            // ==========================================

            const formData = new FormData();

            for (const key of [
                'muscleGroup',
                'title',
                'description',
                'instructions',
                'sets',
                'reps'
            ]) {
                formData.append(
                    key,
                    String(editing[key] ?? '').trim()
                );
            }

            if (editFile) {
                formData.append('media', editFile);
            }

            // ==========================================
            // SEND UPDATE REQUEST
            // ==========================================

            const response = await fetch(
                `${API_BASE_URL}/api/coach/muscle-tutorials/${editing.tutorialId}`,
                {
                    method: 'PUT',
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    body: formData
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || 'Unable to save changes.'
                );
            }

            setEditing(null);
            setEditFile(null);

            setNotice('Tutorial updated successfully.');

            setRefreshKey(x => x + 1);

        } catch (err) {

            setEditError(
                err.message || 'Unable to update tutorial.'
            );

        } finally {

            setSaving(false);
        }
    }

    // ==================================================
    // DELETE TUTORIAL
    // ==================================================

    async function deleteTutorial(t) {

        if (deletingId !== null || saving) return;

        const confirmed = window.confirm(
            `Permanently delete "${t.title}"?\n\n` +
            `The media file and users' saved references ` +
            `will also be removed. This cannot be undone.`
        );

        if (!confirmed) return;

        setDeletingId(t.tutorialId);
        setError('');
        setNotice('');

        try {

            const token = localStorage.getItem('token');

            if (!token) {
                throw new Error('Please log in again.');
            }

            const response = await fetch(
                `${API_BASE_URL}/api/coach/muscle-tutorials/${t.tutorialId}`,
                {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || 'Unable to delete tutorial.'
                );
            }

            setNotice('Tutorial deleted successfully.');

            setRefreshKey(x => x + 1);

        } catch (err) {

            setError(
                err.message || 'Unable to delete tutorial.'
            );

        } finally {

            setDeletingId(null);
        }
    }

    // ==================================================
    // RENDER
    // ==================================================

    return (

        <div className="cut-page">

            <style>{css}</style>

            {/* ==========================================
                HEADER
            ========================================== */}

            <header className="cut-header">

                <div>
                    <h1>Uploaded Tutorials</h1>
                    <p>
                        Search, edit and manage your
                        coaching exercise content.
                    </p>
                </div>

                <div className="cut-header-actions">

                    <button
                        className="cut-outline"
                        type="button"
                        onClick={() =>
                            setRefreshKey(x => x + 1)
                        }
                    >
                        ↻ Refresh
                    </button>

                    <button
                        className="cut-primary"
                        type="button"
                        onClick={() =>
                            navigate('/coach/muscle-tutorials')
                        }
                    >
                        + Create Tutorial
                    </button>

                </div>

            </header>

            {/* ==========================================
                MESSAGES
            ========================================== */}

            {notice && (
                <div className="cut-success" role="status">
                    {notice}
                </div>
            )}

            {error && (
                <div className="cut-error" role="alert">
                    {error}
                </div>
            )}

            {/* ==========================================
                SEARCH AND MUSCLE FILTER
            ========================================== */}

            <div className="cut-filters">

                <label className="cut-filter-field">

                    <span>Search exercise title</span>

                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search exercise title..."
                    />

                </label>

                <label className="cut-filter-field">

                    <span>Muscle group</span>

                    <select
                        value={muscle}
                        onChange={e => setMuscle(e.target.value)}
                    >

                        <option value="all">
                            All Muscle Groups
                        </option>

                        {MUSCLES.map(([value, name]) => (
                            <option key={value} value={value}>
                                {name}
                            </option>
                        ))}

                    </select>

                </label>

                <div className="cut-count">
                    {loading
                        ? 'Loading...'
                        : `${filtered.length} of ${tutorials.length} tutorials`}
                </div>

            </div>

            {/* ==========================================
                TUTORIALS
            ========================================== */}

            {loading ? (

                <div className="cut-empty">
                    Loading your tutorials...
                </div>

            ) : !filtered.length ? (

                <div className="cut-empty">

                    <h2>
                        {tutorials.length
                            ? 'No matching tutorials'
                            : 'No tutorials uploaded yet'}
                    </h2>

                    <p>
                        {tutorials.length
                            ? 'Try a different search or muscle group.'
                            : 'Publish your first exercise tutorial to see it here.'}
                    </p>

                    {!tutorials.length && (

                        <button
                            type="button"
                            className="cut-primary"
                            onClick={() =>
                                navigate('/coach/muscle-tutorials')
                            }
                        >
                            Create Tutorial
                        </button>

                    )}

                </div>

            ) : (

                <div className="cut-grid">

                    {filtered.map(t => (

                        <article
                            key={t.tutorialId}
                            className="cut-card"
                        >

                            <div className="cut-media">
                                <Media tutorial={t} />
                            </div>

                            <div className="cut-card-body">

                                <div className="cut-card-top">

                                    <span className="cut-muscle-tag">
                                        {muscleName(t.muscleGroup)}
                                    </span>

                                    <span className="cut-status">
                                        {t.status}
                                    </span>

                                </div>

                                <h2>{t.title}</h2>

                                {t.description && (
                                    <p className="cut-description">
                                        {t.description}
                                    </p>
                                )}

                                <p className="cut-steps">
                                    {t.instructions}
                                </p>

                                <div className="cut-meta">

                                    {t.sets && (
                                        <span>{t.sets} sets</span>
                                    )}

                                    {t.reps && (
                                        <span>{t.reps} reps</span>
                                    )}

                                </div>

                                <div className="cut-card-actions">

                                    <button
                                        type="button"
                                        className="cut-outline"
                                        disabled={deletingId !== null}
                                        onClick={() => startEdit(t)}
                                    >
                                        ✎ Edit
                                    </button>

                                    <button
                                        type="button"
                                        className="cut-delete"
                                        disabled={deletingId !== null}
                                        onClick={() => deleteTutorial(t)}
                                    >
                                        {deletingId === t.tutorialId
                                            ? 'Deleting...'
                                            : 'Delete'}
                                    </button>

                                </div>

                            </div>

                        </article>

                    ))}

                </div>

            )}

            {/* ==========================================
                EDIT MODAL
            ========================================== */}

            {editing && (

                <div
                    className="cut-modal-backdrop"
                    role="presentation"
                >

                    <section
                        className="cut-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="cut-edit-heading"
                    >

                        <div className="cut-modal-header">

                            <h2 id="cut-edit-heading">
                                Edit Tutorial
                            </h2>

                            <button
                                type="button"
                                className="cut-outline"
                                onClick={closeEdit}
                                disabled={saving}
                            >
                                Close
                            </button>

                        </div>

                        <form
                            onSubmit={saveEdit}
                            className="cut-edit-form"
                        >

                            {editError && (
                                <div
                                    className="cut-error"
                                    role="alert"
                                >
                                    {editError}
                                </div>
                            )}

                            <label>
                                Muscle Group *

                                <select
                                    required
                                    value={editing.muscleGroup}
                                    onChange={e =>
                                        updateEdit(
                                            'muscleGroup',
                                            e.target.value
                                        )
                                    }
                                >

                                    {MUSCLES.map(([value, name]) => (
                                        <option
                                            key={value}
                                            value={value}
                                        >
                                            {name}
                                        </option>
                                    ))}

                                </select>

                            </label>

                            <label>
                                Exercise Title *

                                <input
                                    required
                                    maxLength={200}
                                    value={editing.title}
                                    onChange={e =>
                                        updateEdit(
                                            'title',
                                            e.target.value
                                        )
                                    }
                                />
                            </label>

                            <label>
                                Description

                                <textarea
                                    rows={3}
                                    maxLength={2000}
                                    value={editing.description}
                                    onChange={e =>
                                        updateEdit(
                                            'description',
                                            e.target.value
                                        )
                                    }
                                />
                            </label>

                            <label>
                                Step-by-Step Instructions *

                                <textarea
                                    required
                                    rows={6}
                                    maxLength={10000}
                                    value={editing.instructions}
                                    onChange={e =>
                                        updateEdit(
                                            'instructions',
                                            e.target.value
                                        )
                                    }
                                />
                            </label>

                            <div className="cut-edit-two">

                                <label>
                                    Sets

                                    <input
                                        type="number"
                                        min={1}
                                        max={50}
                                        value={editing.sets}
                                        onChange={e =>
                                            updateEdit(
                                                'sets',
                                                e.target.value
                                            )
                                        }
                                    />
                                </label>

                                <label>
                                    Reps

                                    <input
                                        maxLength={50}
                                        value={editing.reps}
                                        onChange={e =>
                                            updateEdit(
                                                'reps',
                                                e.target.value
                                            )
                                        }
                                    />
                                </label>

                            </div>

                            <label>
                                Replace Picture / Video (optional)

                                <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.webp,.mp4,.webm"
                                    onChange={e =>
                                        setEditFile(
                                            e.target.files?.[0] || null
                                        )
                                    }
                                />

                            </label>

                            <div className="cut-edit-preview">

                                {editFile && editPreview ? (

                                    editFile.type.startsWith('video/')
                                        ? (
                                            <video
                                                controls
                                                playsInline
                                                src={editPreview}
                                            />
                                        )
                                        : (
                                            <img
                                                src={editPreview}
                                                alt="New tutorial media preview"
                                            />
                                        )

                                ) : (

                                    <Media tutorial={editing} />

                                )}

                            </div>

                            <div className="cut-modal-actions">

                                <button
                                    type="button"
                                    className="cut-outline"
                                    disabled={saving}
                                    onClick={closeEdit}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="cut-primary"
                                    disabled={saving}
                                >
                                    {saving
                                        ? 'Saving...'
                                        : 'Save Changes'}
                                </button>

                            </div>

                        </form>

                    </section>

                </div>

            )}

        </div>
    );
}

// ======================================================
// CSS INSIDE THE SAME JSX FILE
// ======================================================

const css = `

.cut-page {
    width: 100%;
    max-width: 1500px;
    margin: 0 auto;
    color: #142c4e;
}

.cut-page * {
    box-sizing: border-box;
}

.cut-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    margin-bottom: 25px;
}

.cut-header h1 {
    font-size: 28px;
    margin: 0 0 8px;
    color: #102a53;
}

.cut-header p {
    font-size: 13px;
    color: #718096;
    margin: 0;
}

.cut-header-actions,
.cut-card-actions,
.cut-modal-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
}

.cut-primary,
.cut-outline,
.cut-delete {
    padding: 11px 15px;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
}

.cut-primary {
    background: #0759df;
    border: 1px solid #0759df;
    color: #fff;
}

.cut-outline {
    background: #fff;
    border: 1px solid #d7e2f0;
    color: #244364;
}

.cut-delete {
    background: #fff4f4;
    border: 1px solid #facaca;
    color: #bc2828;
}

.cut-primary:hover {
    background: #0049bc;
}

.cut-outline:hover {
    background: #f1f6fe;
}

.cut-delete:hover {
    background: #ffe8e8;
}

.cut-page button:disabled {
    opacity: .55;
    cursor: not-allowed;
}

/* SEARCH AND FILTER */

.cut-filters {
    display: flex;
    align-items: end;
    gap: 14px;
    flex-wrap: wrap;
    padding: 20px;
    background: white;
    border: 1px solid #e0e8f2;
    border-radius: 12px;
    margin-bottom: 22px;
}

.cut-filter-field {
    display: flex;
    flex: 1;
    min-width: 210px;
    flex-direction: column;
    gap: 8px;
    font-size: 12px;
    font-weight: 700;
}

.cut-filter-field input,
.cut-filter-field select {
    width: 100%;
    min-width: 0;
    padding: 12px;
    border: 1px solid #d7e2f0;
    border-radius: 9px;
    background: white;
    color: #172b4d;
    font: inherit;
    font-size: 13px;
}

.cut-count {
    color: #718096;
    font-size: 12px;
    white-space: nowrap;
    padding-bottom: 12px;
}

/* TUTORIAL GRID */

.cut-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
}

.cut-card {
    min-width: 0;
    background: white;
    border: 1px solid #e0e8f2;
    border-radius: 13px;
    overflow: hidden;
}

.cut-media {
    background: #f2f6fb;
    min-height: 175px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.cut-media img,
.cut-media video {
    display: block;
    width: 100%;
    height: 245px;
    object-fit: contain;
    background: #eef3fa;
}

.cut-media-missing {
    padding: 65px 20px;
    text-align: center;
    color: #718096;
}

.cut-card-body {
    padding: 19px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.cut-card-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
}

.cut-muscle-tag,
.cut-status {
    font-size: 11px;
    font-weight: 700;
    padding: 6px 10px;
    border-radius: 20px;
}

.cut-muscle-tag {
    background: #e8f0ff;
    color: #0759df;
}

.cut-status {
    background: #ddfbe9;
    color: #087645;
    text-transform: capitalize;
}

.cut-card h2 {
    font-size: 19px;
    margin: 0;
    color: #102a53;
    overflow-wrap: anywhere;
}

.cut-description {
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
    color: #64748b;
    overflow-wrap: anywhere;
}

.cut-steps {
    margin: 0;
    padding: 12px;
    background: #f5f8fe;
    border-radius: 8px;
    font-size: 12px;
    color: #526581;
    line-height: 1.65;
    white-space: pre-line;
    max-height: 125px;
    overflow: auto;
}

.cut-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 12px;
    color: #315071;
}

.cut-meta span {
    padding: 6px 10px;
    border-radius: 8px;
    background: #edf3ff;
}

.cut-card-actions {
    justify-content: flex-end;
    margin-top: auto;
    padding-top: 7px;
}

/* EMPTY STATES AND ALERTS */

.cut-empty {
    text-align: center;
    border: 1px solid #e0e8f2;
    background: #fff;
    padding: 50px 20px;
    border-radius: 12px;
    color: #64748b;
}

.cut-empty h2 {
    color: #102a53;
    font-size: 18px;
}

.cut-error,
.cut-success {
    padding: 12px 15px;
    margin: 0 0 17px;
    border-radius: 9px;
    font-size: 13px;
}

.cut-error {
    background: #fff1f1;
    border: 1px solid #f3c7c7;
    color: #ad2525;
}

.cut-success {
    background: #e8faf0;
    border: 1px solid #b9ebce;
    color: #087645;
}

/* EDIT MODAL */

.cut-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(12,24,46,.55);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 18px;
}

.cut-modal {
    width: min(100%, 720px);
    max-height: 92vh;
    overflow: auto;
    background: white;
    border-radius: 15px;
    padding: 24px;
    box-shadow: 0 18px 60px rgba(0,0,0,.25);
}

.cut-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
}

.cut-modal-header h2 {
    font-size: 21px;
    margin: 0;
}

.cut-edit-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.cut-edit-form label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
    font-weight: 700;
    color: #233b58;
}

.cut-edit-form input,
.cut-edit-form textarea,
.cut-edit-form select {
    width: 100%;
    min-width: 0;
    padding: 11px;
    border: 1px solid #d7e2f0;
    border-radius: 8px;
    font: inherit;
    font-size: 13px;
    color: #172b4d;
    background: white;
}

.cut-edit-form textarea {
    resize: vertical;
    line-height: 1.6;
}

.cut-edit-two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 13px;
}

.cut-edit-preview {
    border-radius: 10px;
    padding: 10px;
    background: #f5f8fe;
}

.cut-edit-preview img,
.cut-edit-preview video {
    display: block;
    width: 100%;
    max-height: 270px;
    object-fit: contain;
}

.cut-modal-actions {
    justify-content: flex-end;
    padding-top: 4px;
}

/* ACCESSIBILITY */

.cut-page button:focus-visible,
.cut-page input:focus-visible,
.cut-page select:focus-visible,
.cut-page textarea:focus-visible {
    outline: 3px solid #93bdff;
    outline-offset: 2px;
}

/* TABLET */

@media (max-width: 1150px) {

    .cut-grid {
        grid-template-columns: 1fr;
    }

}

/* MOBILE */

@media (max-width: 650px) {

    .cut-header {
        align-items: stretch;
        flex-direction: column;
    }

    .cut-header h1 {
        font-size: 23px;
    }

    .cut-filters {
        padding: 14px;
    }

    .cut-filter-field {
        min-width: 100%;
    }

    .cut-count {
        padding: 0;
    }

    .cut-card-body {
        padding: 14px;
    }

    .cut-media img,
    .cut-media video {
        height: 205px;
    }

    .cut-modal {
        padding: 15px;
    }

    .cut-edit-two {
        grid-template-columns: 1fr;
    }

    .cut-modal-actions button {
        flex: 1;
    }

}

`;
