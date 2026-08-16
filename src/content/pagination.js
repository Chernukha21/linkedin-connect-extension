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
  const candidates = [...document.querySelectorAll('button')];

  return (
    candidates.find((button) => {
      const testId = button.getAttribute('data-testid') ?? '';

      const text = button.textContent?.trim() ?? '';

      const rect = button.getBoundingClientRect();

      const isNext =
        testId.startsWith('pagination-controls-next-button') || text === 'Next';

      return isNext && !button.disabled && rect.width > 0 && rect.height > 0;
    }) ?? null
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

LCA.resolveNextPagePosition = async function resolveNextPagePosition(
  timeout = 3000
) {
  let nextButton = LCA.getNextPageButton();

  if (!nextButton) {
    console.log('[LCA] NEXT PAGE BUTTON NOT FOUND');
    return null;
  }

  const getVisiblePosition = (button) => {
    const rect = button.getBoundingClientRect();

    const isVisible =
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth;

    console.log('[LCA] NEXT PAGE RECT:', {
      testId: button.getAttribute('data-testid'),
      viewportHeight: window.innerHeight,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      isVisible,
    });

    if (!isVisible) {
      return null;
    }

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  };

  // Most of the time pagination is already visible after target collection.
  const currentPosition = getVisiblePosition(nextButton);

  if (currentPosition) {
    console.log('[LCA] NEXT PAGE POSITION RESOLVED:', currentPosition);

    return currentPosition;
  }

  // Scroll only if the button is actually outside the viewport.
  nextButton.scrollIntoView({
    behavior: 'auto',
    block: 'center',
  });

  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    await LCA.sleep(100);

    nextButton = LCA.getNextPageButton();

    if (!nextButton) {
      console.log('[LCA] NEXT PAGE BUTTON DISAPPEARED');
      return null;
    }

    const position = getVisiblePosition(nextButton);

    if (position) {
      console.log('[LCA] NEXT PAGE POSITION RESOLVED:', position);

      return position;
    }
  }

  console.log('[LCA] NEXT PAGE BUTTON DID NOT ENTER VIEWPORT');

  return null;
};
