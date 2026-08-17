console.log('[LCA] CONTENT SCRIPT LOADED');

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'START') {
    LCA.handleStart().catch((error) => {
      console.error('[LCA] START HANDLER FAILED:', error);
    });

    return;
  }

  if (message.type === 'RESOLVE_TARGET_POSITION') {
    LCA.resolveTargetPosition(message.target)
      .then(sendResponse)
      .catch((error) => {
        console.error('[LCA] FAILED TO RESOLVE TARGET POSITION:', error);

        sendResponse(null);
      });

    return true;
  }

  if (message.type === 'GET_MODAL_STATE') {
    sendResponse(LCA.resolveModalState());

    return;
  }

  if (message.type === 'RESOLVE_OVERFLOW_CONNECT_POSITION') {
    sendResponse(LCA.resolveOverflowConnectPosition());

    return;
  }

  if (message.type === 'RESOLVE_NEXT_PAGE_POSITION') {
    LCA.resolveNextPagePosition()
      .then(sendResponse)
      .catch((error) => {
        console.error('[LCA] FAILED TO RESOLVE NEXT PAGE POSITION:', error);

        sendResponse(null);
      });

    return true;
  }
});

LCA.handleStart = async function handleStart() {
  console.log('[LCA] START RECEIVED');

  const isPeopleSearch = window.location.pathname === '/search/results/people/';

  if (!isPeopleSearch) {
    console.log('[LCA] SKIP: not a people search page');

    chrome.runtime.sendMessage({
      type: 'INVALID_PAGE',
      payload: {
        url: window.location.href,
      },
    });

    return;
  }

  const targets = await LCA.collectTargetsWithScroll();

  const currentPage = LCA.getCurrentPageNumber();

  const nextButton = LCA.getNextPageButton();

  const nextPage = LCA.createNextPageTarget(nextButton, currentPage);

  console.log('[LCA] PAGE DATA:', {
    targetsCount: targets.length,
    currentPage,
    hasNextPage: Boolean(nextPage),
  });

  await chrome.runtime.sendMessage({
    type: 'PAGE_DATA',
    payload: {
      targets,
      currentPage,
      nextPage,
    },
  });

  if (nextPage) {
    LCA.waitForPageChange(currentPage);
  }
};

chrome.runtime
  .sendMessage({
    type: 'CONTENT_READY',
  })
  .catch((error) => {
    console.log('[LCA] CONTENT_READY FAILED:', error.message);
  });
