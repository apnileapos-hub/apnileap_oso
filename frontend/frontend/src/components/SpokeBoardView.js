import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : '');

export default function SpokeBoardView({ user, spokeId, onRefresh }) {
  const [projects, setProjects] = useState([]);
  const [spokes, setSpokes] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // New States for Faculty Accept & Dynamic Epic Creation
  const [newEpicTitle, setNewEpicTitle] = useState({});
  const [newEpicDesc, setNewEpicDesc] = useState({});
  const [addingEpicProjId, setAddingEpicProjId] = useState(null);

  // Per-project tab state: { [projId]: 'summary' | 'list' | 'board' | 'calendar' | 'timeline' | 'code' | 'docs' | 'goals' | 'forms' | 'reports' | 'deployments' }
  const [activeProjectTab, setActiveProjectTab] = useState({});

  const currentSpoke = spokes.find(s => s.id === spokeId) || { name: 'Loading Spoke...' };
  const isLive = currentSpoke.type === 'live';

  const handleAcceptAllocation = async (projectId) => {
    setSubmitting(true);
    try {
      const token = user?.token;
      await axios.post(`${API}/projects/${projectId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Project accepted by Faculty successfully!');
      fetchData();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error accepting project:', err);
      alert(err.response?.data?.error || 'Failed to accept project.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeclineAllocation = async (projectId) => {
    if (!window.confirm('Are you sure you want to decline this project assignment? It will return to the Hub for reallocation.')) {
      return;
    }
    setSubmitting(true);
    try {
      const token = user?.token;
      await axios.post(`${API}/projects/${projectId}/decline`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Project assignment declined successfully.');
      fetchData();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error declining project:', err);
      alert(err.response?.data?.error || 'Failed to decline project.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateEpic = async (projectId) => {
    const title = newEpicTitle[projectId];
    const desc = newEpicDesc[projectId];
    if (!title || !title.trim()) {
      alert('Epic title is required.');
      return;
    }

    setSubmitting(true);
    try {
      const token = user?.token;
      await axios.post(`${API}/projects/${projectId}/epics`, {
        title,
        description: desc
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Reset inputs
      setNewEpicTitle({ ...newEpicTitle, [projectId]: '' });
      setNewEpicDesc({ ...newEpicDesc, [projectId]: '' });
      setAddingEpicProjId(null);
      
      fetchData();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error creating dynamic Epic:', err);
      alert(err.response?.data?.error || 'Failed to create Epic.');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = user?.token;
      const [projRes, spokeRes, teamsRes] = await Promise.all([
        axios.get(`${API}/projects`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/spokes`),
        axios.get(`${API}/teams`)
      ]);
      
      // Filter projects that are assigned to this Spoke
      const filteredProj = (projRes.data || []).filter(p => p.spokeId === spokeId);
      setProjects(filteredProj);
      setSpokes(spokeRes.data || []);
      setTeams(teamsRes.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching Spoke Board data:', err);
      setError('Failed to load board data. Please make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, spokeId]);



  const handleAssignTeam = async (projId) => {
    const teamId = selectedTeam[projId];
    if (!teamId) {
      alert('Please select a team.');
      return;
    }

    try {
      const token = user?.token;
      await axios.post(`${API}/projects/${projId}/assign-team`, {
        teamId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Project successfully assigned to team!');
      fetchData();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error assigning team:', err);
      alert(err.response?.data?.error || 'Failed to assign team.');
    }
  };

  // Enforce access control permissions:
  // Super-admin can see all. Spoke SPOC can only see their matching collegeId.
  const hasAccess = user?.role === 'Super-admin' || 
                    ((user?.role === 'College-SPOC' || user?.role === 'Faculty' || user?.role === 'Principal-Investigator') && user?.collegeId === spokeId);

  if (!hasAccess) {
    return (
      <div className="privilege-banner" style={{ margin: '20px 0', padding: '20px' }}>
        <div className="privilege-title" style={{ fontSize: '18px', color: '#ff7b72', fontWeight: 'bold' }}>Access Restricted</div>
        <div className="privilege-desc" style={{ marginTop: '8px', color: 'var(--text-secondary)' }}>
          Only Spoke Administrators (SPOC) for **{currentSpoke.name || 'this Spoke'}** or **Apni Leap Moderators** are authorized to access this space.
        </div>
      </div>
    );
  }

  // Filter teams permitted for this Spoke
  const SpokeTeamIds = currentSpoke.teams || [];
  const SpokeTeams = teams.filter(t => t.collegeId === spokeId || SpokeTeamIds.includes(t.id));

  return (
    <div className="spoke-board-view" style={{ color: 'var(--text-primary)' }}>
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 6px 0' }}>🎓 {currentSpoke.name} Board</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Managed by <strong>{currentSpoke.spocName}</strong> ({currentSpoke.spocEmail}) · Type: 
            <span style={{ marginLeft: '6px', padding: '2px 6px', fontSize: '10px', borderRadius: '4px', background: isLive ? 'rgba(56,139,253,0.15)' : 'rgba(110,118,129,0.15)', color: isLive ? '#58a6ff' : 'var(--text-secondary)', border: `1px solid ${isLive ? '#58a6ff' : 'var(--text-secondary)'}` }}>
              {isLive ? 'LIVE JIRA SYNC' : 'LOCAL SIMULATOR'}
            </span>
          </p>
        </div>
        <button onClick={fetchData} className="chat-btn" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px' }}>
          🔄 Refresh Board
        </button>
      </div>

      {error && <div style={{ color: '#ff7b72', padding: '10px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.2)', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 10px auto' }} />
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading Board...</div>
        </div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: '6px', background: 'var(--bg-secondary)' }}>
          <h3>No Projects Allocated Yet</h3>
          <p style={{ fontSize: '13px', marginTop: '6px' }}>Projects assigned by the Apni Leap Moderator will appear here.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {projects.map(proj => {
            const assignedTeam = teams.find(t => t.id === proj.teamId);

            // Faculty Review State
            if (proj.status === 'allocated') {
              return (
                <div key={proj.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--bg-card)', paddingBottom: '14px', marginBottom: '14px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#ff7b72', fontWeight: 'bold', textTransform: 'uppercase' }}>{proj.company}</span>
                      <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', margin: '4px 0 6px 0' }}>{proj.title}</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, maxWidth: '650px' }}>{proj.description}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', color: '#3fb950', fontWeight: 'bold' }}>${proj.funding?.toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Duration: {proj.duration}</div>
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-primary)', border: '1px dashed #ff9800', padding: '20px', borderRadius: '6px', textAlign: 'center' }}>
                    <h4 style={{ fontSize: '14px', color: '#ff9800', margin: '0 0 6px 0' }}>⏳ Spoke Project Acceptance Pending</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
                      This B2B proposal is allocated to your Spoke. Spoke Coordinator or Faculty review and acceptance are required before team delegation and Epic creation.
                    </p>
                    {['College-SPOC', 'Faculty', 'Principal-Investigator', 'Super-admin', 'Admin'].includes(user?.role) ? (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                        <button
                          onClick={() => handleAcceptAllocation(proj.id)}
                          disabled={submitting}
                          style={{ background: '#3fb950', color: '#ffffff', border: 'none', padding: '8px 24px', fontSize: '13px', fontWeight: '600', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          {submitting ? 'Accepting...' : 'Accept Project Assignment'}
                        </button>
                        <button
                          onClick={() => handleDeclineAllocation(proj.id)}
                          disabled={submitting}
                          style={{ background: '#da3637', color: '#ffffff', border: 'none', padding: '8px 24px', fontSize: '13px', fontWeight: '600', borderRadius: '6px', cursor: 'pointer' }}
                        >
                          {submitting ? 'Declining...' : 'Decline Project Assignment'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: '#ff9800', fontWeight: '500', marginTop: '10px' }}>
                        📢 Awaiting review and acceptance from Spoke Coordinator or Faculty.
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // Accepted & Active State — Tabbed Navigation
            const tabKey = proj.id;
            const currentTab = activeProjectTab[tabKey] || 'summary';
            const setTab = (tab) => setActiveProjectTab(prev => ({ ...prev, [tabKey]: tab }));

            const TABS = [
              { id: 'summary',     label: 'Summary',     icon: '⊙' },
              { id: 'board',       label: 'Board',       icon: '⊞' },
              { id: 'goals',       label: 'Goals',       icon: '◎' },
              { id: 'code',        label: 'Code',        icon: '</>' },
              { id: 'docs',        label: 'Docs',        icon: '📄' },
              { id: 'calendar',    label: 'Calendar',    icon: '🗓' },
              { id: 'timeline',    label: 'Timeline',    icon: '—' },
              { id: 'reports',     label: 'Reports',     icon: '📊' },
              { id: 'forms',       label: 'Forms',       icon: '☰' },
              { id: 'deployments', label: 'Deployments', icon: '🚀' },
            ];

            return (
              <div key={proj.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>

                {/* Project Header */}
                <div style={{ padding: '16px 20px 0 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#ff7b72', fontWeight: 'bold', textTransform: 'uppercase' }}>{proj.company}</span>
                      <h3 style={{ fontSize: '18px', color: 'var(--text-primary)', margin: '4px 0 4px 0' }}>{proj.title}</h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, maxWidth: '650px' }}>{proj.description}</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '16px', color: '#3fb950', fontWeight: 'bold' }}>${proj.funding?.toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Duration: {proj.duration}</div>
                      {proj.jiraProjectKey && (
                        <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '10px', fontFamily: 'monospace', fontWeight: '700', padding: '2px 8px', borderRadius: '10px', background: 'rgba(88,166,255,0.12)', border: '1px solid rgba(88,166,255,0.25)', color: '#58a6ff' }}>
                          {proj.jiraProjectKey}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tab Bar */}
                  <div style={{ display: 'flex', gap: '2px', overflowX: 'auto', borderBottom: '1px solid var(--border)', paddingBottom: '0', marginBottom: '0' }}>
                    {TABS.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setTab(tab.id)}
                        style={{
                          padding: '7px 13px',
                          fontSize: '12px',
                          fontWeight: currentTab === tab.id ? '600' : '400',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: currentTab === tab.id ? '2px solid #58a6ff' : '2px solid transparent',
                          color: currentTab === tab.id ? '#58a6ff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          transition: 'color 0.15s',
                          marginBottom: '-1px'
                        }}
                      >
                        <span style={{ fontSize: '11px' }}>{tab.icon}</span>
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tab Content */}
                <div style={{ padding: '18px 20px 20px 20px' }}>

                  {/* ── SUMMARY ── */}
                  {currentTab === 'summary' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                        {[
                          { label: 'Status', value: proj.status?.replace(/_/g, ' ').toUpperCase(), color: '#3fb950' },
                          { label: 'Epics', value: `${proj.epics?.length || 0} defined`, color: '#58a6ff' },
                          { label: 'Team', value: assignedTeam ? assignedTeam.name : 'Not assigned', color: assignedTeam ? '#3fb950' : '#ff9800' },
                          { label: 'Funding', value: `$${proj.funding?.toLocaleString()}`, color: '#3fb950' },
                        ].map(kpi => (
                          <div key={kpi.label} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', fontWeight: '600' }}>{kpi.label}</div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: kpi.color }}>{kpi.value}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: '600' }}>PROJECT DESCRIPTION</div>
                        <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: '1.6' }}>{proj.description || 'No description provided.'}</p>
                      </div>
                    </div>
                  )}

                  {/* ── BOARD (Epics) ── */}
                  {currentTab === 'board' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>📋 Epics &amp; Board Reflection</h4>
                        {user?.role !== 'College-SPOC' && (
                          addingEpicProjId === proj.id ? (
                            <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', padding: '14px', borderRadius: '6px', position: 'absolute', right: '40px', zIndex: 10, width: '280px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                              <h5 style={{ fontSize: '11px', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>➕ Add New Epic to Jira</h5>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <input type="text" placeholder="Epic Title" value={newEpicTitle[proj.id] || ''} onChange={(e) => setNewEpicTitle({ ...newEpicTitle, [proj.id]: e.target.value })} style={{ padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px' }} required />
                                <textarea placeholder="Epic Description" value={newEpicDesc[proj.id] || ''} onChange={(e) => setNewEpicDesc({ ...newEpicDesc, [proj.id]: e.target.value })} style={{ padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '11px', height: '40px', resize: 'vertical' }} />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                  <button type="button" onClick={() => setAddingEpicProjId(null)} style={{ padding: '4px 10px', background: 'none', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>Cancel</button>
                                  <button type="button" onClick={() => handleCreateEpic(proj.id)} disabled={submitting} style={{ padding: '4px 12px', background: '#2188ff', border: 'none', color: '#ffffff', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}>{submitting ? 'Syncing...' : 'Create & Sync'}</button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setAddingEpicProjId(proj.id)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: '#58a6ff', padding: '4px 10px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>➕ Create Epic on Jira</button>
                          )
                        )}
                      </div>
                      {!proj.epics || proj.epics.length === 0 ? (
                        <div style={{ background: 'var(--bg-primary)', border: '1px dashed var(--border)', padding: '24px', borderRadius: '6px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {user?.role === 'College-SPOC' ? '⏳ Awaiting work assignment (Epics) from Faculty.' : 'No Epics defined yet. Click "Create Epic on Jira" above.'}
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                          {proj.epics.map(epic => (
                            <div key={epic.id} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', padding: '12px', borderRadius: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                {!epic.jiraKey ? (
                                  <span style={{ fontSize: '11px', color: '#ff9800', fontWeight: 'bold' }}>⏳ Awaiting Sync</span>
                                ) : epic.jiraKey.startsWith('MOCK') ? (
                                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>{epic.jiraKey} (Mock)</span>
                                ) : (
                                  <a href={`https://apnileapos.atlassian.net/browse/${epic.jiraKey}`} target="_blank" rel="noreferrer" style={{ fontSize: '11px', color: '#58a6ff', fontWeight: 'bold', textDecoration: 'none' }}>{epic.jiraKey} ↗</a>
                                )}
                                <span style={{ fontSize: '9px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px', background: epic.status === 'Done' ? 'rgba(56,139,253,0.15)' : 'rgba(110,118,129,0.15)', color: epic.status === 'Done' ? '#58a6ff' : 'var(--text-secondary)' }}>{epic.status}</span>
                              </div>
                              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>{epic.title}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: '1.3' }}>{epic.description}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── GOALS ── */}
                  {currentTab === 'goals' && (
                    <div>
                      <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', margin: '0 0 14px 0' }}>◎ Project Goals</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {(proj.epics && proj.epics.length > 0) ? proj.epics.map((epic, i) => (
                          <div key={epic.id} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: epic.status === 'Done' ? '#3fb950' : 'var(--bg-card)', border: `2px solid ${epic.status === 'Done' ? '#3fb950' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '12px' }}>
                              {epic.status === 'Done' ? '✓' : i + 1}
                            </div>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>{epic.title}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{epic.description}</div>
                            </div>
                            <span style={{ marginLeft: 'auto', fontSize: '9px', padding: '2px 8px', borderRadius: '10px', background: epic.status === 'Done' ? 'rgba(63,185,80,0.15)' : 'rgba(110,118,129,0.15)', color: epic.status === 'Done' ? '#3fb950' : 'var(--text-secondary)', fontWeight: '600', whiteSpace: 'nowrap' }}>{epic.status}</span>
                          </div>
                        )) : (
                          <div style={{ background: 'var(--bg-primary)', border: '1px dashed var(--border)', borderRadius: '6px', padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>No goals defined yet. Goals are derived from project Epics.</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── CODE ── */}
                  {currentTab === 'code' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>🔗 Link Work Items with Development</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
                        Add the Jira issue key in branch names, commit messages, and pull requests to automatically link development work to this project.
                      </p>
                      <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px 16px', fontFamily: 'monospace', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ color: '#58a6ff', fontWeight: 'bold' }}>{proj.jiraProjectKey || 'KEY'}-123</span>
                        <span style={{ color: 'var(--text-secondary)' }}>-your-development-branch</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        {[
                          { label: 'Branch Name', example: `${proj.jiraProjectKey || 'KEY'}-42-feature-login`, icon: '⎇' },
                          { label: 'Commit Message', example: `git commit -m "${proj.jiraProjectKey || 'KEY'}-42 Add login feature"`, icon: '✔' },
                          { label: 'Pull Request', example: `PR: ${proj.jiraProjectKey || 'KEY'}-42 Login implementation`, icon: '⬆' },
                          { label: 'Chat Reference', example: `Working on ${proj.jiraProjectKey || 'KEY'}-42 today`, icon: '💬' },
                        ].map(item => (
                          <div key={item.label} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '6px' }}>{item.icon} {item.label}</div>
                            <code style={{ fontSize: '10px', color: '#3fb950', wordBreak: 'break-all', lineHeight: '1.4' }}>{item.example}</code>
                          </div>
                        ))}
                      </div>
                      {proj.jiraProjectKey && !proj.jiraProjectKey.startsWith('APNI') && (
                        <a href={`https://apnileapos.atlassian.net/jira/software/projects/${proj.jiraProjectKey}/boards`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#58a6ff', textDecoration: 'none', fontWeight: '600' }}>
                          📋 Open Jira Board ↗
                        </a>
                      )}
                    </div>
                  )}

                  {/* ── DOCS (Confluence) ── */}
                  {currentTab === 'docs' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>📄 Confluence Documentation Space</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.6' }}>
                        All project documentation, meeting notes, technical specs and deliverables are maintained on Confluence.
                      </p>

                      {proj.confluenceSpaceUrl ? (
                        <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ width: '40px', height: '40px', background: 'rgba(0,82,204,0.15)', border: '1px solid rgba(0,82,204,0.3)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>📄</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>{proj.title} — Confluence Space</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>{proj.confluenceSpaceUrl}</div>
                            <a href={proj.confluenceSpaceUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 12px', background: '#0052cc', color: '#fff', fontSize: '11px', fontWeight: '600', borderRadius: '4px', textDecoration: 'none', marginRight: '8px' }}>
                              Open in Confluence ↗
                            </a>
                            <a href={`${API}/api/v1/download-report?title=${encodeURIComponent(proj.title || '')}&file=${proj.title?.toLowerCase().includes('apnicart') ? 'ApniCart_Design_Document.docx' : 'APNILEAP_PROJECT (1).pdf'}`} download style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 12px', background: '#238636', color: '#fff', fontSize: '11px', fontWeight: '600', borderRadius: '4px', textDecoration: 'none' }}>
                              📥 Download Report Directly
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div style={{ background: 'var(--bg-primary)', border: '1px dashed var(--border)', borderRadius: '6px', padding: '24px', textAlign: 'center' }}>
                          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📄</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '4px' }}>No Confluence Space Provisioned Yet</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '14px' }}>A Confluence space will be automatically created when the project is formally awarded.</div>
                          <a href="https://apnileapos.atlassian.net/wiki" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 14px', background: '#0052cc', color: '#fff', fontSize: '11px', fontWeight: '600', borderRadius: '4px', textDecoration: 'none' }}>
                            Browse Confluence ↗
                          </a>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                        {[
                          { icon: '📝', label: 'Meeting Notes', desc: 'Agendas & minutes from project meetings' },
                          { icon: '📐', label: 'Technical Specs', desc: 'Architecture and design documentation' },
                          { icon: '✅', label: 'Deliverables', desc: 'Milestone reports and handover docs' },
                          { icon: '🔖', label: 'Project Wiki', desc: 'Guidelines, SOPs and team handbook' },
                        ].map(doc => (
                          <div key={doc.label} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px', cursor: 'pointer' }}>
                            <div style={{ fontSize: '18px', marginBottom: '6px' }}>{doc.icon}</div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>{doc.label}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{doc.desc}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── CALENDAR ── */}
                  {currentTab === 'calendar' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>🗓 Project Calendar</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Key dates and milestones for this project.</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                          { label: 'Project Start', date: proj.createdAt ? new Date(proj.createdAt).toLocaleDateString() : 'TBD', icon: '🟢', color: '#3fb950' },
                          { label: 'Team Allocation', date: assignedTeam ? 'Completed' : 'Pending', icon: assignedTeam ? '✅' : '⏳', color: assignedTeam ? '#3fb950' : '#ff9800' },
                          { label: 'Epic Review', date: proj.epics?.length > 0 ? `${proj.epics.length} Epics defined` : 'Not started', icon: proj.epics?.length > 0 ? '📋' : '⏳', color: proj.epics?.length > 0 ? '#58a6ff' : 'var(--text-secondary)' },
                          { label: 'Project Deadline', date: proj.duration || 'TBD', icon: '🏁', color: '#ff9800' },
                        ].map(item => (
                          <div key={item.label} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '18px' }}>{item.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>{item.label}</div>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: '600', color: item.color }}>{item.date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── TIMELINE ── */}
                  {currentTab === 'timeline' && (
                    <div>
                      <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', margin: '0 0 16px 0' }}>— Project Timeline</h4>
                      <div style={{ position: 'relative', paddingLeft: '24px' }}>
                        <div style={{ position: 'absolute', left: '8px', top: 0, bottom: 0, width: '2px', background: 'var(--border)' }} />
                        {[
                          { label: 'Project Created', detail: `By ${proj.createdBy || 'Admin'} · ${proj.createdAt ? new Date(proj.createdAt).toLocaleDateString() : ''}`, done: true },
                          { label: 'Allocated to Spoke', detail: `Assigned to ${spokeId?.replace('-spoke', '').toUpperCase() || 'Spoke'}`, done: true },
                          { label: 'Project Accepted', detail: proj.acceptedBy ? `Accepted by ${proj.acceptedBy}` : 'Awaiting acceptance', done: !!proj.acceptedBy },
                          { label: 'Team Assigned', detail: assignedTeam ? `Team: ${assignedTeam.name}` : 'Awaiting team allocation from Faculty', done: !!assignedTeam },
                          { label: 'Epics & Work Items', detail: proj.epics?.length > 0 ? `${proj.epics.length} epics defined` : 'Epics not yet defined', done: proj.epics?.length > 0 },
                          { label: 'Development in Progress', detail: 'Active development phase', done: false },
                          { label: 'Project Delivery', detail: `Expected in ${proj.duration || 'TBD'}`, done: false },
                        ].map((step, idx) => (
                          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px', position: 'relative' }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: step.done ? '#3fb950' : 'var(--bg-card)', border: `2px solid ${step.done ? '#3fb950' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '-8px', zIndex: 1, fontSize: '9px', color: '#fff' }}>
                              {step.done ? '✓' : ''}
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '600', color: step.done ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{step.label}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{step.detail}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── REPORTS ── */}
                  {currentTab === 'reports' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>📊 Project Reports</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                        {[
                          { label: 'Total Epics', value: proj.epics?.length || 0, sub: 'Defined deliverables', color: '#58a6ff' },
                          { label: 'Completed', value: proj.epics?.filter(e => e.status === 'Done').length || 0, sub: 'Epics closed', color: '#3fb950' },
                          { label: 'In Progress', value: proj.epics?.filter(e => e.status === 'In Progress').length || 0, sub: 'Active epics', color: '#ff9800' },
                          { label: 'Team Size', value: assignedTeam?.members?.length || 0, sub: 'Members assigned', color: '#7f85f5' },
                        ].map(kpi => (
                          <div key={kpi.label} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '14px', textAlign: 'center' }}>
                            <div style={{ fontSize: '28px', fontWeight: '800', color: kpi.color }}>{kpi.value}</div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)', marginTop: '4px' }}>{kpi.label}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{kpi.sub}</div>
                          </div>
                        ))}
                      </div>
                      {(proj.workProgressDocs && proj.workProgressDocs.length > 0) ? (
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '8px' }}>UPLOADED REPORTS</div>
                          {proj.workProgressDocs.map((doc, i) => (
                            <div key={i} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 14px', marginBottom: '6px', fontSize: '12px', color: 'var(--text-primary)' }}>📎 {doc.name || `Report ${i + 1}`}</div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ background: 'var(--bg-primary)', border: '1px dashed var(--border)', borderRadius: '6px', padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>No progress reports uploaded yet.</div>
                      )}
                    </div>
                  )}

                  {/* ── FORMS ── */}
                  {currentTab === 'forms' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>☰ Project Forms &amp; Submissions</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {[
                          { label: 'Team Member Registration', icon: '👤', status: assignedTeam ? 'Completed' : 'Pending', color: assignedTeam ? '#3fb950' : '#ff9800' },
                          { label: 'Project Acceptance Form', icon: '✅', status: proj.acceptedBy ? 'Submitted' : 'Pending', color: proj.acceptedBy ? '#3fb950' : '#ff9800' },
                          { label: 'Weekly Progress Report', icon: '📝', status: 'Open for submission', color: '#58a6ff' },
                          { label: 'Milestone Delivery Form', icon: '🏁', status: 'Not yet due', color: 'var(--text-secondary)' },
                        ].map(form => (
                          <div key={form.label} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '18px' }}>{form.icon}</span>
                            <div style={{ flex: 1, fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{form.label}</div>
                            <span style={{ fontSize: '11px', fontWeight: '600', color: form.color }}>{form.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── DEPLOYMENTS ── */}
                  {currentTab === 'deployments' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>🚀 Deployments</h4>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Track deployments linked to this project via Jira.</p>
                      <div style={{ background: 'var(--bg-primary)', border: '1px dashed var(--border)', borderRadius: '6px', padding: '28px', textAlign: 'center' }}>
                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>🚀</div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>No Deployments Recorded Yet</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: '1.6' }}>
                          Link your CI/CD pipeline with Jira by including the issue key in commit messages.<br />
                          Use key <code style={{ background: 'var(--bg-card)', padding: '1px 6px', borderRadius: '3px', color: '#58a6ff' }}>{proj.jiraProjectKey || 'KEY'}</code> in deployments.
                        </div>
                        {proj.jiraProjectKey && !proj.jiraProjectKey.startsWith('APNI') && (
                          <a href={`https://apnileapos.atlassian.net/jira/software/projects/${proj.jiraProjectKey}/deployments`} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 14px', background: '#238636', color: '#fff', fontSize: '11px', fontWeight: '600', borderRadius: '4px', textDecoration: 'none' }}>
                            View in Jira ↗
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── TEAM (always visible at bottom) ── */}
                  {currentTab === 'summary' && (
                    <div style={{ borderTop: '1px solid var(--bg-card)', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h4 style={{ fontSize: '13px', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>👥 Spoke Team Allocation</h4>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                          {assignedTeam
                            ? `Currently assigned to: ${assignedTeam.name} (${assignedTeam.members?.length || 0} members)`
                            : user?.role === 'College-SPOC' ? 'No team allocated yet.' : 'No team allocated yet. Choose an internal team below to assign this project.'}
                        </p>
                      </div>
                      {user?.role !== 'College-SPOC' ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <select value={selectedTeam[proj.id] || ''} onChange={(e) => setSelectedTeam({ ...selectedTeam, [proj.id]: e.target.value })} style={{ padding: '6px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px' }}>
                            <option value="">Select Team...</option>
                            {SpokeTeams.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                          </select>
                          <button onClick={() => handleAssignTeam(proj.id)} disabled={!selectedTeam[proj.id]} style={{ background: '#3fb950', border: 'none', color: '#ffffff', padding: '6px 12px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer', opacity: selectedTeam[proj.id] ? 1 : 0.5 }}>Assign Team</button>
                        </div>
                      ) : (
                        !assignedTeam && <div style={{ fontSize: '12px', color: '#ff9800', fontWeight: '500' }}>⏳ Awaiting team allocation from Faculty.</div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
