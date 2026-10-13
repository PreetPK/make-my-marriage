import NextAuth from "next-auth";
import { NextRequest } from "next/server";
import {
  isSameOrigin,
  readAccountBody,
  RequestBodyError,
} from "@/server/http/requests";
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
    if (request.method === "POST") {
      if (!isSameOrigin(request))
        return Response.json(
          { message: "Invalid request origin." },
          { status: 403, headers: { "Cache-Control": "no-store" } },
        );
      const contentType = request.headers
        .get("content-type")
        ?.split(";")[0]
        .trim();
      if (
        !contentType ||
        !["application/json", "application/x-www-form-urlencoded"].includes(
          contentType,
        )
      )
        return Response.json(
          { message: "Invalid request content type." },
          { status: 415 },
        );
      const body = await readAccountBody(request);
      if (contentType === "application/json") {
        try {
          JSON.parse(body.toString("utf8"));
        } catch {
          throw new RequestBodyError("Invalid request.", 400);
        }
      }
      request = new NextRequest(request.url, {
        method: "POST",
        headers: request.headers,
        body,
      });
    }
    return await NextAuth(authOptions())(request, context);
  } catch (error) {
    if (error instanceof RequestBodyError)
      return Response.json(
        { message: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    return Response.json(
      { message: "Authentication is temporarily unavailable." },
      { status: 503 },
    );
  }
}
export { handler as GET, handler as POST };
