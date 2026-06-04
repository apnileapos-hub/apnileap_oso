import React from 'react';

const CARDS = [
  {
    id: 'total',
    label: 'Total Issues',
    colorClass: 'accent',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="14" height="14" rx="3" stroke="#58a6ff" strokeWidth="1.4"/>
        <path d="M6 9h6M9 6v6" stroke="#58a6ff" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    getValue: (m) => m.total,
    meta: 'All tracked issues in SCRUM',
  },
  {
    id: 'open',
    label: 'Open',
    colorClass: 'warning',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="7" stroke="#d29922" strokeWidth="1.4"/>
        <path d="M9 6v4M9 12v.5" stroke="#d29922" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    getValue: (m) => m.open,
    meta: 'Awaiting action',
  },
  {
    id: 'inProgress',
    label: 'In Progress',
    colorClass: 'accent-blue',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="7" stroke="#58a6ff" strokeWidth="1.4" strokeDasharray="3 2"/>
        <path d="M6 9L8.5 11.5L12.5 7" stroke="#58a6ff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    getValue: (m) => m.inProgress,
    meta: 'Actively being worked on',
  },
  {
    id: 'done',
    label: 'Done',
    colorClass: 'success',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="7" stroke="#3fb950" strokeWidth="1.4"/>
        <path d="M5.5 9L8 11.5L12.5 6.5" stroke="#3fb950" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    getValue: (m) => m.done,
    meta: 'Completed this sprint',
  },
  {
    id: 'avgAge',
    label: 'Avg Age',
    colorClass: 'purple',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="7" stroke="#bc8cff" strokeWidth="1.4"/>
        <path d="M9 5v4l2.5 2.5" stroke="#bc8cff" strokeWidth="1.4" strokeLinecap="round"/>
      </svg>
    ),
    getValue: (m) => `${m.avgAgeDays}d`,
    meta: 'Average issue age',
  },
];

function SkeletonCard({ colorClass }) {
  return (
    <div className={`kpi-card kpi-skeleton ${colorClass}`}>
      <div className="kpi-card-header">
        <div className="kpi-label-skel skel-pulse" style={{ width: 80, height: 12, borderRadius: 4 }} />
        <div className="kpi-icon skel-pulse" style={{ width: 34, height: 34, borderRadius: 8 }} />
      </div>
      <div className="skel-pulse" style={{ width: 60, height: 36, borderRadius: 6 }} />
      <div className="skel-pulse" style={{ width: 120, height: 10, borderRadius: 4 }} />
    </div>
  );
}

export default function KPICards({ metrics, loading }) {
  if (loading) {
    return (
      <div className="kpi-grid">
        {CARDS.map((c) => <SkeletonCard key={c.id} colorClass={c.colorClass} />)}
      </div>
    );
  }

  return (
    <div className="kpi-grid">
      {CARDS.map((card) => (
        <div key={card.id} className={`kpi-card ${card.colorClass}`}>
          <div className="kpi-card-header">
            <span className="kpi-label">{card.label}</span>
            <div className="kpi-icon">{card.icon}</div>
          </div>
          <div className="kpi-value">
            {metrics ? card.getValue(metrics) : '—'}
          </div>
          <div className="kpi-meta">{card.meta}</div>
        </div>
      ))}
    </div>
  );
}
