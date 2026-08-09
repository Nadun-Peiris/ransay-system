"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/formatters";

type ChartDatum = Record<string, string | number | null | undefined>;

const colors = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#6b7280", "#7c3aed"];

export function BreakdownPieChart({
  data,
  nameKey,
  valueKey,
  title,
  height = 300,
  valueType = "currency",
}: {
  data: ChartDatum[];
  nameKey: string;
  valueKey: string;
  title?: string;
  height?: number;
  valueType?: "currency" | "number";
}) {
  const chartData = data.filter((item) => Number(item[valueKey] ?? 0) > 0);

  if (!chartData.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl bg-stone-50 text-sm font-medium text-stone-500">
        No chart data available
      </div>
    );
  }

  return (
    <div>
      {title && <p className="mb-2 text-sm font-semibold text-stone-600">{title}</p>}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey={valueKey}
              nameKey={nameKey}
              innerRadius={58}
              outerRadius={96}
              paddingAngle={2}
            >
              {chartData.map((item, index) => (
                <Cell
                  key={`${String(item[nameKey])}-${index}`}
                  fill={colors[index % colors.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => {
                const numericValue = Number(value ?? 0);
                return valueType === "currency"
                  ? formatCurrency(numericValue)
                  : formatNumber(numericValue);
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
