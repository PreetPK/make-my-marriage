import "server-only";
import { z } from "zod";

const envSchema = z.object({
  APP_ENV: z
    .enum(["development", "test", "preview", "production"])
    .default("development"),
  APP_URL: z.url({ protocol: /^https?$/ }).default("http://localhost:3000"),
});

const result = envSchema.safeParse({
  APP_ENV: process.env.APP_ENV,
  APP_URL: process.env.APP_URL,
});

if (!result.success) {
  const fields = [
    ...new Set(result.error.issues.map((issue) => issue.path.join("."))),
  ];
  // Report field names only; configuration values may contain secrets later.
  throw new Error(`Invalid application configuration: ${fields.join(", ")}`);
}

export const env = result.data;
