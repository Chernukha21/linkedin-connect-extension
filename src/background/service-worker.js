import { getState } from './state.js';
import { startAutomation, stopAutomation } from './automation.js';
import { handlePageData } from './page.js';
import { handleModalState, processNextTarget } from './queue.js';
import { getInterTargetDelay } from './timing.js';
import {
  getRateLimitStatus,
  canSendInvitation,
  recordInvitation,
} from './rate-limit.js';

globalThis.LCA_TEST = {
  handleModalState,
  processNextTarget,
  getRateLimitStatus,
  canSendInvitation,
  recordInvitation,
  getInterTargetDelay,
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[LCA] MESSAGE RECEIVED:', {
    type: message.type,
    senderUrl: sender.url,
    tabId: sender.tab?.id ?? null,
  });

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
