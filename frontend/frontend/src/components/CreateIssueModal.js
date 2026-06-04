import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 
  (window.location.port === '3000' ? 'http://localhost:5000' : '');

export default function CreateIssueModal({ isOpen, onClose, onRefresh }) {
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [reporterId, setReporterId] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [status, setStatus] = useState('To Do');
  const [dueDate, setDueDate] = useState('');
  
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch assignable users when modal is opened
  useEffect(() => {
    if (isOpen) {
      const fetchUsers = async () => {
        setLoadingUsers(true);
        setError('');
        try {
          const res = await axios.get(`${API}/users`);
          setUsers(Array.isArray(res.data) ? res.data : []);
          
          // Set default assignee and reporter if they exist
          if (res.data && res.data.length > 0) {
            // Default assignee: Bhagyashree if available, else first
            const bhagya = res.data.find(u => u.displayName.toLowerCase().includes('bhagyashree'));
            setAssigneeId(bhagya ? bhagya.accountId : res.data[0].accountId);
            
            // Default reporter: Manasa if available, else first
            const manasa = res.data.find(u => u.displayName.toLowerCase().includes('manasa'));
            setReporterId(manasa ? manasa.accountId : res.data[0].accountId);
          }
        } catch (err) {
          console.error("Failed to load users:", err);
          setError('Failed to fetch assignable users from Jira.');
        } finally {
          setLoadingUsers(false);
        }
      };
      
      fetchUsers();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!summary.trim()) {
      setError('Task summary/title is required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await axios.post(`${API}/issues`, {
        summary,
        description,
        assigneeId: assigneeId || null,
        reporterId: reporterId || null,
        priority,
        status,
        dueDate: dueDate || undefined
      });

      // Clear form
      setSummary('');
      setDescription('');
      setDueDate('');
      setPriority('Medium');
      setStatus('To Do');

      // Success callback to refresh lists & close modal
      onRefresh();
      onClose();
    } catch (err) {
      console.error("Error creating issue:", err);
      const msg = err.response?.data?.error || err.message;
      setError(typeof msg === 'string' ? msg : 'Failed to create issue. Please check the console.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Create New Sprint Issue</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="modal-error">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="7" fill="rgba(248,81,73,0.3)"/>
                  <path d="M7 4V7.5M7 9.5V10" stroke="#f85149" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            {/* Task Summary */}
            <div className="modal-form-group">
              <label className="modal-label" htmlFor="task-summary">Task Summary / Title *</label>
              <input
                id="task-summary"
                className="modal-input"
                type="text"
                placeholder="Enter issue summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
                disabled={submitting}
              />
            </div>

            {/* Description */}
            <div className="modal-form-group">
              <label className="modal-label" htmlFor="task-description">Description</label>
              <textarea
                id="task-description"
                className="modal-textarea"
                placeholder="Describe this issue..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
              />
            </div>

            {/* Assignee / Reporter / Priority dropdowns */}
            <div className="modal-grid-3">
              <div className="modal-form-group">
                <label className="modal-label" htmlFor="task-assignee">Assignee</label>
                <select
                  id="task-assignee"
                  className="modal-select"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={submitting || loadingUsers}
                >
                  <option value="">Unassigned</option>
                  {users.map(u => (
                    <option key={u.accountId} value={u.accountId}>{u.displayName}</option>
                  ))}
                </select>
              </div>

              <div className="modal-form-group">
                <label className="modal-label" htmlFor="task-reporter">Reporter</label>
                <select
                  id="task-reporter"
                  className="modal-select"
                  value={reporterId}
                  onChange={(e) => setReporterId(e.target.value)}
                  disabled={submitting || loadingUsers}
                >
                  <option value="">Unassigned</option>
                  {users.map(u => (
                    <option key={u.accountId} value={u.accountId}>{u.displayName}</option>
                  ))}
                </select>
              </div>

              <div className="modal-form-group">
                <label className="modal-label" htmlFor="task-priority">Priority</label>
                <select
                  id="task-priority"
                  className="modal-select"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  disabled={submitting}
                >
                  <option value="Highest">Highest</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                  <option value="Lowest">Lowest</option>
                </select>
              </div>
            </div>

            {/* Status / Due Date */}
            <div className="modal-grid-2">
              <div className="modal-form-group">
                <label className="modal-label" htmlFor="task-status">Column Status</label>
                <select
                  id="task-status"
                  className="modal-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={submitting}
                >
                  <option value="To Do">To Do</option>
                  <option value="In Progress">In Progress</option>
                  <option value="In Review">In Review</option>
                  <option value="Testing">Testing</option>
                  <option value="Done">Done</option>
                </select>
              </div>

              <div className="modal-form-group">
                <label className="modal-label" htmlFor="task-due-date">Due Date Deadline</label>
                <input
                  id="task-due-date"
                  className="modal-input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button
              type="button"
              className="modal-btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-btn-submit"
              disabled={submitting || !summary.trim()}
            >
              {submitting ? 'Creating...' : 'Create Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
