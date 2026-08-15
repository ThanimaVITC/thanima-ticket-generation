// The fixed palette food sessions are identified by. A session picks one colour and is
// known by it everywhere: dashboard, seat map, and the scanner in the mobile app.
// Chosen to stay apart from each other on a phone screen in a badly lit hall.

export interface FoodColor {
    key: string;
    name: string;
    hex: string;
    /** The seven everyday colours, offered first. The rest sit behind "more colours". */
    primary?: boolean;
}

// Names matter as much as hexes here: staff call these out across a hall ("Red, come and
// eat"), so every one has to be unmistakable said aloud as well as seen.
export const FOOD_COLORS: readonly FoodColor[] = [
    { key: 'red', name: 'Red', hex: '#EF4444', primary: true },
    { key: 'green', name: 'Green', hex: '#22C55E', primary: true },
    { key: 'blue', name: 'Blue', hex: '#3B82F6', primary: true },
    { key: 'yellow', name: 'Yellow', hex: '#EAB308', primary: true },
    { key: 'orange', name: 'Orange', hex: '#F97316', primary: true },
    { key: 'purple', name: 'Purple', hex: '#A855F7', primary: true },
    { key: 'pink', name: 'Pink', hex: '#EC4899', primary: true },

    { key: 'teal', name: 'Teal', hex: '#14B8A6' },
    { key: 'cyan', name: 'Cyan', hex: '#06B6D4' },
    { key: 'indigo', name: 'Indigo', hex: '#6366F1' },
    { key: 'lime', name: 'Lime', hex: '#84CC16' },
    { key: 'amber', name: 'Amber', hex: '#D97706' },
    { key: 'brown', name: 'Brown', hex: '#8B5A2B' },
    { key: 'maroon', name: 'Maroon', hex: '#9F1239' },
    { key: 'navy', name: 'Navy', hex: '#1E3A8A' },
    { key: 'olive', name: 'Olive', hex: '#4D7C0F' },
    { key: 'slate', name: 'Slate', hex: '#64748B' },
] as const;

export const PRIMARY_FOOD_COLORS = FOOD_COLORS.filter((c) => c.primary);

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
