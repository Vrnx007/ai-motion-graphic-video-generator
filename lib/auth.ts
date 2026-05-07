import { cookies } from "next/headers";
import { db } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
};

export type AppSession = {
  user: AppUser;
};

export async function getServerSession(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const verified = verifySessionToken(token);
  if (!verified) return null;

  const row = await db.user.findUnique({
    where: { id: verified.userId },
  });
  if (!row) return null;

  return {
    user: {
      id: row.id,
      email: row.email,
      name: row.name,
      image: row.image,
    },
  };
}
