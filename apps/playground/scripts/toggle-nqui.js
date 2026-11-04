#!/usr/bin/env node
/**
 * Toggle between local (npm link) and published @nqlib/nqui for nqgrid-playground.
 * Vite can also use USE_LOCAL_NQUI=true + NQUI_DIR without linking (see vite.config.ts).
 */
import { readFileSync, writeFileSync, existsSync, lstatSync, realpathSync } from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "..");
const packageJsonPath = join(root, "package.json");
const nodeModulesNqui = join(root, "node_modules", "@nqlib", "nqui");

const PROJECT_NAME = "nqgrid-playground";
const PUBLISHED_VERSION = "^0.6.2";
const USE_LEGACY_PEER_DEPS = false;

const nquiBaseDir = process.env.NQUI_DIR || resolve(root, "../../../../nqui");

const monorepoNquiDir = join(nquiBaseDir, "packages", "nqui");
const nquiDir = existsSync(join(monorepoNquiDir, "package.json"))
  ? monorepoNquiDir
  : nquiBaseDir;

const useLocal = process.env.USE_LOCAL_NQUI === "true";
const skipBuild = process.env.SKIP_BUILD === "true";
const checkOnly = process.argv.includes("--check") || process.argv.includes("--status");

function isSymlink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

function checkStatus() {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
  const isLinked = existsSync(nodeModulesNqui) && isSymlink(nodeModulesNqui);

  let version = "unknown";
  let source = "unknown";

  if (isLinked) {
    try {
      const resolvedPath = realpathSync(nodeModulesNqui);
      if (resolvedPath.includes(nquiDir) || resolvedPath.includes("nqui")) {
        source = "LOCAL (linked)";
        try {
          const nquiPackageJson = JSON.parse(readFileSync(join(nquiDir, "package.json"), "utf-8"));
          version = nquiPackageJson.version;
        } catch {
          version = "unknown";
        }
      } else {
        source = `LINKED (${resolvedPath})`;
        try {
          const linkedPackageJson = JSON.parse(readFileSync(join(resolvedPath, "package.json"), "utf-8"));
          version = linkedPackageJson.version;
        } catch {
          version = "unknown";
        }
      }
    } catch {
      source = "LOCAL (linked)";
    }
  } else if (existsSync(nodeModulesNqui)) {
    source = "PUBLISHED (npm package)";
    try {
      const installedPackageJson = JSON.parse(readFileSync(join(nodeModulesNqui, "package.json"), "utf-8"));
      version = installedPackageJson.version;
    } catch {
      version = packageJson.dependencies["@nqlib/nqui"] || "unknown";
    }
  } else {
    source = "NOT INSTALLED";
  }

  const viteLocal = process.env.USE_LOCAL_NQUI === "true";
  if (viteLocal && !isLinked) {
    source = existsSync(join(nquiDir, "dist"))
      ? "LOCAL (vite alias → dist)"
      : "LOCAL (vite alias — build nqui dist first)";
  }

  return { isLinked, version, source, packageVersion: packageJson.dependencies["@nqlib/nqui"] };
}

if (checkOnly) {
  const status = checkStatus();
  console.log("\nnqui Status (" + PROJECT_NAME + "):");
  console.log("   Source:", status.source);
  console.log("   Version:", status.version);
  console.log("   package.json:", status.packageVersion);
  console.log("   Symlink:", status.isLinked ? "Yes" : "No");
  console.log("   NQUI_DIR:", nquiBaseDir);
  console.log("   nqui package:", nquiDir);
  console.log("   Location:", existsSync(nodeModulesNqui) ? nodeModulesNqui : "Not found", "\n");
  process.exit(0);
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

console.log("\nToggling nqui source...");
console.log("   NQUI_DIR (repo root):", nquiBaseDir);
console.log("   nqui package:", nquiDir);
console.log("   USE_LOCAL_NQUI:", useLocal);
console.log("   SKIP_BUILD:", skipBuild, "\n");

if (useLocal) {
  if (!existsSync(nquiDir)) {
    console.error("Error: nqui directory not found at", nquiDir);
    console.error("   Set NQUI_DIR to the nqui repository root.");
    process.exit(1);
  }

  const nquiPackageJsonPath = join(nquiDir, "package.json");
  if (!existsSync(nquiPackageJsonPath)) {
    console.error("Error: package.json not found in", nquiDir);
    process.exit(1);
  }

  const currentStatus = checkStatus();
  const alreadyLinked = currentStatus.isLinked && currentStatus.source.includes("LOCAL");

  if (skipBuild && alreadyLinked) {
    console.log("Skipping build (SKIP_BUILD=true and already linked)\n");
  } else {
    console.log("Building nqui library...");
    try {
      execSync("npm run build:lib", { cwd: nquiDir, stdio: "inherit" });
      console.log("nqui library built successfully\n");
    } catch {
      console.error("Failed to build nqui library");
      process.exit(1);
    }
  }

  console.log("Linking nqui library globally...");
  try {
    execSync("npm link", { cwd: nquiDir, stdio: "inherit" });
  } catch {
    console.error("Failed to link nqui globally");
    process.exit(1);
  }

  const nquiPackageJson = JSON.parse(readFileSync(nquiPackageJsonPath, "utf-8"));
  packageJson.dependencies["@nqlib/nqui"] = `^${nquiPackageJson.version}`;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

  console.log("Linking @nqlib/nqui in " + PROJECT_NAME + "...");
  try {
    try {
      execSync("npm unlink @nqlib/nqui", { cwd: root, stdio: "pipe" });
    } catch {}
    const linkEnv = USE_LEGACY_PEER_DEPS ? { ...process.env, NPM_CONFIG_LEGACY_PEER_DEPS: "true" } : process.env;
    execSync("npm link @nqlib/nqui", { cwd: root, stdio: "inherit", env: linkEnv });
  } catch {
    console.error("Failed to link @nqlib/nqui — try: USE_LOCAL_NQUI=true pnpm dev (vite dist alias)");
    process.exit(1);
  }

  console.log("Successfully switched to LOCAL nqui\n");
} else {
  try {
    execSync("npm unlink @nqlib/nqui", { cwd: root, stdio: "pipe" });
  } catch {}

  packageJson.dependencies["@nqlib/nqui"] = PUBLISHED_VERSION;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");

  console.log("Installing published @nqlib/nqui (" + PUBLISHED_VERSION + ")...");
  try {
    execSync("pnpm install", { cwd: resolve(root, "../.."), stdio: "inherit" });
  } catch {
    console.error("Run pnpm install from the nqgrid repo root.");
    process.exit(1);
  }

  console.log("Successfully switched to PUBLISHED nqui\n");
}
