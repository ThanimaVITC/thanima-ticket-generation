// What the food counter does with a scanned ticket. Capacity was already settled when
// the attendee was assigned a colour at the door, so this only answers "is this person
// ours, and have they eaten yet".

export type CounterOutcome =
    | { kind: 'noAssignment' }
    | { kind: 'wrongSession'; assignedSessionId: string }
    | { kind: 'alreadyServed' }
    | { kind: 'serve' };

export interface CounterAssignment {
    foodSessionId: string;
    servedAt?: Date | string | null;
}

export function resolveCounterScan(
    assignment: CounterAssignment | null | undefined,
    sessionId: string
): CounterOutcome {
    if (!assignment) return { kind: 'noAssignment' };
    if (assignment.foodSessionId !== sessionId) {
        return { kind: 'wrongSession', assignedSessionId: assignment.foodSessionId };
    }
    if (assignment.servedAt) return { kind: 'alreadyServed' };
    return { kind: 'serve' };
}
