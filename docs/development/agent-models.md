# Subagents and models

This page tells a coding agent how to run work in an nqlib repo. The main session plans the
work and checks the result. Subagents do the work, each on the model that fits its slice. The
same file is in nqui, nqgrid, nqgantt, nqchart (`becocharts`) and nqui-showcase, at
`docs/development/agent-models.md`. Change all five copies in one sitting.

This rule is adapted from SecoLab (`docs/development/agent-models.md`). Its source is the Claude
blog post "Which Claude model should you build with?". When a new model ships, update the tables
in all five copies.

## Models

| Alias | Model | Price per 1M tokens, in / out | When to use it, from the source |
|---|---|---|---|
| `haiku` | Claude Haiku 5.5 | $0.10 / $0.50 | Lowest cost and latency. Work where a mistake is cheap to spot. |
| `sonnet` | Claude Sonnet 5.5 | $2 / $10 | Well-scoped tasks: a bug fix, the next round of a feature, repeated agent tasks. |
| `opus` | Claude Opus 5.5 | $4 / $20 | The default for complex coding: everyday engineering and features that span several PRs. |
| `fable` | Claude Fable 5.2 | $8 / $40 | Major refactors and migrations, architecture plans, long unattended runs. |

## The rule

| # | Rule |
|---|---|
| 1 | The main session runs the work. It splits the work, writes the briefs, reviews the results and runs the checks. |
| 2 | A subagent does every slice, edits included. The main session does not write the code of a slice. |
| 3 | Give each slice one model. Pass the alias in the `model` field of the `Agent` tool. |
| 4 | Keep a chain of steps that each need the step before as one slice. Do not split it. |
| 5 | Exempt: a change of a few lines in one known file, or one lookup in a known file. The main session does it. |
| 6 | The main session does version and release work itself, with the questionnaire in `nqlib-release-rules.md`. |

## Routing table

| Slice | Agent type | Model | Reason |
|---|---|---|---|
| Find code, files, callers or usages; a wide sweep | `Explore` | `haiku` | A wrong answer is cheap to spot. |
| Run tests, read logs or CI output, report the failures | `general-purpose` | `haiku` | A wrong answer is cheap to spot. |
| A mechanical change: rename, move, reformat, regenerate a snapshot or a golden, sync skill copies | `general-purpose` | `haiku` | The diff and the lint show a mistake. |
| A scoped fix: a known cause, one area, an existing pattern | `general-purpose` | `sonnet` | Well-scoped work. |
| Docs, a changelog entry, a guide page, a story or a plan | `general-purpose` | `sonnet` | Well-scoped work. |
| Research across the code and the docs, in several steps | `general-purpose` | `sonnet` | Reading with some judgment. |
| A feature slice: a component, an engine feature, a chart family, a showcase page | `general-purpose` | `opus` | Everyday engineering. A clear spec alone is not a reason to use `sonnet`. |
| A bug with an unknown cause, or a performance problem | `general-purpose` | `opus` | Judgment. |
| A change to the public API, the package exports, the build or the published CSS | `general-purpose` | `opus` | A mistake ships to every consumer and is hard to undo. |
| A change across a library and the showcase | `general-purpose` | `opus` | Judgment across repos. |
| Design a feature, a plan or a visual direction | `Plan` | `opus` | Judgment. |
| Review or QA of a diff | `general-purpose` | `opus` | Judgment. |
| A major refactor or migration across many areas, or a slice that failed on `opus` at `high` | `general-purpose` | `fable` | Ask the developer first. It costs twice as much as `opus`. |

## When a slice fails

Do these steps in order. Stop at the first step that works.

1. Add a check to the brief: a test, a build or a script that proves the result.
2. Start the slice again with `effort` one level higher.
3. Start the slice on the next model up, with `effort` one level lower than the last run.

## Split the task into slices

| Rule | Detail |
|---|---|
| Split by layer | The engine or library, the showcase, and the docs are separate slices. |
| One owner for each file | Two subagents must not edit the same file. For parallel slices that are close together, pass `isolation: "worktree"`. |
| Run independent slices in parallel | Send them in one message. Start a slice that depends on another after that slice is done. |
| Ask before editing another repo | A slice in a sibling repo needs the developer's yes. |

The usual order for a feature:

| Step | Slice | Runs on |
|---|---|---|
| 1 | Find the code that the task touches | `Explore`, `haiku` |
| 2 | Write the plan | The main session, or `Plan` on `opus` |
| 3 | The library change, with its tests | `opus` |
| 4 | The showcase demo or docs page that uses it | `opus` for UI, `sonnet` for docs |
| 5 | The changelog entry and the skill copies | `sonnet` |
| 6 | Review the diff with no earlier context | `opus` |
| 7 | The repo's checks, then the commit | The main session |

## Write the brief

The brief is all the context the subagent has. Each brief names:

- The goal, and the acceptance criteria of the slice.
- The files to read first, and the files the slice may edit.
- The files and areas the slice must not touch.
- The checks to run before it reports, for example `pnpm test` or `pnpm lint`.
- What to report, as one table: `File or check | Status | Reason`. List the open questions under
  the table. Ask for no summary in prose.

Tell the subagent not to commit and not to push.

## Check the result

- Read the diff of each slice. A subagent's report does not prove that the work is correct.
- Give the review subagent the diff and the brief. Do not give it your conclusion.
- Run the checks again in the main session before the commit.

## Frontend

Ask the developer once in each session: "Do you use Cursor?" Do not guess.

| The developer uses Cursor | Do this |
|---|---|
| Yes | Recommend Cursor for the UI slice. Cursor loads `.cursor/` skills and rules. Write the slice as a work order. Do not edit the same files in this session while Cursor works on them. Review the Cursor diff on `opus` when the developer asks. |
| No | A subagent does the slice. Give it the repo's UI skill reads, such as the nqui skills and `impeccable`. |
