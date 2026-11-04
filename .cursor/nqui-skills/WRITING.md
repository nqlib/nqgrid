---
name: nqui-writing
description: UX copywriting rules — buttons, labels, error messages, empty states, microcopy. The single largest differentiator between AI-built and human-built UI. Read when writing ANY user-facing text in a component.
---

# nqui Writing — Voice, Copy, Microcopy

UX writing is design. "Project deleted" and "Got it — project deleted, undo in 6 seconds" use the same components but feel like different products. This file is the rule set. Read before writing any user-facing string.

## Voice principles

These are not stylistic suggestions — they're the rule set applied to every label, button, message, and toast.

1. **Specific over generic.** Bad: "An error occurred." Good: "Couldn't reach the server." Bad: "Are you sure?" Good: "Delete 412 issues and 1.2 GB of attachments?"
2. **Present tense, active voice.** Bad: "Your changes have been saved." Good: "Changes saved." Bad: "An email will be sent to you." Good: "We'll email you when it's done."
3. **Calm, never alarmist.** Bad: "ERROR! Failed to save!" Good: "Couldn't save — check your connection." Errors are user moments — don't make them feel punished.
4. **Address the user as "you," refer to system as "we" sparingly.** "You haven't created any issues yet." "We'll notify you when…" — but most copy needs no pronoun at all.
5. **No exclamation marks.** Almost never. They read as either alarmist or AI-cheery. The rare exception: legitimate celebration ("Welcome back!" after a long absence — and even then, optional).
6. **No emoji in UI chrome.** They become noise. Reserve for actual user content (chat, notes). Status icons are not emoji — they're SVGs from the icon set.
7. **Title case for buttons and titles. Sentence case for everything else.** Buttons: "Save Changes" or "Save changes"? **Sentence case** ("Save changes") is the modern default — Apple, Linear, Stripe all use it. Only use Title Case for proper page titles ("Workspace Settings" → "Workspace settings").

## Button labels

**Pattern: verb + object.** Always.

| ❌ Bad | ✅ Good | Why |
|--------|---------|-----|
| "OK" | "Got it" / "Save" / "Done" | "OK" is ambiguous about consequence |
| "Submit" | "Send invite" / "Create issue" / "Pay $42" | "Submit" never tells you what happens |
| "Yes" / "No" | "Delete project" / "Keep project" | Yes/No requires re-reading the question |
| "Confirm" | "Confirm deletion" / "Confirm purchase" | Confirm what? |
| "Continue" | "Continue to payment" / "Save and continue" | Continue to where? |
| "Cancel" (in destructive dialog) | "Cancel" is fine here — the action is clear | Cancel of the destructive action |

**Verb tense:** present imperative ("Save", "Delete", "Send"). Not past ("Saved"), not future ("Will save"), not gerund ("Saving" — that's a loading state, not a label).

**Length:** 1–3 words is the target. 4 only if the verb genuinely needs an object phrase ("Move to archive").

**Primary vs secondary verb pairs:**
- "Save" / "Cancel" — not "Save" / "Discard" (discard sounds more destructive than it is)
- "Delete" / "Keep" — destructive contrast, neutral keep
- "Send invite" / "Cancel" — verb+object on primary, single-word on escape
- "Publish" / "Save as draft" — both have meaning, no "Cancel" needed

## Error messages

**Pattern: what happened + why (if useful) + what to do.**

| ❌ Bad | ✅ Good |
|--------|---------|
| "Error." | "Couldn't save changes." |
| "Invalid input." | "Use a valid email address (e.g., name@company.com)." |
| "Network error." | "Couldn't reach the server — check your connection and try again." |
| "Permission denied." | "You don't have permission to edit this project. Ask the workspace admin to give you the editor role." |
| "500 Internal Server Error" | "Something went wrong on our end. We're looking into it — try again in a minute." |

**Rules:**
- Never use error codes in user-facing text (log them, don't show them — unless it's a developer tool)
- Don't blame the user even when it's their input ("Invalid email" → "Use a valid email like name@company.com")
- Don't apologize excessively. One "Sorry" max, usually none. Solve the problem instead.
- If the user can fix it, tell them how. If they can't, tell them what we're doing about it.

## Empty states

**Pattern: title (what's empty) + description (why this is normal and what to do) + CTA (the one action that fills it).**

```
❌ Bad:                    ✅ Good:
No items.                   No issues yet
                            Create your first issue to start tracking work.
                            [+ New issue]
```

**Rules:**
- Never just say "Empty" or "No data" alone — that's a state, not a message.
- The CTA in the empty state should be the SAME action as the primary CTA above the list. Don't introduce new actions just for empty.
- For a filtered empty state ("no issues match your search"), give an escape route — "Clear filter" — not just an apology.
- Onboarding empty states (user's first time) can be longer and educational. Returning-user empty states (user deleted all their items) should be brief.

**Filtered vs onboarding empty states:**
```tsx
// Onboarding empty (no items ever)
<EmptyTitle>No issues yet</EmptyTitle>
<EmptyDescription>Create an issue to track bugs, features, or anything else you're working on.</EmptyDescription>
<Button>+ New issue</Button>

// Filter empty (items exist, just none match)
<EmptyTitle>No issues match "{searchTerm}"</EmptyTitle>
<EmptyDescription>Try a different search or clear the filter.</EmptyDescription>
<Button variant="outline" onClick={clearFilter}>Clear filter</Button>
```

## Confirmation copy (destructive actions)

**Pattern: state the specific consequence, name the action button after the verb.**

```
❌ Bad:                          ✅ Good:
Title: "Are you sure?"           Title: "Delete this project?"
Body: "This action cannot        Body: "All 412 issues and 1.2 GB of
       be undone."                      attachments will be removed.
                                        This cannot be undone."
[Cancel] [OK]                    [Cancel] [Delete]
```

**Rules:**
- Title is a question ending in "?". Body is a statement.
- Body must state the SPECIFIC stakes — count of items, name of thing being affected, time period. Generic "this cannot be undone" without specifics is noise.
- Primary button repeats the verb from the title ("Delete this project?" → "Delete")
- Escape button is always "Cancel", not "Keep" or "No"

## Toasts and transient messages

**Success toasts: state the result. Past tense, no exclamation.**

```
"Project archived"  ← good
"✓ Successfully archived your project!" ← bad (icon redundant, redundant verb, exclamation)
```

**Toast with undo:**
```
"Issue deleted" [Undo]
"Moved to archive" [Undo]
"3 items archived" [Undo]
```

**Toast for async confirmation (started, not finished):**
```
"Generating report — we'll email you when it's ready"
"Invitation sent to alex@company.com"
```

**Duration:**
- Success without action: 3 seconds
- Success with undo: 6 seconds (Gmail standard)
- Error: until dismissed (don't auto-dismiss errors)
- Info: 4 seconds

## Labels and microcopy

### Field labels
- **Sentence case, no colon.** "Email address" not "Email:"
- **Specific over generic.** "Work email" not "Email" (when you mean specifically work email)
- **Match the data being collected.** "Phone number" not "Phone" if you need a number

### Field descriptions (helper text)
- One sentence, no period needed
- Explain the consequence, not just the format
  - Bad: "Maximum 50 characters"
  - Good: "Shown in the sidebar and on invoices"

### Placeholders
- **Don't replace labels with placeholders.** Both serve different purposes — labels are persistent, placeholders are examples.
- Use placeholders for format examples: "you@company.com" not "Enter your email"
- Don't use placeholders for required-field markers — that's what asterisks (or "required") are for

### Time and date formatting
- **Relative for recent**: "2 minutes ago", "Yesterday", "Last Tuesday"
- **Absolute for old**: "May 17, 2026" or "May 17"
- **Show absolute on hover** for relative timestamps (use `Tooltip`)
- **24-hour for product UIs in international contexts**; 12-hour for US-only consumer
- Always include timezone for scheduled times: "3:00 PM PT"

### Numbers and units
- **Abbreviate large numbers**: 1,234 → 1.2k, 1,234,567 → 1.2M (in dense UIs)
- **Use thin spaces or commas for thousands**, never bare digits: `1,234` not `1234`
- **Always show units inline**: "12 MB", "42 issues", "3 days"
- **Round in summary, exact in detail**: "About 1.2k issues" in a header, "1,247 issues" in a stats panel
- **Use `tabular-nums` font feature** so numeric columns align

## Anti-patterns (the AI-flavored ones)

These are the copy patterns that immediately signal "AI wrote this":

| ❌ Anti-pattern | ✅ Use instead |
|----------------|---------------|
| "Welcome to your dashboard!" | "Dashboard" (let the page name itself) |
| "Let's get started!" | "Create a project to begin" |
| "Awesome!" / "Great job!" | (nothing — completion is its own reward) |
| "Effortlessly manage your..." | (cut the entire sentence) |
| "Powered by AI" / "Smart suggestions" | (let the feature speak for itself) |
| "Click here to..." | "Open settings" / button with verb |
| "Please" before every instruction | (cut "please" — direct is respectful in UI) |
| "Don't worry, your data is safe" | (don't introduce worry just to dismiss it) |
| Emoji in every label (📊 Analytics, 🎯 Goals) | (icon SVG, no emoji) |
| "Whoops!" / "Oops!" / "Yikes!" | "Couldn't [verb]" (neutral, specific) |
| "Loading..." / "Please wait..." | (use Skeleton matching the shape, no text) |
| "You have no items yet" | "No issues yet" (omit "you have") |
| Sentences ending in "..." | (use only for in-progress states like "Saving…") |

## The microcopy audit

Before shipping a view, read every string aloud:

- [ ] Does each button tell the user what will happen when clicked?
- [ ] Does each error message tell the user how to fix it?
- [ ] Does the empty state teach the interface or just apologize?
- [ ] Is there any "Please" or "Sorry" that could be cut?
- [ ] Is every "this/that/it" specific (named, not pronoun)?
- [ ] Any exclamation marks? Cut them unless legitimately celebratory.
- [ ] Any em-dashes in places where a colon or period would work? (Em-dashes are an AI signature — use them deliberately, not reflexively.)
- [ ] Does the copy read like a tired colleague wrote it, or like a marketing person wrote it? Tired colleague is right.

If anything reads as "trying too hard," cut it.
