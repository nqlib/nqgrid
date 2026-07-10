# nqui Toggle

> **One on/off state.** Not a group. E.g. bold in editor.

## When to Use

- **State:** Single boolean (on/off)
- **Context:** Standalone, or one item in a toolbar

**Choose Toggle when:** One independent switch (bold, mute, pin). User toggles one thing.

**Use ToggleGroup when:** Multiple related toggles (bold + italic + underline) or single/multi selection from options.

**Use Switch when:** Form setting (dark mode, notifications). Toggle = formatting/tool state. Switch = app preference.

## Import

```tsx
import { Toggle } from "@nqlib/nqui"
```

## Basic

```tsx
<Toggle aria-label="Bold" pressed={isBold} onPressedChange={setIsBold}>
  <BoldIcon />
</Toggle>
```

## Variants

- **default** – Off: subtle border (`border-input/60`), shadow. On: `bg-secondary` + gradient + shadow (secondary-like layering).
- **outline** – Off: border, shadow. On: same secondary layering.
- **segmented** – Primary fill when on (used in ToggleGroup single). Gradient + shadow when selected.

## Context

Place in realistic app context (toolbar, panel). Reference: `src/pages/ComponentShowcase.tsx` → Toggle & ToggleGroup section.
