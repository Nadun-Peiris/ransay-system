"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BreakdownPieChart } from "@/components/charts/breakdown-pie-chart";
import { ChartCard } from "@/components/charts/chart-card";
import { RankingBarChart } from "@/components/charts/ranking-bar-chart";
import { SalesLineChart } from "@/components/charts/sales-line-chart";
import { SkeletonTable } from "@/components/skeleton";
import { showToast } from "@/components/toast-provider";

type OrderType = "VAT" | "NON_VAT";
type PaymentStatus = "PENDING" | "DUE" | "OVERDUE" | "PAID";

type ProductOption = {
  id: string;
  productName: string;
  sku: string | null;
};

type CurrentUser = {
  id: string;
  name: string;
  email: string | null;
  role: "ADMIN" | "SUPERADMIN";
};

type ProductSalesReport = {
  mode: "FULL_PRODUCT_SALES" | "SELECTED_PRODUCT_SALES";
  summary: {
    totalSalesAmount: number;
    vatSalesAmount: number;
    nonVatSalesAmount: number;
    totalOrderCount: number;
    totalQuantitySold: number;
    totalBagsSold: number;
    totalKgSold: number;
    averageSellingPrice: number;
    topSellingProductName: string | null;
    totalCostLkr: number;
    grossProfitLkr: number;
    grossProfitMarginPercentage: number;
  };
  productSales: {
    productId: string;
    productName: string;
    sku: string | null;
    vatSalesAmount: number;
    nonVatSalesAmount: number;
    totalSalesAmount: number;
    orderCount: number;
    quantitySold: number;
    bagsSold: number;
    kgSold: number;
    averageSellingPrice: number;
    totalCostLkr: number;
    grossProfitLkr: number;
    grossProfitMarginPercentage: number;
  }[];
  orderTypeBreakdown: {
    vatSalesAmount: number;
    nonVatSalesAmount: number;
    vatOrderCount: number;
    nonVatOrderCount: number;
  };
  dailyProductSales: {
    date: string;
    totalSalesAmount: number;
    vatSalesAmount: number;
    nonVatSalesAmount: number;
    bagsSold: number;
    kgSold: number;
    orderCount: number;
  }[];
  recentProductSales: {
    orderId: string;
    orderDisplayId: string;
    productName: string;
    customerName: string;
    orderType: OrderType;
    quantitySold: number;
    bagsSold: number;
    kgSold: number;
    totalAmount: number;
    totalCostLkr: number;
    grossProfitLkr: number;
    paymentStatus: PaymentStatus;
    orderDate: string;
    createdAt: string;
  }[];
};

type FilterState = {
  dateFrom: string;
  dateTo: string;
  orderType: string;
  paymentStatus: string;
  productId: string;
  createdByRole: string;
};

const emptyFilters: FilterState = {
  dateFrom: "",
  dateTo: "",
  orderType: "",
  paymentStatus: "",
  productId: "",
  createdByRole: "",
};

function formatMoney(value: number) {
  return `Rs ${value.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value: number) {
  return value.toLocaleString("en-LK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function getBadgeClass(type: "green" | "yellow" | "red" | "blue" | "gray") {
  const classes = {
    green: "bg-emerald-100 text-emerald-800",
    yellow: "bg-[#FFBF01]/20 text-yellow-900",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
    gray: "bg-stone-200 text-stone-700",
  };

  return classes[type];
}

function getPaymentBadgeColor(status: PaymentStatus) {
  if (status === "PAID") return "green";
  if (status === "DUE") return "yellow";
  if (status === "OVERDUE") return "red";
  return "gray";
}

function buildReportQuery(filters: FilterState) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) {
      params.set(key, value.trim());
    }
  }

  return params.toString();
}

export default function ProductSalesPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [report, setReport] = useState<ProductSalesReport | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterState>(emptyFilters);
  const [isLoading, setIsLoading] = useState(true);

  const queryString = useMemo(
    () => buildReportQuery(appliedFilters),
    [appliedFilters]
  );

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

      if (user.role !== "SUPERADMIN") {
        router.replace("/analytics/sales");
        return;
      }

      setCurrentUser(user);

      const [reportResponse, productsResponse] = await Promise.all([
        fetch(`/api/reports/product-sales${queryString ? `?${queryString}` : ""}`),
        fetch("/api/products?limit=100"),
      ]);
      const reportResult = await reportResponse.json();
      const productsResult = await productsResponse.json();

      if (reportResponse.status === 403) {
        router.replace("/analytics/sales");
        return;
      }

      if (!reportResponse.ok || !reportResult.success) {
        throw new Error(
          reportResult.message || "Failed to load product sales report."
        );
      }

      if (!productsResponse.ok || !productsResult.success) {
        throw new Error(productsResult.message || "Failed to load products.");
      }

      setReport(reportResult.data as ProductSalesReport);
      setProducts(productsResult.data as ProductOption[]);
    } catch (error) {
      console.error("Failed to load product sales:", error);
      showToast(
        error instanceof Error
          ? error.message
          : "Failed to load product sales.",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  }, [queryString, router]);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchReport();
    });
  }, [fetchReport]);

  return (
    <main className="p-6 font-sans text-black">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-black">
          Product Sales
        </h1>
        <p className="mt-1 text-sm font-medium text-stone-500">
          Full product-wise sales report across all eligible orders.
        </p>
      </div>

      <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
          <FilterSelect
            label="Product"
            value={filters.productId}
            onChange={(value) => updateFilter("productId", value)}
            allLabel="All Products"
            options={products.map((product) => [
              product.id,
              product.sku
                ? `${product.productName} (${product.sku})`
                : product.productName,
            ])}
          />
          {currentUser?.role === "SUPERADMIN" && (
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

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Product Sales"
          value={formatMoney(report?.summary.totalSalesAmount ?? 0)}
        />
        <SummaryCard
          label="VAT Sales"
          value={formatMoney(report?.summary.vatSalesAmount ?? 0)}
        />
        <SummaryCard
          label="NON-VAT Sales"
          value={formatMoney(report?.summary.nonVatSalesAmount ?? 0)}
        />
        <SummaryCard
          label="Total Orders"
          value={(report?.summary.totalOrderCount ?? 0).toLocaleString("en-LK")}
        />
        <SummaryCard
          label="Bags Sold"
          value={formatNumber(report?.summary.totalBagsSold ?? 0)}
        />
        <SummaryCard
          label="KG Sold"
          value={formatNumber(report?.summary.totalKgSold ?? 0)}
        />
        <SummaryCard
          label="Average Selling Price"
          value={formatMoney(report?.summary.averageSellingPrice ?? 0)}
        />
        <SummaryCard
          label="Top Selling Product"
          value={report?.summary.topSellingProductName ?? "None"}
        />
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-2">
        <BreakdownPanel
          title="Product Sales Summary"
          rows={[
            {
              label: "Total Quantity Sold",
              value: formatNumber(report?.summary.totalQuantitySold ?? 0),
            },
            {
              label: "Report Mode",
              value:
                report?.mode === "FULL_PRODUCT_SALES"
                  ? "Full product sales"
                  : "Selected product sales",
            },
          ]}
        />
        <BreakdownPanel
          title="VAT vs NON-VAT Breakdown"
          rows={[
            {
              label: "VAT",
              value: `${formatMoney(
                report?.orderTypeBreakdown.vatSalesAmount ?? 0
              )} / ${(report?.orderTypeBreakdown.vatOrderCount ?? 0).toLocaleString(
                "en-LK"
              )} orders`,
            },
            {
              label: "NON-VAT",
              value: `${formatMoney(
                report?.orderTypeBreakdown.nonVatSalesAmount ?? 0
              )} / ${(
                report?.orderTypeBreakdown.nonVatOrderCount ?? 0
              ).toLocaleString("en-LK")} orders`,
            },
          ]}
        />
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Daily Product Sales"
          description="Product sales trend split by VAT and NON-VAT orders."
        >
          <SalesLineChart
            data={report?.dailyProductSales ?? []}
            lines={[
              {
                key: "totalSalesAmount",
                name: "Total Sales",
                color: "#2563eb",
              },
              { key: "vatSalesAmount", name: "VAT Sales", color: "#16a34a" },
              {
                key: "nonVatSalesAmount",
                name: "NON-VAT Sales",
                color: "#6b7280",
              },
            ]}
          />
        </ChartCard>

        <ChartCard title="VAT vs NON-VAT Product Sales">
          <BreakdownPieChart
            data={[
              {
                name: "VAT",
                amount: report?.orderTypeBreakdown.vatSalesAmount ?? 0,
              },
              {
                name: "NON-VAT",
                amount: report?.orderTypeBreakdown.nonVatSalesAmount ?? 0,
              },
            ]}
            nameKey="name"
            valueKey="amount"
          />
        </ChartCard>

        <ChartCard title="Top Products">
          <RankingBarChart
            data={(report?.productSales ?? []).slice(0, 10).map((row) => ({
              productName: row.productName,
              totalSalesAmount: row.totalSalesAmount,
            }))}
            xKey="productName"
            yKey="totalSalesAmount"
            layout="vertical"
          />
        </ChartCard>

        <ChartCard title="Top Product Quantity">
          <RankingBarChart
            data={(report?.productSales ?? []).slice(0, 10).map((row) => ({
              productName: row.productName,
              kgSold: row.kgSold,
            }))}
            xKey="productName"
            yKey="kgSold"
            layout="vertical"
            valueType="number"
          />
        </ChartCard>
      </section>

      <ProductSalesTable
        rows={report?.productSales ?? []}
        isLoading={isLoading}
      />
      <DailyProductSalesTable
        rows={report?.dailyProductSales ?? []}
        isLoading={isLoading}
      />
      <RecentProductSalesTable
        rows={report?.recentProductSales ?? []}
        isLoading={isLoading}
      />
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-black">{value}</p>
    </div>
  );
}

function BreakdownPanel({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-black">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 border-b border-stone-100 pb-3 last:border-b-0 last:pb-0"
          >
            <p className="text-sm font-bold text-black">{row.label}</p>
            <p className="text-right text-sm font-bold text-black">
              {row.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProductSalesTable({
  rows,
  isLoading,
}: {
  rows: ProductSalesReport["productSales"];
  isLoading: boolean;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
        <h2 className="text-base font-bold text-black">Product Sales Table</h2>
      </div>
      {isLoading && rows.length === 0 ? (
        <EmptyState label="Loading product sales..." />
      ) : rows.length === 0 ? (
        <EmptyState label="No product sales found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="p-4 font-medium">Product</th>
                <th className="p-4 font-medium">SKU</th>
                <th className="p-4 font-medium">VAT Sales</th>
                <th className="p-4 font-medium">NON-VAT Sales</th>
                <th className="p-4 font-medium">Total Sales</th>
                <th className="p-4 font-medium">Cost</th>
                <th className="p-4 font-medium">Gross Profit</th>
                <th className="p-4 font-medium">Margin</th>
                <th className="p-4 font-medium">Orders</th>
                <th className="p-4 font-medium">Bags Sold</th>
                <th className="p-4 font-medium">KG Sold</th>
                <th className="p-4 font-medium">Avg Price/KG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.productId} className="transition-colors hover:bg-stone-50/60">
                  <td className="p-4 font-bold text-black">{row.productName}</td>
                  <td className="p-4 text-stone-600">{row.sku ?? "-"}</td>
                  <td className="p-4 text-stone-700">{formatMoney(row.vatSalesAmount)}</td>
                  <td className="p-4 text-stone-700">{formatMoney(row.nonVatSalesAmount)}</td>
                  <td className="p-4 font-bold text-black">{formatMoney(row.totalSalesAmount)}</td>
                  <td className="p-4 text-stone-700">{formatMoney(row.totalCostLkr)}</td>
                  <td className="p-4 font-bold text-black">{formatMoney(row.grossProfitLkr)}</td>
                  <td className="p-4 text-stone-700">{formatNumber(row.grossProfitMarginPercentage)}%</td>
                  <td className="p-4 text-stone-700">{row.orderCount}</td>
                  <td className="p-4 text-stone-700">{formatNumber(row.bagsSold)}</td>
                  <td className="p-4 text-stone-700">{formatNumber(row.kgSold)}</td>
                  <td className="p-4 font-bold text-black">{formatMoney(row.averageSellingPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DailyProductSalesTable({
  rows,
  isLoading,
}: {
  rows: ProductSalesReport["dailyProductSales"];
  isLoading: boolean;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
        <h2 className="text-base font-bold text-black">Daily Product Sales</h2>
      </div>
      {isLoading && rows.length === 0 ? (
        <EmptyState label="Loading daily product sales..." />
      ) : rows.length === 0 ? (
        <EmptyState label="No daily product sales found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Total Sales</th>
                <th className="p-4 font-medium">VAT Sales</th>
                <th className="p-4 font-medium">NON-VAT Sales</th>
                <th className="p-4 font-medium">Bags Sold</th>
                <th className="p-4 font-medium">KG Sold</th>
                <th className="p-4 font-medium">Orders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.date} className="transition-colors hover:bg-stone-50/60">
                  <td className="p-4 font-medium text-black">{row.date}</td>
                  <td className="p-4 font-bold text-black">{formatMoney(row.totalSalesAmount)}</td>
                  <td className="p-4 text-stone-700">{formatMoney(row.vatSalesAmount)}</td>
                  <td className="p-4 text-stone-700">{formatMoney(row.nonVatSalesAmount)}</td>
                  <td className="p-4 text-stone-700">{formatNumber(row.bagsSold)}</td>
                  <td className="p-4 text-stone-700">{formatNumber(row.kgSold)}</td>
                  <td className="p-4 text-stone-700">{row.orderCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RecentProductSalesTable({
  rows,
  isLoading,
}: {
  rows: ProductSalesReport["recentProductSales"];
  isLoading: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
        <h2 className="text-base font-bold text-black">Recent Product Sales</h2>
      </div>
      {isLoading && rows.length === 0 ? (
        <EmptyState label="Loading recent product sales..." />
      ) : rows.length === 0 ? (
        <EmptyState label="No recent product sales found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="p-4 font-medium">Order</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Product</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Bags</th>
                <th className="p-4 font-medium">KG</th>
                <th className="p-4 font-medium">Total</th>
                <th className="p-4 font-medium">Payment</th>
                <th className="p-4 font-medium">Order Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr
                  key={`${row.orderId}-${row.productName}-${row.orderDate}`}
                  className="transition-colors hover:bg-stone-50/60"
                >
                  <td className="p-4">
                    <Link
                      href={`/orders/${row.orderId}`}
                      className="font-bold text-black underline decoration-transparent underline-offset-4 transition-colors hover:text-[#C8942A] hover:decoration-[#C8942A]"
                    >
                      {row.orderDisplayId}
                    </Link>
                  </td>
                  <td className="p-4 font-medium text-black">{row.customerName}</td>
                  <td className="p-4 text-stone-700">{row.productName}</td>
                  <td className="p-4">
                    <Badge
                      label={row.orderType === "VAT" ? "VAT" : "NON-VAT"}
                      color={row.orderType === "VAT" ? "blue" : "gray"}
                    />
                  </td>
                  <td className="p-4 text-stone-700">{formatNumber(row.bagsSold)}</td>
                  <td className="p-4 text-stone-700">{formatNumber(row.kgSold)}</td>
                  <td className="p-4 font-bold text-black">{formatMoney(row.totalAmount)}</td>
                  <td className="p-4">
                    <Badge
                      label={row.paymentStatus}
                      color={getPaymentBadgeColor(row.paymentStatus)}
                    />
                  </td>
                  <td className="p-4 font-medium text-stone-500">
                    {new Date(row.orderDate).toLocaleDateString("en-LK", {
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

function Badge({
  label,
  color,
}: {
  label: string;
  color: "green" | "yellow" | "red" | "blue" | "gray";
}) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${getBadgeClass(
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
  allLabel = "All",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  allLabel?: string;
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
        <option value="">{allLabel}</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
