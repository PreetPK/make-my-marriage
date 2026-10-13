import { getCurrentStaff } from "@/server/auth/authorization";
import {
  isSameOrigin,
  readAccountBody,
  RequestBodyError,
} from "@/server/http/requests";
import {
  OnboardingError,
  saveOnboarding,
} from "@/features/wedding-onboarding/server/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function reply(body: object, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function PATCH(request: Request) {
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
    return reply({ state: await saveOnboarding(staff, input) });
  } catch (error) {
    if (error instanceof OnboardingError)
      return reply(
        { message: error.message, code: error.code, fields: error.fields },
        error.status,
      );
    return reply(
      {
        message: "We couldn’t save your wedding details. Please try again.",
        code: "UNAVAILABLE",
      },
      503,
    );
  }
}
