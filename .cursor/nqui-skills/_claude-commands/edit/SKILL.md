---
name: edit
description: Refine, fix, or improve existing UI built with @nqlib/nqui. Diagnoses issues against the design rules (elevation, states, writing, motion), then applies the smallest fix that resolves them. Use when the user says "fix this", "improve this", "this looks off", "edit", "refine", or references a specific page/component that needs polish. Different from /design (which builds from scratch) — /edit changes what's already there.
argument-hint: "[what to fix, e.g. 'the sprint tracker page' or 'this dialog']"
---

# /edit — Refine existing nqui UI

This is the **canonical entry point** for fixing or improving UI that's already in the codebase. It runs a diagnostic pass against the nqui design rules, names what's wrong specifically, then applies the smallest fix.

Different from `/design`:
- `/design` = build from scratch (Agent Build Protocol, 10 steps)
- `/edit` = read what's there, diagnose, fix in place

## Mandatory protocol

### Step 1 — Load the entry contract (skip if loaded this session)
Read `~/.claude/skills/nqui/AGENT_PROMPT.md`. The rules you'll judge the existing code against.

### Step 2 — Read the target
- If the user named a file/component: read it.
- If the user pointed at a page route: find the page file in `src/pages/` (or wherever the project keeps them) and read it.
- Read enough context to understand the surrounding components/layout, not just the line they're complaining about.

### Step 3 — Diagnose against the design rules
Walk the code mentally against these checks (skip checks the user explicitly excluded):

| Rule | What to look for | Doc |
|------|------------------|-----|
| **Elevation** | Cards inside cards inside cards? `bg-muted/60` or `bg-muted/70` (third surface)? `shadow-*` on inline cards? | `ELEVATION.md` |
| **State coverage** | Lists without empty/loading/error? Buttons without loading state? Forms without validation states? | `STATES.md` |
| **Composition** | More than 3 surfaces on screen? Two competing primary buttons? Toolbar floating on bg-background? | `COMPOSITION.md` |
| **Writing** | "Submit" / "OK" / "Are you sure?"? Exclamation marks? "Welcome!" / "Awesome!"? Generic errors? | `WRITING.md` |
| **Motion** | Elastic/bounce easing? Durations > 250ms for routine state changes? Animating layout properties? | `MOTION.md` |
| **Component selection** | RadioGroup in a toolbar? Dialog for a confirmation? Tooltip as the only label? Sheet for >5 fields? | `COMPONENTS_INDEX.md` |
| **Anti-patterns** | `border-l-4` colored stripes? Gradient text? Hero metric template? Sparklines as decoration? Glassmorphism on inline cards? | `nqui-composition/SKILL.md` |

### Step 4 — Name the findings specifically
Before fixing anything, tell the user what you found. Use this format:

```
Findings (in order of severity):

🔴 [P0] {issue} — {file:line}. Why it matters: {one sentence}.
🟠 [P1] {issue} — {file:line}.
🟡 [P2] {issue} — {file:line}.
```

P0 = clear rule violation (banned anti-pattern, missing critical state, broken accessibility).
P1 = noticeable quality issue (wrong component, lazy copy, monotonous spacing).
P2 = polish (could be tighter, but not embarrassing).

If you find nothing: say so. Don't invent issues to look thorough.

### Step 5 — Propose minimum-viable fixes
For each finding, propose the smallest change that resolves it. Don't refactor surrounding code unless the user asked. Examples:

- "Submit" → "Send invite" (change 1 word)
- Nested Cards → outer Card + `<section>` with uppercase label (replace 1 Card pair)
- Missing empty state → add Empty component with one CTA (insert 8 lines)
- Bouncy easing → swap to `ease-out` (change 1 className)

The goal is **edit, not rewrite**. Honor the existing structure; remove violations.

### Step 6 — Apply the fixes
Apply your proposed fixes via Edit tool. After each change, briefly state what changed and why ("Swapped to `Sheet` because the form has 8 fields — Dialog would feel trapped").

### Step 7 — Self-review the edit
Walk the same diagnostic again post-edit. If new issues surfaced from your fix, name them — don't pretend the edit is done if it created new violations.

## What you do NOT do in /edit

- Don't rebuild the page. The user said "edit," not "redesign."
- Don't bundle unrelated improvements ("while I was here I also refactored X"). Stay scoped.
- Don't fix one violation by introducing another (replacing nested Cards with a 4-color gradient header — that's just a different anti-pattern).
- Don't skip the diagnostic step ("I'll just fix obvious stuff"). The diagnostic IS the value — naming what's wrong is half the deliverable.
- Don't ask the user to verify before applying fixes if the fixes are P0 (clearly wrong) and small (< 20 lines). Just do them.

## What you DO in /edit

- Cite the rule each fix maps to ("removed the third nested Card per ELEVATION.md")
- Note what you intentionally left alone ("the Card-of-cards on line 80 looks suspect but I'm leaving it — it's a Sortable wrapper, not a hierarchy choice")
- When the user's complaint is vague ("it looks off"), do the diagnostic first, then offer 2-3 specific options with trade-offs

## Triggering examples

- "the sprint tracker feels heavy" → /edit, diagnose elevation + spacing + density
- "this dialog has too many fields" → /edit, suggest Sheet conversion + state coverage check
- "fix the empty state on the inbox page" → /edit, audit the empty state against STATES.md + WRITING.md
- "this button feels wrong" → /edit, check component selection + label specificity + state coverage
- "make this look more Apple" → /edit, diagnose against `nqui-composition/SKILL.md` clarity/deference/depth principles

## The promise

`/edit` finds the real issues, not imaginary ones. Names them with rules and locations. Fixes them minimally. Leaves the working parts alone.

That's the bar.
