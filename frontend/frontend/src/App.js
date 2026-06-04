import React, { useState, useEffect } from 'react';
import LoginPage from './components/LoginPage';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import CreateIssueModal from './components/CreateIssueModal';
import IssueDetailsModal from './components/IssueDetailsModal';
import RovoChatbot from './components/RovoChatbot';

// Apni Leap B2B views
import ModeratorPortalView from './components/ModeratorPortalView';
import ExecutiveHubView from './components/ExecutiveHubView';
import SpokeBoardView from './components/SpokeBoardView';
import CompanySimulatorView from './components/CompanySimulatorView';
import AutomationLogsView from './components/AutomationLogsView';
import FacultyPortalView from './components/FacultyPortalView';
import MentorPortalView from './components/MentorPortalView';

import './App.css';

// ── localStorage helpers ──────────────────────────────────────────────────────
const STORAGE_KEY_AUTH = 'dc_auth';
const STORAGE_KEY_USER = 'dc_user';

function loadAuth() {
  try {
    return localStorage.getItem(STORAGE_KEY_AUTH) === 'true';
  } catch {
    return false;
  }
}

function loadUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_USER);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveSession(user) {
  try {
    localStorage.setItem(STORAGE_KEY_AUTH, 'true');
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
  } catch { /* storage unavailable */ }
}

function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY_AUTH);
    localStorage.removeItem(STORAGE_KEY_USER);
  } catch { /* storage unavailable */ }
}

// ── Relative time helper for notifications ────────────────────────────────────
function getRelativeTime(dateString) {
  if (!dateString) return 'Recent';
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// ── Generate notifications based on loaded Jira issues ────────────────────────
function generateNotifications(issuesList) {
  const list = [];
  if (!Array.isArray(issuesList)) return list;

  // Sort issues by updated date desc to show freshest items first
  const sortedIssues = [...issuesList].sort((a, b) => {
    const dateA = new Date(a.fields?.updated || a.fields?.created || 0);
    const dateB = new Date(b.fields?.updated || b.fields?.created || 0);
    return dateB - dateA;
  });

  sortedIssues.forEach(issue => {
    const key = issue.key;
    const summary = issue.fields?.summary || 'No Summary';
    const status = issue.fields?.status?.name || 'To Do';
    const priority = issue.fields?.priority?.name;
    const assignee = issue.fields?.assignee?.displayName;
    const updated = issue.fields?.updated || issue.fields?.created;

    // 1. Highest/High Priority Tasks (excluding completed ones)
    if (priority === 'Highest' || priority === 'High') {
      const s = status.toLowerCase();
      if (!s.includes('done') && !s.includes('closed') && !s.includes('resolved')) {
        list.push({
          id: `priority-${key}`,
          title: `Critical Alert: ${key}`,
          desc: `"${summary}" is marked High Priority (${status})`,
          type: 'alert',
          time: getRelativeTime(updated),
          read: false
        });
      }
    }

    // 2. Unassigned Tasks (excluding completed ones)
    if (!assignee) {
      const s = status.toLowerCase();
      if (!s.includes('done') && !s.includes('closed') && !s.includes('resolved')) {
        list.push({
          id: `unassigned-${key}`,
          title: `Unassigned Task: ${key}`,
          desc: `"${summary}" needs an owner.`,
          type: 'warning',
          time: getRelativeTime(updated),
          read: false
        });
      }
    }

    // 3. New issues created recently (within last 7 days)
    const createdDate = new Date(issue.fields?.created);
    const ageDays = (new Date() - createdDate) / (1000 * 60 * 60 * 24);
    if (ageDays <= 7) {
      list.push({
        id: `created-${key}`,
        title: `New Task Sync: ${key}`,
        desc: `"${summary}" was added to Jira.`,
        type: 'success',
        time: getRelativeTime(issue.fields?.created),
        read: false
      });
    }
  });

  // De-duplicate by ID
  const seenIds = new Set();
  const uniqueList = [];
  for (const item of list) {
    if (!seenIds.has(item.id)) {
      seenIds.add(item.id);
      uniqueList.push(item);
    }
  }

  return uniqueList.slice(0, 10);
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  // ✅ Initialise from localStorage so a page refresh keeps the user logged in
  const [isAuthenticated, setIsAuthenticated] = useState(loadAuth);
  const [user, setUser]                       = useState(loadUser);

  const [activeView, setActiveView]   = useState('dashboard');
  const [refreshKey, setRefreshKey]   = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  
  const [notifications, setNotifications] = useState([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);

  // Subscribe to real-time Server-Sent Events (SSE) updates
  useEffect(() => {
    if (!isAuthenticated) return;

    const eventSource = new EventSource('/api/realtime');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("📡 Real-time update received:", data);
        if (data.event === 'PROJECT_AWARDED') {
          handleRefresh();
        }
      } catch (err) {
        // Ping or malformed json, ignore
      }
    };

    return () => {
      eventSource.close();
    };
  }, [isAuthenticated]);

  const handleLogin = (userData) => {
    saveSession(userData);          // persist to localStorage
    setUser(userData);
    setIsAuthenticated(true);

    // Dynamic redirection based on user role
    if (userData?.role === 'Super-admin') {
      setActiveView('moderator-portal');
    } else if (userData?.role === 'College-SPOC') {
      if (userData?.collegeId === 'coep-spoke' || userData?.collegeId === '101') {
        setActiveView('spoke-coep');
      } else if (userData?.collegeId === 'mmcoep-spoke' || userData?.collegeId === '102') {
        setActiveView('spoke-mmcoep');
      } else if (userData?.collegeId === 'rit-spoke' || userData?.collegeId === '103') {
        setActiveView('spoke-rit');
      } else {
        setActiveView('spoke-kle');
      }
    } else if (userData?.role === 'Faculty' || userData?.role === 'Principal-Investigator') {
      setActiveView('faculty-portal');
    } else if (userData?.role === 'Corporate-Mentor' || userData?.role === 'Sponsor') {
      setActiveView('mentor-portal');
    } else {
      setActiveView('dashboard');
    }
  };

  const handleLogout = () => {
    clearSession();                 // wipe localStorage
    setUser(null);
    setIsAuthenticated(false);
    setActiveView('dashboard');
    setLastUpdated(null);
    setNotifications([]);
  };

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  // Sync / merge fetched issues to generate/update notifications
  const handleIssuesLoaded = (issuesList) => {
    const freshNotifs = generateNotifications(issuesList);
    setNotifications((prevNotifs) => {
      return freshNotifs.map((newN) => {
        const existing = prevNotifs.find((p) => p.id === newN.id);
        if (existing) {
          return { ...newN, read: existing.read };
        }
        return newN;
      });
    });

    if (selectedIssue) {
      const freshIssue = issuesList.find(i => i.key === selectedIssue.key);
      if (freshIssue) {
        setSelectedIssue(freshIssue);
      }
    }
  };

  // ── Unauthenticated — show login ───────────────────────────────────────────
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // ── Authenticated — show dashboard ─────────────────────────────────────────
  return (
    <div className="dashboard-layout">
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        onLogout={handleLogout}
        user={user}
      />
      <div className="main-area">
        <Header
          user={user}
          activeView={activeView}
          onLogout={handleLogout}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
          notifications={notifications}
          setNotifications={setNotifications}
          onCreateIssueClick={() => setIsCreateModalOpen(true)}
        />
        <div className="dashboard-content">
          {activeView === 'moderator-portal' && <ModeratorPortalView user={user} onRefresh={handleRefresh} />}
          {activeView === 'executive-hub' && <ExecutiveHubView user={user} />}
          {activeView === 'faculty-portal' && <FacultyPortalView user={user} />}
          {activeView === 'mentor-portal' && <MentorPortalView user={user} />}
          {activeView.startsWith('spoke-') && <SpokeBoardView user={user} spokeId={activeView.replace('spoke-', '') + '-spoke'} onRefresh={handleRefresh} />}
          {activeView === 'simulator' && <CompanySimulatorView onRefresh={handleRefresh} />}
          {activeView === 'email-logs' && <AutomationLogsView user={user} />}

          {['dashboard', 'issues', 'analytics', 'teams', 'calls', 'meet', 'settings'].includes(activeView) && (
            <Dashboard
              activeView={activeView}
              refreshKey={refreshKey}
              onFetchStart={() => setIsRefreshing(true)}
              onFetchEnd={(ts) => {
                setIsRefreshing(false);
                setLastUpdated(ts);
              }}
              onIssuesLoaded={handleIssuesLoaded}
              user={user}
              onIssueClick={setSelectedIssue}
            />
          )}
        </div>
      </div>
      <CreateIssueModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onRefresh={handleRefresh}
      />
      {selectedIssue && (
        <IssueDetailsModal
          issue={selectedIssue}
          user={user}
          onClose={() => setSelectedIssue(null)}
          onRefresh={handleRefresh}
        />
      )}
      <RovoChatbot />
    </div>
  );
}

export default App;