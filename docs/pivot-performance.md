# Pivot performance

`buildPivotModel` benchmarks before and after the filters / Top N / sort-by-value work (Excel parity, step 1), plus the
field-list move scenarios of step 2 ([below](#step-2-field-list-moves-excel-parity-step-2)) and the column-hierarchy /
date-grouping scenarios of step 3 ([below](#step-3-several-column-fields-and-date-grouping-excel-parity-step-3)) and the calculated-measure / distinct-count / drill-through scenarios of step 4 ([below](#step-4-calculated-measures-distinct-count-show-values-as-drill-through-excel-parity-step-4)). The [performance review](#performance-review) at the end covers the React layer and the export service too, with fixes and recommended limits.
The harness is `bench/pivot.bench.ts`, `bench/pivot-columns.bench.ts` and `bench/pivot-step4.bench.ts` (`pnpm bench`, i.e. `vitest bench --run --dir bench`).

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

## Step 3: several column fields and date grouping (Excel parity, step 3)

`bench/pivot-columns.bench.ts` (its own file, so its rows never add GC pressure to the other scenarios) uses
`generateBenchDateRows(n)`: the bench rows plus `year` (`FY25` / `FY26`), `quarter` (fiscal) and an ISO `orderDate`.

- **2 column fields**: `year → month` (2 × 12 leaves, 2 year subtotals, grand total) × 3 values = 81 value columns.
- **3 column fields**: `year → quarter → month` (2 × 4 × 3 leaves, 8 quarter and 2 year subtotals) = 105 value columns.
- **Date grouping, cold**: `orderDate:year → orderDate:quarter` with `fiscalYearStartMonth: 11`, from ISO strings:
  parse every record, period ids, key codes, aggregate, model.
- **Date grouping, encoding reused**: slicer clicks on a builder (`maxCubes: 1`), so the parsed days and date codes
  are reused and every click re-aggregates; next to the same clicks on the raw `year` / `quarter` keys.
- **Toggle a column group**: collapse / expand FY25 on the 3-level layout (view only, cube reused).

Medians in ms (median of the per-run medians over 2 runs; same machine and
session as below):

| Scenario | 100k | 500k |
|---|---:|---:|
| 2 column fields: year → month, cold | 66.7 | 236.9 |
| 3 column fields: year → quarter → month, cold | 74.9 | 230.9 |
| Date grouping from ISO strings (year → quarter), cold | 75.7 | 306.5 |
| Date grouping, encoding reused: slicer click | 5.7 | 28.4 |
| Same slicer click on raw year / quarter keys | 5.4 | 20.7 |
| Toggle a column group (collapse / expand FY25) | 23.6 | 15.5 |

Reading the numbers:

- **Several column fields cost little in the cube.** Each record still updates two buckets (its leaf column and the
  row total); column groups are rolled up per row node afterwards (nodes × groups, a few hundred thousand adds), and
  combinations are found with a dense composite table. A 3-level cold build at 500k (231 ms) is within the noise of the
  2-level one and about 20 % above the 12-column base spec (181 ms below), mostly the larger view stage (105 instead
  of 39 columns to format).
- **Parsing dates once.** The cold date build is about 75 ms (500k) above the raw-key build: the ISO strings are parsed
  once per record (hand-written digit parsing and integer calendar math, consecutive equal values skipped), then one
  period id per record and one key string per distinct period. With the encoding reused (the `usePivotGrid` path)
  nothing is parsed again: a slicer click on the date layout and on raw keys cost the same (a direct 10-run cube
  comparison after warm-up gave 21.7 vs 22.2 ms; the 28.4 vs 20.7 ms in the table is JIT warm-up within 5 samples).
- **Toggling a column group is view-only** (no re-aggregation): 15–24 ms, dominated by formatting 105 columns × 343
  rows (the view stage scales with visible cells; the base spec's 39 columns take about 16 ms at `expanded: "all"`).

**Memory.** The cube holds `(column buckets + 1) × slots` doubles per row node, where buckets are the leaf and group
columns seen in the data. Measured with `--expose-gc` (`heapUsed + arrayBuffers` after one cube, encoding warmed) at
500k rows and 343 row nodes, 13 slots:

| Columns | Leaves | Cube |
|---|---:|---:|
| month (1 field) | 12 | 0.7 MB |
| year → quarter → month | 24 (34 buckets) | 1.4 MB |
| orderDate:yearMonth | 24 | 1.1 MB |
| orderDate:day | 730 | 21.6 MB |
| orderDate:yearMonth → orderDate:day | 730 (+24 groups) | 26.2 MB |

The parsed days plus one date grouping's codes take 8 bytes per record (3.9 MB at 500k). The per-record combination
arrays of several column fields are released after the build (a closure held them in a first version: +4 MB at 500k).
Day-level columns over years of data are the case to watch: 343 row nodes × 3,650 days would be about 130 MB, so
aggregate upstream or group by week / month in such layouts.

**Regression check (existing scenarios).** Medians of the per-run medians, 4 interleaved runs of HEAD `395d744`
(step 2, temporary worktree) and of this tree:

| Scenario | 10k step 2 | 10k step 3 | 100k step 2 | 100k step 3 | 500k step 2 | 500k step 3 |
|---|---:|---:|---:|---:|---:|---:|
| Base spec, cold | 17.7 | 18.6 | 45.3 | 45.1 | 192.5 | 181.4 |
| 3 filters, cold | 12.6 | 11.7 | 39.4 | 38.5 | 177.8 | 191.9 |
| Filters + label filter + 4 facets + Top 5 + sortBy, cold | 13.1 | 12.2 | 52.2 | 45.6 | 208.1 | 225.4 |
| View-only change (means; medians are < 1 ms) | 2.9 | 3.2 | 2.6 | 2.6 | 2.4 | 3.1 |
| Filter change: slicer click | 1.9 | 2.0 | 7.4 | 7.5 | 34.5 | 35.0 |
| Move field: Line ↔ Columns | 29.5 | 26.0 | 39.3 | 33.6 | 91.8 | 93.0 |
| Add measure: Units into Values | 12.1 | 13.3 | 22.7 | 22.2 | 69.1 | 69.3 |

All cold and rebuild scenarios are within ±10 % (500k "3 filters" +8 %, 10k "add measure" +10 %, several are faster).
The only larger figure is the view-only change, whose samples are sub-millisecond with GC outliers (±130 % rme at 500k).
A direct measurement of the same three views (300 builds × 7 rounds per tree, interleaved twice) gave 2.03 / 2.26 / 1.94
ms (step 2) against 2.18 / 2.08 / 2.00 ms (step 3) at 10k and 2.35 / 2.26 / 2.37 against 2.38 / 2.05 / 2.39 ms at 500k,
i.e. equal within noise. Notes:

- The step-2 "move field" scenario now makes two moves per iteration (Line into Columns before Month, then Month into
  Rows), because Columns accept several fields since step 3; the layouts built are the step-2 ones.
- A first step-3 run kept the 600k extra date rows alive in the same file while the existing scenarios ran; their means
  rose 10–15 % at 500k from GC alone, which is why the step-3 scenarios moved to their own bench file.
- The engine paths of single-column specs changed in three places: the column bucket per record may be `-1`, cells read
  accumulators by bucket index (no key lookup per cell), and the model builds headers generically. None is measurable.

## Step 4: calculated measures, distinct count, show values as, drill-through (Excel parity, step 4)

`bench/pivot-step4.bench.ts` (own file and rows: `generateBenchCustomerRows(n)` adds a `customer` id with 20,000
distinct values; the other fields are identical) repeats the base spec as its reference. Means in ms, same machine:

| Scenario | 100k | 500k |
|---|---:|---:|
| Reference: base spec, cold | 44.5 | 186.0 |
| Calculated measure `actual / plan - 1` as a 4th value, cold | 51.1 | 170.4 |
| Calculated measure as `sortBy` + Top 3 (Other) + heat + KPI, cold | 57.6 | 208.9 |
| Distinct count of 20k customers as a 4th value, cold | 62.6 | 269.8 |
| Distinct count of 6 regions (department → line), cold | 34.0 | 182.1 |
| Running total along month, cold | 59.8 | 211.2 |
| View-only: running total / difference from / subtotal rows (builder, cube reused) | 13.0 | 12.9 |
| Drill-through: one leaf cell (encoding reused) | 0.7 | 7.2 |
| Drill-through: grand total of filters + Top 5 (Other), first 1,000 records (encoding reused) | 12.2 | 46.7 |

- **Calculated measures** cost nothing in the record pass (no accumulator slots): the expression is compiled once per
  build into closures and evaluated per read from the referenced measures' accumulators. A 4th value adds the cells
  it formats (within noise of the reference). As a Top-N rank measure, the rank tree accumulates its references.
- **Distinct count** is one extra pass per distinct-count measure after the tree is built: a counting sort of the
  matching records by key code, then each record visits (row levels + 1) × (column levels + 1) buckets against a
  stamp array. About +85 ms at 500k for a 3-level row hierarchy × 12 months with 20k keys; with 6 keys and 2 row
  levels it is no slower than the reference. Memory: the stamp array (nodes × buckets × 4 bytes; 343 × 13 × 4 = 18 KB
  here), two record-sized `Int32Array`s (4 MB at 500k, released after the build) and one accumulator slot per bucket.
  Per-bucket `Set`s would hold one entry per (node, bucket, key), i.e. millions of entries for 20k customers at 500k.
- **Show values as along a field and subtotal rows** are view-only: the cube is reused, and the view stage reads
  sibling values per cell (running totals: up to the item; differences: one base). 13 ms for 3 expanded row levels
  × 39 value columns, every view in the rotation re-rendering all visible rows.
- **Drill-through** shares the filter + Top-N selection stage with the cube (moved, not changed), then scans the
  mask and level codes. A leaf cell is a few milliseconds even at 500k; the filtered spec pays its Top-N rank tree.
  None of this runs unless a caller drills.

**Regression check (existing scenarios).** Medians of the per-run means: 3 runs of HEAD `07e6703` (step 3, temporary
worktree) and 2 of this tree for `pivot.bench.ts`, 2 and 1 for `pivot-columns.bench.ts`, interleaved:

| Scenario | 10k step 3 | 10k step 4 | 100k step 3 | 100k step 4 | 500k step 3 | 500k step 4 |
|---|---:|---:|---:|---:|---:|---:|
| Base spec, cold | 18.6 | 19.0 | 41.7 | 42.3 | 200.0 | 181.7 |
| 3 filters, cold | 10.9 | 13.0 | 40.0 | 40.6 | 193.0 | 176.4 |
| Filters + label filter + 4 facets + Top 5 + sortBy, cold | 13.7 | 14.3 | 48.8 | 50.5 | 226.2 | 206.7 |
| View-only change | 2.9 | 2.6 | 2.4 | 2.3 | 2.5 | 2.0 |
| Filter change: slicer click | 2.9 | 2.3 | 8.7 | 8.1 | 35.9 | 32.4 |
| Move field: Line ↔ Columns | 21.3 | 21.1 | 34.6 | 33.5 | 85.2 | 79.2 |
| Add measure: Units into Values | 13.4 | 13.4 | 25.0 | 24.1 | 64.9 | 64.2 |
| 2 column fields: year → month, cold | | | 68.1 | 66.7 | 240.0 | 224.9 |
| 3 column fields: year → quarter → month, cold | | | 78.9 | 63.1 | 262.6 | 245.3 |
| Date grouping from ISO strings, cold | | | 80.7 | 72.2 | 340.9 | 340.0 |
| Date grouping, encoding reused: slicer click | | | 7.5 | 6.0 | 21.9 | 21.5 |
| Toggle a column group | | | 21.8 | 21.2 | 16.3 | 16.2 |

Everything is within ±10 % except 10k "3 filters" (+19 %: 10.0 / 10.9 / 13.2 ms for step 3 against 11.8 / 14.2 ms, i.e.
overlapping runs of a ~11 ms scenario; the code path only moved into the shared selection function). The engine paths
of specs without the new features changed only by a `null` check per record (`distinctLeaf`), one more `switch` case in
the accumulator merge and reads, and the measure compiler (now dependency-ordered). The view stage builds its show-as
lookups only for measures that use them.

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
   plus up to 4 cubes keyed by the data key (toggling a slicer back is a cache hit; since the performance review also within a 256 MiB byte budget) and the last model per spec
   object. `usePivotGrid` uses one builder per grid. `PivotTable` is wrapped in `React.memo`, so parent
   re-renders with the same model skip it. Rows use stable `row.id` keys and cells use column ids.

## Caveats

- Group and grand totals are now sums of leaf partials rather than one sequential sum over records. For
  non-integer data this can differ from the old engine in the last floating-point bit (never in formatted text
  at the default precisions). For integer data, like the goldens, results are identical.
- The encoding cache assumes records are not mutated in place. Pass a new array after changing data.
- Memory: each node holds `(column buckets + 1) × slots` doubles (buckets: leaf and group columns; see step 3). For example, 100k leaves × 13 buckets × 12 slots is
  about 125 MB. Very high-cardinality leaf levels should be aggregated upstream, as before.
- Cold encoding is now the largest single stage at 500k. In a stage-timing run it took 130–150 ms, against about
  80 ms (base) to 110–150 ms (filtered) for the cube and 13–50 ms for the view, the higher end on cold JIT. That is
  close to the cost of reading each field once through a `Map`. Columnar input (arrays per field) would be the next
  step if it matters.

## Performance review

An independent review of the whole pivot stack after step 4 (engine, React layer, static renderer, export service,
Python client), measured rather than taken from the sections above. Same VM (4 vCPU Xeon @ 2.80 GHz, Node 22.22,
Chromium from Playwright). Engine numbers are medians of interleaved runs (old and new code in separate processes, or
both bundled into one script and alternated); React numbers are medians of 3 page loads per variant; the regression
table is the median of 2 interleaved `pnpm bench` runs per tree. Scripts, CPU profiles and raw results were kept
outside the repository; `bench/pivot-review.bench.ts` reproduces the engine scenarios.

### Findings, ranked by impact

1. **`PivotTable` rendered every body row.** No virtualization: each model change re-rendered all rows and the browser
   laid out every cell (two sticky cells per row). At 6,007 rows × 39 value columns: 3.6 s to mount, 0.7 s per update,
   253k DOM nodes; at 29,216 rows: 23 s to mount, 4.5 s per update, 1.2M DOM nodes, 1 GB JS heap, 270 ms per scroll step.
   **Fixed** with row virtualization (on by default above 10,000 body cells).
2. **"Show values as" along a field was O(k²) per sibling group.** Running totals summed siblings `0…i` for every cell,
   `% running total` and ranks scanned all siblings for every cell, and differences built the sibling key list per
   cell. With 2,000 customers per region (100k records, 12k body rows): 2.2 s (running total), 6.2 s (% running
   total), 6.5 s (rank), 2.1 s (difference from) instead of 0.18 s for plain values; with 16,000 per region a running
   total took 52 s. The step-4 note "running totals: up to the item" described this cost. **Fixed** (shared sibling
   series: prefix sums, sorted values, base lookup).
3. **Every PDF paid for a new browser context, page and renderer.** Of about 160 ms per PDF, `newPage` took 40 ms and
   the first `setContent` / `pdf` in a fresh renderer 46 / 62 ms, against 16 / 38 ms on a reused page. **Fixed** with
   a pool of warm print pages (twice the throughput).
4. **The builder kept 4 cubes whatever their size.** Region → customer (120k row nodes) at 1M records: 162 MB per
   cube, +486 MB retained after three slicer states, and garbage collection took 42 % of each 1.9 s build.
   **Fixed** with a byte budget (`maxCubeBytes`, default 256 MiB).
5. **Cubes with many row nodes were allocation-bound.** One zero-filled `Float64Array`, one `Map` and one ancestor
   array per node: about 190,000 leaves (200k records, 4 row levels down to customer) took 1.5 s, two thirds in node
   creation and GC. A `Map` lookup per record found the leaf even for small key spaces. **Fixed** (shared accumulator
   blocks, no child maps on leaves, lazy ancestor chains, dense leaf table).
6. **Not changed** (measured, below the bar or by design): see "Deliberately not changed".

Cache correctness was checked against the code: `pivotSpecDataKey` covers every input of the cube (row / column
fields with order, sort, `sortBy`, Top N without its label, attributes, `keepEmpty`; measure fields, aggregates and
calculated expressions; filters; facets; date-field definitions). Labels, formats, show-as, subtotal placement,
totals, heat, KPIs, `values` and `valuesIndex` are view-only, and the cube compiles every measure (not only `values`),
so changing them reuses the cube. New `rows` or `aggregators` identities clear the caches.

### Fixes and measurements

**Row virtualization (`PivotTable`, interactive mode).** `virtualize` (`"auto"` by default, `true`, `false`) and
`overscan` (12 rows). When on, only the rows in view of the nearest vertically scrolling ancestor (or the window), plus
overscan, are rendered between two spacer rows; window computation is coalesced to one per animation frame and widened
to 8-row chunks, so small scrolls do not re-render. Span cells whose group starts above the first rendered row are
drawn there, clipped to the rendered rows (`rowSpan` never reaches into a spacer); the window is widened so a clipped
span keeps room for its KPI panel (or two rows), KPI filler rows are on (`fillSpanHeight`), and rendered rows are
measured, so spacers stay exact when rows render taller than `rowHeight`. `aria-rowcount` / `aria-rowindex` describe
the full table. Static mode (HTML / PDF) and models up to 10,000 body cells (or 200 rows) render exactly as before.
Region → customer, 39 value columns, Chromium:

| Body rows (cells) | Mount before | Mount after | Update before | Update after | DOM nodes before → after | JS heap before → after | Scroll step before → after |
|---|---:|---:|---:|---:|---:|---:|---:|
| 487 (19k) | 304 ms | 78 ms | 91 ms | 17 ms | 20,887 → 1,670 | 32 → 28 MB | 33 → 33 ms |
| 6,007 (234k) | 3,637 ms | 94 ms | 729 ms | 30 ms | 252,727 → 1,670 | 232 → 65 MB | 61 → 33 ms |
| 29,216 (1.1M) | 23,252 ms | 103 ms | 4,505 ms | 27 ms | 1,227,505 → 1,670 | 1,013 → 171 MB | 270 → 33 ms |
| 71,669 (2.8M) | not run | 108 ms | not run | 67 ms | – → 1,670 | – → 374 MB | – → 33 ms |

"Update" is a new model of the same size (heat scope change); "scroll step" is 300 px plus two animation frames
(33 ms is the floor). A side-by-side check rendered the same model with and without virtualization in two scrollers
and compared the painted cell under about 250 sample points at 17 scroll positions, for 4-level trees with KPI panels,
`subtotal: "end"` with the grand total on top, compact layout and partly collapsed groups (and the window as the
scroller): the painted content matched everywhere. With rows taller than `rowHeight` (e.g. collapsed groups with a
KPI delta render 37 px), the scroll height converges as rows are measured.

**Show values as along a field (`pivotModelFromCube`).** Cells share one series per sibling group and column: running
totals read a prefix sum (the same additions in the same order, so results are bit-identical), ranks binary-search the
sorted values, differences look the base up directly. Groups of at most 32 siblings keep the per-cell scan (cheaper
than building a series). Row-field series are kept for the current parent only (its nodes are contiguous in display
order), column-field series for the current row only. A randomized comparison against the previous implementation
(4,500 specs: every show-as kind, row and column bases, named items, previous / next, subtotal placements, collapsed
groups, up to 60 siblings, i.e. both sides of the 32-sibling scan limit) gave identical models. View-only builds, 100k records, region → customer:

| Scenario | 1,000 per region before | after | 2,000 per region before | after |
|---|---:|---:|---:|---:|
| plain values (reference) | 72 ms | 77 ms | 175 ms | 184 ms |
| running total along customer | 448 ms | 111 ms | 2,233 ms | 191 ms |
| % running total along customer | – | – | 6,176 ms | 184 ms |
| rank (descending) along customer | 1,133 ms | 105 ms | 6,462 ms | 185 ms |
| difference from (`item`) along customer | 488 ms | 57 ms | 2,096 ms | 130 ms |

With 16,000–20,000 customers per region the running total went from 52 s to 1.8 s (plain values 0.8 s). Show-as
along small fields (month, region) is unchanged (within ±10 % in separate-process runs).

**PDF page pool (`nqgrid-export`).** `createPivotPdfPagePool(browser)` keeps print pages in one context with
JavaScript off and the network blocked (as before); each PDF replaces the page's document with `setContent`, a page
that fails is closed, and pages are replaced after 100 renders. `createPivotExporter` uses it (serve mode: one idle page
per `--concurrency`), and XLSX exports now share the concurrency limit with PDFs. `renderPivotPdf` is unchanged for
one-off use. Planning golden (`planning.request.json` + rows) against `serve`, 2 interleaved runs each:

| Load | Before p50 / p95 | After p50 / p95 | Throughput before → after |
|---|---:|---:|---:|
| 20 sequential PDFs | 169–189 / 196–222 ms | 84–98 / 115–121 ms | 5.2–5.9 → 9.9–11.1 req/s |
| 5 concurrent PDFs × 4 rounds | 419–421 / 567–575 ms | 224–253 / 315–319 ms | 8.8–9.0 → 17.2 req/s |
| 1,200 PDFs, 4 at a time (Node API) | | | 10.0 → 22.2 PDFs/s |
| 20 sequential XLSX | 17 / 23 ms | unchanged | 55 req/s |

Chromium memory is flat with reuse (398 → 411 MB RSS over 1,200 PDFs with 4 warm pages, against 291–310 MB without
them): the pool costs about 110 MB for 4 idle pages and does not grow.

**Cube cache byte budget (`createPivotModelBuilder`).** `PivotCube.byteSize` estimates what a cube retains
(`nodes × ((column buckets + 1) × slots × 8 + 240)` bytes, plus record lists for custom aggregators; 176 MB estimated
against 162 MB measured above). The builder drops its oldest cubes while the cache exceeds `maxCubeBytes` (default
256 MiB; the current cube always stays). Same scenario (1M records, region → customer, 6 slicer states): retained heap
over the first cube +162 / +324 / +486 / +455 MB → about 0 (one cube kept), builds 1.8–2.4 s → 1.25–1.5 s (less GC).
Layouts with up to a few thousand row nodes still keep 4 cubes (343 nodes × 13 buckets ≈ 0.7 MB each).

**Cube construction (`buildTree`).** Accumulators are views into 512 KB blocks; leaves share one empty child map;
the ancestor chain is built only when attributes are pending; key spaces up to 2²⁰ use an `Int32Array` from composite
key to leaf instead of a `Map`. A randomized comparison of full models and drill-through against the previous engine
(2,158 valid specs: every aggregate incl. custom, ratio, weighted average, distinct count, calculated measures, Top N
with and without Other, attributes, date grouping, 0–2 column fields, filters, facets, heat) gave identical output.
Accumulator blocks start at 64 nodes and double up to 512 KB, so small trees (Top-N rank trees, 10k-record specs)
allocate no more than before. Cube only (encoding reused), medians of 6 (1M) and 4 (200k) alternated processes, each
the median of 9 / 3 builds:

| Scenario | Before | After |
|---|---:|---:|
| 1M records, base spec | 102 ms | 88 ms (−14 %) |
| 1M records, filtered spec (3 filters, 4 facets, Top 5 + Other, sort by value) | 193 ms | 155 ms (−20 %) |
| 200k records, region → department → line → customer (~190k row nodes) | 1,615 ms | 1,154 ms (−29 %) |

**Regression check (`pnpm bench`).** Median of the per-run means, 2 interleaved runs of HEAD `5d75998` (temporary
worktree) and of this tree; `pivot.bench.ts` and `pivot-step4.bench.ts` with the final code, `pivot-columns.bench.ts`
and `pivot-review.bench.ts` from a first pair of runs (before the accumulator blocks started small). Before → after, ms:

| Scenario | 10k | 100k | 500k |
|---|---:|---:|---:|
| Base spec, cold | 18.7 → 16.7 | 44.9 → 44.8 | 174.8 → 168.0 |
| 3 filters, cold | 11.4 → 11.3 | 44.2 → 38.2 | 172.8 → 165.3 |
| Filters + label filter + 4 facets + Top 5 + sortBy, cold | 13.4 → 13.4 | 54.4 → 47.5 | 218.7 → 200.8 |
| View-only change (sub-millisecond medians, GC outliers) | 2.9 → 3.0 | 2.2 → 2.6 | 1.7 → 2.1 |
| Filter change: slicer click | 2.6 → 2.4 | 7.5 → 8.8 | 32.3 → 32.5 |
| Move field: Line ↔ Columns | 21.8 → 25.2 | 31.0 → 29.7 | 81.3 → 67.2 |
| Add measure: Units into Values | 13.1 → 12.5 | 21.5 → 20.7 | 76.2 → 58.0 |
| Step 4 reference: base spec, cold | | 50.8 → 48.6 | 183.8 → 177.0 |
| Calculated measure as a 4th value, cold | | 59.1 → 52.1 | 205.1 → 189.1 |
| Calculated measure as sortBy + Top 3 + heat + KPI, cold | | 66.8 → 56.8 | 250.1 → 222.7 |
| Distinct count of 20k customers, cold | | 75.9 → 62.7 | 280.6 → 266.8 |
| Distinct count of 6 regions, cold | | 39.7 → 37.1 | 178.1 → 166.4 |
| View-only: running total / difference from / subtotal rows | | 13.2 → 11.3 | 10.0 → 12.9 |
| Running total along month, cold | | 50.3 → 47.3 | 172.9 → 179.8 |
| Drill-through: leaf cell | | 0.7 → 0.7 | 4.4 → 4.3 |
| Drill-through: grand total of filters + Top 5 | | 11.2 → 11.5 | 42.3 → 42.3 |
| 2 column fields: year → month, cold | | 71.0 → 64.4 | 214.0 → 201.0 |
| 3 column fields: year → quarter → month, cold | | 72.3 → 71.3 | 278.2 → 250.4 |
| Date grouping from ISO strings, cold | | 76.1 → 69.5 | 363.6 → 303.9 |
| Date grouping, encoding reused: slicer click | | 6.2 → 6.3 | 23.0 → 20.7 |
| Toggle a column group | | 21.1 → 17.5 | 21.2 → 17.9 |
| Review: values / running total / rank / difference along 1,000 customers per region | | 84 / 482 / 1,290 / 530 → 70 / 89 / 108 / 73 | |
| Review: ~190k row nodes, cube (200k records) | | 1,339 → 813 | |

Cold builds are equal or faster (dense leaf table, block allocation). Rows above +10 % overlap between runs: 10k
"move field" (24.4 / 19.3 against 25.3 / 25.1 ms; the first pair of runs gave 21.2 → 20.0), 100k slicer click (7.8 / 7.1
against 7.1 / 10.6), 500k step-4 view-only (11.2 / 8.8 against 15.0 / 10.8) and the sub-millisecond view-only rows. A
direct alternated comparison of the 10k filtered spec, 25 builds per process and 3 processes each, gave 14.1 ms for
both trees (an earlier version allocated a 512 KB block per tree and was 30 % slower there; blocks now start small).

### Deliberately not changed

- **Encoding** is the largest stage of a cold build at 1M records (250–350 ms for 7 fields; the cube is 90–250 ms,
  the view 10–30 ms). It reads each field once through property access; columnar input would be the next step.
- **Model size.** Every visible row's cells are materialized as objects (`{ value, raw, text }`): about 130 bytes per
  cell in Chromium (9.85M cells: 1.27 GB heap). Virtualization removed the DOM cost, not this. Lazy cells would change
  the `PivotModel` contract (the JSON shared with Python and the goldens).
- **Key sorting** (`sort: "asc"` / `"desc"`) parses keys as numbers in every comparison: 26 ms for 20k keys,
  368 ms for 200k. Below the cost of building a tree with that many nodes.
- **Dense accumulator layout.** Each row node holds every column bucket (1.2 KB for the base spec's 14 buckets ×
  11 slots). Leaves with a handful of records waste most of it, but a sparse layout changes every read path; the cache
  budget bounds the impact.
- **XLSX** is built in memory with exceljs: 3,007 rows × 39 columns in 1.5 s (+120 MB RSS), 30,006 rows in 6.4 s
  (+450 MB). A streaming workbook writer would bound memory; with the 10 MiB request cap and the shared
  concurrency limit it is not needed for typical reports.
- **Very large PDFs** cost about 10 ms per page in Chromium's print path whatever the CSS (a 3,007-row × 39-column
  pivot is 471 pages with its column chunks, 6 s in `page.pdf`, 10 s end to end; removing the `break-inside` rules or
  the row spans did not help). A 30,006-row pivot fails with "Printing failed" after about 100 s, before and after
  this review.
- **Drag and drop** in the field list and headers already does one hit test per animation frame and no React work
  while moving; `usePivotGrid` memo boundaries are sound (callbacks change only with the spec, together with the model).
- **Python client.** `NqgridExportClient` reuses one `httpx` client (connection pool). `SubprocessExporter` starts
  `nqgrid-export` (and Chromium for PDFs) per call by design; `PivotReportService.from_env` prefers the HTTP client
  when `NQGRID_EXPORT_URL` is set.

### Remaining risks and recommended limits

| Area | Recommended ceiling | Why |
|---|---|---|
| Records per build (browser) | ≤ 1M records with ≤ 20 fields read | Cold build ≈ 0.35–0.5 s at 1M (encode + cube); the rows themselves are the larger memory cost (260 MB for 1M × 8 fields). |
| Row nodes per cube | ≤ 50k nodes at ~13 column buckets (≈ 75 MB per cube) | Memory ≈ nodes × ((buckets + 1) × slots × 8 + 240) B; 120k nodes × 14 buckets = 176 MB. Aggregate upstream or group by a coarser field beyond. |
| Visible body cells (model) | ≤ 1M cells (e.g. 25k rows × 39 columns) | ≈ 130 B per cell in the model; 2.8M cells used 374 MB of JS heap. Collapse groups (`expanded: "none"`) or Top N for larger views. |
| Show-as along a field | no practical sibling limit | O(k log k) per sibling group and column; memory: one series per (current parent, descendant path, column). |
| React DOM | none (virtualized) | ~1,700 DOM nodes at any size; mount 80–110 ms dominated by the model. Opt out (`virtualize={false}`) only for small tables (all rows in the DOM, e.g. for find-in-page). |
| PDF per request | ≤ ~300 pages (≈ 2,000 body rows × 39 columns on A4 landscape, column chunks included) | ~10 ms per page; 30,006 rows fail in Chromium. Use XLSX for full listings. |
| XLSX per request | ≤ ~200k cells at `--concurrency 4` | exceljs needs ~0.4–1 KB of RSS per cell (30,006 × 39: +450 MB); lower `--concurrency` or raise `--max-old-space-size` for larger. |
| Request body | 10 MiB (default `--max-body-mb`) | JSON parse and encode are synchronous on the event loop. |

Virtualization caveats: rows are assumed to be `rowHeight` tall until rendered once (the scroll height converges as
rows are measured); find-in-page sees only rendered rows; custom `renderSpanCell` content taller than two rows can
stretch rows when its span is clipped at the window edge.

Re-run with `pnpm bench`. Numbers on other machines differ in absolute terms. Compare scenarios on the same machine.
