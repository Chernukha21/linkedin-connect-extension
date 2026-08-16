const DEFAULT_TIMING = {
  mean: 8000,
  standardDeviation: 2500,
  min: 4000,
  max: 15000,
};

function randomUnit() {
  const buffer = new Uint32Array(1);

  crypto.getRandomValues(buffer);

  return (buffer[0] + 1) / (0xffffffff + 2);
}

function sampleNormal() {
  const u1 = randomUnit();
  const u2 = randomUnit();

  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function getInterTargetDelay(options = {}) {
  const { mean, standardDeviation, min, max } = {
    ...DEFAULT_TIMING,
    ...options,
  };

  const value = mean + sampleNormal() * standardDeviation;

  return Math.round(Math.min(Math.max(value, min), max));
}
