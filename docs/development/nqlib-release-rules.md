# nqlib release rules

These are the version, branch and changelog rules for every nqlib repo. The same file is in
nqui, nqgrid, nqgantt, nqchart (`becocharts`) and nqui-showcase, at
`docs/development/nqlib-release-rules.md`. Change all five copies in one sitting.

A repo's own conventions add the mechanics, such as PRs, preflight and hooks. When a repo rule
and this page disagree on a version, a tag or a publish, this page wins. Fix the repo rule.

## The repos

| Library | Repo | npm package | Changelog | Checks before a push |
|---|---|---|---|---|
| nqui | `nqlib/nqui` | `@nqlib/nqui` | `CHANGELOG.md` | `pnpm lint`, `pnpm test`, `pnpm build:lib` |
| nqgrid | `nqlib/nqgrid` | `@nqlib/nqgrid` | `CHANGELOG.md` | `pnpm lint`, `pnpm test`, `pnpm build` |
| nqgantt | `nqlib/nqwm` | `@nqlib/nqgantt`, `@nqlib/nqgantt-engine` | `CHANGELOG.md` | `pnpm --filter @nqlib/nqgantt test`, `pnpm build` |
| nqchart | `nqlib/nqchart` (`becocharts`) | `@nqlib/nqchart` | `src/content/docs/changelog.mdx` | `pnpm preflight`. Changes reach `dev` by PR only. See its `CLAUDE.md`. |
| nqui-showcase | `nqlib/nqui-showcase` | not published | Each library's page in `content/docs/<lib>/changelog.mdx` | `pnpm typecheck`, `pnpm build` |

## 1. Check the published version first

Before any work on a version, a changelog, a release or a dependency bump, run:

```bash
npm view <package> version
git fetch --tags origin && git tag --sort=-creatordate | head -3
```

Compare the result with `version` in `package.json` on `dev` and with the top changelog heading.
Report these mismatches to the developer before you go on:

- A tag with no publish.
- A publish with no tag.
- A `dev` version that is lower than the version on npm.

Never state a version from memory.

## 2. `dev` holds the latest code

- Work collects on `dev`. `main` is the latest npm release and nothing else. A `vX.Y.Z` tag on
  `main` marks each published version.
- Cut a branch from `origin/dev`.
- Before you start, run `git fetch` and fast-forward the local `dev`.
- Finished work reaches `origin/dev` the same day: push it, or open a PR where the repo needs
  one (nqchart).
- When you finish, the local `dev` must equal `origin/dev`.
- A stash is not storage. Commit work in progress on a branch and push it.
- Never force-push `dev` or `main`.
- Never move a branch, check out or stash in a worktree that another session is using.
  `git worktree list` shows the worktrees.

## 3. The next version lives on `dev`

- `package.json` on `dev` carries the **next** version, not the published one.
- The top changelog section is `## [X.Y.Z] - Unreleased`. Each change adds its entry to that
  section, in the same commit.
- The first change after a release runs the questionnaire (§ 5). It sets the next version.
- A later change may need a bigger bump than the planned one, for example a breaking change
  after a minor was planned. Run the questionnaire again, then change `package.json` and the
  heading together.
- A docs-only or site-only change does not change the version.

## 4. Major, minor and patch

| Change | From 1.0 | While `0.x` |
|---|---|---|
| **Breaking.** A consumer must change their code or will see a different result. Examples: an export, prop, type, entry, CSS variable or `data-*` hook is removed or renamed; a default that a host can see changes (a look, a behaviour, a validation that now rejects input); a peer dependency's major version rises. | major | minor, with a **Breaking** section |
| **Additive.** A new export, prop, option, entry, component or token. Old code works unchanged. | minor | minor |
| **Fix.** A bug fix, a performance change, docs, or an internal refactor. No API change and no default change. | patch | patch |

- The biggest change since the last publish sets the bump.
- In `0.x`, a breaking change is never a patch.
- Only the developer decides to go to `1.0.0`. It never happens as a side effect of other work.

## 5. The version questionnaire

Ask the developer with `AskUserQuestion` before you do any of these:

- set the next version;
- change the next version;
- tag a release;
- publish.

Do not decide alone. The developer, or the designer who owns the library, must agree.

| # | Question | What to show |
|---|---|---|
| 0 | At a release only: for each branch, worktree or stash with work that is not on `dev`, does it go in this release, wait, or get dropped? | The list from § 7 step 1: each item's last commit, its date, its diff size against `dev`, and whether a PR is open. Put "goes in" first when the work is finished. |
| 1 | Is the bump a patch, a minor or a major? | The changes since the last tag, sorted as breaking, additive and fix. Read them from the changelog and from `git diff vX.Y.Z..dev` on the library source. Put the recommended option first. |
| 2 | Is this the right version number (for example `0.4.0`)? | The current npm version (§ 1). |
| 3 | Is the changelog section complete? | Its headings and its Breaking entries. |
| 4 | At a release only: tag and publish now, or keep collecting? | The checks and their results. |

Write the answers into `package.json` and the changelog heading. A tag or a publish needs a yes
in this session. A yes from an earlier session does not carry over.

## 6. The changelog

- Use the sections of [Keep a Changelog](https://keepachangelog.com/): **Breaking**, Added,
  Changed, Deprecated, Removed, Fixed, Security. The Breaking section is first, when it has
  entries.
- Each entry names the API, says what changed, and says what a consumer does. A Breaking entry
  says how to upgrade.
- The showcase mirrors each library's changelog in `content/docs/<lib>/changelog.mdx`. Update the
  mirror when the library publishes.

## 7. Release

Do the steps in this order:

1. Find the work that is not on `dev`. List every local and remote branch, every worktree
   (`git worktree list`) and every stash. A squash-merged branch still shows commits that `dev`
   lacks, so compare content: `git merge-tree --write-tree origin/dev <branch>` prints the tree
   of `origin/dev` when the branch adds nothing. Check each stash the same way. Every item that
   adds something goes into question 0. Never leave one out because another session made it or
   because it sits in another worktree. Ask; do not decide.
2. Run the questionnaire (§ 5). Start with question 0 for each item from step 1.
3. Run the checks of the repo, with every check on.
4. Set the date on the changelog heading.
5. Merge `dev` into `main` with a merge commit. Never squash into `main`.
6. Tag the merge commit `vX.Y.Z`, then push the tag.
7. The owner publishes. An agent runs `npm publish` only after the developer says so in this
   session.
8. Run `npm view <package> version` to confirm the publish.
9. In nqui-showcase, bump the dependency (`pnpm update <package>`, then
   `pnpm lockfile:check`) and update the changelog mirror.
