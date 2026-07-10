# nqui TableOfContents

> TOC from headings. Auto-detect or manual items. Scroll spy.

## Import

```tsx
import { TableOfContents } from "@nqlib/nqui"
```

## Auto-detect

```tsx
<TableOfContents
  autoDetect
  headingSelector="h2"
  enableScrollSpy
  container={contentRef}
  title="Contents"
/>
```

## Manual Items

```tsx
<TableOfContents
  items={[{ id: "s1", label: "Section 1", level: 1 }]}
  enableScrollSpy
  variant="normal"
/>
```

## Notes

- Headings need `id` for anchor links.
- container: scoped scroll container. Omit for full page.
- variant: "normal" | "clerk" | "circuit".
