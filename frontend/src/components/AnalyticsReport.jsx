
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// =====================================================
// WELLSMARTBOOK - USER ANALYTICS REPORT
// Live user data from GET /api/analytics/report
// =====================================================

const API_BASE_URL = `http://${window.location.hostname}:5000`;

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value, suffix = '') {
  const n = numberOrNull(value);

  return n === null
    ? '—'
    : `${n.toLocaleString('en-MY', {
        maximumFractionDigits: 1
      })}${suffix}`;
}

function formatRecordedDate(value) {
  const date = String(value || '').slice(0, 10);

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) return date || 'Unknown date';

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr',
    'May', 'Jun', 'Jul', 'Aug',
    'Sep', 'Oct', 'Nov', 'Dec'
  ];

  return (
    `${Number(match[3])} ` +
    `${months[Number(match[2]) - 1]} ` +
    `${match[1]}`
  );
}


// =====================================================
// FORMAT WEIGHT MEASUREMENT DATE AND TIME
// MySQL timestamps are stored in Malaysia local time.
// =====================================================

function formatRecordedDateTime(value) {

  const date = formatRecordedDate(value);

  const text = String(value || '');

  const timeMatch = text.match(
    /(\d{2}):(\d{2})(?::\d{2})?$/
  );

  if (!timeMatch) {
    return date;
  }

  const hours = timeMatch[1];
  const minutes = timeMatch[2];

  return `${date} · ${hours}:${minutes}`;
}


// =====================================================
// WEIGHT PROGRESS CHART
// REAL RECORDED MEASUREMENTS
// =====================================================

function WeightChart({ records, target }) {

  const chart = useMemo(() => {

    const left = 52;
    const right = 650;
    const top = 26;
    const bottom = 213;

    const weights = records.map(
      record => record.kg
    );

    const values = target === null
      ? weights
      : [...weights, target];

    const minimum =
      Math.floor(Math.min(...values) - 1);

    const maximum =
      Math.ceil(Math.max(...values) + 1);

    const range =
      Math.max(1, maximum - minimum);

    const y = kg =>
      top +
      ((maximum - kg) / range) *
      (bottom - top);

    const x = index =>
      records.length === 1
        ? (left + right) / 2
        : left +
          (index / (records.length - 1)) *
          (right - left);

    
    // ================================================
    // IDENTIFY MEASUREMENTS RECORDED ON THE SAME DAY
    // ================================================

    const countsByDate = {};

    records.forEach(record => {

    const day = String(
        record.recordedAt || ''
    ).slice(0, 10);

    countsByDate[day] =
        (countsByDate[day] || 0) + 1;

    });

    // ================================================
    // PREPARE CHART POINTS
    // ================================================

    const points = records.map(
    (record, index) => ({

        ...record,

        x: x(index),

        y: y(record.kg),

        sameDay: (
        countsByDate[
            String(record.recordedAt || '')
            .slice(0, 10)
        ] || 0
        ) > 1

    })
    );


    const line = points.map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
    ).join(' ');

    const area = points.length >= 2
      ? `${line} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`
      : '';

    const ticks = Array.from(
      { length: 5 },
      (_, index) =>
        maximum - range * index / 4
    );

    return {
      left,
      right,
      bottom,
      points,
      line,
      area,
      ticks,
      y
    };

  }, [records, target]);

  const labelEvery = Math.max(
    1,
    Math.ceil(records.length / 6)
  );

  return (

    <svg
      className="ar-chart"
      viewBox="0 0 680 265"
      role="img"
      aria-label="Historical body weight measurements in kilograms"
    >

      <defs>
        <linearGradient
          id="ar-weight-fill"
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0%"
            stopColor="#2275ea"
            stopOpacity=".20"
          />

          <stop
            offset="100%"
            stopColor="#2275ea"
            stopOpacity=".01"
          />
        </linearGradient>
      </defs>

      {/* WEIGHT GRID */}

      {chart.ticks.map((tick, index) => (

        <g key={index}>

          <line
            x1={chart.left}
            x2={chart.right}
            y1={chart.y(tick)}
            y2={chart.y(tick)}
            stroke="#e6edf7"
            strokeDasharray="4 5"
          />

          <text
            x="42"
            y={chart.y(tick) + 4}
            textAnchor="end"
            fontSize="12"
            fill="#8292aa"
          >
            {tick.toFixed(1)}
          </text>

        </g>

      ))}

      {/* TARGET WEIGHT LINE */}

      {target !== null && (

        <>
          <line
            x1={chart.left}
            x2={chart.right}
            y1={chart.y(target)}
            y2={chart.y(target)}
            stroke="#17a673"
            strokeDasharray="6 5"
            strokeWidth="1.8"
          />

          <text
            x="648"
            y={Math.max(15, chart.y(target) - 9)}
            textAnchor="end"
            fontSize="12"
            fill="#12865e"
          >
            Goal: {formatNumber(target, ' kg')}
          </text>
        </>

      )}

      {/* WEIGHT AREA */}

      {chart.area && (
        <path
          d={chart.area}
          fill="url(#ar-weight-fill)"
        />
      )}

      {/* WEIGHT LINE */}

      {chart.points.length > 1 && (

        <path
          d={chart.line}
          fill="none"
          stroke="#0759dc"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

      )}

      {/* RECORDED DATA POINTS */}

      {chart.points.map((point, index) => (

        <g key={point.id}>

          <circle
            cx={point.x}
            cy={point.y}
            r="5"
            fill="#0759dc"
            stroke="#fff"
            strokeWidth="2"
          >
            
            <title>
            {formatRecordedDateTime(point.recordedAt)}
            {' · '}
            {formatNumber(point.kg, ' kg')}
            </title>

          </circle>

          {(index % labelEvery === 0 ||
            index === chart.points.length - 1) && (

            
            <text
            x={point.x}
            y="239"
            textAnchor="middle"
            fontSize="11"
            fill="#64748b"
            >

            {/* MEASUREMENT DATE */}

            <tspan x={point.x}>
                {point.label}
            </tspan>

            {/* SHOW TIME WHEN DATE HAS MULTIPLE RECORDS */}

            {point.sameDay && (

                <tspan
                x={point.x}
                dy="15"
                fontSize="10"
                fill="#0759dc"
                >

                {String(
                    point.recordedAt || ''
                ).slice(11, 16)}

                </tspan>

            )}

            </text>


          )}

        </g>

      ))}

    </svg>
  );
}


 // =====================================================
 // DAILY NUTRITION CHART
 // Seven daily calorie bars, Monday through Sunday.
 // =====================================================

function DailyNutritionChart({ days }) {

  if (!Array.isArray(days) || days.length === 0) {
    return (
      <section
        className="ar-daily"
        aria-labelledby="ar-daily-title"
      >
        <h3 id="ar-daily-title">
          Daily Nutrition Breakdown
        </h3>

        <p className="ar-daily-caption">
          Daily data is unavailable.
          Try refreshing the report.
        </p>
      </section>
    );
  }

  const weekDays = [
    'Mon', 'Tue', 'Wed', 'Thu',
    'Fri', 'Sat', 'Sun'
  ];

  // Find the highest recorded daily calories.
  // Bars are scaled relative to this day.

  const highestCalories = Math.max(
    0,
    ...days.map(day =>
      Math.max(
        0,
        Number(day?.totals?.calories) || 0
      )
    )
  );

  return (

    <section
      className="ar-daily"
      aria-labelledby="ar-daily-title"
    >

      <div className="ar-daily-heading">

        <h3 id="ar-daily-title">
          Daily Nutrition Breakdown
        </h3>

        <p>
          Recorded calories and meals,
          Monday to Sunday.
        </p>

      </div>

      <div className="ar-daily-list">

        {days.map((day, index) => {

          const calories = Math.max(
            0,
            Number(day?.totals?.calories) || 0
          );

          const meals = Math.max(
            0,
            Number(day?.mealCount) || 0
          );

          const percentage =
            highestCalories > 0
              ? Math.min(
                  100,
                  calories / highestCalories * 100
                )
              : 0;

          const dateLabel =
            formatRecordedDate(day.date)
              .split(' ')
              .slice(0, 2)
              .join(' ');

          return (

            <div
              className="ar-daily-row"
              key={day.date || index}
            >

              {/* DAY, CALORIES AND MEALS */}

              <div className="ar-daily-row-top">

                <span className="ar-daily-day">
                  {weekDays[index] || 'Day'}
                  {' · '}
                  {dateLabel}
                </span>

                <span className="ar-daily-amount">

                  {formatNumber(
                    calories,
                    ' kcal'
                  )}

                  <small>
                    {' · '}
                    {meals}
                    {' '}
                    {meals === 1 ? 'meal' : 'meals'}
                  </small>

                </span>

              </div>

              {/* DAILY CALORIE BAR */}

              <div
                className="ar-daily-track"
                role="img"
                aria-label={
                  `${weekDays[index] || 'Day'} ` +
                  `${dateLabel}: ` +
                  `${formatNumber(calories, ' kcal')}, ` +
                  `${meals} logged ` +
                  `${meals === 1 ? 'meal' : 'meals'}`
                }
              >

                <div
                  className="ar-daily-fill"
                  style={{
                    width: `${percentage}%`
                  }}
                />

              </div>

            </div>

          );

        })}

      </div>

      <p className="ar-daily-footnote">
        Bar lengths are relative to the highest
        recorded daily calories for the selected
        week, not a calorie goal.
        A zero means no calories were logged;
        it does not mean no food was eaten.
      </p>

    </section>

  );
}


// =====================================================
// MAIN ANALYTICS REPORT COMPONENT
// =====================================================


export default function AnalyticsReport() {

  const navigate = useNavigate();

  // ===================================================
  // API STATE
  // ===================================================

  const [report, setReport] = useState(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [refreshKey, setRefreshKey] = useState(0);
   // ==============================================
   // NUTRITION REPORTING WEEK
   //
   // 0 = This Week
   // 1 = Last Week
   // ==============================================
  const [weekOffset, setWeekOffset] = useState(0);
  

  const [weightInput, setWeightInput] = useState('');
  const [savingWeight, setSavingWeight] = useState(false);
  const [weightError, setWeightError] = useState('');
  const [weightSuccess, setWeightSuccess] = useState('');
  
  

  // ===================================================
  // LOAD ANALYTICS FROM MYSQL
  // ===================================================

  useEffect(() => {

    const controller = new AbortController();

    async function loadReport() {

      setLoading(true);
      setError('');

      const token =
        localStorage.getItem('token');

      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      try {

        
        const response = await fetch(
        `${API_BASE_URL}/api/analytics/report?weekOffset=${weekOffset}`,

          {
            headers: {
              Authorization: `Bearer ${token}`
            },
            signal: controller.signal
          }
        );

        const data = await response
          .json()
          .catch(() => ({}));

        if (controller.signal.aborted) {
          return;
        }

        // ============================================
        // HANDLE EXPIRED LOGIN
        // ============================================

        if (
          response.status === 401 ||
          response.status === 403
        ) {

          localStorage.removeItem('token');
          localStorage.removeItem('user');

          navigate('/login', {
            replace: true
          });

          return;
        }

        // ============================================
        // VALIDATE RESPONSE
        // ============================================

        if (
          !response.ok ||
          data.success !== true ||
          !Array.isArray(data.weightHistory) ||
          !data.weeklyNutrition ||
          !data.profile
        ) {

          throw new Error(
            data.message ||
            'Unable to load analytics report.'
          );
        }

        
        setReport(data);

        // Use the current profile weight as the initial value.
        setWeightInput(previous =>
        previous || (
            data.profile.currentWeightKg == null
            ? ''
            : String(data.profile.currentWeightKg)
        )
        );


      } catch (requestError) {

        if (
          requestError.name !== 'AbortError' &&
          !controller.signal.aborted
        ) {

          setError(
            requestError.message ||
            'Server connection error.'
          );
        }

      } finally {

        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadReport();

    return () => controller.abort();

  }, [navigate, refreshKey, weekOffset]);

  
    // =====================================================
    // RECORD WEIGHT TO MYSQL
    //
    // POST /api/analytics/weights
    // =====================================================

    async function handleRecordWeight(event) {

    event.preventDefault();

    if (savingWeight) return;

    setWeightError('');
    setWeightSuccess('');

    const value = weightInput.trim();
    const kg = Number(value);

    // ===============================================
    // VALIDATE WEIGHT
    // ===============================================

    if (
        !/^\d+(?:\.\d{1,2})?$/.test(value) ||
        !Number.isFinite(kg) ||
        kg < 30 ||
        kg > 300
    ) {

        setWeightError(
        'Enter a weight between 30 and 300 kg, ' +
        'with at most two decimal places.'
        );

        return;
    }

    // ===============================================
    // VERIFY LOGIN
    // ===============================================

    const token = localStorage.getItem('token');

    if (!token) {
        navigate('/login', { replace: true });
        return;
    }

    setSavingWeight(true);

    try {

        // =============================================
        // SEND WEIGHT MEASUREMENT TO BACKEND
        // =============================================

        const response = await fetch(
        `${API_BASE_URL}/api/analytics/weights`,
        {
            method: 'POST',

            headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
            },

            body: JSON.stringify({
            weightKg: kg
            })
        }
        );

        const data = await response
        .json()
        .catch(() => ({}));

        // =============================================
        // HANDLE EXPIRED LOGIN
        // =============================================

        if (
        response.status === 401 ||
        response.status === 403
        ) {

        localStorage.removeItem('token');
        localStorage.removeItem('user');

        navigate('/login', { replace: true });
        return;
        }

        // =============================================
        // CHECK SAVE RESULT
        // =============================================

        if (
        !response.ok ||
        data.success !== true ||
        !data.measurement
        ) {

        throw new Error(
            data.message ||
            'Unable to save weight measurement.'
        );
        }

        // =============================================
        // SUCCESS
        // =============================================

        setWeightSuccess(
        `Recorded ${formatNumber(
            data.measurement.weightKg,
            ' kg'
        )} successfully. The chart is refreshing.`
        );

        // Reload real profile and chart data.

        setRefreshKey(previous => previous + 1);

    } catch (requestError) {

        setWeightError(
        requestError.message ||
        'Server connection error.'
        );

    } finally {

        setSavingWeight(false);
    }
    }


  // ===================================================
  // FORMAT REAL WEIGHT HISTORY
  // ===================================================

  const weightRecords = useMemo(() => {

    return (report?.weightHistory || [])

      .map(record => ({

        id: record.id,

        kg: numberOrNull(record.weightKg),

        recordedAt: record.recordedAt,

        label: formatRecordedDate(
          record.recordedAt
        ).slice(0, 6)

      }))

      .filter(
        record => record.kg !== null
      );

  }, [report]);

  // ===================================================
  // WEIGHT SUMMARY
  // ===================================================

  const targetWeight = numberOrNull(
    report?.profile?.targetWeightKg
  );

  const currentWeight = numberOrNull(
    report?.profile?.currentWeightKg
  );

  const firstWeight =
    weightRecords[0]?.kg ?? null;

  const lastWeight =
    weightRecords[weightRecords.length - 1]?.kg ?? null;

  const weightChange =
    firstWeight !== null &&
    lastWeight !== null

      ? lastWeight - firstWeight

      : null;

  // ===================================================
  // WEEKLY NUTRITION
  // ===================================================

  const nutrition = report?.weeklyNutrition;

  const mealCount = Number(
    nutrition?.mealCount || 0
  );

  const macros = [
    {
      name: 'Protein',
      key: 'proteinGrams',
      className: 'protein',
      unit: 'g'
    },
    {
      name: 'Carbohydrates',
      key: 'carbsGrams',
      className: 'carbs',
      unit: 'g'
    },
    {
      name: 'Total Fat',
      key: 'fatGrams',
      className: 'fat',
      unit: 'g'
    },
    {
      name: 'Calories',
      key: 'calories',
      className: 'calories',
      unit: ' kcal'
    }
  ];

  // ===================================================
  // RENDER PAGE
  // ===================================================

  return (

    <main className="ar-page">

      <style>{reportCss}</style>

      {/* =============================================
          PAGE HEADER
      ============================================= */}

      <header className="ar-header">

        <div>

          <span className="ar-eyebrow">
            YOUR HEALTH INSIGHTS
          </span>

          <h1>Analytics Report</h1>

          <p>
            Review your recorded weight and
            nutrition progress.
          </p>

        </div>

        <button
          type="button"
          className="ar-refresh"
          disabled={loading}
          onClick={() =>
            setRefreshKey(value => value + 1)
          }
        >

          {loading
            ? 'Loading...'
            : '↻ Refresh Data'}

        </button>

      </header>

      {/* =============================================
          LOADING AND ERROR STATES
      ============================================= */}

      {loading ? (

        <section
          className="ar-card ar-state"
          role="status"
        >
          Loading your health analytics...
        </section>

      ) : error ? (

        <section
          className="ar-card ar-state"
          role="alert"
        >

          <p>{error}</p>

          <button
            type="button"
            className="ar-refresh"
            onClick={() =>
              setRefreshKey(value => value + 1)
            }
          >
            Try Again
          </button>

        </section>

      ) : report ? (

        <>

          {/* =========================================
              CURRENT REPORTING WEEK
          ========================================= */}

          <div className="ar-period">

            
            <strong>
            {weekOffset === 0 ? 'This week:' : 'Last week:'}
            </strong>


            {' '}
            {report.period?.weekStart}
            {' to '}
            {report.period?.weekEnd}

            <span>
              {' · Malaysia time · '}
              {mealCount}
              {' logged meal'}
              {mealCount === 1 ? '' : 's'}
            </span>

          </div>

          <div className="ar-grid">

            {/* =====================================
                WEIGHT PROGRESS CARD
            ===================================== */}

            <section
              className="ar-card ar-weight-card"
              aria-labelledby="ar-weight-title"
            >

              <div className="ar-section-heading">

                <div>

                  <h2 id="ar-weight-title">
                    Historical Weight Progress
                  </h2>

                  <p>
                    Actual recorded measurements (kg)
                  </p>

                </div>

                <span className="ar-small-pill">
                  Last 6 calendar months
                </span>

              </div>

              {/* WEIGHT CHART OR EMPTY STATE */}

              {weightRecords.length === 0 ? (

                <div className="ar-empty-state">

                  <strong>
                    No weight history recorded yet
                  </strong>

                  <p>
                    Update your weight in Profile.
                    New changes will appear here
                    automatically.
                  </p>

                </div>

              ) : (

                <div className="ar-chart-background">

                  <WeightChart
                    records={weightRecords}
                    target={targetWeight}
                  />
                  
                <p className="ar-footnote ar-chart-explanation">
                Each dot is one measurement, displayed in recorded
                order. When a date has multiple measurements,
                the time appears beneath it. Dots are spaced
                evenly, not by elapsed time.
                </p>


                </div>

              )}

              {/* ACTUAL WEIGHT SUMMARY */}

              <div className="ar-weight-summary">

                <div>

                  <span>
                    Current profile weight
                  </span>

                  <strong>
                    {formatNumber(
                      currentWeight,
                      ' kg'
                    )}
                  </strong>

                </div>

                <div>

                  <span>Target weight</span>

                  <strong>
                    {formatNumber(
                      targetWeight,
                      ' kg'
                    )}
                  </strong>

                </div>

                <div>

                  <span>Recorded change</span>

                  <strong>

                    {weightChange === null

                      ? '—'

                      : `${
                          weightChange > 0 ? '+' : ''
                        }${formatNumber(
                          weightChange,
                          ' kg'
                        )}`}

                  </strong>

                </div>

              </div>

              {weightRecords.length === 1 && (

                <p className="ar-footnote">
                  One weight measurement recorded.
                  Add another measurement to see
                  a trend.
                </p>

              )}
              
                {/* =======================================
                    RECORD WEIGHT FORM
                ======================================= */}

                <form
                className="ar-weight-form"
                onSubmit={handleRecordWeight}
                >

                <div>

                    <h3>Record Weight</h3>

                    <p>
                    Save a genuine measurement, even if your
                    weight is the same as last time.
                    Your goal weight will not be edited
                    by this form.
                    </p>

                </div>

                <div className="ar-weight-form-controls">

                    <label htmlFor="ar-weight-input">
                    Weight (kg)
                    </label>

                    <input
                    id="ar-weight-input"
                    type="number"
                    inputMode="decimal"
                    min="30"
                    max="300"
                    step="0.01"
                    placeholder="e.g. 74.80"
                    value={weightInput}
                    onChange={event => {

                        setWeightInput(event.target.value);

                        setWeightError('');
                        setWeightSuccess('');

                    }}
                    disabled={savingWeight}
                    required
                    />

                    <button
                    type="submit"
                    disabled={savingWeight}
                    >

                    {savingWeight
                        ? 'Saving...'
                        : 'Record Weight'}

                    </button>

                </div>

                {/* ERROR MESSAGE */}

                {weightError && (

                    <p
                    className="ar-weight-error"
                    role="alert"
                    >
                    {weightError}
                    </p>

                )}

                {/* SUCCESS MESSAGE */}

                {weightSuccess && (

                    <p
                    className="ar-weight-success"
                    role="status"
                    >
                    {weightSuccess}
                    </p>

                )}

                </form>
                
                {/* ========================================
                    RECENT WEIGHT MEASUREMENTS
                ======================================== */}

                <section className="ar-history">

                <div className="ar-history-heading">

                    <div>

                    <h3>
                        Recent Weight Measurements
                    </h3>

                    <p>
                        Your latest recorded measurements,
                        newest first.
                    </p>

                    </div>

                    <span>
                    {weightRecords.length} record(s)
                    </span>

                </div>

                {weightRecords.length === 0 ? (

                    <p className="ar-history-empty">
                    No measurements recorded yet.
                    </p>

                ) : (

                    <ul className="ar-history-list">

                    {weightRecords
                        .slice(-10)
                        .reverse()
                        .map((record, index) => (

                        <li
                            key={record.id}
                            className="ar-history-item"
                        >

                            <div className="ar-history-info">

                            <span
                                className="ar-history-dot"
                                aria-hidden="true"
                            />

                            <div>

                                <strong>
                                {formatRecordedDateTime(
                                    record.recordedAt
                                )}
                                </strong>

                                <small>

                                {index === 0
                                    ? 'Most recent measurement'
                                    : 'Recorded measurement'}

                                </small>

                            </div>

                            </div>

                            <strong className="ar-history-weight">

                            {formatNumber(
                                record.kg,
                                ' kg'
                            )}

                            </strong>

                        </li>

                        ))}

                    </ul>

                )}

                {weightRecords.length > 10 && (

                    <p className="ar-history-note">
                    Showing your 10 most recent measurements.
                    </p>

                )}

                </section>



            </section>

            {/* =====================================
                WEEKLY NUTRITION CARD
            ===================================== */}

            <section
              className="ar-card ar-macro-card"
              aria-labelledby="ar-macro-title"
            >

              <div className="ar-section-heading">

                <div>

                  <h2 id="ar-macro-title">
                    Weekly Macronutrients
                  </h2>

                  <p>
                    Logged intake vs. weekly targets
                    (daily goal × 7)
                  </p>

                </div>
                
                {/* ======================================
                    NUTRITION WEEK SELECTOR
                ====================================== */}

                <label
                className="ar-week-select"
                htmlFor="ar-week-select"
                >

                <span>
                    Reporting week
                </span>

                <select
                    id="ar-week-select"

                    value={weekOffset}

                    onChange={event =>
                    setWeekOffset(Number(event.target.value))
                    }

                    disabled={loading}
                >

                    <option value={0}>
                    This Week
                    </option>

                    <option value={1}>
                    Last Week
                    </option>

                </select>

                </label>


              </div>

              {/* NO MEALS LOGGED */}

              {mealCount === 0 && (

                
                <div className="ar-empty-note">

                {weekOffset === 0
                    ? 'No meals logged this week. Log a meal to start tracking.'
                    : 'No meals were logged last week.'}

                </div>


              )}

              {/* NUTRIENT BARS */}

              <div className="ar-macro-list">

                {macros.map(macro => {

                  const actual =
                    numberOrNull(
                      nutrition?.totals?.[macro.key]
                    ) ?? 0;

                  const target =
                    numberOrNull(
                      nutrition?.targets?.[macro.key]
                    );

                  const hasTarget =
                    target !== null && target > 0;

                  const progress = hasTarget
                    ? Math.min(
                        100,
                        actual / target * 100
                      )
                    : 0;

                  return (

                    <div
                      className="ar-macro-item"
                      key={macro.key}
                    >

                      <div className="ar-macro-top">

                        <span>
                          {macro.name}
                        </span>

                        <strong>

                          {formatNumber(
                            actual,
                            macro.unit
                          )}

                          <span>

                            {' / '}

                            {hasTarget

                              ? formatNumber(
                                  target,
                                  macro.unit
                                )

                              : 'Target not set'}

                          </span>

                        </strong>

                      </div>

                      {/* PROGRESS BAR */}

                      <div
                        className="ar-macro-track"

                        role={
                          hasTarget
                            ? 'progressbar'
                            : undefined
                        }

                        aria-label={
                          hasTarget
                            ? `${macro.name} weekly intake toward goal`
                            : undefined
                        }

                        aria-valuemin={
                          hasTarget ? 0 : undefined
                        }

                        aria-valuemax={
                          hasTarget ? target : undefined
                        }

                        aria-valuenow={
                          hasTarget
                            ? Math.min(
                                Math.max(0, actual),
                                target
                              )
                            : undefined
                        }
                      >

                        <div
                          className={
                            `ar-macro-fill ${macro.className}`
                          }

                          style={{
                            width: `${progress}%`
                          }}
                        />

                      </div>

                      <small>

                        {hasTarget

                          ? `${Math.round(
                              actual / target * 100
                            )}% of weekly goal`

                          : 'Add a daily target in Profile'}

                      </small>

                    </div>

                  );

                })}

              </div>

              
            {/* ======================================
                WEEKLY NUTRITION NOTE
            ====================================== */}

            <div className="ar-macro-note">

            Nutrition totals are based on meals logged
            {' '}
            {weekOffset === 0
                ? 'this week'
                : 'last week'}.

            {' '}

            They may be incomplete if some meals
            were not recorded.

            Total Fat includes all fat,
            not only healthy fats.

            </div>

            {/* ======================================
                DAILY NUTRITION BREAKDOWN
            ====================================== */}

            <DailyNutritionChart
            days={nutrition?.days}
            />


            </section>

          </div>

        </>

      ) : null}

    </main>

  );
}

// =====================================================
// RESPONSIVE CSS
// =====================================================

const reportCss = `

.ar-page,
.ar-page * {
  box-sizing: border-box;
}

.ar-page {
  width: 100%;
  max-width: 1440px;
  min-width: 0;
  margin: 0 auto;
  color: #142b4d;
}

/* HEADER */

.ar-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.ar-eyebrow {
  font-size: 11px;
  letter-spacing: 1px;
  color: #0759dc;
  font-weight: 800;
}

.ar-header h1 {
  font-size: 27px;
  color: #142b4d !important;
  margin: 7px 0 6px;
  font-weight: 800;
}

.ar-header p {
  font-size: 13px;
  color: #718096;
  margin: 0;
  line-height: 1.6;
}

.ar-refresh {
  flex-shrink: 0;
  padding: 11px 15px;
  border: 1px solid #d4e3f6;
  border-radius: 10px;
  background: #fff;
  color: #0759dc;
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}

.ar-refresh:disabled {
  opacity: .55;
  cursor: wait;
}

/* REPORT PERIOD */

.ar-period {
  margin-bottom: 18px;
  border: 1px solid #d6e6f9;
  border-radius: 12px;
  background: #edf5ff;
  padding: 13px 16px;
  color: #496582;
  font-size: 12px;
  line-height: 1.7;
}

/* RESPONSIVE GRID */

.ar-grid {
  display: grid;
  grid-template-columns:
    minmax(0, 1.4fr)
    minmax(310px, 1fr);
  align-items: start;
  gap: 18px;
}

/* WHITE CARDS */

.ar-card {
  min-width: 0;
  padding: 23px;
  border: 1px solid #e0e8f4;
  border-radius: 17px;
  background: #fff;
  box-shadow: 0 3px 12px rgba(21,48,85,.03);
}

.ar-section-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 20px;
}

.ar-section-heading h2 {
  margin: 0 0 6px;
  font-size: 18px;
  color: #142b4d !important;
}

.ar-section-heading p {
  margin: 0;
  font-size: 12px;
  color: #7486a0;
}

.ar-small-pill {
  flex-shrink: 0;
  background: #f0f5fc;
  padding: 7px 10px;
  border-radius: 25px;
  font-size: 10px;
  color: #627b9c;
}

/* CHART */

.ar-chart-background {
  padding: 13px 4px 0;
  background: linear-gradient(
    180deg,
    #f8fbff,
    #fff
  );
  border-radius: 12px;
}

.ar-chart {
  display: block;
  width: 100%;
  height: auto;
}

.ar-chart-explanation {
  margin: 8px 12px 12px;
  line-height: 1.6;
  color: #718096;
}


/* EMPTY STATE */

.ar-state,
.ar-empty-state {
  padding: 30px 18px;
  text-align: center;
  color: #718096;
}

.ar-empty-state {
  background: #f8fbff;
  border: 1px dashed #cbd8e9;
  border-radius: 12px;
}

.ar-empty-state strong {
  display: block;
  color: #334155;
  font-size: 15px;
}

.ar-empty-state p {
  margin: 9px 0 0;
  font-size: 12px;
  line-height: 1.6;
}

/* WEIGHT SUMMARY */

.ar-weight-summary {
  display: grid;
  grid-template-columns:
    repeat(3, minmax(0,1fr));
  gap: 12px;
  padding-top: 17px;
  margin-top: 14px;
  border-top: 1px solid #eef2f7;
}

.ar-weight-summary span {
  display: block;
  font-size: 11px;
  color: #8491a5;
}

.ar-weight-summary strong {
  display: block;
  margin-top: 6px;
  font-size: 17px;
  color: #163965;
  overflow-wrap: anywhere;
}

.ar-footnote {
  color: #718096;
  font-size: 11px;
  line-height: 1.6;
  margin-bottom: 0;
}

/* NUTRITION */

.ar-empty-note {
  border: 1px solid #dbeafe;
  background: #f0f7ff;
  padding: 12px;
  border-radius: 10px;
  color: #526782;
  font-size: 12px;
  line-height: 1.6;
}

.ar-macro-list {
  display: grid;
  gap: 27px;
  padding: 15px 0 7px;
}

.ar-macro-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #344962;
}

.ar-macro-top > span {
  font-weight: 750;
}

.ar-macro-top strong {
  font-size: 12px;
  color: #172f51;
}

.ar-macro-top strong span {
  font-weight: 500;
  color: #8594a8;
}

.ar-macro-track {
  height: 17px;
  background: #e8eef8;
  border-radius: 30px;
  overflow: hidden;
}

.ar-macro-fill {
  height: 100%;
  border-radius: 30px;
  transition: width .25s ease;
}

.ar-macro-fill.protein {
  background: #0759dc;
}

.ar-macro-fill.carbs {
  background: #5d8fe2;
}

.ar-macro-fill.fat {
  background: #a7aebc;
}

.ar-macro-fill.calories {
  background: #16a36a;
}

.ar-macro-item small {
  display: block;
  text-align: right;
  margin-top: 8px;
  color: #8997aa;
  font-size: 10px;
}

.ar-macro-note {
  margin-top: 25px;
  padding: 13px;
  border: 1px solid #e3eaf4;
  background: #f7f9fd;
  border-radius: 10px;
  font-size: 11px;
  color: #718096;
  line-height: 1.7;
}


/* ==========================================
   RECORD WEIGHT FORM
========================================== */

.ar-weight-form {
  margin-top: 20px;
  padding: 17px;
  border: 1px solid #dce7f7;
  background: #f8fbff;
  border-radius: 12px;
}

.ar-weight-form h3 {
  margin: 0 0 6px;
  color: #142b4d !important;
  font-size: 16px;
}

.ar-weight-form p {
  margin: 0;
  font-size: 12px;
  color: #657891;
  line-height: 1.6;
}

.ar-weight-form-controls {
  display: flex;
  align-items: end;
  gap: 10px;
  margin-top: 15px;
  flex-wrap: wrap;
}

.ar-weight-form-controls label {
  flex-basis: 100%;
  color: #40536e;
  font-size: 12px;
  font-weight: 700;
}

.ar-weight-form-controls input {
  flex: 1 1 145px;
  min-width: 0;
  height: 43px;
  border: 1px solid #d2dff0;
  background: #fff;
  color: #142b4d;
  font-size: 14px;
  padding: 10px 12px;
  border-radius: 9px;
  font-family: inherit;
}

.ar-weight-form-controls button {
  height: 43px;
  border: 1px solid #0759dc;
  background: #0759dc;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  border-radius: 9px;
  padding: 0 17px;
  cursor: pointer;
}

.ar-weight-form-controls button:disabled {
  opacity: 0.55;
  cursor: wait;
}

.ar-weight-form .ar-weight-error {
  color: #b42338;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  padding: 9px 10px;
  border-radius: 8px;
  margin-top: 12px;
}

.ar-weight-form .ar-weight-success {
  color: #087747;
  background: #e7f8ef;
  border: 1px solid #bcdfcb;
  padding: 9px 10px;
  border-radius: 8px;
  margin-top: 12px;
}


/* ==========================================
   RECENT WEIGHT MEASUREMENTS
========================================== */

.ar-history {
  margin-top: 22px;
  padding-top: 20px;
  border-top: 1px solid #e5eaf3;
}

.ar-history-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 17px;
}

.ar-history-heading h3 {
  margin: 0 0 6px;
  font-size: 16px;
  color: #142b4d !important;
}

.ar-history-heading p {
  margin: 0;
  font-size: 12px;
  color: #718096;
  line-height: 1.5;
}

.ar-history-heading > span {
  padding: 7px 10px;
  border-radius: 20px;
  background: #edf4ff;
  color: #0759dc;
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.ar-history-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.ar-history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 15px 0;
  border-bottom: 1px solid #edf1f7;
}

.ar-history-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.ar-history-info strong {
  display: block;
  font-size: 13px;
  color: #263d59;
}

.ar-history-info small {
  display: block;
  margin-top: 5px;
  font-size: 11px;
  color: #8190a6;
}

.ar-history-dot {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #0759dc;
  box-shadow: 0 0 0 4px #e8f1ff;
}

.ar-history-weight {
  font-size: 14px;
  color: #0759dc;
  white-space: nowrap;
}

.ar-history-empty,
.ar-history-note {
  font-size: 12px;
  color: #718096;
  line-height: 1.6;
}


/* ==========================================
   DAILY NUTRITION BREAKDOWN
========================================== */

.ar-daily {
  margin-top: 23px;
  padding-top: 21px;
  border-top: 1px solid #e5eaf3;
}

.ar-daily-heading h3,
.ar-daily > h3 {
  margin: 0 0 6px;
  font-size: 16px;
  color: #142b4d !important;
}

.ar-daily-heading p,
.ar-daily-caption {
  margin: 0;
  font-size: 12px;
  color: #718096;
  line-height: 1.6;
}

.ar-daily-list {
  display: grid;
  gap: 15px;
  margin-top: 18px;
}

/* INDIVIDUAL DAY */

.ar-daily-row {
  min-width: 0;
}

.ar-daily-row-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-bottom: 7px;
}

.ar-daily-day {
  color: #344962;
  font-size: 12px;
  font-weight: 700;
}

.ar-daily-amount {
  color: #18375d;
  font-size: 12px;
  font-weight: 700;
}

.ar-daily-amount small {
  color: #8594a8;
  font-size: 11px;
  font-weight: 500;
}

/* DAILY CALORIE BAR */

.ar-daily-track {
  height: 13px;
  border-radius: 20px;
  overflow: hidden;
  background: #e9eff8;
}

.ar-daily-fill {
  height: 100%;
  border-radius: 20px;
  background: #0759dc;
  transition: width .25s ease;
}

/* EXPLANATION */

.ar-daily-footnote {
  margin: 17px 0 0;
  font-size: 11px;
  line-height: 1.65;
  color: #718096;
}


@media (max-width: 470px) {

  .ar-history-heading {
    flex-wrap: wrap;
  }

  .ar-history-item {
    gap: 8px;
  }

  .ar-history-info strong {
    font-size: 12px;
  }

  .ar-history-weight {
    font-size: 12px;
  }

}


/* ==========================================
   WEEKLY NUTRITION SELECTOR
========================================== */

.ar-week-select {
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  gap: 6px;
  min-width: 135px;
  font-size: 11px;
  font-weight: 700;
  color: #526782;
}

.ar-week-select select {
  min-height: 39px;
  padding: 8px 11px;
  border: 1px solid #d4e3f6;
  border-radius: 9px;
  background: #ffffff;
  color: #142b4d;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.ar-week-select select:focus-visible {
  outline: 2px solid #0759dc;
  outline-offset: 2px;
}

/* MOBILE */

@media (max-width: 620px) {

  .ar-macro-card .ar-section-heading {
    flex-wrap: wrap;
  }

  .ar-week-select {
    width: 100%;
  }

}



/* MOBILE */

@media (max-width: 470px) {

  .ar-weight-form-controls {
    align-items: stretch;
  }

  .ar-weight-form-controls input,
  .ar-weight-form-controls button {
    flex: 1 1 100%;
    width: 100%;
  }

}


/* TABLET */

@media (max-width: 1050px) {

  .ar-grid {
    grid-template-columns: 1fr;
  }

}

/* MOBILE */

@media (max-width: 620px) {

  .ar-header {
    flex-direction: column;
  }

  .ar-header h1 {
    font-size: 23px;
  }

  .ar-card {
    padding: 16px;
  }

  .ar-section-heading h2 {
    font-size: 16px;
  }

  .ar-small-pill {
    display: none;
  }

  .ar-weight-summary {
    gap: 8px;
  }

  .ar-weight-summary span {
    font-size: 10px;
  }

  .ar-weight-summary strong {
    font-size: 14px;
  }

  .ar-macro-list {
    gap: 21px;
  }

}

@media (max-width: 390px) {

  .ar-card {
    padding: 12px;
  }

}

`;
