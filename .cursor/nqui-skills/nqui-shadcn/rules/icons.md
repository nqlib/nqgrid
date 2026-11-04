# Icons

nqui uses Hugeicons as its icon library. This document covers how to use icons correctly in nqui components.

**Always use Hugeicons** for icons in nqui components. Import from `@hugeicons/react` or `@hugeicons/core-free-icons`.

---

## Icons in Button use data-icon attribute

Add `data-icon="inline-start"` (prefix) or `data-icon="inline-end"` (suffix) to the icon. No sizing classes on the icon.

**Incorrect:**

```tsx
<Button>
  <SearchIcon className="mr-2 size-4" />
  Search
</Button>
```

**Correct:**

```tsx
import { SearchIcon } from "@hugeicons/react"

<Button>
  <SearchIcon data-icon="inline-start" />
  Search
</Button>

<Button>
  Next
  <ArrowRightIcon data-icon="inline-end"/>
</Button>
```

---

## No sizing classes on icons inside components

Components handle icon sizing via CSS. Don't add `size-4`, `w-4 h-4`, or other sizing classes to icons inside `Button`, `DropdownMenuItem`, `Alert`, `Sidebar*`, or other nqui components. Unless the user explicitly asks for custom icon sizes.

**Incorrect:**

```tsx
<Button>
  <SearchIcon className="size-4" data-icon="inline-start" />
  Search
</Button>

<DropdownMenuItem>
  <SettingsIcon className="mr-2 size-4" />
  Settings
</DropdownMenuItem>
```

**Correct:**

```tsx
<Button>
  <SearchIcon data-icon="inline-start" />
  Search
</Button>

<DropdownMenuItem>
  <SettingsIcon />
  Settings
</DropdownMenuItem>
```

---

## Importing Hugeicons

### Using @hugeicons/react (recommended for React)

```tsx
import { SearchIcon, SettingsIcon, ArrowRightIcon } from "@hugeicons/react"
```

### Using @hugeicons/core-free-icons

For tree-shaking individual icons:

```tsx
import { SearchIcon } from "@hugeicons/core-free-icons"
```

---

## Icon Usage Patterns

### Icon with label

```tsx
<Button>
  <SettingsIcon data-icon="inline-start" />
  Settings
</Button>
```

### Icon only button

```tsx
<Button size="icon">
  <SearchIcon />
</Button>
```

### Icon in menu items

```tsx
<DropdownMenuItem>
  <SettingsIcon />
  Settings
</DropdownMenuItem>

<DropdownMenuItem>
  <UserIcon />
  Profile
</DropdownMenuItem>
```

### Icon in form controls

```tsx
<InputGroup>
  <InputGroupAddon>
    <SearchIcon />
  </InputGroupAddon>
  <InputGroupInput placeholder="Search..." />
</InputGroup>
```

---

## Migrating from other icon libraries

If you have existing code using other icon libraries (e.g., lucide-react), replace imports:

```tsx
// Before (lucide-react)
import { Search, Settings } from "lucide-react"

// After (Hugeicons)
import { SearchIcon, SettingsIcon } from "@hugeicons/react"
```

Then add the `data-icon` attribute to icons used in buttons:

```tsx
// Before
<Button><Search /> Search</Button>

// After
<Button><SearchIcon data-icon="inline-start" /> Search</Button>
```
