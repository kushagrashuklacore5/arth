// Runs in the PAGE's own JavaScript world at document_start, and does nothing
// unless this tab is the Ask AI worker/workspace tab (flag set by worker.js).
//
// Why: signed-in ChatGPT renders an answer from requestAnimationFrame callbacks,
// and Chrome never runs those in a hidden tab. Measured in the hidden worker tab:
// 0 callbacks in 2 s, generation finished, answer element empty, forever. So
// while this tab is hidden, frame callbacks are run from a timer instead.

(() => {
  // window.name belongs to the tab, not the page: it survives reloads and is
  // readable here before any page script runs. worker.js sets it on the first
  // PING, and the service worker reloads the tab before every job, so the page
  // a job runs on always starts with the name already set.
  if (window.name !== 'ask-ai-worker-tab') return;

  const nativeRequest = window.requestAnimationFrame.bind(window);
  const nativeCancel = window.cancelAnimationFrame.bind(window);
  // ponytail: timer-paced, so about one frame per second under Chrome's
  // background throttling (measured 11-13 s per answer, also after 5+ minutes
  // hidden). A MessageChannel is not throttled (measured ~10 s) but is unpaced;
  // switch to it only if timers ever become too slow.
  // Our ids are negative so cancel can tell them from native ones.
  window.requestAnimationFrame = (callback) =>
    document.visibilityState === 'hidden' ? -setTimeout(() => callback(performance.now()), 16) : nativeRequest(callback);
  window.cancelAnimationFrame = (id) => (id < 0 ? clearTimeout(-id) : nativeCancel(id));
})();
