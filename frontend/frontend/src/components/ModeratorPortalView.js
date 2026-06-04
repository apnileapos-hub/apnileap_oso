import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 
  (window.location.port === '3000' ? 'http://localhost:5000' : '');

export default function ModeratorPortalView({ user, initialTab }) {
  const [projects, setProjects] = useState([]);
  const [spokes, setSpokes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigningProject, setAssigningProject] = useState(null);
  const [selectedSpoke, setSelectedSpoke] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // User Management State
  const [activeTab, setActiveTab] = useState(initialTab || 'projects'); // 'projects' | 'users'
  const [usersList, setUsersList] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('Super-admin');
  const [newUserPass, setNewUserPass] = useState('Admin@123');
  const [newUserCollege, setNewUserCollege] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Edit User State
  const [editingUser, setEditingUser] = useState(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserRole, setEditUserRole] = useState('Super-admin');
  const [editUserPass, setEditUserPass] = useState('');
  const [editUserCollege, setEditUserCollege] = useState('');

  const handleUserEditClick = (u) => {
    setEditingUser(u);
    setEditUserName(u.name);
    setEditUserEmail(u.email);
    setEditUserRole(u.role);
    setEditUserCollege(u.college_id || '');
    setEditUserPass('');
  };

  const handleEditUserSubmit = async (e) => {
    e.preventDefault();
    if (!editUserEmail || !editUserName || !editUserRole) return;
    setSubmitting(true);
    try {
      const token = user?.token;
      const payload = {
        email: editUserEmail,
        name: editUserName,
        role: editUserRole,
        collegeId: editUserCollege || null
      };
      if (editUserPass) {
        payload.password = editUserPass;
      }
      await axios.put(`${API}/api/v1/users/${editingUser.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update user.');
    } finally {
      setSubmitting(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const token = user?.token;
      const res = await axios.get(`${API}/api/v1/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsersList(res.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUserEmail || !newUserName || !newUserRole) return;
    try {
      const token = user?.token;
      await axios.post(`${API}/api/v1/users`, {
        email: newUserEmail,
        name: newUserName,
        role: newUserRole,
        password: newUserPass,
        collegeId: newUserCollege || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewUserEmail('');
      setNewUserName('');
      setNewUserRole('Super-admin');
      setNewUserPass('Admin@123');
      setNewUserCollege('');
      setShowAddUserModal(false);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add user.');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      const token = user?.token;
      await axios.delete(`${API}/api/v1/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user.');
    }
  };

  const handleDeleteProject = async (id) => {
    if (!window.confirm("Are you sure you want to delete this project? This will permanently delete the project and all its assignments, teams, repositories, and logs.")) return;
    try {
      const token = user?.token;
      await axios.delete(`${API}/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete project.');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = user?.token;
      const [projRes, spokeRes] = await Promise.all([
        axios.get(`${API}/projects`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/spokes`)
      ]);
      setProjects(projRes.data || []);
      setSpokes(spokeRes.data || []);
      setError('');
    } catch (err) {
      console.error('Error fetching moderator portal data:', err);
      setError('Failed to load data. Please make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleAssignClick = (project) => {
    setAssigningProject(project);
    setSelectedSpoke(spokes[0]?.id || '');
  };

  const handleConfirmAssignment = async () => {
    if (!selectedSpoke) return;
    setSubmitting(true);
    try {
      const token = user?.token;
      await axios.post(`${API}/projects/${assigningProject.id}/assign-spoke`, {
        spokeId: selectedSpoke
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAssigningProject(null);
      fetchData();
    } catch (err) {
      console.error('Error allocating project:', err);
      alert(err.response?.data?.error || 'Failed to allocate project.');
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics calculation
  const totalB2B = projects.length;
  const activeAllocations = projects.filter(p => p.spokeId !== null).length;
  const pendingReview = projects.filter(p => p.status === 'pending_review').length;
  const avgValue = totalB2B > 0 
    ? Math.round(projects.reduce((acc, p) => acc + (p.funding || 0), 0) / totalB2B)
    : 0;

  const formatCurrency = (val) => {
    return '$' + val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const getSpokeName = (spokeId) => {
    if (!spokeId) return '';
    const s = spokes.find(x => x.id === spokeId);
    return s ? s.name : String(spokeId);
  };

  return (
    <div className="moderator-portal-view" style={{ color: 'var(--text-primary)' }}>
      {/* Title Header */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 6px 0' }}>B2B Moderator Project Assignment</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Intake projects from industry partners and automatically provision them directly to campus spaces.</p>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button 
            onClick={() => setActiveTab('projects')}
            style={{ 
              padding: '6px 16px', 
              fontSize: '13px', 
              fontWeight: '600', 
              background: activeTab === 'projects' ? 'var(--bg-card)' : 'transparent', 
              color: activeTab === 'projects' ? '#fff' : 'var(--text-secondary)', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer' 
            }}
          >
            📋 Projects Board
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            style={{ 
              padding: '6px 16px', 
              fontSize: '13px', 
              fontWeight: '600', 
              background: activeTab === 'users' ? 'var(--bg-card)' : 'transparent', 
              color: activeTab === 'users' ? '#fff' : 'var(--text-secondary)', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: 'pointer' 
            }}
          >
            👥 User Management
          </button>
        </div>
      </div>


      {/* KPI Cards Row */}
      <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* KPI 1 */}
        <div className="metric-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500', marginBottom: '8px' }}>Total B2B Proposals</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{loading ? '...' : totalB2B}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>Direct company submissions</div>
        </div>
        {/* KPI 2 */}
        <div className="metric-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500', marginBottom: '8px' }}>Active Allocations</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{loading ? '...' : activeAllocations}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>Provisioned to campus workspaces</div>
        </div>
        {/* KPI 3 */}
        <div className="metric-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500', marginBottom: '8px' }}>Pending Moderator Review</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ff7b72' }}>{loading ? '...' : pendingReview}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>Awaiting campus assignment</div>
        </div>
        {/* KPI 4 */}
        <div className="metric-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500', marginBottom: '8px' }}>Avg Project Value</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3fb950' }}>{loading ? '...' : formatCurrency(avgValue)}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>PIP external funding</div>
        </div>
      </div>

      {activeTab === 'projects' ? (
        <>
          {/* Project Intake Board Table Panel */}
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>⚙️ B2B Project Intake Board</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Review budget scope, and instantly automate provisioning to campus Jira spaces.</p>
              </div>
              <button 
                onClick={fetchData} 
                className="chat-btn" 
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px' }}
              >
                🔄 Refresh Intake
              </button>
            </div>

            {error && <div style={{ color: '#ff7b72', padding: '10px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.2)', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div className="loading-spinner" style={{ margin: '0 auto 10px auto' }} />
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading proposals...</div>
              </div>
            ) : projects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', border: '1px dashed var(--border)', borderRadius: '6px' }}>
                No proposals found. Use the Ingestion Simulator to submit a project.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500', width: '40px' }}><input type="checkbox" disabled /></th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500' }}>Company / Partner</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500' }}>Project Details</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500' }}>Funding</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500' }}>Duration</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500' }}>Status</th>
                      <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map(proj => {
                      const isAllocated = proj.spokeId !== null;
                      return (
                        <tr key={proj.id} style={{ borderBottom: '1px solid var(--bg-card)', transition: 'background 0.2s' }} className="table-row-hover">
                          <td style={{ padding: '16px 8px', verticalAlign: 'top' }}>
                            <input type="checkbox" checked={isAllocated} readOnly />
                          </td>
                          <td style={{ padding: '16px 8px', fontWeight: 'bold', color: 'var(--text-primary)', verticalAlign: 'top', minWidth: '100px' }}>
                            {proj.company}
                          </td>
                          <td style={{ padding: '16px 8px', verticalAlign: 'top' }}>
                            <div style={{ color: '#58a6ff', fontWeight: '600', marginBottom: '4px', cursor: 'pointer' }}>{proj.title}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: '1.4', maxWidth: '400px' }}>{proj.description}</div>
                          </td>
                          <td style={{ padding: '16px 8px', color: '#3fb950', fontWeight: '600', verticalAlign: 'top' }}>
                            {formatCurrency(proj.funding)}
                          </td>
                          <td style={{ padding: '16px 8px', color: 'var(--text-primary)', verticalAlign: 'top' }}>
                            {proj.duration}
                          </td>
                          <td style={{ padding: '16px 8px', verticalAlign: 'top' }}>
                            {proj.status === 'pending_review' ? (
                              <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: '9px', fontWeight: 'bold', color: '#ff9800', background: 'rgba(255,152,0,0.1)', border: '1px solid rgba(255,152,0,0.2)', borderRadius: '12px' }}>
                                ⏳ PENDING REVIEW
                              </span>
                            ) : (
                              <span style={{ display: 'inline-block', padding: '2px 8px', fontSize: '9px', fontWeight: 'bold', color: '#52c41a', background: 'rgba(82,196,26,0.1)', border: '1px solid rgba(82,196,26,0.2)', borderRadius: '12px' }}>
                                ✅ ALLOCATED
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '16px 8px', verticalAlign: 'top', textAlign: 'center' }}>
                            {proj.status === 'pending_review' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                <button 
                                  onClick={() => handleAssignClick(proj)}
                                  style={{ background: '#f96816', border: 'none', color: '#ffffff', padding: '6px 12px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer', transition: 'opacity 0.2s' }}
                                  onMouseOver={(e) => e.target.style.opacity = '0.9'}
                                  onMouseOut={(e) => e.target.style.opacity = '1'}
                                >
                                  Assign Project
                                </button>
                                {user?.role === 'Super-admin' && (
                                  <button
                                    onClick={() => handleDeleteProject(proj.id)}
                                    style={{ background: 'none', border: 'none', color: '#ff7b72', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline', padding: 0 }}
                                  >
                                    🗑️ Delete Project
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>{(getSpokeName(proj.spokeId) || '').toUpperCase()}</div>
                                {proj.epics && proj.epics.some(e => e.jiraKey) ? (
                                  <div style={{ fontSize: '10px', color: '#58a6ff', marginTop: '2px' }}>
                                    {proj.epics.filter(e => e.jiraKey).map(e => e.jiraKey).slice(0, 2).join(', ')}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Awaiting Intake</div>
                                )}
                                <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                                  <button
                                    onClick={() => handleAssignClick(proj)}
                                    style={{ background: 'none', border: 'none', color: '#58a6ff', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline', padding: 0 }}
                                  >
                                    🔄 Re-assign
                                  </button>
                                  {user?.role === 'Super-admin' && (
                                    <button
                                      onClick={() => handleDeleteProject(proj.id)}
                                      style={{ background: 'none', border: 'none', color: '#ff7b72', cursor: 'pointer', fontSize: '11px', textDecoration: 'underline', padding: 0 }}
                                    >
                                      🗑️ Delete Project
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Allocation Modal */}
          {assigningProject && (
            <div className="chat-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setAssigningProject(null)}>
              <div className="chat-modal-content" style={{ width: '450px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} onClick={e => e.stopPropagation()}>
                <div className="chat-header" style={{ borderBottom: '1px solid var(--border)', padding: '14px 20px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>Assign B2B Project</h3>
                  <button className="close-chat-btn" onClick={() => setAssigningProject(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
                </div>
                <div style={{ padding: '20px' }}>
                  <p style={{ fontSize: '13px', margin: '0 0 16px 0', color: 'var(--text-secondary)' }}>
                    Allocate <strong style={{ color: 'var(--text-primary)' }}>"{assigningProject.title}"</strong> to a campus spoke. This will notify the respective Spoke SPOC automatically.
                  </p>
                  
                  <div className="modal-form-group">
                    <label className="modal-label" style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Select Target Spoke</label>
                    <select 
                      value={selectedSpoke} 
                      onChange={(e) => setSelectedSpoke(e.target.value)}
                      className="modal-input"
                      style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }}
                    >
                      {spokes.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.spocName})</option>
                      ))}
                    </select>
                  </div>

                  {assigningProject.epics && (
                    <div style={{ marginTop: '16px' }}>
                      <label className="modal-label" style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Proposed Project Epics ({assigningProject.epics.length})</label>
                      <div style={{ maxHeight: '120px', overflowY: 'auto', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px' }}>
                        {assigningProject.epics.map((e, idx) => (
                          <div key={idx} style={{ fontSize: '11px', color: 'var(--text-primary)', padding: '4px 0', borderBottom: idx < assigningProject.epics.length - 1 ? '1px solid var(--bg-card)' : 'none' }}>
                            📋 <strong>{e.title}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '14px 20px', background: 'var(--bg-primary)', borderTop: '1px solid var(--border)', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
                  <button 
                    onClick={() => setAssigningProject(null)} 
                    className="cancel-btn"
                    style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleConfirmAssignment} 
                    className="modal-btn-submit"
                    disabled={submitting || !selectedSpoke}
                    style={{ background: '#f96816', color: '#ffffff', border: 'none', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                  >
                    {submitting ? 'Allocating...' : 'Confirm Allocation'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* User Management Tab */
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>👥 Platform User Directory</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>Add new users (e.g. Gmail addresses), assign administrative or coordinator roles, and manage system access.</p>
            </div>
            <button 
              onClick={() => setShowAddUserModal(true)} 
              className="chat-btn" 
              style={{ background: '#238636', border: 'none', color: '#fff', cursor: 'pointer', padding: '8px 16px', borderRadius: '6px', fontWeight: '600', fontSize: '13px' }}
            >
              ➕ Add New User
            </button>
          </div>

          {loadingUsers ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 10px auto' }} />
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading platform users...</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500' }}>Name</th>
                    <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500' }}>Email Address</th>
                    <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500' }}>Role</th>
                    <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500' }}>Campus Scope</th>
                    <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: '500', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {usersList.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--bg-card)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: '600', color: 'var(--text-primary)' }}>{u.name}</td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-primary)' }}>{u.email}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span style={{ 
                          padding: '2px 8px', 
                          fontSize: '11px', 
                          fontWeight: 'bold', 
                          color: u.role === 'Super-admin' ? '#7f85f5' : '#58a6ff', 
                          background: u.role === 'Super-admin' ? 'rgba(127,133,245,0.1)' : 'rgba(88,166,255,0.1)', 
                          borderRadius: '12px',
                          border: `1px solid ${u.role === 'Super-admin' ? 'rgba(127,133,245,0.2)' : 'rgba(88,166,255,0.2)'}`
                        }}>
                          {u.role.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                        {u.college_id ? (getSpokeName(u.college_id) || '').toUpperCase() : 'GLOBAL'}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <button 
                          onClick={() => handleUserEditClick(u)}
                          style={{ background: 'none', border: 'none', color: '#58a6ff', cursor: 'pointer', fontSize: '14px', marginRight: '10px' }}
                          title="Edit User"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          style={{ background: 'none', border: 'none', color: '#ff7b72', cursor: 'pointer', fontSize: '14px' }}
                          title="Delete User"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Add User Modal */}
          {showAddUserModal && (
            <div className="chat-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowAddUserModal(false)}>
              <div className="chat-modal-content" style={{ width: '400px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} onClick={e => e.stopPropagation()}>
                <div className="chat-header" style={{ borderBottom: '1px solid var(--border)', padding: '14px 20px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>➕ Add New Platform User</h3>
                  <button className="close-chat-btn" onClick={() => setShowAddUserModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
                </div>
                <form onSubmit={handleAddUser}>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Full Name</label>
                      <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} required placeholder="e.g. John Doe"
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Email Address</label>
                      <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required placeholder="e.g. john@gmail.com"
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Password</label>
                      <input type="password" value={newUserPass} onChange={e => setNewUserPass(e.target.value)} required placeholder="e.g. Password123"
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>System Role</label>
                      <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)}
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }}>
                        <option value="Super-admin">Super Admin</option>
                        <option value="Admin">Admin</option>
                        <option value="College-SPOC">College SPOC</option>
                        <option value="Faculty">Faculty SPOC</option>
                        <option value="Principal-Investigator">Principal Investigator</option>
                        <option value="Corporate-Mentor">Corporate Mentor</option>
                        <option value="Sponsor">Sponsor</option>
                        <option value="Project Manager">Project Manager</option>
                        <option value="Team-Lead">Team Lead</option>
                        <option value="Student Developer">Student Developer</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Campus Scope (For SPOCs)</label>
                      <select value={newUserCollege} onChange={e => setNewUserCollege(e.target.value)}
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }}>
                        <option value="">GLOBAL (No Spoke restriction)</option>
                        <option value="kle-spoke">KLE Spoke</option>
                        <option value="coep-spoke">COEP Spoke</option>
                        <option value="mmcoep-spoke">MMCOEP Spoke</option>
                        <option value="rit-spoke">RIT Spoke</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '14px 20px', background: 'var(--bg-primary)', borderTop: '1px solid var(--border)', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
                    <button type="button" onClick={() => setShowAddUserModal(false)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      Cancel
                    </button>
                    <button type="submit" style={{ background: '#238636', color: '#ffffff', border: 'none', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                      Add User
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit User Modal */}
          {editingUser && (
            <div className="chat-modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setEditingUser(null)}>
              <div className="chat-modal-content" style={{ width: '400px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px' }} onClick={e => e.stopPropagation()}>
                <div className="chat-header" style={{ borderBottom: '1px solid var(--border)', padding: '14px 20px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--text-primary)' }}>✏️ Edit Platform User</h3>
                  <button className="close-chat-btn" onClick={() => setEditingUser(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer' }}>&times;</button>
                </div>
                <form onSubmit={handleEditUserSubmit}>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Full Name</label>
                      <input type="text" value={editUserName} onChange={e => setEditUserName(e.target.value)} required placeholder="e.g. John Doe"
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Email Address</label>
                      <input type="email" value={editUserEmail} onChange={e => setEditUserEmail(e.target.value)} required placeholder="e.g. john@gmail.com"
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>New Password (Leave blank to keep current)</label>
                      <input type="password" value={editUserPass} onChange={e => setEditUserPass(e.target.value)} placeholder="e.g. Password123"
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>System Role</label>
                      <select value={editUserRole} onChange={e => setEditUserRole(e.target.value)}
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }}>
                        <option value="Super-admin">Super Admin</option>
                        <option value="Admin">Admin</option>
                        <option value="College-SPOC">College SPOC</option>
                        <option value="Faculty">Faculty SPOC</option>
                        <option value="Principal-Investigator">Principal Investigator</option>
                        <option value="Corporate-Mentor">Corporate Mentor</option>
                        <option value="Sponsor">Sponsor</option>
                        <option value="Project Manager">Project Manager</option>
                        <option value="Team-Lead">Team Lead</option>
                        <option value="Student Developer">Student Developer</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Campus Scope</label>
                      <select value={editUserCollege} onChange={e => setEditUserCollege(e.target.value)}
                        style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }}>
                        <option value="">GLOBAL (No Spoke restriction)</option>
                        <option value="kle-spoke">KLE Spoke</option>
                        <option value="coep-spoke">COEP Spoke</option>
                        <option value="mmcoep-spoke">MMCOEP Spoke</option>
                        <option value="rit-spoke">RIT Spoke</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '14px 20px', background: 'var(--bg-primary)', borderTop: '1px solid var(--border)', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
                    <button type="button" onClick={() => setEditingUser(null)} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      Cancel
                    </button>
                    <button type="submit" style={{ background: '#238636', color: '#ffffff', border: 'none', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
