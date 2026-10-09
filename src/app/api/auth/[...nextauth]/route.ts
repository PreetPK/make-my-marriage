import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions, staffAuthReady } from "@/server/auth/config";
export const runtime = "nodejs";
async function handler(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> },
) {
  if (!staffAuthReady())
    return Response.json(
      { message: "Staff authentication is not configured." },
      { status: 503 },
    );
  try {
    return await NextAuth(authOptions())(request, context);
  } catch {
    return Response.json(
      { message: "Authentication is temporarily unavailable." },
      { status: 503 },
    );
  }
}
export { handler as GET, handler as POST };
