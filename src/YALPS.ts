import heap from "heap"

/** Specifies the bounds for the total of a value. */
export interface Constraint {
  /**
   * The total should be equal to this number.
   * In the case that `min` or `max` are also defined,
   * this is used instead.
   */
  readonly equal?: number

  /**
   * The total should be greater than or equal to this number.
   * Can be specified alongside `max`.
   */
  readonly min?: number

  /**
   * The total should be less than or equal to this number.
   * Can be specified alongside `min`.
   */
  readonly max?: number
}

/**
 * The coefficients of a variable represented as either an object or an `Iterable<[ConstraintKey, number]>`.
 * `ConstraintKey` should extend `string` if this is an object.
 * If it is an `Iterable` and has duplicate keys, then the last entry is used for each set of duplicate keys.
 */
export type Coefficients<ConstraintKey = string> =
  | Iterable<readonly [constraint: ConstraintKey, coef: number]>
  | (ConstraintKey extends string
      ? { readonly [constraint in ConstraintKey]?: number }
      : never)

/**
 * The model representing an LP problem.
 * `constraints`, `variables`, and each variable's `Coefficients` in `variables` can be either an object or an `Iterable`.
 * The model is treated as readonly (recursively) by the solver, so nothing on it is mutated.
 *
 * @typeparam `VariableKey` - the type of the key used to distinguish variables.
 * It should extend `string` if `variables` is an object (`VariableKey` is `string` by default).
 * In the case `variables` is an `Iterable`, duplicate keys are not ignored.
 * The order of variables is preserved in the solution, but variables with a value of `0` are not included in the solution.
 * As such, it may be hard to tell what the corresponding variable is for a duplicate key in the solution.
 *
 * @typeparam `ConstraintKey` - the type of the key used to distinguish constraints,
 * the objective, and the coefficients on each variable.
 * It should extend `string` if `constraints` or any variable's `Coefficients`
 * is an object (`ConstraintKey` is `string` by default).
 * In the case `constraints` is an `Iterable`, duplicate keys are not ignored.
 * Rather, the bounds on the constraints are merged to become the most restrictive.
 * However, for duplicate keys in the `Coefficients` of each variable, the last entry is used.
 */
export interface Model<VariableKey = string, ConstraintKey = string> {
  /**
   * Indicates whether to `"maximize"` or `"minimize"` the objective.
   * Defaults to `"maximize"` if left blank.
   */
  readonly direction?: "maximize" | "minimize"

  /**
  * The name of the value to optimize. Can be omitted,
  * in which case the solver gives some solution (if any) that satisfies the constraints.
  * @example
  * Note that constraints can be placed upon the objective itself. Maximize up to a certain point:
  * ```
  * {
  *   direction: "maximize",
  *   objective: "obj",
  *   constraints: { obj: { max: 100 } },
  *   variables: [ ... ]
  * }
  * ```
  */
  readonly objective?: ConstraintKey

  /**
   * An object or an `Iterable<[ConstraintKey, Constraint]>` representing the constraints of the problem.
   * @see `Constraint` for valid bounds.
   * @example
   * Constraints as an object:
   * ```
   * const constraints = {
   *   a: { max: 7 },
   *   b: { equal: 22 },
   *   c: { max: 5 }
   * }
   * ```
   * @example
   * Constraints as an `Iterable`:
   * ```
   * type ConstraintKey = string // can be whatever you like
   * const constraints = new Map<ConstraintKey, Constraint>()
   * constraints.set("a", { max: 7 })
   * constraints.set("b", { equal: 22 })
   * constraints.set("c", { max: 5 })
   * ```
   */
  readonly constraints:
    | Iterable<readonly [key: ConstraintKey, constraint: Constraint]>
    | (ConstraintKey extends string
        ? { readonly [constraint in ConstraintKey]: Constraint }
        : never)

  /**
   * An object or `Iterable<[VariableKey, Coefficients<ConstraintKey>]>` representing the variables of the problem.
   * @example
   * Variables as an object:
   * ```
   * const variables = {
   *   x: { a: 2, b: 11 },
   *   y: { a: 3, c: 22 }
   * }
   * ```
   * @exmaple
   * Variables as an `Iterable`:
   * ```
   * type VariableKey = string // can be whatever you like
   * type ConstraintKey = string // same here
   * const variables = new Map<VariableKey, Coefficients<ConstraintKey>>()
   * variables.set("x", { a: 2, b: 11 })
   * variables.set("y", { a: 3, c: 22 })
   * ```
   * @example
   * Mixing objects and `Iterable`s:
   * ```
   * type ConstraintKey = string
   * const yCoef = new Map<ConstraintKey, number>()
   * yCoef.set("a", 3)
   * yCoef.set("c", 22)
   * const variables = {
   *   x: { a: 2, b: 11 },
   *   y: yCoef
   * }
   * ```
   */
  readonly variables:
    | Iterable<readonly [key: VariableKey, variable: Coefficients<ConstraintKey>]>
    | (VariableKey extends string
        ? { readonly [variable in VariableKey]: Coefficients<ConstraintKey> }
        : never)

  /**
   * An `Iterable` of variable keys that indicates these variables are integer.
   * It can also be a `boolean`, indicating whether all variables are integer or not.
   * All variables are treated as not integer if this is left blank.
   */
  readonly integers?: boolean | Iterable<VariableKey>

   /**
    * An `Iterable` of variable keys that indicates these variables are binary
    * (can only be 0 or 1 in the solution).
    * It can also be a `boolean`, indicating whether all variables are binary or not.
    * All variables are treated as not binary if this is left blank.
    */
  readonly binaries?: boolean | Iterable<VariableKey>
}

/**
 * This indicates what type of solution, if any, the solver was able to find.
 * @see `status` on `Solution` for detailed information.
 */
export type SolutionStatus =
  | "optimal"
  | "infeasible"
  | "unbounded"
  | "timedout"
  | "cycled"

/**
 * The solution object returned by the solver.
 * It includes a status, the final objective result, and the variable amounts.
 */
export type Solution<VariableKey = string> = {
  /**
   * `status` indicates what type of solution, if any, the solver was able to find.
   *
   * `"optimal"` indicates everything went ok, and the solver found an optimal solution.
   *
   * `"infeasible"` indicates that the problem has no possible solutions.
   * `result` will be `NaN` in this case.
   *
   * `"unbounded"` indicates a variable, or combination of variables, are not sufficiently constrained.
   * As such, the `result` of the solution will be +-`Infinity`.
   * `variables` in the solution might contain a variable,
   * in which case it is the variable that the solver happened to finish on.
   * This may be the unbounded variable or one of the combination of variables that are unbounded.
   *
   * `"timedout"` indicates that the solver exited early for an integer problem.
   * This may happen if the solver takes too long and exceeds the `timeout` option.
   * Similarly, the number of branch and cut iterations may exceeed `maxIterations` as set in the options.
   * In both of these cases, the current sub-optimal solution/result, if any, is returned.
   * If `result` is `NaN`, then this means no integer solutions were found before the solver timed out.
   *
   * `"cycled"` indicates that the simplex method cycled and exited.
   * This case is rare, but `checkCycles` can be set to `true` in the options to check for it.
   * Otherwise, if `maxPivots` (as set in the options) is reached by the simplex method,
   * then it is assumed that a cycle was encountered.
   * `result` will be `NaN` in this case.
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
export interface Options {
  /**
   * Numbers equal to or less than the provided precision are treated as zero.
   * Similarly, the precision determines whether a number is sufficiently integer.
   * The default value is `1E-8`.
  */
  readonly precision?: number

  /**
   * In rare cases, the solver can cycle.
   * This is usually the case when the number of pivots exceeds `maxPivots`.
   * Alternatively, setting this to `true` will cause
   * the solver to explicitly check for cycles.
   * (The solution will have the `"cycled"` status if a cycle is detected.)
   * The default value is `false`.
   */
  readonly checkCycles?: boolean

  /**
   * This determines the maximum number of pivots allowed within the simplex method.
   * If this is exceeded, then it assumed that the simplex method cycled,
   * and the returned solution will have the `"cycled"` status.
   * If your problem is *very* large, you *may* have to set this option higher.
   * The default value is `4096`.
   */
  readonly maxPivots?: number

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
  readonly tolerance?: number

  /**
   * This setting applies to integer problems only.
   * It specifies, in milliseconds, the maximum amount of time
   * the main branch and cut portion of the solver may take before timing out.
   * In the case the solver does time out,
   * the returned solution will have the `"timedout"` status.
   * The current sub-optimal solution, if any, is returned as well in this case.
   * The default value is `Infinity` (no timeout).
   */
  readonly timeout?: number

  /**
   * This setting applies to integer problems only.
   * It determines the maximum number of iterations
   * for the main branch and cut algorithm.
   * It can be used alongside or instead of `timeout`
   * to prevent the algorithm from taking too long.
   * The default value is `4096`.
   */
  readonly maxIterations?: number
}

// Actual code starts here.

/**
 * Returns a `Constraint` that specifies something should be less than or equal to `value`.
 * Equivalent to `{ max: value }`.
 */
export const lessEq = (value: number): Constraint => ({ max: value })

/**
 * Returns a `Constraint` that specifies something should be greater than or equal to `value`.
 * Equivalent to `{ min: value }`.
 */
export const greaterEq = (value: number): Constraint => ({ min: value })

/**
 * Returns a `Constraint` that specifies something should be exactly equal to `value`.
 * Equivalent to `{ equal: value }`.
 */
export const equalTo = (value: number): Constraint => ({ equal: value })

/**
 * Returns a `Constraint` that specifies something should be between `lower` and `upper` (inclusive).
 * Equivalent to `{ min: lower, max: upper }`.
 */
export const inRange = (lower: number, upper: number): Constraint => ({
  max: upper,
  min: lower
})

// The tableau representing the problem.
// matrix is a 2D matrix (duh) represented as a 1D array.
// The first row, 0, is the objective row.
// The first column, 0, is the RHS column.
// Positions are numbered starting at the first column and ending at the last row.
// Thus, the position of the variable in the first row is width.
type Tableau = {
  readonly matrix: Float64Array
  readonly width: number
  readonly height: number
  readonly positionOfVariable: Int32Array
  readonly variableAtPosition: Int32Array
}

/** Intended to be called internally. It gives the element at the row and col of the tableau. */
export const index = (tableau: Tableau, row: number, col: number) =>
  tableau.matrix[row * tableau.width + col]

/** Intended to be called internally. It overwrites the element at the row and col of the tableau. */
export const update = (tableau: Tableau, row: number, col: number, value: number) => {
  tableau.matrix[row * tableau.width + col] = value
}

type Variables<VarKey, ConKey> = readonly (readonly [key: VarKey, coefs: Coefficients<ConKey>])[]

// A tableau with some additional context.
type TableauModel<VariableKey, ConstraintKey> = {
  readonly tableau: Tableau
  readonly sign: number
  readonly variables: Variables<VariableKey, ConstraintKey>
  readonly integers: readonly number[]
}

const convertToIterable = <K, V>(
  msg: string,
  seq:
    | Iterable<readonly [K, V]>
    | (K extends string ? { readonly [key in K]?: V } : never)
) => {
  if (seq == null) throw `${msg} was null or undefined.`
  if (typeof (seq as any)[Symbol.iterator] === "function") return seq as Iterable<readonly [K, V]>
  if (typeof seq === "object") return Object.entries(seq) as Iterable<readonly [K, V]>
  throw `${msg} was not an object or iterable.`
}

const convertToSet = <T>(set: boolean | Iterable<T> | undefined): true | Set<T> =>
  set === true ? true
  : set === false ? new Set()
  : set instanceof Set ? set
  : new Set(set)

/** Intended to be called internally. It constructs a Tableau from a `Model`. */
export const tableauModel = <VarKey = string, ConKey = string>(model: Model<VarKey, ConKey>): TableauModel<VarKey, ConKey> => {
  if (model.variables == null) throw "variables was null or undefined."
  if (model.constraints == null) throw "constraints was null or undefined."

  const sign =
    model.direction === "maximize" || model.direction == null ? 1
    : model.direction === "minimize" ? -1
    : 0
  if (sign === 0) throw `'${model.direction}' is not a valid optimization direction. Should be 'maximize', 'minimize', or left blank.`

  const variables: Variables<VarKey, ConKey> | null =
    Array.isArray(model.variables) ? model.variables
    : typeof (model.variables as any)[Symbol.iterator] === "function" ? Array.from(model.variables as any)
    : typeof model.variables === "object" ? Object.entries(model.variables) as any
    : null
  if (variables === null) throw "variables was not an object or iterable."

  const binaryConstraintCol = []
  const intVars = []
  if (model.integers || model.binaries) {
    const binaryVariables = convertToSet(model.binaries)
    const integerVariables = binaryVariables === true ? true : convertToSet(model.integers)
    for (let i = 1; i <= variables.length; i++) {
      const [key, ] = variables[i - 1]
      if (binaryVariables === true || binaryVariables.has(key)) {
        binaryConstraintCol.push(i)
        intVars.push(i)
      } else if (integerVariables === true || integerVariables.has(key)) {
        intVars.push(i)
      }
    }
  }

  const constraints = new Map<ConKey, { row: number, lower: number, upper: number }>()
  for (const [key, constraint] of convertToIterable("constraints", model.constraints)) {
    const bounds = constraints.get(key) ?? { row: NaN, lower: -Infinity, upper: Infinity }
    bounds.lower = Math.max(bounds.lower, constraint.equal ?? constraint.min ?? -Infinity)
    bounds.upper = Math.min(bounds.upper, constraint.equal ?? constraint.max ?? Infinity)
    //if (rows.lower > rows.upper) return ["infeasible", NaN]
    if (!constraints.has(key)) constraints.set(key, bounds)
  }

  let numConstraints = 1
  for (const constraint of constraints.values()) {
    constraint.row = numConstraints
    numConstraints +=
      (Number.isFinite(constraint.lower) ? 1 : 0)
      + (Number.isFinite(constraint.upper) ? 1 : 0)
  }
  const width = variables.length + 1
  const height = numConstraints + binaryConstraintCol.length
  const numVars = width + height
  const tableau = {
    matrix: new Float64Array(width * height),
    width: width,
    height: height,
    positionOfVariable: new Int32Array(numVars),
    variableAtPosition: new Int32Array(numVars)
  }

  for (let i = 0; i < numVars; i++) {
    tableau.positionOfVariable[i] = i
    tableau.variableAtPosition[i] = i
  }

  const hasObjective = "objective" in model
  for (let c = 1; c < width; c++) {
    for (const [constraint, coef] of convertToIterable("A variable", variables[c - 1][1])) {
      if (hasObjective && constraint === model.objective) {
        update(tableau, 0, c, sign * coef)
      }
      const bounds = constraints.get(constraint)
      if (bounds != null) {
        if (Number.isFinite(bounds.upper)) {
          update(tableau, bounds.row, c, coef)
          if (Number.isFinite(bounds.lower)) {
            update(tableau, bounds.row + 1, c, -coef)
          }
        } else if (Number.isFinite(bounds.lower)) {
          update(tableau, bounds.row, c, -coef)
        }
      }
    }
  }

  for (const bounds of constraints.values()) {
    if (Number.isFinite(bounds.upper)) {
      update(tableau, bounds.row, 0, bounds.upper)
      if (Number.isFinite(bounds.lower)) {
        update(tableau, bounds.row + 1, 0, -bounds.lower)
      }
    } else if (Number.isFinite(bounds.lower)) {
      update(tableau, bounds.row, 0, -bounds.lower)
    }
  }

  for (let b = 0; b < binaryConstraintCol.length; b++) {
    const row = numConstraints + b
    update(tableau, row, 0, 1)
    update(tableau, row, binaryConstraintCol[b], 1)
  }

  return {
    tableau: tableau,
    sign: sign,
    variables: variables,
    integers: intVars
  }
}

const pivot = (tableau: Tableau, row: number, col: number) => {
  const quotient = index(tableau, row, col)
  const leaving = tableau.variableAtPosition[tableau.width + row]
  const entering = tableau.variableAtPosition[col]
  tableau.variableAtPosition[tableau.width + row] = entering
  tableau.variableAtPosition[col] = leaving
  tableau.positionOfVariable[leaving] = col
  tableau.positionOfVariable[entering] = tableau.width + row

  const nonZeroColumns = []
  // (1 / quotient) * R_pivot -> R_pivot
  for (let c = 0; c < tableau.width; c++) {
    const value = index(tableau, row, c)
    if (Math.abs(value) > 1E-16) {
      update(tableau, row, c, value / quotient)
      nonZeroColumns.push(c)
    } else {
      update(tableau, row, c, 0)
    }
  }
  update(tableau, row, col, 1 / quotient)

  // -M[r, col] * R_pivot + R_r -> R_r
  for (let r = 0; r < tableau.height; r++) {
    if (r === row) continue
    const coef = index(tableau, r, col)
    if (Math.abs(coef) > 1E-16) {
      for (let i = 0; i < nonZeroColumns.length; i++) {
        const c = nonZeroColumns[i]
        update(tableau, r, c, index(tableau, r, c) - coef * index(tableau, row, c));
      }
      update(tableau, r, col, -coef / quotient)
    }
  }
}

// Checks if the simplex method has encountered a cycle.
const hasCycle = (
  history: (readonly [row: number, col: number])[],
  tableau: Tableau,
  row: number,
  col: number
) => {
  // This seems somewhat inefficient,
  // but there was little or no noticable impact in most benchmarks.
  history.push([tableau.variableAtPosition[tableau.width + row], tableau.variableAtPosition[col]])
  for (let length = 1; length <= Math.floor(history.length / 2); length++) {
    let cycle = true
    for (let i = 0; i < length; i++) {
      const item = history.length - 1 - i
      const [row1, col1] = history[item]
      const [row2, col2] = history[item - length]
      if (row1 !== row2 || col1 !== col2) {
        cycle = false
        break
      }
    }
    if (cycle) return true
  }
  return false
}

const roundToPrecision = (num: number, precision: number) => {
  const rounding = Math.round(1 / precision)
  return Math.round((num + Number.EPSILON) * rounding) / rounding
}

// Finds the optimal solution given some basic feasible solution.
const phase2 = (tableau: Tableau, options: Required<Options>): [SolutionStatus, number] => {
  const pivotHistory: (readonly [number, number])[] = []
  const precision = options.precision
  for (let iter = 0; iter < options.maxPivots; iter++) {
    // Find the entering column/variable
    let col = 0
    let value = precision
    for (let c = 1; c < tableau.width; c++) {
      const reducedCost = index(tableau, 0, c)
      if (reducedCost > value) {
        value = reducedCost
        col = c
      }
    }
    if (col === 0) return ["optimal", roundToPrecision(index(tableau, 0, 0), precision)]

    // Find the leaving row/variable
    let row = 0
    let minRatio = Infinity
    for (let r = 1; r < tableau.height; r++) {
      const value = index(tableau, r, col)
      if (Math.abs(value) <= precision) continue

      const rhs = index(tableau, r, 0)
      if (Math.abs(rhs) <= precision && value > 0) {
        row = r
        break
      }

      const ratio = rhs / value
      if (precision < ratio && ratio < minRatio) {
        minRatio = ratio
        row = r
      }
    }
    if (row === 0) return ["unbounded", col]

    if (options.checkCycles && hasCycle(pivotHistory, tableau, row, col)) return ["cycled", NaN]

    pivot(tableau, row, col)
  }
  return ["cycled", NaN]
}

// Transforms a tableau into a basic feasible solution.
const phase1 = (tableau: Tableau, options: Required<Options>): [SolutionStatus, number] => {
  const pivotHistory: (readonly [number, number])[] = []
  const precision = options.precision
  for (let iter = 0; iter < options.maxPivots; iter++) {
    // Find the leaving row/variable
    let row = 0
    let rhs = -precision
    for (let r = 1; r < tableau.height; r++) {
      const value = index(tableau, r, 0)
      if (value < rhs) {
        rhs = value
        row = r
      }
    }
    if (row === 0) return phase2(tableau, options)

    // Find the entering column/variable
    let col = 0
    let maxRatio = -Infinity
    for (let c = 1; c < tableau.width; c++) {
      const coefficient = index(tableau, row, c)
      if (coefficient < -precision) {
        const ratio = -index(tableau, 0, c) / coefficient
        if (ratio > maxRatio) {
          maxRatio = ratio
          col = c
        }
      }
    }
    if (col === 0) return ["infeasible", NaN]

    if (options.checkCycles && hasCycle(pivotHistory, tableau, row, col)) return ["cycled", NaN]

    pivot(tableau, row, col)
  }
  return ["cycled", NaN]
}

// Creates a solution object representing the optimal solution (if any).
const solution = <VarKey, ConKey>(
  tabmod: TableauModel<VarKey, ConKey>,
  status: SolutionStatus,
  result: number,
  precision: number
): Solution<VarKey> => {
  if (status === "optimal" || (status === "timedout" && !Number.isNaN(result))) {
    const variables: [VarKey, number][] = []
    for (let i = 0; i < tabmod.variables.length; i++) {
      const row = tabmod.tableau.positionOfVariable[i + 1] - tabmod.tableau.width
      if (row < 0) continue // variable is not in the solution
      const value = index(tabmod.tableau, row, 0)
      if (value > precision) {
        variables.push([tabmod.variables[i][0], roundToPrecision(value, precision)])
      }
    }
    return {
      status: status,
      result: -tabmod.sign * result,
      variables: variables
    }
  } else if (status === "unbounded") {
    const variable = tabmod.tableau.variableAtPosition[result] - 1
    return {
      status: "unbounded",
      result: tabmod.sign * Infinity,
      variables:
        0 <= variable && variable < tabmod.variables.length
        ? [[tabmod.variables[variable][0], Infinity]]
        : []
    }
  } else {
    // infeasible | cycled | (timedout and result is NaN)
    return {
      status: status,
      result: NaN,
      variables: []
    }
  }
}

type Buffer = {
  readonly matrix: Float64Array,
  readonly positionOfVariable: Int32Array,
  readonly variableAtPosition: Int32Array
}

const buffer = (matrixLength: number, posVarLength: number): Buffer => ({
  matrix: new Float64Array(matrixLength),
  positionOfVariable: new Int32Array(posVarLength),
  variableAtPosition: new Int32Array(posVarLength)
})

type Cut = readonly [sign: number, variable: number, value: number]
type Branch = readonly [eval: number, cuts: readonly Cut[]]

// Creates a new tableau with additional cut constraints from a buffer.
const applyCuts = (
  tableau: Tableau,
  { matrix, positionOfVariable, variableAtPosition }: Buffer,
  cuts: readonly Cut[]
) => {
  matrix.set(tableau.matrix)
  for (let i = 0; i < cuts.length; i++) {
    const [sign, variable, value] = cuts[i]
    const r = (tableau.height + i) * tableau.width
    const pos = tableau.positionOfVariable[variable]
    if (pos < tableau.width) {
      matrix[r] = sign * value
      matrix.fill(0, r + 1, r + tableau.width)
      matrix[r + pos] = sign
    } else {
      const row = (pos - tableau.width) * tableau.width
      matrix[r] = sign * (value - matrix[row])
      for (let c = 1; c < tableau.width; c++) {
        matrix[r + c] = -sign * matrix[row + c]
      }
    }
  }

  positionOfVariable.set(tableau.positionOfVariable)
  variableAtPosition.set(tableau.variableAtPosition)
  const length = tableau.width + tableau.height + cuts.length
  for (let i = tableau.width + tableau.height; i < length; i++) {
    positionOfVariable[i] = i
    variableAtPosition[i] = i
  }

  return {
    matrix: matrix.subarray(0, tableau.matrix.length + tableau.width * cuts.length),
    width: tableau.width,
    height: tableau.height + cuts.length,
    positionOfVariable: positionOfVariable.subarray(0, length),
    variableAtPosition: variableAtPosition.subarray(0, length)
  }
}

// Finds the integer variable with the most fractional value.
const mostFractionalVar = (
  tableau: Tableau,
  intVars: readonly number[]
): [variable: number, value: number, frac: number] => {
  let highestFrac = 0
  let variable = 0
  let value = 0
  for (let i = 0; i < intVars.length; i++) {
    const intVar = intVars[i]
    const row = tableau.positionOfVariable[intVar] - tableau.width
    if (row < 0) continue
    const val = index(tableau, row, 0)
    const frac = Math.abs(val - Math.round(val))
    if (frac > highestFrac) {
      highestFrac = frac
      variable = intVar
      value = val
    }
  }
  return [variable, value, highestFrac]
}

// Runs the branch and cut algorithm to solve an integer problem.
// Requires the non-integer solution as input.
const branchAndCut = <VarKey, ConKey>(
  tabmod: TableauModel<VarKey, ConKey>,
  initResult: number,
  options: Required<Options>
): Solution<VarKey> => {
  const [initVariable, initValue, initFrac] = mostFractionalVar(tabmod.tableau, tabmod.integers)
  if (initFrac <= options.precision) {
    // Wow, the initial solution is integer
    return solution(tabmod, "optimal", initResult, options.precision)
  }

  const branches = new heap<Branch>((x, y) => x[0] - y[0])
  branches.push([initResult, [[-1, initVariable, Math.ceil(initValue)]]])
  branches.push([initResult, [[1, initVariable, Math.floor(initValue)]]])

  // Set aside arrays/buffers to be reused over the course of the algorithm.
  // One set of buffers stores the state of the currrent best solution.
  // The other is used to solve the current candidate solution.
  // The two buffers are "swapped" once a new best solution is found.
  const maxExtraRows = tabmod.integers.length * 2
  const matrixLength = tabmod.tableau.matrix.length + maxExtraRows * tabmod.tableau.width
  const posVarLength = tabmod.tableau.positionOfVariable.length + maxExtraRows
  const bufferA = buffer(matrixLength, posVarLength)
  const bufferB = buffer(matrixLength, posVarLength)
  let currentBuffer = true

  const optimalThreshold = initResult * (1 - tabmod.sign * options.tolerance)
  const timeout = options.timeout + Date.now()
  let timedout = Date.now() >= timeout // in case options.timeout <= 0
  let bestStatus: SolutionStatus = "infeasible"
  let bestEval = Infinity
  let bestTableau = tabmod.tableau
  let iter = 0

  while (
    iter < options.maxIterations
    && !branches.empty()
    && bestEval >= optimalThreshold
    && !timedout
  ) {
    const [relaxedEval, cuts] = branches.pop() as Branch
    if (relaxedEval > bestEval) break // the remaining branches are worse than the current best solution

    const tableau = applyCuts(tabmod.tableau, currentBuffer ? bufferA : bufferB, cuts)
    const [status, result] = phase1(tableau, options)
    // The initial tableau is not unbounded and adding more cuts/constraints cannot make it become unbounded
    // assert(status !== "unbounded")
    if (status === "optimal" && result < bestEval) {
      const [variable, value, frac] = mostFractionalVar(tableau, tabmod.integers)
      if (frac <= options.precision) {
        // The solution is integer
        bestStatus = "optimal"
        bestEval = result
        bestTableau = tableau
        currentBuffer = !currentBuffer
      } else {
        const cutsUpper: Cut[] = []
        const cutsLower: Cut[] = []
        for (let i = 0; i < cuts.length; i++) {
          const cut = cuts[i]
          const [dir, v, ] = cut
          if (v === variable) {
            dir < 0 ? cutsLower.push(cut) : cutsUpper.push(cut)
          } else {
            cutsUpper.push(cut)
            cutsLower.push(cut)
          }
        }
        cutsLower.push([1, variable, Math.floor(value)])
        cutsUpper.push([-1, variable, Math.ceil(value)])
        branches.push([result, cutsUpper])
        branches.push([result, cutsLower])
      }
    }
    // Otherwise, this branch's result is worse than the current best solution.
    // This could be because result is NaN (this branch is infeasible or cycled).
    // Either way, skip this branch and see if any other branches have a valid, better solution.
    timedout = Date.now() >= timeout
    iter++
  }

  // Did the solver "timeout"?
  const unfinished =
    !branches.empty()
    && bestEval < optimalThreshold
    && (timedout || iter === options.maxIterations)

  return solution(
    { ...tabmod, tableau: bestTableau },
    unfinished ? "timedout" : bestStatus,
    bestStatus === "infeasible" ? NaN : bestEval,
    options.precision
  )
}

/** Applies the default values for each option if the option is not specified. */
export const applyDefaultOptions = (options?: Options): Required<Options> => ({
  precision: options?.precision ?? 1E-08,
  checkCycles: options?.checkCycles ?? false,
  maxPivots: options?.maxPivots ?? 4096,
  tolerance: options?.tolerance ?? 0,
  timeout: options?.timeout ?? Infinity,
  maxIterations: options?.maxIterations ?? 4096
})

/**
 * Runs the solver on the given model and using the given options (if any).
 * @see `Model` on how to specify/create the model.
 * @see `Solution` and `SolutionStatus` as well for more detailed information on what is returned.
 */
export const solve = <VarKey = string, ConKey = string>(
  model: Model<VarKey, ConKey>,
  options?: Options
): Solution<VarKey> => {
  if (model == null) throw "model was null or undefined."

  const tabmod = tableauModel(model)
  const opt = applyDefaultOptions(options)
  const [status, result] = phase1(tabmod.tableau, opt)
  return (
    // Non-integer problem, return the simplex result.
    tabmod.integers.length === 0 ? solution(tabmod, status, result, opt.precision)

    // Integer problem, run branchAndCut using the valid simplex result.
    : status === "optimal" ? branchAndCut(tabmod, result, opt)

    // The problem has integer variables, but the initial solution is either:
    // 1) unbounded | infeasible => all branches will also be unbounded | infeasible
    // 2) cycled => cannot get an initial solution, return invalid solution
    : solution(tabmod, status, result, opt.precision)
  )
}
