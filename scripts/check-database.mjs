import {
  closeDatabaseConnection,
  DatabaseConfigurationError,
  getDatabase,
} from "../src/server/db/mongodb.ts";

try {
  const database = await getDatabase();
  await database.command({ ping: 1 });
  console.log(
    "MongoDB connection and ping succeeded. No application records were changed.",
  );
} catch (error) {
  // Driver errors can contain connection details. Never print them or the URI.
  console.error(
    error instanceof DatabaseConfigurationError
      ? error.message
      : "MongoDB check failed. Check Atlas network access, database credentials, and cluster availability.",
  );
  process.exitCode = 1;
} finally {
  await closeDatabaseConnection().catch(() => {
    console.error("MongoDB connection cleanup failed.");
    process.exitCode = 1;
  });
}
