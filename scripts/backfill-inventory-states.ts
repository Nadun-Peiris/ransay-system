import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (process.env.CONFIRM_BACKFILL_INVENTORY_STATES !== "true") {
    throw new Error(
      "Set CONFIRM_BACKFILL_INVENTORY_STATES=true to run this development backfill."
    );
  }

  const orders = await prisma.order.findMany({
    where: {
      deletedAt: null,
      orderStatus: {
        notIn: ["DELETED", "CANCELLED"],
      },
      deliveryStatus: "NOT_DISPATCHED",
      stockMovements: {
        none: {
          movementType: "ORDER_COMMIT",
        },
      },
    },
    include: {
      items: true,
    },
  });

  console.log(`Found ${orders.length} not-dispatched orders to backfill.`);

  await prisma.$transaction(async (tx) => {
    for (const order of orders) {
      for (const item of order.items) {
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
            committedBags: {
              increment: item.quantityBags,
            },
            committedKg: {
              increment: item.quantityKg,
            },
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            orderId: order.id,
            movementType: "ORDER_COMMIT",
            quantityBags: item.quantityBags,
            quantityKg: item.quantityKg,
            createdByUserId: order.createdByUserId,
            reason: `Backfilled committed stock for order ${order.orderId}`,
          },
        });
      }
    }
  });

  console.log("Inventory-state backfill complete.");
}

main()
  .catch((error) => {
    console.error("Failed to backfill inventory states:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
