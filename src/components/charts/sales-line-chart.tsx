"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/formatters";

type ChartDatum = Record<string, string | number | null | undefined>;

export type LineConfig = {
  key: string;
  name: string;
  color?: string;
  valueType?: "currency" | "number";
};

const fallbackColors = ["#2563eb", "#16a34a", "#dc2626", "#ca8a04"];

function formatTooltipValue(value: unknown, valueType: "currency" | "number") {
  const numericValue = typeof value === "number" ? value : Number(value ?? 0);
  return valueType === "currency"
    ? formatCurrency(numericValue)
    : formatNumber(numericValue);
}

export function SalesLineChart({
  data,
  lines,
  xKey = "date",
  height = 320,
}: {
  data: ChartDatum[];
  lines: LineConfig[];
  xKey?: string;
  height?: number;
}) {
  if (!data.length || !lines.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl bg-stone-50 text-sm font-medium text-stone-500">
        No chart data available
      </div>
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          <XAxis dataKey={xKey} tick={{ fontSize: 12 }} stroke="#78716c" />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="#78716c"
            tickFormatter={(value) => formatNumber(Number(value))}
          />
          <Tooltip
            formatter={(value, _name, item) => {
              const config = lines.find((line) => line.key === item.dataKey);
              return [
                formatTooltipValue(value, config?.valueType ?? "currency"),
                config?.name ?? String(item.dataKey),
              ];
            }}
          />
          <Legend />
          {lines.map((line, index) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.name}
              stroke={line.color ?? fallbackColors[index % fallbackColors.length]}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
