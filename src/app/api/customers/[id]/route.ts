import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type UpdateCustomerInput = {
  customerCode?: string | null;
  customerName?: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  position?: string | null;
  addresses?: {
    id?: string;
    label?: string | null;
    address?: string | null;
    isDefault?: boolean;
  }[];
  customerType?: "VAT" | "NON_VAT";
  vatNumber?: string | null;
  isActive?: boolean;
};

type CustomerAddressPayload = {
  id: string;
  label: string | null;
  address: string;
  isDefault: boolean;
};

function formatCustomer(
  customer: {
    id: string;
    customerCode: string | null;
    customerName: string;
    contactPerson: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    position: string | null;
    customerType: "VAT" | "NON_VAT";
    vatNumber: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    addresses?: CustomerAddressPayload[];
  },
  aggregates: { orderCount: number; totalSalesAmount: number }
) {
  return {
    id: customer.id,
    customerCode: customer.customerCode,
    customerName: customer.customerName,
    contactPerson: customer.contactPerson,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    position: customer.position,
    addresses: customer.addresses ?? [],
    customerType: customer.customerType,
    vatNumber: customer.vatNumber,
    isActive: customer.isActive,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    orderCount: aggregates.orderCount,
    totalSalesAmount: aggregates.totalSalesAmount,
  };
}

function normalizeAddresses(input: UpdateCustomerInput) {
  const sourceAddresses =
    input.addresses && input.addresses.length > 0
      ? input.addresses
      : input.address
      ? [{ label: "Primary", address: input.address, isDefault: true }]
      : [];

  const addresses = sourceAddresses
    .map((item) => ({
      label: item.label?.trim() || null,
      address: item.address?.trim() || "",
      isDefault: Boolean(item.isDefault),
    }))
    .filter((item) => item.address.length > 0);

  if (addresses.length > 0 && !addresses.some((item) => item.isDefault)) {
    addresses[0].isDefault = true;
  }

  let hasDefault = false;
  return addresses.map((item) => {
    if (item.isDefault && !hasDefault) {
      hasDefault = true;
      return item;
    }

    return {
      ...item,
      isDefault: false,
    };
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireCurrentUser(request);
    const { id } = await context.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
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
        orders: {
          where: {
            deletedAt: null,
            orderStatus: {
              not: "DELETED",
            },
          },
          orderBy: [
            {
              createdAt: "desc",
            },
            {
              id: "desc",
            },
          ],
          take: 10,
          select: {
            id: true,
            orderId: true,
            vatOrderId: true,
            nonVatOrderId: true,
            orderType: true,
            totalAmount: true,
            paymentStatus: true,
            fulfillmentStatus: true,
            deliveryStatus: true,
            orderStatus: true,
            createdAt: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { success: false, message: "Customer not found." },
        { status: 404 }
      );
    }

    const aggregate = await prisma.order.aggregate({
      where: {
        customerId: id,
        deletedAt: null,
        orderStatus: {
          not: "DELETED",
        },
      },
      _count: {
        _all: true,
      },
      _sum: {
        totalAmount: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...formatCustomer(customer, {
          orderCount: aggregate._count._all,
          totalSalesAmount: Number(aggregate._sum.totalAmount ?? 0),
        }),
        recentOrders: customer.orders.map((order) => ({
          ...order,
          totalAmount: Number(order.totalAmount),
        })),
      },
    });
  } catch (error) {
    console.error("Failed to fetch customer:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch customer.",
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
    await requireCurrentUser(request);
    const { id } = await context.params;
    const body = (await request.json()) as UpdateCustomerInput;

    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { success: false, message: "Customer not found." },
        { status: 404 }
      );
    }

    const data: Prisma.CustomerUpdateInput = {};
    const nextCustomerType = body.customerType ?? existingCustomer.customerType;
    const nextVatNumber =
      body.vatNumber !== undefined
        ? body.vatNumber?.trim() || null
        : existingCustomer.vatNumber;

    if (body.customerName !== undefined) {
      const customerName = body.customerName.trim();

      if (!customerName) {
        return NextResponse.json(
          { success: false, message: "Company name is required." },
          { status: 400 }
        );
      }

      data.customerName = customerName;
    }

    if (body.contactPerson !== undefined) {
      data.contactPerson = body.contactPerson?.trim() || null;
    }

    if (body.customerCode !== undefined) {
      const customerCode = body.customerCode?.trim() || null;

      if (customerCode) {
        const duplicateCustomer = await prisma.customer.findFirst({
          where: {
            customerCode,
            id: {
              not: id,
            },
          },
          select: {
            id: true,
          },
        });

        if (duplicateCustomer) {
          return NextResponse.json(
            {
              success: false,
              message: "A customer with this ID already exists.",
            },
            { status: 400 }
          );
        }
      }

      data.customerCode = customerCode;
    }

    if (body.phone !== undefined) {
      data.phone = body.phone?.trim() || null;
    }

    if (body.position !== undefined) {
      data.position = body.position?.trim() || null;
    }

    if (body.email !== undefined) {
      const email = body.email?.trim() || null;

      if (email) {
        const duplicateCustomer = await prisma.customer.findFirst({
          where: {
            email,
            id: {
              not: id,
            },
          },
          select: {
            id: true,
          },
        });

        if (duplicateCustomer) {
          return NextResponse.json(
            {
              success: false,
              message: "A customer with this email already exists.",
            },
            { status: 400 }
          );
        }
      }

      data.email = email;
    }

    let nextAddresses:
      | {
          label: string | null;
          address: string;
          isDefault: boolean;
        }[]
      | undefined;

    if (body.addresses !== undefined || body.address !== undefined) {
      nextAddresses = normalizeAddresses(body);
      data.address = nextAddresses[0]?.address ?? null;
    }

    if (body.customerType !== undefined) {
      if (body.customerType !== "VAT" && body.customerType !== "NON_VAT") {
        return NextResponse.json(
          { success: false, message: "Invalid customer type." },
          { status: 400 }
        );
      }

      data.customerType = body.customerType;
    }

    if (nextCustomerType === "VAT") {
      if (!nextVatNumber) {
        return NextResponse.json(
          { success: false, message: "VAT number is required for VAT customers." },
          { status: 400 }
        );
      }

      data.vatNumber = nextVatNumber;
    } else {
      data.vatNumber = null;
    }

    if (body.isActive !== undefined) {
      data.isActive = body.isActive;
    }

    const customer = await prisma.$transaction(async (tx) => {
      if (nextAddresses !== undefined) {
        await tx.customerAddress.deleteMany({
          where: {
            customerId: id,
          },
        });
      }

      return tx.customer.update({
        where: { id },
        data: {
          ...data,
          addresses:
            nextAddresses !== undefined && nextAddresses.length > 0
              ? {
                  create: nextAddresses,
                }
              : undefined,
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
    });

    const aggregate = await prisma.order.aggregate({
      where: {
        customerId: id,
        deletedAt: null,
        orderStatus: {
          not: "DELETED",
        },
      },
      _count: {
        _all: true,
      },
      _sum: {
        totalAmount: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: formatCustomer(customer, {
        orderCount: aggregate._count._all,
        totalSalesAmount: Number(aggregate._sum.totalAmount ?? 0),
      }),
    });
  } catch (error) {
    console.error("Failed to update customer:", error);

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
          error instanceof Error ? error.message : "Failed to update customer.",
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
    await requireCurrentUser(request);
    const { id } = await context.params;

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      data: formatCustomer(customer, {
        orderCount: 0,
        totalSalesAmount: 0,
      }),
    });
  } catch (error) {
    console.error("Failed to deactivate customer:", error);

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
            : "Failed to deactivate customer.",
      },
      { status: 500 }
    );
  }
}
