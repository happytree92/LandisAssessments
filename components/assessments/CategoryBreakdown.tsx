"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";

interface CategoryBreakdownProps {
  scores: Record<string, number>;
}

function barColor(score: number): string {
  if (score >= 75) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export function CategoryBreakdown({ scores }: CategoryBreakdownProps) {
  const data = Object.entries(scores).map(([category, score]) => ({
    category,
    score,
  }));

  const chartHeight = Math.max(data.length * 52, 120);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="category"
          tick={{ fontSize: 12, fill: "#334155" }}
          tickLine={false}
          axisLine={false}
          width={145}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderColor: "#e2e8f0",
            borderRadius: "6px",
          }}
          formatter={(value) => [`${value}`, "Score"]}
          cursor={{ fill: "#f8fafc" }}
        />
        <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={20}>
          {data.map((entry) => (
            <Cell key={entry.category} fill={barColor(entry.score)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
