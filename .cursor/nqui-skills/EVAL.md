---
name: nqui-eval
description: Eval set + grading rubric for AI agents using nqui. Run before each release. The skills folder is theory until the eval validates it produces consistently good output. Without this, nqui is documentation, not infrastructure.
---

# nqui Eval — How We Measure "Production AI Ready"

The skills folder claims that AI agents using nqui produce reliably good output. **Without an eval, that's an unfalsifiable claim.** This file is the eval set + grading rubric. Run it before any release that touches tokens, components, or skills.

## How to run

1. Load **only** the nqui skills folder + `AGENT_PROMPT.md` into a fresh agent context (Claude API, GPT-4, etc.)
2. Send each prompt below verbatim, in a fresh conversation
3. Let the agent build the code (no follow-up clarifying questions allowed in the eval — measure cold output)
4. Score using the rubric below
5. Track per-prompt scores over time. Regression = something broke.

## Grading rubric (per prompt, max 10)

| Category | Max | What to check |
|----------|-----|---------------|
| **Composition** | 2 | Right named pattern picked? Surface cap respected? Three-surface rule followed? |
| **State coverage** | 2 | All required states designed? Empty / loading / error present where needed? |
| **Component selection** | 1 | Right component for the situation? (Dialog vs AlertDialog, ToggleGroup vs RadioGroup, etc.) |
| **Writing** | 1 | Copy specific (not "Submit" / "Are you sure?")? No exclamation marks? Sentence case? |
| **Motion** | 1 | Restrained (default: none)? No banned curves? `prefers-reduced-motion` respected? |
| **Anti-patterns avoided** | 2 | Zero from the 10 hard-banned (nested cards, gradient text, hero metric template, etc.)? |
| **Code quality** | 1 | Readable, uses kit conventions, no custom CSS where component exists? |

**Pass threshold: 8/10 average across all prompts. Below 7 average = block release.**

---

## The eval set (12 prompts)

Each prompt simulates a real user request that the kit is expected to handle. Coverage spans the long tail of common product surfaces.

### 1. Auth: login form
> Build a login screen with email + password. Include "forgot password?" link and a primary sign-in button. The user should see clear error messages if auth fails.

**Looks for:** `FieldSet` + `Field` + `Input` + `FieldError`. Sentence-case labels. Specific error copy ("Incorrect email or password" not "Auth failed"). One primary button + `outline` for secondary. Loading state on submit button. NO `Dialog` (this is a page).

### 2. Auth: OAuth + email signup
> Build a signup page that offers Google OAuth and email signup. Show a divider between OAuth providers and the email form.

**Looks for:** OAuth buttons as `variant="outline"` with provider name + brand-name (no `Submit`). `Separator` with text label. Email form uses same `Field` pattern as login. Reasonable security copy ("We'll never share your email").

### 3. Settings: account preferences
> Build an account settings page with: display name, email, time zone selector, weekly digest toggle, two-factor toggle, change password button, danger zone (delete account).

**Looks for:** `FieldSet` + `FieldGroup`. `Switch` for toggles. `Select` for time zone. Danger zone uses `AlertDialog` for delete confirmation with SPECIFIC stakes (not "Are you sure?"). Surface cap respected — no card per field.

### 4. Dashboard: deploy/build monitor
> Build a deployment dashboard showing recent deploys with status (building, success, failed), commit info, and a detail panel when one is selected.

**Looks for:** Master-detail pattern. Responsive switch to `Sheet` below 900px. `Tracker` for build history visualization. `Badge` for status. Real status copy ("Building" / "Failed" not "Status 1"). Empty + loading states for the list.

### 5. Billing: pricing + checkout
> Build a pricing page with 3 tiers (Free / Pro / Team). Selecting a paid tier opens a Sheet with order summary and a payment form (card number, expiry, CVC).

**Looks for:** Pricing cards with ONE recommended (subtle emphasis, not screaming). `Sheet` for checkout (long form). `Field` + `InputOTP` or formatted `Input`. Specific button copy ("Pay $49/month" not "Submit"). Real-feeling totals.

### 6. Search: filterable list
> Build a project search page with a search box, status filter (open/closed/all), assignee filter, and results list. Show "no results" state when nothing matches.

**Looks for:** Search input with leading icon. `ToggleGroup` for status (NOT RadioGroup). `Combobox` for assignee. Filter container uses `bg-muted/30`. `Empty` w/ "clear filter" action (not just apology). Result count + sort.

### 7. File upload: multi-file with progress
> Build a file uploader that accepts multiple files via drag-and-drop or file picker, shows per-file progress, and handles errors per file (e.g., file too large).

**Looks for:** Drop zone with active state on dragover. Per-file `Progress`. Per-file status (uploading/success/error). Specific error messages per file. Remove button per file. No alarming language for fails.

### 8. Data table: sortable + paginated
> Build a customers data table with columns: name, email, plan, signup date, MRR. Make it sortable, paginated, with row selection for bulk actions.

**Looks for:** `DataTable` with header sort indicators. Sticky header on scroll. Bulk action bar appears on selection (sticky pill at bottom). `Pagination` component. Real-feeling column widths.

### 9. Onboarding: 4-step wizard
> Build a 4-step onboarding wizard: workspace name → invite teammates → choose integrations → review and start. Show progress, allow back navigation, validate each step.

**Looks for:** `Progress` or step indicator. ONE primary action per step ("Continue" / "Skip for now" / "Start"). Back is `variant="outline"`. Validation prevents advance. `Alert` for step errors. Centered single card on each step.

### 10. Notification preferences
> Build a notification settings page where the user can choose, per category (mentions, comments, weekly digest, security alerts), whether to receive Email / Push / Slack — like a matrix.

**Looks for:** Table-like or grid layout with `Switch` or `Checkbox` per cell. Clear column headers. Row labels explain each category. "Apply to all" affordance per row. No nested cards.

### 11. Chat / message thread
> Build a chat interface with a message list (showing user vs assistant alternation), an input at the bottom with send button, and a typing indicator when the assistant is responding.

**Looks for:** Distinct visual for user vs assistant (NOT just color — also alignment or avatar). `Item` or custom message block. Auto-scroll to bottom. Loading dots while assistant responds. Send on Enter (Shift+Enter for newline).

### 12. Error / empty page
> Build a 404 page with a clear message, helpful next actions (go home, search, contact), and the site's normal navigation.

**Looks for:** `Empty` component or similar. Specific, friendly copy ("This page moved or was deleted") not "404 Not Found". 2-3 actions, ONE primary. Page chrome still present (user isn't stranded).

---

## Common failure modes to watch for

These are the patterns the eval should catch reliably. If multiple prompts surface the same failure, fix the underlying skill/recipe.

| Failure mode | Symptom in output | Fix in |
|--------------|------------------|--------|
| Three-surface nesting | `<Card><Card><Card>` or `bg-muted/60` inside `bg-muted/40` | `ELEVATION.md`, lint rule |
| Empty state forgotten | List renders blank when 0 items | `STATES.md`, component template |
| Generic copy | "Submit", "An error occurred", "Are you sure?" | `WRITING.md` |
| Bouncy/elastic motion | overshoot easing on any element | `MOTION.md` |
| Wrong component | RadioGroup in toolbar, Dialog for destructive confirm | `COMPONENTS_INDEX.md` decision tables |
| Side-stripe status | `border-l-4 border-yellow-500` | `RECIPES.md` Status Pill recipe |
| Two primary buttons | Two `variant="default"` Buttons in one surface | `nqui-composition/SKILL.md` |
| Wall-of-cards layout | every section wrapped in Card | `COMPOSITION.md` |
| Tooltip-as-label | icon button with only Tooltip context | A11y rule in `AGENT_PROMPT.md` |
| Custom CSS where component exists | hand-rolled dropdown instead of `Select` | `AGENT_PROMPT.md` "never reach outside the kit" |

---

## Running the eval — what to do with results

After running 12 prompts:

1. **Sum scores.** Average ≥ 8 = ship. 7-8 = warn, fix obvious gaps. < 7 = block release.
2. **Per-prompt analysis.** Which prompts scored low? Each low score points to a missing recipe or unclear rule.
3. **Failure clustering.** If 5 prompts all forgot empty states, the issue is STATES.md isn't being read — restructure the routing in `READ_BUDGET.md`.
4. **Anti-pattern leak detection.** If "no nested cards" was violated in 3+ prompts, add a lint rule, don't just update docs.
5. **Trend over time.** Re-run after token changes / new components / doc rewrites. Did the score go up? Down? That's the signal.

## When to run

- **Before any release** that touches: tokens, component APIs, skills folder structure, AGENT_PROMPT
- **After any breaking visual change** (we just shipped Card-no-shadow and chart palette flip — should have re-run)
- **Monthly** as a baseline regression check
- **Before adding a new component** — make sure existing patterns still work

---

## What this eval does NOT measure

- Performance (runtime, bundle size) — separate concern
- Accessibility audits (run axe-core separately)
- Cross-browser rendering (visual regression suite)
- Long-form copy quality (eval is short prompts)
- Multi-page app coherence (eval is per-screen)

These are valuable. They're not in scope here. The eval measures: **"given a prompt, does the agent produce something a Linear designer wouldn't be embarrassed by?"**

That's the bar nqui ships to.
