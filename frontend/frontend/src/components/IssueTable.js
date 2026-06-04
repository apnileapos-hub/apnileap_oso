import React, { useState, useMemo } from 'react';

// ── Helpers ─────────────────────────────────────────────────────────────────

function getStatusClass(status = '') {
  const s = status.toLowerCase();
  if (s.includes('done') || s.includes('closed') || s.includes('resolved')) return 'done';
  if (s.includes('progress')) return 'progress';
  if (s.includes('review'))   return 'review';
  if (s.includes('blocked'))  return 'blocked';
  return 'todo';
}

const PRIORITY_MAP = {
  highest: { cls: 'badge-priority-highest', label: '⬆ Highest' },
  high:    { cls: 'badge-priority-high',    label: '↑ High' },
  medium:  { cls: 'badge-priority-medium',  label: '→ Medium' },
  low:     { cls: 'badge-priority-low',     label: '↓ Low' },
  lowest:  { cls: 'badge-priority-lowest',  label: '⬇ Lowest' },
};

function getPriority(name = '') {
  return PRIORITY_MAP[name.toLowerCase()] || PRIORITY_MAP.medium;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function getInitials(name = '') {
  if (!name || name === 'Unassigned') return '?';
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// Deterministic avatar color from name
const AVATAR_COLORS = [
  'linear-gradient(135deg,#58a6ff,#1f6feb)',
  'linear-gradient(135deg,#bc8cff,#8957e5)',
  'linear-gradient(135deg,#3fb950,#238636)',
  'linear-gradient(135deg,#d29922,#9e6a03)',
  'linear-gradient(135deg,#f85149,#b91c1c)',
];
function avatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {[60, 220, 90, 100, 90, 120, 80].map((w, i) => (
        <td key={i} style={{ padding: '14px 20px' }}>
          <div className="skel-pulse" style={{ width: w, height: 12, borderRadius: 4 }} />
        </td>
      ))}
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function IssueTable({ issues = [], loading, limit, onIssueClick }) {
  const [search, setSearch]     = useState('');
  const [sortKey, setSortKey]   = useState('key');
  const [sortDir, setSortDir]   = useState('asc');
  const [statusFilter, setStatusFilter] = useState('all');

  // Unique statuses for filter dropdown
  const statuses = useMemo(() => {
    const set = new Set(issues.map((i) => i.fields?.status?.name || 'Unknown'));
    return ['all', ...Array.from(set).sort()];
  }, [issues]);

  const filtered = useMemo(() => {
    let list = issues;

    if (statusFilter !== 'all') {
      list = list.filter((i) => (i.fields?.status?.name || '') === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          (i.key || '').toLowerCase().includes(q) ||
          (i.fields?.summary || '').toLowerCase().includes(q) ||
          (i.fields?.assignee?.displayName || '').toLowerCase().includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      let va, vb;
      switch (sortKey) {
        case 'key':      va = a.key || ''; vb = b.key || ''; break;
        case 'summary':  va = a.fields?.summary || ''; vb = b.fields?.summary || ''; break;
        case 'status':   va = a.fields?.status?.name || ''; vb = b.fields?.status?.name || ''; break;
        case 'assignee': va = a.fields?.assignee?.displayName || ''; vb = b.fields?.assignee?.displayName || ''; break;
        case 'priority': va = a.fields?.priority?.name || ''; vb = b.fields?.priority?.name || ''; break;
        case 'created':  va = a.fields?.created || ''; vb = b.fields?.created || ''; break;
        default: va = ''; vb = '';
      }
      const cmp = va.localeCompare(vb, undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return limit ? list.slice(0, limit) : list;
  }, [issues, search, sortKey, sortDir, statusFilter, limit]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => (
    <span className={`sort-icon ${sortKey === col ? 'active' : ''}`}>
      {sortKey === col ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}
    </span>
  );

  return (
    <div className="table-card">
      <div className="table-header">
        <div>
          <div className="table-title">
            Live Issues
            <span className="table-count"> · {loading ? '…' : `${filtered.length} of ${issues.length}`}</span>
          </div>
        </div>
        <div className="table-controls">
          {/* Status filter */}
          <select
            className="table-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {statuses.map((s) => (
              <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>
            ))}
          </select>

          {/* Search */}
          <div className="table-search">
            <svg className="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="var(--text-muted)" strokeWidth="1.2"/>
              <path d="M9.5 9.5L12.5 12.5" stroke="var(--text-muted)" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <input
              id="issue-search-input"
              type="text"
              placeholder="Search key, summary, assignee…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear-btn" onClick={() => setSearch('')} title="Clear">✕</button>
            )}
          </div>
        </div>
      </div>

      <div className="table-scroll-wrap">
        <table className="issues-table">
          <thead>
            <tr>
              {[
                { key: 'key',      label: 'Key' },
                { key: 'summary',  label: 'Summary' },
                { key: 'type',     label: 'Type',     noSort: true },
                { key: 'status',   label: 'Status' },
                { key: 'priority', label: 'Priority' },
                { key: 'assignee', label: 'Assignee' },
                { key: 'created',  label: 'Created' },
              ].map(({ key, label, noSort }) => (
                <th key={key} onClick={noSort ? undefined : () => handleSort(key)} style={noSort ? { cursor: 'default' } : {}}>
                  {label}{!noSort && <SortIcon col={key} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="state-container">
                    <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                      <circle cx="20" cy="20" r="18" stroke="var(--border)" strokeWidth="2"/>
                      <path d="M14 14l12 12M26 14L14 26" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <div className="state-title">No issues found</div>
                    <div className="state-desc">
                      {search ? `No results for "${search}"` : 'No issues match the selected filters'}
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((issue, idx) => {
                const status     = issue.fields?.status?.name || 'Unknown';
                const priority   = issue.fields?.priority?.name || 'Medium';
                const assignee   = issue.fields?.assignee?.displayName || 'Unassigned';
                const issueType  = issue.fields?.issuetype?.name || '—';
                const statusCls  = getStatusClass(status);
                const priorityMeta = getPriority(priority);

                return (
                  <tr key={issue.id || idx} onClick={() => onIssueClick?.(issue)} style={{ cursor: 'pointer' }}>
                    <td>
                      <span className="issue-key">{issue.key || '—'}</span>
                    </td>
                    <td>
                      <span className="issue-summary" title={issue.fields?.summary}>
                        {issue.fields?.summary || 'No summary'}
                      </span>
                    </td>
                    <td>
                      <span className="issue-type-badge">{issueType}</span>
                    </td>
                    <td>
                      <span className={`badge badge-${statusCls}`}>
                        <span className="badge-dot" />
                        {status}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${priorityMeta.cls}`}>
                        {priorityMeta.label}
                      </span>
                    </td>
                    <td>
                      <div className="assignee-cell">
                        <div
                          className="avatar"
                          style={{ background: avatarColor(assignee) }}
                          title={assignee}
                        >
                          {getInitials(assignee)}
                        </div>
                        <span className="assignee-name">{assignee}</span>
                      </div>
                    </td>
                    <td>
                      <span className="date-cell">{formatDate(issue.fields?.created)}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
