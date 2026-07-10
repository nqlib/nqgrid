# nqui CodeBlock

> Syntax-highlighted code. Multi-file tabs, copy button. From `@nqlib/nqcode`.

## Import

```tsx
import {
  CodeBlock, CodeBlockHeader, CodeBlockFiles, CodeBlockFilename,
  CodeBlockCopyButton, CodeBlockBody, CodeBlockItem, CodeBlockContent
} from "@nqlib/nqcode"
```

Requires: `@nqlib/nqui`, `shiki`, `@shikijs/transformers`

## Basic

```tsx
<CodeBlock defaultValue="ts" data={[{ language: "ts", filename: "x.ts", code: "..." }]}>
  <CodeBlockHeader>
    <CodeBlockFiles>
      {(item) => <CodeBlockFilename value={item.language}>{item.filename}</CodeBlockFilename>}
    </CodeBlockFiles>
    <CodeBlockCopyButton />
  </CodeBlockHeader>
  <CodeBlockBody>
    {(item) => (
      <CodeBlockItem value={item.language}>
        <CodeBlockContent language={item.language} syntaxHighlighting>
          {item.code}
        </CodeBlockContent>
      </CodeBlockItem>
    )}
  </CodeBlockBody>
</CodeBlock>
```

## Notes

- Peer: shiki, @shikijs/transformers for syntax highlighting.
- CodeBlockContentServer (async/RSC): `import { CodeBlockContentServer } from "@nqlib/nqcode/server"`
