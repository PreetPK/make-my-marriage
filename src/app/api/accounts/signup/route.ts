import {
  AccountInputError,
  AccountRateLimitError,
  signupAdmin,
} from "@/features/accounts/server/service";
import {
  isSameOrigin,
  readAccountBody,
  RequestBodyError,
} from "@/server/http/requests";
export const runtime = "nodejs";
function reply(message: string, status: number, headers?: HeadersInit) {
  return Response.json(
    { message },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return reply("Invalid request origin.", 403);
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    return reply("JSON required.", 415);
  let input: unknown;
  try {
    input = JSON.parse((await readAccountBody(request)).toString("utf8"));
  } catch (error) {
    return error instanceof RequestBodyError
      ? reply(error.message, error.status)
      : reply("Invalid request.", 400);
  }
  try {
    return Response.json(await signupAdmin(input), {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AccountRateLimitError)
      return reply(error.message, 429, { "Retry-After": "900" });
    return reply(
      error instanceof AccountInputError
        ? error.message
        : "Account service is temporarily unavailable.",
      error instanceof AccountInputError ? 400 : 503,
    );
  }
}
