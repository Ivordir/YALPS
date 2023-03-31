import { Solution, solve } from "../src/index.js"
import { TestCase, testCases } from "./helpers/read.js"
import { validSolutionAndStatus, valueSums } from "./helpers/validate.js"
import { keys, newRand, randomElement } from "./helpers/util.js"
import test, { ExecutionContext } from "ava"

type SolvedTestCase = TestCase & { readonly solution: Readonly<Solution> }

const testData: readonly SolvedTestCase[] =
  testCases().map(data => ({ ...data, solution: solve(data.model, data.options) }))

const valid = (solution: Readonly<Solution>, { model, options, expected }: SolvedTestCase) =>
  validSolutionAndStatus(solution, expected, model, options)

const testAll = test.macro((t, test: (t: ExecutionContext, data: SolvedTestCase) => void) => {
  for (const data of testData) {
    test(t, data)
  }
})

test("Validate test case solutions", testAll, (t, data) => {
  t.assert(valid(data.solution, data))
})

test("Variable order is preserved in solution (zero variables not included)", testAll, (t, { model, solution }) => {
  // i.e., solution.variables should be a subsequence of data.variables
  let i = 0
  for (const [key, ] of solution.variables) {
    let found = false
    while (!found && i < model.variables.length) {
      found = key === model.variables[i][0]
      i++
    }
    t.assert(found)
  }
})

test("Variable order is preserved in solution (zero variables included)", testAll, (t, data) => {
  if (data.expected.status !== "optimal") return // model not applicable
  const { model } = data
  const options = { ...data.options, includeZeroVariables: true }
  const solution = solve(model, options)
  t.deepEqual(keys(solution.variables), keys(model.variables))
  t.assert(valid(solution, { ...data, options }))
})

test("Removing unused variables gives optimal solution", testAll, (t, data) => {
  const { model, solution } = data
  if (solution.status !== "optimal" || model.variables.length === solution.variables.length) return // model not applicable

  const variables: (TestCase["model"]["variables"][0])[] = []
  let i = 0
  for (const variable of model.variables) {
    // assume no duplicate keys
    if (i < solution.variables.length && variable[0] === solution.variables[i][0]) {
      // used variable, present in solution
      variables.push(variable)
      i++
    }
  }

  const removed = solve({ ...model, variables }, data.options)
  t.assert(valid(removed, data))
})

test("Duplicating non-binary variable gives optimal solution", testAll, (t, data) => {
  const { model } = data
  const variables = model.variables.filter(([key, ]) => !model.binaries.has(key))
  if (variables.length === 0) return // model not applicable

  const rand = newRand(model.hash)
  variables.push(randomElement(rand, model.variables))
  const duplicate = solve({ ...model, variables }, data.options)
  t.assert(valid(duplicate, data))
})

test("A more restrictive constraint that does not conflict with the optimal solution", testAll, (t, data) => {
  const { model, options, solution } = data
  // model not applicable, constraintSums does not reflect the actual/most optimal solution
  if (options.tolerance !== 0.0 || solution.status !== "cycled") return

  const rand = newRand(model.hash)
  const lowerOrUpper = model.constraints.filter(([, con]) => con.equal == null && con.min !== con.max)
  if (lowerOrUpper.length === 0) return // model not applicable

  const sums = valueSums(solution, model)
  const hasSlack =
    lowerOrUpper
    .map(([key, constraint]) => {
      const sum = sums.get(key) ?? 0.0
      const lowerSlack = sum - (constraint.min ?? -Infinity)
      const upperSlack = (constraint.max ?? Infinity) - sum
      return {
        key,
        constraint,
        lowerSlack,
        upperSlack
      }
    })
    .filter(x => x.lowerSlack > 0.0 || x.upperSlack > 0.0)
  if (hasSlack.length === 0) return // no constraints with slack exist

  const { key, constraint, lowerSlack, upperSlack } = randomElement(rand, hasSlack)
  const min = constraint.min === undefined ? -Infinity : constraint.min + lowerSlack
  const max = constraint.max === undefined ? Infinity : constraint.max - upperSlack
  const constraints = model.constraints.slice()
  constraints.push([key, { min, max }])
  const newModel = { ...model, constraints }
  const restricted = solve(newModel, data.options)
  t.assert(valid(restricted, data))
})

test("Tolerance option gives result in tolerance range", testAll, (t, data) => {
  const { model } = data
  if (model.integers.size + model.binaries.size === 0) return // model not applicable

  const rand = newRand(model.hash)
  const tol = data.options.tolerance // minimum tolerance necessary to find a solution in a reasonable time
  const tolerance = rand() * (1.0 - tol) + tol
  const options = { ...data.options, tolerance }
  const solution = solve(model, options)
  t.assert(valid(solution, { ...data, options }))
})

test("Timeout properly occurs", testAll, (t, data) => {
  const { model } = data
  const n = model.integers.size
  if (n === 0) return // model not applicable

  const options = { ...data.options, timeout: n < 50 ? 0.0 : n / 25.0 }
  const expected: Solution = { ...data.expected, status: "timedout" }
  const solution = solve(model, options)
  t.assert(valid(solution, { ...data, options, expected }))
})
