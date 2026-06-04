import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 
  (window.location.port === '3000' ? 'http://localhost:5000' : '');

export default function FacultyPortalView({ user }) {
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Interactive mock states
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [activeTab, setActiveTab] = useState('epics'); // epics | team | confluence
  const [confluenceLinked, setConfluenceLinked] = useState(true);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [announcements, setAnnouncements] = useState([
    { id: 1, title: 'Sprint 3 Review Scheduled', date: 'June 2, 2026', body: 'The program sponsor (Infosys) will join for live milestone sign-off.' },
    { id: 2, title: 'Code Integration Guidelines', date: 'May 30, 2026', body: 'Please ensure all pull requests are tagged with the respective Jira Epic key.' }
  ]);
  const [newAnnounce, setNewAnnounce] = useState({ title: '', body: '' });

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = user?.token;
      const [projRes, teamRes] = await Promise.all([
        axios.get(`${API}/projects`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/teams`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      // Filter projects: standard Faculty sees their own Spoke's projects, Super-admin sees everything.
      const rawProjects = projRes.data || [];
      const collegeFilter = user?.collegeId;
      const isSuper = user?.role === 'Super-admin' || user?.role === 'Admin';
      
      const filteredProjs = isSuper 
        ? rawProjects 
        : rawProjects.filter(p => p.spokeId === collegeFilter);

      setProjects(filteredProjs);
      setTeams(teamRes.data || []);

      if (filteredProjs.length > 0) {
        setSelectedProjectId(filteredProjs[0].id);
      }
    } catch (err) {
      console.error('Error fetching Faculty Portal data:', err);
      setError('Failed to load portal statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const assignedTeam = selectedProject ? teams.find(t => t.id === selectedProject.teamId) : null;

  // Milestone/Epic stats
  const epics = selectedProject?.epics || [];
  const completedEpics = epics.filter(e => e.status === 'Done' || e.status === 'Complete').length;
  const completionPercent = epics.length > 0 ? Math.round((completedEpics / epics.length) * 100) : 0;

  const handleCreateConfluenceSpace = (e) => {
    e.preventDefault();
    if (!newSpaceName) return;
    setCreatingSpace(true);
    setTimeout(() => {
      setCreatingSpace(false);
      setConfluenceLinked(true);
      setNewSpaceName('');
      alert(`Confluence Space "${newSpaceName}" auto-provisioned and linked to Jira Epic board!`);
    }, 1200);
  };

  const handlePostAnnouncement = (e) => {
    e.preventDefault();
    if (!newAnnounce.title || !newAnnounce.body) return;
    setAnnouncements([
      {
        id: Date.now(),
        title: newAnnounce.title,
        date: 'Today',
        body: newAnnounce.body
      },
      ...announcements
    ]);
    setNewAnnounce({ title: '', body: '' });
  };

  return (
    <div className="faculty-portal-view" style={{ color: '#c9d1d9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#f0f6fc', margin: '0 0 6px 0' }}>🎓 Principal Investigator & Faculty Hub</h1>
          <p style={{ fontSize: '13px', color: '#8b949e', margin: 0 }}>Monitor academic project milestones, coordinate student development teams, and review Confluence documentation boards.</p>
        </div>
        {projects.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#8b949e' }}>Select Project:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #30363d',
                background: '#161b22',
                color: '#c9d1d9',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.title} ({p.company})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && <div style={{ color: '#ff7b72', padding: '10px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.2)', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '80px' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 10px auto', width: '32px', height: '32px', border: '3px solid rgba(88,166,255,0.2)', borderTopColor: '#58a6ff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: '13px', color: '#8b949e' }}>Loading PI Dashboard data...</div>
        </div>
      ) : projects.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#f0f6fc' }}>No Active Allocated Projects</h3>
          <p style={{ color: '#8b949e', fontSize: '13px', margin: 0 }}>There are no active portfolio projects currently assigned to your Spoke campus. Connect with the Program PMO Office to register one.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
          
          {/* LEFT: Main Content Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Project Overview Card */}
            {selectedProject && (
              <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: 'rgba(56, 139, 253, 0.15)',
                      color: '#58a6ff',
                      border: '1px solid rgba(56, 139, 253, 0.3)',
                      display: 'inline-block',
                      marginBottom: '8px'
                    }}>
                      {selectedProject.status.replace('_', ' ')}
                    </span>
                    <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#f0f6fc', margin: '0 0 6px 0' }}>{selectedProject.title}</h2>
                    <p style={{ fontSize: '13px', color: '#8b949e', margin: 0 }}>{selectedProject.description || 'No description provided.'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#58a6ff' }}>${selectedProject.funding.toLocaleString()}</div>
                    <div style={{ fontSize: '11px', color: '#8b949e' }}>Corporate Funding</div>
                  </div>
                </div>

                {/* Progress bar metrics */}
                <div style={{ marginTop: '16px', background: '#0d1117', padding: '12px', border: '1px solid #21262d', borderRadius: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8b949e', marginBottom: '6px' }}>
                    <span>Epic Completion Progress</span>
                    <span style={{ fontWeight: '600', color: '#c9d1d9' }}>{completionPercent}% ({completedEpics}/{epics.length} Epics)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#21262d', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${completionPercent}%`, height: '100%', background: '#3fb950', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #30363d', gap: '8px' }}>
              {[
                { id: 'epics', label: '📋 Jira Epics & Milestones' },
                { id: 'team', label: '👥 Student Team Roster' },
                { id: 'confluence', label: '📁 Confluence Document Spaces' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '500',
                    background: activeTab === tab.id ? '#161b22' : 'transparent',
                    color: activeTab === tab.id ? '#58a6ff' : '#8b949e',
                    border: '1px solid transparent',
                    borderBottomColor: activeTab === tab.id ? '#161b22' : 'transparent',
                    borderRadius: '6px 6px 0 0',
                    cursor: 'pointer',
                    marginBottom: '-1px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* TAB CONTENT: Epics & Milestones */}
            {activeTab === 'epics' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {epics.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', color: '#8b949e', fontSize: '13px' }}>
                    No Epics created or synced yet for this project.
                  </div>
                ) : (
                  epics.map(epic => {
                    const statusColors = {
                      'Done': { bg: 'rgba(63, 185, 80, 0.15)', text: '#3fb950', border: 'rgba(63, 185, 80, 0.3)' },
                      'Complete': { bg: 'rgba(63, 185, 80, 0.15)', text: '#3fb950', border: 'rgba(63, 185, 80, 0.3)' },
                      'In Progress': { bg: 'rgba(210, 153, 34, 0.15)', text: '#d29922', border: 'rgba(210, 153, 34, 0.3)' },
                      'To Do': { bg: 'rgba(139, 148, 158, 0.15)', text: '#8b949e', border: 'rgba(139, 148, 158, 0.3)' }
                    };
                    const color = statusColors[epic.status] || statusColors['To Do'];
                    
                    return (
                      <div key={epic.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', fontFamily: 'monospace', color: '#58a6ff', background: 'rgba(88, 166, 255, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                              {epic.jiraKey || 'NOT SYNCED'}
                            </span>
                            <span style={{ fontSize: '14px', fontWeight: '600', color: '#f0f6fc' }}>{epic.title}</span>
                          </div>
                          <p style={{ fontSize: '12px', color: '#8b949e', margin: 0 }}>{epic.description || 'No description provided.'}</p>
                        </div>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          background: color.bg,
                          color: color.text,
                          border: `1px solid ${color.border}`
                        }}>
                          {epic.status}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB CONTENT: Team Roster */}
            {activeTab === 'team' && (
              <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
                {assignedTeam ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #21262d', paddingBottom: '12px' }}>
                      <div>
                        <h3 style={{ fontSize: '16px', color: '#f0f6fc', margin: '0 0 4px 0' }}>👥 Workgroup: {assignedTeam.name}</h3>
                        <p style={{ fontSize: '12px', color: '#8b949e', margin: 0 }}>Assigned active development team members.</p>
                      </div>
                      <span style={{ fontSize: '12px', color: '#58a6ff', background: 'rgba(88,166,255,0.1)', padding: '4px 10px', borderRadius: '6px', fontWeight: '600' }}>
                        {assignedTeam.members?.length || 0} Members
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                      {assignedTeam.members && assignedTeam.members.map((member, index) => {
                        const name = member.split('@')[0].split('.').map(n => n.charAt(0).toUpperCase() + n.slice(1)).join(' ');
                        const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2);
                        
                        return (
                          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#0d1117', border: '1px solid #21262d', borderRadius: '6px' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: '#1f6feb',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              {initials}
                            </div>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: '600', color: '#f0f6fc' }}>{name}</div>
                              <div style={{ fontSize: '11px', color: '#8b949e' }}>{member}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#8b949e', fontSize: '13px' }}>
                    No student workgroup has been assigned to this project yet. Use Spoke Board to configure assignments.
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: Confluence Wiki */}
            {activeTab === 'confluence' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {!confluenceLinked ? (
                  <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '24px', textAlign: 'center' }}>
                    <h3 style={{ color: '#f0f6fc', margin: '0 0 8px 0' }}>Confluence Space Not Provisioned</h3>
                    <p style={{ color: '#8b949e', fontSize: '13px', margin: '0 0 16px 0', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
                      Auto-provision a secure knowledge storage space directly linked to this university spoke project. Perfect for spec documents and sprint retrospectives.
                    </p>
                    <form onSubmit={handleCreateConfluenceSpace} style={{ display: 'flex', gap: '8px', justifyContent: 'center', maxWidth: '400px', margin: '0 auto' }}>
                      <input
                        type="text"
                        placeholder="Space Name (e.g. ApniCart KLE Spec)"
                        value={newSpaceName}
                        onChange={(e) => setNewSpaceName(e.target.value)}
                        required
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: '1px solid #30363d',
                          background: '#0d1117',
                          color: '#c9d1d9',
                          fontSize: '13px',
                          flex: 1
                        }}
                      />
                      <button
                        type="submit"
                        disabled={creatingSpace}
                        style={{
                          padding: '8px 16px',
                          borderRadius: '6px',
                          border: '1px solid rgba(56, 139, 253, 0.4)',
                          background: '#1f6feb',
                          color: '#ffffff',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        {creatingSpace ? 'Provisioning...' : 'Link Confluence'}
                      </button>
                    </form>
                  </div>
                ) : (
                  <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #21262d', paddingBottom: '12px', marginBottom: '16px' }}>
                      <div>
                        <h3 style={{ fontSize: '16px', color: '#f0f6fc', margin: '0 0 4px 0' }}>📂 Confluence Space: {selectedProject?.title} Specs</h3>
                        <p style={{ fontSize: '12px', color: '#8b949e', margin: 0 }}>Linked spec logs and academic delivery drafts.</p>
                      </div>
                      <button 
                        onClick={() => setConfluenceLinked(false)}
                        style={{ background: 'none', border: 'none', color: '#f85149', cursor: 'pointer', fontSize: '12px' }}
                      >
                        Disconnect
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {[
                        { title: 'Project Specification Book v1.1', desc: 'Architecture drafts, user journeys, database schemas.', author: 'Prof. Ramesh Patil', date: '3 days ago' },
                        { title: 'Milestone 2 Delivery Report', desc: 'Summary of API test results and load handling statistics.', author: 'Student Team Leader', date: 'Yesterday' },
                        { title: 'Sprint 2 Retrospective Logs', desc: 'Identified sprint blockers, technical debt, and next steps.', author: 'Prof. Ramesh Patil', date: 'May 28, 2026' }
                      ].map((doc, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#0d1117', border: '1px solid #21262d', borderRadius: '6px' }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#58a6ff', cursor: 'pointer' }}>📄 {doc.title}</div>
                            <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '2px' }}>{doc.desc}</div>
                          </div>
                          <div style={{ textAlign: 'right', fontSize: '11px', color: '#8b949e' }}>
                            <div>{doc.author}</div>
                            <div>{doc.date}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* RIGHT SIDEBAR: PI Actions & Rovo Assistant */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Rovo AI Panel */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(88,166,255,0.06), rgba(98,100,167,0.12))',
              border: '1px solid rgba(88,166,255,0.2)',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#7f85f5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#c9d1d9', margin: 0 }}>Rovo AI Faculty Agent</h3>
              </div>
              
              <div style={{ fontSize: '12px', color: '#8b949e', lineHeight: '1.4' }}>
                <div style={{ background: 'rgba(13,17,23,0.6)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #7f85f5', marginBottom: '10px' }}>
                  <strong>🤖 Risk Alert:</strong> ECOM-E3 has 4 items in "In Progress" with only 3 days remaining. Recommended to host a quick stand-up with the student team.
                </div>
                <div style={{ background: 'rgba(13,17,23,0.6)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #3fb950' }}>
                  <strong>💡 Resource Match:</strong> Student Developer (Amol Patil) completed 6 tasks early. Recommended to assign them to Epic Payments validation.
                </div>
              </div>
            </div>

            {/* Announcements Panel */}
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
              <h3 style={{ fontSize: '14px', color: '#f0f6fc', margin: '0 0 12px 0' }}>📢 PI Announcements</h3>
              
              <form onSubmit={handlePostAnnouncement} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                <input
                  type="text"
                  placeholder="Title..."
                  value={newAnnounce.title}
                  onChange={(e) => setNewAnnounce({ ...newAnnounce, title: e.target.value })}
                  required
                  style={{
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid #30363d',
                    background: '#0d1117',
                    color: '#c9d1d9',
                    fontSize: '12px'
                  }}
                />
                <textarea
                  placeholder="Post brief details to team..."
                  value={newAnnounce.body}
                  onChange={(e) => setNewAnnounce({ ...newAnnounce, body: e.target.value })}
                  required
                  rows={2}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '4px',
                    border: '1px solid #30363d',
                    background: '#0d1117',
                    color: '#c9d1d9',
                    fontSize: '12px',
                    resize: 'none'
                  }}
                />
                <button
                  type="submit"
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    background: '#3fb950',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    alignSelf: 'flex-end'
                  }}
                >
                  Broadcast
                </button>
              </form>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                {announcements.map(ann => (
                  <div key={ann.id} style={{ background: '#0d1117', padding: '10px', border: '1px solid #21262d', borderRadius: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#8b949e', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '600', color: '#f0f6fc' }}>{ann.title}</span>
                      <span>{ann.date}</span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#8b949e', margin: 0 }}>{ann.body}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
