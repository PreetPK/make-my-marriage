import "server-only";
import { ObjectId } from "mongodb";
import type { CurrentStaff } from "@/server/auth/authorization";
import {
  accountCollections,
  allowAccountAttempt,
  ensureAccountStorage,
} from "@/features/accounts/server/repository";
import { hashPassword } from "@/features/accounts/server/password";
import { findWedding } from "@/features/wedding-onboarding/server/repository";
import {
  invitationEmailConfiguration,
  sendStaffInvitation,
} from "@/server/providers/resend";
import {
  acceptInvitationSchema,
  invitationTokenSchema,
  inviteMemberSchema,
} from "../schemas";
import {
  ensureMemberStorage,
  memberCollections,
  type StaffInvitation,
} from "./repository";
import {
  invitationToken,
  INVITATION_LIFETIME_MS,
  SEND_RETRY_WINDOW_MS,
  tokenDigest,
  tokenMatches,
} from "./tokens";
export class MemberError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function checkAdmin(staff: CurrentStaff) {
  const { users } = await accountCollections();
  if (
    !ObjectId.isValid(staff.id) ||
    !ObjectId.isValid(staff.weddingId) ||
    staff.role !== "admin" ||
    !(await users.findOne({
      _id: new ObjectId(staff.id),
      weddingId: new ObjectId(staff.weddingId),
      role: "admin",
      status: "active",
    }))
  )
    throw new MemberError("Admin access is required.", 403);
  const wedding = await findWedding(staff.weddingId);
  if (!wedding || wedding.status !== "active")
    throw new MemberError("Finish wedding setup first.", 409);
  return wedding;
}
export async function getMembers(staff: CurrentStaff) {
  const wedding = await checkAdmin(staff);
  const { users } = await accountCollections();
  const { invitations } = await memberCollections();
  const scope = { weddingId: new ObjectId(staff.weddingId) };
  const [members, pending] = await Promise.all([
    users
      .find({ ...scope, status: { $in: ["active", "revoked"] } })
      .sort({ createdAt: 1, _id: 1 })
      .toArray(),
    invitations
      .find({ ...scope, status: "pending" })
      .sort({ createdAt: -1 })
      .toArray(),
  ]);
  return {
    members: members.map((user) => ({
      id: user._id.toHexString(),
      name: user.name,
      email: user.email,
      label:
        user.role === "organizer"
          ? "Organizer"
          : wedding.ownerUserId?.equals(user._id)
            ? "Owner"
            : wedding.ownerUserId
              ? "Co-owner"
              : "Admin",
      status: user.status,
      revocable: user.role === "organizer" && user.status === "active",
    })),
    invitations: pending.map((invite) => ({
      id: invite._id.toHexString(),
      email: invite.email,
      role: invite.role === "coowner" ? "Co-owner" : "Organizer",
      expiresAt: invite.expiresAt.toISOString(),
      delivery:
        invite.expiresAt.getTime() <= Date.now()
          ? "Expired"
          : invite.delivery === "accepted_by_provider"
            ? "Email accepted by provider"
            : invite.delivery === "failed"
              ? "Send failed"
              : "Send awaiting confirmation",
      retryable:
        invite.delivery !== "accepted_by_provider" &&
        Date.now() < invite.createdAt.getTime() + SEND_RETRY_WINDOW_MS,
    })),
  };
}
async function deliver(invite: StaffInvitation) {
  if (invite.status !== "pending" || invite.expiresAt.getTime() <= Date.now())
    throw new MemberError("This invitation is no longer available.", 409);
  if (invite.delivery === "accepted_by_provider")
    return { message: "Invitation email accepted by provider." };
  if (Date.now() >= invite.createdAt.getTime() + SEND_RETRY_WINDOW_MS)
    throw new MemberError(
      "The retry window has ended. Cancel this invitation and send a new one.",
      409,
    );
  const token = invitationToken(invite._id.toHexString());
  if (!tokenMatches(token, invite.tokenHash))
    throw new MemberError(
      "Server configuration changed. Cancel this invitation and send a new one.",
      409,
    );
  const { invitations } = await memberCollections();
  let providerId: string;
  try {
    providerId = await sendStaffInvitation({
      id: invite._id.toHexString(),
      email: invite.email,
      role: invite.role === "coowner" ? "co-owner" : "organizer",
      token,
      expiresAt: invite.expiresAt,
    });
  } catch {
    await invitations.updateOne(
      {
        _id: invite._id,
        status: "pending",
        delivery: { $ne: "accepted_by_provider" },
      },
      { $set: { delivery: "failed" } },
    );
    throw new MemberError(
      "Invitation saved, but email sending was not confirmed. Retry from Members. The development sender can send only to your Resend account email.",
      503,
    );
  }
  await invitations.updateOne(
    { _id: invite._id, status: "pending" },
    { $set: { delivery: "accepted_by_provider", providerId } },
  );
  return { message: "Invitation email accepted by provider." };
}
export async function inviteMember(staff: CurrentStaff, input: unknown) {
  await checkAdmin(staff);
  const parsed = inviteMemberSchema.safeParse(input);
  if (!parsed.success)
    throw new MemberError("Check the email address and invitation role.", 400);
  // Validate before storing a pending reservation, without logging configuration.
  try {
    invitationEmailConfiguration();
  } catch {
    throw new MemberError(
      "Configure RESEND_API_KEY, STAFF_EMAIL_FROM and APP_URL before sending invitations.",
      503,
    );
  }
  const { email, role, clientRequestId } = parsed.data;
  await ensureAccountStorage();
  await ensureMemberStorage();
  const { database, invitations } = await memberCollections();
  const { users } = await accountCollections();
  const weddingId = new ObjectId(staff.weddingId),
    actorId = new ObjectId(staff.id),
    emailNormalized = email.toLowerCase();
  // Replayed form submissions can send again too, so apply the limit first.
  if (!(await allowAccountAttempt("invite:" + staff.id, 20, 15 * 60_000)))
    throw new MemberError("Too many invitations. Try again later.", 429);
  const existing = await invitations.findOne({ weddingId, clientRequestId });
  if (existing) {
    if (
      !existing.createdBy.equals(actorId) ||
      existing.emailNormalized !== emailNormalized ||
      existing.role !== role
    )
      throw new MemberError(
        "This request was already used for another invitation.",
        409,
      );
    return deliver(existing);
  }
  const now = new Date(),
    id = new ObjectId(),
    userId = new ObjectId();
  const invitation: StaffInvitation = {
    _id: id,
    weddingId,
    userId,
    createdBy: actorId,
    email,
    emailNormalized,
    role,
    clientRequestId,
    tokenHash: tokenDigest(invitationToken(id.toHexString())),
    status: "pending",
    delivery: "pending",
    createdAt: now,
    expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS),
  };
  let savedInvitation = invitation;
  const session = database.client.startSession();
  try {
    savedInvitation = await session.withTransaction(
      async () => {
        // Writing the actor coordinates organizer revocation with authorized writes.
        if (
          !(
            await users.updateOne(
              { _id: actorId, weddingId, role: "admin", status: "active" },
              { $inc: { accessRevision: 1 } },
              { session },
            )
          ).matchedCount
        )
          throw new MemberError("Admin access is required.", 403);
        const retry = await invitations.findOne(
          { weddingId, clientRequestId },
          { session },
        );
        if (retry) {
          if (
            !retry.createdBy.equals(actorId) ||
            retry.emailNormalized !== emailNormalized ||
            retry.role !== role
          )
            throw new MemberError(
              "This request was already used for another invitation.",
              409,
            );
          return retry;
        }
        if (await users.findOne({ emailNormalized }, { session }))
          throw new MemberError(
            "This email already has an account or pending invitation. Cancel an old invitation first. Accounts cannot join two weddings.",
            409,
          );
        await users.insertOne(
          {
            _id: userId,
            weddingId,
            name: "",
            email,
            emailNormalized,
            role: role === "coowner" ? "admin" : "organizer",
            status: "invited",
            invitationId: id.toHexString(),
            sessionVersion: 1,
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );
        await invitations.insertOne(invitation, { session });
        return invitation;
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        timeoutMS: 30000,
        maxCommitTimeMS: 10000,
      },
    );
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000) {
      const retry = await invitations.findOne({ weddingId, clientRequestId });
      if (
        retry &&
        retry.createdBy.equals(actorId) &&
        retry.emailNormalized === emailNormalized &&
        retry.role === role
      )
        return deliver(retry);
      throw new MemberError(
        "This email already has an account or pending invitation.",
        409,
      );
    }
    throw error;
  } finally {
    await session.endSession();
  }
  return deliver(savedInvitation);
}
export async function invitationDetails(token: string) {
  if (!invitationTokenSchema.safeParse(token).success) return null;
  const { invitations } = await memberCollections();
  const invitation = await invitations.findOne({
    _id: new ObjectId(token.split(".")[0]),
    status: "pending",
    expiresAt: { $gt: new Date() },
  });
  if (!invitation || !tokenMatches(token, invitation.tokenHash)) return null;
  const wedding = await findWedding(invitation.weddingId.toHexString());
  if (!wedding || wedding.status !== "active") return null;
  return {
    email: invitation.email,
    role: invitation.role === "coowner" ? "Co-owner" : "Organizer",
  };
}
export async function acceptInvitation(input: unknown) {
  const parsed = acceptInvitationSchema.safeParse(input);
  if (!parsed.success)
    throw new MemberError("Check your invitation and account details.", 400);
  const { token, email, name, password } = parsed.data;
  if (
    !(await allowAccountAttempt(
      "accept:" + tokenDigest(email.toLowerCase()),
      10,
      15 * 60_000,
    )) ||
    !(await allowAccountAttempt("accept:global", 120, 15 * 60_000))
  )
    throw new MemberError("Too many attempts. Try again later.", 429);
  const { database, invitations } = await memberCollections();
  const { users } = await accountCollections();
  const id = new ObjectId(token.split(".")[0]);
  const found = await invitations.findOne({
    _id: id,
    status: "pending",
    expiresAt: { $gt: new Date() },
  });
  if (
    !found ||
    !tokenMatches(token, found.tokenHash) ||
    found.emailNormalized !== email.toLowerCase()
  )
    throw new MemberError(
      "This invitation is unavailable, expired or already used.",
      400,
    );
  const passwordHash = await hashPassword(password);
  const session = database.client.startSession();
  try {
    await session.withTransaction(
      async () => {
        const now = new Date();
        const consumed = await invitations.findOneAndUpdate(
          {
            _id: id,
            tokenHash: found.tokenHash,
            status: "pending",
            expiresAt: { $gt: now },
          },
          { $set: { status: "accepted", acceptedAt: now } },
          { session, returnDocument: "after" },
        );
        if (
          !consumed ||
          !(await database
            .collection("weddings")
            .findOne({ _id: found.weddingId, status: "active" }, { session }))
        )
          throw new MemberError(
            "This invitation is unavailable, expired or already used.",
            400,
          );
        const updated = await users.updateOne(
          {
            _id: found.userId,
            weddingId: found.weddingId,
            emailNormalized: found.emailNormalized,
            status: "invited",
            invitationId: id.toHexString(),
          },
          {
            $set: {
              name,
              status: "active",
              role: found.role === "coowner" ? "admin" : "organizer",
              credential: { passwordHash, changedAt: now },
              updatedAt: now,
            },
            $unset: { invitationId: "" },
          },
          { session },
        );
        if (!updated.matchedCount)
          throw new MemberError("This invitation is no longer available.", 409);
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        timeoutMS: 30000,
        maxCommitTimeMS: 10000,
      },
    );
  } finally {
    await session.endSession();
  }
  return {
    message: "Account created. Sign in to join your wedding workspace.",
  };
}
export async function memberAction(
  staff: CurrentStaff,
  id: string,
  action: string,
) {
  await checkAdmin(staff);
  if (
    !/^[a-f0-9]{24}$/.test(id) ||
    !["retry", "cancel", "revoke"].includes(action)
  )
    throw new MemberError("Invalid member action.", 400);
  const { database, invitations } = await memberCollections();
  const { users } = await accountCollections();
  const weddingId = new ObjectId(staff.weddingId),
    targetId = new ObjectId(id);
  if (action === "retry") {
    if (!(await allowAccountAttempt("invite:" + staff.id, 20, 15 * 60_000)))
      throw new MemberError("Too many attempts. Try again later.", 429);
    const invitation = await invitations.findOne({ _id: targetId, weddingId });
    if (!invitation) throw new MemberError("Invitation not found.", 404);
    return deliver(invitation);
  }
  const session = database.client.startSession();
  try {
    await session.withTransaction(
      async () => {
        if (
          !(
            await users.updateOne(
              {
                _id: new ObjectId(staff.id),
                weddingId,
                role: "admin",
                status: "active",
              },
              { $inc: { accessRevision: 1 } },
              { session },
            )
          ).matchedCount
        )
          throw new MemberError("Admin access is required.", 403);
        if (action === "cancel") {
          const invite = await invitations.findOneAndUpdate(
            { _id: targetId, weddingId, status: "pending" },
            { $set: { status: "cancelled", cancelledAt: new Date() } },
            { session, returnDocument: "after" },
          );
          if (!invite)
            throw new MemberError("Pending invitation not found.", 404);
          await users.deleteOne(
            {
              _id: invite.userId,
              weddingId,
              status: "invited",
              invitationId: id,
            },
            { session },
          );
        } else {
          // No owner/admin removal or promotion controls in this slice.
          const result = await users.updateOne(
            { _id: targetId, weddingId, status: "active", role: "organizer" },
            {
              $set: { status: "revoked", updatedAt: new Date() },
              $inc: { sessionVersion: 1 },
            },
            { session },
          );
          if (!result.matchedCount)
            throw new MemberError("Active organizer not found.", 404);
        }
      },
      {
        readConcern: { level: "snapshot" },
        writeConcern: { w: "majority" },
        timeoutMS: 30000,
        maxCommitTimeMS: 10000,
      },
    );
  } finally {
    await session.endSession();
  }
  return {
    message:
      action === "cancel"
        ? "Invitation cancelled."
        : "Organizer access revoked. Saved wedding records were preserved.",
  };
}
