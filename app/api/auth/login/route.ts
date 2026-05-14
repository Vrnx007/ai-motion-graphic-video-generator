import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import argon2 from "argon2";
import { db } from "@/lib/prisma";
import { signSessionToken, SESSION_COOKIE, timingSafeStringEqual } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const emailEnv = process.env.APP_LOGIN_EMAIL?.trim().toLowerCase();
    const passwordHashEnv = process.env.APP_LOGIN_PASSWORD_HASH?.trim();
    const passwordPlainEnv = process.env.APP_LOGIN_PASSWORD ?? "";

    if (!emailEnv) {
      return NextResponse.json(
        { error: "Server login is not configured. Set APP_LOGIN_EMAIL." },
        { status: 500 }
      );
    }

    if (!passwordHashEnv && !passwordPlainEnv) {
      return NextResponse.json(
        {
          error: "Set APP_LOGIN_PASSWORD (or APP_LOGIN_PASSWORD_HASH with argon2id for stricter setups).",
        },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!timingSafeStringEqual(email, emailEnv)) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    let passwordOk = false;
    if (passwordHashEnv) {
      try {
        passwordOk = await argon2.verify(passwordHashEnv, password);
      } catch {
        passwordOk = false;
      }
    } else {
      passwordOk = timingSafeStringEqual(password, passwordPlainEnv);
    }

    if (!passwordOk) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const displayName = process.env.APP_USER_NAME?.trim() || "Owner";

    const user = await db.user.upsert({
      where: { email: emailEnv },
      create: {
        email: emailEnv,
        name: displayName,
        emailVerified: true,
      },
      update: {
        name: displayName,
      },
    });

    const token = signSessionToken(user.id);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, image: user.image },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Login failed";
    console.error("[login]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
