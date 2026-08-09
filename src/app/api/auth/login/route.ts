import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type LoginInput = {
  email?: string;
  password?: string;
};

function unauthorized() {
  return NextResponse.json(
    { success: false, message: "Invalid email or password." },
    { status: 401 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as LoginInput;
    const email = body.email?.trim();
    const password = body.password ?? "";

    if (!email || !password) {
      return unauthorized();
    }

    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user || !user.isActive || !user.passwordHash) {
      return unauthorized();
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return unauthorized();
    }

    const token = await createSessionToken(user);

    const response = NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("Login failed:", error);

    return NextResponse.json(
      { success: false, message: "Login failed." },
      { status: 500 }
    );
  }
}
