import React, { useState, useEffect, useRef } from 'react';

const VIEW_TITLES = {
  dashboard: { title: 'Dashboard Overview',    subtitle: 'SCRUM project · devcobraaa.atlassian.net · Real-time data' },
  issues:    { title: 'Issue Tracker',          subtitle: 'All Jira issues — searchable & sortable' },
  analytics: { title: 'Analytics',             subtitle: 'Charts, trends and workload distribution' },
  settings:  { title: 'Settings',              subtitle: 'Application preferences' },
  calls:     { title: 'Chat',                   subtitle: 'Direct discussions & meeting channels' },
  teams:     { title: 'Teams Workspace',        subtitle: 'Colleague workgroups & backlog tracking' },
};

export default function Header({ user, activeView, onLogout, onRefresh, isRefreshing, lastUpdated, notifications = [], setNotifications, onCreateIssueClick, theme, toggleTheme }) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [jiraProjectKey, setJiraProjectKey] = useState('SCRUM');
  const [jiraBaseUrl, setJiraBaseUrl] = useState('devcobraaa.atlassian.net');
  const menuRef = useRef(null);
  const notifMenuRef = useRef(null);

  useEffect(() => {
    const API = process.env.REACT_APP_API_URL || (window.location.port === '3000' ? 'http://localhost:5000' : '');
    fetch(`${API}/settings`)
      .then(res => res.json())
      .then(data => {
        if (data.jiraProjectKey) setJiraProjectKey(data.jiraProjectKey);
        if (data.jiraBaseUrl) {
          const cleanUrl = data.jiraBaseUrl.replace(/^https?:\/\//, '');
          setJiraBaseUrl(cleanUrl);
        }
      })
      .catch(err => console.warn("Failed to load header JIRA settings", err));
  }, []);
  
  const { title } = VIEW_TITLES[activeView] || VIEW_TITLES.dashboard;
  const dynamicSubtitle = activeView === 'dashboard' 
    ? `${jiraProjectKey} project · ${jiraBaseUrl} · Real-time data`
    : (VIEW_TITLES[activeView] || VIEW_TITLES.dashboard).subtitle;

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target)) {
        setShowNotifMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMarkAllRead = (e) => {
    e.stopPropagation();
    if (setNotifications) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const handleNotifClick = (id) => {
    if (setNotifications) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case 'alert':
        return (
          <span className="notif-icon-wrap notif-icon-alert" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5.2" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M6 3.5v3M6 8.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </span>
        );
      case 'warning':
        return (
          <span className="notif-icon-wrap notif-icon-warning" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1.5L1.5 9.5h9L6 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              <path d="M6 4.5v2M6 8v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </span>
        );
      case 'success':
        return (
          <span className="notif-icon-wrap notif-icon-success" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6.2L5 8.7l4.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        );
      default:
        return (
          <span className="notif-icon-wrap notif-icon-info" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5.2" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M6 5.5v3.2M6 3.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </span>
        );
    }
  };

  return (
    <header className="dashboard-header">
      {/* Left: page title */}
      <div className="header-left">
        <div className="header-title">{title}</div>
        <div className="header-subtitle">{dynamicSubtitle}</div>
      </div>

      {/* Right: actions + user */}
      <div className="header-right">
        {lastUpdated && (
          <div className="header-timestamp">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginRight: 4 }}>
              <circle cx="6" cy="6" r="5" stroke="#484f58" strokeWidth="1"/>
              <path d="M6 3v3l2 1.5" stroke="#484f58" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            Updated {lastUpdated}
          </div>
        )}

        <button
          id="refresh-data-btn"
          className={`refresh-btn ${isRefreshing ? 'spinning' : ''}`}
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <span className="refresh-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M12 7A5 5 0 1 1 7 2a5 5 0 0 1 3.5 1.5L12 2v4H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
          {isRefreshing ? 'Refreshing…' : 'Refresh Data'}
        </button>

        <button
          id="create-issue-btn"
          className="create-issue-btn"
          onClick={onCreateIssueClick}
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={{ marginRight: 2 }}>
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Create Issue
        </button>

        {/* Notification bell + dropdown */}
        <div className="notif-menu-wrap" ref={notifMenuRef}>
          <button 
            className="header-icon-btn" 
            title="Notifications"
            onClick={() => setShowNotifMenu(v => !v)}
            aria-expanded={showNotifMenu}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 2a5 5 0 0 1 5 5v3l1.5 2.5H2.5L4 10V7a5 5 0 0 1 5-5Z" stroke={showNotifMenu ? "#58a6ff" : "#8b949e"} strokeWidth="1.2"/>
              <path d="M7 14.5a2 2 0 0 0 4 0" stroke={showNotifMenu ? "#58a6ff" : "#8b949e"} strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            {unreadCount > 0 && <span className="notif-dot" />}
          </button>

          {showNotifMenu && (
            <div className="notif-dropdown">
              <div className="notif-dropdown-header">
                <div className="notif-dropdown-title">
                  Notifications
                  {unreadCount > 0 && <span className="notif-count-badge">{unreadCount} new</span>}
                </div>
                {unreadCount > 0 && (
                  <button className="notif-mark-read-btn" onClick={handleMarkAllRead}>
                    Mark all as read
                  </button>
                )}
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.4 }}>
                      <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2Z" fill="currentColor"/>
                      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div className="notif-empty-text">No notifications found</div>
                  </div>
                ) : (
                  notifications.map(n => (
                    <button 
                      key={n.id} 
                      className={`notif-item ${!n.read ? 'unread' : ''}`}
                      onClick={() => handleNotifClick(n.id)}
                    >
                      {getNotifIcon(n.type)}
                      <div className="notif-content-wrap">
                        <div className="notif-item-title">{n.title}</div>
                        <div className="notif-item-desc">{n.desc}</div>
                        <div className="notif-item-time">{n.time}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User avatar + dropdown */}
        <div className="user-menu-wrap" ref={menuRef}>
          <button
            id="user-avatar-btn"
            className="user-avatar-btn"
            onClick={() => setShowUserMenu((v) => !v)}
            aria-expanded={showUserMenu}
          >
            <div className="avatar">{user?.avatar || '?'}</div>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#8b949e' }}>
              <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {showUserMenu && (
            <div className="user-dropdown">
              <div className="user-dropdown-header">
                <div className="avatar avatar-lg">{user?.avatar}</div>
                <div>
                  <div className="user-dropdown-name">{user?.name}</div>
                  <div className="user-dropdown-email">{user?.email}</div>
                  <div className="user-dropdown-role">{user?.role}</div>
                </div>
              </div>
              <div className="user-dropdown-divider" />
              <button className="user-dropdown-item">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="5" r="3" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M1 13c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                My Profile
              </button>
              <button className="user-dropdown-item" onClick={toggleTheme}>
                {theme === 'dark' ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M7 1v2M7 11v2M1 7h2M11 7h2M2.9 2.9l1.4 1.4M9.7 9.7l1.4 1.4M2.9 11.1l1.4-1.4M9.7 4.3l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    Light Mode
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M12 7a5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5c.34 0 .67.03 1 .1A5.5 5.5 0 0 0 7.5 7.5a5.5 5.5 0 0 0 5.4-3.5c.07.33.1.66.1 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Dark Mode
                  </>
                )}
              </button>
              <div className="user-dropdown-divider" />
              <button className="user-dropdown-item user-dropdown-logout" onClick={onLogout}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 2H3a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2M9 10l3-3-3-3M12 7H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
