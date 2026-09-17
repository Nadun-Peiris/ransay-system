"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { SkeletonBlock, SkeletonCardGrid, SkeletonTable } from "@/components/skeleton";
import { showToast } from "@/components/toast-provider";

type OrderAction =
  | "MARK_PAID"
  | "MARK_FULFILLED"
  | "MARK_DISPATCHED"
  | "MARK_DELIVERED"
  | "TOGGLE_SELECTED";

type SingleOrder = {
  id: string;
  orderId: string;
  vatOrderId: string | null;
  nonVatOrderId: string | null;

  createdByRole: "ADMIN" | "SUPERADMIN";
  createdByUser: {
    id: string;
    name: string;
    email: string | null;
    role: "ADMIN" | "SUPERADMIN";
  };

  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  customerTypeSnapshot: "VAT" | "NON_VAT";
  customerVatNumberSnapshot: string | null;

  orderType: "VAT" | "NON_VAT";
  isSelected: boolean;

  subtotal: number;
  discountAmount: number;
  deliveryAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;

  orderStatus: "ACTIVE" | "COMPLETED" | "CANCELLED" | "DELETED";
  paymentType: "PAID_NOW" | "CREDIT";
  paymentStatus: "PENDING" | "DUE" | "OVERDUE" | "PAID";
  fulfillmentStatus: "UNFULFILLED" | "FULFILLED";
  deliveryStatus: "NOT_DISPATCHED" | "DISPATCHED" | "DELIVERED";

  paymentDueDate: string | null;
  paidAt: string | null;

  notes: string | null;
  tags: string[];

  deletedAt: string | null;
  deleteReason: string | null;

  orderDate: string;
  createdAt: string;
  updatedAt: string;

  items: {
    id: string;
    productId: string;
    productName: string;
    sku: string | null;
    kgPerBag: number;
    quantityBags: number;
    quantityKg: number;
    pricePerKg: number;
    lineTotal: number;
  }[];

  stockMovements: {
    id: string;
    movementType:
      | "ORDER_SALE"
      | "ORDER_COMMIT"
      | "ORDER_UNCOMMIT"
      | "ORDER_DELIVERY_DEDUCTION"
      | "ORDER_DELETE_REVERSAL"
      | "STOCK_IN"
      | "STOCK_OUT"
      | "STOCK_ADJUSTMENT";
    quantityBags: number;
    quantityKg: number;
    reason: string | null;
    createdAt: string;
  }[];
};

type CurrentUser = {
  id: string;
  name: string;
  email: string | null;
  role: "ADMIN" | "SUPERADMIN";
};

function formatMoney(value: number) {
  return `Rs ${value.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-LK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getBadgeClass(type: "green" | "yellow" | "red" | "blue" | "gray" | "brand") {
  const classes = {
    green: "bg-emerald-100 text-emerald-800 border-emerald-200",
    yellow: "bg-[#FFBF01]/20 text-yellow-900 border-[#FFBF01]/30",
    red: "bg-red-100 text-red-800 border-red-200",
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    gray: "bg-stone-200 text-stone-700 border-stone-300",
    brand: "bg-[#FFBF01] text-black border-[#FFBF01]",
  };

  return classes[type];
}

function StatusBadge({
  label,
  type,
}: {
  label: string;
  type: "green" | "yellow" | "red" | "blue" | "gray" | "brand";
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${getBadgeClass(
        type
      )}`}
    >
      {label}
    </span>
  );
}

function getPaymentBadgeType(status: SingleOrder["paymentStatus"]) {
  if (status === "PAID") return "green";
  if (status === "DUE") return "yellow";
  if (status === "OVERDUE") return "red";
  return "gray";
}

function getFulfillmentBadgeType(status: SingleOrder["fulfillmentStatus"]) {
  if (status === "FULFILLED") return "blue";
  return "gray";
}

function getDeliveryBadgeType(status: SingleOrder["deliveryStatus"]) {
  if (status === "DELIVERED") return "green";
  if (status === "DISPATCHED") return "blue";
  return "gray";
}

function getOrderBadgeType(status: SingleOrder["orderStatus"]) {
  if (status === "COMPLETED") return "green";
  if (status === "DELETED" || status === "CANCELLED") return "red";
  return "gray";
}

export default function SingleOrderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<SingleOrder | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const orderId = params.id;
  const ordersHref =
    currentUser?.role === "SUPERADMIN" ? "/all-orders" : "/orders";

  const loadOrder = useCallback(async () => {
    try {
      setIsLoading(true);

      const response = await fetch(`/api/orders/${orderId}`);
      const result = await response.json();

      if (response.status === 403) {
        setAccessDenied(true);
        setOrder(null);
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to load order.");
      }

      const fetchedOrder = result.data as SingleOrder;

      setAccessDenied(false);
      setOrder({
        ...fetchedOrder,
        items: fetchedOrder.items ?? [],
        stockMovements: fetchedOrder.stockMovements ?? [],
        tags: fetchedOrder.tags ?? [],
      });
    } catch (error) {
      console.error("Failed to load order:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to load order.",
        "error"
      );
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  const loadCurrentUser = useCallback(async () => {
    const response = await fetch("/api/auth/me");
    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to load current user.");
    }

    setCurrentUser(result.data as CurrentUser);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void Promise.all([loadOrder(), loadCurrentUser()]).catch((error) => {
        if (error instanceof Error && error.message === "Unauthorized") {
          router.replace("/login");
          return;
        }

        console.error("Failed to load order page data:", error);
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadOrder, loadCurrentUser, router]);

  async function handleAction(action: OrderAction) {
    if (!order) return;

    try {
      setIsUpdating(true);

      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to update order.");
      }

      await loadOrder();
    } catch (error) {
      console.error("Order action failed:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to update order.",
        "error"
      );
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleDelete() {
    if (!order) return;

    const deleteReason = window.prompt(
      "Enter delete reason. You can leave this empty."
    );

    if (deleteReason === null) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this order? Stock will be restored."
    );

    if (!confirmed) return;

    try {
      setIsUpdating(true);

      const response = await fetch(`/api/orders/${order.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          deleteReason: deleteReason || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to delete order.");
      }

      showToast("Order deleted successfully.", "success");
      router.push(ordersHref);
    } catch (error) {
      console.error("Order delete failed:", error);
      showToast(
        error instanceof Error ? error.message : "Failed to delete order.",
        "error"
      );
    } finally {
      setIsUpdating(false);
    }
  }

  if (isLoading) {
    return (
      <main className="p-6 text-black font-sans">
        <div className="mb-8">
          <SkeletonBlock className="h-10 w-44" />
          <SkeletonBlock className="mt-3 h-4 w-72" />
        </div>
        <SkeletonCardGrid count={5} />
        <section className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <SkeletonTable columns={6} rows={6} />
        </section>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="p-6 text-black font-sans">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-medium text-stone-500">
            You do not have access to this order.
          </p>
          <BackButton href={ordersHref} label="Back to orders" className="mt-6" />
        </div>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="p-6 text-black font-sans">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
          <p className="text-base font-medium text-stone-500">Order not found.</p>
          <BackButton href={ordersHref} label="Back to orders" className="mt-6" />
        </div>
      </main>
    );
  }

  const isDeleted = order.orderStatus === "DELETED";
  const canUpdateOrder = !isDeleted && order.orderStatus !== "CANCELLED";
  const isSuperadmin = currentUser?.role === "SUPERADMIN";

  const canToggleSelected =
    isSuperadmin &&
    order.createdByRole === "SUPERADMIN" &&
    order.orderType === "NON_VAT" &&
    canUpdateOrder;

  const canMarkPaid = canUpdateOrder && order.paymentStatus !== "PAID";
  const canMarkFulfilled =
    canUpdateOrder && order.fulfillmentStatus === "UNFULFILLED";
  const canMarkDispatched =
    canUpdateOrder &&
    order.fulfillmentStatus === "FULFILLED" &&
    order.deliveryStatus === "NOT_DISPATCHED";
  const canMarkDelivered =
    canUpdateOrder && order.deliveryStatus === "DISPATCHED";

  return (
    <main className="p-6 text-black font-sans">
      <div className="mb-8">
        <div>
          <BackButton href={ordersHref} label="Back to orders" className="mb-4" />

          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-4xl font-bold tracking-tight text-black">
              {order.orderId}
            </h1>

            <StatusBadge label={order.orderStatus} type={getOrderBadgeType(order.orderStatus)} />
            <StatusBadge
              label={order.orderType === "VAT" ? "VAT" : "NON-VAT"}
              type={order.orderType === "VAT" ? "brand" : "gray"}
            />
          </div>

          <p className="mt-2 text-sm font-medium text-stone-500">
            {order.vatOrderId ?? order.nonVatOrderId} <span className="mx-2 text-stone-300">•</span> Order Date{" "}
            <span className="text-stone-700">{formatDate(order.orderDate)}</span>
          </p>
        </div>
      </div>

      {isUpdating && (
        <div className="mb-6 rounded-xl border border-[#FFBF01]/30 bg-[#FFBF01]/10 p-4 text-sm font-medium text-yellow-900 shadow-sm animate-pulse">
          Updating order...
        </div>
      )}

      <section
        className={`mb-8 grid gap-5 md:grid-cols-2 ${
          isSuperadmin ? "xl:grid-cols-5" : "xl:grid-cols-4"
        }`}
      >
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Total Amount</p>
          <p className="mt-2 text-3xl font-bold text-[#FFBF01] drop-shadow-sm">
            {formatMoney(order.totalAmount)}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Payment Status</p>
          <div className="mt-3">
            <StatusBadge
              label={order.paymentStatus}
              type={getPaymentBadgeType(order.paymentStatus)}
            />
          </div>
          <p className="mt-3 text-xs font-medium text-stone-500">
            {order.paymentType === "CREDIT"
              ? `Due: ${formatDate(order.paymentDueDate)}`
              : `Paid: ${formatDate(order.paidAt)}`}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Fulfillment Status</p>
          <div className="mt-3">
            <StatusBadge
              label={order.fulfillmentStatus}
              type={getFulfillmentBadgeType(order.fulfillmentStatus)}
            />
          </div>
          <p className="mt-3 text-xs font-medium text-stone-500 leading-snug">
            Stock committed when order was created
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-stone-500">Delivery Status</p>
          <div className="mt-3">
            <StatusBadge
              label={order.deliveryStatus}
              type={getDeliveryBadgeType(order.deliveryStatus)}
            />
          </div>
          <p className="mt-3 text-xs font-medium text-stone-500 leading-snug">
            Dispatch before marking delivered
          </p>
        </div>

        {isSuperadmin && (
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-sm font-medium text-stone-500">Selection Status</p>
              <p className="mt-2 text-sm font-bold text-black">
                {order.createdByRole === "ADMIN"
                  ? "Auto-shown"
                  : order.orderType === "VAT"
                  ? "Auto-shown"
                  : order.isSelected
                  ? "Selected"
                  : "Not selected"}
              </p>
              <p className="mt-1 text-xs text-stone-400">
                SEL ID is generated on Selected Orders page.
              </p>
            </div>

            {canToggleSelected && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleAction("TOGGLE_SELECTED")}
                  className={`rounded-lg border px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    order.isSelected
                      ? "border-[#FFBF01]/30 bg-[#FFBF01]/10 text-yellow-900 hover:bg-[#FFBF01]/20"
                      : "border-stone-300 bg-white text-black hover:bg-stone-50 shadow-sm"
                  }`}
                >
                  {order.isSelected ? "Deselect Order" : "Select Order"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Order Items Table */}
          <section className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-stone-200 p-5 bg-stone-50/50">
              <h2 className="text-xl font-bold text-black">Order Items</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-stone-600">
                  <tr>
                    <th className="p-4 font-medium">Product</th>
                    <th className="p-4 font-medium">Kg / Bag</th>
                    <th className="p-4 font-medium">Bags</th>
                    <th className="p-4 font-medium">Total Kg</th>
                    <th className="p-4 font-medium">Price / Kg</th>
                    <th className="p-4 font-medium">Line Total</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-stone-100">
                  {order.items.map((item) => (
                    <tr key={item.id} className="transition-colors hover:bg-stone-50/60">
                      <td className="p-4">
                        <p className="font-bold text-black">{item.productName}</p>
                        <p className="mt-0.5 text-xs font-medium text-stone-500">
                          {item.sku ?? "No SKU"}
                        </p>
                      </td>
                      <td className="p-4 font-medium">{item.kgPerBag} kg</td>
                      <td className="p-4 font-medium text-black">{item.quantityBags}</td>
                      <td className="p-4 font-medium">{item.quantityKg} kg</td>
                      <td className="p-4 font-medium text-stone-600">{formatMoney(item.pricePerKg)}</td>
                      <td className="p-4 font-bold text-black">
                        {formatMoney(item.lineTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canUpdateOrder &&
              (canMarkFulfilled || canMarkDispatched || canMarkDelivered) && (
                <div className="flex justify-end border-t border-stone-200 p-5 bg-stone-50/50">
                  <div className="flex flex-wrap justify-end gap-3">
                    {canMarkFulfilled && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleAction("MARK_FULFILLED")}
                        className="rounded-xl border border-blue-200 bg-blue-50 px-6 py-2.5 text-sm font-bold text-blue-700 shadow-sm transition-all hover:bg-blue-100 focus:outline-none focus:ring-4 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Mark as Fulfilled
                      </button>
                    )}

                    {canMarkDispatched && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleAction("MARK_DISPATCHED")}
                        className="rounded-xl border border-sky-200 bg-sky-50 px-6 py-2.5 text-sm font-bold text-sky-700 shadow-sm transition-all hover:bg-sky-100 focus:outline-none focus:ring-4 focus:ring-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Mark as Dispatched
                      </button>
                    )}

                    {canMarkDelivered && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleAction("MARK_DELIVERED")}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-2.5 text-sm font-bold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Mark as Delivered
                      </button>
                    )}
                  </div>
                </div>
              )}
          </section>

          {/* Stock Movements */}
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-bold text-black">Stock Movements</h2>

            {order.stockMovements.length === 0 ? (
              <p className="text-sm font-medium text-stone-500 bg-stone-50 p-4 rounded-xl border border-stone-100">
                No stock movements recorded.
              </p>
            ) : (
              <div className="space-y-4">
                {order.stockMovements.map((movement) => (
                  <div
                    key={movement.id}
                    className="rounded-xl border border-stone-200 bg-stone-50/50 p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <StatusBadge
                        label={movement.movementType.replace(/_/g, " ")}
                        type={
                          movement.movementType === "ORDER_SALE"
                            ? "blue"
                            : "green"
                        }
                      />
                      <p className="text-xs font-medium text-stone-500">
                        {formatDate(movement.createdAt)}
                      </p>
                    </div>

                    <div className="mt-4 flex gap-4 text-sm font-medium text-black">
                      <div className="bg-white px-3 py-1.5 rounded-lg border border-stone-200 shadow-sm">
                        Bags: <span className="font-bold">{movement.quantityBags}</span>
                      </div>
                      <div className="bg-white px-3 py-1.5 rounded-lg border border-stone-200 shadow-sm">
                        Kg: <span className="font-bold">{movement.quantityKg}</span>
                      </div>
                    </div>

                    {movement.reason && (
                      <p className="mt-3 text-xs text-stone-500 italic">
                        &quot;{movement.reason}&quot;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          {/* Customer Details */}
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-bold text-black">Customer Details</h2>

            <div className="space-y-2 text-sm bg-stone-50 rounded-xl p-4 border border-stone-100">
              <p className="text-lg font-bold text-black">
                {order.customerName}
              </p>
              <p className="font-medium text-stone-600">
                {order.customerPhone || "No phone provided"}
              </p>
              <p className="text-stone-500 mt-1">
                {order.customerAddress || "No address provided"}
              </p>

              <div className="pt-4 mt-2 border-t border-stone-200">
                <StatusBadge
                  label={
                    order.customerTypeSnapshot === "VAT" ? "VAT Customer" : "NON-VAT Customer"
                  }
                  type={
                    order.customerTypeSnapshot === "VAT" ? "brand" : "gray"
                  }
                />
              </div>

              {order.customerVatNumberSnapshot && (
                <p className="pt-3 text-xs font-medium text-stone-500 uppercase tracking-wide">
                  VAT No: <span className="text-black">{order.customerVatNumberSnapshot}</span>
                </p>
              )}
            </div>
          </section>

          {/* Payment Summary */}
          <section className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
            <div className="p-6">
              <h2 className="mb-5 text-xl font-bold text-black">Payment Summary</h2>

              <div className="space-y-3 text-sm font-medium">
                <div className="flex justify-between items-center">
                  <span className="text-stone-500">Subtotal</span>
                  <span className="text-black">{formatMoney(order.subtotal)}</span>
                </div>

                <div className="flex justify-between items-center text-red-600">
                  <span>Discount</span>
                  <span>- {formatMoney(order.discountAmount)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-stone-500">Delivery</span>
                  <span className="text-black">{formatMoney(order.deliveryAmount)}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-stone-500">
                    VAT {order.vatRate > 0 ? `(${order.vatRate}%)` : ""}
                  </span>
                  <span className="text-black">{formatMoney(order.vatAmount)}</span>
                </div>
              </div>
            </div>

            <div className="bg-stone-50 px-6 py-4 border-t border-stone-200 flex justify-between items-center text-lg font-bold text-black">
              <span>Total</span>
              <span className="text-[#C8942A]">{formatMoney(order.totalAmount)}</span>
            </div>

            {canMarkPaid && (
              <div className="px-6 pb-6 pt-4 bg-stone-50 flex justify-end">
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => handleAction("MARK_PAID")}
                  className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 shadow-sm transition-colors hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Mark as Paid
                </button>
              </div>
            )}
          </section>

          {/* Order Meta Details */}
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-bold text-black">Order Metadata</h2>

            <div className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Created By</p>
                <p className="mt-1 font-bold text-black">
                  {order.createdByUser.name}{" "}
                  <span className="font-medium text-stone-500">({order.createdByUser.role})</span>
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Order Date</p>
                <p className="mt-1 font-bold text-black">{formatDate(order.orderDate)}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Created At</p>
                <p className="mt-1 font-bold text-black">{formatDateTime(order.createdAt)}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide">Last Updated</p>
                <p className="mt-1 font-bold text-black">{formatDate(order.updatedAt)}</p>
              </div>

              {order.tags.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-stone-500 uppercase tracking-wide">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {order.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700 border border-stone-200"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {order.notes && (
                <div>
                  <p className="mb-2 text-xs font-medium text-stone-500 uppercase tracking-wide">Notes</p>
                  <p className="rounded-xl bg-[#FFBF01]/10 border border-[#FFBF01]/20 p-4 text-sm font-medium text-black">
                    {order.notes}
                  </p>
                </div>
              )}

              {isDeleted && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 mt-6">
                  <p className="font-bold text-red-800 text-base">Deleted Order</p>
                  <p className="mt-2 text-sm font-medium text-red-700">
                    {order.deleteReason || "No delete reason provided."}
                  </p>
                  <p className="mt-3 text-xs font-bold text-red-600/70">
                    DELETED AT: {formatDate(order.deletedAt)}
                  </p>
                </div>
              )}

              {canUpdateOrder && (
                <div className="flex justify-end border-t border-stone-200 pt-5 mt-2">
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={handleDelete}
                    className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 focus:outline-none focus:ring-4 focus:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
                  >
                    Delete Order
                  </button>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
