import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 
  (window.location.port === '3000' ? 'http://localhost:5000' : '');

export default function MentorPortalView({ user }) {
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Interactive mock states
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [activeTab, setActiveTab] = useState('pr'); // pr | verify | feed
  const [pullRequests, setPullRequests] = useState([
    { id: 1, title: '🔑 SCRUM-12: Implement secure JWT authorization', additions: 180, deletions: 12, files: 4, author: 'Student Dev (Ketan)', status: 'Needs Review', branch: 'feat/auth-jwt' },
    { id: 2, title: '🛒 SCRUM-14: Fix active cart local storage duplicate item bug', additions: 45, deletions: 32, files: 2, author: 'Student Dev (Swati)', status: 'Approved', branch: 'bugfix/cart-duplicate' },
    { id: 3, title: '💳 SCRUM-18: Secure payment gateway checkout form inputs', additions: 280, deletions: 5, files: 6, author: 'Student Dev (Rahul)', status: 'Changes Requested', branch: 'feat/payment-checkout' }
  ]);
  const [mentorComments, setMentorComments] = useState([
    { id: 1, author: 'Mr. Sanjay Sen (Infosys Mentor)', role: 'Tech Liaison', date: 'May 30, 2026', text: 'Great progress on the database mapping! Make sure to verify index utilization in payments table.' },
    { id: 2, author: 'Prof. Ramesh Patil (PI)', role: 'Faculty Spoke', date: 'May 28, 2026', text: 'The students have set up the API endpoints as suggested in the architecture specs.' }
  ]);
  const [newComment, setNewComment] = useState('');

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

      const rawProjects = projRes.data || [];
      // Industry Liaison sees B2B projects assigned to their company.
      // Super-admin sees everything.
      const isSuper = user?.role === 'Super-admin' || user?.role === 'Admin';
      const companyFilter = user?.name?.toLowerCase().includes('infosys') ? 'Infosys' : 
                            user?.name?.toLowerCase().includes('nvidia') ? 'NVIDIA' : null;
      
      const filteredProjs = isSuper
        ? rawProjects 
        : companyFilter 
          ? rawProjects.filter(p => p.company?.toLowerCase() === companyFilter.toLowerCase())
          : rawProjects; // default fallback

      setProjects(filteredProjs);
      setTeams(teamRes.data || []);

      if (filteredProjs.length > 0) {
        setSelectedProjectId(filteredProjs[0].id);
      }
    } catch (err) {
      console.error('Error fetching Mentor Portal data:', err);
      setError('Failed to load portfolio details.');
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

  // Interactive Pull Request actions
  const handlePRAction = (prId, newStatus) => {
    setPullRequests(pullRequests.map(pr => {
      if (pr.id === prId) {
        return { ...pr, status: newStatus };
      }
      return pr;
    }));
    alert(`Pull Request status successfully updated to "${newStatus}"!`);
  };

  // Interactive milestone verification
  const handleVerifyEpic = async (epicId) => {
    if (!selectedProject) return;
    try {
      // Mock local update first
      const updatedEpics = selectedProject.epics.map(e => {
        if (e.id === epicId) {
          return { ...e, status: 'Done' };
        }
        return e;
      });

      // Fetch projects, modify target, and save
      // In a real app we'd trigger a specific endpoint. 
      // For demo convenience, let's update local state to Done and prompt success!
      setProjects(projects.map(p => {
        if (p.id === selectedProjectId) {
          return { ...p, epics: updatedEpics };
        }
        return p;
      }));

      alert(`Milestone successfully verified! Governance Agent has registered the sign-off.`);
    } catch (err) {
      console.error('Error signing off milestone:', err);
    }
  };

  const handlePostComment = (e) => {
    e.preventDefault();
    if (!newComment) return;
    setMentorComments([
      {
        id: Date.now(),
        author: `${user?.name || 'Industry Liaison'} (${selectedProject?.company || 'Mentor'})`,
        role: 'Tech Liaison',
        date: 'Just now',
        text: newComment
      },
      ...mentorComments
    ]);
    setNewComment('');
  };

  return (
    <div className="mentor-portal-view" style={{ color: 'var(--text-primary)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 6px 0' }}>💼 Industry Mentor & Liaison Portal</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Review student code delivery, execute milestone quality gates, verify pull requests, and consult analytics compliance boards.</p>
        </div>
        {projects.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Select Project:</span>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
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
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading Corporate Dashboard data...</div>
        </div>
      ) : projects.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>No Associated Corporate Projects</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>There are no sponsored projects associated with your corporate organization account.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px' }}>
          
          {/* LEFT: Main Workspace Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Project Overview Card */}
            {selectedProject && (
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: 'rgba(63, 185, 80, 0.15)',
                      color: '#3fb950',
                      border: '1px solid rgba(63, 185, 80, 0.3)',
                      display: 'inline-block',
                      marginBottom: '8px'
                    }}>
                      Sponsor Connected: {selectedProject.company}
                    </span>
                    <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 6px 0' }}>{selectedProject.title}</h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>{selectedProject.description || 'No description provided.'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Milestone Progress</div>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#3fb950', marginTop: '4px' }}>{completionPercent}%</div>
                  </div>
                </div>

                {/* Team & Delivery details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px', background: 'var(--bg-primary)', padding: '12px', border: '1px solid var(--bg-card)', borderRadius: '6px' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Assigned University Spoke</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{selectedProject.spokeId === 'kle-spoke' ? 'KLE University' : 'COEP Spoke (Mock)'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Student Dev Team</span>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{assignedTeam ? assignedTeam.name : 'Not Assigned'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '8px' }}>
              {[
                { id: 'pr', label: '🐙 Code Pull Requests' },
                { id: 'verify', label: '🛡️ Milestone Gate Sign-off' },
                { id: 'feed', label: '💬 Mentor Collaboration Feed' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '500',
                    background: activeTab === tab.id ? 'var(--bg-secondary)' : 'transparent',
                    color: activeTab === tab.id ? '#58a6ff' : 'var(--text-secondary)',
                    border: '1px solid transparent',
                    borderBottomColor: activeTab === tab.id ? 'var(--bg-secondary)' : 'transparent',
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

            {/* TAB CONTENT: Pull Requests */}
            {activeTab === 'pr' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pullRequests.map(pr => {
                  const statusStyles = {
                    'Approved': { bg: 'rgba(63,185,80,0.15)', text: '#3fb950', border: 'rgba(63,185,80,0.3)' },
                    'Needs Review': { bg: 'rgba(210,153,34,0.15)', text: '#d29922', border: 'rgba(210,153,34,0.3)' },
                    'Changes Requested': { bg: 'rgba(248,81,73,0.15)', text: '#ff7b72', border: 'rgba(248,81,73,0.3)' }
                  };
                  const color = statusStyles[pr.status] || statusStyles['Needs Review'];
                  
                  return (
                    <div key={pr.id} style={{ padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{pr.title}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '2px' }}>branch: {pr.branch} · Author: {pr.author}</div>
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
                          {pr.status}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', borderTop: '1px solid var(--bg-card)', paddingTop: '10px' }}>
                        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <span>Files Changed: <strong>{pr.files}</strong></span>
                          <span style={{ color: '#3fb950' }}>+{pr.additions} lines</span>
                          <span style={{ color: '#ff7b72' }}>-{pr.deletions} lines</span>
                        </div>
                        
                        {pr.status === 'Needs Review' && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => handlePRAction(pr.id, 'Changes Requested')}
                              style={{ padding: '4px 8px', fontSize: '11px', background: 'rgba(248,81,73,0.1)', color: '#ff7b72', border: '1px solid rgba(248,81,73,0.3)', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Request Changes
                            </button>
                            <button
                              onClick={() => handlePRAction(pr.id, 'Approved')}
                              style={{ padding: '4px 8px', fontSize: '11px', background: 'rgba(63,185,80,0.1)', color: '#3fb950', border: '1px solid rgba(63,185,80,0.3)', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Approve PR
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB CONTENT: Milestone Gates */}
            {activeTab === 'verify' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {epics.length === 0 ? (
                  <div style={{ padding: '30px', textAlign: 'center', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    No milestones found for verification.
                  </div>
                ) : (
                  epics.map(epic => (
                    <div key={epic.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '4px' }}>
                          [{epic.jiraKey || 'MOCK'}] {epic.title}
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>{epic.description || 'No description provided.'}</p>
                      </div>
                      
                      <div>
                        {epic.status === 'Done' || epic.status === 'Complete' ? (
                          <span style={{ fontSize: '12px', color: '#3fb950', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                              <circle cx="7" cy="7" r="7" fill="rgba(63,185,80,0.15)"/>
                              <path d="M4 7L6.2 9.2L10 5" stroke="#3fb950" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                            </svg>
                            Verified
                          </span>
                        ) : (
                          <button
                            onClick={() => handleVerifyEpic(epic.id)}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid rgba(56, 139, 253, 0.4)',
                              background: '#1f6feb',
                              color: '#ffffff',
                              fontSize: '12px',
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            Verify Milestone
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB CONTENT: Feed */}
            {activeTab === 'feed' && (
              <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: '0 0 16px 0', borderBottom: '1px solid var(--bg-card)', paddingBottom: '10px' }}>
                  💬 Spec Discussions & Direct Collaboration Feed
                </h3>

                <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                  <input
                    type="text"
                    placeholder="Provide technical feedback or write down advice..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    required
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      flex: 1
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#3fb950',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Post Comment
                  </button>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {mentorComments.map(comment => (
                    <div key={comment.id} style={{ background: 'var(--bg-primary)', border: '1px solid var(--bg-card)', padding: '12px', borderRadius: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        <div>
                          <strong style={{ color: 'var(--text-primary)' }}>{comment.author}</strong> · <span>{comment.role}</span>
                        </div>
                        <span>{comment.date}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: 0, lineHeight: '1.4' }}>{comment.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* RIGHT SIDEBAR: Mentor Actions & Rovo AI */}
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
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Rovo AI Mentor Advisor</h3>
              </div>
              
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                <div style={{ background: 'rgba(13,17,23,0.6)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #d29922', marginBottom: '10px' }}>
                  <strong>🤖 Risk Advisor:</strong> Rahul (Student) submitted a checkout script with a high cyclomatic complexity of 14. Code refactoring is highly recommended.
                </div>
                <div style={{ background: 'rgba(13,17,23,0.6)', padding: '10px', borderRadius: '6px', borderLeft: '3px solid #58a6ff' }}>
                  <strong>💡 Automation Log:</strong> Syncing ECOM-E4 payment integration branch has triggered a Confluence spec update check automatically.
                </div>
              </div>
            </div>

            {/* Quick Actions Checklist */}
            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
              <h3 style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '0 0 12px 0' }}>📋 Mentor Checklist</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { label: 'Review secure JWT auth code spec', done: false },
                  { label: 'Verify cart local storage duplicate bugfix', done: true },
                  { label: 'Approve Payments module checkout PR', done: false },
                  { label: 'Participate in KLE Sprint 3 review call', done: false }
                ].map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: item.done ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={item.done}
                      readOnly
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ textDecoration: item.done ? 'line-through' : 'none' }}>{item.label}</span>
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
