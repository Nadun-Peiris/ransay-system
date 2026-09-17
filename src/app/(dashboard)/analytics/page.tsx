"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BreakdownPieChart } from "@/components/charts/breakdown-pie-chart";
import { ChartCard } from "@/components/charts/chart-card";
import { SalesLineChart } from "@/components/charts/sales-line-chart";
import { SkeletonBlock } from "@/components/skeleton";
import { formatCurrency } from "@/lib/formatters";

type CurrentUser = {
  id: string;
  name: string;
  email: string | null;
  role: "ADMIN" | "SUPERADMIN";
};

type ReportCard = {
  title: string;
  value: string;
  description: string;
  href: string;
  tone?: "green" | "red" | "gray";
};

type SalesReport = {
  summary: {
    totalSalesAmount: number;
    vatSalesAmount: number;
    nonVatSalesAmount: number;
  };
};

type ProductSalesReport = {
  summary: {
    totalSalesAmount: number;
  };
};

type CustomerSalesReport = {
  summary: {
    totalSalesAmount: number;
  };
};

type ExpensesReport = {
  summary: {
    totalExpenseAmount: number;
  };
  categoryBreakdown: {
    category: string;
    amount: number;
    count: number;
  }[];
};

type ProfitLossReport = {
  summary: {
    netProfitAmount: number;
  };
  dailyProfitLoss: {
    date: string;
    salesAmount: number;
    expenseAmount: number;
    netProfitAmount: number;
  }[];
};

type ReceivablesReport = {
  summary: {
    projectedReceivableAmount: number;
  };
};

type ApiResult<T> = {
  success: boolean;
  data: T;
};

type FilterState = {
  dateFrom: string;
  dateTo: string;
};

const emptyFilters: FilterState = {
  dateFrom: "",
  dateTo: "",
};

function buildQuery(filters: FilterState) {
  const params = new URLSearchParams();

  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);

  return params.toString();
}

async function fetchReport<T>(url: string) {
  try {
    const response = await fetch(url);
    const result = (await response.json()) as ApiResult<T>;

    if (!response.ok || !result.success) {
      return null;
    }

    return result.data;
  } catch {
    return null;
  }
}

export default function AnalyticsOverviewPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [totalSalesReport, setTotalSalesReport] =
    useState<SalesReport | null>(null);
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [productSalesReport, setProductSalesReport] =
    useState<ProductSalesReport | null>(null);
  const [customerSalesReport, setCustomerSalesReport] =
    useState<CustomerSalesReport | null>(null);
  const [expensesReport, setExpensesReport] = useState<ExpensesReport | null>(
    null
  );
  const [profitLossReport, setProfitLossReport] =
    useState<ProfitLossReport | null>(null);
  const [receivablesReport, setReceivablesReport] =
    useState<ReceivablesReport | null>(null);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterState>(emptyFilters);
  const [isLoading, setIsLoading] = useState(true);

  const queryString = useMemo(
    () => buildQuery(appliedFilters),
    [appliedFilters]
  );

  const fetchOverview = useCallback(async () => {
    try {
      setIsLoading(true);

      const meResponse = await fetch("/api/auth/me");
      const meResult = await meResponse.json();

      if (!meResponse.ok || !meResult.success) {
        throw new Error(meResult.message || "Failed to load current user.");
      }

      const user = meResult.data as CurrentUser;
      const suffix = queryString ? `?${queryString}` : "";
      const currentDate = new Date();
      const receivablesParams = new URLSearchParams({
        month: String(currentDate.getMonth() + 1),
        year: String(currentDate.getFullYear()),
      });
      setCurrentUser(user);

      const [
        totalSales,
        sales,
        productSales,
        customerSales,
        expenses,
        profitLoss,
        receivables,
      ] = await Promise.all([
        user.role === "SUPERADMIN"
          ? fetchReport<SalesReport>(`/api/reports/total-sales${suffix}`)
          : Promise.resolve(null),
        fetchReport<SalesReport>(`/api/reports/sales${suffix}`),
        user.role === "SUPERADMIN"
          ? fetchReport<ProductSalesReport>(
              `/api/reports/product-sales${suffix}`
            )
          : Promise.resolve(null),
        user.role === "SUPERADMIN"
          ? fetchReport<CustomerSalesReport>(
              `/api/reports/customer-sales${suffix}`
            )
          : Promise.resolve(null),
        fetchReport<ExpensesReport>(`/api/reports/expenses${suffix}`),
        fetchReport<ProfitLossReport>(`/api/reports/profit-loss${suffix}`),
        fetchReport<ReceivablesReport>(
          `/api/reports/receivables?${receivablesParams.toString()}`
        ),
      ]);

      setTotalSalesReport(totalSales);
      setSalesReport(sales);
      setProductSalesReport(productSales);
      setCustomerSalesReport(customerSales);
      setExpensesReport(expenses);
      setProfitLossReport(profitLoss);
      setReceivablesReport(receivables);
    } catch (error) {
      console.error("Failed to load analytics overview:", error);
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchOverview();
    });
  }, [fetchOverview]);

  const isSuperadmin = currentUser?.role === "SUPERADMIN";
  const preferredSalesReport = isSuperadmin ? totalSalesReport : salesReport;
  const cards: ReportCard[] = [
    ...(isSuperadmin
      ? [
          {
            title: "Total Sales",
            value: formatCurrency(
              totalSalesReport?.summary.totalSalesAmount ?? 0
            ),
            description: "Full sales report across all eligible orders.",
            href: "/analytics/total-sales",
          },
        ]
      : []),
    {
      title: "Sales",
      value: formatCurrency(salesReport?.summary.totalSalesAmount ?? 0),
      description: "Selected orders sales report.",
      href: "/analytics/sales",
    },
    ...(isSuperadmin
      ? [
          {
            title: "Product Sales",
            value: formatCurrency(
              productSalesReport?.summary.totalSalesAmount ?? 0
            ),
            description:
              "Full product-wise sales report across all eligible orders.",
            href: "/analytics/product-sales",
          },
          {
            title: "Customer Sales",
            value: formatCurrency(
              customerSalesReport?.summary.totalSalesAmount ?? 0
            ),
            description:
              "Full customer-wise sales report across all eligible orders.",
            href: "/analytics/customer-sales",
          },
        ]
      : []),
    {
      title: "Expenses",
      value: formatCurrency(expensesReport?.summary.totalExpenseAmount ?? 0),
      description: "Active company expenses for reporting.",
      href: "/finance/expenses",
    },
    {
      title: "Receivables Planning",
      value: formatCurrency(
        receivablesReport?.summary.projectedReceivableAmount ?? 0
      ),
      description:
        "Plan selected-order credit collections by due month and threshold.",
      href: "/finance/receivables",
    },
    {
      title: "Profit & Loss",
      value: formatCurrency(profitLossReport?.summary.netProfitAmount ?? 0),
      description: "Sales minus expenses for the selected period.",
      href: "/finance/profit-loss",
      tone:
        (profitLossReport?.summary.netProfitAmount ?? 0) > 0
          ? "green"
          : (profitLossReport?.summary.netProfitAmount ?? 0) < 0
            ? "red"
            : "gray",
    },
  ];

  return (
    <main className="p-6 font-sans text-black">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-black">
          Analytics Overview
        </h1>
        <p className="mt-1 text-sm font-medium text-stone-500">
          A complete view of sales, expenses, profit, customers, and products.
        </p>
      </div>

      <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DateInput
            label="Date From"
            value={filters.dateFrom}
            onChange={(value) =>
              setFilters((current) => ({ ...current, dateFrom: value }))
            }
          />
          <DateInput
            label="Date To"
            value={filters.dateTo}
            onChange={(value) =>
              setFilters((current) => ({ ...current, dateTo: value }))
            }
          />
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setAppliedFilters(filters)}
              className="w-full rounded-xl bg-[#FFBF01] px-4 py-2.5 text-sm font-bold text-black shadow-sm transition hover:bg-[#efb301]"
            >
              Apply
            </button>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setFilters(emptyFilters);
                setAppliedFilters(emptyFilters);
              }}
              className="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-bold text-stone-700 transition hover:bg-stone-50"
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <ReportCard key={card.href} card={card} />
        ))}
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Sales, Expenses & Profit Trend"
          description="Daily sales, expenses, and net profit."
        >
          <SalesLineChart
            data={profitLossReport?.dailyProfitLoss ?? []}
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

        <ChartCard title="VAT vs NON-VAT Sales">
          <BreakdownPieChart
            data={[
              {
                name: "VAT",
                amount: preferredSalesReport?.summary.vatSalesAmount ?? 0,
              },
              {
                name: "NON-VAT",
                amount: preferredSalesReport?.summary.nonVatSalesAmount ?? 0,
              },
            ]}
            nameKey="name"
            valueKey="amount"
          />
        </ChartCard>

        <ChartCard title="Expense Categories">
          <BreakdownPieChart
            data={(expensesReport?.categoryBreakdown ?? []).map((row) => ({
              name: row.category,
              amount: row.amount,
            }))}
            nameKey="name"
            valueKey="amount"
          />
        </ChartCard>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-lg font-bold text-black">Quick Reports</h2>
          {isLoading ? (
            <SkeletonBlock className="h-4 w-36" />
          ) : (
            <p className="text-sm font-medium text-stone-500">
              Open report details.
            </p>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <ReportCard key={`quick-${card.href}`} card={card} />
          ))}
        </div>
      </section>
    </main>
  );
}

function ReportCard({ card }: { card: ReportCard }) {
  const valueClass = {
    green: "text-emerald-800",
    red: "text-red-800",
    gray: "text-black",
  }[card.tone ?? "gray"];

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="min-h-32">
        <h3 className="text-base font-bold text-black">{card.title}</h3>
        <p className={`mt-3 text-2xl font-bold ${valueClass}`}>
          {card.value}
        </p>
        <p className="mt-2 text-sm font-medium text-stone-500">
          {card.description}
        </p>
      </div>
      <Link
        href={card.href}
        className="mt-5 inline-flex rounded-xl bg-[#FFBF01] px-4 py-2.5 text-sm font-bold text-black shadow-sm transition hover:bg-[#efb301]"
      >
        View Report
      </Link>
    </article>
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
