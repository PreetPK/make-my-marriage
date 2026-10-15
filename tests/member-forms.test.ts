import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AcceptForm } from "../src/features/members/components/accept-form";
import { InviteForm } from "../src/features/members/components/invite-form";
test("invitation forms cannot submit credentials through GET or before hydration", () => {
  for (const form of [
    createElement(AcceptForm, {
      token: "a".repeat(24) + "." + "b".repeat(64),
      email: "fixture@example.invalid",
      role: "Co-owner",
    }),
    createElement(InviteForm),
  ]) {
    const html = renderToStaticMarkup(form);
    assert.match(html, /<form\b[^>]*method="post"/);
    assert.match(html, /<fieldset\b[^>]*disabled=""/);
    assert.doesNotMatch(html, /method="get"/i);
  }
});
