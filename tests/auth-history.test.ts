import { test } from "node:test";
import assert from "node:assert/strict";
import { watchAuthHistory } from "../src/features/accounts/auth-history";

function fixture() {
  let reloads = 0;
  const element = { hidden: false } as HTMLElement;
  const browser = Object.assign(new EventTarget(), {
    location: {
      reload() {
        reloads++;
      },
    },
  });
  const cleanup = watchAuthHistory(element, browser);
  const show = (persisted: boolean) => {
    const event = new Event("pageshow");
    Object.defineProperty(event, "persisted", { value: persisted });
    browser.dispatchEvent(event);
  };
  return { element, browser, cleanup, show, reloads: () => reloads };
}
test("Back/Forward hides cached auth content and forces a server request", () => {
  const page = fixture();
  page.browser.dispatchEvent(new Event("popstate"));
  assert.equal(page.element.hidden, true);
  assert.equal(page.reloads(), 1);
  page.browser.dispatchEvent(new Event("popstate"));
  assert.equal(page.reloads(), 1);
  page.cleanup();
});
test("BFCache snapshots are hidden and each restoration gets a fresh authorization check", () => {
  const page = fixture();
  page.show(false);
  assert.equal(page.element.hidden, false);
  assert.equal(page.reloads(), 0);
  page.browser.dispatchEvent(new Event("pagehide"));
  assert.equal(page.element.hidden, true);
  page.show(true);
  assert.equal(page.reloads(), 1);
  page.browser.dispatchEvent(new Event("popstate"));
  assert.equal(page.reloads(), 1);
  page.show(true);
  assert.equal(page.reloads(), 2);
  page.cleanup();
});
test("unmounted auth layouts stop handling public-page history", () => {
  const page = fixture();
  page.cleanup();
  page.browser.dispatchEvent(new Event("pagehide"));
  page.browser.dispatchEvent(new Event("popstate"));
  page.show(true);
  assert.equal(page.element.hidden, false);
  assert.equal(page.reloads(), 0);
});
