---
name: nqui-states
description: The complete state matrix every interactive thing must handle. Use when building any view or component to ensure you've designed for ALL states, not just the happy path. AI work overwhelmingly fails on missing states (empty, loading, error, edge). This file is the checklist.
---

# nqui States — The Complete Matrix

The #1 reason AI-built UIs feel unfinished: they design the happy path and forget the other 11 states. This file is the checklist. Read it for every screen and component. Don't ship until every applicable state has an intentional design.

## The 12 states every interactive surface can be in

| State | When | Designed how |
|-------|------|--------------|
| **Idle** | Default resting state | The thing you usually think of as "the design" |
| **Hover** | Pointer over (desktop only — degrade gracefully on touch) | Subtle background shift, never a transform |
| **Focus** | Keyboard navigation lands here | Visible ring (`focus-visible:ring-2 ring-ring`), never `outline:none` alone |
| **Active / Pressed** | Mouse down / tap in progress | Slight darken or inset shadow, fast (<100ms) |
| **Selected** | User has chosen this | Persistent visual change (e.g., `bg-accent/70`), distinct from hover |
| **Disabled** | Action unavailable | Reduced opacity (`opacity-50`) + `cursor-not-allowed` + `aria-disabled` — but explain why somewhere |
| **Loading** | Async work in progress, no result yet | Shape-matched `Skeleton`, NOT a spinner unless duration is unknown and tiny |
| **Empty** | Loaded successfully, no data | `Empty` component with one sentence + one action that teaches the interface |
| **Error** | Load or action failed | Inline `Alert variant="destructive"` with cause + recovery, never just "Error" |
| **Optimistic** | User acted, we applied locally, server hasn't confirmed | Render the new state immediately + `toast` with undo |
| **Stale** | Cached data, may be outdated | Subtle "Updated 3 min ago" indicator + refresh affordance |
| **Success / Transient** | Action completed, briefly confirmed | `toast.success` (auto-dismiss) — NEVER a persistent banner |

## State-coverage requirements by surface type

Not every surface needs all 12. Use this matrix to know what's mandatory per surface.

| Surface | Required states | Common omissions to fix |
|---------|-----------------|------------------------|
| **Lists / tables** | idle, loading, empty, error | Empty (most missed), error |
| **Forms** | idle, focus, validation-error, submitting, success, server-error | Submitting state, server-error vs field-error |
| **Buttons** | idle, hover, focus, active, disabled, loading | Loading state (with spinner inside button) |
| **Inputs** | idle, focus, filled, invalid, disabled, read-only | Read-only vs disabled distinction |
| **Cards / items in a list** | idle, hover, focus, selected | Focus (keyboard navigation) |
| **Toggles / switches** | off, on, focus, disabled, indeterminate | Indeterminate for "mixed" bulk states |
| **Async data views** | loading, empty, populated, error, refreshing | Refreshing (vs full reload) |
| **File upload** | idle, dragging-over, uploading, success-each, error-each, complete | Dragging-over, per-file error |
| **Search** | idle, typing, debouncing, loading, results, no-results, error | Debouncing vs loading distinction |
| **Modals / sheets** | closed, opening, open, closing, blocked-by-pending-action | Blocked-by-pending (can't close mid-save) |

## The state machine — common transitions

Designing each state in isolation isn't enough. Design the **transition** between them.

```
fresh page load:
  loading (skeleton, ~300ms min to avoid flash) → populated | empty | error

user adds item:
  populated → optimistic (new item appears immediately, slightly faded)
            → confirmed (full opacity) | error (revert + toast)

user deletes item:
  populated → optimistic (item slides out + toast w/ undo, 6s)
            → confirmed (gone) | undone (slides back)

user submits form:
  idle → submitting (button shows spinner, form disabled)
       → success (toast + navigate | reset) | error (inline + keep values)

cached data view:
  stale (with indicator) → user pulls to refresh → refreshing (spinner overlay, keep stale visible)
                        → updated | error (keep stale, show error toast)
```

## Mandatory rules

1. **No state may be a blank screen.** If loading is < 300ms, suppress the skeleton (use a delay). If > 300ms, show one. Never show whitespace for an indeterminate period.
2. **Empty is a design opportunity, not a failure.** Bad: "No items." Good: "No issues yet — create your first issue to start tracking." with a CTA.
3. **Errors must say what + what to do.** Bad: "An error occurred." Good: "Couldn't save changes — check your connection and try again." with a Retry button.
4. **Optimistic UI requires undo.** If you apply a destructive action immediately, the toast must offer undo for ≥ 6 seconds.
5. **Focus state is non-negotiable.** Removing the focus ring (`outline: none`) without replacing it is an accessibility violation. Use `focus-visible:ring-2 ring-ring ring-offset-2`.
6. **Disabled needs a reason.** A disabled button with no tooltip is a dead end. Either explain why (Tooltip on hover) or hide it.
7. **Loading should preview the shape.** `Skeleton` blocks should match the dimensions of the real content — text lines as text-height bars, images as aspect-ratio boxes.
8. **Success is transient.** Never leave a green success banner on screen — toast and dismiss. Only errors persist until acknowledged.

## State templates (copy these)

### List with all three async states
```tsx
{loading ? (
  <ListSkeleton count={5} />
) : error ? (
  <Alert variant="destructive">
    <AlertTitle>Couldn't load items</AlertTitle>
    <AlertDescription>{error.message}</AlertDescription>
    <AlertAction onClick={retry}>Try again</AlertAction>
  </Alert>
) : items.length === 0 ? (
  <Empty>
    <EmptyHeader>
      <EmptyMedia variant="icon"><InboxIcon /></EmptyMedia>
      <EmptyTitle>{emptyTitle}</EmptyTitle>
      <EmptyDescription>{emptyDescription}</EmptyDescription>
    </EmptyHeader>
    <EmptyContent><Button onClick={onCreate}>{emptyCta}</Button></EmptyContent>
  </Empty>
) : (
  <ItemGroup>{items.map(...)}</ItemGroup>
)}
```

### Button with loading state
```tsx
<Button disabled={isPending} onClick={submit}>
  {isPending ? <Spinner className="size-4" /> : null}
  {isPending ? "Saving…" : "Save"}
</Button>
```

### Form field with validation
```tsx
<Field data-invalid={!!error}>
  <FieldLabel htmlFor={id}>{label}</FieldLabel>
  <Input id={id} aria-invalid={!!error} aria-describedby={`${id}-help`} />
  {error ? (
    <FieldError id={`${id}-help`}>{error}</FieldError>
  ) : (
    <FieldDescription id={`${id}-help`}>{helpText}</FieldDescription>
  )}
</Field>
```

### Optimistic delete with undo
```tsx
function handleDelete(id) {
  const item = items.find(i => i.id === id)
  optimisticRemove(id)
  toast.success(`Deleted "${item.name}"`, {
    action: { label: "Undo", onClick: () => optimisticRestore(item) },
    duration: 6000,
  })
}
```

## The state audit (run before shipping)

For every interactive surface on your view, walk through this list:

- [ ] What does it look like when there's no data?
- [ ] What does it look like while it's loading?
- [ ] What does it look like if loading fails?
- [ ] What does each interactive element look like on hover? on focus? when active? when disabled?
- [ ] What happens if the user submits/clicks while a previous action is still pending?
- [ ] What happens with very long content (long name, long description, 100 items)?
- [ ] What happens with very short content (1 character, 1 item)?
- [ ] Is success communicated? Is it transient (toast) or persistent (UI change)?
- [ ] Can the user undo destructive actions?
- [ ] Is there a focus indicator on every interactive element?

If any answer is "I haven't designed for that," the view isn't done.
