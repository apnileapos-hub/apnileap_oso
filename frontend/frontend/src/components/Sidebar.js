import React from 'react';

const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    id: 'issues',
    label: 'Issues',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M1 13L5 8L8 11L11 6L15 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

const BOTTOM_ITEMS = [
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function Sidebar({ activeView, onNavigate, onLogout }) {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
            <path d="M14 2L25 8V20L14 26L3 20V8L14 2Z" fill="rgba(88,166,255,0.3)" stroke="#58a6ff" strokeWidth="1.5"/>
            <path d="M14 7L21 11V17L14 21L7 17V11L14 7Z" fill="rgba(88,166,255,0.5)"/>
            <circle cx="14" cy="14" r="3" fill="#58a6ff"/>
          </svg>
        </div>
        <div>
          <div className="sidebar-logo-text">DevCobra</div>
          <div className="sidebar-logo-sub">Analytics Platform</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Main Menu</div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
            {item.id === 'issues' && <span className="nav-badge">Live</span>}
          </button>
        ))}

        <div className="sidebar-section-label" style={{ marginTop: '20px' }}>System</div>
        {BOTTOM_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${activeView === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}

        <button className="sidebar-nav-item sidebar-logout-btn" onClick={onLogout}>
          <span className="nav-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          Sign Out
        </button>
      </nav>

      {/* Footer badge */}
      <div className="sidebar-footer">
        <div className="sidebar-jira-badge">
          <div className="jira-dot" />
          <div>
            <div className="jira-badge-text">Jira Connected</div>
            <div className="jira-badge-site">devcobraaa.atlassian.net</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
