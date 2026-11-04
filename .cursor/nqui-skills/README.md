# nqui skills (package copy)

These files mirror the **nqui** Cursor skills. They live in the `@nqlib/nqui` package so the library stays documented when split into its own repository.


| Skill                                                                         | Path                                                                                   |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Hub (start here)                                                              | [SKILL.md](./SKILL.md)                                                                 |
| **Composition (product UI, recipes vs catalog)**                              | [COMPOSITION.md](./COMPOSITION.md)                                                     |
| **Task → components (designers)**                                             | [HUMAN_GUIDE.md](./HUMAN_GUIDE.md)                                                     |
| **Component doc routing (agents; read first; saves tokens)**                  | [COMPONENTS_INDEX.md](./COMPONENTS_INDEX.md)                                           |
| Per-component markdown (copied by `init-skills` to `.cursor/.../components/`) | `docs/components/` in repo; `components/` under this folder after init                 |
| Components & layouts                                                          | [nqui-components/SKILL.md](./nqui-components/SKILL.md)                                 |
| Data tables + ScrollArea (dashboard grids)                                    | [nqui-data-tables/SKILL.md](./nqui-data-tables/SKILL.md)                               |
| Design system (sizing, Card + ScrollArea)                                     | [nqui-design-system/SKILL.md](./nqui-design-system/SKILL.md)                           |
| shadcn-style usage rules                                                      | [nqui-shadcn/SKILL.md](./nqui-shadcn/SKILL.md)                                         |
| Bundle size & peers                                                           | [nqui-bundle-size-best-practices/SKILL.md](./nqui-bundle-size-best-practices/SKILL.md) |
| Local vs published npm                                                        | [nqui-local-published-toggle/SKILL.md](./nqui-local-published-toggle/SKILL.md)         |
| Install & setup commands                                                      | [nqui-install/SKILL.md](./nqui-install/SKILL.md)                                       |


**Consumers:** run `npx @nqlib/nqui init-skills` (or `init-cursor`) to copy this folder to `.cursor/nqui-skills/` and to copy `**docs/components`** into `**.cursor/nqui-skills/components/**` (same content as in `node_modules/@nqlib/nqui/docs/components/`).

**Path note:** In this repo, paths are relative to the **nqui package root** (`docs/…`, `src/…`). In a monorepo, prefix with `packages/nqui/` where needed.