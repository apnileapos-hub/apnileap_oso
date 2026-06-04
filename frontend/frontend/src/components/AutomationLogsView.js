import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 
  (window.location.port === '3000' ? 'http://localhost:5000' : '');

export default function AutomationLogsView({ user }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState('');
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/emails/logs`);
      setLogs(res.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching email logs:', err);
      setError('Failed to fetch automated outbox feed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleTriggerSweep = async () => {
    setSweeping(true);
    setSweepResult('');
    try {
      const token = user?.token;
      const res = await axios.post(`${API}/emails/trigger-reminders`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSweepResult(res.data?.message || 'Sweep complete.');
      fetchLogs();
      setTimeout(() => setSweepResult(''), 5000);
    } catch (err) {
      console.error('Error running reminder sweep:', err);
      alert('Failed to trigger reminder sweep.');
    } finally {
      setSweeping(false);
    }
  };

  return (
    <div className="automation-logs-view" style={{ color: '#c9d1d9' }}>
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#f0f6fc', margin: '0 0 6px 0' }}>📧 Automation Logs</h1>
          <p style={{ fontSize: '13px', color: '#8b949e', margin: 0 }}>View simulated reminder emails and system assignment logs in the outbound queue.</p>
        </div>
        <button 
          onClick={handleTriggerSweep} 
          disabled={sweeping}
          className="chat-btn" 
          style={{ background: '#3fb950', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '8px 16px', borderRadius: '6px', fontWeight: '600', opacity: sweeping ? 0.7 : 1 }}
        >
          {sweeping ? 'Running Sweep...' : '⚡ Run Reminder Sweep'}
        </button>
      </div>

      {sweepResult && (
        <div style={{ padding: '12px', background: 'rgba(56,139,253,0.15)', border: '1px solid rgba(56,139,253,0.3)', borderRadius: '6px', color: '#58a6ff', marginBottom: '16px', fontSize: '13px' }}>
          <strong>System Sweep Result:</strong> {sweepResult}
        </div>
      )}

      {error && <div style={{ color: '#ff7b72', padding: '10px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.2)', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 10px auto' }} />
          <div style={{ fontSize: '13px', color: '#8b949e' }}>Loading outbox feed...</div>
        </div>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px', color: '#8b949e', border: '1px dashed #30363d', borderRadius: '6px', background: '#161b22' }}>
          No outbox records logged yet. Try assigning a project to generate emails.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {logs.map(log => {
            let badgeColor = '#58a6ff';
            let badgeBg = 'rgba(56,139,253,0.15)';
            if (log.type === 'reminder') {
              badgeColor = '#d29922';
              badgeBg = 'rgba(210,153,34,0.15)';
            } else if (log.type === 'team_assignment') {
              badgeColor = '#3fb950';
              badgeBg = 'rgba(63,185,80,0.15)';
            }

            return (
              <div key={log.id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', overflow: 'hidden' }}>
                {/* Header info */}
                <div style={{ background: '#0d1117', borderBottom: '1px solid #30363d', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px', color: badgeColor, background: badgeBg }}>
                      {log.type.toUpperCase()}
                    </span>
                    <span style={{ fontSize: '13px', color: '#8b949e' }}>To: <strong style={{ color: '#c9d1d9' }}>{log.to}</strong></span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#8b949e' }}>
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>

                {/* Email Body details */}
                <div style={{ padding: '16px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#f0f6fc', marginBottom: '10px' }}>
                    Subject: {log.subject}
                  </div>
                  <div style={{ background: '#0d1117', border: '1px solid #21262d', padding: '12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', color: '#c9d1d9', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                    {log.body}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
