
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import PasswordChecklist, {
  isStrongPassword
} from './PasswordChecklist';

// =====================================================
// WELLSMARTBOOK - ADMIN SETTINGS
//
// GET   /api/admin/settings
// PATCH /api/admin/settings/password
// =====================================================

const API_URL =
  `http://${window.location.hostname}:5000`;

const emptyForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
};

// =====================================================
// ADMIN SETTINGS COMPONENT
// =====================================================

export default function AdminSettings() {

  const navigate = useNavigate();

  // ===================================================
  // ADMIN ACCOUNT STATE
  // ===================================================

  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);

  // ===================================================
  // PASSWORD FORM STATE
  // ===================================================

  const [form, setForm] = useState(emptyForm);

  const [visible, setVisible] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ===================================================
  // LOGOUT ADMINISTRATOR
  // ===================================================

  function logout() {

    localStorage.removeItem('token');
    localStorage.removeItem('user');

    navigate('/login', {
      replace: true
    });
  }

  // ===================================================
  // LOAD CURRENT ADMIN ACCOUNT FROM MYSQL
  // ===================================================

  useEffect(() => {

    const controller = new AbortController();

    async function loadAdmin() {

      setLoading(true);
      setLoadError('');

      const token = localStorage.getItem('token');

      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      try {

        const response = await fetch(
          `${API_URL}/api/admin/settings`,
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

        if (controller.signal.aborted) return;

        // =============================================
        // CHECK LOGIN SESSION
        // =============================================

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

        // =============================================
        // CHECK RESPONSE
        // =============================================

        if (
          !response.ok ||
          data.success !== true ||
          !data.admin
        ) {

          throw new Error(
            data.message ||
            'Unable to load admin account.'
          );
        }

        setAdmin(data.admin);

      } catch (err) {

        if (
          !controller.signal.aborted &&
          err.name !== 'AbortError'
        ) {

          setLoadError(
            err.message ||
            'Server connection error.'
          );
        }

      } finally {

        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadAdmin();

    return () => controller.abort();

  }, [navigate, reload]);

  // ===================================================
  // UPDATE PASSWORD INPUT
  // ===================================================

  function changeField(name, value) {

    setForm(previous => ({
      ...previous,
      [name]: value
    }));

    setError('');
  }

  // ===================================================
  // CHANGE ADMIN PASSWORD
  // ===================================================

  async function handlePasswordChange(event) {

    event.preventDefault();

    if (saving) return;

    setError('');

    // ===============================================
    // VALIDATE CURRENT PASSWORD
    // ===============================================

    if (!form.currentPassword) {

      setError(
        'Enter your current password.'
      );

      return;
    }

    // ===============================================
    // VALIDATE PASSWORD STRENGTH
    // ===============================================

    if (!isStrongPassword(form.newPassword)) {

      setError(
        'Your new password does not meet ' +
        'the requirements below.'
      );

      return;
    }

    // ===============================================
    // CONFIRM NEW PASSWORD
    // ===============================================

    if (
      form.newPassword !==
      form.confirmPassword
    ) {

      setError(
        'New password and confirmation do not match.'
      );

      return;
    }

    // ===============================================
    // PREVENT REUSING SAME PASSWORD
    // ===============================================

    if (
      form.currentPassword ===
      form.newPassword
    ) {

      setError(
        'Your new password must be different ' +
        'from your current password.'
      );

      return;
    }

    const token = localStorage.getItem('token');

    if (!token) {
      logout();
      return;
    }

    setSaving(true);

    try {

      // =============================================
      // SEND PASSWORD CHANGE REQUEST
      // =============================================

      const response = await fetch(
        `${API_URL}/api/admin/settings/password`,
        {
          method: 'PATCH',

          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            currentPassword: form.currentPassword,
            newPassword: form.newPassword
          })
        }
      );

      const data = await response
        .json()
        .catch(() => ({}));

      // =============================================
      // HANDLE REVOKED ADMIN ACCOUNT
      // =============================================

      if (response.status === 403) {
        logout();
        return;
      }

      // 401 may mean the current password was wrong.
      // Show error without logging out.

      if (
        !response.ok ||
        data.success !== true
      ) {

        throw new Error(
          data.message ||
          'Unable to change password.'
        );
      }

      // =============================================
      // PASSWORD CHANGED SUCCESSFULLY
      // =============================================

      setForm(emptyForm);

      window.alert(
        'Password changed successfully. ' +
        'Sign in with your new password.'
      );

      logout();

    } catch (err) {

      setError(
        err.message ||
        'Server connection error.'
      );

    } finally {

      setSaving(false);
    }
  }

  // ===================================================
  // PASSWORD INPUT FIELDS
  // ===================================================

  const passwordFields = [
    {
      key: 'currentPassword',
      title: 'Current Password',
      auto: 'current-password'
    },
    {
      key: 'newPassword',
      title: 'New Password',
      auto: 'new-password'
    },
    {
      key: 'confirmPassword',
      title: 'Confirm New Password',
      auto: 'new-password'
    }
  ];

  // ===================================================
  // RENDER ADMIN SETTINGS
  // ===================================================

  return (

    <main className="as-page">

      <style>{styles}</style>

      {/* ==============================================
          PAGE HEADER
      ============================================== */}

      <header className="as-header">

        <span className="as-eyebrow">
          ADMIN MANAGEMENT
        </span>

        <h1>Admin Settings</h1>

        <p>
          View your administrator account
          and change your login password.
        </p>

      </header>

      {/* ==============================================
          LOADING / ERROR / ACCOUNT
      ============================================== */}

      {loading ? (

        <section className="as-panel" role="status">
          Loading administrator settings...
        </section>

      ) : loadError ? (

        <section className="as-panel">

          <p className="as-error" role="alert">
            {loadError}
          </p>

          <button
            type="button"
            onClick={() =>
              setReload(v => v + 1)
            }
          >
            Try Again
          </button>

        </section>

      ) : admin ? (

        <div className="as-grid">

          {/* ==========================================
              LEFT: ADMIN ACCOUNT INFORMATION
          ========================================== */}

          <section className="as-panel">

            <h2>Administrator Account</h2>

            <p className="as-description">
              Your account details are read-only.
            </p>

            <div className="as-avatar">
              {(admin.username || 'A')
                .charAt(0)
                .toUpperCase()}
            </div>

            <dl className="as-info">

              <div>
                <dt>Admin ID</dt>
                <dd>#{admin.id}</dd>
              </div>

              <div>
                <dt>Username</dt>
                <dd>
                  {admin.username || '—'}
                </dd>
              </div>

              <div>
                <dt>Full Name</dt>
                <dd>
                  {admin.fullName || '—'}
                </dd>
              </div>

              <div>
                <dt>Role</dt>
                <dd>Administrator</dd>
              </div>

              <div>

                <dt>Account Status</dt>

                <dd>

                  <span
                    className={
                      admin.isActive
                        ? 'as-active'
                        : 'as-inactive'
                    }
                  >
                    {admin.isActive
                      ? 'Active'
                      : 'Disabled'}
                  </span>

                </dd>

              </div>

            </dl>

          </section>

          {/* ==========================================
              RIGHT: CHANGE PASSWORD
          ========================================== */}

          <section className="as-panel">

            <h2>Change Password</h2>

            <p className="as-description">
              Enter your current password and
              choose a new strong password.
            </p>

            <form
              className="as-form"
              onSubmit={handlePasswordChange}
            >

              {/* PASSWORD INPUTS */}

              {passwordFields.map(field => (

                <div
                  className="as-field"
                  key={field.key}
                >

                  <label
                    htmlFor={`admin-${field.key}`}
                  >
                    {field.title} *
                  </label>

                  <div className="as-input-row">

                    <input
                      id={`admin-${field.key}`}

                      type={
                        visible[field.key]
                          ? 'text'
                          : 'password'
                      }

                      autoComplete={field.auto}

                      value={form[field.key]}

                      onChange={e =>
                        changeField(
                          field.key,
                          e.target.value
                        )
                      }

                      disabled={saving}
                      required
                    />

                    {/* SHOW / HIDE PASSWORD */}

                    <button
                      type="button"
                      disabled={saving}

                      aria-label={
                        `${
                          visible[field.key]
                            ? 'Hide'
                            : 'Show'
                        } ${field.title}`
                      }

                      onClick={() =>
                        setVisible(previous => ({
                          ...previous,
                          [field.key]:
                            !previous[field.key]
                        }))
                      }
                    >

                      {visible[field.key]
                        ? 'Hide'
                        : 'Show'}

                    </button>

                  </div>

                </div>

              ))}

              {/* EXISTING PASSWORD REQUIREMENTS */}

              <PasswordChecklist
                password={form.newPassword}
              />

              {/* ERROR MESSAGE */}

              {error && (

                <p
                  className="as-error"
                  role="alert"
                >
                  {error}
                </p>

              )}

              {/* CHANGE PASSWORD BUTTON */}

              <button
                className="as-submit"
                type="submit"
                disabled={saving}
              >

                {saving
                  ? 'Changing Password...'
                  : 'Change Password'}

              </button>

            </form>

            <p className="as-note">
              After a successful change, you
              will sign out on this browser.
              Existing sessions on other
              devices are not automatically revoked.
            </p>

          </section>

        </div>

      ) : (

        <section className="as-panel">
          Administrator account not found.
        </section>

      )}

    </main>
  );
}

// =====================================================
// RESPONSIVE CSS
// CSS IS INSIDE JSX - NO EXTRA CSS FILE NEEDED
// =====================================================

const styles = `

.as-page,
.as-page * {
  box-sizing: border-box;
}

.as-page {
  width: 100%;
  max-width: 1250px;
  margin: 0 auto;
  min-width: 0;
  color: #142b4d;
}

/* PAGE HEADER */

.as-header {
  margin-bottom: 24px;
}

.as-eyebrow {
  color: #0759dc;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1px;
}

.as-header h1 {
  color: #142b4d !important;
  margin: 10px 0 8px;
  font-size: 27px;
}

.as-header p {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: #718096;
}

/* DESKTOP GRID */

.as-grid {
  display: grid;
  grid-template-columns:
    minmax(0, 0.85fr)
    minmax(0, 1.15fr);
  gap: 20px;
  align-items: start;
}

/* WHITE PANELS */

.as-panel {
  min-width: 0;
  padding: 24px;
  border: 1px solid #dfe7f2;
  border-radius: 15px;
  background: #ffffff;
}

.as-panel h2 {
  color: #142b4d !important;
  font-size: 19px;
  margin: 0 0 8px;
}

.as-description {
  color: #718096;
  font-size: 12px;
  line-height: 1.6;
  margin: 0 0 20px;
}

/* ADMIN AVATAR */

.as-avatar {
  display: grid;
  place-items: center;
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: #e8f1ff;
  color: #0759dc;
  font-size: 29px;
  font-weight: 800;
  margin-bottom: 18px;
}

/* ADMIN INFORMATION */

.as-info {
  margin: 0;
}

.as-info > div {
  display: grid;
  grid-template-columns:
    110px minmax(0, 1fr);
  gap: 10px;
  padding: 13px 0;
  border-top: 1px solid #edf1f7;
}

.as-info dt {
  color: #8190a6;
  font-size: 12px;
}

.as-info dd {
  color: #263d59;
  font-size: 13px;
  font-weight: 700;
  margin: 0;
  overflow-wrap: anywhere;
}

/* ACCOUNT STATUS */

.as-active,
.as-inactive {
  display: inline-block;
  padding: 6px 10px;
  border-radius: 50px;
  font-size: 11px;
}

.as-active {
  color: #087747;
  background: #e7f8ef;
}

.as-inactive {
  color: #b42338;
  background: #fff1f2;
}

/* CHANGE PASSWORD FORM */

.as-form {
  display: grid;
  gap: 16px;
}

.as-field {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.as-field label {
  font-size: 12px;
  font-weight: 750;
  color: #40536e;
}

/* PASSWORD INPUT AND SHOW/HIDE */

.as-input-row {
  display: flex;
  min-width: 0;
  overflow: hidden;
  border: 1px solid #d3e0f1;
  border-radius: 10px;
  background: #fbfcff;
}

.as-input-row:focus-within {
  border-color: #0759dc;
  box-shadow:
    0 0 0 3px rgba(7, 89, 220, .1);
}

.as-input-row input {
  flex: 1;
  width: 100%;
  min-width: 0;
  padding: 12px;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 14px;
  color: #142b4d;
}

.as-input-row button {
  padding: 0 12px;
  border: 0;
  border-left: 1px solid #dfe7f2;
  background: #f3f7ff;
  color: #0759dc;
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
}

/* SUBMIT BUTTON */

.as-submit {
  width: max-content;
  max-width: 100%;
  padding: 12px 18px;
  border: 1px solid #0759dc;
  border-radius: 10px;
  background: #0759dc;
  color: #ffffff;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}

.as-submit:hover {
  background: #0346b9;
}

.as-page button:disabled {
  opacity: .55;
  cursor: not-allowed;
}

/* ERROR MESSAGE */

.as-error {
  padding: 12px;
  background: #fff1f2;
  color: #a11435;
  border: 1px solid #fecdd3;
  border-radius: 9px;
  font-size: 12px;
  line-height: 1.5;
}

/* FOOTNOTE */

.as-note {
  color: #718096;
  font-size: 12px;
  line-height: 1.65;
  margin: 18px 0 0;
}

/* TABLET */

@media (max-width: 900px) {

  .as-grid {
    grid-template-columns: 1fr;
  }

}

/* MOBILE */

@media (max-width: 470px) {

  .as-panel {
    padding: 17px;
  }

  .as-header h1 {
    font-size: 23px;
  }

  .as-info > div {
    grid-template-columns:
      90px minmax(0, 1fr);
  }

  .as-submit {
    width: 100%;
  }

}

`;
