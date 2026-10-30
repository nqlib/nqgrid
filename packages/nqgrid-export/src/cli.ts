#!/usr/bin/env node
import { main } from "./main";

main(process.argv.slice(2), { stdin: process.stdin, stdout: process.stdout, stderr: process.stderr }).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`${JSON.stringify({ error: { code: "internal", message: String(error) } })}\n`);
    process.exitCode = 1;
  },
);
