# YALPS ![](https://badgen.net/npm/v/yalps) ![](https://badgen.net/npm/license/yalps)

## What is This (For)?

This is **Yet Another Linear Programming Solver (YALPS)**.
It is intended as a performant, lightweight linear programming (LP) solver geared towards small and medium LP problems.
It can solve non-integer, integer, and mixed integer LP problems.
While webassembly ports of existing solvers perform well, they tend to have larger bundle sizes and may be overkill for your use case.
YALPS is the alternative for the browser featuring a small [bundle size](https://bundlephobia.com/package/yalps).

YALPS is a rewrite of [jsLPSolver](https://www.npmjs.com/package/javascript-lp-solver).
The people there have made a great and easy to use solver. However, the API was limited to objects only, and I saw other areas that could have been improved.
You can check out [jsLPSolver](https://www.npmjs.com/package/javascript-lp-solver) for more background and information regarding LP problems.

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
import { Model, Constraint, Coefficients, Options, Solution } from "yalps"
```

## Examples

Using objects:
```typescript
const model: Model = {
    direction: "maximize",
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
    integers: [ "table", "dresser" ] // these variables must have an integer value in the solution
}

const solution = solve(model)
// { status: "optimal", result: 14400, variables: [ ["table", 8], ["dresser", 3] ] }
```

Iterables and objects can be mixed and matched for the `constraints` and `variables` fields.
Additionally, each variable's coefficients can be an object or an iterable. E.g.:
```typescript
const constraints =
    new Map<string, Constraint>()
        .set("wood", { max: 300 })
        .set("labor", lessEq(110))
        .set("storage", lessEq(400))

const dresser = // this is intended to be created programatically
    new Map<string, number>()
        .set("wood", 20)
        .set("labor", 10)
        .set("profit", 1600)
        .set("storage", 50)

const model: Model<string, string> = {
    direction: "maximize",
    objective: "profit",
    constraints: constraints, // is an iterable
    variables: { // kept as an object
        table: { wood: 30, labor: 5, profit: 1200, storage: 30 }, // an object
        dresser: dresser // an iterable
    },
    integers: true // all variables are indicated as integer
}

const solution: Solution<string> = solve(model)
// { status: "optimal", result: 14400, variables: [ ["table", 8], ["dresser", 3] ] }
```

## API

This is a stripped down version `YALPS.d.ts`.
Use the JSDoc annotations / hover information in your editor for more extensive documentation.
```typescript
interface Constraint {
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

interface Model<VariableKey = string, ConstraintKey = string> {
    direction?: OptimizationDirection // defaults to `"maximize"` if left blank
    objective?: ConstraintKey // the value to optimize

    constraints:
        | Iterable<[ConstraintKey, Constraint]>
        | (ConstraintKey extends string ? { [key in ConstraintKey]: Constraint } : never)

    variables:
        | Iterable<[VariableKey, Coefficients<ConstraintKey>]>
        | (VariableKey extends string ? { [key in VariableKey]: Coefficients<ConstraintKey> } : never)

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

interface Options {
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

While YALPS generally performs better than javascript-lp-solver, this solver is still geared towards small-ish problems. For example, the solver keeps the full representation of the matrix in memory as an array. I.e., there are currently no sparse matrix optimizations. As a general rule, the number of variables and constraints should probably be a few thousand or less, and the number of integer variables should be a few hundred at the most. If your use case has large-ish problems, it is recommended that you first benchmark and test the solver on your own before committing to using it. For very large and/or integral problems, a more professional solver is recommended, e.g. [glpk.js](https://www.npmjs.com/package/glpk.js).

Nevertheless, below are the results from some benchmarks comparing YALPS to other solvers (all times are in milliseconds).
The benchmarks were run on ts-node v10.9.1 and node v19.7.0.

## YALPS vs jsLPSolver
<pre>
Large Farm MIP.json: 35 constraints, 100 variables, 100 integers:
YALPS is 37.37% faster on average compared to jsLPSolver (t=35.24).
┌────────────┬────┬───────┬────────┐
│  (index)   │ n  │ mean  │ stdErr │
├────────────┼────┼───────┼────────┤
│   YALPS    │ 30 │ 35.83 │  0.33  │
│ jsLPSolver │ 30 │ 57.22 │  0.51  │
└────────────┴────┴───────┴────────┘

Monster 2.json: 888 constraints, 924 variables, 112 integers:
YALPS is 68.54% faster on average compared to jsLPSolver (t=81.82).
┌────────────┬────┬────────┬────────┐
│  (index)   │ n  │  mean  │ stdErr │
├────────────┼────┼────────┼────────┤
│   YALPS    │ 30 │ 55.37  │  0.65  │
│ jsLPSolver │ 30 │ 175.98 │  1.32  │
└────────────┴────┴────────┴────────┘

Monster Problem.json: 600 constraints, 552 variables, 0 integers:
YALPS is 73.55% faster on average compared to jsLPSolver (t=14.57).
┌────────────┬────┬──────┬────────┐
│  (index)   │ n  │ mean │ stdErr │
├────────────┼────┼──────┼────────┤
│   YALPS    │ 30 │ 1.61 │  0.17  │
│ jsLPSolver │ 30 │ 6.09 │  0.26  │
└────────────┴────┴──────┴────────┘

Sudoku 4x4.json: 64 constraints, 64 variables, 64 integers:
YALPS is 27.42% faster on average compared to jsLPSolver (t=4.41).
┌────────────┬────┬──────┬────────┐
│  (index)   │ n  │ mean │ stdErr │
├────────────┼────┼──────┼────────┤
│   YALPS    │ 37 │ 1.23 │  0.01  │
│ jsLPSolver │ 37 │ 1.7  │  0.1   │
└────────────┴────┴──────┴────────┘

Vendor Selection.json: 1641 constraints, 1640 variables, 40 integers:
YALPS is 6.94% faster on average compared to jsLPSolver (t=17.70).
┌────────────┬────┬────────┬────────┐
│  (index)   │ n  │  mean  │ stdErr │
├────────────┼────┼────────┼────────┤
│   YALPS    │ 30 │ 350.51 │  0.61  │
│ jsLPSolver │ 30 │ 376.65 │  1.34  │
└────────────┴────┴────────┴────────┘
</pre>
## YALPS vs glpk.js
<pre>
Large Farm MIP.json: 35 constraints, 100 variables, 100 integers:
glpk.js is 71.72% faster on average compared to YALPS (t=65.31).
┌─────────┬────┬───────┬────────┐
│ (index) │ n  │ mean  │ stdErr │
├─────────┼────┼───────┼────────┤
│  YALPS  │ 30 │ 35.79 │  0.38  │
│ glpk.js │ 30 │ 10.12 │  0.09  │
└─────────┴────┴───────┴────────┘

Monster 2.json: 888 constraints, 924 variables, 112 integers:
YALPS is 65.70% faster on average compared to glpk.js (t=63.94).
┌─────────┬────┬────────┬────────┐
│ (index) │ n  │  mean  │ stdErr │
├─────────┼────┼────────┼────────┤
│  YALPS  │ 30 │ 64.71  │  1.92  │
│ glpk.js │ 30 │ 188.65 │  0.28  │
└─────────┴────┴────────┴────────┘

Monster Problem.json: 600 constraints, 552 variables, 0 integers:
YALPS is 76.62% faster on average compared to glpk.js (t=40.67).
┌─────────┬────┬──────┬────────┐
│ (index) │ n  │ mean │ stdErr │
├─────────┼────┼──────┼────────┤
│  YALPS  │ 30 │ 1.46 │  0.08  │
│ glpk.js │ 30 │ 6.26 │  0.09  │
└─────────┴────┴──────┴────────┘

Sudoku 4x4.json: 64 constraints, 64 variables, 64 integers:
glpk.js is 55.50% faster on average compared to YALPS (t=25.51).
┌─────────┬────┬──────┬────────┐
│ (index) │ n  │ mean │ stdErr │
├─────────┼────┼──────┼────────┤
│  YALPS  │ 30 │ 1.29 │  0.01  │
│ glpk.js │ 30 │ 0.57 │  0.03  │
└─────────┴────┴──────┴────────┘

Vendor Selection.json: 1641 constraints, 1640 variables, 40 integers:
glpk.js is 67.99% faster on average compared to YALPS (t=356.17).
┌─────────┬────┬────────┬────────┐
│ (index) │ n  │  mean  │ stdErr │
├─────────┼────┼────────┼────────┤
│  YALPS  │ 30 │ 345.96 │  0.65  │
│ glpk.js │ 30 │ 110.75 │  0.14  │
└─────────┴────┴────────┴────────┘
</pre>
The code used for these benchmarks is available under `tests/Bechmark.ts`. Measuring performance isn't always straightforward, so take these synthetic benchmarks with a grain of salt. It is always recommended to benchmark for your use case. Then again, if your problems are typically of small or medium size, then this solver should have no issue (and may be much faster!).
