import "server-only";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { createHash } from "node:crypto";
import { signInFormSchema } from "@/features/accounts/schemas";
import {
  allowAccountAttempt,
  findActiveStaff,
  findStaffByEmail,
} from "@/features/accounts/server/repository";
import {
  hashPassword,
  verifyPassword,
} from "@/features/accounts/server/password";

export function staffAuthReady() {
  return Boolean(
    process.env.NEXTAUTH_SECRET &&
    process.env.NEXTAUTH_SECRET.length >= 32 &&
    process.env.NEXTAUTH_URL &&
    process.env.MONGODB_URI &&
    process.env.MONGODB_DATABASE,
  );
}
let dummyHash: Promise<string> | undefined;
export function authOptions(): NextAuthOptions {
  if (!staffAuthReady())
    throw new Error("Staff authentication is not configured.");
  return {
    secret: process.env.NEXTAUTH_SECRET,
    session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
    pages: { signIn: "/login", error: "/login" },
    logger: {
      error() {
        console.error("Staff authentication failed.");
      },
      warn() {},
      debug() {},
    },
    providers: [
      CredentialsProvider({
        name: "Staff",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        async authorize(input) {
          const parsed = signInFormSchema.safeParse({
            email: input?.email,
            password: input?.password,
          });
          if (!parsed.success) return null;
          const { email, password } = parsed.data;
          const key = createHash("sha256")
            .update(email.toLowerCase())
            .digest("hex");
          try {
            if (!(await allowAccountAttempt("login:global", 120, 15 * 60_000)))
              return null;
            if (!(await allowAccountAttempt(`login:${key}`, 10, 15 * 60_000)))
              return null;
            const user = await findStaffByEmail(email.toLowerCase());
            dummyHash ??= hashPassword(
              "Unusable dummy verification credential.",
            );
            const valid = await verifyPassword(
              password,
              user?.credential?.passwordHash ?? (await dummyHash),
            );
            if (
              !valid ||
              !user ||
              !(await findActiveStaff(
                user._id.toHexString(),
                user.sessionVersion,
              ))
            )
              return null;
            return {
              id: user._id.toHexString(),
              sessionVersion: user.sessionVersion,
            };
          } catch {
            return null;
          }
        },
      }),
    ],
    callbacks: {
      async jwt({ token, user }) {
        if (user) {
          token.sub = user.id;
          token.sessionVersion = user.sessionVersion;
          token.staffIssuedAt = Date.now();
        }
        if (
          typeof token.sub !== "string" ||
          typeof token.sessionVersion !== "number" ||
          typeof token.staffIssuedAt !== "number" ||
          Date.now() - token.staffIssuedAt >= 12 * 60 * 60_000 ||
          !(await findActiveStaff(token.sub, token.sessionVersion))
        )
          return {};
        return {
          sub: token.sub,
          sessionVersion: token.sessionVersion,
          staffIssuedAt: token.staffIssuedAt,
        };
      },
      async session({ session, token }) {
        // Expose identity only, never the session version or stored password hash.
        session.user =
          typeof token.sub === "string" ? { id: token.sub } : undefined;
        return session;
      },
      async redirect({ url, baseUrl }) {
        if (url === "/login" || url === baseUrl + "/login")
          return baseUrl + "/login";
        return `${baseUrl}/dashboard`;
      },
    },
  };
}
