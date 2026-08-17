globalThis.LCA = globalThis.LCA ?? {};

LCA.getActionElements = function getActionElements() {
  return [
    ...document.querySelectorAll(`
      a[aria-label],
      button[aria-label],
      a[href*="/messaging/compose/"]
    `),
  ];
};

LCA.getProfileHref = function getProfileHref(element) {
  const card = element.closest('li');

  if (!card) {
    return null;
  }

  const profileLink = card.querySelector('a[href*="/in/"]');

  return profileLink?.getAttribute('href') ?? null;
};

LCA.createTarget = function createTarget(element) {
  const type = LCA.resolveAction(element);

  if (!type) {
    return null;
  }

  const rect = element.getBoundingClientRect();

  const ariaLabel = element.getAttribute('aria-label')?.trim() ?? '';

  const profileHref = LCA.getProfileHref(element);

  return {
    type,

    name: LCA.extractName(type, ariaLabel),

    label: ariaLabel,

    href: element.getAttribute('href'),

    profileHref,

    x: rect.left + rect.width / 2,

    y: rect.top + rect.height / 2,
  };
};

LCA.collectVisibleTargets = function collectVisibleTargets() {
  return LCA.getActionElements().map(LCA.createTarget).filter(Boolean);
};

LCA.getTargetKey = function getTargetKey(target) {
  return [
    target.type,
    target.profileHref ?? '',
    target.href ?? '',
    target.label ?? '',
  ].join('|');
};

LCA.collectTargetsWithScroll = async function collectTargetsWithScroll() {
  const collected = new Map();

  let unchangedPasses = 0;

  const maxUnchangedPasses = 3;

  // Always scan the page from the beginning.
  // This keeps target order stable after
  // reload / pause / resume.
  window.scrollTo({
    top: 0,
    behavior: 'auto',
  });

  await LCA.sleep(500);

  while (unchangedPasses < maxUnchangedPasses) {
    const targets = LCA.collectVisibleTargets();

    const sizeBefore = collected.size;

    for (const target of targets) {
      const key = LCA.getTargetKey(target);

      if (!collected.has(key)) {
        collected.set(key, target);
      }
    }

    const sizeAfter = collected.size;

    console.log('[LCA] COLLECT PASS:', {
      visible: targets.length,
      total: sizeAfter,
      unchangedPasses,
    });

    if (sizeAfter === sizeBefore) {
      unchangedPasses += 1;
    } else {
      unchangedPasses = 0;
    }

    if (unchangedPasses >= maxUnchangedPasses) {
      break;
    }

    window.scrollBy({
      top: window.innerHeight * 0.8,

      behavior: 'smooth',
    });

    await LCA.sleep(1200);
  }

  console.log('[LCA] TARGET COLLECTION COMPLETE:', {
    total: collected.size,
  });

  return [...collected.values()];
};

LCA.findTargetElement = function findTargetElement(target) {
  return (
    LCA.getActionElements().find((element) => {
      const type = LCA.resolveAction(element);

      if (type !== target.type) {
        return false;
      }

      const profileHref = LCA.getProfileHref(element);

      if (target.profileHref && profileHref !== target.profileHref) {
        return false;
      }

      const ariaLabel = element.getAttribute('aria-label')?.trim() ?? '';

      const href = element.getAttribute('href') ?? null;

      if (target.label && ariaLabel === target.label) {
        return true;
      }

      if (target.href && href === target.href) {
        return true;
      }

      return false;
    }) ?? null
  );
};

LCA.resolveTargetPosition = async function resolveTargetPosition(target) {
  let element = LCA.findTargetElement(target);

  if (!element) {
    console.log('[LCA] TARGET NOT CURRENTLY VISIBLE:', {
      name: target.name,
      type: target.type,
    });

    return null;
  }

  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });

  await LCA.sleep(500);

  // The list may be virtualized and the original
  // DOM node may have been replaced during scroll.
  element = LCA.findTargetElement(target);

  if (!element) {
    console.log('[LCA] TARGET DISAPPEARED AFTER SCROLL:', {
      name: target.name,
      type: target.type,
    });

    return null;
  }

  const rect = element.getBoundingClientRect();

  const isVisible =
    rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth;

  if (!isVisible) {
    console.log('[LCA] TARGET IS OUTSIDE VIEWPORT:', {
      name: target.name,
      type: target.type,
    });

    return null;
  }

  return {
    x: rect.left + rect.width / 2,

    y: rect.top + rect.height / 2,
  };
};

LCA.findOverflowConnectElement = function findOverflowConnectElement() {
  const candidates = [
    ...document.querySelectorAll(`
        [role="menuitem"],
        [role="menu"] button,
        [role="menu"] a
      `),
  ];

  return (
    candidates.find((element) => {
      const rect = element.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        return false;
      }

      const text = element.textContent?.trim().toLowerCase() ?? '';

      const ariaLabel =
        element.getAttribute('aria-label')?.trim().toLowerCase() ?? '';

      return (
        text === 'connect' ||
        ariaLabel === 'connect' ||
        ariaLabel.startsWith('invite ')
      );
    }) ?? null
  );
};

LCA.resolveOverflowConnectPosition = function resolveOverflowConnectPosition() {
  const element = LCA.findOverflowConnectElement();

  if (!element) {
    console.log('[LCA] OVERFLOW CONNECT NOT FOUND');

    return null;
  }

  const rect = element.getBoundingClientRect();

  return {
    x: rect.left + rect.width / 2,

    y: rect.top + rect.height / 2,
  };
};
