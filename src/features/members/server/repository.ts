import "server-only";
import { ObjectId } from "mongodb";
import { getDatabase } from "@/server/db/mongodb";
export type StaffInvitation = {
  _id: ObjectId;
  weddingId: ObjectId;
  userId: ObjectId;
  createdBy: ObjectId;
  email: string;
  emailNormalized: string;
  role: "coowner" | "organizer";
  clientRequestId: string;
  tokenHash: string;
  status: "pending" | "accepted" | "cancelled";
  delivery: "pending" | "accepted_by_provider" | "failed";
  createdAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
  cancelledAt?: Date;
  providerId?: string;
};
let storage: Promise<void> | undefined;
export async function memberCollections() {
  const database = await getDatabase();
  return {
    database,
    invitations: database.collection<StaffInvitation>("staffInvitations"),
  };
}
export async function ensureMemberStorage() {
  storage ??= (async () => {
    const { database, invitations } = await memberCollections();
    await invitations.createIndex(
      { weddingId: 1, clientRequestId: 1 },
      { unique: true },
    );
    await invitations.createIndex({ weddingId: 1, status: 1, createdAt: -1 });
    if (!(await database.listCollections({ name: "staffInvitations" }).next()))
      throw new Error("Invitation storage unavailable.");
    await database.command({
      collMod: "staffInvitations",
      validator: {
        $jsonSchema: {
          bsonType: "object",
          required: [
            "weddingId",
            "userId",
            "createdBy",
            "emailNormalized",
            "role",
            "tokenHash",
            "status",
            "delivery",
            "createdAt",
            "expiresAt",
            "clientRequestId",
          ],
          properties: {
            weddingId: { bsonType: "objectId" },
            userId: { bsonType: "objectId" },
            createdBy: { bsonType: "objectId" },
            role: { enum: ["coowner", "organizer"] },
            status: { enum: ["pending", "accepted", "cancelled"] },
            delivery: { enum: ["pending", "accepted_by_provider", "failed"] },
            tokenHash: { bsonType: "string", pattern: "^[a-f0-9]{64}$" },
            createdAt: { bsonType: "date" },
            expiresAt: { bsonType: "date" },
          },
        },
      },
    });
  })().catch((error) => {
    storage = undefined;
    throw error;
  });
  return storage;
}
