"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface TrendPoint {
  label: string;
  score: number | null;
}

export function ScoreTrendline({ data }: { data: TrendPoint[] }) {
  const hasAnyData = data.some((d) => d.score !== null);

  if (!hasAnyData) {
    return (
      <div className="flex items-center justify-center h-[160px] text-sm text-[#94a3b8]">
        No assessment data yet for the last 6 months.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderColor: "#e2e8f0", borderRadius: "6px" }}
          formatter={(value) => [`${value}`, "Avg Score"]}
        />
        {/* Reference bands for score zones */}
        <ReferenceLine y={75} stroke="#10b981" strokeDasharray="4 3" strokeOpacity={0.4} />
        <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="4 3" strokeOpacity={0.4} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#0ea5e9"
          strokeWidth={2.5}
          dot={{ fill: "#0ea5e9", r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: "#0ea5e9" }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
