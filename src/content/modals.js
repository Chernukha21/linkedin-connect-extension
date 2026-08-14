globalThis.LCA = globalThis.LCA ?? {};

LCA.resolveModalState = function resolveModalState() {
  const dialog = document.querySelector('[role="dialog"]');

  if (!dialog) {
    return {
      type: 'NONE',
    };
  }

  const text = dialog.textContent?.trim() ?? '';

  const sendWithoutNoteButton = dialog.querySelector(
    '[aria-label="Send without a note"]'
  );

  if (sendWithoutNoteButton) {
    return {
      type: 'ADD_NOTE',
    };
  }

  if (text.includes('How do you know')) {
    return {
      type: 'EMAIL_VERIFICATION',
    };
  }

  if (text.includes("You've reached the weekly invitation limit")) {
    return {
      type: 'WEEKLY_LIMIT',
    };
  }

  return {
    type: 'UNKNOWN',
    text,
  };
};

LCA.observeModals = function observeModals() {
  const observer = new MutationObserver(() => {
    const modalState = LCA.resolveModalState();

    if (modalState.type === 'NONE') {
      return;
    }

    console.log('[LCA] MODAL STATE:', modalState);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log('[LCA] MODAL OBSERVER STARTED');
};
