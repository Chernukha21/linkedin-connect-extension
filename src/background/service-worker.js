import { getState } from './state.js';
import { startAutomation, stopAutomation } from './automation.js';
import { handlePageData } from './page.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[LCA] MESSAGE RECEIVED:', {
    type: message.type,
    senderUrl: sender.url,
    tabId: sender.tab?.id ?? null,
  });

  if (message.type === 'START_AUTOMATION') {
    startAutomation(message.tabId);
    return;
  }

  if (message.type === 'STOP_AUTOMATION') {
    console.warn('[LCA] STOP REQUEST RECEIVED:', {
      senderUrl: sender.url,
      tabId: sender.tab?.id ?? null,
      time: new Date().toISOString(),
    });

    stopAutomation();
    return;
  }

  if (message.type === 'GET_STATE') {
    getState().then(sendResponse);

    return true;
  }

  if (message.type === 'PAGE_DATA') {
    const tabId = sender.tab?.id;

    if (!tabId) {
      console.error('[LCA] Page sender tab not found');
      return;
    }

    handlePageData(tabId, message.payload);
  }
});
