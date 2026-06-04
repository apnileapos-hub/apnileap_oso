import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// Status → color mapping
const STATUS_COLORS = {
  default: '#8b949e',
  progress: '#58a6ff',
  review:   '#bc8cff',
  done:     '#3fb950',
  blocked:  '#f85149',
  testing:  '#d29922',
};

function getStatusColor(status = '') {
  const s = status.toLowerCase();
  if (s.includes('done') || s.includes('closed') || s.includes('resolved')) return STATUS_COLORS.done;
  if (s.includes('progress'))   return STATUS_COLORS.progress;
  if (s.includes('review'))     return STATUS_COLORS.review;
  if (s.includes('blocked'))    return STATUS_COLORS.blocked;
  if (s.includes('test'))       return STATUS_COLORS.testing;
  return STATUS_COLORS.default;
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{name}</div>
      <div className="chart-tooltip-value">{value} issues</div>
    </div>
  );
};

const CustomLegend = ({ payload }) => (
  <div className="pie-legend">
    {payload.map((entry) => (
      <div key={entry.value} className="pie-legend-item">
        <span className="pie-legend-dot" style={{ background: entry.color }} />
        <span className="pie-legend-label">{entry.value}</span>
        <span className="pie-legend-count">{entry.payload.value}</span>
      </div>
    ))}
  </div>
);

export default function StatusPieChart({ data = [], loading }) {
  if (loading) {
    return (
      <div className="chart-placeholder">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="chart-placeholder">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" stroke="#30363d" strokeWidth="2"/>
          <path d="M16 10v6M16 20v.5" stroke="#484f58" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span>No status data available</span>
      </div>
    );
  }

  const chartData = data.map((d) => ({ name: d.status, value: d.count }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={chartData}
          cx="42%"
          cy="50%"
          innerRadius={65}
          outerRadius={95}
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
        >
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={getStatusColor(entry.name)} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          content={<CustomLegend />}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
