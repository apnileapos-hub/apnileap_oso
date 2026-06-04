import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL ||
  (window.location.port === '3000' ? 'http://localhost:5000' : '');

const STATUS_OPTIONS = [
  { value: 'pending_review', label: 'Pending Review',  color: '#ff9800' },
  { value: 'accepted',       label: 'Accepted',        color: '#3fb950' },
  { value: 'in_progress',    label: 'In Progress',     color: '#58a6ff' },
  { value: 'completed',      label: 'Completed',       color: '#7f85f5' },
  { value: 'on_hold',        label: 'On Hold',         color: '#d29922' },
  { value: 'rejected',       label: 'Rejected',        color: '#ff7b72' },
];

export default function FacultyPortalView({ user }) {
  const [projects, setProjects]     = useState([]);
  const [teams, setTeams]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Per-project tab: 'overview' | 'epics' | 'team' | 'coordinate'
  const [activeTab, setActiveTab]   = useState({});
  // Team assignment
  const [assignMap, setAssignMap]   = useState({});
  const [assignSuccess, setAssignSuccess] = useState({});
  // Epic creation form
  const [showEpicForm, setShowEpicForm]   = useState({});
  const [epicTitle, setEpicTitle]         = useState({});
  const [epicDesc, setEpicDesc]           = useState({});
  // Team coordination
  const [messages, setMessages]   = useState({});
  const [newMsg, setNewMsg]       = useState({});
  // Status change
  const [statusSaving, setStatusSaving] = useState({});

  /* ── fetch ── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = user?.token;
      const [projRes, teamRes] = await Promise.all([
        axios.get(`${API}/projects`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/teams`,    { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const collegeFilter = user?.collegeId;
      const isSuper = user?.role === 'Super-admin' || user?.role === 'Admin';

      const filtered = (projRes.data || []).filter(p =>
        isSuper || p.spokeId === collegeFilter
      );

      setProjects(filtered);
      setTeams(teamRes.data || []);

      const map = {};
      filtered.forEach(p => { if (p.teamId) map[p.id] = p.teamId; });
      setAssignMap(map);

      // Seed coordination messages per team
      const msgs = {};
      teamRes.data.forEach(t => {
        msgs[t.id] = [{
          id: 1,
          author: user?.name || 'Faculty',
          text:   `Welcome ${t.name}! Tag all commits with the Jira project key.`,
          time:   'Pinned',
          pinned: true,
        }];
      });
      setMessages(msgs);
    } catch (err) {
      console.error(err);
      setError('Failed to load Faculty Portal data.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── helpers ── */
  const getTab       = (id)   => activeTab[id] || 'overview';
  const setTab       = (id, t) => setActiveTab(p => ({ ...p, [id]: t }));
  const getTeam      = (id)   => teams.find(t => t.id === id);
  const getInitials  = (name = '') => name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const memberName   = (email = '') => email.split('@')[0].split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const statusColor  = (s) => STATUS_OPTIONS.find(o => o.value === s?.toLowerCase())?.color || 'var(--text-secondary)';
  const statusLabel  = (s) => STATUS_OPTIONS.find(o => o.value === s?.toLowerCase())?.label || s;

  /* ── handlers ── */
  const handleAssignTeam = async (projId) => {
    const teamId = assignMap[projId];
    if (!teamId) return;
    setSubmitting(true);
    try {
      await axios.post(`${API}/projects/${projId}/assign-team`, { teamId },
        { headers: { Authorization: `Bearer ${user?.token}` } });
      setProjects(p => p.map(pr => pr.id === projId ? { ...pr, teamId } : pr));
      setAssignSuccess(p => ({ ...p, [projId]: true }));
      setTimeout(() => setAssignSuccess(p => ({ ...p, [projId]: false })), 3000);
    } catch (e) {
      alert('Assign failed: ' + (e.response?.data?.error || e.message));
    } finally { setSubmitting(false); }
  };

  const handleCreateEpic = async (projId) => {
    const title = epicTitle[projId]?.trim();
    if (!title) return;
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/projects/${projId}/epics`,
        { title, description: epicDesc[projId] || '' },
        { headers: { Authorization: `Bearer ${user?.token}` } });
      const updated = res.data;
      setProjects(p => p.map(pr => pr.id === projId ? { ...pr, epics: updated.epics || [...(pr.epics || []), updated] } : pr));
      setShowEpicForm(p => ({ ...p, [projId]: false }));
      setEpicTitle(p => ({ ...p, [projId]: '' }));
      setEpicDesc(p => ({ ...p, [projId]: '' }));
    } catch (e) {
      alert('Create epic failed: ' + (e.response?.data?.error || e.message));
    } finally { setSubmitting(false); }
  };

  const handleDeleteEpic = async (projId, epicId) => {
    if (!window.confirm('Delete this epic?')) return;
    try {
      const res = await axios.delete(`${API}/projects/${projId}/epics/${epicId}`,
        { headers: { Authorization: `Bearer ${user?.token}` } });
      setProjects(p => p.map(pr => pr.id === projId ? { ...pr, epics: res.data.epics } : pr));
    } catch (e) {
      alert('Delete epic failed: ' + (e.response?.data?.error || e.message));
    }
  };

  const handleChangeStatus = async (projId, newStatus) => {
    setStatusSaving(p => ({ ...p, [projId]: true }));
    try {
      await axios.patch(`${API}/projects/${projId}/status`, { status: newStatus },
        { headers: { Authorization: `Bearer ${user?.token}` } });
      setProjects(p => p.map(pr => pr.id === projId ? { ...pr, status: newStatus } : pr));
    } catch (e) {
      alert('Status change failed: ' + (e.response?.data?.error || e.message));
    } finally {
      setStatusSaving(p => ({ ...p, [projId]: false }));
    }
  };

  const handleSendMsg = (teamId) => {
    const text = newMsg[teamId]?.trim();
    if (!text) return;
    const msg = { id: Date.now(), author: user?.name || 'Faculty', text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(p => ({ ...p, [teamId]: [...(p[teamId] || []), msg] }));
    setNewMsg(p => ({ ...p, [teamId]: '' }));
  };

  /* ── render ── */
  return (
    <div style={{ color: 'var(--text-primary)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
          🎓 Faculty Coordinator Hub
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
          View project details, manage epics, update status, assign teams and coordinate with student teams.
        </p>
      </div>

      {error && (
        <div style={{ color: '#ff7b72', padding: '10px 14px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.2)', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px' }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid rgba(88,166,255,0.2)', borderTopColor: '#58a6ff', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 10px' }} />
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading...</div>
        </div>
      ) : projects.length === 0 ? (
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '40px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📋</div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>No Projects Allocated to Your Spoke Yet</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Projects assigned by the Moderator will appear here.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {projects.map(proj => {
            const tab           = getTab(proj.id);
            const assignedTeam  = getTeam(proj.teamId);
            const epics         = proj.epics || [];
            const doneCount     = epics.filter(e => e.status === 'Done' || e.status === 'Complete').length;
            const pct           = epics.length > 0 ? Math.round((doneCount / epics.length) * 100) : 0;

            return (
              <div key={proj.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>

                {/* ── Project Header ── */}
                <div style={{ padding: '16px 20px 0 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        {/* Status badge — clickable for Faculty */}
                        <div style={{ position: 'relative' }}>
                          <select
                            value={proj.status?.toLowerCase() || 'pending_review'}
                            onChange={e => handleChangeStatus(proj.id, e.target.value)}
                            disabled={statusSaving[proj.id]}
                            title="Change project status"
                            style={{
                              fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                              padding: '2px 24px 2px 8px', borderRadius: '10px', cursor: 'pointer',
                              background: statusColor(proj.status) + '22',
                              border: `1px solid ${statusColor(proj.status)}55`,
                              color: statusColor(proj.status),
                              appearance: 'none', WebkitAppearance: 'none',
                            }}
                          >
                            {STATUS_OPTIONS.map(s => (
                              <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                          </select>
                          <span style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', fontSize: '8px', color: statusColor(proj.status), pointerEvents: 'none' }}>▼</span>
                        </div>
                        {proj.jiraProjectKey && (
                          <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', background: 'rgba(88,166,255,0.1)', border: '1px solid rgba(88,166,255,0.2)', color: '#58a6ff' }}>
                            {proj.jiraProjectKey}
                          </span>
                        )}
                        <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{proj.company}</span>
                      </div>
                      <h3 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{proj.title}</h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>{proj.description}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '15px', color: '#3fb950', fontWeight: '700' }}>${proj.funding?.toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{proj.duration}</div>
                      <div style={{ fontSize: '11px', color: '#58a6ff', marginTop: '2px' }}>{pct}% complete</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {epics.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ height: '4px', background: 'var(--bg-card)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#3fb950', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  )}

                  {/* ── Tab Bar ── */}
                  <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid var(--border)', marginBottom: '0' }}>
                    {[
                      { id: 'overview',    label: '⊙ Overview' },
                      { id: 'epics',       label: `📋 Epics (${epics.length})` },
                      { id: 'team',        label: '👥 Team' },
                      { id: 'coordinate',  label: '💬 Coordinate' },
                    ].map(t => (
                      <button key={t.id} onClick={() => setTab(proj.id, t.id)} style={{
                        padding: '7px 13px', fontSize: '12px', fontWeight: tab === t.id ? '600' : '400',
                        background: 'transparent', border: 'none',
                        borderBottom: tab === t.id ? '2px solid #58a6ff' : '2px solid transparent',
                        color: tab === t.id ? '#58a6ff' : 'var(--text-secondary)',
                        cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: '-1px', transition: 'color 0.15s'
                      }}>{t.label}</button>
                    ))}
                  </div>
                </div>

                {/* ── Tab Content ── */}
                <div style={{ padding: '16px 20px 20px 20px' }}>

                  {/* OVERVIEW */}
                  {tab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                        {[
                          { label: 'Status',   value: statusLabel(proj.status),          color: statusColor(proj.status) },
                          { label: 'Epics',    value: `${epics.length} (${doneCount} done)`, color: '#58a6ff' },
                          { label: 'Team',     value: assignedTeam?.name || 'Unassigned', color: assignedTeam ? '#3fb950' : '#ff9800' },
                          { label: 'Funding',  value: `$${proj.funding?.toLocaleString()}`, color: '#3fb950' },
                        ].map(kpi => (
                          <div key={kpi.label} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>{kpi.label}</div>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: kpi.color }}>{kpi.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Change Status */}
                      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
                        <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Update Project Status</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {STATUS_OPTIONS.map(s => (
                            <button
                              key={s.value}
                              onClick={() => handleChangeStatus(proj.id, s.value)}
                              disabled={proj.status?.toLowerCase() === s.value || statusSaving[proj.id]}
                              style={{
                                padding: '5px 12px', borderRadius: '20px', border: `1px solid ${s.color}55`,
                                background: proj.status?.toLowerCase() === s.value ? s.color + '22' : 'transparent',
                                color: proj.status?.toLowerCase() === s.value ? s.color : 'var(--text-secondary)',
                                fontSize: '11px', fontWeight: proj.status?.toLowerCase() === s.value ? '700' : '400',
                                cursor: proj.status?.toLowerCase() === s.value ? 'default' : 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              {proj.status?.toLowerCase() === s.value ? '✓ ' : ''}{s.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Jira + Confluence links */}
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {proj.jiraProjectKey && (
                          <a href={`https://apnileapos.atlassian.net/jira/software/projects/${proj.jiraProjectKey}/boards`} target="_blank" rel="noreferrer"
                            style={{ fontSize: '12px', color: '#58a6ff', textDecoration: 'none', fontWeight: '600', padding: '6px 14px', background: 'rgba(88,166,255,0.08)', border: '1px solid rgba(88,166,255,0.2)', borderRadius: '6px' }}>
                            📋 Open Jira Board ↗
                          </a>
                        )}
                        {proj.confluenceSpaceUrl && (
                          <a href={proj.confluenceSpaceUrl} target="_blank" rel="noreferrer"
                            style={{ fontSize: '12px', color: '#0052cc', textDecoration: 'none', fontWeight: '600', padding: '6px 14px', background: 'rgba(0,82,204,0.08)', border: '1px solid rgba(0,82,204,0.2)', borderRadius: '6px' }}>
                            📄 Open Confluence ↗
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* EPICS */}
                  {tab === 'epics' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>📋 Project Epics</h4>
                        <button
                          onClick={() => setShowEpicForm(p => ({ ...p, [proj.id]: !p[proj.id] }))}
                          style={{ padding: '5px 12px', background: '#1f6feb', border: 'none', color: '#fff', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                        >
                          {showEpicForm[proj.id] ? '✕ Cancel' : '➕ Add Epic'}
                        </button>
                      </div>

                      {/* Add Epic Form */}
                      {showEpicForm[proj.id] && (
                        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '14px', marginBottom: '14px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input
                              type="text"
                              placeholder="Epic title *"
                              value={epicTitle[proj.id] || ''}
                              onChange={e => setEpicTitle(p => ({ ...p, [proj.id]: e.target.value }))}
                              style={{ padding: '7px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '13px' }}
                            />
                            <textarea
                              placeholder="Epic description (optional)"
                              value={epicDesc[proj.id] || ''}
                              onChange={e => setEpicDesc(p => ({ ...p, [proj.id]: e.target.value }))}
                              rows={2}
                              style={{ padding: '7px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px', resize: 'vertical' }}
                            />
                            <button
                              onClick={() => handleCreateEpic(proj.id)}
                              disabled={!epicTitle[proj.id]?.trim() || submitting}
                              style={{ alignSelf: 'flex-end', padding: '6px 16px', background: epicTitle[proj.id]?.trim() ? '#3fb950' : 'var(--bg-card)', border: 'none', color: epicTitle[proj.id]?.trim() ? '#fff' : 'var(--text-secondary)', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: epicTitle[proj.id]?.trim() ? 'pointer' : 'not-allowed' }}
                            >
                              {submitting ? 'Creating...' : 'Create & Sync to Jira'}
                            </button>
                          </div>
                        </div>
                      )}

                      {epics.length === 0 ? (
                        <div style={{ background: 'var(--bg-primary)', border: '1px dashed var(--border)', borderRadius: '6px', padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                          No epics defined yet. Click "Add Epic" above.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {epics.map(epic => (
                            <div key={epic.id} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                  {epic.jiraKey && !epic.jiraKey.startsWith('MOCK') ? (
                                    <a href={`https://apnileapos.atlassian.net/browse/${epic.jiraKey}`} target="_blank" rel="noreferrer"
                                      style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: '700', color: '#58a6ff', textDecoration: 'none', background: 'rgba(88,166,255,0.1)', padding: '1px 6px', borderRadius: '4px' }}>
                                      {epic.jiraKey} ↗
                                    </a>
                                  ) : epic.jiraKey ? (
                                    <span style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-secondary)', background: 'var(--bg-card)', padding: '1px 6px', borderRadius: '4px' }}>{epic.jiraKey}</span>
                                  ) : (
                                    <span style={{ fontSize: '10px', color: '#ff9800' }}>⏳ Awaiting sync</span>
                                  )}
                                  <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '10px',
                                    background: epic.status === 'Done' ? 'rgba(63,185,80,0.15)' : epic.status === 'In Progress' ? 'rgba(88,166,255,0.15)' : 'rgba(110,118,129,0.15)',
                                    color:      epic.status === 'Done' ? '#3fb950'             : epic.status === 'In Progress' ? '#58a6ff'             : 'var(--text-secondary)',
                                    fontWeight: '600' }}>{epic.status}</span>
                                </div>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>{epic.title}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{epic.description}</div>
                              </div>
                              <button
                                onClick={() => handleDeleteEpic(proj.id, epic.id)}
                                title="Delete epic"
                                style={{ padding: '3px 8px', background: 'none', border: '1px solid rgba(248,81,73,0.3)', color: '#ff7b72', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', flexShrink: 0 }}
                              >
                                🗑
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* TEAM ASSIGNMENT */}
                  {tab === 'team' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                          <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>👥 Team Assignment</h4>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                            {assignedTeam ? `Assigned to: ${assignedTeam.name} (${assignedTeam.members?.length || 0} members)` : 'No team assigned yet.'}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <select
                            value={assignMap[proj.id] || ''}
                            onChange={e => setAssignMap(p => ({ ...p, [proj.id]: e.target.value }))}
                            style={{ padding: '6px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px' }}
                          >
                            <option value="">Select Team...</option>
                            {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.members?.length || 0})</option>)}
                          </select>
                          <button
                            onClick={() => handleAssignTeam(proj.id)}
                            disabled={!assignMap[proj.id] || submitting}
                            style={{ padding: '6px 14px', background: assignSuccess[proj.id] ? '#3fb950' : '#1f6feb', border: 'none', color: '#fff', borderRadius: '4px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', opacity: assignMap[proj.id] ? 1 : 0.5 }}
                          >
                            {assignSuccess[proj.id] ? '✓ Assigned!' : submitting ? '...' : 'Assign'}
                          </button>
                        </div>
                      </div>

                      {assignedTeam && assignedTeam.members?.length > 0 && (
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Members</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {assignedTeam.members.map((m, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-primary)', border: '1px solid var(--border)', padding: '5px 12px', borderRadius: '20px' }}>
                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#1f6feb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700' }}>
                                  {getInitials(memberName(m))}
                                </div>
                                <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{memberName(m)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* COORDINATE */}
                  {tab === 'coordinate' && (() => {
                    const teamId = proj.teamId;
                    const team   = getTeam(teamId);
                    const msgs   = messages[teamId] || [];
                    return (
                      <div>
                        {!team ? (
                          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                            Assign a team first to start coordinating.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px', fontWeight: '600', textTransform: 'uppercase' }}>
                              Team: {team.name} · {team.members?.length || 0} members
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', marginBottom: '12px', padding: '2px' }}>
                              {msgs.map(msg => {
                                const isMe = msg.author === (user?.name || 'Faculty');
                                return (
                                  <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: '8px', alignItems: 'flex-end' }}>
                                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: msg.pinned ? '#7f85f5' : isMe ? '#3fb950' : '#1f6feb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: '700', flexShrink: 0 }}>
                                      {getInitials(msg.author)}
                                    </div>
                                    <div style={{ maxWidth: '70%' }}>
                                      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '2px', textAlign: isMe ? 'right' : 'left' }}>{msg.author} · {msg.time}</div>
                                      <div style={{ fontSize: '12px', color: 'var(--text-primary)', background: isMe ? 'rgba(63,185,80,0.1)' : 'var(--bg-primary)', border: `1px solid ${isMe ? 'rgba(63,185,80,0.2)' : 'var(--border)'}`, padding: '7px 11px', borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', lineHeight: '1.4' }}>
                                        {msg.text}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input
                                type="text"
                                value={newMsg[teamId] || ''}
                                onChange={e => setNewMsg(p => ({ ...p, [teamId]: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleSendMsg(teamId)}
                                placeholder={`Message ${team.name}...`}
                                style={{ flex: 1, padding: '7px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none' }}
                              />
                              <button
                                onClick={() => handleSendMsg(teamId)}
                                disabled={!newMsg[teamId]?.trim()}
                                style={{ padding: '7px 14px', background: newMsg[teamId]?.trim() ? '#1f6feb' : 'var(--bg-card)', border: 'none', color: newMsg[teamId]?.trim() ? '#fff' : 'var(--text-secondary)', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: newMsg[teamId]?.trim() ? 'pointer' : 'not-allowed' }}
                              >
                                Send ↑
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
