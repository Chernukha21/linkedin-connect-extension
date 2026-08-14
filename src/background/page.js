import { getState, setState } from './state.js';
import { processNextTarget } from './queue.js';

export async function handlePageData(tabId, pageData) {
  const state = await getState();

  if (state.status !== 'running' && state.status !== 'waiting_next_page') {
    console.log('[LCA] Automation is not active');
    return;
  }

  const { targets, currentPage, nextPage } = pageData;

  const nextState = {
    ...state,

    status: 'running',
    tabId,

    targets,
    currentIndex: 0,

    currentPage,
    nextPage,
  };

  await setState(nextState);

  console.log('[LCA] PAGE STORED:', {
    currentPage,
    targets: targets.length,
    hasNext: Boolean(nextPage),
  });

  await processNextTarget();
}
