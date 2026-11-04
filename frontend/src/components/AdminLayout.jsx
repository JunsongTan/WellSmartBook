import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';



const LINKS = [
    {
        to: '/admin/dashboard',
        icon: '▦',
        label: 'Dashboard'
    },
    {
        to: '/admin/accounts',
        icon: '♙',
        label: 'Manage Users & Coaches'
    },
    {
        to: '/admin/gyms',
        icon: '⌖',
        label: 'Gym Oversight'
    },
    {
        to: '/admin/booking-transactions',
        icon: '▤',
        label: 'Booking Transactions'
    }
];



export default function AdminLayout() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  let storedUser = null;
  try {
    storedUser = JSON.parse(localStorage.getItem('user') || 'null');
  } catch { /* Ignore invalid cached user. */ }
  const displayName = storedUser?.username || 'Administrator';

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  }

  return (
    <div className="adm-layout">
      <style>{css}</style>

      <button
        type="button"
        className="adm-mobile-menu"
        onClick={() => setMenuOpen(open => !open)}
        aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={menuOpen}
      >
        {menuOpen ? '✕' : '☰'}
      </button>

      {menuOpen && (
        <button
          type="button"
          className="adm-overlay"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      <aside className={`adm-sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="adm-brand">
          <div className="adm-logo">♥</div>
          <div>
            <strong>WellSmartBook</strong>
            <span>Admin Portal</span>
          </div>
        </div>

        <div className="adm-section-name">MANAGEMENT</div>
        <nav className="adm-nav" aria-label="Admin navigation">
          {LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `adm-nav-link ${isActive ? 'active' : ''}`
              }
            >
              <span className="adm-nav-icon" aria-hidden="true">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}

        </nav>

        <div className="adm-sidebar-bottom">
          
            <NavLink
            to="/admin/settings"
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
                `adm-nav-link ${isActive ? 'active' : ''}`
            }
            >
            <span
                className="adm-nav-icon"
                aria-hidden="true"
            >
                ⚙
            </span>

            Settings
            </NavLink>

          <button className="adm-logout" type="button" onClick={logout}>
            <span aria-hidden="true">↪</span> Logout
          </button>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-topbar">
          <div className="adm-topbar-copy">
            <strong>Admin Portal</strong>
            <small>WellSmartBook System Management</small>
          </div>
          <div className="adm-account">
            <span className="adm-account-icon" aria-hidden="true">A</span>
            <div>
              <strong>{displayName}</strong>
              <small>Administrator</small>
            </div>
          </div>
        </header>
        <main className="adm-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const css = `
.adm-layout, .adm-layout * { box-sizing: border-box; }
.adm-layout { display: grid; grid-template-columns: 252px minmax(0,1fr); min-height: 100vh; background:#f5f7fc; color:#142b4d; font-family:Inter,"Segoe UI",Arial,sans-serif; }
.adm-sidebar { position:sticky; top:0; height:100vh; display:flex; flex-direction:column; gap:0; padding:24px 16px; background:#fff; border-right:1px solid #dfe7f2; z-index:41; }
.adm-brand { display:flex; align-items:center; gap:12px; padding:0 6px 32px; }
.adm-logo { width:46px; height:46px; flex-shrink:0; border-radius:13px; display:grid; place-items:center; color:white; background:#0759dc; font-size:23px; }
.adm-brand strong { display:block; font-size:18px; font-weight:800; color:#0759dc; white-space:nowrap; }
.adm-brand span { display:block; margin-top:6px; font-size:11px; color:#8b9aad; }
.adm-section-name { font-size:10px; font-weight:800; letter-spacing:1.1px; color:#99a5b9; padding:3px 13px 14px; }
.adm-nav { display:grid; gap:6px; }
.adm-nav-link, .adm-nav-disabled, .adm-logout { display:flex; align-items:center; gap:11px; min-height:46px; padding:0 13px; border:0; border-radius:11px; color:#50637d; background:none; font:600 12px inherit; font-size:12px; font-weight:650; text-decoration:none; text-align:left; }
.adm-nav-link:hover { background:#f2f6ff; color:#0759dc; }
.adm-nav-link.active { color:#0759dc; background:#e9f1ff; font-weight:800; }
.adm-nav-icon, .adm-nav-disabled > span, .adm-logout > span { flex-shrink:0; width:20px; text-align:center; font-size:18px; }
.adm-nav-disabled { opacity:.55; cursor:default; }
.adm-nav-disabled small { margin-left:auto; font-size:9px; color:#91a0b2; }
.adm-sidebar-bottom { margin-top:auto; display:grid; gap:6px; }
.adm-logout { cursor:pointer; color:#dc2626; width:100%; font-family:inherit; }
.adm-logout:hover { background:#fff1f2; }
.adm-main { min-width:0; }
.adm-topbar { position:sticky; top:0; z-index:20; display:flex; justify-content:space-between; align-items:center; gap:12px; min-height:76px; padding:14px 30px; background:white; border-bottom:1px solid #dfe7f2; }
.adm-topbar-copy strong, .adm-topbar-copy small { display:block; }
.adm-topbar-copy strong { color:#1d2e49; font-size:15px; }
.adm-topbar-copy small { margin-top:6px; color:#94a3b8; font-size:10px; }
.adm-account { display:flex; align-items:center; gap:9px; min-width:0; }
.adm-account-icon { flex-shrink:0; display:grid; place-items:center; height:35px; width:35px; background:#e8f1ff; color:#0759dc; border-radius:50%; font-weight:800; }
.adm-account strong,.adm-account small { display:block; text-align:right; }
.adm-account strong { font-size:12px; max-width:150px; overflow:hidden; text-overflow:ellipsis; }
.adm-account small { font-size:10px; margin-top:4px; color:#94a3b8; }
.adm-content { padding:30px; width:100%; min-width:0; }
.adm-mobile-menu { display:none; }
.adm-overlay { display:none; }
@media (max-width: 900px) {
  .adm-layout { grid-template-columns: 1fr; }
  .adm-sidebar { position:fixed; left:0; top:0; width:min(285px,85vw); transform:translateX(-105%); transition:transform .2s ease; box-shadow:5px 0 22px rgba(8,27,53,.1); }
  .adm-sidebar.open { transform:translateX(0); }
  .adm-mobile-menu { position:fixed; top:18px; left:14px; z-index:55; display:grid; place-items:center; width:36px; height:36px; border:1px solid #dce6f5; border-radius:9px; color:#0759dc; background:white; font-size:21px; cursor:pointer; }
  .adm-overlay { display:block; position:fixed; inset:0; z-index:35; width:100%; height:100%; border:0; background:rgba(9,24,43,.45); }
  .adm-topbar { padding-left:62px; padding-right:16px; }
  .adm-content { padding:22px 16px; }
}
@media (max-width: 470px) {
  .adm-topbar { min-height:68px; }
  .adm-account-icon { height:30px; width:30px; }
  .adm-account small, .adm-topbar-copy small { display:none; }
  .adm-topbar-copy strong { font-size:13px; }
  .adm-account strong { max-width:92px; font-size:11px; }
}
`;
