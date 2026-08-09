/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BreakdownPieChart } from "@/components/charts/breakdown-pie-chart";
import { ChartCard } from "@/components/charts/chart-card";
import { RankingBarChart } from "@/components/charts/ranking-bar-chart";
import { SalesLineChart } from "@/components/charts/sales-line-chart";

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

type ExpenseStatus = "ACTIVE" | "DELETED";
type CreatedByRole = "ADMIN" | "SUPERADMIN";

type ExpenseRow = {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  paymentMethod: ExpensePaymentMethod;
  notes: string | null;
  status: ExpenseStatus;
  createdByRole: CreatedByRole | null;
  createdAt: string;
};

type ExpensesMeta = {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
};

type ExpensesReport = {
  summary: {
    totalExpenseAmount: number;
    totalExpenseCount: number;
    averageExpenseAmount: number;
  };
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
  dailyExpenses: {
    date: string;
    amount: number;
    count: number;
  }[];
  recentExpenses: ExpenseRow[];
};

type FilterState = {
  q: string;
  dateFrom: string;
  dateTo: string;
  category: string;
  paymentMethod: string;
  status: string;
};

type ExpenseFormState = {
  title: string;
  category: ExpenseCategory;
  amount: string;
  expenseDate: string;
  paymentMethod: ExpensePaymentMethod;
  notes: string;
};

const categories: ExpenseCategory[] = [
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

const paymentMethods: ExpensePaymentMethod[] = [
  "CASH",
  "BANK_TRANSFER",
  "CARD",
  "CHEQUE",
  "OTHER",
];

const emptyFilters: FilterState = {
  q: "",
  dateFrom: "",
  dateTo: "",
  category: "",
  paymentMethod: "",
  status: "active",
};

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function getEmptyForm(): ExpenseFormState {
  return {
    title: "",
    category: "TRANSPORT",
    amount: "",
    expenseDate: getTodayInputValue(),
    paymentMethod: "CASH",
    notes: "",
  };
}

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

function getBadgeClass(type: "green" | "red" | "blue" | "gray") {
  const classes = {
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
    gray: "bg-stone-200 text-stone-700",
  };

  return classes[type];
}

function buildExpensesQuery(filters: FilterState, page: number) {
  const params = new URLSearchParams({
    page: String(page),
    limit: "20",
  });

  for (const [key, value] of Object.entries(filters)) {
    if (value.trim()) {
      params.set(key, value.trim());
    }
  }

  return params.toString();
}

function buildReportQuery(filters: FilterState) {
  const params = new URLSearchParams();

  for (const key of ["dateFrom", "dateTo", "category", "paymentMethod"] as const) {
    const value = filters[key];

    if (value.trim()) {
      params.set(key, value.trim());
    }
  }

  return params.toString();
}

function expenseToForm(expense: ExpenseRow): ExpenseFormState {
  return {
    title: expense.title,
    category: expense.category,
    amount: String(expense.amount),
    expenseDate: new Date(expense.expenseDate).toISOString().slice(0, 10),
    paymentMethod: expense.paymentMethod,
    notes: expense.notes ?? "",
  };
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [meta, setMeta] = useState<ExpensesMeta | null>(null);
  const [report, setReport] = useState<ExpensesReport | null>(null);
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<FilterState>(emptyFilters);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(getEmptyForm);

  const expensesQuery = useMemo(
    () => buildExpensesQuery(appliedFilters, page),
    [appliedFilters, page]
  );
  const reportQuery = useMemo(
    () => buildReportQuery(appliedFilters),
    [appliedFilters]
  );

  const thisMonthExpenses = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;

    return (
      report?.dailyExpenses
        .filter((row) => row.date.startsWith(currentMonth))
        .reduce((sum, row) => sum + row.amount, 0) ?? 0
    );
  }, [report]);

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateForm = (key: keyof ExpenseFormState, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const openCreateForm = () => {
    setEditingExpense(null);
    setForm(getEmptyForm());
    setIsFormOpen(true);
  };

  const openEditForm = (expense: ExpenseRow) => {
    setEditingExpense(expense);
    setForm(expenseToForm(expense));
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingExpense(null);
    setForm(getEmptyForm());
  };

  const applyFilters = () => {
    setAppliedFilters(filters);
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  };

  const fetchExpenses = useCallback(async () => {
    try {
      setIsLoading(true);

      const [expensesResponse, reportResponse] = await Promise.all([
        fetch(`/api/expenses?${expensesQuery}`),
        fetch(`/api/reports/expenses${reportQuery ? `?${reportQuery}` : ""}`),
      ]);
      const expensesResult = await expensesResponse.json();
      const reportResult = await reportResponse.json();

      if (!expensesResponse.ok || !expensesResult.success) {
        throw new Error(expensesResult.message || "Failed to load expenses.");
      }

      if (!reportResponse.ok || !reportResult.success) {
        throw new Error(reportResult.message || "Failed to load expenses report.");
      }

      setExpenses(expensesResult.data);
      setMeta(expensesResult.meta);
      setReport(reportResult.data);
    } catch (error) {
      console.error("Failed to load expenses:", error);
      alert(error instanceof Error ? error.message : "Failed to load expenses.");
    } finally {
      setIsLoading(false);
    }
  }, [expensesQuery, reportQuery]);

  useEffect(() => {
    void fetchExpenses();
  }, [fetchExpenses]);

  async function saveExpense() {
    try {
      setIsSaving(true);

      const response = await fetch(
        editingExpense ? `/api/expenses/${editingExpense.id}` : "/api/expenses",
        {
          method: editingExpense ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: form.title,
            category: form.category,
            amount: Number(form.amount),
            expenseDate: form.expenseDate,
            paymentMethod: form.paymentMethod,
            notes: form.notes,
          }),
        }
      );
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to save expense.");
      }

      closeForm();
      await fetchExpenses();
    } catch (error) {
      console.error("Failed to save expense:", error);
      alert(error instanceof Error ? error.message : "Failed to save expense.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteExpense(expense: ExpenseRow) {
    if (!window.confirm(`Delete expense "${expense.title}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/expenses/${expense.id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to delete expense.");
      }

      await fetchExpenses();
    } catch (error) {
      console.error("Failed to delete expense:", error);
      alert(
        error instanceof Error ? error.message : "Failed to delete expense."
      );
    }
  }

  return (
    <main className="p-6 font-sans text-black">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">
            Expenses
          </h1>
          <p className="mt-1 text-sm font-medium text-stone-500">
            Track company expenses and view expense reports.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-xl bg-[#FFBF01] px-5 py-3 text-sm font-bold text-black shadow-sm transition hover:bg-[#efb301]"
        >
          Add Expense
        </button>
      </div>

      <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <label className="space-y-1.5">
            <span className="text-xs font-bold uppercase text-stone-500">
              Search
            </span>
            <input
              value={filters.q}
              onChange={(event) => updateFilter("q", event.target.value)}
              placeholder="Title or notes"
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
            />
          </label>
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
            label="Category"
            value={filters.category}
            onChange={(value) => updateFilter("category", value)}
            options={categories.map((category) => [
              category,
              formatEnumLabel(category),
            ])}
          />
          <FilterSelect
            label="Payment Method"
            value={filters.paymentMethod}
            onChange={(value) => updateFilter("paymentMethod", value)}
            options={paymentMethods.map((method) => [
              method,
              formatEnumLabel(method),
            ])}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(value) => updateFilter("status", value)}
            options={[
              ["active", "Active"],
              ["deleted", "Deleted"],
              ["all", "All"],
            ]}
            includeAllOption={false}
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

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total Expenses"
          value={formatMoney(report?.summary.totalExpenseAmount ?? 0)}
        />
        <SummaryCard
          label="Expense Count"
          value={(report?.summary.totalExpenseCount ?? 0).toLocaleString("en-LK")}
        />
        <SummaryCard
          label="Average Expense"
          value={formatMoney(report?.summary.averageExpenseAmount ?? 0)}
        />
        <SummaryCard
          label="This Month Expenses"
          value={formatMoney(thisMonthExpenses)}
        />
      </section>

      {isFormOpen && (
        <section className="mb-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-black">
              {editingExpense ? "Edit Expense" : "Add Expense"}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-bold text-stone-700 hover:bg-stone-50"
            >
              Close
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-stone-500">
                Title
              </span>
              <input
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
              />
            </label>
            <FilterSelect
              label="Category"
              value={form.category}
              onChange={(value) =>
                updateForm("category", value as ExpenseCategory)
              }
              options={categories.map((category) => [
                category,
                formatEnumLabel(category),
              ])}
              includeAllOption={false}
            />
            <label className="space-y-1.5">
              <span className="text-xs font-bold uppercase text-stone-500">
                Amount
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) => updateForm("amount", event.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
              />
            </label>
            <DateInput
              label="Expense Date"
              value={form.expenseDate}
              onChange={(value) => updateForm("expenseDate", value)}
            />
            <FilterSelect
              label="Payment Method"
              value={form.paymentMethod}
              onChange={(value) =>
                updateForm("paymentMethod", value as ExpensePaymentMethod)
              }
              options={paymentMethods.map((method) => [
                method,
                formatEnumLabel(method),
              ])}
              includeAllOption={false}
            />
            <label className="space-y-1.5 md:col-span-2 xl:col-span-3">
              <span className="text-xs font-bold uppercase text-stone-500">
                Notes
              </span>
              <textarea
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#C8942A] focus:ring-4 focus:ring-[#FFBF01]/20"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={saveExpense}
              disabled={isSaving}
              className="rounded-xl bg-[#FFBF01] px-5 py-3 text-sm font-bold text-black shadow-sm transition hover:bg-[#efb301] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save Expense"}
            </button>
          </div>
        </section>
      )}

      <section className="mb-6 grid gap-6 xl:grid-cols-2">
        <ChartCard title="Daily Expenses">
          <SalesLineChart
            data={(report?.dailyExpenses ?? []).map((row) => ({
              date: row.date,
              expenseAmount: row.amount,
            }))}
            lines={[
              {
                key: "expenseAmount",
                name: "Expenses",
                color: "#dc2626",
              },
            ]}
          />
        </ChartCard>

        <ChartCard title="Expense Category Breakdown">
          <BreakdownPieChart
            data={(report?.categoryBreakdown ?? []).map((row) => ({
              name: formatEnumLabel(row.category),
              amount: row.amount,
            }))}
            nameKey="name"
            valueKey="amount"
          />
        </ChartCard>

        <ChartCard title="Payment Method Breakdown">
          <BreakdownPieChart
            data={(report?.paymentMethodBreakdown ?? []).map((row) => ({
              name: formatEnumLabel(row.paymentMethod),
              amount: row.amount,
            }))}
            nameKey="name"
            valueKey="amount"
          />
        </ChartCard>

        <ChartCard title="Expense Categories">
          <RankingBarChart
            data={(report?.categoryBreakdown ?? []).map((row) => ({
              category: formatEnumLabel(row.category),
              amount: row.amount,
            }))}
            xKey="category"
            yKey="amount"
            layout="vertical"
          />
        </ChartCard>
      </section>

      <ExpensesTable
        expenses={expenses}
        meta={meta}
        isLoading={isLoading}
        page={page}
        setPage={setPage}
        onEdit={openEditForm}
        onDelete={deleteExpense}
      />

      <section className="mb-6 grid gap-6 xl:grid-cols-2">
        <BreakdownPanel
          title="Category Breakdown"
          rows={(report?.categoryBreakdown ?? []).map((row) => ({
            label: formatEnumLabel(row.category),
            amount: row.amount,
            count: row.count,
          }))}
        />
        <BreakdownPanel
          title="Payment Method Breakdown"
          rows={(report?.paymentMethodBreakdown ?? []).map((row) => ({
            label: formatEnumLabel(row.paymentMethod),
            amount: row.amount,
            count: row.count,
          }))}
        />
      </section>

      <DailyExpensesTable rows={report?.dailyExpenses ?? []} isLoading={isLoading} />
      <RecentExpensesTable rows={report?.recentExpenses ?? []} isLoading={isLoading} />
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

function ExpensesTable({
  expenses,
  meta,
  isLoading,
  page,
  setPage,
  onEdit,
  onDelete,
}: {
  expenses: ExpenseRow[];
  meta: ExpensesMeta | null;
  isLoading: boolean;
  page: number;
  setPage: (value: number | ((current: number) => number)) => void;
  onEdit: (expense: ExpenseRow) => void;
  onDelete: (expense: ExpenseRow) => void;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex flex-col gap-2 border-b border-stone-200 bg-stone-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-base font-bold text-black">Expenses Table</h2>
        <p className="text-sm font-semibold text-stone-700">
          {meta?.totalCount ?? 0} total expense
          {(meta?.totalCount ?? 0) === 1 ? "" : "s"}
        </p>
      </div>
      {isLoading && expenses.length === 0 ? (
        <EmptyState label="Loading expenses..." />
      ) : expenses.length === 0 ? (
        <EmptyState label="No expenses found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-280 text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Title</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Payment Method</th>
                <th className="p-4 font-medium">Created By</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {expenses.map((expense) => (
                <tr key={expense.id} className="transition-colors hover:bg-stone-50/60">
                  <td className="p-4 font-medium text-stone-600">
                    {new Date(expense.expenseDate).toLocaleDateString("en-LK", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="p-4">
                    <p className="font-bold text-black">{expense.title}</p>
                    {expense.notes && (
                      <p className="mt-0.5 max-w-60 truncate text-xs text-stone-500">
                        {expense.notes}
                      </p>
                    )}
                  </td>
                  <td className="p-4">
                    <Badge label={formatEnumLabel(expense.category)} color="blue" />
                  </td>
                  <td className="p-4 font-bold text-black">
                    {formatMoney(expense.amount)}
                  </td>
                  <td className="p-4">
                    <Badge
                      label={formatEnumLabel(expense.paymentMethod)}
                      color="gray"
                    />
                  </td>
                  <td className="p-4 text-stone-700">
                    {expense.createdByRole ?? "Unknown"}
                  </td>
                  <td className="p-4">
                    <Badge
                      label={expense.status}
                      color={expense.status === "ACTIVE" ? "green" : "red"}
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(expense)}
                        disabled={expense.status === "DELETED"}
                        className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(expense)}
                        disabled={expense.status === "DELETED"}
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {meta && (
        <div className="flex flex-col gap-3 border-t border-stone-200 p-4 md:flex-row md:items-center md:justify-between">
          <button
            type="button"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <p className="text-center text-sm text-stone-500">
            Page {meta.page} of {Math.max(meta.totalPages, 1)}
          </p>
          <button
            type="button"
            disabled={page >= meta.totalPages || isLoading}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}

function BreakdownPanel({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; amount: number; count: number }[];
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
                <p className="text-xs font-medium text-stone-500">
                  {row.count.toLocaleString("en-LK")} expense
                  {row.count === 1 ? "" : "s"}
                </p>
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

function DailyExpensesTable({
  rows,
  isLoading,
}: {
  rows: ExpensesReport["dailyExpenses"];
  isLoading: boolean;
}) {
  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 bg-stone-50 px-5 py-4">
        <h2 className="text-base font-bold text-black">Daily Expenses</h2>
      </div>
      {isLoading && rows.length === 0 ? (
        <EmptyState label="Loading daily expenses..." />
      ) : rows.length === 0 ? (
        <EmptyState label="No daily expenses found." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-160 text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.date} className="transition-colors hover:bg-stone-50/60">
                  <td className="p-4 font-medium text-black">{row.date}</td>
                  <td className="p-4 font-bold text-black">{formatMoney(row.amount)}</td>
                  <td className="p-4 text-stone-700">{row.count}</td>
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
  rows: ExpensesReport["recentExpenses"];
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
          <table className="w-full min-w-225 text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
              <tr>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Title</th>
                <th className="p-4 font-medium">Category</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Payment Method</th>
                <th className="p-4 font-medium">Created By</th>
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
                  <td className="p-4">
                    <p className="font-bold text-black">{expense.title}</p>
                    {expense.notes && (
                      <p className="mt-0.5 max-w-65 truncate text-xs text-stone-500">
                        {expense.notes}
                      </p>
                    )}
                  </td>
                  <td className="p-4">{formatEnumLabel(expense.category)}</td>
                  <td className="p-4 font-bold text-black">{formatMoney(expense.amount)}</td>
                  <td className="p-4">{formatEnumLabel(expense.paymentMethod)}</td>
                  <td className="p-4 text-stone-700">
                    {expense.createdByRole ?? "Unknown"}
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
  includeAllOption = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  includeAllOption?: boolean;
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
        {includeAllOption && <option value="">All</option>}
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
