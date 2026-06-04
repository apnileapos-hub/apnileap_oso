import React from 'react';

export default function Sidebar({ activeView, onNavigate, onLogout, user }) {
  const isSuperAdmin = user?.role === 'Super-admin';
  const isSpokeSpoc = user?.role === 'College-SPOC';
  const userCollegeId = user?.collegeId;

  // Determine if a particular Spoke should be visible to this user
  const canViewSpoke = (spokeId) => {
    if (isSuperAdmin) return true;
    if ((isSpokeSpoc || user?.role === 'Faculty' || user?.role === 'Principal-Investigator') && userCollegeId === spokeId) return true;
    return false;
  };

  // Helper to determine the rail category and sub-menu state
  let activeCategory = '';
  let showSubMenu = false;
  let subMenuTitle = '';

  if (activeView === 'calls') {
    activeCategory = 'chat';
  } else if (activeView === 'meet') {
    activeCategory = 'meet';
  } else if (activeView === 'teams') {
    activeCategory = 'teams';
  } else if (activeView === 'simulator') {
    activeCategory = 'copilot';
  } else if (activeView === 'email-logs') {
    activeCategory = 'activity';
  } else if (activeView === 'settings') {
    activeCategory = 'settings';
  } else if (['dashboard', 'issues', 'analytics'].includes(activeView)) {
    activeCategory = 'jira';
    showSubMenu = true;
    subMenuTitle = 'JIRA & ANALYTICS';
  } else if (['executive-hub', 'moderator-portal', 'users', 'faculty-portal', 'mentor-portal'].includes(activeView) || activeView.startsWith('spoke-')) {
    activeCategory = 'portfolio';
    showSubMenu = true;
    subMenuTitle = 'ENTERPRISE DASHBOARDS';
  }

  const userInitials = user?.name ? user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'U';

  const handlePortfolioClick = () => {
    if (isSuperAdmin) {
      onNavigate('moderator-portal');
    } else {
      onNavigate('spoke-kle');
    }
  };

  return (
    <aside className="sidebar" style={{
      width: showSubMenu ? '248px' : '68px',
      display: 'flex',
      flexDirection: 'row',
      height: '100vh',
      background: '#161b22',
      borderRight: '1px solid #30363d',
      transition: 'width 0.15s ease',
      overflow: 'hidden',
      flexShrink: 0
    }}>
      {/* ── LEFT VERTICAL ICON RAIL (68px wide) ── */}
      <div style={{
        width: '68px',
        background: '#18191b',
        borderRight: '1px solid #2d2d2d',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        height: '100%',
        flexShrink: 0
      }}>
        {/* Top: Branding / Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
          <div 
            title="APNILEAP Workspace" 
            style={{ 
              width: '36px', 
              height: '36px', 
              borderRadius: '8px', 
              background: 'linear-gradient(135deg, rgba(88,166,255,0.2), rgba(31,111,235,0.3))', 
              border: '1px solid rgba(88,166,255,0.3)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            onClick={() => onNavigate('dashboard')}
          >
            <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
              <path d="M14 2L25 8V20L14 26L3 20V8L14 2Z" fill="rgba(88,166,255,0.3)" stroke="#58a6ff" strokeWidth="1.5"/>
              <path d="M14 7L21 11V17L14 21L7 17V11L14 7Z" fill="rgba(88,166,255,0.5)"/>
              <circle cx="14" cy="14" r="3" fill="#58a6ff"/>
            </svg>
          </div>

          <div style={{ width: '36px', height: '1px', background: '#2d2d2d' }} />

          {/* Navigation Icon List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', alignItems: 'center' }}>
            
            {/* 1. Jira / Dashboard Apps icon */}
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <div 
                onClick={() => onNavigate('dashboard')}
                title="Jira & Analytics"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: activeCategory === 'jira' ? '#292a2c' : 'transparent',
                  color: activeCategory === 'jira' ? '#fff' : '#8b949e',
                  transition: 'background 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => { if (activeCategory !== 'jira') e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { if (activeCategory !== 'jira') e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              {activeCategory === 'jira' && (
                <div style={{ position: 'absolute', left: 0, top: '8px', width: '3px', height: '24px', background: '#7f85f5', borderRadius: '0 4px 4px 0' }} />
              )}
            </div>

            {/* 2. Chat icon (filled gradient speech bubble) */}
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <div 
                onClick={() => onNavigate('calls')}
                title="Chat & Discussions"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: activeCategory === 'chat' ? '#292a2c' : 'transparent',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => { if (activeCategory !== 'chat') e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { if (activeCategory !== 'chat') e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <defs>
                    <linearGradient id="chatGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#7f85f5" />
                      <stop offset="100%" stopColor="#6264a7" />
                    </linearGradient>
                  </defs>
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2z" fill="url(#chatGrad)"/>
                  <path d="M7 8h10M7 12h10" stroke="#ffffff" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              {activeCategory === 'chat' && (
                <div style={{ position: 'absolute', left: 0, top: '8px', width: '3px', height: '24px', background: '#7f85f5', borderRadius: '0 4px 4px 0' }} />
              )}
            </div>

            {/* 3. Meet/Video Camera icon */}
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <div 
                onClick={() => onNavigate('meet')}
                title="Meet — Schedule & Join Meetings"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: activeCategory === 'meet' ? '#292a2c' : 'transparent',
                  color: activeCategory === 'meet' ? '#fff' : '#8b949e',
                  transition: 'background 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => { if (activeCategory !== 'meet') e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { if (activeCategory !== 'meet') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8b949e'; } }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              </div>
              {activeCategory === 'meet' && (
                <div style={{ position: 'absolute', left: 0, top: '8px', width: '3px', height: '24px', background: '#7f85f5', borderRadius: '0 4px 4px 0' }} />
              )}
            </div>

            {/* 4. Contacts Book icon (filled gradient book) */}
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <div 
                onClick={handlePortfolioClick}
                title="ApniLeap Portfolio (Spokes & HUB)"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: activeCategory === 'portfolio' ? '#292a2c' : 'transparent',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => { if (activeCategory !== 'portfolio') e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { if (activeCategory !== 'portfolio') e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <defs>
                    <linearGradient id="contactsGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#8c90f8" />
                      <stop offset="100%" stopColor="#5a5db8" />
                    </linearGradient>
                  </defs>
                  <rect x="5" y="3" width="15" height="18" rx="2" fill="url(#contactsGrad)" />
                  <rect x="2" y="5" width="3" height="2" rx="1" fill="#18191b" />
                  <rect x="2" y="11" width="3" height="2" rx="1" fill="#18191b" />
                  <rect x="2" y="17" width="3" height="2" rx="1" fill="#18191b" />
                  <circle cx="12.5" cy="9" r="2.5" fill="#ffffff" />
                  <path d="M8.5 15.5c0-1.8 1.8-3 4-3s4 1.2 4 3v1H8.5v-1z" fill="#ffffff" />
                </svg>
              </div>
              {activeCategory === 'portfolio' && (
                <div style={{ position: 'absolute', left: 0, top: '8px', width: '3px', height: '24px', background: '#7f85f5', borderRadius: '0 4px 4px 0' }} />
              )}
            </div>

            {/* 5. Copilot Ribbon icon (B2B Ingestion Portal) */}
            {(isSuperAdmin || user?.role === 'Admin') && (
              <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <div 
                  onClick={() => onNavigate('simulator')}
                  title="B2B Ingestion Simulator"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: activeCategory === 'copilot' ? '#292a2c' : 'transparent',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => { if (activeCategory !== 'copilot') e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { if (activeCategory !== 'copilot') e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <defs>
                      <linearGradient id="ribbonGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#3fb950" />
                        <stop offset="30%" stopColor="#58a6ff" />
                        <stop offset="70%" stopColor="#bc8cff" />
                        <stop offset="100%" stopColor="#ff7b72" />
                      </linearGradient>
                    </defs>
                    <path d="M4 16c-1.5-1.5-2.5-3.5-2.5-5.5S2.5 6.5 4 5s3.5-2.5 5.5-2.5 3.5 1 5 2.5l7 7c1.5 1.5 2.5 3.5 2.5 5.5s-1 3.5-2.5 5-3.5 2.5-5.5 2.5-3.5-1-5-2.5l-7-7z" stroke="url(#ribbonGrad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
                {activeCategory === 'copilot' && (
                  <div style={{ position: 'absolute', left: 0, top: '8px', width: '3px', height: '24px', background: '#7f85f5', borderRadius: '0 4px 4px 0' }} />
                )}
              </div>
            )}

            {/* 6. Teams / Workgroups icon */}
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <div 
                onClick={() => onNavigate('teams')}
                title="Teams / Workgroups"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: activeCategory === 'teams' ? '#292a2c' : 'transparent',
                  color: activeCategory === 'teams' ? '#fff' : '#8b949e',
                  transition: 'background 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => { if (activeCategory !== 'teams') e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={(e) => { if (activeCategory !== 'teams') e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              {activeCategory === 'teams' && (
                <div style={{ position: 'absolute', left: 0, top: '8px', width: '3px', height: '24px', background: '#7f85f5', borderRadius: '0 4px 4px 0' }} />
              )}
            </div>

            {/* 7. Calendar icon (opens Chat/Calls scheduling) */}
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <div 
                onClick={() => onNavigate('calls')}
                title="Calendar & Scheduled Meetings"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: '#8b949e',
                  transition: 'background 0.2s, color 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8b949e'; }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                  <circle cx="8" cy="14" r="0.75" fill="currentColor" />
                  <circle cx="12" cy="14" r="0.75" fill="currentColor" />
                  <circle cx="16" cy="14" r="0.75" fill="currentColor" />
                  <circle cx="8" cy="18" r="0.75" fill="currentColor" />
                  <circle cx="12" cy="18" r="0.75" fill="currentColor" />
                  <circle cx="16" cy="18" r="0.75" fill="currentColor" />
                </svg>
              </div>
            </div>

            {/* 8. Activity Bell icon (Automation logs) */}
            {(isSuperAdmin || user?.role === 'Admin') && (
              <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <div 
                  onClick={() => onNavigate('email-logs')}
                  title="Activity Logs & Alerts"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    background: activeCategory === 'activity' ? '#292a2c' : 'transparent',
                    color: activeCategory === 'activity' ? '#fff' : '#8b949e',
                    transition: 'background 0.2s, color 0.2s'
                  }}
                  onMouseEnter={(e) => { if (activeCategory !== 'activity') e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { if (activeCategory !== 'activity') e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9z" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
                {activeCategory === 'activity' && (
                  <div style={{ position: 'absolute', left: 0, top: '8px', width: '3px', height: '24px', background: '#7f85f5', borderRadius: '0 4px 4px 0' }} />
                )}
              </div>
            )}

          </div>
        </div>

        {/* Bottom: Settings, Logout, and User Profile */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', width: '100%' }}>
          
          {/* Settings gear */}
          {(isSuperAdmin || user?.role === 'Admin') && (
            <div 
              onClick={() => onNavigate('settings')}
              title="Settings"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                background: activeCategory === 'settings' ? '#292a2c' : 'transparent',
                color: activeCategory === 'settings' ? '#fff' : '#8b949e',
                transition: 'background 0.2s, color 0.2s'
              }}
              onMouseEnter={(e) => { if (activeCategory !== 'settings') e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { if (activeCategory !== 'settings') e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
          )}

          {/* Logout */}
          <div 
            onClick={onLogout}
            title="Sign Out"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#8b949e',
              transition: 'background 0.2s, color 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(248,81,73,0.1)'; e.currentTarget.style.color = '#ff7b72'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8b949e'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </div>

          {/* User Profile Avatar with Online indicator */}
          <div 
            title={`${user?.name || 'User'} (${user?.role || 'Guest'})`} 
            style={{ position: 'relative', width: '32px', height: '32px', cursor: 'pointer' }}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#1f6feb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '13px',
              border: '1px solid #30363d'
            }}>
              {userInitials}
            </div>
            <span style={{
              position: 'absolute',
              bottom: '-1px',
              right: '-1px',
              width: '10px',
              height: '10px',
              background: '#3fb950',
              border: '2px solid #18191b',
              borderRadius: '50%',
              boxShadow: '0 0 4px #3fb950'
            }} />
          </div>

        </div>
      </div>

      {/* ── RIGHT SUB-MENU COLUMN (180px wide) ── */}
      {showSubMenu && (
        <div style={{
          width: '180px',
          background: '#161b22',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '16px 8px',
          boxSizing: 'border-box'
        }}>
          {/* Sub-menu title */}
          <div style={{
            fontSize: '10px',
            fontWeight: '600',
            letterSpacing: '0.1em',
            color: '#484f58',
            textTransform: 'uppercase',
            padding: '0 12px 12px',
            borderBottom: '1px solid #30363d',
            marginBottom: '12px'
          }}>
            {subMenuTitle}
          </div>

          {/* Navigation Items list */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, overflowY: 'auto' }}>
            
            {/* Jira submenu */}
            {subMenuTitle === 'JIRA & ANALYTICS' && (
              <>
                <button
                  className={`sidebar-nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
                  onClick={() => onNavigate('dashboard')}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: '500',
                    borderRadius: '6px',
                    border: 'none',
                    background: activeView === 'dashboard' ? 'rgba(98, 100, 167, 0.2)' : 'transparent',
                    color: activeView === 'dashboard' ? '#7f85f5' : '#c9d1d9',
                    textAlign: 'left',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  Student Dashboard
                </button>

                <button
                  className={`sidebar-nav-item ${activeView === 'issues' ? 'active' : ''}`}
                  onClick={() => onNavigate('issues')}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: '500',
                    borderRadius: '6px',
                    border: 'none',
                    background: activeView === 'issues' ? 'rgba(98, 100, 167, 0.2)' : 'transparent',
                    color: activeView === 'issues' ? '#7f85f5' : '#c9d1d9',
                    textAlign: 'left',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  Kanban Board
                </button>

                <button
                  className={`sidebar-nav-item ${activeView === 'analytics' ? 'active' : ''}`}
                  onClick={() => onNavigate('analytics')}
                  style={{
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: '500',
                    borderRadius: '6px',
                    border: 'none',
                    background: activeView === 'analytics' ? 'rgba(98, 100, 167, 0.2)' : 'transparent',
                    color: activeView === 'analytics' ? '#7f85f5' : '#c9d1d9',
                    textAlign: 'left',
                    cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  Playground (Jira)
                </button>
              </>
            )}

            {/* Portfolio submenu */}
            {subMenuTitle === 'ENTERPRISE DASHBOARDS' && (
              <>
                {isSuperAdmin && (
                  <button
                    className={`sidebar-nav-item ${activeView === 'executive-hub' ? 'active' : ''}`}
                    onClick={() => onNavigate('executive-hub')}
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: '500',
                      borderRadius: '6px',
                      border: 'none',
                      background: activeView === 'executive-hub' ? 'rgba(98, 100, 167, 0.2)' : 'transparent',
                      color: activeView === 'executive-hub' ? '#7f85f5' : '#c9d1d9',
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                      marginBottom: '4px'
                    }}
                  >
                    🌐 University Dashboard
                  </button>
                )}

                {isSuperAdmin && (
                  <button
                    className={`sidebar-nav-item ${activeView === 'moderator-portal' ? 'active' : ''}`}
                    onClick={() => onNavigate('moderator-portal')}
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: '500',
                      borderRadius: '6px',
                      border: 'none',
                      background: activeView === 'moderator-portal' ? 'rgba(98, 100, 167, 0.2)' : 'transparent',
                      color: activeView === 'moderator-portal' ? '#7f85f5' : '#c9d1d9',
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                      marginBottom: '4px'
                    }}
                  >
                    👑 Super Admin Dashboard
                  </button>
                )}

                {isSuperAdmin && (
                  <button
                    className={`sidebar-nav-item ${activeView === 'users' ? 'active' : ''}`}
                    onClick={() => onNavigate('users')}
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: '500',
                      borderRadius: '6px',
                      border: 'none',
                      background: activeView === 'users' ? 'rgba(98, 100, 167, 0.2)' : 'transparent',
                      color: activeView === 'users' ? '#7f85f5' : '#c9d1d9',
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                      marginBottom: '4px'
                    }}
                  >
                    👥 Manage Users
                  </button>
                )}

                {(isSuperAdmin || user?.role === 'Faculty' || user?.role === 'Principal-Investigator') && (
                  <button
                    className={`sidebar-nav-item ${activeView === 'faculty-portal' ? 'active' : ''}`}
                    onClick={() => onNavigate('faculty-portal')}
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: '500',
                      borderRadius: '6px',
                      border: 'none',
                      background: activeView === 'faculty-portal' ? 'rgba(98, 100, 167, 0.2)' : 'transparent',
                      color: activeView === 'faculty-portal' ? '#7f85f5' : '#c9d1d9',
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                      marginBottom: '4px'
                    }}
                  >
                    🎓 Faculty Dashboard
                  </button>
                )}

                {(isSuperAdmin || user?.role === 'Corporate-Mentor' || user?.role === 'Sponsor') && (
                  <button
                    className={`sidebar-nav-item ${activeView === 'mentor-portal' ? 'active' : ''}`}
                    onClick={() => onNavigate('mentor-portal')}
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: '500',
                      borderRadius: '6px',
                      border: 'none',
                      background: activeView === 'mentor-portal' ? 'rgba(98, 100, 167, 0.2)' : 'transparent',
                      color: activeView === 'mentor-portal' ? '#7f85f5' : '#c9d1d9',
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                      marginBottom: '4px'
                    }}
                  >
                    💼 Company Dashboard
                  </button>
                )}

                {canViewSpoke('kle-spoke') && (
                  <button
                    className={`sidebar-nav-item ${activeView === 'spoke-kle' ? 'active' : ''}`}
                    onClick={() => onNavigate('spoke-kle')}
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: '500',
                      borderRadius: '6px',
                      border: 'none',
                      background: activeView === 'spoke-kle' ? 'rgba(98, 100, 167, 0.2)' : 'transparent',
                      color: activeView === 'spoke-kle' ? '#7f85f5' : '#c9d1d9',
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                      marginBottom: '4px'
                    }}
                  >
                    🏢 Spoke SPOC (KLE)
                  </button>
                )}

                {canViewSpoke('coep-spoke') && (
                  <button
                    className={`sidebar-nav-item ${activeView === 'spoke-coep' ? 'active' : ''}`}
                    onClick={() => onNavigate('spoke-coep')}
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: '500',
                      borderRadius: '6px',
                      border: 'none',
                      background: activeView === 'spoke-coep' ? 'rgba(98, 100, 167, 0.2)' : 'transparent',
                      color: activeView === 'spoke-coep' ? '#7f85f5' : '#c9d1d9',
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                      marginBottom: '4px'
                    }}
                  >
                    🏢 Spoke SPOC (COEP)
                  </button>
                )}

                {canViewSpoke('mmcoep-spoke') && (
                  <button
                    className={`sidebar-nav-item ${activeView === 'spoke-mmcoep' ? 'active' : ''}`}
                    onClick={() => onNavigate('spoke-mmcoep')}
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: '500',
                      borderRadius: '6px',
                      border: 'none',
                      background: activeView === 'spoke-mmcoep' ? 'rgba(98, 100, 167, 0.2)' : 'transparent',
                      color: activeView === 'spoke-mmcoep' ? '#7f85f5' : '#c9d1d9',
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                      marginBottom: '4px'
                    }}
                  >
                    🏢 Spoke SPOC (MMCOEP)
                  </button>
                )}

                {canViewSpoke('rit-spoke') && (
                  <button
                    className={`sidebar-nav-item ${activeView === 'spoke-rit' ? 'active' : ''}`}
                    onClick={() => onNavigate('spoke-rit')}
                    style={{
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: '500',
                      borderRadius: '6px',
                      border: 'none',
                      background: activeView === 'spoke-rit' ? 'rgba(98, 100, 167, 0.2)' : 'transparent',
                      color: activeView === 'spoke-rit' ? '#7f85f5' : '#c9d1d9',
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                      marginBottom: '4px'
                    }}
                  >
                    🏢 Spoke SPOC (RIT)
                  </button>
                )}
              </>
            )}

          </nav>
        </div>
      )}
    </aside>
  );
}
