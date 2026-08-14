import { getState, setState } from './state.js';
import { sleep } from './utils.js';

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

  // Dry-run result for now.
  const result = 'skipped';

  await applyTargetResult(result);

  console.log('[LCA] RESULT:', {
    name: target.name,
    result,
  });

  await sleep(1200);

  await processNextTarget();
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
