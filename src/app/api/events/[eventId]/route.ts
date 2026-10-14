import { EVENT_REQUEST_BODY_LIMIT } from "@/features/events/schemas";
import { getCurrentStaff } from "@/server/auth/authorization";
import {
  isSameOrigin,
  readRequestBody,
  RequestBodyError,
} from "@/server/http/requests";
import {
  getEvent,
  saveEvent,
  EventError,
} from "@/features/events/server/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ eventId: string }> };
function reply(body: object, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function failure(error: unknown) {
  if (error instanceof EventError)
    return reply(
      { message: error.message, code: error.code, fields: error.fields },
      error.status,
    );
  return reply(
    {
      message: "This event is temporarily unavailable. Please try again.",
      code: "UNAVAILABLE",
    },
    503,
  );
}
export async function GET(_request: Request, { params }: Context) {
  try {
    const staff = await getCurrentStaff();
    if (!staff)
      return reply(
        { message: "Sign in to continue.", code: "UNAUTHENTICATED" },
        401,
      );
    return reply({ event: await getEvent(staff, (await params).eventId) });
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request, { params }: Context) {
  if (!isSameOrigin(request))
    return reply({ message: "Invalid request origin." }, 403);
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    return reply({ message: "JSON required." }, 415);
  let input: unknown;
  try {
    input = JSON.parse(
      (await readRequestBody(request, EVENT_REQUEST_BODY_LIMIT)).toString(
        "utf8",
      ),
    );
  } catch (error) {
    return reply(
      {
        message:
          error instanceof RequestBodyError
            ? error.message
            : "Invalid request.",
      },
      error instanceof RequestBodyError ? error.status : 400,
    );
  }
  try {
    const staff = await getCurrentStaff();
    if (!staff)
      return reply(
        { message: "Sign in to continue.", code: "UNAUTHENTICATED" },
        401,
      );
    return reply(await saveEvent(staff, (await params).eventId, input));
  } catch (error) {
    return failure(error);
  }
}
