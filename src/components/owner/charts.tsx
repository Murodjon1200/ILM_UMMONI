"use client";

import { formatSom, formatSomCompact } from "@/lib/currency";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface RevenuePoint {
  month: string;
  revenue: number;
}

export interface StudentGrowthPoint {
  month: string;
  students: number;
}

function formatMonth(value: string, locale: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

const tooltipStyle = {
  border: "1px solid #1e293b",
  borderRadius: "12px",
  backgroundColor: "#0f172a",
  color: "#f8fafc",
  fontSize: "12px",
};

export function RevenueChart({
  data,
  locale,
}: {
  data: RevenuePoint[];
  locale: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00C6FF" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#00C6FF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#334155" strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey="month" tickFormatter={(value) => formatMonth(value, locale)} stroke="#94a3b8" fontSize={11} />
        <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(value) => formatSomCompact(Number(value))} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => formatMonth(String(value), locale)} formatter={(value) => [formatSom(Number(value)), ""]} />
        <Area type="monotone" dataKey="revenue" stroke="#00C6FF" strokeWidth={2.5} fill="url(#revenueFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function StudentGrowthChart({
  data,
  locale,
}: {
  data: StudentGrowthPoint[];
  locale: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="#334155" strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey="month" tickFormatter={(value) => formatMonth(value, locale)} stroke="#94a3b8" fontSize={11} />
        <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={11} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(value) => formatMonth(String(value), locale)} />
        <Line type="monotone" dataKey="students" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 4, fill: "#22d3ee" }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function EnrollmentBarChart({
  data,
}: {
  data: Array<{ name: string; students: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid stroke="#334155" strokeDasharray="4 4" horizontal={false} />
        <XAxis type="number" allowDecimals={false} stroke="#94a3b8" fontSize={11} />
        <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} width={110} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="students" fill="#a78bfa" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
