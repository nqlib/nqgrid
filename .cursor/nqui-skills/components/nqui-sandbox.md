# nqui Sandbox

> Live code playground. SandboxProvider, SandboxLayout, SandboxCodeEditor, SandboxPreview. Peer: @codesandbox/sandpack-react.

## Import

```tsx
import {
  SandboxProvider, SandboxLayout, SandboxCodeEditor,
  SandboxPreview
} from "@nqlib/nqcode"
```

## Basic

```tsx
<SandboxProvider theme="dark" template="react" files={{ "/App.tsx": "..." }}>
  <SandboxLayout>
    <SandboxCodeEditor showTabs />
    <SandboxPreview />
  </SandboxLayout>
</SandboxProvider>
```

## Notes

- Peer: @codesandbox/sandpack-react. Heavy dependency.
