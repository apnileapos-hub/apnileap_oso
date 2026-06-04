import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import KPICards from './KPICards';
import StatusPieChart from './StatusPieChart';
import AssigneeBarChart from './AssigneeBarChart';
import IssueTable from './IssueTable';
import TeamsView from './TeamsView';
import CallsView from './CallsView';
import MeetView from './MeetView';

// Empty string = relative URL (same origin).
// In dev the CRA proxy forwards /api calls to localhost:5000.
// In production Express serves both the API and the React build on the same port.
// If running on port 3000 (React dev server), call backend on port 5000 directly via CORS.
// Otherwise (production single-server mode), use relative URLs.
const API = process.env.REACT_APP_API_URL || 
  (window.location.port === '3000' ? 'http://localhost:5000' : '');

function ErrorBanner({ message, onRetry }) {
  return (
    <div className="error-banner">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="8" stroke="#f85149" strokeWidth="1.4"/>
        <path d="M9 5v5M9 12.5v.5" stroke="#f85149" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <div>
        <div className="error-banner-title">Failed to load Jira data</div>
        <div className="error-banner-msg">{message}</div>
      </div>
      <button className="error-retry-btn" onClick={onRetry}>Try again</button>
    </div>
  );
}

export default function Dashboard({ activeView, refreshKey, onFetchStart, onFetchEnd, onIssuesLoaded, user, onIssueClick, theme, toggleTheme }) {
  const [metrics, setMetrics]       = useState(null);
  const [statusData, setStatusData] = useState([]);
  const [assigneeData, setAssigneeData] = useState([]);
  const [issues, setIssues]         = useState([]);
  const [settings, setSettings]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  // ── Atlassian connection form state ─────────────────────────────────────────
  const [siteUrl, setSiteUrl]       = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [email, setEmail]           = useState('');
  const [apiToken, setApiToken]     = useState('');
  const [orgId, setOrgId]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [showToken, setShowToken]   = useState(false);

  useEffect(() => {
    if (settings) {
      setSiteUrl(settings.jiraBaseUrl || '');
      setProjectKey(settings.jiraProjectKey || '');
      setEmail(settings.jiraEmail || '');
      setOrgId(settings.atlassianOrgId || '');
      setApiToken(settings.jiraApiToken || '');
    }
  }, [settings]);

  const handleSaveConnection = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await axios.post(`${API}/settings`, {
        jiraBaseUrl: siteUrl,
        jiraProjectKey: projectKey,
        jiraEmail: email,
        atlassianOrgId: orgId,
        jiraApiToken: apiToken
      });
      setSaveStatus({ type: 'success', message: res.data.message || 'Connection configured successfully!' });
      setTimeout(() => {
        setSaveStatus(null);
        window.location.reload();
      }, 2000);
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message;
      setSaveStatus({ type: 'error', message: errMsg });
    } finally {
      setSaving(false);
    }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    onFetchStart?.();

    try {
      const [metricsRes, statusRes, assigneeRes, issuesRes, settingsRes] = await Promise.all([
        axios.get(`${API}/dashboard-metrics`),
        axios.get(`${API}/status-summary`),
        axios.get(`${API}/assignee-summary`),
        axios.get(`${API}/issues`),
        axios.get(`${API}/settings`),
      ]);

      setMetrics(metricsRes.data);
      setStatusData(statusRes.data);
      setAssigneeData(assigneeRes.data);
      setSettings(settingsRes.data);
      const fetchedIssues = Array.isArray(issuesRes.data) ? issuesRes.data : [];
      setIssues(fetchedIssues);
      onIssuesLoaded?.(fetchedIssues);

      const now = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      onFetchEnd?.(now);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data || err.message;
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      onFetchEnd?.(null);
    } finally {
      setLoading(false);
    }
  }, [onFetchStart, onFetchEnd, onIssuesLoaded]);

  // Re-fetch on mount and whenever refreshKey changes
  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (error) {
    return <ErrorBanner message={error} onRetry={fetchAll} />;
  }

  // ── Dashboard view ────────────────────────────────────────────────────────
  if (activeView === 'dashboard') {
    return (
      <>
        <div className="section-title">Key Performance Indicators</div>
        <KPICards metrics={metrics} loading={loading} />

        <div className="charts-row">
          {/* Status Distribution */}
          <div className="chart-card">
            <div className="chart-card-title">Status Distribution</div>
            <div className="chart-card-subtitle">Issue breakdown by current status</div>
            <StatusPieChart data={statusData} loading={loading} />
          </div>

          {/* Assignee Workload */}
          <div className="chart-card">
            <div className="chart-card-title">Assignee Workload</div>
            <div className="chart-card-subtitle">Number of issues per team member</div>
            <AssigneeBarChart data={assigneeData} loading={loading} />
          </div>
        </div>

        <div className="section-title">Recent Issues</div>
        <IssueTable issues={issues} loading={loading} limit={8} onIssueClick={onIssueClick} />
      </>
    );
  }

  // ── Issues view ───────────────────────────────────────────────────────────
  if (activeView === 'issues') {
    return (
      <>
        <div className="section-title">All Jira Issues</div>
        <IssueTable issues={issues} loading={loading} onIssueClick={onIssueClick} />
      </>
    );
  }

  // ── Analytics view ────────────────────────────────────────────────────────
  if (activeView === 'analytics') {
    return (
      <>
        <div className="section-title">Project Metrics</div>
        <KPICards metrics={metrics} loading={loading} />

        <div className="section-title" style={{ marginTop: 8 }}>Workload Analysis</div>
        <div className="charts-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="chart-card">
            <div className="chart-card-title">Status Distribution</div>
            <div className="chart-card-subtitle">Current issue status breakdown</div>
            <StatusPieChart data={statusData} loading={loading} />
          </div>
          <div className="chart-card">
            <div className="chart-card-title">Assignee Workload</div>
            <div className="chart-card-subtitle">Issues assigned per team member</div>
            <AssigneeBarChart data={assigneeData} loading={loading} />
          </div>
        </div>

        {/* Priority breakdown */}
        <div className="section-title" style={{ marginTop: 8 }}>Priority Breakdown</div>
        <div className="priority-breakdown-grid">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="priority-breakdown-card skel-pulse" style={{ height: 80 }} />
            ))
          ) : (
            (() => {
              const priorityTally = {};
              issues.forEach((issue) => {
                const p = issue.fields?.priority?.name || 'Medium';
                priorityTally[p] = (priorityTally[p] || 0) + 1;
              });
              const priorityColors = {
                Highest: '#f85149', High: '#d29922', Medium: '#58a6ff',
                Low: '#3fb950', Lowest: 'var(--text-secondary)',
              };
              return Object.entries(priorityTally)
                .sort(([, a], [, b]) => b - a)
                .map(([name, count]) => (
                  <div key={name} className="priority-breakdown-card" style={{ borderTop: `3px solid ${priorityColors[name] || '#58a6ff'}` }}>
                    <div className="pb-count">{count}</div>
                    <div className="pb-label">{name}</div>
                    <div className="pb-bar-wrap">
                      <div
                        className="pb-bar"
                        style={{
                          width: `${Math.round((count / issues.length) * 100)}%`,
                          background: priorityColors[name] || '#58a6ff',
                        }}
                      />
                    </div>
                    <div className="pb-pct">{Math.round((count / issues.length) * 100)}%</div>
                  </div>
                ));
            })()
          )}
        </div>
      </>
    );
  }

  // ── Teams view ────────────────────────────────────────────────────────────
  if (activeView === 'teams') {
    return <TeamsView 
      user={user} 
      issues={issues} 
      onOpenIssueDetails={(key) => {
        const issue = issues.find(i => i.key === key);
        onIssueClick(issue || { key });
      }} 
    />;
  }

  // ── Meet view ─────────────────────────────────────────────────────
  if (activeView === 'meet') {
    return <MeetView
      user={user}
      issues={issues}
      onOpenIssueDetails={(key) => {
        const issue = issues.find(i => i.key === key);
        onIssueClick(issue || { key });
      }}
    />;
  }

  // ── Calls & Meetings view ─────────────────────────────────────────────────
  if (activeView === 'calls') {
    return <CallsView 
      user={user} 
      issues={issues}
      onOpenIssueDetails={(key) => {
        const issue = issues.find(i => i.key === key);
        onIssueClick(issue || { key });
      }}
    />;
  }

  // ── Settings view ───────────────────────────────────────────────────────────
  if (activeView === 'settings') {
    return (
      <div className="settings-panel" style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px' }}>
        <div className="section-title">Atlassian Integration Settings</div>
        
        <form onSubmit={handleSaveConnection} className="settings-section" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <div className="settings-section-title" style={{ fontSize: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '20px', color: 'var(--text-primary)' }}>
            Jira Cloud Connection Control Panel
          </div>

          {saveStatus && (
            <div 
              style={{
                padding: '12px 16px',
                borderRadius: '6px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                background: saveStatus.type === 'success' ? 'rgba(56, 139, 253, 0.15)' : 'rgba(248, 81, 73, 0.15)',
                border: saveStatus.type === 'success' ? '1px solid rgba(56, 139, 253, 0.4)' : '1px solid rgba(248, 81, 73, 0.4)',
                color: saveStatus.type === 'success' ? '#58a6ff' : '#ff7b72'
              }}
            >
              {saveStatus.type === 'success' ? (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zm3.78-9.72a.75.75 0 0 0-1.06-1.06L7 9.44 5.28 7.72a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.5-4.5z"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 16A8 8 0 1 1 8 0a8 8 0 0 1 0 16zM7 4v5h2V4H7zm0 6v2h2v-2H7z"/>
                </svg>
              )}
              <span>{saveStatus.message}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Site URL */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center', gap: '16px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Atlassian Site URL</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input
                  type="url"
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://your-company.atlassian.net"
                  required
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Standard Jira Cloud URL, e.g. https://devcobraaa.atlassian.net</span>
              </div>
            </div>

            {/* Project Key */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center', gap: '16px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Jira Project Key</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input
                  type="text"
                  value={projectKey}
                  onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                  placeholder="e.g. AUTO"
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    width: '150px',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--accent)' }}>
                  💡 <strong>Optional:</strong> Leave blank to automatically create and provision a brand new Software Kanban project on your Atlassian site!
                </span>
              </div>
            </div>

            {/* Organization ID */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center', gap: '16px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Atlassian Org ID</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input
                  type="text"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  placeholder="3e8909b9-234a-4def-aaf9-adc97997b269"
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Required for Atlassian teams syncing. Retained from system organization.</span>
              </div>
            </div>

            {/* Email */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center', gap: '16px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Atlassian Registered Email</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Email address of the administrator account on the specified Jira instance</span>
              </div>
            </div>

            {/* API Token */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center', gap: '16px' }}>
              <label style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-secondary)' }}>Jira API Token</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ position: 'relative', display: 'flex', width: '100%' }}>
                  <input
                    type={showToken ? "text" : "password"}
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    placeholder="••••••••••••••••"
                    required
                    style={{
                      padding: '8px 45px 8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '14px',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px'
                    }}
                  >
                    {showToken ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
                        <path d="M1.5 8c1.333-3.11 4.242-5 6.5-5 2.259 0 5.167 1.89 6.5 5-1.333 3.11-4.242 5-6.5 5-2.259 0-5.167-1.89-6.5-5zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                        <path d="M11.354 4.646a.5.5 0 1 0-.708-.708L8 6.586 5.354 3.938a.5.5 0 1 0-.708.708L7.293 7.3 4.646 9.946a.5.5 0 1 0 .708.708L8 8.014l2.646 2.646a.5.5 0 0 0 .708-.708L8.707 7.3l2.647-2.654z"/>
                      </svg>
                    )}
                  </button>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Generate an API Token from your Atlassian Account Security settings page</span>
              </div>
            </div>

            {/* Save Button */}
            <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
              <div />
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '10px 16px',
                  borderRadius: '6px',
                  border: '1px solid rgba(56, 139, 253, 0.4)',
                  background: 'linear-gradient(180deg, #2188ff 0%, #1f6feb 100%)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  justifyContent: 'center',
                  alignSelf: 'flex-start',
                  width: 'fit-content',
                  boxShadow: '0 1px 0 rgba(27, 31, 35, 0.1)'
                }}
              >
                {saving ? (
                  <>
                    <span className="login-spinner" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#ffffff', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
                    Verifying & Saving Connection…
                  </>
                ) : (
                  <>
                    Test & Save Connection
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M12.78 6.22a.75.75 0 0 1 0 1.06L8.06 12a.75.75 0 0 1-1.06 0L4.22 9.28a.75.75 0 0 1 1.06-1.06L8 10.94l4.22-4.22a.75.75 0 0 1 1.06 0z"/>
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        <div className="settings-section" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <div className="settings-section-title" style={{ fontSize: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '20px', color: 'var(--text-primary)' }}>
            System Information
          </div>
          <div className="settings-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="settings-label" style={{ color: 'var(--text-secondary)' }}>Connection Status</div>
            <div className="settings-value">
              {settings ? (
                <span className={`badge ${settings.status === 'Connected' ? 'badge-done' : 'badge-failed'}`} style={{
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  background: settings.status === 'Connected' ? 'rgba(63, 185, 80, 0.15)' : 'rgba(248, 81, 73, 0.15)',
                  color: settings.status === 'Connected' ? '#58a6ff' : '#ff7b72',
                  border: settings.status === 'Connected' ? '1px solid rgba(63,185,80,0.3)' : '1px solid rgba(248,81,73,0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: settings.status === 'Connected' ? '#3fb950' : '#f85149'
                  }} />
                  {settings.status}
                </span>
              ) : "Loading..."}
            </div>
          </div>
          <div className="settings-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="settings-label" style={{ color: 'var(--text-secondary)' }}>Integration Standard</div>
            <div className="settings-value" style={{ color: 'var(--text-primary)' }}>{settings?.apiVersion || "Jira Cloud REST v3"}</div>
          </div>
          <div className="settings-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="settings-label" style={{ color: 'var(--text-secondary)' }}>Theme Setting</div>
            <div className="settings-value" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                {theme === 'dark' ? 'Dark Theme' : 'Light Theme'}
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
