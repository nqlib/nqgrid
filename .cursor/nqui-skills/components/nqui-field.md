# nqui Field

> Form field layout. Label, description, error. FieldGroup, FieldSet, FieldLegend.

## Import

```tsx
import {
  Field, FieldLabel, FieldDescription, FieldError,
  FieldGroup, FieldSet, FieldLegend, FieldContent, FieldTitle, FieldSeparator
} from "@nqlib/nqui"
```

## Basic

```tsx
<Field>
  <FieldLabel>Email</FieldLabel>
  <FieldDescription>We'll never share it</FieldDescription>
  <Input id="email" />
  <FieldError>Invalid email</FieldError>
</Field>
```

## FieldGroup

```tsx
<FieldGroup>
  <Field>...</Field>
  <FieldSeparator />
  <Field>...</Field>
</FieldGroup>
```

## FieldSet

```tsx
<FieldSet>
  <FieldLegend>Section</FieldLegend>
  <FieldContent>...</FieldContent>
</FieldSet>
```
