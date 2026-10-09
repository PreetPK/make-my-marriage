import "server-only";
import { MongoClient } from "mongodb";
import { z } from "zod";

const configurationSchema = z.object({
  MONGODB_URI: z.string().regex(/^mongodb(?:\+srv)?:\/\/\S+$/),
  MONGODB_DATABASE: z
    .string()
    .trim()
    .min(1)
    .regex(/^[^\/\\. "$*<>:|?\u0000]+$/),
});

export class DatabaseConfigurationError extends Error {
  constructor() {
    super(
      "Set valid MONGODB_URI and MONGODB_DATABASE in your server environment.",
    );
    this.name = "DatabaseConfigurationError";
  }
}

// Reuse the pool across requests and development hot reloads in this process.
const state = globalThis as typeof globalThis & {
  marriageMongoClient?: Promise<MongoClient>;
};

function readConfiguration() {
  const result = configurationSchema.safeParse({
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DATABASE: process.env.MONGODB_DATABASE,
  });
  if (!result.success) throw new DatabaseConfigurationError();
  return result.data;
}

export async function getDatabase() {
  // Lazy validation keeps UI previews and builds independent of credentials.
  const configuration = readConfiguration();
  if (!state.marriageMongoClient) {
    let client: MongoClient;
    try {
      client = new MongoClient(configuration.MONGODB_URI, {
        serverSelectionTimeoutMS: 10_000,
        connectTimeoutMS: 10_000,
      });
    } catch {
      throw new DatabaseConfigurationError();
    }
    state.marriageMongoClient = client.connect().catch(async () => {
      state.marriageMongoClient = undefined;
      await client.close().catch(() => undefined);
      throw new Error(
        "MongoDB connection failed. Check server configuration and Atlas access.",
      );
    });
  }
  const client = await state.marriageMongoClient;
  return client.db(configuration.MONGODB_DATABASE);
}

// For short-lived maintenance scripts; request handlers keep the pool open.
export async function closeDatabaseConnection() {
  const connection = state.marriageMongoClient;
  state.marriageMongoClient = undefined;
  if (connection) await (await connection).close();
}
