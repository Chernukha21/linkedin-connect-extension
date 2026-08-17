import test from 'node:test';
import assert from 'node:assert/strict';

import { getInterTargetDelay } from '../src/background/timing.js';

test('getInterTargetDelay returns a bounded delay', () => {
  for (let i = 0; i < 100; i += 1) {
    const delay = getInterTargetDelay();

    assert.equal(Number.isFinite(delay), true);

    assert.ok(delay >= 4000, `delay ${delay} is below minimum`);

    assert.ok(delay <= 15000, `delay ${delay} is above maximum`);
  }
});
