import "server-only";
export class EventError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409,
    readonly code: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}
