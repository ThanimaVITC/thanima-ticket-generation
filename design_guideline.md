# Code Arena — Design Guideline

Reference for the UI system in this Next.js project. Stack: **Next.js 16 App Router · React 19 · Tailwind v4 · shadcn (base-nova) · Geist + Instrument Serif · next-themes**.

The point of this doc is to keep new screens visually consistent. If a pattern below already covers what you need, reuse it. If it doesn't, extend rather than reinvent.

---

## 1. Aesthetic direction

A **boxy, sharp, editorial** take on the dark-Vercel aesthetic. The platform skews technical and serious — coding events, leaderboards, grading — so the design language is:

- **Square corners.** Cards, lists, tables, popovers — no rounded-`lg` defaults. `rounded-full` is reserved for **pills** (buttons, status chips).
- **Hairline borders + crosshair (`+`) corner markers** define every grouped block. We don't use shadows for separation. The `+` markers sit ~6px outside the border and are the platform's signature.
- **Attached rows** for any vertical list (events, questions, leaderboard, submissions). One outer frame, internal rows share a `border-t border-border`. No gaps between rows.
- **Dark by default**, fully theme-aware light mode. Both themes share structure; only colors swap.
- **Geist** for body + UI (sans) and code (mono). **Instrument Serif italic** for one accent moment per page (currently the user's first name on the dashboard).
- **Punchy gradients** appear sparingly (only the user's name on the dashboard). Status colors use saturated translucent tinted backgrounds (emerald for live, amber for pending, rose for errors).

---

## 2. Tokens

All color + radius tokens live in `app/globals.css` as CSS variables and are consumed via Tailwind. **Never hardcode hex** in components — always use the variable.

### 2.1 Color (semantic)

```
--background    Page background
--foreground    Primary text
--card          Card surface (slightly raised vs background)
--card-foreground
--popover / --popover-foreground
--primary / --primary-foreground       Primary action (button bg / its text)
--secondary / --secondary-foreground   Secondary action / muted bg
--muted / --muted-foreground           Quiet surface / muted text
--accent / --accent-foreground         Hover surface
--destructive                          Destructive action color
--border, --input, --ring              Borders + input ring
--grid-line                            Thin grid lines (lists, .boxy-bg)
--grid-line-strong                     Frame borders (BoxyFrame)
```

Light + dark variants live under `:root` and `.dark`. Use Tailwind utilities like `bg-card`, `text-muted-foreground`, `border-border`.

Status accents (used as-is, no token):

```
Live / Accepted    emerald-300 / bg-emerald-900/20 / border-emerald-900/60
Pending / Wait     amber-300 / bg-amber-900/20 / border-amber-900/60
Error / Wrong      rose-300 / bg-rose-900/20 / border-rose-900/60
Neutral status     text-muted-foreground / bg-card / border-border
```

### 2.2 Radius

```
--radius     0.5rem (base)
--radius-sm  0.25rem        Inputs, small badges
--radius-md  0.375rem
--radius-lg  0.5rem         Inputs, popover, default cards (when used)
--radius-xl  0.75rem
```

Most surfaces in this app intentionally **don't use radius** — they're square. Apply `rounded-*` only to:
- Avatar circles → `rounded-full`
- Pill buttons / chips → `rounded-full` (or the `.pill` class)
- Inputs (default shadcn)

### 2.3 Typography

| Token | Variable | Use |
|---|---|---|
| `--font-sans` | Geist Sans | Default body + UI |
| `--font-mono` | Geist Mono | Code, numbers, slugs, terminal blocks |
| `--font-display` | Instrument Serif | Accent display moments (dashboard name) |

Heading scale:

```
h1 page title         text-3xl font-semibold tracking-tight md:text-4xl
h1 hero (dashboard)   text-4xl font-semibold tracking-[-0.02em] md:text-5xl
h2 section title      text-2xl font-semibold tracking-tight
h3 card title         text-xl font-semibold tracking-tight (md:text-2xl)
section caption       text-xs uppercase tracking-[0.18em] text-muted-foreground
small caption         text-[10px] uppercase tracking-wider text-muted-foreground
body                  text-sm / text-[15px] (hero descriptions)
```

`tracking-tight` on titles, `tracking-[0.18em] uppercase` on captions — both are part of the language.

---

## 3. Layout

### 3.1 Page wrapper

Every authenticated page uses the **same wrapper width**. This is critical for visual continuity when navigating tabs inside an event scope.

```tsx
<div className="mx-auto w-full max-w-[1200px] px-6 py-12">
  ...
</div>
```

Exceptions:
- `/about` → `max-w-3xl` (long-form reading)
- `/events/[slug]/q/[qid]` (code editor) → `max-w-[1500px]` (needs editor width)

The **navbar inner width matches**: `max-w-[1200px] px-6 h-16`. Logo and right-side actions align vertically with the page content below.

### 3.2 Standard page header

Every regular page opens with this block:

```tsx
<div className="mb-8">
  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
    Section caption
  </div>
  <h1 className="mt-2 text-3xl font-semibold tracking-tight">Page title</h1>
  <p className="mt-2 text-sm text-muted-foreground">
    One-line description of what this page does.
  </p>
</div>
```

When the page has a primary search/filter, that goes **below** the title block on its own row (see `/events`), not inline with the title.

### 3.3 Section spacing

`mt-12` between top-level sections inside a page. Each section's own header is:

```tsx
<div className="mb-3 flex items-end justify-between">
  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
    Section name
  </div>
  <LinkButton variant="outline" className="pill h-8 gap-1 px-3 text-xs">
    See all <ArrowRight className="size-3" />
  </LinkButton>
</div>
```

Section "see all" actions are **small outline pills**, not bare text links.

---

## 4. Core components

### 4.1 BoxyFrame — square, bordered, with `+` corners

The signature element. Defined in `components/boxy.tsx`. Renders a thin border plus four crosshair markers at -6px outside the frame's corners.

```tsx
<BoxyFrame className="bg-card/40 p-6">
  {content}
</BoxyFrame>
```

**Never** wrap a `BoxyFrame` with `overflow-hidden` — the corner markers will be clipped. If you need to clip something inside (a grid pattern, an image), use an inner `<div class="overflow-hidden">`.

### 4.2 ListFrame + ListRow — attached vertical lists

`components/list-frame.tsx`. The standard container for a list of rows that share a single outer frame. Used by questions, leaderboards, submissions, event lists.

```tsx
<ListFrame>
  {items.map((item, i) => (
    <ListRow key={item.id} isFirst={i === 0}>
      <Link href="…" className="grid grid-cols-1 md:grid-cols-2 p-7">
        {/* row content */}
      </Link>
    </ListRow>
  ))}
</ListFrame>
```

Rows share a 1px `border-t` separator (skipped on the first via `isFirst`). The outer `BoxyFrame` provides the `+` markers. `hover={false}` on header / non-interactive rows.

### 4.3 SubmissionList — domain-specific row list

`components/submission-card.tsx` exports both `SubmissionList` and `SubmissionRow`. Each row collapses to a horizontal info strip (status pill + question + tests / time / memory + expand chevron) and expands to show stdout / stderr / code panes. Used on:
- `/events/[slug]/submissions`
- `/events/[slug]/q/[qid]/submissions`
- Latest-submission slot on `/events/[slug]/q/[qid]`

Always use `SubmissionList` rather than rendering rows yourself — it handles the outer frame + first-row border.

### 4.4 Pill button

Default action shape across the app. Always use the `.pill` class (= `rounded-full`) on `Button` / `LinkButton`. Sizes:

```
h-8  px-3  text-xs        Section "see all" actions
h-9  px-4  text-sm        Navbar links, secondary actions
h-10 px-4-5 text-sm       Primary action row (Register, Open event)
h-11 px-5  text-[14px]    Hero CTA buttons (dashboard)
```

Primary: `bg-foreground text-background hover:bg-foreground/90`.
Outline: `variant="outline"` (shadcn) → border + transparent bg.
Destructive: `border-rose-900/60 text-rose-300 hover:bg-rose-900/20`.

### 4.5 Segmented selector

Inline tab-like control. Used on `/events`.

```tsx
<div role="tablist" className="inline-flex items-center gap-1 rounded-lg border border-border bg-card/40 p-1">
  {filters.map((f) => (
    <button
      role="tab"
      aria-selected={active}
      className={cn(
        "pill inline-flex items-center gap-2 px-3.5 py-1.5 text-[13px] font-medium",
        active ? "bg-foreground text-background"
               : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums",
        active ? "bg-background/20 text-background" : "bg-muted/60 text-muted-foreground"
      )}>{count}</span>
    </button>
  ))}
</div>
```

The counter chip is **always** present; it doubles as a quick scan signal.

### 4.6 Status chips

Status communication is consistent across the app. Use these recipes verbatim:

| Status | Classes |
|---|---|
| Live | `border-emerald-900/60 bg-emerald-900/20 text-emerald-300` |
| Registered | same as Live |
| Hasn't started | `border-amber-900/60 bg-amber-900/20 text-amber-300` |
| Ended | `border-border bg-card text-muted-foreground` |
| Solved | `border-emerald-900/60 bg-emerald-900/20 text-emerald-300` |
| Partial | `border-amber-900/60 bg-amber-900/20 text-amber-300` |
| Wrong answer / Error | `border-rose-900/60 bg-rose-900/20 text-rose-300` |
| Unattempted / Neutral | `border-border bg-card text-muted-foreground` |

Shape:
- **Tab-row badge** (sm): `pill h-7 border px-3 py-0 text-[11px] uppercase tracking-wider`
- **Action-row pill** (md, matching button height): `pill inline-flex h-10 items-center rounded-lg border px-4 text-sm`
- **Inline tiny tag**: `rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider`

### 4.7 Countdown pill

`components/countdown.tsx`. Renders **`Ends in <time>`** with `tabular-nums`. Used next to the primary action when an event is live:

```tsx
<span className="pill inline-flex h-10 items-center rounded-lg border border-emerald-900/60 bg-emerald-900/20 px-4 text-sm text-emerald-300">
  <Countdown to={event.endAt} prefix="Ends in" />
</span>
```

No icons or dots — text only. The pill matches the height of the primary action it sits next to.

### 4.8 Event card pattern

The default event tile, used in `/events` list, `/dashboard` registered list, `/admin` overview:

```
┌──────────────────────────┬──────────────────────────┐
│ [slug] [registered]      │ Description text…        │
│                          │                          │
│ Event name (h3)          │ ┌─────────┬─────────┐    │
│ Date · cool-down         │ │ Stat 1  │ Stat 2  │    │
│                          │ └─────────┴─────────┘    │
│ [Action] [Action 2]      │                          │
└──────────────────────────┴──────────────────────────┘
```

- Two equal columns on `md+`, stack on small.
- Left column ends with the action buttons (pill primary + outline secondary + optional Countdown pill).
- Right column ends with a 2-up stat grid (`grid-cols-2 gap-px bg-border/60`).

### 4.9 Code editor

`components/code-editor.tsx` wraps Monaco. **Word-wrap on**, **no horizontal scroll**, theme-aware (`vs-dark` / `vs`). The hosting page splits a 60vh+ viewport into two columns with `lg:overflow-y-auto thin-scroll` on each so problem and editor scroll independently.

### 4.10 Navbar

`components/navbar.tsx`. Sticky, `h-16`, matches body width.

Scope detection — three modes:
- **Default**: `Home · Events · Profile · About`
- **Event** (`/events/[slug]/...`): leading **← Back to home** pill + state-aware links:
  - Past → `Info · Results`
  - Not started OR not registered → `Info`
  - Ongoing + registered → `Info · Questions · Leaderboard · Submissions`
- **Question** (`/events/[slug]/q/[qid]/...`): **← Back to questions** + `Code editor · Leaderboard · Submissions`

Active-link highlighting uses **longest-prefix match** so deeper routes win over their parents. Profile dropdown lives on the right; theme toggle sits next to it.

### 4.11 Profile dropdown

Square corners, identity header (avatar + name + email) on its own bordered row, then padded action group (Profile, Sign out). Sign-out is rose-tinted. Both navbar and `/profile` use the shared `useLogout()` hook from `lib/logout.ts` — never re-implement the sign-out flow inline.

---

## 5. CSS utility classes (globals.css)

| Class | Purpose |
|---|---|
| `.pill` | `rounded-full` shortcut |
| `.boxy-frame` | Border + outer `+` markers (used by `<BoxyFrame>`) |
| `.boxy-bg` | Grid line pattern (80×80 by default; override `background-size` to scale) |
| `.boxy-fade` | Soft reveal animation for hero blocks |
| `.thin-scroll` | Theme-aware thin scrollbar (apply to any `overflow-y-auto` container) |
| `.font-display` | Instrument Serif italic with `ss01` |
| `.text-gradient-name` | 4-stop gradient text with slow shift (used on the dashboard name only) |

Monaco's slider thumb is restyled via `.monaco-host` selectors to match `.thin-scroll`.

---

## 6. Interaction rules

- **Hover surface** on attached rows: `bg-card/40`. On nav pills / segment buttons: text-only `text-muted-foreground → text-foreground`.
- **Active nav pill** (current route): `bg-secondary text-foreground`.
- **Disabled buttons**: `disabled:opacity-50 disabled:bg-foreground/20 disabled:text-foreground/40`. When a button is **rate-limited / locked**, also apply `grayscale` and put the countdown inside the button (`{label} · {N}s`) — see `ActionButton` on the question page.
- **Toasts** are sonner, position `bottom-right`. Success / info / error map directly; do not invent new toast variants.

---

## 7. Forms

- All inputs use shadcn `Input`, `Textarea`, `Select`, `Label`. Spacing pattern:

```tsx
<div className="space-y-2">
  <Label htmlFor="x">Label</Label>
  <Input id="x" … />
  <div className="text-xs text-muted-foreground">Helper text</div>
</div>
```

- Forms inside a card: wrap in `BoxyFrame` with `p-6` / `p-8` inset.
- Submit row: right-aligned, primary on the right, outline/cancel on the left. Buttons are `pill h-10 px-5`.
- For date+time → `components/datetime-picker.tsx` (native `<input type="datetime-local">` with ISO round-trip).

---

## 8. Data & loading states

- **Loading**: `<LoadingFrame label="Loading events" />` from `components/dot-matrix.tsx` — BoxyFrame + dot-matrix wave animation. For compact/inline spots use `<DotMatrixLoader columns={7} rows={1} />`. Never a layout skeleton.
- **Empty**: same shape, replace `Loading…` with the empty message. No empty-state illustrations.
- **Error**: toast first. If the page can't render at all, a short centered message in the same wrapper.

---

## 9. Theming

`<ThemeProvider>` (next-themes) wraps the layout. The toggle is a single icon button (sun ↔ moon) in the navbar — **not** a dropdown. Theme persists via `localStorage`. Both modes are fully supported; when adding new colors, define them under both `:root` and `.dark`.

To opt a hardcoded color in/out per theme, prefer `bg-foreground text-background` style inversion over `dark:` prefixes.

---

## 10. Adding a new page — checklist

1. Wrapper: `mx-auto w-full max-w-[1200px] px-6 py-12`.
2. Header block: caption + h1 + 1-line description.
3. If the page needs auth, call `useRequireRole()` or `useRequireRole("admin")`. Return `null` while `!user`.
4. Use the shared API hooks from `lib/api.ts` — never `fetch()` directly in a component.
5. For lists of >1 same-type item, use `ListFrame` + `ListRow`.
6. For grouped content, wrap in `BoxyFrame`. Don't add `overflow-hidden` to it.
7. Buttons: `pill`, with the heights from §4.4.
8. Status, countdowns, action chips: reuse the recipes — don't redefine colors.
9. Run `pnpm exec tsc --noEmit` before considering it done.

---

## 11. Anti-patterns

- ❌ `rounded-lg` on attached lists / grouped frames. Use square + `+` markers.
- ❌ `box-shadow` for separation. Use border + `+` markers.
- ❌ `overflow-hidden` on a `BoxyFrame`. Clips the corner markers.
- ❌ Hardcoded hex colors. Use semantic tokens.
- ❌ Re-implementing sign-out / API requests inline. Use `useLogout()`, `useEvent*()`, etc.
- ❌ Mixing `Tabs` (shadcn) and the segmented selector on the same page. Pick one.
- ❌ Multiple display-font moments per page. The serif is a punctuation, not a default.

---

## 12. File map (cheat sheet)

```
app/
  globals.css            Tokens, themes, utility classes (.boxy-*, .pill, etc.)
  layout.tsx             Font loading, ThemeProvider, Toaster
components/
  navbar.tsx             Scope-aware navbar
  boxy.tsx               BoxyFrame, PlusMark, BoxyBackdrop
  dot-matrix.tsx         DotMatrixLoader + LoadingFrame — standard loading state
  landing/               Homepage-only interactive sections
  list-frame.tsx         ListFrame, ListRow
  submission-card.tsx    SubmissionList + SubmissionRow
  event-header.tsx       Shared event title/status block
  countdown.tsx          <Countdown to={iso} />
  code-editor.tsx        Monaco wrapper (no horizontal scroll)
  datetime-picker.tsx    Native datetime input with ISO round-trip
  link-button.tsx        <Link> styled with buttonVariants
  theme-toggle.tsx       Single-button theme toggle
  ui/                    shadcn primitives (base-nova)
lib/
  api.ts                 SWR hooks + helpers (isLive/isPast/sortEventsByDate)
  guards.ts              useRequireRole()
  session.ts             useSession()
  logout.ts              useLogout()
  languages.ts           Judge0 language table
  server/                Server-only (Mongoose models, auth, seed)
```

When in doubt, mirror the most recently shipped page — usually the right answer is "do what `/events` does."
