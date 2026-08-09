import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const CUSTOMER_TYPES = ["VAT", "NON_VAT"] as const;
const STATUSES = ["active", "inactive", "all"] as const;

type CreateCustomerInput = {
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
};

type CustomerAddressPayload = {
  id: string;
  label: string | null;
  address: string;
  isDefault: boolean;
};

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
  aggregates?: { orderCount?: number; totalSalesAmount?: number }
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
    orderCount: aggregates?.orderCount ?? 0,
    totalSalesAmount: aggregates?.totalSalesAmount ?? 0,
  };
}

function normalizeAddresses(input: CreateCustomerInput) {
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

export async function GET(request: NextRequest) {
  try {
    await requireCurrentUser(request);

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const limit = Number(searchParams.get("limit") ?? "20");
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit =
      Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const offset = (safePage - 1) * safeLimit;
    const q = searchParams.get("q")?.trim();
    const customerType = getEnumParam(
      searchParams,
      "customerType",
      CUSTOMER_TYPES
    );
    const status = getEnumParam(searchParams, "status", STATUSES) ?? "active";

    const where: Prisma.CustomerWhereInput = {
      ...(status === "active"
        ? { isActive: true }
        : status === "inactive"
        ? { isActive: false }
        : {}),
      ...(customerType ? { customerType } : {}),
      ...(q
        ? {
            OR: [
              { customerName: { contains: q, mode: "insensitive" as const } },
              { contactPerson: { contains: q, mode: "insensitive" as const } },
              { customerCode: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
              { position: { contains: q, mode: "insensitive" as const } },
              {
                addresses: {
                  some: {
                    address: { contains: q, mode: "insensitive" as const },
                  },
                },
              },
              { vatNumber: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [customers, totalCount] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: [
          {
            customerName: "asc",
          },
          {
            id: "asc",
          },
        ],
        skip: offset,
        take: safeLimit,
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
      }),
      prisma.customer.count({ where }),
    ]);

    const customerIds = customers.map((customer) => customer.id);
    const [orderCounts, salesTotals] =
      customerIds.length > 0
        ? await Promise.all([
            prisma.order.groupBy({
              by: ["customerId"],
              where: {
                customerId: {
                  in: customerIds,
                },
                deletedAt: null,
                orderStatus: {
                  not: "DELETED",
                },
              },
              _count: {
                _all: true,
              },
            }),
            prisma.order.groupBy({
              by: ["customerId"],
              where: {
                customerId: {
                  in: customerIds,
                },
                deletedAt: null,
                orderStatus: {
                  not: "DELETED",
                },
              },
              _sum: {
                totalAmount: true,
              },
            }),
          ])
        : [[], []];

    const orderCountByCustomer = new Map(
      orderCounts.map((item) => [item.customerId, item._count._all])
    );
    const salesByCustomer = new Map(
      salesTotals.map((item) => [
        item.customerId,
        Number(item._sum.totalAmount ?? 0),
      ])
    );

    return NextResponse.json({
      success: true,
      data: customers.map((customer) =>
        formatCustomer(customer, {
          orderCount: orderCountByCustomer.get(customer.id) ?? 0,
          totalSalesAmount: salesByCustomer.get(customer.id) ?? 0,
        })
      ),
      meta: {
        page: safePage,
        limit: safeLimit,
        totalCount,
        totalPages: Math.ceil(totalCount / safeLimit),
      },
    });
  } catch (error) {
    console.error("Failed to fetch customers:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch customers.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireCurrentUser(request);
    const body = (await request.json()) as CreateCustomerInput;

    const customerCode = body.customerCode?.trim() || null;
    const customerName = body.customerName?.trim();
    const contactPerson = body.contactPerson?.trim() || null;
    const phone = body.phone?.trim() || null;
    const email = body.email?.trim() || null;
    const addresses = normalizeAddresses(body);
    const address = addresses[0]?.address ?? (body.address?.trim() || null);
    const position = body.position?.trim() || null;
    const customerType = body.customerType;
    const vatNumber = body.vatNumber?.trim() || null;

    if (!customerName) {
      return NextResponse.json(
        { success: false, message: "Company name is required." },
        { status: 400 }
      );
    }

    if (customerType !== "VAT" && customerType !== "NON_VAT") {
      return NextResponse.json(
        { success: false, message: "Customer type is required." },
        { status: 400 }
      );
    }

    if (customerType === "VAT" && !vatNumber) {
      return NextResponse.json(
        { success: false, message: "VAT number is required for VAT customers." },
        { status: 400 }
      );
    }

    if (customerCode) {
      const existingCustomer = await prisma.customer.findUnique({
        where: {
          customerCode,
        },
        select: {
          id: true,
        },
      });

      if (existingCustomer) {
        return NextResponse.json(
          { success: false, message: "A customer with this ID already exists." },
          { status: 400 }
        );
      }
    }

    if (email) {
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          email,
        },
        select: {
          id: true,
        },
      });

      if (existingCustomer) {
        return NextResponse.json(
          { success: false, message: "A customer with this email already exists." },
          { status: 400 }
        );
      }
    }

    const customer = await prisma.customer.create({
      data: {
        customerCode,
        customerName,
        contactPerson,
        phone,
        email,
        address,
        position,
        customerType,
        vatNumber: customerType === "VAT" ? vatNumber : null,
        isActive: true,
        addresses:
          addresses.length > 0
            ? {
                create: addresses,
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

    return NextResponse.json(
      {
        success: true,
        data: formatCustomer(customer),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create customer:", error);

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
          error instanceof Error ? error.message : "Failed to create customer.",
      },
      { status: 500 }
    );
  }
}
