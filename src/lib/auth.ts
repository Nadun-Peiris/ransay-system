import { jwtVerify, SignJWT } from "jose";
import type { NextRequest } from "next/server";
import type { CreatedByRole, User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE_NAME = "ransay_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type SessionUser = Pick<User, "id" | "email" | "role">;

export type SessionPayload = {
  userId: string;
  email: string | null;
  role: CreatedByRole;
};

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is not configured.");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(user: SessionUser) {
  return new SignJWT({
    userId: user.id,
    email: user.email,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getAuthSecret());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, getAuthSecret());

  if (
    typeof payload.userId !== "string" ||
    (payload.email !== null && typeof payload.email !== "string") ||
    (payload.role !== "ADMIN" && payload.role !== "SUPERADMIN")
  ) {
    throw new Error("Unauthorized");
  }

  return {
    userId: payload.userId,
    email: payload.email ?? null,
    role: payload.role,
  } satisfies SessionPayload;
}

export async function getCurrentUser(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  let session: SessionPayload;

  try {
    session = await verifySessionToken(token);
  } catch {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.userId,
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return user;
}

export async function requireCurrentUser(request: NextRequest) {
  const user = await getCurrentUser(request);

  if (!user) {
    throw new Error("Unauthorized");
  }

  return user;
}
