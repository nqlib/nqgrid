# nqui Snippet

> Tabbed code display. SnippetHeader, SnippetTabsList, SnippetTabsTrigger, SnippetTabsContent, SnippetCopyButton.

## Import

```tsx
import {
  Snippet, SnippetHeader, SnippetTabsList, SnippetTabsTrigger,
  SnippetTabsContent, SnippetCopyButton
} from "@nqlib/nqcode"
```

## Basic

```tsx
<Snippet defaultValue="tsx">
  <SnippetHeader>
    <SnippetTabsList>
      <SnippetTabsTrigger value="tsx">TSX</SnippetTabsTrigger>
      <SnippetTabsTrigger value="jsx">JSX</SnippetTabsTrigger>
    </SnippetTabsList>
    <SnippetCopyButton value={code} />
  </SnippetHeader>
  <SnippetTabsContent value="tsx">{code}</SnippetTabsContent>
  <SnippetTabsContent value="jsx">{code}</SnippetTabsContent>
</Snippet>
```
