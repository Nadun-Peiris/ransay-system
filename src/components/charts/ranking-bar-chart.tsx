"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatNumber } from "@/lib/formatters";

type ChartDatum = Record<string, string | number | null | undefined>;

export function RankingBarChart({
  data,
  xKey,
  yKey,
  layout = "horizontal",
  height = 340,
  valueType = "currency",
}: {
  data: ChartDatum[];
  xKey: string;
  yKey: string;
  layout?: "horizontal" | "vertical";
  height?: number;
  valueType?: "currency" | "number";
}) {
  if (!data.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-xl bg-stone-50 text-sm font-medium text-stone-500">
        No chart data available
      </div>
    );
  }

  const formatValue = (value: unknown) => {
    const numericValue = Number(value ?? 0);
    return valueType === "currency"
      ? formatCurrency(numericValue)
      : formatNumber(numericValue);
  };

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={layout}
          margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
          {layout === "vertical" ? (
            <>
              <XAxis type="number" tickFormatter={(value) => formatNumber(Number(value))} />
              <YAxis
                type="category"
                dataKey={xKey}
                width={120}
                tick={{ fontSize: 12 }}
              />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} tick={{ fontSize: 12 }} stroke="#78716c" />
              <YAxis
                tick={{ fontSize: 12 }}
                stroke="#78716c"
                tickFormatter={(value) => formatNumber(Number(value))}
              />
            </>
          )}
          <Tooltip formatter={(value) => formatValue(value)} />
          <Bar dataKey={yKey} fill="#2563eb" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
