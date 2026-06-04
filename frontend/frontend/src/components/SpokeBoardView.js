import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 
  (window.location.port === '3000' ? 'http://localhost:5000' : '');

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

  const currentSpoke = spokes.find(s => s.id === spokeId) || { name: 'Loading Spoke...' };
  const isLive = currentSpoke.type === 'live';

  const handleAcceptAllocation = async (projectId) => {
    setSubmitting(true);
    try {
      const token = user?.token;
      await axios.post(`${API}/projects/${projectId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Project accepted by Faculty Handler successfully!');
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
  const hasAccess = user?.role === 'Super-admin' || (user?.role === 'College-SPOC' && user?.collegeId === spokeId);

  if (!hasAccess) {
    return (
      <div className="privilege-banner" style={{ margin: '20px 0', padding: '20px' }}>
        <div className="privilege-title" style={{ fontSize: '18px', color: '#ff7b72', fontWeight: 'bold' }}>Access Restricted</div>
        <div className="privilege-desc" style={{ marginTop: '8px', color: '#8b949e' }}>
          Only Spoke Administrators (SPOC) for **{currentSpoke.name || 'this Spoke'}** or **Apni Leap Moderators** are authorized to access this space.
        </div>
      </div>
    );
  }

  // Filter teams permitted for this Spoke
  const SpokeTeamIds = currentSpoke.teams || [];
  const SpokeTeams = teams.filter(t => SpokeTeamIds.includes(t.id));

  return (
    <div className="spoke-board-view" style={{ color: '#c9d1d9' }}>
      {/* Title Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#f0f6fc', margin: '0 0 6px 0' }}>🎓 {currentSpoke.name} Board</h1>
          <p style={{ fontSize: '13px', color: '#8b949e', margin: 0 }}>
            Managed by <strong>{currentSpoke.spocName}</strong> ({currentSpoke.spocEmail}) · Type: 
            <span style={{ marginLeft: '6px', padding: '2px 6px', fontSize: '10px', borderRadius: '4px', background: isLive ? 'rgba(56,139,253,0.15)' : 'rgba(110,118,129,0.15)', color: isLive ? '#58a6ff' : '#8b949e', border: `1px solid ${isLive ? '#58a6ff' : '#8b949e'}` }}>
              {isLive ? 'LIVE JIRA SYNC' : 'LOCAL SIMULATOR'}
            </span>
          </p>
        </div>
        <button onClick={fetchData} className="chat-btn" style={{ background: '#21262d', border: '1px solid #30363d', color: '#c9d1d9', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px' }}>
          🔄 Refresh Board
        </button>
      </div>

      {error && <div style={{ color: '#ff7b72', padding: '10px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.2)', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 10px auto' }} />
          <div style={{ fontSize: '13px', color: '#8b949e' }}>Loading Board...</div>
        </div>
      ) : projects.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#8b949e', border: '1px dashed #30363d', borderRadius: '6px', background: '#161b22' }}>
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
                <div key={proj.id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #21262d', paddingBottom: '14px', marginBottom: '14px' }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#ff7b72', fontWeight: 'bold', textTransform: 'uppercase' }}>{proj.company}</span>
                      <h3 style={{ fontSize: '18px', color: '#f0f6fc', margin: '4px 0 6px 0' }}>{proj.title}</h3>
                      <p style={{ fontSize: '13px', color: '#8b949e', margin: 0, maxWidth: '650px' }}>{proj.description}</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '16px', color: '#3fb950', fontWeight: 'bold' }}>${proj.funding?.toLocaleString()}</div>
                      <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '2px' }}>Duration: {proj.duration}</div>
                    </div>
                  </div>
                  <div style={{ background: '#0d1117', border: '1px dashed #ff9800', padding: '20px', borderRadius: '6px', textAlign: 'center' }}>
                    <h4 style={{ fontSize: '14px', color: '#ff9800', margin: '0 0 6px 0' }}>⏳ Faculty Project Acceptance Pending</h4>
                    <p style={{ fontSize: '12px', color: '#8b949e', margin: '0 0 16px 0' }}>
                      This B2B proposal is allocated to your Spoke. Faculty Handler review and acceptance are required before team delegation and Epic creation.
                    </p>
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
                  </div>
                </div>
              );
            }

            // Accepted & Active State
            return (
              <div key={proj.id} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #21262d', paddingBottom: '14px', marginBottom: '14px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: '#ff7b72', fontWeight: 'bold', textTransform: 'uppercase' }}>{proj.company}</span>
                    <h3 style={{ fontSize: '18px', color: '#f0f6fc', margin: '4px 0 6px 0' }}>{proj.title}</h3>
                    <p style={{ fontSize: '13px', color: '#8b949e', margin: 0, maxWidth: '650px' }}>{proj.description}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '16px', color: '#3fb950', fontWeight: 'bold' }}>${proj.funding?.toLocaleString()}</div>
                    <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '2px' }}>Duration: {proj.duration}</div>
                  </div>
                </div>

                {/* Epics / Jira Board Sync Section */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ fontSize: '13px', color: '#f0f6fc', margin: 0 }}>📋 Project Epics & Board Reflection</h4>
                    
                    {addingEpicProjId === proj.id ? (
                      <div style={{ background: '#0d1117', border: '1px solid #30363d', padding: '14px', borderRadius: '6px', position: 'absolute', right: '40px', zIndex: 10, width: '280px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                        <h5 style={{ fontSize: '11px', color: '#f0f6fc', margin: '0 0 8px 0' }}>➕ Add New Epic to Jira</h5>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <input
                            type="text"
                            placeholder="Epic Title"
                            value={newEpicTitle[proj.id] || ''}
                            onChange={(e) => setNewEpicTitle({ ...newEpicTitle, [proj.id]: e.target.value })}
                            style={{ padding: '6px 10px', background: '#161b22', border: '1px solid #30363d', borderRadius: '4px', color: '#c9d1d9', fontSize: '12px' }}
                            required
                          />
                          <textarea
                            placeholder="Epic Description"
                            value={newEpicDesc[proj.id] || ''}
                            onChange={(e) => setNewEpicDesc({ ...newEpicDesc, [proj.id]: e.target.value })}
                            style={{ padding: '6px 10px', background: '#161b22', border: '1px solid #30363d', borderRadius: '4px', color: '#c9d1d9', fontSize: '11px', height: '40px', resize: 'vertical' }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => setAddingEpicProjId(null)}
                              style={{ padding: '4px 10px', background: 'none', border: '1px solid #30363d', color: '#8b949e', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCreateEpic(proj.id)}
                              disabled={submitting}
                              style={{ padding: '4px 12px', background: '#2188ff', border: 'none', color: '#ffffff', borderRadius: '4px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                            >
                              {submitting ? 'Syncing...' : 'Create & Sync'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingEpicProjId(proj.id)}
                        style={{ background: '#21262d', border: '1px solid #30363d', color: '#58a6ff', padding: '4px 10px', fontSize: '11px', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
                      >
                        ➕ Create Epic on Jira
                      </button>
                    )}
                  </div>
                  
                  {!proj.epics || proj.epics.length === 0 ? (
                    <div style={{ background: '#0d1117', border: '1px dashed #30363d', padding: '16px', borderRadius: '6px', textAlign: 'center', color: '#8b949e', fontSize: '12px' }}>
                      No Epics defined. Click "Create Epic on Jira" above to add deliverables for this project.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                      {proj.epics && proj.epics.map(epic => {
                        return (
                          <div key={epic.id} style={{ background: '#0d1117', border: '1px solid #30363d', padding: '12px', borderRadius: '6px', position: 'relative' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              {!epic.jiraKey ? (
                                <span style={{ fontSize: '11px', color: '#ff9800', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  ⏳ Awaiting Sync
                                </span>
                              ) : epic.jiraKey.startsWith('MOCK') ? (
                                <span style={{ fontSize: '11px', color: '#8b949e', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {epic.jiraKey} (Mock)
                                </span>
                              ) : (
                                <a 
                                  href={`https://apnileapos.atlassian.net/browse/${epic.jiraKey}`} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  style={{ fontSize: '11px', color: '#58a6ff', fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  {epic.jiraKey} ↗
                                </a>
                              )}
                              <span style={{ fontSize: '9px', fontWeight: 'bold', padding: '2px 6px', borderRadius: '10px', background: epic.status === 'Done' ? 'rgba(56,139,253,0.15)' : 'rgba(110,118,129,0.15)', color: epic.status === 'Done' ? '#58a6ff' : '#8b949e' }}>
                                {epic.status}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#f0f6fc', marginBottom: '4px' }}>{epic.title}</div>
                            <div style={{ fontSize: '10px', color: '#8b949e', lineHeight: '1.3' }}>{epic.description}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Team Assignment Section */}
                <div style={{ borderTop: '1px solid #21262d', paddingTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h4 style={{ fontSize: '13px', color: '#f0f6fc', margin: '0 0 4px 0' }}>👥 Spoke Team Allocation</h4>
                    <p style={{ fontSize: '11px', color: '#8b949e', margin: 0 }}>
                      {assignedTeam 
                        ? `Currently assigned to: ${assignedTeam.name} (${assignedTeam.members?.length || 0} members)`
                        : 'No team allocated yet. Choose an internal team below to assign this project.'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={selectedTeam[proj.id] || ''}
                      onChange={(e) => setSelectedTeam({ ...selectedTeam, [proj.id]: e.target.value })}
                      style={{ padding: '6px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '4px', color: '#c9d1d9', fontSize: '12px' }}
                    >
                      <option value="">Select Team...</option>
                      {SpokeTeams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAssignTeam(proj.id)}
                      disabled={!selectedTeam[proj.id]}
                      style={{ background: '#3fb950', border: 'none', color: '#ffffff', padding: '6px 12px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer', opacity: selectedTeam[proj.id] ? 1 : 0.5 }}
                    >
                      Assign Team
                    </button>
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
