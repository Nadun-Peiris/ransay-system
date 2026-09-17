"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BreakdownPieChart } from "@/components/charts/breakdown-pie-chart";
import { ChartCard } from "@/components/charts/chart-card";
import { SalesLineChart } from "@/components/charts/sales-line-chart";
import { SkeletonTable } from "@/components/skeleton";
import { showToast } from "@/components/toast-provider";

type UserRole = "ADMIN" | "SUPERADMIN";
type ReportMode = "TOTAL_SALES" | "SELECTED_ORDERS_SALES";
type OrderType = "VAT" | "NON_VAT";
type PaymentStatus = "PENDING" | "DUE" | "OVERDUE" | "PAID";
type ProfitLossStatus = "PROFIT" | "LOSS" | "BREAK_EVEN";
type ExpenseCategory =
  | "TRANSPORT"
  | "SALARY"
  | "RENT"
  | "ELECTRICITY"
  | "FUEL"
  | "PACKAGING"
  | "OFFICE"
  | "MAINTENANCE"
  | "MARKETING"
  | "OTHER";
type ExpensePaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "CARD"
  | "CHEQUE"
  | "OTHER";

type CurrentUser = {
  id: string;
  name: string;
  email: string | null;
  role: UserRole;
};

type ProfitLossReport = {
  mode: ReportMode;
  summary: {
    grossSalesAmount: number;
    costOfGoodsSold: number;
    grossProfitAmount: number;
    totalExpenseAmount: number;
    netProfitAmount: number;
    status: ProfitLossStatus;
    profitMarginPercentage: number;
    salesOrderCount: number;
    expenseCount: number;
  };
  salesBreakdown: {
    vatSalesAmount: number;
    nonVatSalesAmount: number;
    vatOrderCount: number;
    nonVatOrderCount: number;
    paidAmount: number;
    pendingAmount: number;
    dueAmount: number;
    overdueAmount: number;
  };
  expenseBreakdown: {
    categoryBreakdown: {
      category: ExpenseCategory;
      amount: number;
      count: number;
    }[];
    paymentMethodBreakdown: {
      paymentMethod: ExpensePaymentMethod;
      amount: number;
      count: number;
    }[];
  };
  dailyProfitLoss: {
    date: string;
    salesAmount: number;
    expenseAmount: number;
    netProfitAmount: number;
  }[];
  recentSales: {
    id: string;
    orderId: string;
    vatOrderId: string | null;
    nonVatOrderId: string | null;
    customerName: string;
    orderType: OrderType;
    totalAmount: number;
    paymentStatus: PaymentStatus;
    orderDate: string;
    createdAt: string;
  }[];
  recentExpenses: {
    id: string;
    title: string;
    category: ExpenseCategory;
    amount: number;
    expenseDate: string;
    paymentMethod: ExpensePaymentMethod;
    createdAt: string;
  }[];
};

type FilterState = {
  dateFrom: string;
  dateTo: string;
  orderType: string;
  paymentStatus: string;
  createdByRole: string;
  expenseCategory: string;
  expensePaymentMethod: string;
};

const emptyFilters: FilterState = {
  dateFrom: "",
  dateTo: "",
  orderType: "",
  paymentStatus: "",
  createdByRole: "",
  expenseCategory: "",
  expensePaymentMethod: "",
};

const expenseCategories: ExpenseCategory[] = [
  "TRANSPORT",
  "SALARY",
  "RENT",
  "ELECTRICITY",
  "FUEL",
  "PACKAGING",
  "OFFICE",
  "MAINTENANCE",
  "MARKETING",
  "OTHER",
];

const expensePaymentMethods: ExpensePaymentMethod[] = [
  "CASH",
  "BANK_TRANSFER",
  "CARD",
  "CHEQUE",
  "OTHER",
];

function formatMoney(value: number) {
  return `Rs ${value.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value: number) {
  return `${value.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatEnumLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function getBadgeClass(type: "green" | "red" | "blue" | "gray") {
  const classes = {
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
    gray: "bg-stone-200 text-stone-700",
  };

  return classes[type];
}

function getStatusBadgeColor(status: ProfitLossStatus) {
  if (status === "PROFIT") return "green";
  if (status === "LOSS") return "red";
  return "gray";
}

function buildReportQuery(filters: FilterState, mode: ReportMode) {
  const params = new URLSearchParams({ mode });

  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) {
      params.set(key, value.trim());
    }
  }

  return params.toString();
}

export default function ProfitLossPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [mode, setMode] = useState<ReportMode>("TOTAL_SALES");
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterState>(emptyFilters);
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isSuperadmin = currentUser?.role === "SUPERADMIN";
  const effectiveMode: ReportMode = isSuperadmin
    ? mode
    : "SELECTED_ORDERS_SALES";

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const fetchReport = useCallback(async () => {
    try {
      setIsLoading(true);

      const meResponse = await fetch("/api/auth/me");
      const meResult = await meResponse.json();

      if (!meResponse.ok || !meResult.success) {
        throw new Error(meResult.message || "Failed to load current user.");
      }

      const user = meResult.data as CurrentUser;
      setCurrentUser(user);

      const allowedMode =
        user.role === "SUPERADMIN" ? effectiveMode : "SELECTED_ORDERS_SALES";
      const params = buildReportQuery(appliedFilters, allowedMode);
      const response = await fetch(`/api/reports/profit-loss?${params}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load profit and loss.");
      }

      setReport(result.data as ProfitLossReport);
    } catch (error) {
      console.error("Failed to load profit and loss:", error);
      showToast(
        error instanceof Error
          ? error.message
          : "Failed to load profit and loss.",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters, effectiveMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchReport(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchReport]);

  return (
    <main className="p-6 font-sans text-black">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-black">
          Profit & Loss
        </h1>
        <p className="mt-1 text-sm font-medium text-stone-500">
          Compare sales and expenses to understand profitability.
        </p>
      </div>

      {isSuperadmin && (
        <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <label className="block max-w-sm space-y-1.5">
            <span className="text-xs font-bold uppercase text-stone-500">
              Report Mode
            </span>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as ReportMode)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
            >
              <option value="TOTAL_SALES">Total Sales P&L</option>
              <option value="SELECTED_ORDERS_SALES">
                Selected Orders P&L
              </option>
            </select>
          </label>
        </section>
      )}

      <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DateInput
            label="Date From"
            value={filters.dateFrom}
            onChange={(value) => updateFilter("dateFrom", value)}
          />
          <DateInput
            label="Date To"
            value={filters.dateTo}
            onChange={(value) => updateFilter("dateTo", value)}
          />
          <FilterSelect
            label="Order Type"
            value={filters.orderType}
            onChange={(value) => updateFilter("orderType", value)}
            options={[
              ["VAT", "VAT"],
              ["NON_VAT", "NON-VAT"],
            ]}
          />
          <FilterSelect
            label="Payment Status"
            value={filters.paymentStatus}
            onChange={(value) => updateFilter("paymentStatus", value)}
            options={[
              ["PAID", "Paid"],
              ["PENDING", "Pending"],
              ["DUE", "Due"],
              ["OVERDUE", "Overdue"],
            ]}
          />
          {isSuperadmin && (
            <FilterSelect
              label="Created By"
              value={filters.createdByRole}
              onChange={(value) => updateFilter("createdByRole", value)}
              options={[
                ["ADMIN", "Admin"],
                ["SUPERADMIN", "Superadmin"],
              ]}
            />
          )}
          <FilterSelect
            label="Expense Category"
            value={filters.expenseCategory}
            onChange={(value) => updateFilter("expenseCategory", value)}
            options={expenseCategories.map((category) => [
              category,
              formatEnumLabel(category),
            ])}
          />
          <FilterSelect
            label="Expense Payment Method"
            value={filters.expensePaymentMethod}
            onChange={(value) => updateFilter("expensePaymentMethod", value)}
            options={expensePaymentMethods.map((method) => [
              method,
              formatEnumLabel(method),
            ])}
          />
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 transition hover:bg-stone-50"
          >
            Clear Filters
          </button>
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-xl bg-[#FFBF01] px-4 py-2.5 text-sm font-bold text-black shadow-sm transition hover:bg-[#efb301]"
          >
            Apply Filters
          </button>
        </div>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          label="Gross Sales"
          value={formatMoney(report?.summary.grossSalesAmount ?? 0)}
        />
        <SummaryCard
          label="Cost of Goods Sold"
          value={formatMoney(report?.summary.costOfGoodsSold ?? 0)}
        />
        <SummaryCard
          label="Gross Profit"
          value={formatMoney(report?.summary.grossProfitAmount ?? 0)}
        />
        <SummaryCard
          label="Total Expenses"
          value={formatMoney(report?.summary.totalExpenseAmount ?? 0)}
        />
        <SummaryCard
          label="Net Profit / Loss"
          value={formatMoney(report?.summary.netProfitAmount ?? 0)}
          tone={
            report?.summary.status === "LOSS"
              ? "red"
              : report?.summary.status === "PROFIT"
                ? "green"
                : "gray"
          }
        />
        <SummaryCard
          label="Profit Margin"
          value={formatPercent(report?.summary.profitMarginPercentage ?? 0)}
        />
        <SummaryCard
          label="Sales Orders"
          value={(report?.summary.salesOrderCount ?? 0).toLocaleString("en-LK")}
        />
        <SummaryCard
          label="Expense Count"
          value={(report?.summary.expenseCount ?? 0).toLocaleString("en-LK")}
        />
      </section>

      <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-bold text-black">
              Profit & Loss Summary
            </h2>
            <p className="mt-1 text-sm font-medium text-stone-500">
              {report?.mode === "TOTAL_SALES"
                ? "Total Sales P&L"
                : "Selected Orders P&L"}
            </p>
          </div>
          <Badge
            label={report?.summary.status ?? "BREAK_EVEN"}
            color={getStatusBadgeColor(report?.summary.status ?? "BREAK_EVEN")}
          />
        </div>
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Daily Profit & Loss"
          description="Sales, expenses, and net profit trend."
        >
          <SalesLineChart
            data={report?.dailyProfitLoss ?? []}
            lines={[
              { key: "salesAmount", name: "Sales", color: "#2563eb" },
              { key: "expenseAmount", name: "Expenses", color: "#dc2626" },
              {
                key: "netProfitAmount",
                name: "Net Profit",
                color: "#16a34a",
              },
            ]}
          />
        </ChartCard>

        <ChartCard title="Sales vs Expenses">
          <BreakdownPieChart
            data={[
              {
                name: "Gross Sales",
                amount: report?.summary.grossSalesAmount ?? 0,
              },
              {
                name: "Expenses",
                amount: report?.summary.totalExpenseAmount ?? 0,
              },
            ]}
            nameKey="name"
            valueKey="amount"
          />
        </ChartCard>

        <ChartCard title="Expense Category Breakdown">
          <BreakdownPieChart
            data={(report?.expenseBreakdown.categoryBreakdown ?? []).map(
              (row) => ({
                name: formatEnumLabel(row.category),
                amount: row.amount,
              })
            )}
            nameKey="name"
            valueKey="amount"
          />
        </ChartCard>

        <ChartCard title="Sales Breakdown">
          <BreakdownPieChart
            data={[
              {
                name: "VAT",
                amount: report?.salesBreakdown.vatSalesAmount ?? 0,
              },
              {
                name: "NON-VAT",
                amount: report?.salesBreakdown.nonVatSalesAmount ?? 0,
              },
            ]}
            nameKey="name"
            valueKey="amount"
          />
        </ChartCard>
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-3">
        <BreakdownPanel
          title="Sales Breakdown"
          rows={[
            {
              label: "VAT Sales",
              amount: report?.salesBreakdown.vatSalesAmount ?? 0,
              count: report?.salesBreakdown.vatOrderCount ?? 0,
            },
            {
              label: "NON-VAT Sales",
              amount: report?.salesBreakdown.nonVatSalesAmount ?? 0,
              count: report?.salesBreakdown.nonVatOrderCount ?? 0,
            },
            {
              label: "Paid",
              amount: report?.salesBreakdown.paidAmount ?? 0,
            },
            {
              label: "Pending",
              amount: report?.salesBreakdown.pendingAmount ?? 0,
            },
            {
              label: "Due",
              amount: report?.salesBreakdown.dueAmount ?? 0,
            },
            {
              label: "Overdue",
              amount: report?.salesBreakdown.overdueAmount ?? 0,
            },
          ]}
        />
        <BreakdownPanel
          title="Expense Breakdown by Category"
          rows={(report?.expenseBreakdown.categoryBreakdown ?? []).map(
            (row) => ({
              label: formatEnumLabel(row.category),
              amount: row.amount,
              count: row.count,
            })
          )}
        />
        <BreakdownPanel
          title="Expense Breakdown by Payment Method"
          rows={(report?.expenseBreakdown.paymentMethodBreakdown ?? []).map(
            (row) => ({
              label: formatEnumLabel(row.paymentMethod),
              amount: row.amount,
              count: row.count,
            })
          )}
        />
      </section>

      <DailyProfitLossTable
        rows={report?.dailyProfitLoss ?? []}
        isLoading={isLoading}
      />
      <RecentSalesTable rows={report?.recentSales ?? []} isLoading={isLoading} />
      <RecentExpensesTable
        rows={report?.recentExpenses ?? []}
        isLoading={isLoading}
      />
    </main>
  );
}

function SummaryCard({
  label,
  value,
  tone = "gray",
}: {
  label: string;
  value: string;
  tone?: "green" | "red" | "gray";
}) {
  const toneClass = {
    green: "text-emerald-800",
    red: "text-red-800",
    gray: "text-black",
  }[tone];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-stone-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function BreakdownPanel({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; amount: number; count?: number }[];
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-black">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm font-medium text-stone-500">No data found.</p>
        ) : (
          rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 border-b border-stone-100 pb-3 last:border-b-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-bold text-black">{row.label}</p>
                {typeof row.count === "number" && (
                  <p className="text-xs font-medium text-stone-500">
                    {row.count.toLocaleString("en-LK")} record
                    {row.count === 1 ? "" : "s"}
                  </p>
                )}
              </div>
              <p className="text-right text-sm font-bold text-black">
                {formatMoney(row.amount)}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function DailyProfitLossTable({
  rows,
  isLoading,
}: {
  rows: ProfitLossReport["dailyProfitLoss"];
  isLoading: boolean;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
        <h2 className="text-base font-bold text-black">
          Daily Profit & Loss
        </h2>
      </div>
      {isLoading && rows.length === 0 ? (
        <EmptyState label="Loading daily profit and loss..." />
      ) : rows.length === 0 ? (
        <EmptyState label="No daily profit and loss found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Sales</th>
                <th className="p-4 font-medium">Expenses</th>
                <th className="p-4 font-medium">Net Profit/Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.date} className="transition-colors hover:bg-stone-50/60">
                  <td className="p-4 font-medium text-black">{row.date}</td>
                  <td className="p-4 font-bold text-black">
                    {formatMoney(row.salesAmount)}
                  </td>
                  <td className="p-4 text-stone-700">
                    {formatMoney(row.expenseAmount)}
                  </td>
                  <td
                    className={`p-4 font-bold ${
                      row.netProfitAmount < 0
                        ? "text-red-800"
                        : row.netProfitAmount > 0
                          ? "text-emerald-800"
                          : "text-stone-700"
                    }`}
                  >
                    {formatMoney(row.netProfitAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RecentSalesTable({
  rows,
  isLoading,
}: {
  rows: ProfitLossReport["recentSales"];
  isLoading: boolean;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
        <h2 className="text-base font-bold text-black">Recent Sales</h2>
      </div>
      {isLoading && rows.length === 0 ? (
        <EmptyState label="Loading recent sales..." />
      ) : rows.length === 0 ? (
        <EmptyState label="No recent sales found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="p-4 font-medium">Order</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Total</th>
                <th className="p-4 font-medium">Payment</th>
                <th className="p-4 font-medium">Order Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((order) => (
                <tr key={order.id} className="transition-colors hover:bg-stone-50/60">
                  <td className="p-4">
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-bold text-black underline decoration-transparent underline-offset-4 transition-colors hover:text-[#C8942A] hover:decoration-[#C8942A]"
                    >
                      {order.orderId}
                    </Link>
                    <p className="mt-0.5 text-xs font-medium text-stone-500">
                      {order.vatOrderId ?? order.nonVatOrderId}
                    </p>
                  </td>
                  <td className="p-4 font-medium text-black">
                    {order.customerName}
                  </td>
                  <td className="p-4">{formatEnumLabel(order.orderType)}</td>
                  <td className="p-4 font-bold text-black">
                    {formatMoney(order.totalAmount)}
                  </td>
                  <td className="p-4">
                    <Badge label={order.paymentStatus} color="gray" />
                  </td>
                  <td className="p-4 font-medium text-stone-500">
                    {new Date(order.orderDate).toLocaleDateString("en-LK", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RecentExpensesTable({
  rows,
  isLoading,
}: {
  rows: ProfitLossReport["recentExpenses"];
  isLoading: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
        <h2 className="text-base font-bold text-black">Recent Expenses</h2>
      </div>
      {isLoading && rows.length === 0 ? (
        <EmptyState label="Loading recent expenses..." />
      ) : rows.length === 0 ? (
        <EmptyState label="No recent expenses found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Title</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Payment Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((expense) => (
                <tr key={expense.id} className="transition-colors hover:bg-stone-50/60">
                  <td className="p-4 font-medium text-stone-600">
                    {new Date(expense.expenseDate).toLocaleDateString("en-LK", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="p-4 font-bold text-black">{expense.title}</td>
                  <td className="p-4">{formatEnumLabel(expense.category)}</td>
                  <td className="p-4 font-bold text-black">
                    {formatMoney(expense.amount)}
                  </td>
                  <td className="p-4">
                    {formatEnumLabel(expense.paymentMethod)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Badge({
  label,
  color,
}: {
  label: string;
  color: "green" | "red" | "blue" | "gray";
}) {
  return (
    <span
      className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${getBadgeClass(
        color
      )}`}
    >
      {label}
    </span>
  );
}

function EmptyState({ label }: { label: string }) {
  if (label.startsWith("Loading")) {
    return <SkeletonTable columns={5} rows={5} />;
  }

  return (
    <div className="p-8 text-center text-sm font-medium text-stone-500">
      {label}
    </div>
  );
}

function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-bold uppercase text-stone-500">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-bold uppercase text-stone-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
      >
        <option value="">All</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
