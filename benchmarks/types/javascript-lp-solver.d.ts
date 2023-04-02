declare module "javascript-lp-solver" {
// The typescript declaration file is not included in the package even though it exists, nice job
// https://github.com/JWally/jsLPSolver/blob/master/types/main.d.ts

/**
 * Specifies how to constrain a variable in the model.
 */
export type IModelVariableConstraint = {
  /** The variable should be grater or equal to this value. */
  min?: number;
  /** The variable should be less or equal to this value. */
  max?: number;
  /** The variable should be equal to this value. */
  equal?: number;
}

/**
* Specifies the options when solving the problem.
*/
export type IModelOptions = {
  /**
   * For MILP problems, specifies the relative tolerance of the objective,
   * where `0` means 0% and `1` means 100%.
   */
  tolerance?: number;
  /**
   * How many milliseconds you want to allow for the solver to try
   * and solve the model you're running.
   */
  timeout?: number;
  /**
   * Use MIR cuts.
   * @deprecated NOT WORKING
   */
  useMIRCuts?: boolean;
  /**
   * Defaults to `true`.
   */
  exitOnCycles?: boolean;
}

/**
* Represents an LP/MILP problem.
* @typeparam TSolutionVar the decision variables that will be outputed to the `Solution` object.
* @typeparam TInternalVar the decision variables that will not be outputed to the `Solution` object.
*/
export type IModel<TSolutionVar extends string = string, TInternalVar extends string = string> = {
  /** Name of the variable that will be the optimization objective. */
  optimize?: (TSolutionVar | TInternalVar);
  /** To which direction to optimize the objective. */
  opType?: "max" | "min";
  /**
   * Optimization constraints.
   * Specify an object with variable name as keys.
  */
  constraints: { [variable in (TSolutionVar | TInternalVar)]?: IModelVariableConstraint };
  /**
   * Variable identity relations.
   * Specify an object with variable name as keys. These variables will be outputted into solution.
   * The values of the object represents a linear combination of all the (rest of) variables.
   * @example
   *      ```
   *      {
   *          x: { x1: 10, x2: 5, x3: 2, x: 1 }       // x = 10 x1 + 5 x2 + 2 x3
   *      }
   *      ```
   */
  variables: { [variable in TSolutionVar]?: { [variable in (TSolutionVar | TInternalVar)]?: number } };
  /**
   * For each variable in the MILP problem, specifies whether it is an integer variable.
   * You need to specify `true` or `1` for integer variable.
   * If not specified, all the variables are continual non-negative (range `[0,+∞)`).
   */
  ints?: { [variable in (TSolutionVar | TInternalVar)]?: boolean | 0 | 1 };
  /**
   * For each variable in the MILP problem, specifies whether it is a binary variable.
   * You need to specify `true` or `1` for binary variable.
   * If not specified, all the variables are continual non-negative (range `[0,+∞)`).
   */
  binaries?: { [variable in (TSolutionVar | TInternalVar)]?: boolean | 0 | 1 };
  /**
   * For each variable in the MILP problem, specifies whether it is an unrestricted variable (range `(-∞,+∞)`).
   * You need to specify `true` or `1` for unrestricted variable.
   * If not specified, all the variables are continual non-negative (range `[0,+∞)`).
   */
  unrestricted?: { [variable in (TSolutionVar | TInternalVar)]?: boolean | 0 | 1 };
  /**
   * Options for solving this problem.
   */
  options?: IModelOptions;
}

/**
* Represents the solution status of an LP/MILP problem.
*/
export type ISolutionStatus = {
  /** Whether the problem is feasible. */
  feasible: boolean;
  /** Value pf the objective function. */
  result: number;
  /** Whether the decision variables are bounded. */
  bounded?: boolean;
  /** For MILP problem, whether an integral solution has been reached. */
  isIntegral?: boolean;
}

/**
* Represents a LP/MILP solution with its status.
* @remarks If a variable has value `0`, it will be neglected from the output.
*/
export type Solution<TSolutionVar extends string = string> = ISolutionStatus & { [variable in TSolutionVar]?: number };

/**
* Solves an LP/MILP problem.
* @param model The model we want solver to operate on.
* @param precision If we're solving a MILP, how tight
*      do we want to define an integer, given
*      that `20.000000000000001` is not an integer.
*      (defaults to `1e-9`)
* @param full *get better description*
* @param validate if left blank, it will get ignored; otherwise
*      it will run the model through all validation
*      functions in the *Validate* module
*/
export function Solve<TSolutionVar extends string, TInternalVar extends string>(
  model: IModel<TSolutionVar, TInternalVar>, precision?: number,
  full?: boolean, validate?: unknown): Solution<TSolutionVar>;
}
