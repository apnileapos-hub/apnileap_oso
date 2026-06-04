import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import KPICards from './KPICards';
import StatusPieChart from './StatusPieChart';
import AssigneeBarChart from './AssigneeBarChart';
import IssueTable from './IssueTable';

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

export default function Dashboard({ activeView, refreshKey, onFetchStart, onFetchEnd, onIssuesLoaded }) {
  const [metrics, setMetrics]       = useState(null);
  const [statusData, setStatusData] = useState([]);
  const [assigneeData, setAssigneeData] = useState([]);
  const [issues, setIssues]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    onFetchStart?.();

    try {
      const [metricsRes, statusRes, assigneeRes, issuesRes] = await Promise.all([
        axios.get(`${API}/dashboard-metrics`),
        axios.get(`${API}/status-summary`),
        axios.get(`${API}/assignee-summary`),
        axios.get(`${API}/issues`),
      ]);

      setMetrics(metricsRes.data);
      setStatusData(statusRes.data);
      setAssigneeData(assigneeRes.data);
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
        <IssueTable issues={issues} loading={loading} limit={8} />
      </>
    );
  }

  // ── Issues view ───────────────────────────────────────────────────────────
  if (activeView === 'issues') {
    return (
      <>
        <div className="section-title">All Jira Issues</div>
        <IssueTable issues={issues} loading={loading} />
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
                Low: '#3fb950', Lowest: '#8b949e',
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

  // ── Settings view (placeholder) ───────────────────────────────────────────
  if (activeView === 'settings') {
    return (
      <div className="settings-panel">
        <div className="settings-section">
          <div className="settings-section-title">Jira Connection</div>
          <div className="settings-row">
            <div className="settings-label">Site URL</div>
            <div className="settings-value">https://devcobraaa.atlassian.net</div>
          </div>
          <div className="settings-row">
            <div className="settings-label">Project Key</div>
            <div className="settings-value settings-badge">SCRUM</div>
          </div>
          <div className="settings-row">
            <div className="settings-label">Status</div>
            <div className="settings-value">
              <span className="badge badge-done"><span className="badge-dot" />Connected</span>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-label">API Version</div>
            <div className="settings-value">Jira Cloud REST v3</div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">Dashboard Preferences</div>
          <div className="settings-row">
            <div className="settings-label">Theme</div>
            <div className="settings-value">Dark (Enterprise)</div>
          </div>
          <div className="settings-row">
            <div className="settings-label">Refresh Rate</div>
            <div className="settings-value">Manual</div>
          </div>
          <div className="settings-row">
            <div className="settings-label">Max Issues</div>
            <div className="settings-value">100 per request</div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
