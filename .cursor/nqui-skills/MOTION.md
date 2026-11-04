---
name: nqui-motion
description: Motion design as a system, not decoration. Easing vocabulary, timing scale, choreography, reduced-motion. Use when adding ANY animation or transition. Without this, motion is either absent (cold) or busy (chaotic).
---

# nqui Motion — Choreography, Not Decoration

Motion is design. It either serves comprehension (showing where something came from, conveying hierarchy, providing feedback) or it's noise. This file is the vocabulary.

## Three motion principles

1. **Motion has a job.** Every animation answers one of: *Where did this come from? Where did it go? What changed? What's happening right now?* If you can't answer, cut the animation.
2. **Motion respects continuity.** Things appear from their source (Sheet slides from edge, Popover scales from its trigger, Toast slides from the toast region — never from random space).
3. **Motion gets out of the way.** A confirmation animation that takes 600ms means the user waits 600ms before moving on. Make motion fast unless it's communicating something significant.

## The timing scale

Use named tokens, not arbitrary milliseconds. These cover 95% of UI motion.

| Token | Duration | When to use |
|-------|----------|-------------|
| **instant** | 0ms (no animation) | State toggles where motion would be a delay (`checked`, `disabled`) |
| **micro** | 100ms | Hover states, focus rings, color shifts on press |
| **quick** | 150ms | Most state changes: opening dropdowns, button presses, small reveals |
| **standard** | 200-250ms | Modal/Sheet/Drawer entries, page transitions, accordion expansions |
| **dramatic** | 300-400ms | One-off attention moments — initial empty state appearing, success confirmation, onboarding cues |
| **never** | ≥500ms | Almost nothing. If you reach for 500ms+, you're decorating, not communicating |

**Default if unsure:** 150ms (`quick`). Most UI motion should be this fast.

## The easing vocabulary

Easing curves communicate **physicality** — they tell the eye whether something is decelerating naturally (good) or moving mechanically (bad).

| Curve | Tailwind / CSS | When |
|-------|---------------|------|
| **ease-out** (`cubic-bezier(0.16, 1, 0.3, 1)`) | `ease-out` | **Default for entrances.** Things decelerate as they arrive — feels natural |
| **ease-in** (`cubic-bezier(0.4, 0, 1, 1)`) | `ease-in` | **Default for exits.** Things accelerate as they leave — out of the way |
| **ease-in-out** | `ease-in-out` | Reserved for symmetric back-and-forth (toggle that animates same way both directions) |
| **linear** | `linear` | Only for continuous motion (loading bar, spinner, marquee) — never for state changes |
| **spring** (react-spring / framer) | — | Only when modeling physical objects (drag, drawer pull). Subtle, not bouncy |

**Banned curves:** elastic, bounce, anything with overshoot > 10%. They look dated and tacky. Real objects decelerate smoothly; they don't sproing.

## Animate this, never animate that

| ✅ Animate | ❌ Never animate |
|------------|------------------|
| `opacity` | `width` / `height` (use grid-row tricks if you need height transition) |
| `transform` (translate, scale, rotate) | `top` / `left` / `right` / `bottom` |
| `filter: blur()` (sparingly) | `padding` / `margin` |
| `background-color` (subtle, fast) | `box-shadow` (very expensive — use opacity on a shadow layer instead) |
| `color` | `font-size` |
| CSS variables (modern, GPU-friendly) | Layout properties that cause reflow |

**Why:** transform and opacity are GPU-composited and free. Layout properties cause reflow and jank, especially during scroll.

## What to animate, when

### Entrance / exit (mount, unmount)
- **Modal/Dialog:** scale from 95% + fade in, 200ms ease-out
- **Sheet:** translate from off-screen edge, 250ms ease-out (in), 200ms ease-in (out)
- **Popover/Tooltip:** scale from 95% + fade, 150ms ease-out, origin at trigger
- **Toast:** slide in from toast region (usually bottom or top-right), 200ms ease-out
- **Empty state on first appearance:** fade in + translate up 4px, 300ms ease-out
- **List items appearing:** stagger 30ms per item, fade + translate up 8px each, ease-out

### State changes
- **Selection (item in a list):** background color shift, 150ms
- **Button press:** scale 0.97 for 100ms, then back — micro-affordance
- **Hover:** background or color shift, 100ms — never transform
- **Focus ring:** instant appear, fade out at 150ms

### Attention direction (use sparingly)
- **Skeleton → real content:** crossfade 150ms (avoid the "snap")
- **Optimistic item appearing:** fade in at 70% opacity, then to 100% when confirmed
- **Error shake:** translate x ±4px, 4 cycles of 50ms each — only for form submission errors with severity

### Continuous (loading)
- **Spinner:** 1 full rotation per 900ms, linear
- **Skeleton shimmer:** 1.5s loop, ease-in-out, very subtle (8-12% opacity range)
- **Loading bar (indeterminate):** 1.5s loop, ease-in-out
- **Progress bar (determinate):** transition `width` change with 200ms ease-out (this is one of the few times width animation is OK because it represents real progress)

## Choreography — when multiple things move

Bad: everything animates at once → chaos.
Good: a clear sequence the eye can follow.

### Stagger
When N similar things appear (list items, cards, nav items), animate them sequentially with a small delay (20-40ms between each). Stagger creates a sense of rhythm and avoids the "everything pops at once" feel.

```tsx
{items.map((item, i) => (
  <div
    key={item.id}
    style={{ animationDelay: `${i * 30}ms` }}
    className="animate-fade-in-up"
  >
    ...
  </div>
))}
```

**Cap stagger at ~8 items.** Beyond that, the last items appear so late it feels broken. For larger lists, skip the stagger or use a much smaller delay (10ms).

### Sequence (different things, in order)
When a complex element appears, parts can arrive in sequence — but only when sequence conveys meaning:

```
modal appears:
  backdrop fades in (150ms)
  → modal scales in (200ms, starts at 50ms — backdrop catches up)
  → modal content fades in (150ms, starts at 200ms)
```

**Default to simultaneous unless sequence is meaningful.** Don't sequence parts of a single UI element — that fragments perception.

## Reduced motion (mandatory)

Respect `prefers-reduced-motion: reduce`. This is not optional — vestibular disorders are real.

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**What survives reduced motion:**
- Opacity transitions (fade in/out) — these don't cause vestibular issues
- Color transitions — fine
- Subtle scale (≤ 5% change) — fine

**What gets disabled:**
- All translate-based animations (slide-in, slide-up)
- Spinners (replace with text "Loading…")
- Parallax, scroll-driven motion
- Auto-playing carousels

**The pattern:** wrap motion in a media query and provide a static alternative:

```tsx
const prefersReducedMotion = useReducedMotion()

<div className={prefersReducedMotion ? "" : "animate-slide-in"}>
  {content}
</div>
```

## Anti-patterns (the AI-motion ones)

These are the motion patterns that immediately signal AI-generated:

| ❌ Anti-pattern | ✅ Use instead |
|----------------|---------------|
| Bouncing/elastic everything | Smooth ease-out, no overshoot |
| 500ms+ for routine state changes | 150ms |
| Animating layout (width/height/padding) | Transform + opacity |
| Sequential typewriter text reveal | Just render the text |
| Hover scales > 1.05 | Hover background shift only |
| Wobbly button presses | scale(0.97) for 100ms, done |
| Marquee scrolling text in non-marketing UI | Truncate with ellipsis |
| Pulsing CTAs to "draw attention" | Better hierarchy, not motion |
| Spinning logos | Why? Just why? |
| Hero "shimmer" effects on every gradient | One shimmer, on one element, occasionally |
| Per-letter text animation in product UI | Reserve for marketing landing pages |

## The motion audit

Before shipping:

- [ ] Every animation answers one of the four "why" questions (where from / where to / what changed / what's happening)
- [ ] No animation is longer than 250ms unless it's the rare "dramatic" moment
- [ ] Animating only `transform` and `opacity` (no layout props)
- [ ] Easing is ease-out for entrances, ease-in for exits (never linear except for continuous)
- [ ] `prefers-reduced-motion: reduce` is respected — verified with the OS toggle
- [ ] No bounce, elastic, or overshoot curves anywhere
- [ ] Stagger capped at ~8 items
- [ ] No infinite/looping animation outside of loading states
- [ ] Hover states are color/background shifts, not transforms

If anything moves "to look cool" rather than to serve comprehension, cut it.
