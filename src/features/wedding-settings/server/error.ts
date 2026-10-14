import "server-only";
export class WeddingSettingsError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 409,
    readonly code: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}
