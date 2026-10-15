import {
  acceptInvitation,
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
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
export async function POST(request: Request) {
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
    return reply(await acceptInvitation(input), 201);
  } catch (error) {
    return reply(
      {
        message:
          error instanceof MemberError || error instanceof RequestBodyError
            ? error.message
            : "Account service is temporarily unavailable. If you already submitted, try signing in.",
      },
      error instanceof MemberError || error instanceof RequestBodyError
        ? error.status
        : 503,
    );
  }
}
