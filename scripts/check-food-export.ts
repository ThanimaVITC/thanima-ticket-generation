// Guards the food download filter. The whole point of the two dialogs is that
// "scanned" and "assigned" are different lists, so the cases that must never drift
// are the ones where those two disagree.
//
// Run: pnpm check:food-export

import assert from 'node:assert/strict';
import { matchesScanFilter } from '../src/lib/food-export';

const RED = 'slot-red';
const BLUE = 'slot-blue';

const ate = { sessionId: RED, servedAt: '2026-09-01T12:00:00.000Z' };
const hasSlotNotEaten = { sessionId: RED, servedAt: null };
const blueAte = { sessionId: BLUE, servedAt: '2026-09-01T13:00:00.000Z' };
const noSlot = { sessionId: null, servedAt: null };

const ALL = new Set<string>();
const REDONLY = new Set([RED]);
const BOTH = new Set([RED, BLUE]);

// No slot picked == every slot, including people who were never given a colour.
assert.equal(matchesScanFilter(ate, 'all', ALL), true);
assert.equal(matchesScanFilter(noSlot, 'all', ALL), true);

// Scanned is servedAt, never merely holding a slot.
assert.equal(matchesScanFilter(ate, 'scanned', ALL), true);
assert.equal(matchesScanFilter(hasSlotNotEaten, 'scanned', ALL), false);
assert.equal(matchesScanFilter(noSlot, 'scanned', ALL), false);

// Not scanned covers an unused slot *and* no slot at all — neither of them ate.
assert.equal(matchesScanFilter(hasSlotNotEaten, 'not_scanned', ALL), true);
assert.equal(matchesScanFilter(noSlot, 'not_scanned', ALL), true);
assert.equal(matchesScanFilter(ate, 'not_scanned', ALL), false);

// Picking slots narrows to those slots, and drops the unassigned entirely: they
// belong to no slot, so they cannot be in the selected ones.
assert.equal(matchesScanFilter(ate, 'all', REDONLY), true);
assert.equal(matchesScanFilter(blueAte, 'all', REDONLY), false);
assert.equal(matchesScanFilter(noSlot, 'not_scanned', REDONLY), false);
assert.equal(matchesScanFilter(blueAte, 'all', BOTH), true);

// Slot and status compose rather than override.
assert.equal(matchesScanFilter(hasSlotNotEaten, 'not_scanned', REDONLY), true);
assert.equal(matchesScanFilter(hasSlotNotEaten, 'scanned', REDONLY), false);
assert.equal(matchesScanFilter(blueAte, 'scanned', REDONLY), false);

console.log('food export filter: all cases pass');
