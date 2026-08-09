import "dotenv/config";

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type CreatedByRole } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

type SeedUser = {
  name: string;
  email: string;
  password: string;
  role: CreatedByRole;
};

const users: SeedUser[] = [
  {
    name: "Admin User",
    email: "admin@ransay.local",
    password: "Admin@123",
    role: "ADMIN",
  },
  {
    name: "Superadmin User",
    email: "superadmin@ransay.local",
    password: "Superadmin@123",
    role: "SUPERADMIN",
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 12);

    await prisma.user.upsert({
      where: {
        email: user.email,
      },
      update: {
        name: user.name,
        passwordHash,
        role: user.role,
        isActive: true,
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
        isActive: true,
      },
    });

    console.log(`Seeded auth user: ${user.email}`);
  }
}

main()
  .catch((error) => {
    console.error("Failed to seed auth users:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
