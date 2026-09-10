// Filtering rules shared by the two food download dialogs — the food sessions page
// (assignments only) and the event overview (every applicant, food joined on email).
//
// "Scanned" means the food counter stamped servedAt. Being given a colour at the door
// is not eating, so scanned and assigned are genuinely different lists.

export type ScanStatus = 'all' | 'scanned' | 'not_scanned';

export const SCAN_STATUS_OPTIONS: { value: ScanStatus; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'scanned', label: 'Scanned' },
    { value: 'not_scanned', label: 'Not Scanned' },
];

export interface ScanFilterRow {
    sessionId?: string | null;
    servedAt?: string | null;
}

/**
 * An empty `slotIds` means every slot — "all slots" is the absence of a filter rather
 * than a list of all of them, so a slot created later is included without touching
 * saved state.
 *
 * Picking slots also excludes anyone with no assignment at all: they belong to no slot,
 * so they cannot be in the selected ones. With no slot picked, an unassigned applicant
 * counts as "not scanned" — they did not eat.
 */
export function matchesScanFilter(
    row: ScanFilterRow,
    status: ScanStatus,
    slotIds: Set<string>
): boolean {
    if (slotIds.size > 0 && (!row.sessionId || !slotIds.has(row.sessionId))) return false;
    if (status === 'scanned') return Boolean(row.servedAt);
    if (status === 'not_scanned') return !row.servedAt;
    return true;
}
