# nqui Input

> Text input. Core component.

## Import

```tsx
import { Input } from "@nqlib/nqui"
```

## Basic

```tsx
<Input placeholder="Email" type="email" />
<Input type="password" disabled />
```

## With Label

```tsx
<div>
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" />
</div>
```
