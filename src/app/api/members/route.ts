import { getCurrentStaff } from "@/server/auth/authorization";
import {
  getMembers,
  inviteMember,
  MemberError,
} from "@/features/members/server/service";
import {
  isSameOrigin,
  readAccountBody,
  RequestBodyError,
} from "@/server/http/requests";
export const runtime = "nodejs";
function reply(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function GET() {
  const staff = await getCurrentStaff();
  if (!staff) return reply({ message: "Sign in first." }, 401);
  try {
    return reply(await getMembers(staff));
  } catch (error) {
    return failure(error);
  }
}
function failure(error: unknown) {
  return reply(
    {
      message:
        error instanceof MemberError || error instanceof RequestBodyError
          ? error.message
          : "Member service is temporarily unavailable.",
    },
    error instanceof MemberError || error instanceof RequestBodyError
      ? error.status
      : 503,
  );
}
export async function POST(request: Request) {
  const staff = await getCurrentStaff();
  if (!staff) return reply({ message: "Sign in first." }, 401);
  if (!isSameOrigin(request))
    return reply({ message: "Invalid request origin." }, 403);
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    return reply({ message: "JSON required." }, 415);
  try {
    const body = await readAccountBody(request);
    let input: unknown;
    try {
      input = JSON.parse(body.toString("utf8"));
    } catch {
      return reply({ message: "Invalid JSON." }, 400);
    }
    return reply(await inviteMember(staff, input), 201);
  } catch (error) {
    return failure(error);
  }
}
