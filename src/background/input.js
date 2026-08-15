import { sleep } from './utils.js';

const attachedTabs = new Set();

async function ensureDebuggerAttached(tabId) {
  if (attachedTabs.has(tabId)) {
    return;
  }

  await chrome.debugger.attach({ tabId }, '1.3');

  attachedTabs.add(tabId);

  console.log('[LCA] DEBUGGER ATTACHED:', tabId);
}

export async function trustedClick(tabId, x, y) {
  if (!tabId) {
    throw new Error('trustedClick: tabId is missing');
  }

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`trustedClick: invalid coordinates x=${x}, y=${y}`);
  }

  await ensureDebuggerAttached(tabId);

  const target = { tabId };

  console.log('[LCA] TRUSTED CLICK:', {
    tabId,
    x,
    y,
  });

  await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x,
    y,
    button: 'none',
    clickCount: 0,
  });

  await sleep(80);

  await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });

  await sleep(60);

  await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  });
}

chrome.debugger.onDetach.addListener((source, reason) => {
  if (!source.tabId) {
    return;
  }

  attachedTabs.delete(source.tabId);

  console.log('[LCA] DEBUGGER DETACHED:', {
    tabId: source.tabId,
    reason,
  });
});
