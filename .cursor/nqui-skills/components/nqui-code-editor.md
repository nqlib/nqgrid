# nqui CodeEditor

> Animated code editor. Client-side only.

## Import

```tsx
import { CodeEditor } from "@nqlib/nqcode"
```

## Basic

```tsx
<CodeEditor lang="typescript" header dots title="file.ts" copyButton>
  {`const x = 1`}
</CodeEditor>
```

## Notes

- Client-only. Use dynamic import with ssr: false in Next.js.
