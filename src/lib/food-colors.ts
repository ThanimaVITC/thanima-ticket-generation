// The fixed palette food sessions are identified by. A session picks one colour and is
// known by it everywhere: dashboard, seat map, and the scanner in the mobile app.
// Chosen to stay apart from each other on a phone screen in a badly lit hall.

export interface FoodColor {
    key: string;
    name: string;
    hex: string;
}

export const FOOD_COLORS: readonly FoodColor[] = [
    { key: 'red', name: 'Red', hex: '#EF4444' },
    { key: 'pink', name: 'Pink', hex: '#EC4899' },
    { key: 'blue', name: 'Blue', hex: '#3B82F6' },
    { key: 'green', name: 'Green', hex: '#22C55E' },
    { key: 'orange', name: 'Orange', hex: '#F97316' },
    { key: 'purple', name: 'Purple', hex: '#A855F7' },
    { key: 'yellow', name: 'Yellow', hex: '#EAB308' },
    { key: 'teal', name: 'Teal', hex: '#14B8A6' },
    { key: 'brown', name: 'Brown', hex: '#B45309' },
    { key: 'slate', name: 'Slate', hex: '#64748B' },
] as const;

export const FOOD_COLOR_KEYS = FOOD_COLORS.map((c) => c.key);

export function getFoodColor(key: string): FoodColor | undefined {
    return FOOD_COLORS.find((c) => c.key === key);
}

export function isFoodColor(key: unknown): key is string {
    return typeof key === 'string' && FOOD_COLOR_KEYS.includes(key);
}

/** Name and hex for a stored key, tolerant of a key that has since left the palette. */
export function describeFoodColor(key: string): { colorName: string; colorHex: string } {
    const c = getFoodColor(key);
    return { colorName: c?.name ?? key, colorHex: c?.hex ?? '#64748B' };
}
