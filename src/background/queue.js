import { getState, setState } from './state.js';
import { trustedClick } from './input.js';
import { sleep } from './utils.js';

// Safety switch while modal branches are being tested.
// With false, Start will NEVER click a real Connect button.
const LIVE_CONNECT_ENABLED = false;

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

export async function handleModalState(state, target, modalState) {
  switch (modalState.type) {
    case 'ADD_NOTE': {
      if (!modalState.action) {
        console.error('[LCA] ADD NOTE ACTION NOT FOUND');
        return null;
      }

      await trustedClick(state.tabId, modalState.action.x, modalState.action.y);

      console.log('[LCA] SEND WITHOUT NOTE CLICK DISPATCHED:', {
        name: target.name,
      });

      const modalClosed = await waitForModalToClose(state.tabId);

      if (!modalClosed) {
        console.error('[LCA] ADD NOTE MODAL DID NOT CLOSE');
        return null;
      }

      await applyTargetResult('sent');

      console.log('[LCA] RESULT:', {
        name: target.name,
        result: 'sent',
      });

      return 'sent';
    }

    case 'EMAIL_VERIFICATION': {
      console.log('[LCA] EMAIL VERIFICATION:', {
        name: target.name,
      });

      if (!modalState.action) {
        console.error('[LCA] EMAIL VERIFICATION CLOSE ACTION NOT FOUND');

        return null;
      }

      await trustedClick(state.tabId, modalState.action.x, modalState.action.y);

      console.log('[LCA] EMAIL VERIFICATION CLOSE CLICK DISPATCHED:', {
        name: target.name,
      });

      const modalClosed = await waitForModalToClose(state.tabId);

      if (!modalClosed) {
        console.error('[LCA] EMAIL VERIFICATION MODAL DID NOT CLOSE');

        return null;
      }

      await applyTargetResult('skipped');

      console.log('[LCA] RESULT:', {
        name: target.name,
        result: 'skipped',
        reason: 'email_verification',
      });

      return 'skipped';
    }
    case 'WEEKLY_LIMIT': {
      console.warn('[LCA] WEEKLY INVITATION LIMIT REACHED');

      const latestState = await getState();

      await setState({
        ...latestState,
        status: 'stopped',
      });

      console.log('[LCA] AUTOMATION STOPPED: weekly invitation limit');

      return 'stopped';
    }
    case 'UNKNOWN': {
      console.error('[LCA] UNKNOWN MODAL DETECTED:', {
        name: target.name,
        text: modalState.text,
        dom: modalState.dom,
      });

      const latestState = await getState();

      await setState({
        ...latestState,
        status: 'stopped',
      });

      console.error('[LCA] AUTOMATION STOPPED: unknown modal');

      return 'stopped';
    }
    default: {
      console.error('[LCA] UNHANDLED MODAL STATE:', modalState);
      return null;
    }
  }
}

export async function processNextTarget() {
  const state = await getState();

  if (state.status !== 'running') {
    console.log('[LCA] Automation is not running');
    return;
  }

  const target = state.targets[state.currentIndex];

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

  // Coordinates from the collection pass can be stale after scrolling,
  // so resolve them again immediately before the click.
  const position = await chrome.tabs.sendMessage(state.tabId, {
    type: 'RESOLVE_TARGET_POSITION',
    target,
  });

  if (!position) {
    console.error('[LCA] FAILED TO RESOLVE TARGET:', {
      name: target.name,
    });

    await setState({
      ...state,
      status: 'stopped',
    });

    return;
  }

  console.log('[LCA] CLICK POSITION:', {
    name: target.name,
    ...position,
  });

  // Temporary protection against accidental real invitations
  // while the remaining modal states are being tested.
  if (!LIVE_CONNECT_ENABLED) {
    console.warn(
      '[LCA] LIVE CONNECT DISABLED - real Connect click was not performed'
    );

    await setState({
      ...state,
      status: 'stopped',
    });

    return;
  }

  await trustedClick(state.tabId, position.x, position.y);

  console.log('[LCA] CONNECT CLICK DISPATCHED:', {
    name: target.name,
  });

  const modalState = await waitForModalState(state.tabId);

  console.log('[LCA] MODAL STATE:', modalState);

  const result = await handleModalState(state, target, modalState);

  if (!result) {
    return;
  }

  // Temporary single-target stop.
  // We will remove this when all modal branches are ready.
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
