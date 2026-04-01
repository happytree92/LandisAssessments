"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TrendPoint {
  label: string;
  score: number;
}

interface TrendlineProps {
  data: TrendPoint[];
}

export function Trendline({ data }: TrendlineProps) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderColor: "#e2e8f0",
            borderRadius: "6px",
          }}
          formatter={(value) => [`${value}`, "Score"]}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#0ea5e9"
          strokeWidth={2}
          dot={{ fill: "#0ea5e9", r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: "#0ea5e9" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
