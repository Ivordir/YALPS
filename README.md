# What is this?
This is **Yet Another Linear Programming Solver (YALPS)**. It is intended as a performant, lightweight linear programming (LP) solver geared towards medium and small LP problems. It can solve non-integer, integer, and mixed integer LP problems. The outputed JS has only ~500 lines and is ~20kB in size (not minified).

YALPS is a rewrite of [jsLPSolver](https://www.npmjs.com/package/javascript-lp-solver). The people there have made a great and easy to use solver. However, the API was limited to objects only, and I saw other areas that could have been improved. You can check out [jsLPSolver](https://www.npmjs.com/package/javascript-lp-solver) for more background and information regarding LP problems.

Compared to jsLPSolver, YALPS has the following differences:
- More flexible API (e.g., support for Iterables alongside objects)
- Better performance (especially for non-integer problems, see [Performance](#Performance) for more details.)
- Good Typescript support (YALPS is written in Typescript)

On the other hand, these features from jsLPSolver were dropped:
- Unrestricted variables (*might* be added later)
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

Types, as necessary:
```typescript
import { Model, Constraint, Coefficients, Options, Solution } from "yalps"
```

Alternate helper functions:
```typescript
import { lessEq, equalTo, greaterEq, inRange } from "yalps"
```

## Examples

Using objects:
```typescript
const model: Model = {
    direction: "maximize",
    objective: "profit",
    constraints: { // each key is the constraint's name, the value is its bounds
        wood: { max: 300 },
        labor: { max: 110 }, // labor should be <= 110
        storage: lessEq(400) // you can use the helper functions instead
    },
    variables: { // each key is the variable's name, the value is its coefficients
        table: { wood: 30, labor: 5, proft: 1200, storage: 30 },
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
const constraints = new Map<string, Constraint>()
constraints.set("wood", { max: 300 })
constraints.set("labor", lessEq(110))
constraints.set("storage", lessEq(400))
const dresser = new Map<string, number>()
dresser.set("wood", 20) // this is intended to be created programatically
dresser.set("labor", 10)
dresser.set("profit", 1600)
dresser.set("storage", 50)
const model: Model<string, string> = {
    direction: "maximize",
    objective: "profit",
    constraints: constraints, // is an iterable
    variables: { // kept as an object
        table: { wood: 30, labor: 5, proft: 1200, storage: 30 }, // an object
        dresser: dresser // an iterable
    },
    integers: true // all variables are indicated as integer
}
const solution: Solution<string> = solve(model)
// { status: "optimal", result: 14400, variables: [ ["table", 8], ["dresser", 3] ] }
```

Using iterables allows the keys for `constraints` and `variables` to be something besides string.
Equality between keys is tested using `===`, `Map.get`, and `Set.has` (all essentially use strict equality).

## API
This is `dist/YALPS.d.ts` but with the essential parts picked out.
See `dist/YALPS.d.ts` for more extensive documentation if necessary.
```typescript
interface Constraint {
    equal?: number
    min?: number
    max?: number
}

/**
 * Specifies something should be less than or equal to `value`.
 * Equivalent to `{ max: value }`.
 */
const lessEq: (value: number) => Constraint

/**
 * Specifies something should be greater than or equal to `value`.
 * Equivalent to `{ min: value }`.
 */
const greaterEq: (value: number) => Constraint

/**
 * Specifies something should be exactly equal to `value`.
 * Equivalent to `{ equal: value }`.
 */
const equalTo: (value: number) => Constraint

/**
 * Specifies something should be between `lower` and `upper` (inclusive).
 * Equivalent to `{ min: lower, max: upper }`.
 */
const inRange: (lower: number, upper: number) => Constraint

/**
 * The coefficients of a variable represented as either an object or an `Iterable`.
 * `ConstraintKey` should extend `string` if this is an object.
 * If it is an `Iterable` and has duplicate keys,
 * then the last entry is used for each set of duplicate keys.
 */
type Coefficients<ConstraintKey = string> =
    | Iterable<[constraint: ConstraintKey, coef: number]> // an iterable
    | (ConstraintKey extends string // or an object, but ConstraintKey must extend string
        ? { [constraint in ConstraintKey]?: number }
        : never)

/**
 * The model representing a LP problem.
 * `constraints`, `variables`, and each variable's `Coefficients` in `variables`
 * can be either an object or an `Iterable`.
 * If there are objects present, their corresponding type parameter(s) for the keys must extend string.
 * The model is treated as readonly (recursively) by the solver.
 */
interface Model<VariableKey = string, ConstraintKey = string> {
    /**
     * Indicates whether to `"maximize"` or `"minimize"` the objective.
     * Defaults to `"maximize"` if left blank.
     */
    direction?: "maximize" | "minimize"

    /**
     * The name of the value to optimize. Can be omitted,
     * in which case the solver gives some solution (if any) that satisfies the constraints.
     */
    objective?: ConstraintKey

    /**
     * An object or an `Iterable` representing the constraints of the problem.
     * In the case `constraints` is an `Iterable`, duplicate keys are not ignored.
     * Rather, the bounds on the constraints are merged to become the most restrictive.
     */
    constraints:
        | Iterable<[key: ConstraintKey, constraint: Constraint]>
        | (ConstraintKey extends string
            ? { [constraint in ConstraintKey]: Constraint }
            : never)

    /**
     * An object or `Iterable` representing the variables of the problem.
     * In the case `variables` is an `Iterable`, duplicate keys are not ignored.
     * The order of variables is preserved in the solution,
     * but variables with a value of `0` are not included in the solution.
     */
    variables:
        | Iterable<[key: VariableKey, variable: Coefficients<ConstraintKey>]>
        | (VariableKey extends string
            ? { [variable in VariableKey]: Coefficients<ConstraintKey> }
            : never)

    /**
     * An `Iterable` of variable keys that indicates these variables are integer.
     * It can also be a `boolean`, indicating whether all variables are integer or not.
     * All variables are treated as not integer if this is left blank.
     */
    integers?: boolean | Iterable<VariableKey>

    /**
     * An `Iterable` of variable keys that indicates these variables are binary
     * (can only be 0 or 1 in the solution).
     * It can also be a `boolean`, indicating whether all variables are binary or not.
     * All variables are treated as not binary if this is left blank.
     */
    binaries?: boolean | Iterable<VariableKey>
}

type SolutionStatus = "optimal" | "infeasible" | "unbounded" | "timedout" | "cycled"

/** The solution object returned by the solver. */
type Solution<VariableKey = string> = {
    /**
     * `status` indicates what type of solution, if any, the solver was able to find.
     *
     * `"optimal"` indicates everything went ok, and the solver found an optimal solution.
     *
     * `"infeasible"` indicates that the problem has no possible solutions.
     *
     * `"unbounded"` indicates a variable, or combination of variables, are not sufficiently constrained.
     *
     * `"timedout"` indicates that the solver exited early for an integer problem
     * (either due to `timeout` or `maxIterations` in the options).
     *
     * `"cycled"` indicates that the simplex method cycled, and the solver exited as a result (this is rare).
     */
    status: SolutionStatus

    /**
     * The final, maximized or minimized value of the objective.
     * It may be `NaN` in the case that `status` is `"infeasible"`, `"cycled"`, or `"timedout"`.
     * It may also be +-`Infinity` in the case that `status` is `"unbounded"`.
     */
    result: number

    /**
     * An array of variables and their coefficients that add up to `result`
     * while satisfying the constraints of the problem.
     * Variables with a coefficient of `0` are not included in this.
     * In the case that `status` is `"unbounded"`,
     * `variables` may contain one variable which is (one of) the unbounded variable(s).
     */
    variables: [VariableKey, number][]
}

/** An object specifying the options for the solver. */
interface Options {
    /**
     * Numbers equal to or less than precision are treated as zero.
     * Similarly, the precision determines whether a number is sufficiently integer.
     * The default value is `1E-8`.
    */
    precision?: number

    /**
     * In rare cases, the solver can cycle.
     * This is usually the case when the number of pivots exceeds `maxPivots`.
     * Alternatively, setting this to `true` will cause
     * the solver to explicitly check for cycles.
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
     * This setting applies to integer problems only.
     * If an integer solution is found within `(1 +- tolerance) *
     * {the problem's non-integer solution}`,
     * then this approximate integer solution is returned.
     * This is helpful for large integer problems where
     * the most optimal solution becomes harder to find,
     * but other solutions that are relatively close to
     * the optimal one may be much easier to find.
     * The default value is `0` (only find the most optimal solution).
     */
    tolerance?: number

    /**
     * This setting applies to integer problems only.
     * It specifies, in milliseconds, the maximum amount of time the solver may take.
     * The current sub-optimal solution, if any, is returned in the case of a timeout.
     * The default value is `Infinity` (no timeout).
     */
    timeout?: number

    /**
     * This setting applies to integer problems only.
     * It determines the maximum number of iterations
     * for the main branch and cut algorithm.
     * It can be used alongside or instead of `timeout`
     * to prevent the algorithm from taking too long.
     * The default value is `32768`.
     */
    maxIterations?: number
}

/**
 * The default options used by the solver.
 * You may change these so that you do not have to
 * pass a custom `Options` object every time you call `solve`.
 */
let defaultOptions: Options

/** Runs the solver on the given model and using the given options (if any). */
const solve: <VarKey = string, ConKey = string>(model: Model<VarKey, ConKey>, options?: Options) => Solution<VarKey>
```

# Performance
While YALPS generally performs better than javascript-lp-solver, this solver is still geared towards small-ish problems. For example, the solver keeps the full representation of the matrix in memory as an array. I.e., there are currently no sparse matrix optimizations. As a general rule, the number of variables and constraints should probably be a few thousand or less, and the number of integer variables should be a few hundred at the most. If your use case has large-ish problems, it is recommended that you first benchmark and test the solver on your own before committing to using it. For very large and/or integral problems, a more professional solver is recommended, e.g. [glpk.js](https://www.npmjs.com/package/glpk.js).

Nevertheless, here are the results from some benchmarks of medium/large problems comparing YALPS to other solvers (all times are in milliseconds):

## YALPS vs jsLPSolver
```
Large Farm MIP.json: 35 constraints, 100 variables, 100 integers:
t=5.65, jsLPSolver took 59.04% more time on average compared to YALPS
jsLPSolver: (n=10, mean=67.77, stdErr=3.81)
YALPS: (n=10, mean=42.61, stdErr=2.30)

Monster 2.json: 888 constraints, 924 variables, 112 integers:
t=14.19, jsLPSolver took 150.36% more time on average compared to YALPS
jsLPSolver: (n=5, mean=196.74, stdErr=3.02)
YALPS: (n=5, mean=78.58, stdErr=7.76)

Monster Problem.json: 600 constraints, 552 variables, 0 integers:
t=8.74, jsLPSolver took 208.00% more time on average compared to YALPS
jsLPSolver: (n=6, mean=6.31, stdErr=0.46)
YALPS: (n=6, mean=2.05, stdErr=0.16)

Sudoku 4x4.json: 64 constraints, 64 variables, 64 integers:
t=4.46, jsLPSolver took 126.71% more time on average compared to YALPS
jsLPSolver: (n=32, mean=3.86, stdErr=0.47)
YALPS: (n=32, mean=1.70, stdErr=0.10)

Vendor Selection.json: 1641 constraints, 1640 variables, 40 integers:
t=11.01, jsLPSolver took 25.55% more time on average compared to YALPS
jsLPSolver: (n=5, mean=522.75, stdErr=7.20)
YALPS: (n=5, mean=416.37, stdErr=6.44)
```

## YALPS vs glpk.js
```
Large Farm MIP.json: 35 constraints, 100 variables, 100 integers:
t=-8.58, GLPK took -73.82% more time on average compared to YALPS
GLPK: (n=7, mean=11.76, stdErr=0.42)
YALPS: (n=7, mean=44.91, stdErr=3.84)

Monster 2.json: 888 constraints, 924 variables, 112 integers:
t=18.41, GLPK took 187.38% more time on average compared to YALPS
GLPK: (n=4, mean=217.21, stdErr=5.25)
YALPS: (n=4, mean=75.58, stdErr=5.62)

Monster Problem.json: 600 constraints, 552 variables, 0 integers:
t=7.49, GLPK took 249.37% more time on average compared to YALPS
GLPK: (n=6, mean=9.08, stdErr=0.70)
YALPS: (n=6, mean=2.60, stdErr=0.51)

Sudoku 4x4.json: 64 constraints, 64 variables, 64 integers:
t=-19.27, GLPK took -56.64% more time on average compared to YALPS
GLPK: (n=4, mean=0.69, stdErr=0.05)
YALPS: (n=4, mean=1.59, stdErr=0.01)

Vendor Selection.json: 1641 constraints, 1640 variables, 40 integers:
t=-26.49, GLPK took -70.50% more time on average compared to YALPS
GLPK: (n=4, mean=127.70, stdErr=2.64)
YALPS: (n=4, mean=432.85, stdErr=11.22)
```

The code used for these benchmarks is available under `tests/Bechmark.ts`. Measuring performance isn't always straightforward, so take these synthetic benchmarks with a grain of salt. It is always recommended to benchmark for your use case. Then again, if your problems are typically of small or medium size, then this solver should have no issue (and may be much faster!).
