import { getCurrentStaff } from "@/server/auth/authorization";
import { memberAction, MemberError } from "@/features/members/server/service";
import {
  isSameOrigin,
  readAccountBody,
  RequestBodyError,
} from "@/server/http/requests";
import { z } from "zod";
export const runtime = "nodejs";
const actionSchema = z
  .object({ action: z.enum(["retry", "cancel", "revoke"]) })
  .strict();
function reply(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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
    const parsed = actionSchema.safeParse(input);
    if (!parsed.success)
      return reply({ message: "Invalid member action." }, 400);
    return reply(
      await memberAction(staff, (await context.params).id, parsed.data.action),
    );
  } catch (error) {
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
}
