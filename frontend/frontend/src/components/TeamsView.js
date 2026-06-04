import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 
  (window.location.port === '3000' ? 'http://localhost:5000' : '');

export default function TeamsView({ user, issues = [], onOpenIssueDetails }) {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Layout & Navigation State
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [activeTab, setActiveTab] = useState('backlog'); // 'backlog' | 'metrics'
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Create / Edit Form State
  const [teamName, setTeamName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [teamCollegeId, setTeamCollegeId] = useState('');
  const [spokes, setSpokes] = useState([]);
  
  // Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [newMessageIssue, setNewMessageIssue] = useState('');
  const [chatFilterIssue, setChatFilterIssue] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isSuperAdmin = user?.role === 'Super-admin';
  const canManageTeams = isSuperAdmin || user?.role === 'College-SPOC';
  const myName = user?.name || user?.email || 'Unknown';

  const fetchData = async () => {
    setLoading(true);
    try {
      const [teamsRes, usersRes, projectsRes, spokesRes] = await Promise.all([
        axios.get(`${API}/teams`),
        axios.get(`${API}/users`),
        axios.get(`${API}/projects`, {
          headers: { Authorization: `Bearer ${user?.token}` }
        }),
        axios.get(`${API}/spokes`)
      ]);
      const fetchedTeams = teamsRes.data || [];
      const fetchedSpokes = spokesRes.data || [];
      
      let userTeams = fetchedTeams;
      if (user?.role === 'College-SPOC') {
        const mySpoke = fetchedSpokes.find(s => s.id === user.collegeId);
        const myStaticTeams = mySpoke ? (mySpoke.teams || []) : [];
        userTeams = fetchedTeams.filter(t => t.collegeId === user.collegeId || myStaticTeams.includes(t.id));
      }
      
      setTeams(userTeams);
      setUsers(usersRes.data || []);
      setProjects(projectsRes.data || []);
      setSpokes(fetchedSpokes);
      
      // Auto-select first team if available and none selected yet
      if (fetchedTeams.length > 0 && !selectedTeam) {
        // Find team where current user is a member, or fallback to first team
        const myTeam = fetchedTeams.find(t => 
          (t.members || []).some(mId => {
            const dispName = getUserDisplayNameFromList(usersRes.data || [], mId);
            return dispName.toLowerCase().includes(myName.toLowerCase());
          })
        ) || fetchedTeams[0];
        
        handleSelectTeam(myTeam);
      }
    } catch (err) {
      console.error("Error loading Teams data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getUserDisplayNameFromList = (usersList, accountId) => {
    const found = usersList.find(u => u.accountId === accountId);
    return found ? found.displayName : "Unknown User";
  };

  const getUserDisplayName = (accountId) => {
    return getUserDisplayNameFromList(users, accountId);
  };

  const handleSelectTeam = async (team) => {
    setSelectedTeam(team);
    setShowCreateForm(false);
    setChatFilterIssue('');
    try {
      const res = await axios.get(`${API}/teams/${team.id}/messages`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      setChatMessages(res.data || []);
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  };

  const handleMemberToggle = (accountId) => {
    setSelectedMembers(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const handleCreateOrEditTeam = async (e) => {
    e.preventDefault();
    if (!canManageTeams) {
      setError("Permission denied. You are not authorized to manage teams.");
      return;
    }
    if (!teamName.trim()) {
      setError("Team name is required.");
      return;
    }
    if (selectedMembers.length === 0) {
      setError("Please select at least one member.");
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    let targetCollegeId = teamCollegeId || null;
    if (user?.role === 'College-SPOC') {
      targetCollegeId = user.collegeId;
    }

    try {
      if (editingTeamId) {
        const res = await axios.put(`${API}/teams/${editingTeamId}`, {
          name: teamName,
          members: selectedMembers,
          collegeId: targetCollegeId
        }, {
          headers: { Authorization: `Bearer ${user?.token}` }
        });
        setTeams(prev => prev.map(t => t.id === editingTeamId ? res.data : t));
        setSelectedTeam(res.data);
        setSuccessMsg(`Team "${res.data.name}" updated successfully!`);
      } else {
        const res = await axios.post(`${API}/teams`, {
          name: teamName,
          members: selectedMembers,
          collegeId: targetCollegeId
        }, {
          headers: { Authorization: `Bearer ${user?.token}` }
        });
        setTeams(prev => [...prev, res.data]);
        setSelectedTeam(res.data);
        setSuccessMsg(`Team "${res.data.name}" created successfully!`);
      }
      resetForm();
      setShowCreateForm(false);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      console.error("Error saving team:", err);
      setError(err.response?.data?.error || "Failed to save team.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setTeamName('');
    setSelectedMembers([]);
    setEditingTeamId(null);
    setTeamCollegeId('');
    setError('');
    setSuccessMsg('');
  };

  const handleEditClick = (team) => {
    setEditingTeamId(team.id);
    setTeamName(team.name);
    setSelectedMembers(team.members || []);
    setTeamCollegeId(team.collegeId || '');
    setShowCreateForm(true);
    setSelectedTeam(null);
    setError('');
    setSuccessMsg('');
  };

  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm("Are you sure you want to delete this team? This action is permanent and will unassign any active projects.")) return;
    setSubmitting(true);
    try {
      await axios.delete(`${API}/teams/${teamId}`, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      setSuccessMsg("Team deleted successfully!");
      setSelectedTeam(null);
      fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete team.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessageText.trim()) return;

    try {
      const res = await axios.post(`${API}/teams/${selectedTeam.id}/messages`, {
        sender: myName,
        text: newMessageText,
        issueKey: newMessageIssue || null,
        teamName: selectedTeam.name
      }, {
        headers: { Authorization: `Bearer ${user?.token}` }
      });
      setChatMessages(prev => [...prev, res.data]);
      setNewMessageText('');
      setNewMessageIssue('');
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const getTeamMetrics = (memberIds) => {
    const teamIssues = issues.filter(issue => {
      const assigneeId = issue.fields?.assignee?.accountId;
      return assigneeId && memberIds.includes(assigneeId);
    });

    let open = 0, inProgress = 0, done = 0;
    teamIssues.forEach(issue => {
      const s = (issue.fields?.status?.name || '').toLowerCase();
      if (s.includes("done") || s.includes("closed") || s.includes("resolved")) {
        done++;
      } else if (s.includes("progress") || s.includes("review") || s.includes("testing")) {
        inProgress++;
      } else {
        open++;
      }
    });

    const total = teamIssues.length;
    const donePct = total > 0 ? Math.round((done / total) * 100) : 0;
    const progressPct = total > 0 ? Math.round((inProgress / total) * 100) : 0;
    const openPct = total > 0 ? Math.round((open / total) * 100) : 0;

    return { total, open, inProgress, done, donePct, progressPct, openPct };
  };

  const getInitials = (name) => {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = ['#e056fd', '#30336b', '#130cb7', '#10ac84', '#ff9f43', '#ee5253', '#0abde3', '#5f27cd'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const renderMessageText = (text) => {
    const issueRegex = /([A-Z]+-[0-9]+)/g;
    const parts = text.split(issueRegex);
    return parts.map((part, i) => {
      if (part.match(issueRegex)) {
        return (
          <span 
            key={i} 
            className="chat-issue-badge" 
            onClick={() => onOpenIssueDetails && onOpenIssueDetails(part)}
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Group messages by Date for Faint Dividers
  const getGroupedMessages = (msgs) => {
    const groups = [];
    let lastDate = '';
    msgs.forEach(m => {
      const dateStr = new Date(m.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
      if (dateStr !== lastDate) {
        groups.push({ type: 'divider', date: dateStr, id: `div-${m.id}` });
        lastDate = dateStr;
      }
      groups.push({ type: 'message', data: m, id: m.id });
    });
    return groups;
  };

  const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const selectedTeamProjects = selectedTeam ? projects.filter(p => p.teamId === selectedTeam.id) : [];
  const selectedTeamIssues = selectedTeam ? issues.filter(issue => {
    const assigneeId = issue.fields?.assignee?.accountId;
    return assigneeId && (selectedTeam.members || []).includes(assigneeId);
  }) : [];

  const chatMessagesToShow = chatFilterIssue 
    ? chatMessages.filter(m => m.issueKey === chatFilterIssue || m.text.includes(chatFilterIssue))
    : chatMessages;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', background: '#111214', border: '1px solid #2d2d2d', borderRadius: '12px', overflow: 'hidden' }}>
      
      {/* ── LEFT SIDEBAR: TEAMS LIST ── */}
      <div style={{ width: '300px', borderRight: '1px solid #2d2d2d', display: 'flex', flexDirection: 'column', background: '#18191b', flexShrink: 0 }}>
        
        {/* Sidebar Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #2d2d2d' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff', margin: '0 0 12px 0' }}>Teams Workspace</h2>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search teams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#22252a',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '13px'
              }}
            />
          </div>
        </div>

        {/* Teams Scrollable List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '13px' }}>Loading...</div>
          ) : filteredTeams.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '13px' }}>No teams found.</div>
          ) : (
            filteredTeams.map(t => {
              const isSelected = selectedTeam && selectedTeam.id === t.id;
              const metrics = getTeamMetrics(t.members || []);
              return (
                <div
                  key={t.id}
                  onClick={() => handleSelectTeam(t)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(98, 100, 167, 0.25)' : 'transparent',
                    border: isSelected ? '1px solid rgba(98, 100, 167, 0.4)' : '1px solid transparent',
                    color: isSelected ? '#fff' : 'var(--text-primary)',
                    marginBottom: '4px',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => { if(!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                  onMouseLeave={(e) => { if(!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: getAvatarColor(t.name),
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    marginRight: '12px',
                    fontSize: '14px'
                  }}>
                    {getInitials(t.name)}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {t.members ? t.members.length : 0} members · {metrics.total} Jira tasks
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer Action */}
        {canManageTeams && (
          <div style={{ padding: '12px', borderTop: '1px solid #2d2d2d', background: '#141517' }}>
            <button
              onClick={() => { setShowCreateForm(true); setSelectedTeam(null); resetForm(); }}
              style={{
                width: '100%',
                padding: '8px',
                background: '#238636',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              ➕ Create New Team
            </button>
          </div>
        )}
      </div>

      {/* ── RIGHT MAIN PANEL ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1f2226' }}>
        
        {/* Placeholder / Empty State */}
        {!selectedTeam && !showCreateForm && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'var(--text-secondary)', textAlign: 'center' }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>👥</div>
            <h3 style={{ fontSize: '18px', color: '#fff', margin: '0 0 8px 0' }}>Welcome to Teams Workspace</h3>
            <p style={{ fontSize: '13px', maxWidth: '380px', margin: 0 }}>
              Select an active team from the left sidebar to view direct chats, track assigned B2B projects, and manage Jira workloads.
            </p>
          </div>
        )}

        {/* Create/Edit Team Form Pane */}
        {showCreateForm && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto', background: '#18191b', border: '1px solid var(--border)', padding: '24px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', color: '#fff', margin: 0 }}>{editingTeamId ? '📝 Edit Team Configuration' : '👥 Create New Team'}</h3>
                <button onClick={() => setShowCreateForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
              </div>

              <form onSubmit={handleCreateOrEditTeam}>
                {error && <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.2)', padding: '10px', color: '#ff7b72', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}
                {successMsg && <div style={{ background: 'rgba(56,139,253,0.1)', border: '1px solid rgba(56,139,253,0.2)', padding: '10px', color: '#58a6ff', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>{successMsg}</div>}

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Team Name</label>
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="e.g. Frontend Squad, backend-engineers"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    disabled={submitting}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff' }}
                    required
                  />
                </div>

                {user?.role === 'Super-admin' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>College Spoke Association</label>
                    <select
                      value={teamCollegeId}
                      onChange={(e) => setTeamCollegeId(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: '#fff' }}
                    >
                      <option value="">GLOBAL (No college restriction)</option>
                      {spokes.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', color: 'var(--text-primary)', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>Assign Members</label>
                  <div style={{
                    maxHeight: '220px',
                    overflowY: 'auto',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-primary)',
                    borderRadius: '6px',
                    padding: '8px'
                  }}>
                    {users.map(u => {
                      const isChecked = selectedMembers.includes(u.accountId);
                      return (
                        <label
                          key={u.accountId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            background: isChecked ? 'rgba(56,139,253,0.08)' : 'transparent',
                            color: isChecked ? '#58a6ff' : 'var(--text-primary)',
                            fontSize: '13px',
                            marginBottom: '2px'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleMemberToggle(u.accountId)}
                            disabled={submitting}
                          />
                          <span>{u.displayName} ({u.email})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !teamName.trim() || selectedMembers.length === 0}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#238636',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '14px',
                    opacity: (submitting || !teamName.trim() || selectedMembers.length === 0) ? 0.5 : 1
                  }}
                >
                  {submitting ? 'Saving Configuration...' : (editingTeamId ? 'Update Team Details' : 'Initialize Team')}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Selected Team Dashboard Pane */}
        {selectedTeam && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
            
            {/* Header Area */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #2d2d2d', background: '#18191b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: getAvatarColor(selectedTeam.name),
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  marginRight: '14px',
                  fontSize: '18px'
                }}>
                  {getInitials(selectedTeam.name)}
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: 0 }}>{selectedTeam.name}</h3>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Members: {selectedTeam.members?.map(mId => getUserDisplayName(mId)).join(', ')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {canManageTeams && (
                  <>
                    <button
                      onClick={() => handleEditClick(selectedTeam)}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      ✏️ Edit Team
                    </button>
                    <button
                      onClick={() => handleDeleteTeam(selectedTeam.id)}
                      disabled={submitting}
                      style={{
                        background: '#da3637',
                        border: 'none',
                        color: '#fff',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      🗑️ Delete Team
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Teams Tabs Bar (Backlog & Metrics only — Chat is in the unified Chat workspace) */}
            <div style={{ display: 'flex', background: '#18191b', borderBottom: '1px solid #2d2d2d', padding: '0 20px' }}>
              {[
                { id: 'backlog', label: '📋 Backlog & Epics' },
                { id: 'metrics', label: '📊 Performance Metrics' }
              ].map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      borderBottom: isActive ? '3px solid #6264a7' : '3px solid transparent',
                      color: isActive ? '#fff' : 'var(--text-secondary)',
                      padding: '12px 16px',
                      fontSize: '13px',
                      fontWeight: isActive ? 'bold' : 'normal',
                      cursor: 'pointer',
                      marginRight: '8px'
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT PANEL */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              

              {/* 📋 TAB: PROJECTS & BACKLOG */}
              {activeTab === 'backlog' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  
                  {/* B2B Projects Section */}
                  <div>
                    <h4 style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '14px' }}>
                      💼 Assigned B2B Projects ({selectedTeamProjects.length})
                    </h4>
                    {selectedTeamProjects.length === 0 ? (
                      <div style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border)', borderRadius: '6px', padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        No B2B projects assigned to this team yet.
                      </div>
                    ) : (
                      selectedTeamProjects.map(proj => (
                        <div key={proj.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                            <div>
                              <span style={{ fontSize: '10px', color: '#58a6ff', fontWeight: 'bold', textTransform: 'uppercase' }}>{proj.company}</span>
                              <h5 style={{ fontSize: '14px', color: '#fff', margin: '2px 0 4px 0' }}>{proj.title}</h5>
                              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>{proj.description}</p>
                            </div>
                            <span style={{ fontSize: '11px', background: 'rgba(56,139,253,0.15)', color: '#58a6ff', border: '1px solid rgba(56,139,253,0.3)', padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase' }}>
                              {proj.status}
                            </span>
                          </div>

                          {/* Epics checklist */}
                          <div style={{ marginTop: '12px', background: 'var(--bg-primary)', borderRadius: '6px', padding: '10px 14px' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', marginBottom: '6px' }}>Project Epics (Board Scope):</div>
                            {(!proj.epics || proj.epics.length === 0) ? (
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>No epics synced.</div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {proj.epics.map(ep => (
                                  <div key={ep.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                                    <span style={{ color: '#fff' }}>• {ep.title}</span>
                                    <span
                                      className="chat-issue-badge"
                                      onClick={() => onOpenIssueDetails && onOpenIssueDetails(ep.jiraKey)}
                                      style={{ fontSize: '10px', padding: '1px 6px' }}
                                    >
                                      {ep.jiraKey}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Jira Issues Table Section */}
                  <div>
                    <h4 style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '14px' }}>
                      📋 Jira Issues Assigned to Team Members ({selectedTeamIssues.length})
                    </h4>
                    {selectedTeamIssues.length === 0 ? (
                      <div style={{ background: 'var(--bg-secondary)', border: '1px dashed var(--border)', borderRadius: '6px', padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                        No active Jira issues found for members of this team.
                      </div>
                    ) : (
                      <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', background: 'var(--bg-secondary)', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                              <th style={{ padding: '10px 14px' }}>Issue Key</th>
                              <th style={{ padding: '10px 14px' }}>Summary / Issue Title</th>
                              <th style={{ padding: '10px 14px' }}>Status</th>
                              <th style={{ padding: '10px 14px' }}>Assignee</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedTeamIssues.map(issue => {
                              const s = issue.fields?.status?.name || 'To Do';
                              let statusBg = 'rgba(110,118,129,0.15)';
                              let statusFg = 'var(--text-secondary)';
                              if (s.toLowerCase().includes('done')) {
                                statusBg = 'rgba(56,139,253,0.15)';
                                statusFg = '#58a6ff';
                              } else if (s.toLowerCase().includes('progress')) {
                                statusBg = 'rgba(218,165,32,0.15)';
                                statusFg = '#d4af37';
                              }
                              
                              return (
                                <tr key={issue.key} style={{ borderBottom: '1px solid var(--bg-card)' }}>
                                  <td style={{ padding: '10px 14px' }}>
                                    <span
                                      className="chat-issue-badge"
                                      onClick={() => onOpenIssueDetails && onOpenIssueDetails(issue.key)}
                                      style={{ margin: 0 }}
                                    >
                                      {issue.key}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 14px', color: '#fff', fontWeight: '500' }}>{issue.fields?.summary}</td>
                                  <td style={{ padding: '10px 14px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px', background: statusBg, color: statusFg }}>
                                      {s}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 14px', color: 'var(--text-primary)' }}>{issue.fields?.assignee?.displayName || 'Unassigned'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 📊 TAB: PERFORMANCE METRICS */}
              {activeTab === 'metrics' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                  <h4 style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold', borderBottom: '1px solid var(--border)', paddingBottom: '8px', marginBottom: '20px' }}>
                    📊 Workgroup Velocity & Task Statistics
                  </h4>

                  {(() => {
                    const metrics = getTeamMetrics(selectedTeam.members || []);
                    return (
                      <div style={{ maxWidth: '600px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '24px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                          <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600' }}>Overall Workload</span>
                          <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>{metrics.total} Active Jira Issues</span>
                        </div>

                        {metrics.total > 0 ? (
                          <div style={{ height: '12px', borderRadius: '6px', background: 'var(--border)', display: 'flex', overflow: 'hidden', marginBottom: '24px' }}>
                            <div style={{ width: `${metrics.donePct}%`, background: '#2ea44f' }} title={`Done: ${metrics.donePct}%`} />
                            <div style={{ width: `${metrics.progressPct}%`, background: '#0969da' }} title={`In Progress: ${metrics.progressPct}%`} />
                            <div style={{ width: `${metrics.openPct}%`, background: 'var(--text-secondary)' }} title={`To Do: ${metrics.openPct}%`} />
                          </div>
                        ) : (
                          <div style={{ height: '12px', borderRadius: '6px', background: 'var(--bg-card)', display: 'flex', overflow: 'hidden', marginBottom: '24px', opacity: 0.3 }} />
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-primary)', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-secondary)' }} />
                              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>To Do (Pending)</span>
                            </div>
                            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>{metrics.open} ({metrics.openPct}%)</span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-primary)', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0969da' }} />
                              <span style={{ color: '#0969da', fontSize: '13px' }}>In Progress (Active)</span>
                            </div>
                            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>{metrics.inProgress} ({metrics.progressPct}%)</span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-primary)', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ea44f' }} />
                              <span style={{ color: '#2ea44f', fontSize: '13px' }}>Done (Resolved)</span>
                            </div>
                            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '14px' }}>{metrics.done} ({metrics.donePct}%)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

            </div>

          </div>
        )}

      </div>

    </div>
  );
}
