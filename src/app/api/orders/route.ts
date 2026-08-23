import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CreateOrderItemInput = {
  productId: string;
  quantityBags: number;
  pricePerKg: number;
};

type CreateOrderInput = {
  customerId: string;
  customerAddressId?: string | null;
  orderDate?: string | null;
  items: CreateOrderItemInput[];
  discountAmount?: number;
  deliveryAmount?: number;
  paymentType: "PAID_NOW" | "CREDIT";
  paymentDueDate?: string | null;
  notes?: string | null;
};

const ORDER_TYPES = ["VAT", "NON_VAT"] as const;
const PAYMENT_STATUSES = ["PENDING", "DUE", "OVERDUE", "PAID"] as const;
const FULFILLMENT_STATUSES = ["UNFULFILLED", "FULFILLED"] as const;
const DELIVERY_STATUSES = [
  "NOT_DISPATCHED",
  "DISPATCHED",
  "DELIVERED",
] as const;
const ORDER_STATUSES = ["ACTIVE", "COMPLETED", "CANCELLED", "DELETED"] as const;
const USER_ROLES = ["ADMIN", "SUPERADMIN"] as const;

function formatSequence(prefix: string, value: number) {
  return `${prefix}-${String(value).padStart(4, "0")}`;
}

function getEnumParam<T extends readonly string[]>(
  searchParams: URLSearchParams,
  key: string,
  allowedValues: T
): T[number] | undefined {
  const value = searchParams.get(key);

  if (value && allowedValues.includes(value)) {
    return value as T[number];
  }

  return undefined;
}

function getDateParam(searchParams: URLSearchParams, key: string) {
  const value = searchParams.get(key);

  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date;
}

function getDateToParam(searchParams: URLSearchParams) {
  const dateTo = getDateParam(searchParams, "dateTo");

  if (!dateTo) {
    return undefined;
  }

  dateTo.setHours(23, 59, 59, 999);
  return dateTo;
}

function parseOptionalOrderDate(value: string | null | undefined) {
  if (!value) {
    return new Date();
  }

  const orderDate = new Date(value);

  if (Number.isNaN(orderDate.getTime())) {
    return null;
  }

  return orderDate;
}

function getCreditPaymentStatus(dueDate: Date) {
  const today = new Date();
  const todayOnly = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const dueOnly = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate()
  );

  if (dueOnly < todayOnly) return "OVERDUE";
  if (dueOnly.getTime() === todayOnly.getTime()) return "DUE";

  return "PENDING";
}

async function getNextSequence(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  key: "ORDER" | "VAT_ORDER" | "NON_VAT_ORDER"
) {
  const sequence = await tx.idSequence.update({
    where: { key },
    data: {
      currentValue: {
        increment: 1,
      },
    },
    select: {
      currentValue: true,
    },
  });

  return sequence.currentValue;
}

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser(request);

    if (currentUser.role !== "SUPERADMIN") {
      return NextResponse.json(
        { success: false, message: "Forbidden." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const limit = Number(searchParams.get("limit") ?? "20");
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const offset = (safePage - 1) * safeLimit;
    const q = searchParams.get("q")?.trim();
    const dateFrom = getDateParam(searchParams, "dateFrom");
    const dateTo = getDateToParam(searchParams);

    const where: Prisma.OrderWhereInput = {
      ...(q
        ? {
            OR: [
              { orderId: { contains: q, mode: "insensitive" as const } },
              { vatOrderId: { contains: q, mode: "insensitive" as const } },
              {
                nonVatOrderId: {
                  contains: q,
                  mode: "insensitive" as const,
                },
              },
              { customerName: { contains: q, mode: "insensitive" as const } },
              { customerPhone: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(getEnumParam(searchParams, "orderType", ORDER_TYPES)
        ? { orderType: getEnumParam(searchParams, "orderType", ORDER_TYPES) }
        : {}),
      ...(getEnumParam(searchParams, "paymentStatus", PAYMENT_STATUSES)
        ? {
            paymentStatus: getEnumParam(
              searchParams,
              "paymentStatus",
              PAYMENT_STATUSES
            ),
          }
        : {}),
      ...(getEnumParam(searchParams, "fulfillmentStatus", FULFILLMENT_STATUSES)
        ? {
            fulfillmentStatus: getEnumParam(
              searchParams,
              "fulfillmentStatus",
              FULFILLMENT_STATUSES
            ),
          }
        : {}),
      ...(getEnumParam(searchParams, "deliveryStatus", DELIVERY_STATUSES)
        ? {
            deliveryStatus: getEnumParam(
              searchParams,
              "deliveryStatus",
              DELIVERY_STATUSES
            ),
          }
        : {}),
      ...(getEnumParam(searchParams, "orderStatus", ORDER_STATUSES)
        ? {
            orderStatus: getEnumParam(
              searchParams,
              "orderStatus",
              ORDER_STATUSES
            ),
          }
        : {}),
      ...(getEnumParam(searchParams, "createdByRole", USER_ROLES)
        ? {
            createdByRole: getEnumParam(
              searchParams,
              "createdByRole",
              USER_ROLES
            ),
          }
        : {}),
      ...(dateFrom || dateTo
        ? {
            orderDate: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };

    const orders = await prisma.order.findMany({
      where,
      orderBy: [
        {
          orderDate: "desc",
        },
        {
          id: "desc",
        },
      ],
      skip: offset,
      take: safeLimit,
      include: {
        items: true,
      },
    });

    const totalCount = await prisma.order.count({ where });

    const formattedOrders = orders.map((order) => {
      const today = new Date();
      const todayOnly = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );

      let displayPaymentStatus = order.paymentStatus;

      if (
        order.paymentType === "CREDIT" &&
        order.paymentStatus !== "PAID" &&
        order.paymentDueDate
      ) {
        const dueDate = new Date(order.paymentDueDate);
        const dueOnly = new Date(
          dueDate.getFullYear(),
          dueDate.getMonth(),
          dueDate.getDate()
        );

        if (dueOnly < todayOnly) {
          displayPaymentStatus = "OVERDUE";
        } else if (dueOnly.getTime() === todayOnly.getTime()) {
          displayPaymentStatus = "DUE";
        } else {
          displayPaymentStatus = "PENDING";
        }
      }

      return {
        id: order.id,
        orderId: order.orderId,
        vatOrderId: order.vatOrderId,
        nonVatOrderId: order.nonVatOrderId,

        createdByRole: order.createdByRole,
        isSelected: order.isSelected,

        customerName: order.customerName,
        customerPhone: order.customerPhone,
        orderType: order.orderType,

        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discountAmount),
        deliveryAmount: Number(order.deliveryAmount),
        vatAmount: Number(order.vatAmount),
        totalAmount: Number(order.totalAmount),

        orderStatus: order.orderStatus,
        paymentType: order.paymentType,
        paymentStatus: order.paymentStatus,
        displayPaymentStatus,
        fulfillmentStatus: order.fulfillmentStatus,
        deliveryStatus: order.deliveryStatus,

        paymentDueDate: order.paymentDueDate,
        paidAt: order.paidAt,

        deletedAt: order.deletedAt,
        deleteReason: order.deleteReason,

        orderDate: order.orderDate,
        createdAt: order.createdAt,

        items: order.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          quantityBags: Number(item.quantityBags),
          quantityKg: Number(item.quantityKg),
          pricePerKg: Number(item.pricePerKg),
          lineTotal: Number(item.lineTotal),
        })),
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedOrders,
      meta: {
        page: safePage,
        limit: safeLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / safeLimit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch orders:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch orders.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireCurrentUser(request);
    const body = (await request.json()) as CreateOrderInput;

    if (!body.customerId) {
      return NextResponse.json(
        { success: false, message: "Customer is required." },
        { status: 400 }
      );
    }

    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { success: false, message: "At least one product is required." },
        { status: 400 }
      );
    }

    if (body.paymentType === "CREDIT" && !body.paymentDueDate) {
      return NextResponse.json(
        { success: false, message: "Payment due date is required for credit orders." },
        { status: 400 }
      );
    }

    const orderDate = parseOptionalOrderDate(body.orderDate);

    if (!orderDate) {
      return NextResponse.json(
        { success: false, message: "Order date is invalid." },
        { status: 400 }
      );
    }

    const createdOrder = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: {
          id: body.customerId,
        },
        include: {
          addresses: {
            orderBy: [
              {
                isDefault: "desc",
              },
              {
                createdAt: "asc",
              },
            ],
          },
        },
      });

      if (!customer || !customer.isActive) {
        throw new Error("Customer not found or inactive.");
      }

      let selectedCustomerAddress = customer.addresses[0]?.address ?? customer.address;

      if (body.customerAddressId) {
        const customerAddress = customer.addresses.find(
          (address) => address.id === body.customerAddressId
        );

        if (!customerAddress) {
          throw new Error("Selected customer address was not found.");
        }

        selectedCustomerAddress = customerAddress.address;
      }

      const orderType = customer.customerType;

      const productIds = body.items.map((item) => item.productId);

      const products = await tx.product.findMany({
        where: {
          id: {
            in: productIds,
          },
          isActive: true,
        },
      });

      if (products.length !== productIds.length) {
        throw new Error("One or more products were not found.");
      }

      const orderItems = body.items.map((item) => {
        const product = products.find((p) => p.id === item.productId);

        if (!product) {
          throw new Error("Product not found.");
        }

        if (item.quantityBags <= 0) {
          throw new Error("Quantity bags must be greater than 0.");
        }

        if (item.pricePerKg <= 0) {
          throw new Error("Price per kg must be greater than 0.");
        }

        const onHandBags = Number(product.stockBags);
        const kgPerBag = Number(product.kgPerBag);
        const onHandKg = Number(product.stockKg);
        const committedBags = Number(product.committedBags);
        const committedKg = Number(product.committedKg);
        const unavailableBags = Number(product.unavailableBags);
        const unavailableKg = Number(product.unavailableKg);
        const availableBags = onHandBags - committedBags - unavailableBags;
        const availableKg = onHandKg - committedKg - unavailableKg;

        const quantityKg = item.quantityBags * kgPerBag;

        if (item.quantityBags > availableBags) {
          throw new Error(`${product.productName} does not have enough available bags.`);
        }

        if (quantityKg > availableKg) {
          throw new Error(`${product.productName} does not have enough available kg.`);
        }

        const lineTotal = quantityKg * item.pricePerKg;

        return {
          product,
          data: {
            productId: product.id,
            productName: product.productName,
            sku: product.sku,
            kgPerBag,
            quantityBags: item.quantityBags,
            quantityKg,
            pricePerKg: item.pricePerKg,
            lineTotal,
          },
        };
      });

      const subtotal = orderItems.reduce((sum, item) => {
        return sum + item.data.lineTotal;
      }, 0);

      const discountAmount = body.discountAmount ?? 0;
      const deliveryAmount = body.deliveryAmount ?? 0;

      const vatRate = orderType === "VAT" ? 18 : 0;
      const taxableAmount = subtotal - discountAmount + deliveryAmount;
      const vatAmount = orderType === "VAT" ? taxableAmount * (vatRate / 100) : 0;
      const totalAmount = taxableAmount + vatAmount;

      const orderSequence = await getNextSequence(tx, "ORDER");
      const orderId = formatSequence("ORD", orderSequence);

      let vatOrderId: string | null = null;
      let nonVatOrderId: string | null = null;

      if (orderType === "VAT") {
        const vatSequence = await getNextSequence(tx, "VAT_ORDER");
        vatOrderId = formatSequence("VAT", vatSequence);
      } else {
        const nonVatSequence = await getNextSequence(tx, "NON_VAT_ORDER");
        nonVatOrderId = formatSequence("NV", nonVatSequence);
      }

      const paymentDueDate =
        body.paymentType === "CREDIT" && body.paymentDueDate
          ? new Date(body.paymentDueDate)
          : null;

      const paymentStatus =
        body.paymentType === "PAID_NOW"
          ? "PAID"
          : getCreditPaymentStatus(paymentDueDate as Date);

      const paidAt = body.paymentType === "PAID_NOW" ? new Date() : null;

      const order = await tx.order.create({
        data: {
          orderId,
          vatOrderId,
          nonVatOrderId,

          createdByRole: currentUser.role,
          createdByUserId: currentUser.id,

          customerId: customer.id,
          customerName: customer.customerName,
          customerContactPerson: customer.contactPerson,
          customerPhone: customer.phone,
          customerAddress: selectedCustomerAddress,
          customerTypeSnapshot: customer.customerType,
          customerVatNumberSnapshot: customer.vatNumber,

          orderType,

          isSelected: false,
          orderDate,

          subtotal,
          discountAmount,
          deliveryAmount,
          vatRate,
          vatAmount,
          totalAmount,

          orderStatus: "ACTIVE",
          paymentType: body.paymentType,
          paymentStatus,
          fulfillmentStatus: "UNFULFILLED",
          deliveryStatus: "NOT_DISPATCHED",

          paymentDueDate,
          paidAt,

          notes: body.notes ?? null,

          items: {
            create: orderItems.map((item) => item.data),
          },
        },
        include: {
          items: true,
        },
      });

      for (const item of orderItems) {
        await tx.product.update({
          where: {
            id: item.product.id,
          },
          data: {
            committedBags: {
              increment: item.data.quantityBags,
            },
            committedKg: {
              increment: item.data.quantityKg,
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.product.id,
            orderId: order.id,
            movementType: "ORDER_COMMIT",
            quantityBags: item.data.quantityBags,
            quantityKg: item.data.quantityKg,
            createdByUserId: currentUser.id,
            reason: `Committed for order ${order.orderId}`,
          },
        });
      }

      return order;
    });

    return NextResponse.json({
      success: true,
      message: "Order created successfully.",
      data: createdOrder,
    });
  } catch (error) {
    console.error("Failed to create order:", error);

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
          error instanceof Error
            ? error.message
            : "Failed to create order.",
      },
      { status: 500 }
    );
  }
}
