import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 
  (window.location.port === '3000' ? 'http://localhost:5000' : '');

export default function ExecutiveHubView({ user }) {
  const [projects, setProjects] = useState([]);
  const [spokes, setSpokes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    } catch (err) {
      console.error('Error fetching Executive HUB data:', err);
      setError('Failed to load portfolio details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleAllocateSpoke = async (projectId, spokeId) => {
    if (!spokeId) return;
    try {
      const token = user?.token;
      await axios.post(`${API}/projects/${projectId}/assign-spoke`, {
        spokeId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      console.error('Error allocating project from Executive Hub:', err);
      alert(err.response?.data?.error || 'Failed to allocate project.');
    }
  };

  // Calculations
  const totalFunding = projects.reduce((acc, p) => acc + (p.funding || 0), 0);
  const activeSpokesCount = spokes.filter(s => projects.some(p => p.spokeId === s.id)).length;
  
  let totalEpicsCount = 0;
  let completedEpicsCount = 0;
  projects.forEach(p => {
    if (p.epics) {
      totalEpicsCount += p.epics.length;
      completedEpicsCount += p.epics.filter(e => e.status === 'Done').length;
    }
  });

  const completionRate = totalEpicsCount > 0 
    ? Math.round((completedEpicsCount / totalEpicsCount) * 100) 
    : 0;

  // Group funding by Spoke
  const spokeFunding = spokes.map(s => {
    const spokeProjects = projects.filter(p => p.spokeId === s.id);
    const funding = spokeProjects.reduce((acc, p) => acc + (p.funding || 0), 0);
    return {
      id: s.id,
      name: s.name,
      funding,
      projectCount: spokeProjects.length
    };
  }).sort((a, b) => b.funding - a.funding);

  return (
    <div className="executive-hub-view" style={{ color: '#c9d1d9' }}>
      {/* Title Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#f0f6fc', margin: '0 0 6px 0' }}>🌐 Executive HUB</h1>
        <p style={{ fontSize: '13px', color: '#8b949e', margin: 0 }}>High-level overview of portfolio-wide allocations, campus spoke health, and external B2B funding metrics.</p>
      </div>

      {error && <div style={{ color: '#ff7b72', padding: '10px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.2)', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 10px auto' }} />
          <div style={{ fontSize: '13px', color: '#8b949e' }}>Loading portfolio overview...</div>
        </div>
      ) : (
        <div>
          {/* Portfolio KPI Row */}
          <div className="metrics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="metric-card" style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#8b949e', fontWeight: '500', marginBottom: '8px' }}>Total Portfolio Funding</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3fb950' }}>${totalFunding.toLocaleString()}</div>
              <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '6px' }}>Total B2B client investments</div>
            </div>
            <div className="metric-card" style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#8b949e', fontWeight: '500', marginBottom: '8px' }}>Active Spokes</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f0f6fc' }}>{activeSpokesCount} / {spokes.length}</div>
              <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '6px' }}>Campus hubs with active projects</div>
            </div>
            <div className="metric-card" style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '16px' }}>
              <div style={{ fontSize: '12px', color: '#8b949e', fontWeight: '500', marginBottom: '8px' }}>Epic Completion Rate</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#58a6ff' }}>{completionRate}%</div>
              <div style={{ fontSize: '11px', color: '#8b949e', marginTop: '6px' }}>{completedEpicsCount} of {totalEpicsCount} Epics completed</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px', flexWrap: 'wrap' }}>
            {/* Funding Allocation By Spoke */}
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#f0f6fc', margin: '0 0 16px 0' }}>💰 Funding Allocation by Spoke</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {spokeFunding.map(sf => {
                  const pct = totalFunding > 0 ? Math.round((sf.funding / totalFunding) * 100) : 0;
                  return (
                    <div key={sf.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#c9d1d9', marginBottom: '4px' }}>
                        <span><strong>{sf.name}</strong> ({sf.projectCount} Projects)</span>
                        <span style={{ fontWeight: 'bold' }}>${sf.funding.toLocaleString()} ({pct}%)</span>
                      </div>
                      <div style={{ background: '#0d1117', height: '8px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #21262d' }}>
                        <div style={{ background: '#3fb950', width: `${pct}%`, height: '100%', borderRadius: '4px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Portfolio Status Mix */}
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#f0f6fc', margin: '0 0 16px 0' }}>📊 Project Status Distribution</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { label: 'Pending Review', count: projects.filter(p => p.status === 'pending_review').length, color: '#ff9800' },
                  { label: 'Allocated to Spoke', count: projects.filter(p => p.status === 'allocated' && !p.teamId).length, color: '#58a6ff' },
                  { label: 'Assigned to Dev Team', count: projects.filter(p => p.status === 'allocated' && p.teamId).length, color: '#3fb950' }
                ].map(s => {
                  const pct = projects.length > 0 ? Math.round((s.count / projects.length) * 100) : 0;
                  return (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: s.color }} />
                      <span style={{ fontSize: '13px', color: '#c9d1d9', flex: 1 }}>{s.label}</span>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#f0f6fc', width: '30px', textAlign: 'right' }}>{s.count}</span>
                      <span style={{ fontSize: '11px', color: '#8b949e', width: '40px', textAlign: 'right' }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Active Projects Directory */}
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#f0f6fc', margin: '0 0 16px 0' }}>📋 Active Projects Directory</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #30363d', textAlign: 'left' }}>
                  <th style={{ padding: '8px', color: '#8b949e', fontWeight: '500' }}>Project</th>
                  <th style={{ padding: '8px', color: '#8b949e', fontWeight: '500' }}>Partner</th>
                  <th style={{ padding: '8px', color: '#8b949e', fontWeight: '500' }}>Allocated Spoke</th>
                  <th style={{ padding: '8px', color: '#8b949e', fontWeight: '500' }}>Jira Sync Status</th>
                  <th style={{ padding: '8px', color: '#8b949e', fontWeight: '500' }}>Progress</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(p => {
                  const sName = spokes.find(s => s.id === p.spokeId)?.name || 'Unallocated';
                  const total = p.epics?.length || 0;
                  const done = p.epics?.filter(e => e.status === 'Done').length || 0;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #21262d' }}>
                      <td style={{ padding: '12px 8px', fontWeight: '600', color: '#f0f6fc' }}>{p.title}</td>
                      <td style={{ padding: '12px 8px', color: '#8b949e' }}>{p.company}</td>
                      <td style={{ padding: '12px 8px' }}>
                        {p.spokeId ? (
                          <span style={{ fontSize: '11px', color: '#f0f6fc', fontWeight: '600' }}>
                            {sName}
                          </span>
                        ) : (
                          user?.role === 'Super-admin' || user?.role === 'Admin' ? (
                            <select
                              onChange={(e) => handleAllocateSpoke(p.id, e.target.value)}
                              style={{ padding: '4px 8px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '4px', color: '#ff7b72', fontSize: '11px', cursor: 'pointer' }}
                              defaultValue=""
                            >
                              <option value="" disabled>Allocate Spoke...</option>
                              {spokes.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#ff7b72' }}>
                              Unallocated
                            </span>
                          )
                        )}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        {p.epics && p.epics.some(e => e.jiraKey) ? (
                          <span style={{ color: '#58a6ff', fontSize: '11px', fontWeight: '600' }}>
                            ✅ Synced ({p.epics.filter(e => e.jiraKey).length} Epics)
                          </span>
                        ) : (
                          <span style={{ color: '#8b949e', fontSize: '11px', fontStyle: 'italic' }}>
                            ⏳ Pending
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '80px', background: '#0d1117', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ background: '#58a6ff', width: `${pct}%`, height: '100%' }} />
                          </div>
                          <span style={{ fontSize: '11px', color: '#8b949e' }}>{pct}% ({done}/{total})</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
