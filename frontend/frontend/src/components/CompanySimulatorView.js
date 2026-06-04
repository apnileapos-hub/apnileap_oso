import React, { useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 
  (window.location.port === '3000' ? 'http://localhost:5000' : '');

export default function CompanySimulatorView({ onRefresh }) {
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [funding, setFunding] = useState('20000');
  const [duration, setDuration] = useState('6 Months');
  const [epics, setEpics] = useState([
    { title: 'Requirements & Architecture Specification', description: 'Define scoping, technical requirements, and core interface models.' },
    { title: 'Core Feature Prototype Development', description: 'Implement basic functional behaviors and baseline validations.' },
    { title: 'Deployment & Quality Engineering Sync', description: 'Conduct end-to-end integration and scale testing.' }
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleEpicChange = (idx, field, val) => {
    const updated = [...epics];
    updated[idx] = { ...updated[idx], [field]: val };
    setEpics(updated);
  };

  const handleAddEpic = () => {
    setEpics([...epics, { title: 'New Epic', description: '' }]);
  };

  const handleRemoveEpic = (idx) => {
    setEpics(epics.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!company.trim() || !title.trim()) {
      alert('Company Name and Project Title are required.');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/projects`, {
        company,
        title,
        description,
        funding,
        duration,
        epics
      });
      setSuccess(true);
      setCompany('');
      setTitle('');
      setDescription('');
      setFunding('20000');
      setDuration('6 Months');
      setEpics([
        { title: 'Requirements & Architecture Specification', description: 'Define scoping, technical requirements, and core interface models.' },
        { title: 'Core Feature Prototype Development', description: 'Implement basic functional behaviors and baseline validations.' },
        { title: 'Deployment & Quality Engineering Sync', description: 'Conduct end-to-end integration and scale testing.' }
      ]);
      if (onRefresh) onRefresh();
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      console.error('Error submitting proposal:', err);
      alert('Failed to submit project proposal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="company-simulator-view" style={{ color: '#c9d1d9', maxWidth: '750px', margin: '0 auto' }}>
      {/* Title Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#f0f6fc', margin: '0 0 6px 0' }}>🚀 B2B Ingestion Portal (Proposal Simulator)</h1>
        <p style={{ fontSize: '13px', color: '#8b949e', margin: 0 }}>
          Simulate an external company partner submitting a project proposal. Once submitted, it will appear as an **Incoming Project** on the Apni Leap Moderator Portal.
        </p>
      </div>

      {success && (
        <div style={{ padding: '16px', background: 'rgba(56,139,253,0.15)', border: '1px solid rgba(56,139,253,0.3)', borderRadius: '8px', color: '#58a6ff', marginBottom: '20px', fontSize: '14px' }}>
          <strong>🎉 Proposal Ingested Successfully!</strong> The project has been created and logged in the Moderator Portal queue as <em>Pending Review</em>.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '24px' }}>
        
        {/* Form Grid Row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div className="modal-form-group">
            <label className="modal-label" style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '6px' }}>Company / Partner Name</label>
            <input
              type="text"
              className="modal-input"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Tesla Inc, Netflix, Microsoft"
              style={{ width: '100%', padding: '8px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#c9d1d9' }}
              disabled={submitting}
              required
            />
          </div>
          <div className="modal-form-group">
            <label className="modal-label" style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '6px' }}>Project Title</label>
            <input
              type="text"
              className="modal-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Autonomous Drone Telemetry API"
              style={{ width: '100%', padding: '8px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#c9d1d9' }}
              disabled={submitting}
              required
            />
          </div>
        </div>

        {/* Form Row 2 */}
        <div className="modal-form-group" style={{ marginBottom: '16px' }}>
          <label className="modal-label" style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '6px' }}>Project Scope Description</label>
          <textarea
            className="modal-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed description of the deliverables and technical challenges..."
            style={{ width: '100%', padding: '8px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#c9d1d9', height: '80px', resize: 'vertical' }}
            disabled={submitting}
          />
        </div>

        {/* Form Grid Row 3 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div className="modal-form-group">
            <label className="modal-label" style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '6px' }}>Funding Value (USD)</label>
            <input
              type="number"
              className="modal-input"
              value={funding}
              onChange={(e) => setFunding(e.target.value)}
              placeholder="e.g. 25000"
              style={{ width: '100%', padding: '8px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#c9d1d9' }}
              disabled={submitting}
              required
            />
          </div>
          <div className="modal-form-group">
            <label className="modal-label" style={{ display: 'block', fontSize: '12px', color: '#8b949e', marginBottom: '6px' }}>Project Duration</label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="modal-input"
              style={{ width: '100%', padding: '8px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#c9d1d9' }}
              disabled={submitting}
            >
              <option value="3 Months">3 Months</option>
              <option value="4 Months">4 Months</option>
              <option value="6 Months">6 Months</option>
              <option value="9 Months">9 Months</option>
              <option value="12 Months">12 Months</option>
            </select>
          </div>
        </div>

        {/* Epics Checklist */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <label className="modal-label" style={{ fontSize: '13px', fontWeight: '600', color: '#f0f6fc' }}>📋 Suggested Epics (Intake Specification)</label>
            <button 
              type="button" 
              onClick={handleAddEpic}
              style={{ background: 'none', border: 'none', color: '#58a6ff', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              ➕ Add Epic
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {epics.map((epic, idx) => (
              <div key={idx} style={{ background: '#0d1117', border: '1px solid #30363d', padding: '12px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#58a6ff', fontWeight: 'bold' }}>Epic #{idx + 1}</span>
                  {epics.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => handleRemoveEpic(idx)}
                      style={{ background: 'none', border: 'none', color: '#ff7b72', cursor: 'pointer', fontSize: '11px' }}
                    >
                      Delete
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Epic Title"
                  value={epic.title}
                  onChange={(e) => handleEpicChange(idx, 'title', e.target.value)}
                  style={{ width: '100%', padding: '6px', background: '#161b22', border: '1px solid #30363d', borderRadius: '4px', color: '#c9d1d9', fontSize: '12px', marginBottom: '6px' }}
                  required
                />
                <textarea
                  placeholder="Epic Description (Deliverables)"
                  value={epic.description}
                  onChange={(e) => handleEpicChange(idx, 'description', e.target.value)}
                  style={{ width: '100%', padding: '6px', background: '#161b22', border: '1px solid #30363d', borderRadius: '4px', color: '#c9d1d9', fontSize: '11px', height: '40px', resize: 'vertical' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          className="modal-btn-submit"
          style={{ width: '100%', padding: '10px', background: '#3fb950', border: 'none', color: '#ffffff', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
          disabled={submitting}
        >
          {submitting ? 'Ingesting Project...' : 'Submit Project Proposal'}
        </button>
      </form>
    </div>
  );
}
