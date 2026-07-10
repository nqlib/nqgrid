---
name: design
description: Build a new product UI screen/page/feature with @nqlib/nqui. Apple-inspired craft, 2+1 elevation rule, full state coverage, restrained motion. Use when the user says "design", "build", "create a page", "make a screen", or any new-UI request. Loads the full nqui skill chain and follows the Agent Build Protocol from start to finish.
argument-hint: "[what to build, e.g. 'a login form' or 'a sprint dashboard']"
---

# /design — Build with nqui

This is the **canonical entry point** for any UI build request when nqui is available. It orchestrates the full skill chain (composition → patterns → recipes → components) and produces production-quality output.

## What this skill does

When invoked, you build a new UI surface using `@nqlib/nqui` following the **Agent Build Protocol** (10 steps) and the **30-second Linear designer test** before declaring done.

The output bar: a senior Linear / Vercel / Stripe / Apple designer reviewing your diff would find **zero** AI-flavored cues (nested cards, "Submit" buttons, missing empty states, decorative shadows, generic copy).

## Mandatory protocol

### Step 1 — Load the entry contract
Read `~/.claude/skills/nqui/AGENT_PROMPT.md` if you have not in this conversation. This is the non-negotiable rule set: hard rules, anti-patterns, build flow. Don't skip it.

### Step 2 — Load design context
Check for `.impeccable.md` in the project root.
- If present: use that brand/voice/aesthetic context.
- If absent: ASK the user for brand tone, target audience, and any reference apps. Do not infer from the codebase — code tells you what was built, not who it's for.

### Step 3 — Understand the user's job (5-word outcome)
- One sentence: what is the outcome of this screen?
- One primary action?
- What can move off-screen (Sheet, route, hover card)?

If the user's request is vague ("build me a dashboard"), ask 2-3 clarifying questions before writing code. Generic prompts produce generic output.

### Step 4 — Pick a named layout pattern
Read `~/.claude/skills/nqui/COMPOSITION.md` and match the request to one of the named patterns:
- App Shell (sidebar + content)
- Settings page
- Dashboard (metrics + table/chart)
- Master-Detail Split (responsive → Sheet below 900px)
- Wizard / Stepper
- Command / Search Interface
- Form Dialog

Commit to one. Don't blend.

### Step 5 — Look up combos in RECIPES.md
Read `~/.claude/skills/nqui/RECIPES.md` and grab the specific recipes you need (status pill, bulk action, filter toolbar, the three states, auth recipes 16-22 for login/signup, etc.). Don't reinvent — use the canonical blueprints.

### Step 6 — Apply the elevation rule
Read `~/.claude/skills/nqui/ELEVATION.md`. Cap inline nesting at **2 surfaces**: page (`bg-background`) → card (`bg-muted/40`). Past that, use spacing + uppercase labels + type weight. `bg-popover` + `.nqui-elevated` is for Dialog / Sheet / Popover / DropdownMenu only.

### Step 7 — Cover all states
Read `~/.claude/skills/nqui/STATES.md`. For every interactive surface, design:
- Lists: idle + loading (Skeleton) + empty (Empty w/ CTA) + error (Alert w/ retry)
- Forms: idle + focus + filled + submitting + validation-error + server-error + success
- Buttons: idle + hover + focus + active + disabled + loading
- Async views: loading + populated + empty + error + refreshing

**No blank screens. No happy-path-only views.**

### Step 8 — Write the copy properly
Read `~/.claude/skills/nqui/WRITING.md`. Every button, label, error, empty state, toast must:
- Specific verb + object ("Send invite", not "Submit")
- Errors say what + how to fix
- Sentence case, present tense, no exclamation marks
- No "Welcome!" / "Awesome!" / "Let's get started!" — these are AI signatures
- No emoji in UI chrome

### Step 9 — Motion only with intent
Read `~/.claude/skills/nqui/MOTION.md` ONLY if you're adding animation. Default: no motion. When present: 150ms quick / 200ms standard, ease-out for entrances, ease-in for exits. Never bounce/elastic. Respect `prefers-reduced-motion`.

### Step 10 — Self-review (the 30-second Linear designer test)
Before declaring done, walk this checklist:
1. Hierarchy clear within 2 seconds?
2. All states designed (not just happy path)?
3. Copy specific, not generic?
4. One primary action per surface?
5. Spacing varied (not monotonous)?
6. Cards used only for bounded topics?
7. Focus styles on every interactive element?
8. No decorative shadows on flat elements?
9. No nested cards inside cards?
10. No banned anti-patterns (border-l-4 stripes, gradient text, hero metrics, "Submit" buttons)?

**If you can name 2+ failures → fix them BEFORE asking the user.**

## Routing reference

If uncertain at any step, the doc to load is in `~/.claude/skills/nqui/READ_BUDGET.md`. Don't bulk-read the skills folder.

## What you do NOT do in /design

- Don't ship a single happy-path view without the other states
- Don't invent custom CSS where a component exists
- Don't add transitions "to feel modern" — most state changes should not animate
- Don't ask "is this OK?" when you can name 2+ failures from the self-review
- Don't deliver work that would trigger any of the 10 "Linear designer" reactions

## What you DO in /design

- Cite which named pattern + which recipes you used (helps the user understand the choices)
- Apply the surface rule strictly (count surfaces before declaring done — never more than 2 inline)
- Use real-feeling content (not lorem ipsum, not "Card Title 1 / Card Title 2")
- Test the responsive split if using master-detail (does it switch to Sheet below 900px?)
- Verify accessibility minimums (focus visible, ARIA on interactive non-buttons, no tooltip-as-label)

## The promise

Output from `/design` is reliably 8/10 or better. Not 10/10 (that requires design context this skill can't infer alone), but never embarrassing, never AI-flavored, never missing critical states.

That's the bar. Hit it on every invocation.
