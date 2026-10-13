import "server-only";

export class RequestBodyError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413,
  ) {
    super(message);
  }
}

export function isSameOrigin(request: Request) {
  try {
    const url = new URL(
      process.env.APP_URL ??
        process.env.NEXTAUTH_URL ??
        "http://localhost:3000",
    );
    return (
      ["http:", "https:"].includes(url.protocol) &&
      request.headers.get("origin") === url.origin
    );
  } catch {
    return false;
  }
}

export async function readAccountBody(request: Request) {
  const limit = 8192;
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit)
    throw new RequestBodyError("Request too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyError("Request too large.", 413);
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError("Invalid request.", 400);
  } finally {
    reader.releaseLock();
  }
}
