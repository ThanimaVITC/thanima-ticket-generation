# Monochrome UI Recipe (apply to every dashboard page)

Reference: `DESIGN.md` (Raycast "obsidian terminal"). Dark, monochrome, **square corners**
(border-radius is globally 0 via Tailwind — do NOT rely on rounded-*; never re-add radius).
Color appears ONLY as a sparing status signal. Everything else is grayscale.

## Palette (use these exact classes)
- Page canvas: inherited `bg-background` (#040506). Don't set page bg.
- Card / panel surface: `border border-white/10 bg-white/[0.03]` (flat, no gradient).
  - Replace any `bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl`
    → `border border-white/10 bg-white/[0.03]`.
- Raised/nested surface: `bg-white/[0.05] border border-white/10`.
- Text: primary `text-white`; secondary `text-[#9c9c9d]`; tertiary `text-[#6a6b6c]`.
  - Existing `text-gray-400` → `text-[#9c9c9d]`, `text-gray-500/600` → `text-[#6a6b6c]`.
- Hairline divider/border: `border-white/10`.

## Remove ALL hue (purple/pink/blue/green/orange/yellow/indigo/teal/red except status)
- Primary button / gradient button (`bg-purple-600`, `bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500`)
  → use `<Button>` default (now near-white) OR class `bg-[#e6e6e6] text-[#1a1a1a] hover:bg-white`.
- Accent text (`text-purple-400`, `text-blue-400`, etc.) → `text-white` (or `text-[#9c9c9d]` if secondary).
- Colored stat numbers (`text-green-400`, `text-purple-400`, `text-blue-400`) → `text-white`.
- Ambient gradient blobs (purple/blue blur circles) → delete them.
- Chart colors (recharts `COLORS`, `fill`, `stroke`) → grayscale ramp:
  `['#e6e6e6','#b8b8b8','#8a8a8a','#5c5c5c','#3a3a3a']`; grid `rgba(255,255,255,0.08)`,
  axis text `#6a6b6c`, tooltip bg `#0b0c0e` border `rgba(255,255,255,0.1)`.

## Status signals — the ONLY place color is allowed (keep small: dot/text/thin border)
- Success / sent / present / admitted: `text-[#59d499]` (border `border-[#59d499]/30 bg-[#59d499]/10` for pills).
- Error / failed / full: `text-[#ff6363]` (`border-[#ff6363]/30 bg-[#ff6363]/10`).
- Pending / neutral / near-limit: `text-[#9c9c9d]` (`border-white/10 bg-white/[0.05]`).
- Prefer the shadcn `<Badge variant="success|destructive|secondary">` which is already mapped.

## Buttons (use the <Button> component variants — already restyled)
- Primary action → default variant (near-white). Secondary → `variant="outline"`. Destructive → `variant="destructive"` (ember outline). Quiet → `variant="ghost"`.

## Typography
- Page title: `text-2xl sm:text-3xl font-semibold text-white tracking-display`.
- Section heading: `text-lg font-semibold text-white`.
- Micro labels / eyebrows / badges: `text-[11px] uppercase tracking-micro text-[#6a6b6c]`.
- Numeric stats: `text-3xl font-bold text-white tabular-nums`.

## Loaders
- Replace spinning `rounded-full border` rings (they'd be square now) with text
  `<span class="text-[#9c9c9d] text-sm">Loading…</span>` or a simple `animate-pulse` bar.

## Spacing / shape
- Keep generous padding (`p-5`/`p-6`), `gap-4`/`gap-6`. No border-radius. Hairline 1px borders.
- Inputs/textareas: `bg-white/[0.04] border border-white/15 text-white placeholder:text-[#6a6b6c]`.

## Don't
- No rounded corners, no colored gradients, no colored shadows, no hue except the 3 status colors above.
