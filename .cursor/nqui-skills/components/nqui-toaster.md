# nqui Toaster

> Toast notifications via **Sonner**. Default toast is **pill-shaped**; default **normal** toast uses **inverted** surface (dark fill in light theme, light fill in dark theme) using `--foreground` / `--background`. Implemented in **`packages/nqui/src/components/ui/sonner.tsx`** (`Toaster`). Compatibility aliases: `EnhancedSonner`, `CoreToaster` → same component.

## Import

```tsx
import { Toaster, toast } from "@nqlib/nqui"
```

## Setup

```tsx
// Add once (e.g. layout)
<Toaster />
```

## Types

```tsx
toast.success("Saved")
toast.error("Failed")
toast.warning("Warning")
toast.info("Info")
toast("Default")
toast.loading("Loading...")
```

## Promise

```tsx
toast.promise(fetchData(), {
  loading: "Loading...",
  success: "Done",
  error: "Failed"
})
```

## Options

```tsx
toast.success("Msg", { duration: 5000 })
// Toaster: position, richColors, etc.
```

## Notes

- **Subpath import:** `@nqlib/nqui/sonner` re-exports the same `Toaster`.
