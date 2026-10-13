type HistoryWindow = EventTarget & { location: Pick<Location, "reload"> };

// History can restore a page without rerunning its server authorization check.
// Hide it before a browser snapshot and reload restores through the server.
export function watchAuthHistory(element: HTMLElement, browser: HistoryWindow) {
  let reloadRequested = false;
  const hide = () => {
    element.hidden = true;
  };
  const reload = () => {
    hide();
    if (!reloadRequested) {
      reloadRequested = true;
      browser.location.reload();
    }
  };
  const show = (event: Event) => {
    reloadRequested = false;
    if ((event as PageTransitionEvent).persisted) reload();
  };
  browser.addEventListener("pagehide", hide);
  browser.addEventListener("pageshow", show);
  browser.addEventListener("popstate", reload);
  return () => {
    browser.removeEventListener("pagehide", hide);
    browser.removeEventListener("pageshow", show);
    browser.removeEventListener("popstate", reload);
  };
}
