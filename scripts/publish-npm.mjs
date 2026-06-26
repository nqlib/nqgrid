#!/usr/bin/env node
/**
 * Publish @nqlib/nqgrid to the public npm registry.
 *
 * Usage (from repo root):
 *   pnpm publish:npm
 *   pnpm publish:npm -- --otp=123456
 *   NPM_OTP=123456 pnpm publish:npm
 */
import { readFileSync } from "node:fs"
import { spawnSync, execSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const registry = "https://registry.npmjs.com"

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const otpArg = process.argv.find((a) => a.startsWith("--otp="))
const otp = process.env.NPM_OTP ?? otpArg?.slice("--otp=".length)

function run(command, args, cwd = root) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

function whoami() {
  try {
    return execSync(`npm whoami --registry=${registry}`, {
      encoding: "utf8",
      cwd: root,
    }).trim()
  } catch {
    return null
  }
}

function isPublished(name, version) {
  try {
    const v = execSync(`npm view ${name}@${version} version --registry=${registry}`, {
      encoding: "utf8",
      cwd: root,
    }).trim()
    return v === version
  } catch {
    return false
  }
}

console.log(`publish:npm — @nqlib/nqgrid@${pkg.version}\n`)

const user = whoami()
if (!user) {
  console.error("publish:npm — not logged in to npm.\n")
  console.error("Run web login, complete it in the browser, then retry:\n")
  console.error(`  make login`)
  console.error(`  npm login --auth-type=web --registry=${registry}\n`)
  process.exit(1)
}
console.log(`publish:npm — logged in as ${user}`)

if (isPublished(pkg.name, pkg.version)) {
  console.error(
    `publish:npm — ${pkg.name}@${pkg.version} is already on npm. Bump version in package.json first.`,
  )
  process.exit(1)
}

const publishArgs = ["publish", "--access", "public", `--registry=${registry}`]
if (otp) publishArgs.push(`--otp=${otp}`)

console.log("publish:npm — running npm publish (prepublishOnly runs verify:publish)…\n")
run("npm", publishArgs, root)

const published = execSync(`npm view ${pkg.name} version --registry=${registry}`, {
  encoding: "utf8",
  cwd: root,
}).trim()
console.log(`\npublish:npm — OK — ${pkg.name}@${published} on npm`)
