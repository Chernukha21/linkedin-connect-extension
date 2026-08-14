globalThis.LCA = globalThis.LCA ?? {};

LCA.sleep = function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
