import { getState, setState } from './state.js';
import { trustedClick } from './input.js';
import { sleep } from './utils.js';

async function waitForModalState(tabId, timeout = 5000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const modalState = await chrome.tabs.sendMessage(tabId, {
      type: 'GET_MODAL_STATE',
    });

    if (modalState?.type !== 'NONE') {
      return modalState;
    }

    await sleep(200);
  }

  return {
    type: 'NONE',
  };
}

async function waitForModalToClose(tabId, timeout = 5000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const modalState = await chrome.tabs.sendMessage(tabId, {
      type: 'GET_MODAL_STATE',
    });

    if (modalState?.type === 'NONE') {
      return true;
    }

    await sleep(200);
  }

  return false;
}

export async function processNextTarget() {
  const state = await getState();

  if (state.status !== 'running') {
    console.log('[LCA] Automation is not running');
    return;
  }

  const target = state.targets[state.currentIndex];

  // Targets on the current page are exhausted.
  if (!target) {
    console.log('[LCA] No more targets on current page');

    if (state.nextPage) {
      console.log('[LCA] NEXT PAGE AVAILABLE:', state.nextPage);

      await setState({
        ...state,
        status: 'waiting_next_page',
      });

      return;
    }

    console.log('[LCA] No next page. Run finished.');

    await setState({
      ...state,
      status: 'stopped',
    });

    return;
  }

  console.log('[LCA] PROCESSING:', {
    index: state.currentIndex,
    name: target.name,
  });

  // Get fresh viewport coordinates because coordinates collected
  // during the initial scroll may already be stale.
  const position = await chrome.tabs.sendMessage(state.tabId, {
    type: 'RESOLVE_TARGET_POSITION',
    target,
  });

  if (!position) {
    console.error('[LCA] FAILED TO RESOLVE TARGET:', {
      name: target.name,
    });

    return;
  }

  console.log('[LCA] CLICK POSITION:', {
    name: target.name,
    ...position,
  });

  // Trusted click on the Connect button.
  await trustedClick(state.tabId, position.x, position.y);

  console.log('[LCA] CONNECT CLICK DISPATCHED:', {
    name: target.name,
  });

  // Wait for LinkedIn to open a modal.
  const modalState = await waitForModalState(state.tabId);

  console.log('[LCA] MODAL STATE:', modalState);

  // For now we test only the happy path:
  // Connect -> Add a note -> Send without a note.
  if (modalState.type !== 'ADD_NOTE') {
    console.error('[LCA] EXPECTED ADD_NOTE MODAL:', modalState);

    return;
  }

  // Trusted click on "Send without a note".
  await trustedClick(state.tabId, modalState.action.x, modalState.action.y);

  console.log('[LCA] SEND WITHOUT NOTE CLICK DISPATCHED:', {
    name: target.name,
  });

  // Do not count the invitation as sent until the modal disappears.
  const modalClosed = await waitForModalToClose(state.tabId);

  if (!modalClosed) {
    console.error('[LCA] MODAL DID NOT CLOSE');

    return;
  }

  await applyTargetResult('sent');

  console.log('[LCA] RESULT:', {
    name: target.name,
    result: 'sent',
  });

  // IMPORTANT:
  // This is intentionally a single-target test.
  // We stop after one successful invitation.
  const latestState = await getState();

  await setState({
    ...latestState,
    status: 'stopped',
  });

  console.log('[LCA] SINGLE TARGET TEST COMPLETE');
}

async function applyTargetResult(result) {
  const state = await getState();

  const nextState = {
    ...state,
    currentIndex: state.currentIndex + 1,
  };

  if (result === 'sent') {
    nextState.sent = state.sent + 1;
  }

  if (result === 'skipped') {
    nextState.skipped = state.skipped + 1;
  }

  if (result === 'failed') {
    nextState.failed = state.failed + 1;
  }

  await setState(nextState);
}
