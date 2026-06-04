import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 
  (window.location.port === '3000' ? 'http://localhost:5000' : '');

export default function IssueDetailsModal({ issue, user, onClose, onRefresh }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [users, setUsers] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [updatingField, setUpdatingField] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const [error, setError] = useState('');

  const hasEditAccess = user?.role === 'Super-admin' || 
                        user?.role === 'Admin' || 
                        user?.role === 'Faculty' || 
                        user?.role === 'Principal-Investigator' || 
                        user?.role === 'College-SPOC';

  // Get current issue fields
  const key = issue?.key;
  const summary = issue?.fields?.summary || 'No Summary';
  const description = issue?.fields?.description || 'No description provided.';
  const currentStatus = issue?.fields?.status?.name || 'To Do';
  const currentAssigneeId = issue?.fields?.assignee?.accountId || '';
  const currentReporterId = issue?.fields?.reporter?.accountId || '';
  const currentPriority = issue?.fields?.priority?.name || 'Medium';

  // Fetch comments and users on mount
  useEffect(() => {
    if (key) {
      const loadComments = async () => {
        setLoadingComments(true);
        try {
          const res = await axios.get(`${API}/issues/${key}/comments`);
          setComments(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
          console.error("Failed to load comments:", err);
        } finally {
          setLoadingComments(false);
        }
      };

      const loadUsers = async () => {
        setLoadingUsers(true);
        try {
          const res = await axios.get(`${API}/users`, {
            headers: { Authorization: `Bearer ${user?.token}` }
          });
          setUsers(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
          console.error("Failed to load users:", err);
        } finally {
          setLoadingUsers(false);
        }
      };

      loadComments();
      loadUsers();
      setError('');
    }
  }, [key]);

  if (!issue) return null;

  // Formatter for description
  const renderDescription = (desc) => {
    if (typeof desc === 'string') return desc;
    if (desc && desc.type === 'doc') {
      // ADF format parser
      const paragraphs = desc.content?.filter(node => node.type === 'paragraph') || [];
      return paragraphs.map((p, idx) => {
        const texts = p.content?.filter(node => node.type === 'text') || [];
        return <p key={idx} style={{ marginBottom: 8 }}>{texts.map(t => t.text).join('')}</p>;
      });
    }
    return 'No description provided.';
  };

  // Inline updates handler
  const handleFieldChange = async (fieldName, val) => {
    if (!hasEditAccess) return;
    setUpdatingField(true);
    setError('');

    const payload = {};
    if (fieldName === 'assignee') payload.assigneeId = val || null;
    if (fieldName === 'reporter') payload.reporterId = val || null;
    if (fieldName === 'status') payload.status = val;
    if (fieldName === 'priority') payload.priority = val;

    try {
      await axios.put(`${API}/issues/${key}`, payload);
      onRefresh(); // Refresh issues list in background
      
      // Update local state if needed (or parent will refresh and propagate new props)
      // Since App.js has the full issues list, onRefresh will trigger fetch and update the selectedIssue.
    } catch (err) {
      console.error(`Failed to update ${fieldName}:`, err);
      setError(`Failed to update ${fieldName}.`);
    } finally {
      setUpdatingField(false);
    }
  };

  // Add comment handler
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!hasEditAccess || !newComment.trim()) return;

    setPostingComment(true);
    setError('');

    try {
      const res = await axios.post(`${API}/issues/${key}/comments`, {
        body: newComment
      });
      setComments(prev => [...prev, res.data]);
      setNewComment('');
      onRefresh(); // Refresh parent details
    } catch (err) {
      console.error("Failed to post comment:", err);
      setError("Failed to post comment.");
    } finally {
      setPostingComment(false);
    }
  };

  // Date formatter
  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // Parse comment body (ADF or plain string)
  const renderCommentBody = (body) => {
    if (typeof body === 'string') return body;
    if (body && body.type === 'doc') {
      const paragraphs = body.content?.filter(node => node.type === 'paragraph') || [];
      return paragraphs.map((p, idx) => {
        const texts = p.content?.filter(node => node.type === 'text') || [];
        return <p key={idx}>{texts.map(t => t.text).join('')}</p>;
      });
    }
    return '';
  };

  const getInitials = (name = '') => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card issue-details-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="modal-header">
          <div className="details-header-left">
            <span className="details-issue-key">{key}</span>
            <h2 className="modal-title details-issue-title">{summary}</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close details">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {!hasEditAccess && (
          <div className="details-privilege-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--warning)', marginRight: 6 }}>
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Read-only Mode. Faculty, Admin, or Super-admin privileges required to make changes or comment.</span>
          </div>
        )}

        <div className="details-modal-grid">
          {/* Main Content Area: Desc + Comments */}
          <div className="details-main-content">
            {error && (
              <div className="modal-error" style={{ marginBottom: 16 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="7" fill="rgba(248,81,73,0.3)"/>
                  <path d="M7 4V7.5M7 9.5V10" stroke="#f85149" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            {/* Description */}
            <div className="details-section">
              <h3 className="details-section-label">Description</h3>
              <div className="details-description-box">
                {renderDescription(description)}
              </div>
            </div>

            {/* Comments List */}
            <div className="details-section comments-section">
              <h3 className="details-section-label">Comments ({comments.length})</h3>
              
              <div className="comments-list">
                {loadingComments ? (
                  <div className="comments-loading">
                    <div className="loading-spinner" style={{ width: 20, height: 20 }} />
                    <span>Loading comments...</span>
                  </div>
                ) : comments.length === 0 ? (
                  <div className="no-comments">No comments on this issue yet.</div>
                ) : (
                  comments.map(c => {
                    const authorName = c.author?.displayName || 'Jira User';
                    const timestamp = formatDate(c.created);
                    return (
                      <div key={c.id} className="comment-item">
                        <div className="comment-header">
                          <div className="comment-author-avatar">
                            {getInitials(authorName)}
                          </div>
                          <div>
                            <span className="comment-author-name">{authorName}</span>
                            <span className="comment-timestamp">{timestamp}</span>
                          </div>
                        </div>
                        <div className="comment-body">
                          {renderCommentBody(c.body)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Comment Box */}
              <div className="comment-box-wrap" style={{ marginTop: 16 }}>
                {hasEditAccess ? (
                  <form onSubmit={handleAddComment} className="comment-form">
                    <textarea
                      className="modal-textarea comment-textarea"
                      placeholder="Add a comment to this issue..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      disabled={postingComment}
                      required
                    />
                    <div className="comment-form-actions">
                      <button
                        type="submit"
                        className="modal-btn-submit comment-submit-btn"
                        disabled={postingComment || !newComment.trim()}
                      >
                        {postingComment ? 'Posting...' : 'Post Comment'}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="comment-textarea disabled">
                    Sign in as Faculty, Admin, or Super-admin to write a comment.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Area: Metadata controls */}
          <div className="details-sidebar">
            <h3 className="details-section-label">Details</h3>

            <div className="details-fields-list">
              {/* Status */}
              <div className="details-field-row">
                <span className="field-lbl">Status</span>
                <div className="field-val">
                  {hasEditAccess ? (
                    <select
                      className="modal-select details-field-select"
                      value={currentStatus}
                      onChange={(e) => handleFieldChange('status', e.target.value)}
                      disabled={updatingField}
                    >
                      <option value="To Do">To Do</option>
                      <option value="In Progress">In Progress</option>
                      <option value="In Review">In Review</option>
                      <option value="Testing">Testing</option>
                      <option value="Done">Done</option>
                    </select>
                  ) : (
                    <span className="badge badge-todo" style={{ cursor: 'not-allowed' }}>
                      {currentStatus}
                    </span>
                  )}
                </div>
              </div>

              {/* Assignee */}
              <div className="details-field-row">
                <span className="field-lbl">Assignee</span>
                <div className="field-val">
                  {hasEditAccess ? (
                    <select
                      className="modal-select details-field-select"
                      value={currentAssigneeId}
                      onChange={(e) => handleFieldChange('assignee', e.target.value)}
                      disabled={updatingField || loadingUsers}
                    >
                      <option value="">Unassigned</option>
                      {users.map(u => (
                        <option key={u.accountId} value={u.accountId}>{u.displayName}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="static-field-val">
                      {issue?.fields?.assignee?.displayName || 'Unassigned'}
                    </span>
                  )}
                </div>
              </div>

              {/* Reporter */}
              <div className="details-field-row">
                <span className="field-lbl">Reporter</span>
                <div className="field-val">
                  {hasEditAccess ? (
                    <select
                      className="modal-select details-field-select"
                      value={currentReporterId}
                      onChange={(e) => handleFieldChange('reporter', e.target.value)}
                      disabled={updatingField || loadingUsers}
                    >
                      <option value="">Unassigned</option>
                      {users.map(u => (
                        <option key={u.accountId} value={u.accountId}>{u.displayName}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="static-field-val">
                      {issue?.fields?.reporter?.displayName || 'Unassigned'}
                    </span>
                  )}
                </div>
              </div>

              {/* Priority */}
              <div className="details-field-row">
                <span className="field-lbl">Priority</span>
                <div className="field-val">
                  {hasEditAccess ? (
                    <select
                      className="modal-select details-field-select"
                      value={currentPriority}
                      onChange={(e) => handleFieldChange('priority', e.target.value)}
                      disabled={updatingField}
                    >
                      <option value="Highest">Highest</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                      <option value="Lowest">Lowest</option>
                    </select>
                  ) : (
                    <span className="static-field-val">
                      {currentPriority}
                    </span>
                  )}
                </div>
              </div>

              <div className="details-sidebar-divider" />

              {/* Created Date */}
              <div className="details-field-row">
                <span className="field-lbl">Created</span>
                <span className="field-val-date">{formatDate(issue?.fields?.created)}</span>
              </div>

              {/* Updated Date */}
              <div className="details-field-row">
                <span className="field-lbl">Updated</span>
                <span className="field-val-date">{formatDate(issue?.fields?.updated)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
