# nqui Calendar

> Date picker. Single, range, multiple. Touch drag, hover preview (enhanced).

## Import

```tsx
import { Calendar } from "@nqlib/nqui"
import type { DateRange } from "react-day-picker"
```

## Basic

```tsx
<Calendar mode="single" selected={date} onSelect={setDate} />
```

## Range

```tsx
<Calendar mode="range" selected={range} onSelect={setRange} />
```

## Multiple

```tsx
<Calendar mode="multiple" selected={dates} onSelect={setDates} />
```

## numberOfMonths

```tsx
<Calendar numberOfMonths={2} />
```

## Disabled

```tsx
<Calendar disabled={(d) => d < new Date()} />
```

## Notes

- Peer: `react-day-picker` v9+.
- Enhanced: touch drag selection, hover preview on drag.
- Footer slot for custom footer.
