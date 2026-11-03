# Pivot performance

`buildPivotModel` benchmarks before and after the filters / Top N / sort-by-value work (Excel parity, step 1), plus the
field-list move scenarios of step 2 ([below](#step-2-field-list-moves-excel-parity-step-2)).
The harness is `bench/pivot.bench.ts` (`pnpm bench`, i.e. `vitest bench --run --dir bench`).

## Setup

- **Data** (`bench/dataset.ts`, deterministic LCG): leaf rows with `region` (6) → `department` (8) → `line`
  (6 per department, 48 keys) × `month` (12 keys), plus 3 numeric fields. That is 288 leaves, 343 tree nodes and
  random record order (no sorted-input shortcut).
- **Base spec**: 3 row dimensions, a 12-key column dimension, 3 value measures (sum, sum, avg) plus row totals
  (37 value columns), a ratio KPI measure, heat (`scope: "group"`), header bars with breakdown, KPIs on 2 levels,
  `expanded: "all"`, so every one of the 343 rows is formatted.
- **Filtered spec**: base plus 3 report filters (`region` exclude, `department` include 6 of 8,
  `month` label filter `notEquals`), facets on 4 fields, Top 5 lines per department with an "Other" row,
  and departments sorted by value.
- **Machine**: Intel Xeon @ 2.80 GHz (4 vCPU, shared cloud VM), Node 22.22.0, Vitest 3.2.4 bench (tinybench).
  Means in ms; 10k and 100k use ≥ 10 samples, 500k uses 5 samples. Expect ±10–25 % run-to-run noise on this VM.

## Results (mean ms)

| Scenario | 10k before | 10k after | 100k before | 100k after | 500k before | 500k after |
|---|---:|---:|---:|---:|---:|---:|
| Base spec, cold `buildPivotModel` | 40.4 | 19.5 | 238.4 | 47.6 | 1796.0 | 177.7 |
| 3 filters, cold. Before: `rows.filter` + build. After: `spec.filters` | 20.4 | 12.9 | 134.5 | 46.9 | 900.3 | 179.4 |
| Filters + label filter + 4 facets + Top 5 (Other) + sortBy, cold | n/a | 14.1 | n/a | 58.2 | n/a | 205.4 |
| View-only change (expand / collapse / heat scope). Before: full rebuild. After: `createPivotModelBuilder`, cube reused | 34.4 | 2.8 | 231.6 | 2.5 | 1534.4 | 3.5 |
| Filter change (slicer click). Before: `rows.filter` + build. After: builder, encoding reused | 20.4 | 2.3 | 134.5 | 8.5 | 900.3 | 36.5 |

"Before" is HEAD `0d42569`, run from a separate worktree with the same dataset (`bench/baseline.bench.ts` was a
temporary file there and is not committed). An earlier in-tree run of the base spec at HEAD gave
36.3 / 230.7 / 1572.3 ms. The "before" filter rows are what a consumer had to do at HEAD: pre-filter the records and
rebuild, with no facets, Top N or sort by value. The facet / Top N row has no "before" because HEAD could not do it.

**Summary at 500k records:** a cold build is about 10× faster. Expanding a group or changing heat scope in
`usePivotGrid` drops from about 1.5 s to about 3.5 ms, because it no longer re-aggregates. A slicer click drops
from about 0.9 s to about 37 ms.

## Step 2: field list moves (Excel parity, step 2)

Two scenarios measure what a field-list drop costs: the pure spec move plus the one rebuild it triggers, on a builder
that keeps the column encoding (as in `usePivotGrid`) but only one cube (`maxCubes: 1`), so every iteration
re-aggregates instead of hitting the cube cache.

- **Move field**: `movePivotField` alternates Line → Columns (Month swaps into Rows) and Month → Columns (Line swaps
  back), then rebuilds. With Line in Columns the grid has 48 lines × 3 measures + 3 totals = 147 value columns and
  region → department → month rows, so the view stage (cell formatting) dominates at small sizes.
- **Add measure**: `addPivotMeasure(units, sum)` adds a 4th value (13 more columns), alternating with the base spec.

Both builders warm up in `beforeAll` and are cleared in `afterAll`, so their caches add no memory pressure to the
other scenarios. Medians in ms: step 1 = 7 runs of HEAD `a0c3eb0` (same machine and session, run from a temporary
worktree), step 2 = 6 runs of this tree, interleaved with 3 of the HEAD runs.

| Scenario | 10k step 1 | 10k step 2 | 100k step 1 | 100k step 2 | 500k step 1 | 500k step 2 |
|---|---:|---:|---:|---:|---:|---:|
| Base spec, cold `buildPivotModel` | 17.3 | 18.7 | 46.6 | 48.3 | 177.6 | 177.7 |
| 3 filters, cold | 12.2 | 12.4 | 43.3 | 44.1 | 166.8 | 181.1 |
| Filters + label filter + 4 facets + Top 5 (Other) + sortBy, cold | 14.1 | 15.7 | 50.8 | 49.4 | 195.2 | 202.4 |
| View-only change (builder, cube reused) | 2.7 | 2.8 | 2.4 | 2.5 | 2.4 | 2.9 |
| Filter change: slicer click (builder, encoding reused) | 2.3 | 2.6 | 8.4 | 7.8 | 32.4 | 36.5 |
| **Move field: Line ↔ Columns** (`movePivotField` + rebuild) | n/a | 29.4 | n/a | 34.4 | n/a | 82.7 |
| **Add measure: Units into Values** (`addPivotMeasure` + rebuild) | n/a | 14.3 | n/a | 23.6 | n/a | 65.7 |

**Summary at 500k records:** a drop that moves a field between Rows and Columns rebuilds in about 80 ms, and adding a
measure in about 65 ms, because the encoding is reused (a cold build is about 180 ms). Pointer moves during a drag cost
no React work at all (DOM-only, one hit test per animation frame); the grid rebuilds once, on the drop, or on Update
with "Defer layout update".

**Regression check.** The existing scenarios run the same code paths as step 1 (the step-2 engine changes are a
`valuesIndex` branch in the column layout and an on-demand facet API). Most medians are within ±10 %. Three exceed it,
all within this VM's noise: 10k slicer click (2.3 → 2.6 ms, ±6–10 % rme), 500k view-only change (2.4 → 2.9 ms, 5
samples at ±130 % rme), and 500k slicer click (32.4 → 36.5 ms). Re-running only the slicer-click and view-only
scenarios, 4 interleaved runs per tree, gave 500k slicer click 35.1 → 34.7 ms (−1 %) and 10k / 100k slicer click −9 %
each. The 500k view-only row stays at its noise floor (2.5 → 3.1 ms, 5 samples).

## What changed

1. **Column encoding, once per field** (`createPivotRowEncoding`). Dimension, filter and facet fields become
   `Int32Array` codes plus a key dictionary. Measure fields become `Float64Array`s (`NaN` = no value).
   `String()` and `toPivotNumber` run once per record per field, instead of once per node × column × measure as in
   the old per-node `aggregatePivotRows` path. Consecutive equal values skip the dictionary lookup.
2. **Filters in one pass** (`runPivotFilterPass`). Each filtered field compiles to an `allowed[code]` table
   (include, exclude and label matching evaluated once per distinct key). Each record then does one typed-array
   lookup per filtered field.
3. **Facets in the same pass.** A record counts toward facet F when it fails no filter, or only F's own filter.
   Cross-filtered ("items with no data") counts therefore cost O(records × (filtered fields + facets)), not one
   scan per facet. Unfiltered totals come from the encoding.
4. **Leaf-only accumulation with roll-up** (`buildTree` in `cube.ts`). A composite integer key of the level codes
   finds a record's leaf with one `Map` lookup. Only the leaf's column bucket and total bucket are updated, using
   typed-array accumulators per aggregation kind (sum/avg `[Σ, n]`, min/max, first/last with record index,
   weighted average, ratio). Leaves then merge into their parents level by level. The per-record cost no longer
   grows with the number of row levels, and there are no per-node record arrays (custom aggregators still get
   record lists, merged in data order).
5. **Top N** builds a tree only to the ranked depth, with only the ranking measure (one cheap extra pass per
   Top-N level). Excluded keys are applied by masking records or remapping their key code to "Other".
6. **Split cube / view** (`buildPivotCube` + `pivotModelFromCube`). The cube depends only on
   `pivotSpecDataKey(spec)`, which covers dimensions, measures' fields and aggregates, filters and facets.
   Expanded state, heat, labels, formats, KPIs and totals only re-run the view stage. That stage formats cells for
   visible rows only, computes heat domains from accumulators, and computes heat scope keys once per row (not
   per cell).
7. **Cheaper number formatting.** `formatPivotNumber` trims fraction zeros without regexes or `split`, and counts
   integer digits with comparisons for values under 1000. Output is byte-identical: the goldens are unchanged.
8. **`createPivotModelBuilder` / `usePivotGrid`.** The builder keeps the encoding while `rows` keeps its identity,
   plus up to 4 cubes keyed by the data key (toggling a slicer back is a cache hit) and the last model per spec
   object. `usePivotGrid` uses one builder per grid. `PivotTable` is wrapped in `React.memo`, so parent
   re-renders with the same model skip it. Rows use stable `row.id` keys and cells use column ids.

## Caveats

- Group and grand totals are now sums of leaf partials rather than one sequential sum over records. For
  non-integer data this can differ from the old engine in the last floating-point bit (never in formatted text
  at the default precisions). For integer data, like the goldens, results are identical.
- The encoding cache assumes records are not mutated in place. Pass a new array after changing data.
- Memory: each node holds `(columnKeys + 1) × slots` doubles. For example, 100k leaves × 13 buckets × 12 slots is
  about 125 MB. Very high-cardinality leaf levels should be aggregated upstream, as before.
- Cold encoding is now the largest single stage at 500k. In a stage-timing run it took 130–150 ms, against about
  80 ms (base) to 110–150 ms (filtered) for the cube and 13–50 ms for the view, the higher end on cold JIT. That is
  close to the cost of reading each field once through a `Map`. Columnar input (arrays per field) would be the next
  step if it matters.

Re-run with `pnpm bench`. Numbers on other machines differ in absolute terms. Compare scenarios on the same machine.
