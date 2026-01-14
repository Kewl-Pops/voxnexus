"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { format, parseISO } from "date-fns";

const THEME = {
  colors: {
    primary: "#10b981", // emerald-500
    secondary: "#3b82f6", // blue-500
    risk: {
      LOW: "#10b981",
      MEDIUM: "#eab308",
      HIGH: "#f97316",
      CRITICAL: "#ef4444",
    },
    background: "#18181b", // zinc-900
    text: "#a1a1aa", // zinc-400
    grid: "#27272a", // zinc-800
    tooltip: "#27272a",
  }
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 border border-zinc-700 p-3 rounded-lg shadow-xl">
        <p className="text-zinc-200 font-medium mb-1">{label}</p>
        {payload.map((p: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: p.color }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function VolumeChart({ data }: { data: any[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-[400px]">
      <h3 className="text-lg font-medium text-white mb-6">Call Volume Trend</h3>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={THEME.colors.grid} vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke={THEME.colors.text} 
            tickFormatter={(str) => format(parseISO(str), "MMM d")}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke={THEME.colors.text}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line 
            type="monotone" 
            dataKey="count" 
            name="Calls"
            stroke={THEME.colors.primary} 
            strokeWidth={3}
            dot={false}
            activeDot={{ r: 6, fill: THEME.colors.primary }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RiskPieChart({ data }: { data: any[] }) {
  // Map standard risk names to colors
  const getColor = (name: string) => {
    return THEME.colors.risk[name as keyof typeof THEME.colors.risk] || THEME.colors.text;
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-[400px]">
      <h3 className="text-lg font-medium text-white mb-6">Risk Distribution</h3>
      <ResponsiveContainer width="100%" height="85%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.name)} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
             verticalAlign="bottom" 
             height={36}
             iconType="circle"
             formatter={(value) => <span className="text-zinc-400 text-sm ml-1">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AgentBarChart({ data }: { data: any[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-[400px]">
      <h3 className="text-lg font-medium text-white mb-6">Agent Performance</h3>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke={THEME.colors.grid} horizontal={true} vertical={false} />
          <XAxis type="number" stroke={THEME.colors.text} hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            stroke={THEME.colors.text}
            tick={{ fontSize: 12 }}
            width={100}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="calls" 
            name="Total Calls" 
            fill={THEME.colors.secondary} 
            radius={[0, 4, 4, 0]} 
            barSize={20}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
