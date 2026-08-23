import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type OrderAction =
  | "MARK_PAID"
  | "MARK_FULFILLED"
  | "MARK_DISPATCHED"
  | "MARK_DELIVERED"
  | "TOGGLE_SELECTED";

type PaymentStatus = "PENDING" | "DUE" | "OVERDUE" | "PAID";
type FulfillmentStatus = "UNFULFILLED" | "FULFILLED";
type DeliveryStatus = "NOT_DISPATCHED" | "DISPATCHED" | "DELIVERED";
type CurrentUserRole = "ADMIN" | "SUPERADMIN";
type VisibleOrderFields = {
  deletedAt: Date | null;
  orderStatus: "ACTIVE" | "COMPLETED" | "CANCELLED" | "DELETED";
  createdByRole: CurrentUserRole;
  orderType: "VAT" | "NON_VAT";
  isSelected: boolean;
};

class RouteError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function getNextOrderStatus(
  paymentStatus: PaymentStatus,
  fulfillmentStatus: FulfillmentStatus,
  deliveryStatus: DeliveryStatus
) {
  if (
    paymentStatus === "PAID" &&
    fulfillmentStatus === "FULFILLED" &&
    deliveryStatus === "DELIVERED"
  ) {
    return "COMPLETED";
  }

  return "ACTIVE";
}

function isSelectedOrdersVisible(order: VisibleOrderFields) {
  if (
    order.deletedAt ||
    order.orderStatus === "DELETED" ||
    order.orderStatus === "CANCELLED"
  ) {
    return false;
  }

  return (
    order.createdByRole === "ADMIN" ||
    (order.createdByRole === "SUPERADMIN" && order.orderType === "VAT") ||
    (order.createdByRole === "SUPERADMIN" &&
      order.orderType === "NON_VAT" &&
      order.isSelected)
  );
}

function canAccessOrder(
  currentUser: { role: CurrentUserRole },
  order: VisibleOrderFields
) {
  return currentUser.role === "SUPERADMIN" || isSelectedOrdersVisible(order);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireCurrentUser(request);
    const { id } = await context.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        customer: true,
        createdByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        deletedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        stockMovements: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          message: "Order not found.",
        },
        { status: 404 }
      );
    }

    if (!canAccessOrder(currentUser, order)) {
      return NextResponse.json(
        { success: false, message: "Forbidden." },
        { status: 403 }
      );
    }

    const formattedOrder = {
      id: order.id,
      orderId: order.orderId,
      vatOrderId: order.vatOrderId,
      nonVatOrderId: order.nonVatOrderId,

      createdByRole: order.createdByRole,
      createdByUser: order.createdByUser,

      customerId: order.customerId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.customerAddress,
      customerTypeSnapshot: order.customerTypeSnapshot,
      customerVatNumberSnapshot: order.customerVatNumberSnapshot,

      orderType: order.orderType,
      isSelected: order.isSelected,

      subtotal: Number(order.subtotal),
      discountAmount: Number(order.discountAmount),
      deliveryAmount: Number(order.deliveryAmount),
      vatRate: Number(order.vatRate),
      vatAmount: Number(order.vatAmount),
      totalAmount: Number(order.totalAmount),

      orderStatus: order.orderStatus,
      paymentType: order.paymentType,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      deliveryStatus: order.deliveryStatus,

      paymentDueDate: order.paymentDueDate,
      paidAt: order.paidAt,

      notes: order.notes,
      tags: [],

      deletedAt: order.deletedAt,
      deletedByUser: order.deletedByUser,
      deleteReason: order.deleteReason,

      orderDate: order.orderDate,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,

      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        kgPerBag: Number(item.kgPerBag),
        quantityBags: Number(item.quantityBags),
        quantityKg: Number(item.quantityKg),
        pricePerKg: Number(item.pricePerKg),
        lineTotal: Number(item.lineTotal),
        createdAt: item.createdAt,
      })),

      stockMovements: order.stockMovements.map((movement) => ({
        id: movement.id,
        movementType: movement.movementType,
        quantityBags: Number(movement.quantityBags),
        quantityKg: Number(movement.quantityKg),
        reason: movement.reason,
        createdAt: movement.createdAt,
      })),
    };

    return NextResponse.json({
      success: true,
      data: formattedOrder,
    });
  } catch (error) {
    console.error("Failed to fetch order:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to fetch order.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireCurrentUser(request);
    const { id } = await context.params;
    const body = (await request.json()) as { action: OrderAction };

    if (!body.action) {
      return NextResponse.json(
        { success: false, message: "Action is required." },
        { status: 400 }
      );
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!order) {
        throw new RouteError("Order not found.", 404);
      }

      if (!canAccessOrder(currentUser, order)) {
        throw new RouteError("Forbidden.", 403);
      }

      if (order.deletedAt || order.orderStatus === "DELETED") {
        throw new RouteError("Deleted orders cannot be updated.", 400);
      }

      if (order.orderStatus === "CANCELLED") {
        throw new RouteError("Cancelled orders cannot be updated.", 400);
      }

      if (body.action === "MARK_PAID") {
        const nextOrderStatus = getNextOrderStatus(
          "PAID",
          order.fulfillmentStatus,
          order.deliveryStatus
        );

        return tx.order.update({
          where: { id },
          data: {
            paymentStatus: "PAID",
            paidAt: new Date(),
            orderStatus: nextOrderStatus,
          },
        });
      }

      if (body.action === "MARK_FULFILLED") {
        const nextFulfillmentStatus = "FULFILLED";
        const nextOrderStatus = getNextOrderStatus(
          order.paymentStatus,
          nextFulfillmentStatus,
          order.deliveryStatus
        );

        return tx.order.update({
          where: { id },
          data: {
            fulfillmentStatus: nextFulfillmentStatus,
            orderStatus: nextOrderStatus,
          },
        });
      }

      if (body.action === "MARK_DISPATCHED") {
        if (order.fulfillmentStatus !== "FULFILLED") {
          throw new Error("Order must be fulfilled before dispatch.");
        }

        if (order.deliveryStatus !== "NOT_DISPATCHED") {
          throw new RouteError("Order has already been dispatched.", 400);
        }

        const nextDeliveryStatus = "DISPATCHED";
        const nextOrderStatus = getNextOrderStatus(
          order.paymentStatus,
          order.fulfillmentStatus,
          nextDeliveryStatus
        );

        for (const item of order.items) {
          await tx.product.update({
            where: {
              id: item.productId,
            },
            data: {
              committedBags: {
                decrement: item.quantityBags,
              },
              committedKg: {
                decrement: item.quantityKg,
              },
              stockBags: {
                decrement: item.quantityBags,
              },
              stockKg: {
                decrement: item.quantityKg,
              },
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              orderId: order.id,
              movementType: "ORDER_DELIVERY_DEDUCTION",
              quantityBags: -item.quantityBags,
              quantityKg: -item.quantityKg,
              createdByUserId: currentUser.id,
              reason: `Dispatched order ${order.orderId}`,
            },
          });
        }

        return tx.order.update({
          where: { id },
          data: {
            deliveryStatus: nextDeliveryStatus,
            orderStatus: nextOrderStatus,
          },
        });
      }

      if (body.action === "MARK_DELIVERED") {
        if (order.fulfillmentStatus !== "FULFILLED") {
          throw new Error("Order must be fulfilled before delivery.");
        }

        if (order.deliveryStatus === "DELIVERED") {
          throw new RouteError("Order is already delivered.", 400);
        }

        if (order.deliveryStatus !== "DISPATCHED") {
          throw new Error("Order must be dispatched before delivery.");
        }

        const nextDeliveryStatus = "DELIVERED";
        const nextOrderStatus = getNextOrderStatus(
          order.paymentStatus,
          order.fulfillmentStatus,
          nextDeliveryStatus
        );

        return tx.order.update({
          where: { id },
          data: {
            deliveryStatus: nextDeliveryStatus,
            orderStatus: nextOrderStatus,
          },
        });
      }

      if (body.action === "TOGGLE_SELECTED") {
        if (currentUser.role !== "SUPERADMIN") {
          throw new RouteError(
            "Only Superadmins can select or deselect orders.",
            403
          );
        }

        if (order.createdByRole !== "SUPERADMIN") {
          throw new RouteError(
            "Only Superadmin-created orders can be selected or deselected.",
            400
          );
        }

        if (order.orderType !== "NON_VAT") {
          throw new RouteError(
            "Only NON-VAT orders can be selected or deselected.",
            400
          );
        }

        return tx.order.update({
          where: { id },
          data: {
            isSelected: !order.isSelected,
          },
        });
      }

      throw new RouteError("Invalid action.", 400);
    });

    return NextResponse.json({
      success: true,
      message: "Order updated successfully.",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Failed to update order:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (error instanceof RouteError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to update order.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireCurrentUser(request);
    const { id } = await context.params;

    let deleteReason: string | null = null;

    try {
      const body = (await request.json()) as { deleteReason?: string | null };
      deleteReason = body.deleteReason ?? null;
    } catch {
      deleteReason = null;
    }

    const deletedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!order) {
        throw new RouteError("Order not found.", 404);
      }

      if (!canAccessOrder(currentUser, order)) {
        throw new RouteError("Forbidden.", 403);
      }

      if (order.deletedAt || order.orderStatus === "DELETED") {
        throw new RouteError("Order is already deleted.", 400);
      }

      for (const item of order.items) {
        if (
          order.deliveryStatus === "DISPATCHED" ||
          order.deliveryStatus === "DELIVERED"
        ) {
          await tx.product.update({
            where: {
              id: item.productId,
            },
            data: {
              stockBags: {
                increment: item.quantityBags,
              },
              stockKg: {
                increment: item.quantityKg,
              },
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              orderId: order.id,
              movementType: "ORDER_DELETE_REVERSAL",
              quantityBags: item.quantityBags,
              quantityKg: item.quantityKg,
              createdByUserId: currentUser.id,
              reason:
                deleteReason || `Restored dispatched deleted order ${order.orderId}`,
            },
          });
        } else {
          await tx.product.update({
            where: {
              id: item.productId,
            },
            data: {
              committedBags: {
                decrement: item.quantityBags,
              },
              committedKg: {
                decrement: item.quantityKg,
              },
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              orderId: order.id,
              movementType: "ORDER_UNCOMMIT",
              quantityBags: -item.quantityBags,
              quantityKg: -item.quantityKg,
              createdByUserId: currentUser.id,
              reason:
                deleteReason || `Uncommitted deleted order ${order.orderId}`,
            },
          });
        }
      }

      return tx.order.update({
        where: { id },
        data: {
          orderStatus: "DELETED",
          deletedAt: new Date(),
          deletedByUserId: currentUser.id,
          deleteReason,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Order deleted successfully.",
      data: deletedOrder,
    });
  } catch (error) {
    console.error("Failed to delete order:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (error instanceof RouteError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to delete order.",
      },
      { status: 500 }
    );
  }
}
