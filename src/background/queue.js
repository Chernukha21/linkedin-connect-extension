import { getState, setState } from './state.js';
import { trustedClick } from './input.js';
import { sleep } from './utils.js';

import {
  getRateLimitStatus,
  canSendInvitation,
  recordInvitation,
} from './rate-limit.js';

import { getInterTargetDelay } from './timing.js';

// Safety switch while the remaining automation flow is being tested.
// With false, Start will NEVER click a real Connect button.
const LIVE_CONNECT_ENABLED = false;

async function stopWithError(message) {
  console.error(`[LCA] ${message}`);

  const state = await getState();

  await setState({
    ...state,
    status: 'stopped',
  });
}

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
        await stopWithError('ADD NOTE ACTION NOT FOUND');
        return null;
      }

      await trustedClick(state.tabId, modalState.action.x, modalState.action.y);

      console.log('[LCA] SEND WITHOUT NOTE CLICK DISPATCHED:', {
        name: target.name,
      });

      const modalClosed = await waitForModalToClose(state.tabId);

      if (!modalClosed) {
        await stopWithError('ADD NOTE MODAL DID NOT CLOSE');

        return null;
      }

      await applyTargetResult('sent');

      const rateStatus = await recordInvitation();

      console.log('[LCA] INVITATION RECORDED:', {
        dailyCount: rateStatus.dailyCount,
        weeklyCount: rateStatus.weeklyCount,
        dailyRemaining: rateStatus.dailyRemaining,
        weeklyRemaining: rateStatus.weeklyRemaining,
      });

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
        await stopWithError('EMAIL VERIFICATION CLOSE ACTION NOT FOUND');

        return null;
      }

      await trustedClick(state.tabId, modalState.action.x, modalState.action.y);

      console.log('[LCA] EMAIL VERIFICATION CLOSE CLICK DISPATCHED:', {
        name: target.name,
      });

      const modalClosed = await waitForModalToClose(state.tabId);

      if (!modalClosed) {
        await stopWithError('EMAIL VERIFICATION MODAL DID NOT CLOSE');

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
      await stopWithError(`UNHANDLED MODAL STATE: ${modalState.type}`);

      return null;
    }
  }
}

async function continueWithNextTarget() {
  const state = await getState();

  if (state.status !== 'running') {
    console.log('[LCA] Queue continuation cancelled:', {
      status: state.status,
    });

    return;
  }

  const delay = getInterTargetDelay();

  console.log('[LCA] NEXT TARGET DELAY:', {
    delay,
  });

  await sleep(delay);

  const latestState = await getState();

  if (latestState.status !== 'running') {
    console.log('[LCA] Automation stopped during delay');

    return;
  }

  await processNextTarget();
}

async function waitForOverflowConnectPosition(tabId, timeout = 3000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const position = await chrome.tabs.sendMessage(tabId, {
      type: 'RESOLVE_OVERFLOW_CONNECT_POSITION',
    });

    if (position) {
      return position;
    }

    await sleep(150);
  }

  return null;
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
    type: target.type,
  });

  // Only CONNECT targets are processed by this flow.
  // MORE will need its own overflow-menu handling later.
  if (target.type === 'MORE') {
    console.log('[LCA] PROCESSING MORE TARGET:', {
      name: target.name,
    });

    const rateStatus = getRateLimitStatus(state);

    console.log('[LCA] RATE LIMIT STATUS:', rateStatus);

    if (!canSendInvitation(state)) {
      console.warn('[LCA] LOCAL RATE LIMIT REACHED:', {
        dailyReached: rateStatus.dailyReached,
        weeklyReached: rateStatus.weeklyReached,
        dailyCount: rateStatus.dailyCount,
        weeklyCount: rateStatus.weeklyCount,
      });

      await setState({
        ...state,
        status: 'stopped',
      });

      console.log('[LCA] AUTOMATION STOPPED: local rate limit');

      return;
    }

    const morePosition = await chrome.tabs.sendMessage(state.tabId, {
      type: 'RESOLVE_TARGET_POSITION',
      target,
    });

    if (!morePosition) {
      console.log('[LCA] MORE TARGET NOT FOUND');

      await applyTargetResult('skipped');
      await continueWithNextTarget();

      return;
    }

    await trustedClick(state.tabId, morePosition.x, morePosition.y);

    console.log('[LCA] MORE CLICK DISPATCHED');

    const connectPosition = await waitForOverflowConnectPosition(state.tabId);

    if (!connectPosition) {
      console.log('[LCA] CONNECT NOT FOUND IN OVERFLOW');

      await applyTargetResult('skipped');
      await continueWithNextTarget();

      return;
    }

    console.log('[LCA] OVERFLOW CONNECT RESOLVED:', {
      ...connectPosition,
    });

    if (!LIVE_CONNECT_ENABLED) {
      console.warn(
        '[LCA] LIVE CONNECT DISABLED - overflow Connect was not clicked'
      );

      await setState({
        ...state,
        status: 'stopped',
      });

      return;
    }

    await trustedClick(state.tabId, connectPosition.x, connectPosition.y);

    console.log('[LCA] OVERFLOW CONNECT CLICK DISPATCHED');

    const modalState = await waitForModalState(state.tabId);

    console.log('[LCA] MODAL STATE:', modalState);

    const result = await handleModalState(state, target, modalState);

    if (result === 'sent' || result === 'skipped') {
      await continueWithNextTarget();
    }

    return;
  }

  if (target.type !== 'CONNECT') {
    console.log('[LCA] TARGET SKIPPED:', {
      name: target.name,
      type: target.type,
      reason: 'not_connect',
    });

    await applyTargetResult('skipped');

    await continueWithNextTarget();
    return;
  }

  // Check persistent local limits before any interaction
  // with the LinkedIn page.
  const rateStatus = getRateLimitStatus(state);

  console.log('[LCA] RATE LIMIT STATUS:', rateStatus);

  if (!canSendInvitation(state)) {
    console.warn('[LCA] LOCAL RATE LIMIT REACHED:', {
      dailyReached: rateStatus.dailyReached,
      weeklyReached: rateStatus.weeklyReached,
      dailyCount: rateStatus.dailyCount,
      weeklyCount: rateStatus.weeklyCount,
    });

    await setState({
      ...state,
      status: 'stopped',
    });

    console.log('[LCA] AUTOMATION STOPPED: local rate limit');

    return;
  }

  // Coordinates collected during the initial scan can
  // become stale after scrolling, so resolve them again
  // immediately before the click.
  const position = await chrome.tabs.sendMessage(state.tabId, {
    type: 'RESOLVE_TARGET_POSITION',
    target,
  });

  if (!position) {
    await stopWithError(
      `FAILED TO RESOLVE TARGET: ${target.name ?? 'unknown'}`
    );

    return;
  }

  console.log('[LCA] CLICK POSITION:', {
    name: target.name,
    ...position,
  });

  // Temporary protection while we test the remaining flow.
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

  if (result === 'sent' || result === 'skipped') {
    await continueWithNextTarget();
    return;
  }

  console.log('[LCA] Queue stopped after modal result:', {
    result,
  });
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
