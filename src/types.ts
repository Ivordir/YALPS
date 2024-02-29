/** Specifies the bounds for the total of a value. */
export type Constraint = {
  /**
   * The total should be equal to this number.
   * In the case that `min` or `max` are also defined, this is used instead.
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
 * The coefficients of a variable represented as either an object or an `Iterable`.
 * `ConstraintKey` should extend `string` if this is an object.
 * If this is an `Iterable` and has duplicate keys, then the last entry is used for each set of duplicate keys.
 */
export type Coefficients<ConstraintKey = string> =
  | Iterable<readonly [ConstraintKey, number]>
  | ([ConstraintKey] extends [string] ? { readonly [key in ConstraintKey]?: number } : never)

/**
 * Indicates whether to maximize or minimize the objective.
 */
export type OptimizationDirection = "maximize" | "minimize"

/**
 * The model representing a LP problem.
 * `constraints`, `variables`, and each variable's `Coefficients` can be either an object or an `Iterable`.
 * The model is treated as readonly (recursively) by the solver, so nothing on it is mutated.
 *
 * @typeparam `VariableKey` - the type of the key used to distinguish variables.
 * It should extend `string` if `variables` is an object.
 *
 * @typeparam `ConstraintKey` - the type of the key used to distinguish constraints,
 * the objective, and the coefficients on each variable.
 * It should extend `string` if `constraints` or any variable's `Coefficients` is an object.
 */
export type Model<VariableKey = string, ConstraintKey = string> = {
  /**
   * Indicates whether to `"maximize"` or `"minimize"` the objective.
   * Defaults to `"maximize"` if left blank.
   */
  readonly direction?: OptimizationDirection

  /**
   * The key of the value to optimize. Can be omitted,
   * in which case the solver gives some solution (if any) that satisfies the constraints.
   * @example
   * Note that constraints can be placed upon the objective itself.
   * Maximize up to a certain point:
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
   * An object or `Iterable` representing the constraints of the problem.
   * In the case `constraints` is an `Iterable`, duplicate keys are not ignored.
   * Rather, the bounds on the constraints are merged to become the most restrictive.
   * @see `Constraint`
   * @example
   * Constraints as an object:
   * ```
   * const constraints = {
   *   a: { max: 7 },
   *   b: { equal: 22 },
   *   c: { min: 5 }
   * }
   * ```
   * @example
   * Constraints as an `Iterable`:
   * ```
   * const constraints =
   *   new Map<string, Constraint>()
   *     .set("a", { max: 7 })
   *     .set("b", { equal: 22 })
   *     .set("c", { min: 5 })
   * ```
   */
  readonly constraints:
    | Iterable<readonly [ConstraintKey, Constraint]>
    | ([ConstraintKey] extends [string] ? { readonly [key in ConstraintKey]?: Constraint } : never)

  /**
   * An object or `Iterable` representing the variables of the problem.
   * In the case `variables` is an `Iterable`, duplicate keys are not ignored.
   * The order of variables is preserved in the solution,
   * but variables that end up having a value of `0` are not included in the solution by default.
   * @example
   * Variables as an object:
   * ```
   * const variables = {
   *   x: { a: 2, b: 11 },
   *   y: { a: 3, c: 22 }
   * }
   * ```
   * @example
   * Variables as an `Iterable`:
   * ```
   * const variables =
   *   new Map<string, Coefficients>()
   *     .set("x", { a: 2, b: 11 })
   *     .set("y", { a: 3, c: 22 })
   * ```
   * @example
   * Mixing objects and `Iterable`s:
   * ```
   * const variables = {
   *   x: { a: 2, b: 11 },
   *   y: [["a", 3], ["c", 22]]
   * }
   * ```
   */
  readonly variables:
    | Iterable<readonly [VariableKey, Coefficients<ConstraintKey>]>
    | ([VariableKey] extends [string] ? { readonly [key in VariableKey]?: Coefficients<ConstraintKey> } : never)

  /**
   * An `Iterable` of variable keys that indicate the corresponding variables are integer.
   * It can also be a `boolean`, indicating whether all variables are integer or not.
   * If this is left blank, then all variables are treated as not integer.
   */
  readonly integers?: boolean | Iterable<VariableKey>

  /**
   * An `Iterable` of variable keys that indicate the corresponding variables are binary
   * (can only be 0 or 1 in the solution).
   * It can also be a `boolean`, indicating whether all variables are binary or not.
   * If this is left blank, then all variables are treated as not binary.
   */
  readonly binaries?: boolean | Iterable<VariableKey>
}

/**
 * This indicates what type of solution, if any, the solver was able to find.
 * @see `status` on `Solution` for detailed information.
 */
export type SolutionStatus = "optimal" | "infeasible" | "unbounded" | "timedout" | "cycled"

/**
 * The solution object returned by the solver.
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
   * in which case it is the unbounded variable that the solver happened to finish on.
   *
   * `"timedout"` indicates that the solver exited early for an integer problem.
   * This may happen if the solver takes too long and exceeds the `timeout` option.
   * This may also happen if the number of branch and cut iterations exceeds the `maxIterations` option.
   * In both of these cases, the current sub-optimal solution, if any, is returned.
   * If `result` is `NaN`, then this means no integer solutions were found before the solver timed out.
   *
   * `"cycled"` indicates that the simplex method cycled and exited.
   * This case is rare, but `checkCycles` can be set to `true` in the options to check for cycles and stop early if one is found.
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
   * An array of variables and their coefficients that add up to `result` while satisfying the constraints of the problem.
   * Variables with a coefficient of `0` are not included in this by default.
   * In the case that `status` is `"unbounded"`, `variables` may consist of one variable which is (one of) the unbounded variable(s).
   */
  variables: [VariableKey, number][]
}

/** An object specifying the options for the solver. */
export type Options = {
  /**
   * Numbers with magnitude equal to or less than the provided precision are treated as zero.
   * Similarly, the precision determines whether a number is sufficiently integer.
   * The default value is `1e-8`.
   */
  readonly precision?: number

  /**
   * In rare cases, the solver can cycle.
   * This is assumed to be the case when the number of pivots exceeds `maxPivots`.
   * Setting this to `true` will cause the solver to explicitly check for cycles and stop early if one is found.
   * Note that checking for cycles may incur a small performance overhead.
   * The default value is `false`.
   */
  readonly checkCycles?: boolean

  /**
   * This determines the maximum number of pivots allowed within the simplex method.
   * If this is exceeded, then it assumed that the simplex method cycled,
   * and the returned solution will have the `"cycled"` status.
   * If your problem is very large, you may have to set this option higher.
   * The default value is `8192`.
   */
  readonly maxPivots?: number

  /**
   * This option applies to integer problems only.
   * If an integer solution is found within
   * `(1 +- tolerance) * {the problem's non-integer solution}`,
   * then this approximate integer solution is returned.
   * For example, a tolerance of `0.05` will return the first integer solution found within 5% of the non-integer solution.
   * This option is helpful for large integer problems where the most optimal solution becomes harder to find,
   * but approximate or near-optimal solutions may be much easier to find.
   * The default value is `0` (only find the most optimal solution).
   */
  readonly tolerance?: number

  /**
   * This option applies to integer problems only.
   * It specifies, in milliseconds, the maximum amount of time
   * the main branch and cut portion of the solver may take before timing out.
   * If a time out occurs, the returned solution will have the `"timedout"` status.
   * Also, if any sub-optimal solution was found before the time out, then it is returned as well.
   * The default value is `Infinity` (no timeout).
   */
  readonly timeout?: number

  /**
   * This option applies to integer problems only.
   * It determines the maximum number of iterations for the main branch and cut algorithm.
   * It can be used alongside or instead of `timeout` to prevent the solver from taking too long.
   * The default value is `32768`.
   */
  readonly maxIterations?: number

  /**
   * Controls whether variables that end up having a value of `0`
   * should be included in `variables` in the resulting `Solution`.
   * The default value is `false`.
   */
  readonly includeZeroVariables?: boolean
}
