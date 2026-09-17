import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ORDER_TYPES = ["VAT", "NON_VAT"] as const;
const PAYMENT_STATUS_FILTERS = ["PENDING", "DUE", "OVERDUE"] as const;
const USER_ROLES = ["ADMIN", "SUPERADMIN"] as const;

type CollectionStatus = "UPCOMING" | "DUE_TODAY" | "OVERDUE";

type ReceivableOrderRow = {
  id: string;
  orderId: string;
  vatOrderId: string | null;
  nonVatOrderId: string | null;
  customerId: string;
  customerName: string;
  customerContactPerson: string | null;
  customerPhone: string | null;
  customer: {
    email: string | null;
  };
  orderType: "VAT" | "NON_VAT";
  createdByRole: "ADMIN" | "SUPERADMIN";
  isSelected: boolean;
  totalAmount: unknown;
  paymentStatus: "PENDING" | "DUE" | "OVERDUE" | "PAID";
  orderDate: Date;
  paymentDueDate: Date | null;
  createdAt: Date;
};

function decimalToNumber(value: unknown) {
  if (typeof value === "number") return value;

  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber() as number;
  }

  return Number(value ?? 0);
}

function getDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getMonthLabel(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-LK", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getTodayKey() {
  return getDateKey(new Date());
}

function diffDays(fromDateKey: string, toDateKey: string) {
  const from = new Date(`${fromDateKey}T00:00:00.000Z`).getTime();
  const to = new Date(`${toDateKey}T00:00:00.000Z`).getTime();

  return Math.round((to - from) / 86_400_000);
}

function getCollectionStatus(
  dueDate: Date,
  todayKey: string
): CollectionStatus {
  const dueDateKey = getDateKey(dueDate);

  if (dueDateKey < todayKey) return "OVERDUE";
  if (dueDateKey === todayKey) return "DUE_TODAY";
  return "UPCOMING";
}

function getEnumParam<T extends readonly string[]>(
  searchParams: URLSearchParams,
  key: string,
  allowedValues: T
): T[number] | undefined {
  const value = searchParams.get(key);

  if (value && value !== "ALL" && allowedValues.includes(value)) {
    return value as T[number];
  }

  return undefined;
}

function getSelectedMonthYear(searchParams: URLSearchParams) {
  const now = new Date();
  const parsedMonth = Number(searchParams.get("month"));
  const parsedYear = Number(searchParams.get("year"));
  const month =
    Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : now.getMonth() + 1;
  const year =
    Number.isInteger(parsedYear) && parsedYear >= 1900 && parsedYear <= 3000
      ? parsedYear
      : now.getFullYear();

  return { month, year };
}

function getMonthRange(year: number, month: number) {
  return {
    gte: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
    lte: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

function getThreshold(searchParams: URLSearchParams) {
  const rawThreshold = searchParams.get("threshold");

  if (!rawThreshold?.trim()) return null;

  const threshold = Number(rawThreshold);

  if (!Number.isFinite(threshold) || threshold < 0) return null;

  return threshold;
}

function getDisplayOrderId(order: {
  orderType: "VAT" | "NON_VAT";
  vatOrderId: string | null;
  nonVatOrderId: string | null;
  orderId: string;
}) {
  if (order.orderType === "VAT") {
    return order.vatOrderId ?? order.orderId;
  }

  return order.nonVatOrderId ?? order.orderId;
}

function getCanUnselect(order: {
  createdByRole: "ADMIN" | "SUPERADMIN";
  orderType: "VAT" | "NON_VAT";
  isSelected: boolean;
}) {
  return (
    order.createdByRole === "SUPERADMIN" &&
    order.orderType === "NON_VAT" &&
    order.isSelected
  );
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser(request);

    if (currentUser.role !== "SUPERADMIN" && currentUser.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Forbidden." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const { month: selectedMonth, year: selectedYear } =
      getSelectedMonthYear(searchParams);
    const thresholdAmount = getThreshold(searchParams);
    const orderType = getEnumParam(searchParams, "orderType", ORDER_TYPES);
    const paymentStatusFilter = getEnumParam(
      searchParams,
      "paymentStatus",
      PAYMENT_STATUS_FILTERS
    );
    const createdByRole = getEnumParam(
      searchParams,
      "createdByRole",
      USER_ROLES
    );
    const customerId = searchParams.get("customerId")?.trim();

    const selectedOrdersVisibilityFilter = {
      OR: [
        { createdByRole: "ADMIN" },
        { createdByRole: "SUPERADMIN", orderType: "VAT" },
        {
          createdByRole: "SUPERADMIN",
          orderType: "NON_VAT",
          isSelected: true,
        },
      ],
    } satisfies Prisma.OrderWhereInput;

    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      orderStatus: {
        notIn: ["DELETED", "CANCELLED"],
      },
      paymentType: "CREDIT",
      paymentStatus: {
        not: "PAID",
      },
      paymentDueDate: getMonthRange(selectedYear, selectedMonth),
      AND: [
        selectedOrdersVisibilityFilter,
        ...(orderType ? [{ orderType }] : []),
        ...(createdByRole ? [{ createdByRole }] : []),
        ...(customerId ? [{ customerId }] : []),
      ],
    };

    const orders = await prisma.order.findMany({
      where,
      orderBy: [
        { paymentDueDate: "asc" },
        { orderDate: "desc" },
        { id: "asc" },
      ],
      select: {
        id: true,
        orderId: true,
        vatOrderId: true,
        nonVatOrderId: true,
        customerId: true,
        customerName: true,
        customerContactPerson: true,
        customerPhone: true,
        customer: {
          select: {
            email: true,
          },
        },
        orderType: true,
        createdByRole: true,
        isSelected: true,
        totalAmount: true,
        paymentStatus: true,
        orderDate: true,
        paymentDueDate: true,
        createdAt: true,
      },
    });

    const todayKey = getTodayKey();
    const receivableOrdersBase = (orders as ReceivableOrderRow[])
      .map((order) => {
        const dueDate = order.paymentDueDate as Date;
        const dueDateKey = getDateKey(dueDate);
        const collectionStatus = getCollectionStatus(dueDate, todayKey);
        const dayDifference = diffDays(todayKey, dueDateKey);
        const canUnselect = getCanUnselect(order);

        return {
          id: order.id,
          orderId: order.orderId,
          vatOrderId: order.vatOrderId,
          nonVatOrderId: order.nonVatOrderId,
          displayOrderId: getDisplayOrderId(order),
          customerId: order.customerId,
          customerName: order.customerName,
          contactPerson: order.customerContactPerson,
          phone: order.customerPhone,
          orderType: order.orderType,
          createdByRole: order.createdByRole,
          isSelected: order.isSelected,
          canUnselect,
          suggestedForUnselect: false,
          totalAmount: decimalToNumber(order.totalAmount),
          paymentStatus: order.paymentStatus,
          orderDate: order.orderDate,
          dueDate,
          createdAt: order.createdAt,
          collectionStatus,
          daysUntilDue: dayDifference > 0 ? dayDifference : 0,
          daysOverdue: dayDifference < 0 ? Math.abs(dayDifference) : 0,
          customerEmail: order.customer.email,
        };
      })
      .filter((order) => {
        if (!paymentStatusFilter) return true;
        if (paymentStatusFilter === "PENDING") {
          return order.collectionStatus === "UPCOMING";
        }
        if (paymentStatusFilter === "DUE") {
          return order.collectionStatus === "DUE_TODAY";
        }

        return order.collectionStatus === "OVERDUE";
      });

    const projectedReceivableAmount = receivableOrdersBase.reduce(
      (sum, order) => sum + order.totalAmount,
      0
    );
    const thresholdExceeded =
      thresholdAmount !== null && projectedReceivableAmount > thresholdAmount;
    const excessAmount = thresholdExceeded
      ? projectedReceivableAmount - thresholdAmount
      : 0;
    const suggestedUnselectOrderIds: string[] = [];
    let suggestedUnselectAmount = 0;

    if (thresholdExceeded) {
      const candidates = receivableOrdersBase
        .filter((order) => order.canUnselect)
        .sort((a, b) => b.totalAmount - a.totalAmount);

      for (const order of candidates) {
        if (suggestedUnselectAmount >= excessAmount) break;

        suggestedUnselectOrderIds.push(order.id);
        suggestedUnselectAmount += order.totalAmount;
      }
    }

    const suggestedUnselectOrderIdSet = new Set(suggestedUnselectOrderIds);
    const receivableOrders = receivableOrdersBase.map((order) => ({
      ...order,
      suggestedForUnselect: suggestedUnselectOrderIdSet.has(order.id),
    }));
    const projectedAfterUnselect =
      projectedReceivableAmount - suggestedUnselectAmount;
    const canFullyMeetThreshold =
      thresholdAmount !== null && projectedAfterUnselect <= thresholdAmount;
    const remainingExcessAfterSuggestions =
      thresholdAmount === null
        ? 0
        : Math.max(projectedAfterUnselect - thresholdAmount, 0);

    const monthlyMap = new Map<
      string,
      {
        month: number;
        year: number;
        label: string;
        totalAmount: number;
        orderCount: number;
        upcomingAmount: number;
        dueTodayAmount: number;
        overdueAmount: number;
      }
    >();
    const dailyMap = new Map<
      string,
      {
        date: string;
        totalAmount: number;
        orderCount: number;
        upcomingAmount: number;
        dueTodayAmount: number;
        overdueAmount: number;
      }
    >();
    const customerMap = new Map<
      string,
      {
        customerId: string;
        customerName: string;
        contactPerson: string | null;
        phone: string | null;
        email: string | null;
        totalAmount: number;
        orderCount: number;
        nearestDueDate: Date | null;
        overdueAmount: number;
        upcomingAmount: number;
      }
    >();
    const totals = {
      upcomingAmount: 0,
      dueTodayAmount: 0,
      overdueAmount: 0,
      upcomingCount: 0,
      dueTodayCount: 0,
      overdueCount: 0,
      vatAmount: 0,
      nonVatAmount: 0,
      vatCount: 0,
      nonVatCount: 0,
    };
    let nearestDueDate: Date | null = null;

    for (const order of receivableOrders) {
      const amount = order.totalAmount;
      const dueDate = new Date(order.dueDate);
      const dateKey = getDateKey(dueDate);
      const year = dueDate.getUTCFullYear();
      const month = dueDate.getUTCMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;

      if (order.collectionStatus === "UPCOMING") {
        totals.upcomingAmount += amount;
        totals.upcomingCount += 1;
      } else if (order.collectionStatus === "DUE_TODAY") {
        totals.dueTodayAmount += amount;
        totals.dueTodayCount += 1;
      } else {
        totals.overdueAmount += amount;
        totals.overdueCount += 1;
      }

      if (order.orderType === "VAT") {
        totals.vatAmount += amount;
        totals.vatCount += 1;
      } else {
        totals.nonVatAmount += amount;
        totals.nonVatCount += 1;
      }

      if (dateKey >= todayKey && (!nearestDueDate || dueDate < nearestDueDate)) {
        nearestDueDate = dueDate;
      }

      const monthly = monthlyMap.get(monthKey) ?? {
        month,
        year,
        label: getMonthLabel(year, month),
        totalAmount: 0,
        orderCount: 0,
        upcomingAmount: 0,
        dueTodayAmount: 0,
        overdueAmount: 0,
      };
      monthly.totalAmount += amount;
      monthly.orderCount += 1;
      if (order.collectionStatus === "UPCOMING") monthly.upcomingAmount += amount;
      if (order.collectionStatus === "DUE_TODAY") monthly.dueTodayAmount += amount;
      if (order.collectionStatus === "OVERDUE") monthly.overdueAmount += amount;
      monthlyMap.set(monthKey, monthly);

      const daily = dailyMap.get(dateKey) ?? {
        date: dateKey,
        totalAmount: 0,
        orderCount: 0,
        upcomingAmount: 0,
        dueTodayAmount: 0,
        overdueAmount: 0,
      };
      daily.totalAmount += amount;
      daily.orderCount += 1;
      if (order.collectionStatus === "UPCOMING") daily.upcomingAmount += amount;
      if (order.collectionStatus === "DUE_TODAY") daily.dueTodayAmount += amount;
      if (order.collectionStatus === "OVERDUE") daily.overdueAmount += amount;
      dailyMap.set(dateKey, daily);

      const customer = customerMap.get(order.customerId) ?? {
        customerId: order.customerId,
        customerName: order.customerName,
        contactPerson: order.contactPerson,
        phone: order.phone,
        email: order.customerEmail,
        totalAmount: 0,
        orderCount: 0,
        nearestDueDate: null,
        overdueAmount: 0,
        upcomingAmount: 0,
      };
      customer.totalAmount += amount;
      customer.orderCount += 1;
      if (!customer.nearestDueDate || dueDate < customer.nearestDueDate) {
        customer.nearestDueDate = dueDate;
      }
      if (order.collectionStatus === "OVERDUE") customer.overdueAmount += amount;
      if (order.collectionStatus === "UPCOMING") customer.upcomingAmount += amount;
      customerMap.set(order.customerId, customer);
    }

    const customerReceivables = Array.from(customerMap.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount
    );

    return NextResponse.json({
      success: true,
      data: {
        mode: "SELECTED_RECEIVABLES",
        selectedMonth,
        selectedYear,
        thresholdAmount,
        summary: {
          projectedReceivableAmount,
          totalReceivableCount: receivableOrders.length,
          thresholdAmount,
          thresholdExceeded,
          excessAmount,
          amountAfterSuggestedUnselect: projectedAfterUnselect,
          suggestedReductionAmount: suggestedUnselectAmount,
          remainingExcessAfterSuggestions,
          upcomingAmount: totals.upcomingAmount,
          dueTodayAmount: totals.dueTodayAmount,
          overdueAmount: totals.overdueAmount,
          upcomingCount: totals.upcomingCount,
          dueTodayCount: totals.dueTodayCount,
          overdueCount: totals.overdueCount,
          nearestDueDate,
          highestReceivableCustomerName:
            customerReceivables[0]?.customerName ?? null,
        },
        thresholdPlan: {
          thresholdExceeded,
          excessAmount,
          canFullyMeetThreshold,
          suggestedUnselectOrderIds,
          suggestedUnselectAmount,
          projectedAfterUnselect,
          remainingExcessAfterSuggestions,
        },
        monthlyReceivables: Array.from(monthlyMap.values()).sort(
          (a, b) => a.year - b.year || a.month - b.month
        ),
        dailyReceivables: Array.from(dailyMap.values()).sort((a, b) =>
          a.date.localeCompare(b.date)
        ),
        customerReceivables,
        orderTypeBreakdown: {
          vatAmount: totals.vatAmount,
          nonVatAmount: totals.nonVatAmount,
          vatCount: totals.vatCount,
          nonVatCount: totals.nonVatCount,
        },
        statusBreakdown: {
          upcomingAmount: totals.upcomingAmount,
          dueTodayAmount: totals.dueTodayAmount,
          overdueAmount: totals.overdueAmount,
          upcomingCount: totals.upcomingCount,
          dueTodayCount: totals.dueTodayCount,
          overdueCount: totals.overdueCount,
        },
        receivableOrders: receivableOrders
          .map((order) => ({
            id: order.id,
            orderId: order.orderId,
            vatOrderId: order.vatOrderId,
            nonVatOrderId: order.nonVatOrderId,
            displayOrderId: order.displayOrderId,
            customerId: order.customerId,
            customerName: order.customerName,
            contactPerson: order.contactPerson,
            phone: order.phone,
            orderType: order.orderType,
            createdByRole: order.createdByRole,
            isSelected: order.isSelected,
            canUnselect: order.canUnselect,
            suggestedForUnselect: order.suggestedForUnselect,
            totalAmount: order.totalAmount,
            paymentStatus: order.paymentStatus,
            orderDate: order.orderDate,
            dueDate: order.dueDate,
            createdAt: order.createdAt,
            collectionStatus: order.collectionStatus,
            daysUntilDue: order.daysUntilDue,
            daysOverdue: order.daysOverdue,
          }))
          .sort((a, b) => {
            const dueDateSort =
              new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();

            if (dueDateSort !== 0) return dueDateSort;

            return (
              new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
            );
          }),
      },
    });
  } catch (error) {
    console.error("Failed to fetch receivables report:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Failed to fetch receivables report." },
      { status: 500 }
    );
  }
}
