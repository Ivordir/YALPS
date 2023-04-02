import { Options, Solution } from "../../src/index.js"
import { TestCase } from "./read.js"

const maxDiff = 1e-5

const relativeDifferenceFrom = (delta: number, expected: number, precision: number) =>
  (delta - precision) / Math.max(Math.abs(expected), 1.0)

const relativeDifference = (result: number, expected: number, precision: number) =>
  relativeDifferenceFrom(Math.abs(result - expected), expected, precision)

// prettier-ignore
export const resultIsOptimal = (result: number, expected: number, options: Required<Options>) =>
  Number.isNaN(expected) ? Number.isNaN(result)
  : !Number.isFinite(expected) ? expected === result
  : Number.isFinite(result) && relativeDifference(result, expected, options.precision) <= Math.max(options.tolerance, maxDiff)

export const valueSums = (solution: Readonly<Solution>, model: TestCase["model"]) => {
  const variables = new Map(model.variables)
  const sums = new Map<string, number>()
  for (const [key, num] of solution.variables) {
    for (const [constraint, coef] of variables.get(key)!) {
      sums.set(constraint, num * coef + (sums.get(constraint) ?? 0.0))
    }
  }
  return sums
}

export const constraintsAreSatisfied = (solution: Readonly<Solution>, model: TestCase["model"], precision: number) => {
  const sums: ReadonlyMap<string, number> = valueSums(solution, model)
  for (const [key, { equal, min, max }] of model.constraints) {
    const sum = sums.get(key) ?? 0.0
    if (equal != null) {
      if (relativeDifference(sum, equal, precision) > maxDiff) return false
    } else {
      if (min != null && relativeDifferenceFrom(min - sum, min, precision) > maxDiff) return false
      if (max != null && relativeDifferenceFrom(sum - max, max, precision) > maxDiff) return false
    }
  }
  return true
}

export const variablesHaveValidValues = (
  solution: Readonly<Solution>,
  { integers, binaries }: TestCase["model"],
  precision: number
) =>
  solution.variables.every(
    ([variable, n]) =>
      n >= -precision &&
      (!(integers.has(variable) || binaries.has(variable)) || Math.abs(n - Math.round(n)) <= precision) &&
      (!binaries.has(variable) || n <= 1 + precision)
  )

export const validSolution = (
  solution: Readonly<Solution>,
  expected: number,
  model: TestCase["model"],
  options: Required<Options>
) =>
  resultIsOptimal(solution.result, expected, options) &&
  variablesHaveValidValues(solution, model, options.precision) &&
  (!Number.isFinite(expected) || constraintsAreSatisfied(solution, model, options.precision))

const validTimeout = (solution: Readonly<Solution>) => solution.status === "timedout" && Number.isNaN(solution.result)

export const validSolutionAndStatus = (
  solution: Readonly<Solution>,
  expected: Readonly<Solution>,
  model: TestCase["model"],
  options: Required<Options>
) =>
  solution.status === expected.status &&
  (validTimeout(solution) || validSolution(solution, expected.result, model, options))
