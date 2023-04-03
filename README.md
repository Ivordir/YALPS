# YALPS [![](https://badgen.net/npm/v/yalps)](https://www.npmjs.com/package/yalps) [![](https://badgen.net/npm/license/yalps)](https://github.com/Ivordir/YALPS/blob/main/LICENSE)

## What is This (For)?

This is **Yet Another Linear Programming Solver (YALPS)**.
It is intended as a performant, lightweight linear programming (LP) solver geared towards small LP problems.
It can solve non-integer, integer, and mixed integer LP problems.
While webassembly ports of existing solvers perform well,
they tend to have larger bundle sizes and may be overkill for your use case.
YALPS is the alternative for the browser featuring a small [bundle size](https://bundlephobia.com/package/yalps).

YALPS is a rewrite of [jsLPSolver](https://www.npmjs.com/package/javascript-lp-solver).
The people there have made a great and easy to use solver.
However, the API was limited to objects only, and I saw other areas that could have been improved.
You can check out [jsLPSolver](https://www.npmjs.com/package/javascript-lp-solver)
for more background and information regarding LP problems.

Compared to jsLPSolver, YALPS has the following differences:

- More flexible API (e.g., support for Iterables alongside objects)
- Better performance (especially for non-integer problems, see [Performance](#Performance) for more details.)
- Good Typescript support (YALPS is written in Typescript)

On the other hand, these features from jsLPSolver were dropped:

- Unrestricted variables (might be added later)
- Multiobjective optimization
- External solvers

# Usage

## Installation

```
npm i yalps
```

## Import

The main solve function:

```typescript
import { solve } from "yalps"
```

Alternate helper functions:

```typescript
import { lessEq, equalTo, greaterEq, inRange } from "yalps"
```

Types, as necessary:

```typescript
import { Model, Constraint, Coefficients, OptimizationDirection, Options, Solution } from "yalps"
```

## Examples

Using objects:

```typescript
const model = {
  direction: "maximize" as const,
  objective: "profit",
  constraints: {
    wood: { max: 300 },
    labor: { max: 110 }, // labor should be <= 110
    storage: lessEq(400) // you can use the helper functions instead
  },
  variables: {
    table: { wood: 30, labor: 5, profit: 1200, storage: 30 },
    dresser: { wood: 20, labor: 10, profit: 1600, storage: 50 }
  },
  integers: ["table", "dresser"] // these variables must have an integer value in the solution
}

const solution = solve(model)
// { status: "optimal", result: 14400, variables: [ ["table", 8], ["dresser", 3] ] }
```

Iterables and objects can be mixed and matched for the `constraints` and `variables` fields.
Additionally, each variable's coefficients can be an object or an iterable. E.g.:

<!-- prettier-ignore-start -->

```typescript
const constraints = new Map<string, Constraint>()
  .set("wood", { max: 300 })
  .set("labor", lessEq(110))
  .set("storage", lessEq(400))

const dresser = new Map<string, number>()
  .set("wood", 20)
  .set("labor", 10)
  .set("profit", 1600)
  .set("storage", 50)

const model: Model = {
  direction: "maximize",
  objective: "profit",
  constraints: constraints, // is an iterable
  variables: { // kept as an object
    table: { wood: 30, labor: 5, profit: 1200, storage: 30 }, // an object
    dresser: dresser // an iterable
  },
  integers: true // all variables are indicated as integer
}

const solution: Solution = solve(model)
// { status: "optimal", result: 14400, variables: [ ["table", 8], ["dresser", 3] ] }
```

<!-- prettier-ignore-end -->

## API

This is a stripped down version of YALPS's API.
Use the JSDoc annotations / hover information in your editor for more extensive documentation.

```typescript
type Constraint = {
  equal?: number
  min?: number
  max?: number
}

const lessEq: (value: number) => Constraint
const greaterEq: (value: number) => Constraint
const equalTo: (value: number) => Constraint
const inRange: (lower: number, upper: number) => Constraint

type Coefficients<ConstraintKey = string> =
  | Iterable<[ConstraintKey, number]>
  | (ConstraintKey extends string ? { [key in ConstraintKey]?: number } : never)

type OptimizationDirection = "maximize" | "minimize"

type Model<VariableKey = string, ConstraintKey = string> = {
  direction?: OptimizationDirection // defaults to `"maximize"` if left blank
  objective?: ConstraintKey // the value to optimize

  constraints:
    | Iterable<[ConstraintKey, Constraint]>
    | (ConstraintKey extends string ? { [key in ConstraintKey]?: Constraint } : never)

  variables:
    | Iterable<[VariableKey, Coefficients<ConstraintKey>]>
    | (VariableKey extends string ? { [key in VariableKey]?: Coefficients<ConstraintKey> } : never)

  /**
   * An `Iterable` of variable keys that indicate the corresponding variables are integer.
   * It can also be a `boolean`, indicating whether all variables are integer or not.
   * If this is left blank, then all variables are treated as not integer.
   */
  integers?: boolean | Iterable<VariableKey>

  /**
   * An `Iterable` of variable keys that indicate the corresponding variables are binary
   * (can only be 0 or 1 in the solution).
   * It can also be a `boolean`, indicating whether all variables are binary or not.
   * If this is left blank, then all variables are treated as not binary.
   */
  binaries?: boolean | Iterable<VariableKey>
}

type SolutionStatus = "optimal" | "infeasible" | "unbounded" | "timedout" | "cycled"

type Solution<VariableKey = string> = {
  /**
   * `status` indicates what type of solution, if any, the solver was able to find.
   *
   * `"optimal"` indicates everything went ok, and the solver found an optimal solution.
   * `"infeasible"` indicates that the problem has no possible solutions.
   * `"unbounded"` indicates a variable, or combination of variables, are not sufficiently constrained.
   * `"timedout"` indicates that the solver exited early for an integer problem.
   * `"cycled"` indicates that the simplex method cycled and exited (this is rare).
   */
  status: SolutionStatus

  /**
   * The final, maximized or minimized value of the objective.
   * It may be `NaN` in the case that `status` is `"infeasible"`, `"cycled"`, or `"timedout"`.
   * It may also be +-`Infinity` in the case that `status` is `"unbounded"`.
   */
  result: number

  /**
   * An array of variables and their coefficients that add up to `result` while satisfying the constraints of the problem.
   * Variables with a coefficient of `0` are not included in this by default.
   */
  variables: [VariableKey, number][]
}

type Options = {
  /**
   * Numbers with magnitude equal to or less than the provided precision are treated as zero.
   * Similarly, the precision determines whether a number is sufficiently integer.
   * The default value is `1E-8`.
   */
  precision?: number

  /**
   * In rare cases, the solver can cycle.
   * This is assumed to be the case when the number of pivots exceeds `maxPivots`.
   * Setting this to `true` will cause the solver to explicitly check for cycles and stop early if one is found.
   * The default value is `false`.
   */
  checkCycles?: boolean

  /**
   * This determines the maximum number of pivots allowed within the simplex method.
   * If this is exceeded, then it assumed that the solver cycled.
   * The default value is `8192`.
   */
  maxPivots?: number

  /**
   * This option applies to integer problems only.
   * If an integer solution is found within
   * `(1 +- tolerance) * {the problem's non-integer solution}`,
   * then this approximate integer solution is returned.
   * For example, a tolereance of `0.05` allows integer solutions found within 5% of the non-integer solution to be returned.
   * The default value is `0` (only find the most optimal solution).
   */
  tolerance?: number

  /**
   * This option applies to integer problems only.
   * It specifies, in milliseconds, the maximum amount of time the solver may take.
   * The default value is `Infinity` (no timeout).
   */
  timeout?: number

  /**
   * This option applies to integer problems only.
   * It determines the maximum number of iterations for the main branch and cut algorithm.
   * It can be used alongside or instead of `timeout` to prevent the solver from taking too long.
   * The default value is `32768`.
   */
  maxIterations?: number

  /**
   * Controls whether variables that end up having a value of `0`
   * should be included in `variables` in the resulting `Solution`.
   * The default value is `false`.
   */
  includeZeroVariables?: boolean
}

const defaultOptions: Required<Options>

const solve: <VarKey = string, ConKey = string>(model: Model<VarKey, ConKey>, options?: Options) => Solution<VarKey>
```

# Performance

While YALPS generally performs better than javascript-lp-solver,
this solver is still geared towards small problems (hundreds of variables or constraints).
For example, the solver keeps the full representation of the matrix in memory as a dense array.
As a general rule, the number of variables and constraints should probably be a few thousand or less,
and the number of integer variables should be a few hundred at the most.
If your use case has large problems, it is recommended that you first
benchmark and test the solver on your own before committing to using it.
For very large and/or integral problems, a more professional solver is recommended,
e.g. [glpk.js](https://www.npmjs.com/package/glpk.js).

Nevertheless, below are the results from some benchmarks comparing YALPS to other solvers.
Each solver was run 30 times for each benchmark problem.
A full garbage collection was manually trigged before starting each solver's 30 trials.
The averages and standard deviations are measured in miliseconds. Slowdown is calculated as `mean / fastest mean`.
The benchmarks were run on ts-node v10.9.1 and node v19.8.1. Your milage may vary in a browser setting.

<pre>
Monster 2: 888 constraints, 924 variables, 112 integers:
┌────────────┬────────┬────────┬──────────┐
│  (index)   │  mean  │ stdDev │ slowdown │
├────────────┼────────┼────────┼──────────┤
│   YALPS    │ 53.95  │  2.25  │    1     │
│  glpk.js   │ 116.19 │  3.2   │   2.15   │
│ jsLPSolver │ 184.9  │ 10.43  │   3.43   │
└────────────┴────────┴────────┴──────────┘

Monster Problem: 600 constraints, 552 variables, 0 integers:
┌────────────┬──────┬────────┬──────────┐
│  (index)   │ mean │ stdDev │ slowdown │
├────────────┼──────┼────────┼──────────┤
│   YALPS    │ 1.85 │  1.28  │    1     │
│  glpk.js   │ 4.78 │  1.07  │   2.58   │
│ jsLPSolver │ 7.41 │  5.03  │    4     │
└────────────┴──────┴────────┴──────────┘

Vendor Selection: 1641 constraints, 1640 variables, 40 integers:
┌────────────┬────────┬────────┬──────────┐
│  (index)   │  mean  │ stdDev │ slowdown │
├────────────┼────────┼────────┼──────────┤
│  glpk.js   │  61.3  │  1.35  │    1     │
│   YALPS    │ 296.05 │  3.21  │   4.83   │
│ jsLPSolver │ 404.31 │ 15.73  │   6.6    │
└────────────┴────────┴────────┴──────────┘

Large Farm MIP: 35 constraints, 100 variables, 100 integers:
┌────────────┬───────┬────────┬──────────┐
│  (index)   │ mean  │ stdDev │ slowdown │
├────────────┼───────┼────────┼──────────┤
│  glpk.js   │ 6.24  │  1.04  │    1     │
│   YALPS    │ 30.46 │  1.29  │   4.88   │
│ jsLPSolver │ 58.28 │  2.17  │   9.33   │
└────────────┴───────┴────────┴──────────┘

AGG2: 516 constraints, 302 variables, 0 integers:
┌────────────┬──────┬────────┬──────────┐
│  (index)   │ mean │ stdDev │ slowdown │
├────────────┼──────┼────────┼──────────┤
│   YALPS    │ 1.6  │  0.6   │    1     │
│ jsLPSolver │ 7.09 │  3.05  │   4.44   │
│  glpk.js   │ 7.57 │  0.96  │   4.74   │
└────────────┴──────┴────────┴──────────┘

BEACONFD: 173 constraints, 262 variables, 0 integers:
┌────────────┬──────┬────────┬──────────┐
│  (index)   │ mean │ stdDev │ slowdown │
├────────────┼──────┼────────┼──────────┤
│  glpk.js   │ 2.42 │  0.5   │    1     │
│   YALPS    │ 2.59 │  0.59  │   1.07   │
│ jsLPSolver │ 5.35 │  1.25  │   2.21   │
└────────────┴──────┴────────┴──────────┘

SC205: 205 constraints, 203 variables, 0 integers:
┌────────────┬───────┬────────┬──────────┐
│  (index)   │ mean  │ stdDev │ slowdown │
├────────────┼───────┼────────┼──────────┤
│  glpk.js   │  2.6  │  0.5   │    1     │
│   YALPS    │ 7.18  │  0.23  │   2.76   │
│ jsLPSolver │ 10.86 │  1.69  │   4.17   │
└────────────┴───────┴────────┴──────────┘

SCFXM1: 330 constraints, 457 variables, 0 integers:
┌────────────┬───────┬────────┬──────────┐
│  (index)   │ mean  │ stdDev │ slowdown │
├────────────┼───────┼────────┼──────────┤
│  glpk.js   │  6.3  │  0.31  │    1     │
│   YALPS    │ 20.67 │   1    │   3.28   │
│ jsLPSolver │ 33.22 │  4.81  │   5.27   │
└────────────┴───────┴────────┴──────────┘

SCRS8: 490 constraints, 1169 variables, 0 integers:
┌────────────┬────────┬────────┬──────────┐
│  (index)   │  mean  │ stdDev │ slowdown │
├────────────┼────────┼────────┼──────────┤
│  glpk.js   │  18.1  │  1.54  │    1     │
│   YALPS    │  56.8  │  1.08  │   3.14   │
│ jsLPSolver │ 101.08 │  3.67  │   5.59   │
└────────────┴────────┴────────┴──────────┘

SCTAP2: 1090 constraints, 1880 variables, 0 integers:
┌────────────┬───────┬────────┬──────────┐
│  (index)   │ mean  │ stdDev │ slowdown │
├────────────┼───────┼────────┼──────────┤
│  glpk.js   │ 19.87 │  1.82  │    1     │
│   YALPS    │ 49.98 │  2.39  │   2.51   │
│ jsLPSolver │ 102.8 │ 12.74  │   5.17   │
└────────────┴───────┴────────┴──────────┘

SHIP08S: 778 constraints, 2387 variables, 0 integers:
┌────────────┬───────┬────────┬──────────┐
│  (index)   │ mean  │ stdDev │ slowdown │
├────────────┼───────┼────────┼──────────┤
│  glpk.js   │ 13.51 │  0.53  │    1     │
│   YALPS    │ 17.86 │  1.75  │   1.32   │
│ jsLPSolver │ 65.88 │ 10.59  │   4.88   │
└────────────┴───────┴────────┴──────────┘
</pre>

(More integer benchmarks are intended to be added at some point.)

The code used for these benchmarks is available under `benchmarks/`.
Measuring performance isn't always straightforward, so take these synthetic benchmarks with a grain of salt.
It is always recommended to benchmark for your use case.
Then again, if your problems are typically of small size, then this solver should have no issue (and may be faster)!
