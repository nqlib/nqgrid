# nqui ButtonGroup

> **Related actions** side-by-side. Each item triggers an action. Not for selection.

## When to Use

- **Actions** (not selection) – each click does something
- **Related** – Undo/Redo, align left/center/right (as actions)
- **Layout:** Inline, shared border

**Choose ButtonGroup when:** User triggers actions (Undo, Redo, Copy). Each button performs a command. Not for picking a mode or state.

**Use ToggleGroup instead** when user is *selecting* a value (mode, scale, alignment as state). ButtonGroup = actions. ToggleGroup = selection.

**Examples:** Undo | Redo, Left | Center | Right (when each applies an action), Export | Print.

## Import

```tsx
import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from "@nqlib/nqui"
```

## Basic

```tsx
<ButtonGroup>
  <Button variant="outline">Left</Button>
  <ButtonGroupSeparator />
  <Button variant="outline">Middle</Button>
  <ButtonGroupSeparator />
  <Button variant="outline">Right</Button>
</ButtonGroup>
```

## With text (non-button)

```tsx
<ButtonGroup>
  <Button variant="outline"><HomeIcon /></Button>
  <ButtonGroupSeparator />
  <ButtonGroupText>Text</ButtonGroupText>
  <ButtonGroupSeparator />
  <Button variant="outline"><SettingsIcon /></Button>
</ButtonGroup>
```

## Notes

- Uses Button children. Shared border, separators with fade.
- `ButtonGroupText` for non-clickable label between buttons.
