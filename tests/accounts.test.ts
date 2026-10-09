import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  verifyPassword,
} from "../src/features/accounts/server/password";
import {
  signupFormSchema,
  signInFormSchema,
} from "../src/features/accounts/schemas";
test("salted password hashes verify only the original password", async () => {
  const password = "Correct horse battery staple";
  const first = await hashPassword(password),
    second = await hashPassword(password);
  assert.notEqual(first, second);
  assert(!first.includes(password));
  assert(await verifyPassword(password, first));
  assert(!(await verifyPassword(password + "!", first)));
  assert(!(await verifyPassword(password, "scrypt$999999999$8$1$bad$bad")));
});
test("signup enforces the approved policy, confirmation, and rejects supplied roles", () => {
  const values = {
    name: "Partner",
    email: " partner@example.com ",
    password: "a".repeat(15),
    confirmPassword: "a".repeat(15),
  };
  assert(signupFormSchema.safeParse(values).success);
  assert(!signupFormSchema.safeParse({ ...values, role: "admin" }).success);
  assert(
    !signupFormSchema.safeParse({
      ...values,
      password: "short",
      confirmPassword: "short",
    }).success,
  );
  assert(
    !signupFormSchema.safeParse({
      ...values,
      confirmPassword: "different",
    }).success,
  );
  assert(
    !signupFormSchema.safeParse({
      ...values,
      password: "a".repeat(129),
      confirmPassword: "a".repeat(129),
    }).success,
  );
  assert(
    signupFormSchema.safeParse({
      ...values,
      password: "😊".repeat(15),
      confirmPassword: "😊".repeat(15),
    }).success,
  );
  assert(
    !signupFormSchema.safeParse({ ...values, token: "a".repeat(64) }).success,
  );
});
test("sign in preserves password whitespace while trimming email", () => {
  const parsed = signInFormSchema.parse({
    email: " staff@example.com ",
    password: " secret ",
  });
  assert.equal(parsed.email, "staff@example.com");
  assert.equal(parsed.password, " secret ");
});
