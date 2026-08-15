globalThis.LCA = globalThis.LCA ?? {};

LCA.getOpenShadowRoots = function getOpenShadowRoots(root = document) {
  const roots = [];

  const visit = (currentRoot) => {
    const elements = currentRoot.querySelectorAll('*');

    for (const element of elements) {
      if (!element.shadowRoot) {
        continue;
      }

      roots.push(element.shadowRoot);

      visit(element.shadowRoot);
    }
  };

  visit(root);

  return roots;
};

LCA.getSearchRoots = function getSearchRoots() {
  return [document, ...LCA.getOpenShadowRoots()];
};

LCA.resolveModalState = function resolveModalState() {
  const roots = LCA.getSearchRoots();

  for (const root of roots) {
    const buttons = [...root.querySelectorAll('button, [role="button"]')];

    const sendWithoutNoteButton = buttons.find((button) => {
      const text = button.textContent?.trim() ?? '';

      const ariaLabel = button.getAttribute('aria-label')?.trim() ?? '';

      return (
        text === 'Send without a note' || ariaLabel === 'Send without a note'
      );
    });

    if (sendWithoutNoteButton) {
      const rect = sendWithoutNoteButton.getBoundingClientRect();

      return {
        type: 'ADD_NOTE',

        action: {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        },
      };
    }
  }

  for (const root of roots) {
    const text = root.textContent?.trim() ?? '';

    if (text.includes("You've reached the weekly invitation limit")) {
      return {
        type: 'WEEKLY_LIMIT',
      };
    }

    if (text.includes('How do you know')) {
      return {
        type: 'EMAIL_VERIFICATION',
      };
    }
  }

  return {
    type: 'NONE',
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
