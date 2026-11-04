---
name: impeccable-reference-index
description: One-line summary of each impeccable reference file. Read this before opening any reference file so you load only the topic you need (never all 8).
---

# Impeccable reference — pick ONE

The main `impeccable/SKILL.md` covers principles inline. Open a reference file ONLY when you need depth on that specific topic. Never load multiple references at once.

| File | Lines | Load when |
|------|-------|-----------|
| `typography.md` | 142 | Picking fonts, modular scale ratios, OpenType features, web font loading, line-length calculations |
| `color-and-contrast.md` | 105 | OKLCH details, WCAG contrast calculation, palette construction beyond the inline `<color_principles>` |
| `spatial-design.md` | 100 | Grid systems, container queries, optical centering, fluid spacing math |
| `motion-design.md` | 99 | Easing curves, reduced-motion patterns, timing values, transform-vs-layout details |
| `interaction-design.md` | 195 | Form patterns, focus management, loading-state choreography, progressive disclosure depth |
| `responsive-design.md` | 114 | Mobile-first patterns, container queries vs viewport queries, fluid design math |
| `ux-writing.md` | 107 | Labels, error messages, empty-state copy, button text patterns |
| `craft.md` | 70 | The `craft` mode flow (only when invoked via `/impeccable craft`) |
| `extract.md` | 70 | The `extract` mode flow (only when invoked via `/impeccable extract`) |

## Rules

1. **One file per task.** If you need typography AND color, do typography first, finish the task, then color if still needed.
2. **Skip if inline principle is enough.** `impeccable/SKILL.md` has `<typography_principles>`, `<color_principles>`, `<spatial_principles>` blocks that often answer the question without opening the reference.
3. **`craft.md` and `extract.md` are mode-only** — never load unless the user typed `/impeccable craft` or `/impeccable extract`.
