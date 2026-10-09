import {
  AccountInputError,
  signupAdmin,
} from "@/features/accounts/server/service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  // All mutations are POST and require the configured same-origin browser.
  if (
    !process.env.APP_URL ||
    request.headers.get("origin") !== new URL(process.env.APP_URL).origin
  )
    return Response.json(
      { message: "Invalid request origin." },
      { status: 403 },
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ message: "JSON required." }, { status: 415 });
  const reader = request.body?.getReader();
  if (!reader)
    return Response.json({ message: "Invalid request." }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      return Response.json({ message: "Request too large." }, { status: 413 });
    }
    chunks.push(value);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (Buffer.byteLength(text) > 8192)
    return Response.json({ message: "Request too large." }, { status: 413 });
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return Response.json({ message: "Invalid request." }, { status: 400 });
  }
  try {
    return Response.json(await signupAdmin(input), { status: 201 });
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof AccountInputError
            ? error.message
            : "Account service is temporarily unavailable.",
      },
      { status: error instanceof AccountInputError ? 400 : 503 },
    );
  }
}
