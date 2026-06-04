import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

const BAR_COLORS = [
  '#58a6ff', '#bc8cff', '#3fb950', '#d29922',
  '#f85149', '#79c0ff', '#d2a8ff', '#56d364',
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{label}</div>
      <div className="chart-tooltip-value">{payload[0].value} issues</div>
    </div>
  );
};

// Truncate long assignee names on axis
const TickLabel = ({ x, y, payload }) => {
  const name = payload.value.length > 10 ? payload.value.slice(0, 10) + '…' : payload.value;
  return (
    <text x={x} y={y} dy={12} textAnchor="middle" fill="#8b949e" fontSize={11}>
      {name}
    </text>
  );
};

export default function AssigneeBarChart({ data = [], loading }) {
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
          <rect x="4" y="12" width="6" height="16" rx="1.5" stroke="#30363d" strokeWidth="2"/>
          <rect x="13" y="6" width="6" height="22" rx="1.5" stroke="#30363d" strokeWidth="2"/>
          <rect x="22" y="16" width="6" height="12" rx="1.5" stroke="#30363d" strokeWidth="2"/>
        </svg>
        <span>No assignee data available</span>
      </div>
    );
  }

  const chartData = data.slice(0, 8).map((d) => ({
    name: d.assignee,
    value: d.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#21262d" vertical={false} />
        <XAxis
          dataKey="name"
          tick={<TickLabel />}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#8b949e', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
          width={28}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(88,166,255,0.05)' }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {chartData.map((_, idx) => (
            <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
