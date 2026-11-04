# nqui InputGroup

> Input with prefix/suffix. Use InputGroupAddon + InputGroupText for addons, InputGroupInput for the control.

## Import

```tsx
import { InputGroup, InputGroupAddon, InputGroupText, InputGroupInput } from "@nqlib/nqui"
```

## Basic

Wrap addons in `InputGroupAddon` with `align` to control position. Use `InputGroupInput` (not `Input`) so borders and padding align correctly.

```tsx
<InputGroup>
  <InputGroupAddon align="inline-start">
    <InputGroupText>@</InputGroupText>
  </InputGroupAddon>
  <InputGroupInput placeholder="Username" />
</InputGroup>
<InputGroup>
  <InputGroupInput placeholder="Amount" />
  <InputGroupAddon align="inline-end">
    <InputGroupText>.00</InputGroupText>
  </InputGroupAddon>
</InputGroup>
```

Padding follows design system (px-3, py-1.5) for balanced addons and inputs.
