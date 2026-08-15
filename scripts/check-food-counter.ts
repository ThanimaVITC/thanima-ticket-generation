// Self-check for the food counter decision. Pure function, no database.
// Run: pnpm check:food
import assert from 'node:assert/strict';
import { resolveCounterScan } from '../src/lib/food-counter';

const RED = 'sess-red';
const BLUE = 'sess-blue';

assert.equal(resolveCounterScan(null, RED).kind, 'noAssignment');
assert.equal(resolveCounterScan(undefined, RED).kind, 'noAssignment');

const wrong = resolveCounterScan({ foodSessionId: BLUE, servedAt: null }, RED);
assert.equal(wrong.kind, 'wrongSession');
assert.equal(wrong.kind === 'wrongSession' && wrong.assignedSessionId, BLUE);

// Wrong colour wins over already-served: send them to their own session either way.
assert.equal(resolveCounterScan({ foodSessionId: BLUE, servedAt: new Date() }, RED).kind, 'wrongSession');

assert.equal(resolveCounterScan({ foodSessionId: RED, servedAt: new Date() }, RED).kind, 'alreadyServed');
assert.equal(resolveCounterScan({ foodSessionId: RED, servedAt: '2026-08-16T10:00:00Z' }, RED).kind, 'alreadyServed');

assert.equal(resolveCounterScan({ foodSessionId: RED, servedAt: null }, RED).kind, 'serve');
assert.equal(resolveCounterScan({ foodSessionId: RED }, RED).kind, 'serve');

console.log('food counter: all checks passed');
