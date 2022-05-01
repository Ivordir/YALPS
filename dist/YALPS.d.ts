/** Specifies the bounds for the total of a value. */
export interface Constraint {
    /**
     * The total should be equal to this number.
     * In the case that `min` or `max` are also defined,
     * this is used instead.
     */
    readonly equal?: number;
    /**
     * The total should be greater than or equal to this number.
     * Can be specified alongside `max`.
     */
    readonly min?: number;
    /**
     * The total should be less than or equal to this number.
     * Can be specified alongside `min`.
     */
    readonly max?: number;
}
/**
 * The coefficients of a variable represented as either an object or an `Iterable<[ConstraintKey, number]>`.
 * `ConstraintKey` should extend `string` if this is an object.
 * If it is an `Iterable` and has duplicate keys, then the last entry is used for each set of duplicate keys.
 */
export declare type Coefficients<ConstraintKey = string> = Iterable<readonly [constraint: ConstraintKey, coef: number]> | (ConstraintKey extends string ? {
    readonly [constraint in ConstraintKey]?: number;
} : never);
/**
 * The model representing a LP problem.
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
    readonly direction?: "maximize" | "minimize";
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
    readonly objective?: ConstraintKey;
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
    readonly constraints: Iterable<readonly [key: ConstraintKey, constraint: Constraint]> | (ConstraintKey extends string ? {
        readonly [constraint in ConstraintKey]: Constraint;
    } : never);
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
     * @example
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
    readonly variables: Iterable<readonly [key: VariableKey, variable: Coefficients<ConstraintKey>]> | (VariableKey extends string ? {
        readonly [variable in VariableKey]: Coefficients<ConstraintKey>;
    } : never);
    /**
     * An `Iterable` of variable keys that indicates these variables are integer.
     * It can also be a `boolean`, indicating whether all variables are integer or not.
     * All variables are treated as not integer if this is left blank.
     */
    readonly integers?: boolean | Iterable<VariableKey>;
    /**
     * An `Iterable` of variable keys that indicates these variables are binary
     * (can only be 0 or 1 in the solution).
     * It can also be a `boolean`, indicating whether all variables are binary or not.
     * All variables are treated as not binary if this is left blank.
     */
    readonly binaries?: boolean | Iterable<VariableKey>;
}
/**
 * This indicates what type of solution, if any, the solver was able to find.
 * @see `status` on `Solution` for detailed information.
 */
export declare type SolutionStatus = "optimal" | "infeasible" | "unbounded" | "timedout" | "cycled";
/**
 * The solution object returned by the solver.
 * It includes a status, the final objective result, and the variable amounts.
 */
export declare type Solution<VariableKey = string> = {
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
    status: SolutionStatus;
    /**
     * The final, maximized or minimized value of the objective.
     * It may be `NaN` in the case that `status` is `"infeasible"`, `"cycled"`, or `"timedout"`.
     * It may also be +-`Infinity` in the case that `status` is `"unbounded"`.
     */
    result: number;
    /**
     * An array of variables and their coefficients that add up to `result`
     * while satisfying the constraints of the problem.
     * Variables with a coefficient of `0` are not included in this.
     * In the case that `status` is `"unbounded"`,
     * `variables` may contain one variable which is (one of) the unbounded variable(s).
     */
    variables: [VariableKey, number][];
};
/** An object specifying the options for the solver. */
export interface Options {
    /**
     * Numbers equal to or less than the provided precision are treated as zero.
     * Similarly, the precision determines whether a number is sufficiently integer.
     * The default value is `1E-8`.
    */
    readonly precision?: number;
    /**
     * In rare cases, the solver can cycle.
     * This is usually the case when the number of pivots exceeds `maxPivots`.
     * Alternatively, setting this to `true` will cause
     * the solver to explicitly check for cycles.
     * (The solution will have the `"cycled"` status if a cycle is detected.)
     * The default value is `false`.
     */
    readonly checkCycles?: boolean;
    /**
     * This determines the maximum number of pivots allowed within the simplex method.
     * If this is exceeded, then it assumed that the simplex method cycled,
     * and the returned solution will have the `"cycled"` status.
     * If your problem is *very* large, you *may* have to set this option higher.
     * The default value is `8192`.
     */
    readonly maxPivots?: number;
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
    readonly tolerance?: number;
    /**
     * This setting applies to integer problems only.
     * It specifies, in milliseconds, the maximum amount of time
     * the main branch and cut portion of the solver may take before timing out.
     * In the case the solver does time out,
     * the returned solution will have the `"timedout"` status.
     * The current sub-optimal solution, if any, is returned as well in this case.
     * The default value is `Infinity` (no timeout).
     */
    readonly timeout?: number;
    /**
     * This setting applies to integer problems only.
     * It determines the maximum number of iterations
     * for the main branch and cut algorithm.
     * It can be used alongside or instead of `timeout`
     * to prevent the algorithm from taking too long.
     * The default value is `32768`.
     */
    readonly maxIterations?: number;
}
/**
 * Returns a `Constraint` that specifies something should be less than or equal to `value`.
 * Equivalent to `{ max: value }`.
 */
export declare const lessEq: (value: number) => Constraint;
/**
 * Returns a `Constraint` that specifies something should be greater than or equal to `value`.
 * Equivalent to `{ min: value }`.
 */
export declare const greaterEq: (value: number) => Constraint;
/**
 * Returns a `Constraint` that specifies something should be exactly equal to `value`.
 * Equivalent to `{ equal: value }`.
 */
export declare const equalTo: (value: number) => Constraint;
/**
 * Returns a `Constraint` that specifies something should be between `lower` and `upper` (inclusive).
 * Equivalent to `{ min: lower, max: upper }`.
 */
export declare const inRange: (lower: number, upper: number) => Constraint;
declare type Tableau = {
    readonly matrix: Float64Array;
    readonly width: number;
    readonly height: number;
    readonly positionOfVariable: Int32Array;
    readonly variableAtPosition: Int32Array;
};
/** Intended to be called internally. It gives the element at the row and col of the tableau. */
export declare const index: (tableau: Tableau, row: number, col: number) => number;
/** Intended to be called internally. It overwrites the element at the row and col of the tableau. */
export declare const update: (tableau: Tableau, row: number, col: number, value: number) => void;
declare type Variables<VarKey, ConKey> = readonly (readonly [key: VarKey, coefs: Coefficients<ConKey>])[];
declare type TableauModel<VariableKey, ConstraintKey> = {
    readonly tableau: Tableau;
    readonly sign: number;
    readonly variables: Variables<VariableKey, ConstraintKey>;
    readonly integers: readonly number[];
};
/** Intended to be called internally. It constructs a Tableau from a `Model`. */
export declare const tableauModel: <VarKey = string, ConKey = string>(model: Model<VarKey, ConKey>) => TableauModel<VarKey, ConKey>;
/**
 * The initial, default options for the solver.
 * Can be used to reset `defaultOptions`.
 * Do not try to mutate this object - it is frozen.
*/
export declare const backupDefaultOptions: Required<Options>;
/**
 * The default options used by the solver.
 * You may change these so that you do not have to
 * pass a custom `Options` object every time you call `solve`.
 */
export declare let defaultOptions: {
    precision: number;
    checkCycles: boolean;
    maxPivots: number;
    tolerance: number;
    timeout: number;
    maxIterations: number;
};
/**
 * Runs the solver on the given model and using the given options (if any).
 * @see `Model` on how to specify/create the model.
 * @see `Options` for the kinds of options available.
 * @see `Solution` as well for more detailed information on what is returned.
 */
export declare const solve: <VarKey = string, ConKey = string>(model: Model<VarKey, ConKey>, options?: Options | undefined) => Solution<VarKey>;
export {};
