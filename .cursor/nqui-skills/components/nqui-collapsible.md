# nqui Collapsible

> Toggle content visibility. CollapsibleTrigger, CollapsibleContent.

## Import

```tsx
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@nqlib/nqui"
```

## Basic

```tsx
<Collapsible open={open} onOpenChange={setOpen}>
  <CollapsibleTrigger asChild><Button>Toggle</Button></CollapsibleTrigger>
  <CollapsibleContent>Content</CollapsibleContent>
</Collapsible>
```
