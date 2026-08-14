globalThis.LCA = globalThis.LCA ?? {};

LCA.getCurrentPageNumber = function getCurrentPageNumber() {
  const currentPageButton = document.querySelector(
    'button[aria-current="true"][aria-label^="Page "]'
  );

  if (!currentPageButton) {
    return null;
  }

  const label = currentPageButton.getAttribute('aria-label');

  return Number(label.replace('Page ', ''));
};

LCA.getNextPageButton = function getNextPageButton() {
  return document.querySelector(
    '[data-testid="pagination-controls-next-button-visible"]'
  );
};

LCA.createNextPageTarget = function createNextPageTarget(
  nextButton,
  currentPage
) {
  if (!nextButton) {
    return null;
  }

  const rect = nextButton.getBoundingClientRect();

  return {
    type: 'NEXT_PAGE',
    currentPage,
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
};

LCA.waitForPageChange = function waitForPageChange(previousPage) {
  const observer = new MutationObserver(() => {
    const currentPage = LCA.getCurrentPageNumber();

    if (currentPage && currentPage !== previousPage) {
      console.log('[LCA] PAGE CHANGED:', {
        from: previousPage,
        to: currentPage,
      });

      observer.disconnect();

      LCA.handleStart();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log('[LCA] WAITING FOR PAGE CHANGE FROM:', previousPage);
};
