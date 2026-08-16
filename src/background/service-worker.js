import { getState } from './state.js';
import { startAutomation, stopAutomation } from './automation.js';
import { handlePageData } from './page.js';
import {
  handleModalState,
  processNextTarget,
  resumeNextPage,
} from './queue.js';
import { getInterTargetDelay } from './timing.js';
import {
  getRateLimitStatus,
  canSendInvitation,
  recordInvitation,
} from './rate-limit.js';

import {
  RECOVERY_ALARM,
  scheduleRecovery,
  clearRecovery,
  getPendingRecovery,
  ensureRecoveryAlarm,
} from './recovery.js';

globalThis.LCA_TEST = {
  handleModalState,
  processNextTarget,
  getRateLimitStatus,
  canSendInvitation,
  recordInvitation,
  getInterTargetDelay,
  scheduleRecovery,
  clearRecovery,
  getPendingRecovery,
  ensureRecoveryAlarm,
  startAutomation,
  stopAutomation,
};

chrome.runtime.onStartup.addListener(() => {
  console.log('[LCA] BROWSER STARTUP');

  ensureRecoveryAlarm().catch((error) => {
    console.error('[LCA] STARTUP RECOVERY RECONCILIATION FAILED:', error);
  });
});

async function handleContentReady(sender) {
  const tabId = sender.tab?.id;
  const senderUrl = sender.url;

  if (!tabId || !senderUrl) {
    return;
  }

  let url;

  try {
    url = new URL(senderUrl);
  } catch {
    return;
  }

  if (url.pathname !== '/search/results/people/') {
    return;
  }

  const state = await getState();

  console.log('[LCA] CONTENT READY:', {
    tabId,
    status: state.status,
    pendingAction: state.pendingAction,
  });

  if (state.status !== 'running' && state.status !== 'waiting_next_page') {
    console.log('[LCA] NO ACTIVE RUN TO RESUME');
    return;
  }

  if (state.tabId && state.tabId !== tabId) {
    console.log('[LCA] CONTENT READY IGNORED:', {
      reason: 'different_tab',
      expectedTabId: state.tabId,
      actualTabId: tabId,
    });

    return;
  }

  // If a delayed action is already persisted,
  // normal sleep/alarm recovery owns continuation.
  if (state.pendingAction) {
    console.log('[LCA] RECOVERY ALREADY PENDING:', {
      type: state.pendingAction.type,
    });

    return;
  }

  if (state.status === 'waiting_next_page') {
    console.log('[LCA] REARMING NEXT PAGE RECOVERY');

    await scheduleRecovery('NEXT_PAGE', 0);
    return;
  }

  console.log('[LCA] RESUMING PAGE AFTER CONTENT READY');

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'START',
      resume: true,
    });
  } catch (error) {
    console.error('[LCA] CONTENT READY RESUME FAILED:', error);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[LCA] MESSAGE RECEIVED:', {
    type: message.type,
    senderUrl: sender.url,
    tabId: sender.tab?.id ?? null,
  });

  if (message.type === 'CONTENT_READY') {
    handleContentReady(sender).catch((error) => {
      console.error('[LCA] HANDLE CONTENT READY FAILED:', error);
    });

    return;
  }

  if (message.type === 'START_AUTOMATION') {
    startAutomation(message.tabId).catch((error) => {
      console.error('[LCA] START AUTOMATION FAILED:', error);
    });

    return;
  }

  if (message.type === 'STOP_AUTOMATION') {
    console.warn('[LCA] STOP REQUEST RECEIVED:', {
      senderUrl: sender.url,
      tabId: sender.tab?.id ?? null,
      time: new Date().toISOString(),
    });

    stopAutomation().catch((error) => {
      console.error('[LCA] STOP AUTOMATION FAILED:', error);
    });

    return;
  }

  if (message.type === 'GET_STATE') {
    getState()
      .then(sendResponse)
      .catch((error) => {
        console.error('[LCA] GET STATE FAILED:', error);
        sendResponse(null);
      });

    return true;
  }

  if (message.type === 'PAGE_DATA') {
    const tabId = sender.tab?.id;

    if (!tabId) {
      console.error('[LCA] Page sender tab not found');
      return;
    }

    handlePageData(tabId, message.payload).catch((error) => {
      console.error('[LCA] HANDLE PAGE DATA FAILED:', error);
    });
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== RECOVERY_ALARM) {
    return;
  }

  console.log('[LCA] RECOVERY ALARM FIRED:', {
    name: alarm.name,
    scheduledTime: alarm.scheduledTime,
  });

  const pendingAction = await getPendingRecovery();

  if (!pendingAction) {
    console.log('[LCA] NO PENDING RECOVERY ACTION');
    return;
  }

  console.log('[LCA] PENDING RECOVERY ACTION:', pendingAction);

  // Consume recovery before resuming.
  // This prevents the same action from being replayed twice.
  await clearRecovery();

  if (pendingAction.type === 'NEXT_TARGET') {
    const state = await getState();

    if (state.status !== 'running') {
      console.log('[LCA] NEXT TARGET RECOVERY CANCELLED:', {
        status: state.status,
      });

      return;
    }

    console.log('[LCA] RESUMING NEXT TARGET');

    await processNextTarget();
    return;
  }

  if (pendingAction.type === 'NEXT_PAGE') {
    const state = await getState();

    if (state.status !== 'waiting_next_page') {
      console.log('[LCA] NEXT PAGE RECOVERY CANCELLED:', {
        status: state.status,
      });

      return;
    }

    console.log('[LCA] RESUMING NEXT PAGE');

    await resumeNextPage();
    return;
  }

  console.error('[LCA] UNKNOWN RECOVERY ACTION:', {
    type: pendingAction.type,
  });
});

ensureRecoveryAlarm().catch((error) => {
  console.error('[LCA] RECOVERY RECONCILIATION FAILED:', error);
});
