import { getCurrentStaff } from "@/server/auth/authorization";
import {
  isSameOrigin,
  readAccountBody,
  RequestBodyError,
} from "@/server/http/requests";
import {
  createEvent,
  getEventContext,
  getEvents,
  EventError,
} from "@/features/events/server/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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
      message:
        "Events are temporarily unavailable. Your entries have not been cleared. Please try again.",
      code: "UNAVAILABLE",
    },
    503,
  );
}
export async function GET(request: Request) {
  try {
    const staff = await getCurrentStaff();
    if (!staff)
      return reply(
        { message: "Sign in to continue.", code: "UNAUTHENTICATED" },
        401,
      );
    const params = new URL(request.url).searchParams;
    if (params.get("context") === "1" && params.size === 1)
      return reply({ context: await getEventContext(staff) });
    return reply({ state: await getEvents(staff, Object.fromEntries(params)) });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return reply({ message: "Invalid request origin." }, 403);
  if (
    request.headers.get("content-type")?.split(";")[0].trim() !==
    "application/json"
  )
    return reply({ message: "JSON required." }, 415);
  let input: unknown;
  try {
    input = JSON.parse((await readAccountBody(request)).toString("utf8"));
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
    const result = await createEvent(staff, input);
    return reply(result, result.created ? 201 : 200);
  } catch (error) {
    return failure(error);
  }
}
