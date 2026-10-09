import { ensureAccountStorage } from "../src/features/accounts/server/repository";
import { closeDatabaseConnection } from "../src/server/db/mongodb";
ensureAccountStorage()
  .then(() =>
    console.log(
      "Account indexes and validator initialized for public admin signup. No accounts or emails were created.",
    ),
  )
  .catch(() => {
    console.error(
      "Account storage initialization failed. Check Atlas permissions and existing data locally.",
    );
    process.exitCode = 1;
  })
  .finally(() =>
    closeDatabaseConnection().catch(() => {
      process.exitCode = 1;
    }),
  );
