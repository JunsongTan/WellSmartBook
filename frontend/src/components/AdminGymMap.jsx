
import { useEffect, useRef, useState } from 'react';

// ======================================================
// WELLSMARTBOOK - ADMIN GOOGLE MAP
// Same Google Maps API as User and Coach
// ======================================================

const MAP_ID =
    import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ||
    'DEMO_MAP_ID';

const DEFAULT_CENTER = {
    lat: 5.4141,
    lng: 100.3288
};

let googleMapsPromise = null;

// ======================================================
// LOAD GOOGLE MAPS API
// ======================================================

function loadGoogleMaps() {

    if (window.google?.maps?.importLibrary) {
        return Promise.resolve(window.google.maps);
    }

    if (googleMapsPromise) {
        return googleMapsPromise;
    }

    googleMapsPromise = new Promise(
        (resolve, reject) => {

            // Reuse an existing Google Maps script.

            const existingScript = [
                ...document.scripts
            ].find(script =>
                script.src.includes(
                    'maps.googleapis.com/maps/api/js'
                )
            );

            if (existingScript) {

                let checks = 0;

                const timer = window.setInterval(() => {

                    if (
                        window.google?.maps?.importLibrary
                    ) {

                        window.clearInterval(timer);

                        resolve(window.google.maps);

                    } else if (++checks >= 150) {

                        window.clearInterval(timer);

                        reject(
                            new Error(
                                'Google Maps could not finish loading.'
                            )
                        );
                    }

                }, 100);

                existingScript.addEventListener(
                    'error',
                    () => {
                        window.clearInterval(timer);

                        reject(
                            new Error(
                                'Google Maps script failed to load.'
                            )
                        );
                    },
                    { once: true }
                );

                return;
            }

            // Use the existing environment API key.

            const apiKey =
                import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

            if (!apiKey) {

                reject(
                    new Error(
                        'Google Maps API key missing from frontend/.env.'
                    )
                );

                return;
            }

            const script =
                document.createElement('script');

            script.src =
                'https://maps.googleapis.com/maps/api/js' +
                `?key=${encodeURIComponent(apiKey)}` +
                '&v=weekly&libraries=marker';

            script.async = true;

            script.onload = () =>
                resolve(window.google.maps);

            script.onerror = () =>
                reject(
                    new Error(
                        'Unable to load Google Maps.'
                    )
                );

            document.head.appendChild(script);
        }
    ).catch(error => {

        googleMapsPromise = null;

        throw error;
    });

    return googleMapsPromise;
}

// ======================================================
// VALIDATE GYM COORDINATES
// ======================================================

function getPosition(gym) {

    const lat = Number(gym.latitude);
    const lng = Number(gym.longitude);

    if (
        !Number.isFinite(lat) ||
        lat < -90 ||
        lat > 90 ||
        !Number.isFinite(lng) ||
        lng < -180 ||
        lng > 180
    ) {

        return null;
    }

    return { lat, lng };
}

// ======================================================
// ADMIN GOOGLE MAP COMPONENT
// ======================================================

export default function AdminGymMap({
    gyms = [],
    onSelectGym
}) {

    const containerRef = useRef(null);

    const mapRef = useRef(null);

    const markersRef = useRef([]);

    const googleRef = useRef(null);

    const selectRef = useRef(onSelectGym);

    const [ready, setReady] = useState(false);

    const [error, setError] = useState('');

    selectRef.current = onSelectGym;

    // ==================================================
    // INITIALIZE GOOGLE MAP
    // ==================================================

    useEffect(() => {

        let cancelled = false;

        async function initMap() {

            try {

                const google =
                    await loadGoogleMaps();

                const { Map } =
                    await google.importLibrary('maps');

                await google.importLibrary('marker');

                if (
                    cancelled ||
                    !containerRef.current
                ) {
                    return;
                }

                googleRef.current = google;

                mapRef.current = new Map(
                    containerRef.current,
                    {
                        center: DEFAULT_CENTER,

                        zoom: 11,

                        mapId: MAP_ID,

                        mapTypeControl: false,

                        streetViewControl: false,

                        fullscreenControl: true,

                        clickableIcons: false
                    }
                );

                setReady(true);

            } catch (err) {

                if (!cancelled) {
                    setError(err.message);
                }
            }
        }

        initMap();

        return () => {

            cancelled = true;

            markersRef.current.forEach(marker => {
                marker.map = null;
            });

            markersRef.current = [];

            mapRef.current = null;
        };

    }, []);

    // ==================================================
    // DISPLAY GYM MARKERS
    // ==================================================

    useEffect(() => {

        if (
            !ready ||
            !mapRef.current ||
            !googleRef.current
        ) {
            return;
        }

        const google = googleRef.current;

        const map = mapRef.current;

        const bounds = new google.LatLngBounds();

        let count = 0;

        // Remove previous markers.

        markersRef.current.forEach(marker => {
            marker.map = null;
        });

        markersRef.current = [];

        // Create new gym markers.

        gyms.forEach(gym => {

            const position = getPosition(gym);

            if (!position) {
                return;
            }

            const element =
                document.createElement('div');

            element.className =
                `adgm-pin ${
                    gym.isActive
                        ? 'adgm-active'
                        : 'adgm-disabled'
                }`;

            element.textContent = '🏋';

            const marker =
                new google.marker.AdvancedMarkerElement({
                    map,
                    position,
                    title: gym.name,
                    content: element
                });

            // Click marker to select gym.

            marker.addListener('click', () => {

                selectRef.current?.(gym);
            });

            markersRef.current.push(marker);

            bounds.extend(position);

            count += 1;
        });

        // Adjust map to show gym locations.

        if (count === 1) {

            map.setCenter(bounds.getCenter());

            map.setZoom(14);

        } else if (count > 1) {

            map.fitBounds(bounds, 55);
        }

    }, [gyms, ready]);

    // ==================================================
    // RENDER
    // ==================================================

    return (

        <section className="adgm-section">

            <style>{css}</style>

            <div className="adgm-heading">

                <div>

                    <h2>
                        Gym Locations Map
                    </h2>

                    <p>
                        Click a gym marker to edit
                        its information.
                    </p>

                </div>

                <span className="adgm-legend">
                    🔵 Active &nbsp; ⚪ Disabled
                </span>

            </div>

            <div className="adgm-map-wrap">

                <div
                    ref={containerRef}
                    className="adgm-map"
                />

                {!ready && !error && (

                    <div className="adgm-overlay">
                        Loading Google Maps...
                    </div>

                )}

                {error && (

                    <div
                        className="adgm-overlay"
                        role="alert"
                    >
                        {error}
                    </div>

                )}

            </div>

        </section>
    );
}

// ======================================================
// RESPONSIVE CSS INSIDE JSX
// ======================================================

const css = `

.adgm-section {
    padding: 0 22px 22px;
    min-width: 0;
}

.adgm-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}

.adgm-heading h2 {
    margin: 0 0 6px;
    color: #142b4d !important;
    font-size: 17px;
}

.adgm-heading p {
    margin: 0;
    font-size: 12px;
    color: #718096;
}

.adgm-legend {
    color: #64748b;
    font-size: 11px;
    white-space: nowrap;
}

.adgm-map-wrap {
    position: relative;
    overflow: hidden;
    border: 1px solid #dbe3ef;
    border-radius: 13px;
}

.adgm-map {
    width: 100%;
    height: 390px;
    background: #e8eef7;
}

.adgm-overlay {
    position: absolute;
    inset: 0;

    display: grid;
    place-items: center;

    background: rgba(255,255,255,.85);
    color: #526782;

    font-size: 13px;
    padding: 16px;
    text-align: center;
}

.adgm-pin {
    width: 40px;
    height: 40px;

    border: 3px solid white;

    border-radius:
        50% 50% 50% 8px;

    transform: rotate(-45deg);

    display: grid;
    place-items: center;

    box-shadow:
        0 4px 12px rgba(0,0,0,.22);

    cursor: pointer;
    font-size: 18px;
}

.adgm-active {
    background: #0759dc;
}

.adgm-disabled {
    background: #94a3b8;
}

/* ==========================================
   MOBILE RESPONSIVE
========================================== */

@media (max-width: 700px) {

    .adgm-section {
        padding: 0 15px 17px;
    }

    .adgm-heading {
        flex-direction: column;
        align-items: flex-start;
    }

    .adgm-map {
        height: 300px;
    }
}

`;
