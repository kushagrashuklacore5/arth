// Service worker: owns the single worker/workspace tab and a serial job queue.
// No DOM knowledge — it only exchanges PING / RESET / RUN / CANCEL with worker.js.

// Keep in sync with START_URL in adapter.js.
const WORKER_URL = 'https://chatgpt.com/?temporary-chat=true';
const READY_TIMEOUT_MS = 30000;
const JOB_TIMEOUT_MS = 90000;
const JOB_GRACE_MS = 5000; // time the worker gets to answer after being told to cancel
const PING_INTERVAL_MS = 500;
const PING_TIMEOUT_MS = 3000;
const MAX_PROMPT_CHARS = 12000;
const MAX_ID_CHARS = 64;

let queue = Promise.resolve(); // serialises jobs; tab creation happens inside a job
let current = null; // { key, tabId } while RUN is in flight
const pending = new Set(); // keys of jobs that are queued or running
const cancelled = new Set(); // pending keys cancelled before they reached RUN

const fail = (code, message) => ({ ok: false, code, message: message || code });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Every message to the worker tab has a deadline. A frozen, crashed or closed
// tab never answers, and without this one stuck tab would block the queue forever.
// Resolves null on no answer.
// PRIMARY: an untargeted message goes to every document in the tab that runs our
// content script. Short-lived extra top-level documents were observed loading
// alongside the real ChatGPT page, so address the tab's main frame explicitly.
const PRIMARY = { frameId: 0 };
function send(tabId, msg, ms) {
  return Promise.race([chrome.tabs.sendMessage(tabId, msg, PRIMARY).catch(() => null), sleep(ms).then(() => null)]);
}
const ping = (tabId) => send(tabId, { type: 'PING' }, PING_TIMEOUT_MS);

async function getTab(tabId) {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return null;
  }
}

async function createWorkerTab() {
  // Deliberately NOT pinned: Chrome restores pinned tabs on every browser start,
  // and the restored tab cannot be re-identified (session storage is cleared),
  // so a pinned worker would leave one orphan tab behind per restart.
  const tab = await chrome.tabs.create({ url: WORKER_URL, active: false });
  await chrome.storage.session.set({ workerTabId: tab.id });
  // Memory Saver would otherwise discard an idle background tab mid-session.
  await chrome.tabs.update(tab.id, { autoDiscardable: false });
  return tab.id;
}

// Forget and close a worker tab that stopped answering; the next job makes a new one.
async function dropWorkerTab(tabId) {
  await chrome.storage.session.remove('workerTabId');
  await chrome.tabs.remove(tabId).catch(() => {});
}

// Polls until the worker reports READY. With `oldDoc`, also requires a different,
// empty document: the page that was just told to reset does not count.
async function waitReady(tabId, oldDoc) {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let st = null;
  let renavigated = false;
  for (;;) {
    st = await ping(tabId);
    if (st?.state === 'READY' && (oldDoc === undefined || (st.doc !== oldDoc && st.messages === 0))) return st;
    if (!st && !renavigated && (await getTab(tabId))?.status === 'complete') {
      // Finished loading but our content script is silent: the tab left ChatGPT.
      renavigated = true;
      await chrome.tabs.update(tabId, { url: WORKER_URL }).catch(() => {});
    }
    if (Date.now() > deadline) break;
    await sleep(PING_INTERVAL_MS);
  }
  const code = st && st.state !== 'READY' ? st.state : 'NOT_READY';
  // unresponsive: the tab never answered at all (as opposed to "needs login").
  throw Object.assign(new Error(code), { code, unresponsive: !st });
}

// Returns the id of a ready worker tab showing a freshly loaded, empty conversation.
async function ensureWorker() {
  let { workerTabId: tabId } = await chrome.storage.session.get('workerTabId');
  if (tabId == null || !(await getTab(tabId))) tabId = await createWorkerTab();
  try {
    const st = await waitReady(tabId);
    // Every job runs on a page loaded after that first answer, for two reasons:
    // - a job cancelled or failed mid-submit can leave ChatGPT's composer stuck
    //   (text in, send never enabled) even though the transcript is empty;
    // - a new tab's first page loaded before worker.js could mark the tab, so
    //   frames.js is not active in it and a signed-in answer would never render.
    await send(tabId, { type: 'RESET' }, PING_TIMEOUT_MS);
    await waitReady(tabId, st.doc);
  } catch (e) {
    if (e.unresponsive) await dropWorkerTab(tabId);
    throw e;
  }
  return tabId;
}

async function runJob(key, prompt, senderTabId) {
  if (cancelled.delete(key)) return fail('CANCELLED');
  // A job would navigate the worker tab, so it can never be the tab that asks.
  const { workerTabId } = await chrome.storage.session.get('workerTabId');
  if (senderTabId === workerTabId) return fail('WORKER_TAB');
  let tabId;
  try {
    tabId = await ensureWorker();
  } catch (e) {
    return fail(e.code || 'NOT_READY', e.message);
  }
  if (cancelled.delete(key)) return fail('CANCELLED');

  current = { key, tabId };
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    cancelJob(key);
  }, JOB_TIMEOUT_MS);
  try {
    const res = await send(tabId, { type: 'RUN', requestId: key, prompt }, JOB_TIMEOUT_MS + JOB_GRACE_MS);
    if (res) return timedOut && !res.ok ? fail('TIMEOUT') : res;
    // No answer. Before the deadline: the tab was closed or navigated mid-job.
    // After it: the tab ignored the cancel too, so it is stuck and gets replaced.
    if (!timedOut) return fail('WORKER_CLOSED');
    await dropWorkerTab(tabId);
    return fail('TIMEOUT');
  } finally {
    clearTimeout(timer);
    current = null;
  }
}

function cancelJob(key) {
  if (current?.key === key) chrome.tabs.sendMessage(current.tabId, { type: 'CANCEL', requestId: key }, PRIMARY).catch(() => {});
  else if (pending.has(key)) cancelled.add(key);
}

// Accept messages only from this extension's content script running in the top
// frame of a web page tab. Extension pages and other frames are refused.
function trustedSender(sender) {
  return sender.id === chrome.runtime.id && sender.tab?.id != null && sender.frameId === 0 && /^https?:/.test(sender.url || '');
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!trustedSender(sender)) return;
  const id = msg?.requestId;
  if (typeof id !== 'string' || !id || id.length > MAX_ID_CHARS) return;
  // Ids are chosen by the sender, so they are only meaningful per sending tab:
  // one tab can never cancel, collide with, or receive another tab's request.
  const key = `${sender.tab.id}:${id}`;
  if (msg.type === 'ASK') {
    const { prompt } = msg;
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT_CHARS || pending.has(key)) {
      sendResponse({ ...fail('BAD_REQUEST'), requestId: id });
      return;
    }
    pending.add(key);
    const result = queue.then(() => runJob(key, prompt, sender.tab.id)).catch((e) => fail('INTERNAL', String(e)));
    queue = result;
    result.then((res) => {
      pending.delete(key);
      cancelled.delete(key);
      sendResponse({ ...res, requestId: id });
    });
    return true; // async response; also keeps the service worker alive for the job
  }
  if (msg.type === 'CANCEL') {
    cancelJob(key);
    sendResponse({ ok: true });
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { workerTabId } = await chrome.storage.session.get('workerTabId');
  if (tabId === workerTabId) await chrome.storage.session.remove('workerTabId');
});

// Toolbar icon: open the question box on the page the user is looking at.
// (Does nothing on pages where extensions cannot run, such as chrome:// pages.)
chrome.action.onClicked.addListener((tab) => {
  if (tab?.id != null) chrome.tabs.sendMessage(tab.id, { type: 'OPEN_ASK' }, PRIMARY).catch(() => {});
});
