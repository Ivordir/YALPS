import { Model, Options, SolutionStatus, Solution } from "./types.js"
import { index, tableauModel, TableauModel } from "./tableau.js"
import { roundToPrecision } from "./util.js"
import { simplex } from "./simplex.js"
import { branchAndCut } from "./branchAndCut.js"

// Creates a solution object representing the optimal solution (if any).
const solution = <VarKey, ConKey>(
  { tableau, sign, variables: vars }: TableauModel<VarKey, ConKey>,
  status: SolutionStatus,
  result: number,
  { precision, includeZeroVariables }: Required<Options>,
): Solution<VarKey> => {
  if (status === "optimal" || (status === "timedout" && !Number.isNaN(result))) {
    const variables: [VarKey, number][] = []
    for (let i = 0; i < vars.length; i++) {
      const [variable] = vars[i]
      const row = tableau.positionOfVariable[i + 1] - tableau.width
      const value = row >= 0 ? index(tableau, row, 0) : 0.0
      if (value > precision) {
        variables.push([variable, roundToPrecision(value, precision)])
      } else if (includeZeroVariables) {
        variables.push([variable, 0.0])
      }
    }
    return {
      status,
      result: -sign * result,
      variables,
    }
  } else if (status === "unbounded") {
    const variable = tableau.variableAtPosition[result] - 1
    return {
      status: "unbounded",
      result: sign * Infinity,
      // prettier-ignore
      variables:
        (0 <= variable && variable < vars.length)
          ? [[vars[variable][0], Infinity]]
          : [],
    }
  } else {
    // infeasible | cycled | (timedout and result is NaN)
    return {
      status,
      result: NaN,
      variables: [],
    }
  }
}

const defaultOptionValues: Required<Options> = {
  precision: 1e-8,
  checkCycles: false,
  maxPivots: 8192,
  tolerance: 0,
  timeout: Infinity,
  maxIterations: 32768,
  includeZeroVariables: false,
}

/**
 * The default options used by the solver.
 */
export const defaultOptions: Required<Options> = { ...defaultOptionValues }

/**
 * Runs the solver on the given model and using the given options (if any).
 * @see `Model` on how to specify/create the model.
 * @see `Options` for the kinds of options available.
 * @see `Solution` for more detailed information on what is returned.
 */
export const solve = <VarKey = string, ConKey = string>(
  model: Model<VarKey, ConKey>,
  options?: Options,
): Solution<VarKey> => {
  const tabmod = tableauModel(model)
  const opt = { ...defaultOptionValues, ...options }
  const [status, result] = simplex(tabmod.tableau, opt)

  if (tabmod.integers.length === 0 || status !== "optimal") {
    // If a non-integer problem, return the simplex result.
    // Otherwise, the problem has integer variables, but the initial solution is either:
    // 1) unbounded | infeasible => all branches will also be unbounded | infeasible
    // 2) cycled => cannot get an initial solution, return invalid solution
    return solution(tabmod, status, result, opt)
  } else {
    // Integer problem and an optimal non-integer solution was found
    const [intTabmod, intStatus, intResult] = branchAndCut(tabmod, result, opt)
    return solution(intTabmod, intStatus, intResult, opt)
  }
}
