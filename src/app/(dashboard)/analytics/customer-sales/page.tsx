"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BreakdownPieChart } from "@/components/charts/breakdown-pie-chart";
import { ChartCard } from "@/components/charts/chart-card";
import { RankingBarChart } from "@/components/charts/ranking-bar-chart";
import { SalesLineChart } from "@/components/charts/sales-line-chart";

type OrderType = "VAT" | "NON_VAT";
type PaymentStatus = "PENDING" | "DUE" | "OVERDUE" | "PAID";
type FulfillmentStatus = "UNFULFILLED" | "FULFILLED";
type DeliveryStatus = "NOT_DISPATCHED" | "DISPATCHED" | "DELIVERED";
type OrderStatus = "ACTIVE" | "COMPLETED" | "CANCELLED" | "DELETED";

type CurrentUser = {
  id: string;
  name: string;
  email: string | null;
  role: "ADMIN" | "SUPERADMIN";
};

type CustomerOption = {
  id: string;
  customerName: string;
  customerCode: string | null;
};

type CustomerSalesReport = {
  mode: "FULL_CUSTOMER_SALES" | "SELECTED_CUSTOMER_SALES";
  summary: {
    totalSalesAmount: number;
    vatSalesAmount: number;
    nonVatSalesAmount: number;
    totalOrderCount: number;
    totalCustomerCount: number;
    averageOrderValue: number;
    topCustomerName: string | null;
  };
  customerSales: {
    customerId: string;
    customerName: string;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
    customerType: OrderType;
    vatNumber: string | null;
    vatSalesAmount: number;
    nonVatSalesAmount: number;
    totalSalesAmount: number;
    orderCount: number;
    averageOrderValue: number;
    lastOrderDate: string;
  }[];
  orderTypeBreakdown: {
    vatSalesAmount: number;
    nonVatSalesAmount: number;
    vatOrderCount: number;
    nonVatOrderCount: number;
  };
  paymentBreakdown: {
    paidAmount: number;
    pendingAmount: number;
    dueAmount: number;
    overdueAmount: number;
    paidCount: number;
    pendingCount: number;
    dueCount: number;
    overdueCount: number;
  };
  dailyCustomerSales: {
    date: string;
    totalSalesAmount: number;
    vatSalesAmount: number;
    nonVatSalesAmount: number;
    orderCount: number;
    customerCount: number;
  }[];
  recentCustomerSales: {
    id: string;
    orderId: string;
    vatOrderId: string | null;
    nonVatOrderId: string | null;
    customerId: string;
    customerName: string;
    orderType: OrderType;
    totalAmount: number;
    paymentStatus: PaymentStatus;
    fulfillmentStatus: FulfillmentStatus;
    deliveryStatus: DeliveryStatus;
    orderStatus: OrderStatus;
    createdAt: string;
  }[];
};

type FilterState = {
  dateFrom: string;
  dateTo: string;
  orderType: string;
  paymentStatus: string;
  customerId: string;
  createdByRole: string;
};

const emptyFilters: FilterState = {
  dateFrom: "",
  dateTo: "",
  orderType: "",
  paymentStatus: "",
  customerId: "",
  createdByRole: "",
};

function formatMoney(value: number) {
  return `Rs ${value.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatEnumLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
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

function getFulfillmentBadgeColor(status: FulfillmentStatus) {
  if (status === "FULFILLED") return "blue";
  return "gray";
}

function getDeliveryBadgeColor(status: DeliveryStatus) {
  if (status === "DELIVERED") return "green";
  if (status === "DISPATCHED") return "blue";
  return "gray";
}

function getOrderBadgeColor(status: OrderStatus) {
  if (status === "COMPLETED") return "green";
  if (status === "CANCELLED" || status === "DELETED") return "red";
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

export default function CustomerSalesPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [report, setReport] = useState<CustomerSalesReport | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
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

      const [meResponse, reportResponse, customersResponse] =
        await Promise.all([
          fetch("/api/auth/me"),
          fetch(
            `/api/reports/customer-sales${queryString ? `?${queryString}` : ""}`
          ),
          fetch("/api/customers?status=all&limit=100"),
        ]);
      const meResult = await meResponse.json();
      const reportResult = await reportResponse.json();
      const customersResult = await customersResponse.json();

      if (!meResponse.ok || !meResult.success) {
        throw new Error(meResult.message || "Failed to load current user.");
      }

      if (!reportResponse.ok || !reportResult.success) {
        throw new Error(
          reportResult.message || "Failed to load customer sales report."
        );
      }

      if (!customersResponse.ok || !customersResult.success) {
        throw new Error(customersResult.message || "Failed to load customers.");
      }

      setCurrentUser(meResult.data as CurrentUser);
      setReport(reportResult.data as CustomerSalesReport);
      setCustomers(customersResult.data as CustomerOption[]);
    } catch (error) {
      console.error("Failed to load customer sales:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to load customer sales."
      );
    } finally {
      setIsLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  return (
    <main className="p-6 font-sans text-black">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-black">
          Customer Sales
        </h1>
        <p className="mt-1 text-sm font-medium text-stone-500">
          Track customer-wise sales, VAT/NON-VAT performance, and order value.
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
            label="Customer"
            value={filters.customerId}
            onChange={(value) => updateFilter("customerId", value)}
            allLabel="All Customers"
            options={customers.map((customer) => [
              customer.id,
              customer.customerCode
                ? `${customer.customerName} (${customer.customerCode})`
                : customer.customerName,
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
          label="Total Customer Sales"
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
          label="Total Customers"
          value={(report?.summary.totalCustomerCount ?? 0).toLocaleString(
            "en-LK"
          )}
        />
        <SummaryCard
          label="Average Order Value"
          value={formatMoney(report?.summary.averageOrderValue ?? 0)}
        />
        <SummaryCard
          label="Top Customer"
          value={report?.summary.topCustomerName ?? "None"}
        />
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-3">
        <BreakdownPanel
          title="Customer Sales Summary"
          rows={[
            {
              label: "Report Mode",
              value:
                report?.mode === "FULL_CUSTOMER_SALES"
                  ? "Full customer sales"
                  : "Selected customer sales",
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
        <BreakdownPanel
          title="Payment Breakdown"
          rows={[
            {
              label: "Paid",
              value: `${formatMoney(
                report?.paymentBreakdown.paidAmount ?? 0
              )} / ${(report?.paymentBreakdown.paidCount ?? 0).toLocaleString(
                "en-LK"
              )} orders`,
            },
            {
              label: "Pending",
              value: `${formatMoney(
                report?.paymentBreakdown.pendingAmount ?? 0
              )} / ${(
                report?.paymentBreakdown.pendingCount ?? 0
              ).toLocaleString("en-LK")} orders`,
            },
            {
              label: "Due",
              value: `${formatMoney(
                report?.paymentBreakdown.dueAmount ?? 0
              )} / ${(report?.paymentBreakdown.dueCount ?? 0).toLocaleString(
                "en-LK"
              )} orders`,
            },
            {
              label: "Overdue",
              value: `${formatMoney(
                report?.paymentBreakdown.overdueAmount ?? 0
              )} / ${(
                report?.paymentBreakdown.overdueCount ?? 0
              ).toLocaleString("en-LK")} orders`,
            },
          ]}
        />
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Daily Customer Sales"
          description="Customer sales trend split by VAT and NON-VAT orders."
        >
          <SalesLineChart
            data={report?.dailyCustomerSales ?? []}
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

        <ChartCard title="VAT vs NON-VAT Customer Sales">
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

        <ChartCard title="Payment Breakdown">
          <BreakdownPieChart
            data={[
              { name: "Paid", amount: report?.paymentBreakdown.paidAmount ?? 0 },
              {
                name: "Pending",
                amount: report?.paymentBreakdown.pendingAmount ?? 0,
              },
              { name: "Due", amount: report?.paymentBreakdown.dueAmount ?? 0 },
              {
                name: "Overdue",
                amount: report?.paymentBreakdown.overdueAmount ?? 0,
              },
            ]}
            nameKey="name"
            valueKey="amount"
          />
        </ChartCard>

        <ChartCard title="Top Customers">
          <RankingBarChart
            data={(report?.customerSales ?? []).slice(0, 10).map((row) => ({
              customerName: row.customerName,
              totalSalesAmount: row.totalSalesAmount,
            }))}
            xKey="customerName"
            yKey="totalSalesAmount"
            layout="vertical"
          />
        </ChartCard>
      </section>

      <CustomerSalesTable
        rows={report?.customerSales ?? []}
        isLoading={isLoading}
      />
      <DailyCustomerSalesTable
        rows={report?.dailyCustomerSales ?? []}
        isLoading={isLoading}
      />
      <RecentCustomerSalesTable
        rows={report?.recentCustomerSales ?? []}
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

function CustomerSalesTable({
  rows,
  isLoading,
}: {
  rows: CustomerSalesReport["customerSales"];
  isLoading: boolean;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
        <h2 className="text-base font-bold text-black">Customer Sales Table</h2>
      </div>
      {isLoading && rows.length === 0 ? (
        <EmptyState label="Loading customer sales..." />
      ) : rows.length === 0 ? (
        <EmptyState label="No customer sales found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Contact Person</th>
                <th className="p-4 font-medium">Phone</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">VAT No</th>
                <th className="p-4 font-medium">VAT Sales</th>
                <th className="p-4 font-medium">NON-VAT Sales</th>
                <th className="p-4 font-medium">Total Sales</th>
                <th className="p-4 font-medium">Orders</th>
                <th className="p-4 font-medium">Avg Order</th>
                <th className="p-4 font-medium">Last Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.customerId} className="transition-colors hover:bg-stone-50/60">
                  <td className="p-4">
                    <Link
                      href={`/customers/${row.customerId}`}
                      className="font-bold text-black underline decoration-transparent underline-offset-4 transition-colors hover:text-[#C8942A] hover:decoration-[#C8942A]"
                    >
                      {row.customerName}
                    </Link>
                    {row.email && (
                      <p className="mt-0.5 text-xs text-stone-500">{row.email}</p>
                    )}
                  </td>
                  <td className="p-4 text-stone-700">
                    {row.contactPerson ?? "-"}
                  </td>
                  <td className="p-4 text-stone-700">{row.phone ?? "-"}</td>
                  <td className="p-4">
                    <Badge
                      label={row.customerType === "VAT" ? "VAT" : "NON-VAT"}
                      color={row.customerType === "VAT" ? "blue" : "gray"}
                    />
                  </td>
                  <td className="p-4 text-stone-700">{row.vatNumber ?? "-"}</td>
                  <td className="p-4 text-stone-700">{formatMoney(row.vatSalesAmount)}</td>
                  <td className="p-4 text-stone-700">{formatMoney(row.nonVatSalesAmount)}</td>
                  <td className="p-4 font-bold text-black">{formatMoney(row.totalSalesAmount)}</td>
                  <td className="p-4 text-stone-700">{row.orderCount}</td>
                  <td className="p-4 font-bold text-black">{formatMoney(row.averageOrderValue)}</td>
                  <td className="p-4 text-stone-600">
                    {new Date(row.lastOrderDate).toLocaleDateString("en-LK", {
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

function DailyCustomerSalesTable({
  rows,
  isLoading,
}: {
  rows: CustomerSalesReport["dailyCustomerSales"];
  isLoading: boolean;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
        <h2 className="text-base font-bold text-black">Daily Customer Sales</h2>
      </div>
      {isLoading && rows.length === 0 ? (
        <EmptyState label="Loading daily customer sales..." />
      ) : rows.length === 0 ? (
        <EmptyState label="No daily customer sales found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Total Sales</th>
                <th className="p-4 font-medium">VAT Sales</th>
                <th className="p-4 font-medium">NON-VAT Sales</th>
                <th className="p-4 font-medium">Orders</th>
                <th className="p-4 font-medium">Customers</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.date} className="transition-colors hover:bg-stone-50/60">
                  <td className="p-4 font-medium text-black">{row.date}</td>
                  <td className="p-4 font-bold text-black">{formatMoney(row.totalSalesAmount)}</td>
                  <td className="p-4 text-stone-700">{formatMoney(row.vatSalesAmount)}</td>
                  <td className="p-4 text-stone-700">{formatMoney(row.nonVatSalesAmount)}</td>
                  <td className="p-4 text-stone-700">{row.orderCount}</td>
                  <td className="p-4 text-stone-700">{row.customerCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RecentCustomerSalesTable({
  rows,
  isLoading,
}: {
  rows: CustomerSalesReport["recentCustomerSales"];
  isLoading: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
        <h2 className="text-base font-bold text-black">Recent Customer Sales</h2>
      </div>
      {isLoading && rows.length === 0 ? (
        <EmptyState label="Loading recent customer sales..." />
      ) : rows.length === 0 ? (
        <EmptyState label="No recent customer sales found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="p-4 font-medium">Order</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Total</th>
                <th className="p-4 font-medium">Payment</th>
                <th className="p-4 font-medium">Fulfillment</th>
                <th className="p-4 font-medium">Delivery</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Created</th>
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
                  <td className="p-4">
                    <Link
                      href={`/customers/${order.customerId}`}
                      className="font-medium text-black underline decoration-transparent underline-offset-4 transition-colors hover:text-[#C8942A] hover:decoration-[#C8942A]"
                    >
                      {order.customerName}
                    </Link>
                  </td>
                  <td className="p-4">
                    <Badge
                      label={order.orderType === "VAT" ? "VAT" : "NON-VAT"}
                      color={order.orderType === "VAT" ? "blue" : "gray"}
                    />
                  </td>
                  <td className="p-4 font-bold text-black">{formatMoney(order.totalAmount)}</td>
                  <td className="p-4">
                    <Badge
                      label={order.paymentStatus}
                      color={getPaymentBadgeColor(order.paymentStatus)}
                    />
                  </td>
                  <td className="p-4">
                    <Badge
                      label={order.fulfillmentStatus}
                      color={getFulfillmentBadgeColor(order.fulfillmentStatus)}
                    />
                  </td>
                  <td className="p-4">
                    <Badge
                      label={order.deliveryStatus}
                      color={getDeliveryBadgeColor(order.deliveryStatus)}
                    />
                  </td>
                  <td className="p-4">
                    <Badge
                      label={order.orderStatus}
                      color={getOrderBadgeColor(order.orderStatus)}
                    />
                  </td>
                  <td className="p-4 font-medium text-stone-500">
                    {new Date(order.createdAt).toLocaleDateString("en-LK", {
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
