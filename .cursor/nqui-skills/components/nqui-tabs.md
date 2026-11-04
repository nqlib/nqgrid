# nqui Tabs

> Tabbed content. Sliding indicator. Enhanced.

## Import

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@nqlib/nqui"
```

For **pill tabs inside a scrollable page** (project cards, portfolio detail, guide pages):

```tsx
import {
  Tabs,
  TabsContent,
  InlineTabsList,
  InlineTabsTrigger,
  inlineTabsPanelsClass,
} from "@nqlib/nqui"
```

## Basic

```tsx
<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content 1</TabsContent>
  <TabsContent value="tab2">Content 2</TabsContent>
</Tabs>
```

## Controlled

```tsx
<Tabs value={value} onValueChange={setValue}>
  ...
</Tabs>
```

## Inline tabs in scrollable pages

When tabs live inside a **page-level** scroller (`h-full overflow-y-auto`, expanded cards, guide pages), use **InlineTabs** — not raw `TabsList` / `TabsTrigger`. Radix focus-on-click scrolls the page; short panels shrink layout and clamp scroll.

| Piece | Purpose |
|-------|---------|
| `InlineTabsList` | Pill bar; `overflow-x-auto overflow-y-hidden` |
| `InlineTabsTrigger` | Preserves page scroll + tab-bar viewport anchor |
| `inlineTabsPanelsClass` | `min-h-[28rem]` around all `TabsContent` when heights differ |

```tsx
<Tabs defaultValue="fields" className="w-full">
  <InlineTabsList className="m-3 mb-0">
    <InlineTabsTrigger value="fields">Fields</InlineTabsTrigger>
    <InlineTabsTrigger value="history">History</InlineTabsTrigger>
  </InlineTabsList>
  <div className={inlineTabsPanelsClass}>
    <TabsContent value="fields" className="m-0 p-4">…</TabsContent>
    <TabsContent value="history" className="m-0 p-4">…</TabsContent>
  </div>
</Tabs>
```

**Use InlineTabs when:** an ancestor has page-level `overflow-y-auto`.  
**Use plain Tabs when:** only the tab body scrolls (e.g. `flex-1 overflow-y-auto` under a fixed tab bar).

Do not reimplement scroll preservation in app code — use these exports from `@nqlib/nqui`.

## Notes

- **Sliding indicator:** Handled on `TabsList` (position relative).
- **Responsive:** `InlineTabsList` scrolls horizontally when labels overflow.
- **Resize:** Indicator recalculates on window resize (built-in).
