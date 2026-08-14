console.log('[LCA] CONTENT SCRIPT LOADED');

LCA.observeModals();

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'START') {
    return;
  }

  LCA.handleStart();
});

LCA.handleStart = async function handleStart() {
  console.log('[LCA] START RECEIVED');
  console.log('[LCA] URL:', window.location.href);

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

  console.log('[LCA] FINAL TARGETS:', targets);

  const currentPage = LCA.getCurrentPageNumber();

  const nextButton = LCA.getNextPageButton();

  const nextPage = LCA.createNextPageTarget(nextButton, currentPage);

  console.log('[LCA] PAGE DATA:', {
    targets,
    currentPage,
    nextPage,
  });

  chrome.runtime.sendMessage({
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
