import { Coefficients, Constraint, Solution } from "../src/YALPS.js"
import { tableauModel, index, solve } from "../src/YALPS.js"
import { TestCase, Variable } from "./Common.js"
import { readCases } from "./Common.js"
import { strict as assert } from "node:assert"

const section = describe
const test = it

const testData = readCases()

const randomIndex = (array: readonly any[]) => (Math.random() * array.length) | 0
const randomElement = <T>(array: readonly T[]) => array[randomIndex(array)]

section("Tableau Tests", () => {
  test("Empty model", () => {
    const result = tableauModel({ variables: {}, constraints: {} })
    const expected = {
      tableau: {
        matrix: new Float64Array(1),
        width: 1,
        height: 1,
        positionOfVariable: new Int32Array([0, 1]),
        variableAtPosition: new Int32Array([0, 1])
      },
      sign: 1.0,
      variables: [],
      integers: []
    }
    assert.deepEqual(result, expected)
  })

  const testProperty = (desc: string, property: (data: TestCase) => void) => {
    test(desc, () => {
      for (const data of testData) {
        try { property(data) }
        catch (e: any) { e.message = data.file + ": " + e.message; throw e }
      }
    })
  }

  testProperty("Objective row is zero if no objective is given", data => {
    const noObj = { ...data.model }
    delete noObj.objective
    const result = tableauModel(noObj)

    const expected = tableauModel(data.model)
    expected.tableau.matrix.fill(0.0, 0, expected.tableau.width)

    assert.deepEqual(result, expected)
  })

  testProperty("Objective row and sign are negated for opposite optimization direction", data => {
    const result = tableauModel({
      ...data.model,
      direction: data.model.direction === "minimize" ? "maximize": "minimize"
    })

    const expected = tableauModel(data.model)
    for (let c = 0; c < expected.tableau.width; c++) {
      const v = expected.tableau.matrix[c]
      // for some reason: deepEquals(0, -0) === false
      // even though: 0 === -0
      // negate first row except for any zeros
      expected.tableau.matrix[c] = v === 0.0 ? 0.0 : -v
    }
    (expected as any).sign = -expected.sign

    assert.deepEqual(result, expected)
  })

  const numRows = (constraint: Constraint) =>
    constraint.equal == null
    ? (constraint.max == null ? 0 : 1) + (constraint.min == null ? 0 : 1)
    : 2

  const rowOfConstraint = (constraints: readonly (readonly [string, Constraint])[], index: number) =>
    constraints
    .slice(0, index)
    .reduce(((sum, [, con]) => sum + numRows(con)), 1)

  testProperty("Objective can share the same key as a constraint", data => {
    if (data.constraints.length === 0) return // model not applicable
    const conIndex = randomIndex(data.constraints)
    const [key, constraint] = data.constraints[conIndex]
    const sign =
      constraint.equal || constraint.max ? 1.0
      : constraint.min ? -1.0
      : 0.0
    if (sign === 0.0) return // not valid contraint for this test

    const result = tableauModel({ ...data.model, objective: key })
    // I swear to god why is: deepEquals(0, -0) === false
    for (let c = 0; c < result.tableau.width; c++) {
      if (result.tableau.matrix[c] === 0.0) {
        result.tableau.matrix[c] = 0.0
      }
    }

    const row = rowOfConstraint(data.constraints, conIndex)
    const expected = tableauModel(data.model)
    // copy row of constraint to objective row
    for (let c = 1; c < expected.tableau.width; c++) {
      const value = index(expected.tableau, row, c)
      expected.tableau.matrix[c] = value === 0.0 ? 0.0 : (expected.sign * sign * value)
    }

    assert.deepEqual(result, expected)
  })

  section("Flexible API", () => {
    testProperty("Constraints as an object, array, and iterable (map)", data => {
      const array = tableauModel({ ...data.model, constraints: data.constraints })
      const iterable = tableauModel({ ...data.model, constraints: new Map(data.constraints) })
      // using the object tableau as the expected
      const object = tableauModel(data.model)
      assert.deepEqual(array, object)
      assert.deepEqual(iterable, object)
    })

    testProperty("Variables an an object, array, and iterable (map)", data => {
      const array = tableauModel({ ...data.model, variables: data.variables })
      const iterable = tableauModel({ ...data.model, variables: new Map(data.variables) })
      // using the object tableau as the expected
      const object = tableauModel(data.model)
      assert.deepEqual(array, object)
      assert.deepEqual(iterable, object)
    })

    // Fisher-Yates shuffle
    const sample = <T>(array: T[], n: number) => {
      for (let i = 0; i < n; i++) {
        const j = (Math.random() * (array.length - i) | 0) + i
        const temp = array[i]
        array[i] = array[j]
        array[j] = temp
      }
      return array.slice(0, n)
    }

    // a little overkill, but whatev
    testProperty("Integers as a boolean, set, and iterable (array)", data => {
      const boolNone = tableauModel({ ...data.model, integers: false })
      const setNone = tableauModel({ ...data.model, integers: new Set<string>() })
      const iterNone = tableauModel({ ...data.model, integers: [] })
      assert.deepEqual(boolNone, setNone)
      assert.deepEqual(iterNone, setNone)

      if (data.variables.length === 0) return // model not applicable
      const varKeys = data.variables.map(([k, ]) => k)
      const boolAll = tableauModel({ ...data.model, integers: true })
      const setAll = tableauModel({ ...data.model, integers: new Set(varKeys) })
      const iterAll = tableauModel({ ...data.model, integers: varKeys })
      assert.deepEqual(boolAll, setAll)
      assert.deepEqual(iterAll, setAll)

      const sub = sample(varKeys, randomIndex(varKeys))
      const set = tableauModel({ ...data.model, integers: new Set(sub) })
      const iter = tableauModel({ ...data.model, integers: sub })
      assert.deepEqual(iter, set)
    })

    testProperty("Binaries as a boolean, set, and iterable (array)", data => {
      const boolNone = tableauModel({ ...data.model, binaries: false })
      const setNone = tableauModel({ ...data.model, binaries: new Set<string>() })
      const iterNone = tableauModel({ ...data.model, binaries: [] })
      assert.deepEqual(boolNone, setNone)
      assert.deepEqual(iterNone, setNone)

      const varKeys = data.variables.map(([k, ]) => k)
      if (varKeys.length === 0) return // model not applicable
      const boolTrue = tableauModel({ ...data.model, binaries: true })
      const setAll = tableauModel({ ...data.model, binaries: new Set(varKeys) })
      const iterAll = tableauModel({ ...data.model, binaries: varKeys })
      assert.deepEqual(boolTrue, setAll)
      assert.deepEqual(iterAll, setAll)

      const sub = sample(varKeys, randomIndex(varKeys))
      const set = tableauModel({ ...data.model, binaries: new Set(sub) })
      const iter = tableauModel({ ...data.model, binaries: sub })
      assert.deepEqual(iter, set)
    })
  })

  const removeIndex = <T>(array: readonly T[], index: number) => {
    const remove = array.slice()
    remove.splice(index, 1)
    return remove
  }

  testProperty("Swapping bound direction gives negated constraint row", data => {
    const constraints =
      data.constraints.filter(([, con]) =>
        con.equal == null
        && (con.max == null) !== (con.min == null))
    if (constraints.length === 0) return // model not applicable

    const [key, constraint] = randomElement(constraints)
    const conIndex = data.constraints.findIndex(([k, ]) => k === key)
    const row = rowOfConstraint(data.constraints, conIndex)

    const expected = tableauModel(data.model)
    // negate row
    for (let c = 0; c < expected.tableau.width; c++) {
      const i = row * expected.tableau.width + c
      expected.tableau.matrix[i] = -expected.tableau.matrix[i]
    }

    const swapped = data.constraints.slice()
    const con =
      constraint.min == null
      ? { min: constraint.max } as Constraint
      : { max: constraint.min }
    swapped[conIndex] = [key, con]
    const result = tableauModel({ ...data.model, constraints: swapped })
    // deepEquals(0, -0) === false
    for (let c = 0; c < result.tableau.width; c++) {
      const i = row * result.tableau.width + c
      if (result.tableau.matrix[i] === 0.0) {
        const e = expected.tableau.matrix[i]
        assert(e === 0.0)
        result.tableau.matrix[i] = e
      }
    }

    assert.deepEqual(result, expected)
  })

  testProperty("Constraints with the same key are merged", data => {
    if (data.constraints.length === 0) return // model not applicable
    const index = randomIndex(data.constraints)
    const [key, constraint] = data.constraints[index]
    const other = {
      max: Math.random() * 100.0 - 50.0,
      min: Math.random() * 100.0 - 50.0
    }

    const sameKey = data.constraints.slice()
    sameKey.push([key, other])
    const result = tableauModel({ ...data.model, constraints: sameKey })

    const merged = {
      max: Math.min(constraint.equal ?? constraint.max ?? Infinity, other.max),
      min: Math.max(constraint.equal ?? constraint.min ?? -Infinity, other.min)
    }
    const constraints = data.constraints.slice()
    constraints[index] = [key, merged]
    const expected = tableauModel({ ...data.model, constraints })

    assert.deepEqual(result, expected)
  })

  testProperty("Removing a constraint", data => {
    if (data.constraints.length === 0) return // model not applicable
    const index = randomIndex(data.constraints)
    const removed = { ...data.model, constraints: removeIndex(data.constraints, index) }
    const result = tableauModel(removed)

    const row = rowOfConstraint(data.constraints, index)
    const { tableau, ...tableauRest } = tableauModel(data.model)
    const removedRows = numRows(data.constraints[index][1])
    const removedLength = removedRows * tableau.width
    const matrix = new Float64Array(tableau.matrix.length - removedLength)
    const beforeRemoved = row * tableau.width
    matrix.set(tableau.matrix.subarray(0, beforeRemoved))
    matrix.set(tableau.matrix.subarray(beforeRemoved + removedLength), beforeRemoved)
    const expected = {
      tableau: {
        matrix,
        width: tableau.width,
        height: tableau.height - removedRows,
        positionOfVariable: tableau.positionOfVariable.subarray(0, tableau.positionOfVariable.length - removedRows),
        variableAtPosition: tableau.variableAtPosition.subarray(0, tableau.variableAtPosition.length - removedRows)
      },
      ...tableauRest
    }

    assert.deepEqual(result, expected)
  })

  testProperty("Removing a variable", data => {
    if (data.variables.length === 0) return // model not applicable
    const index = randomIndex(data.variables)
    const removed = { ...data.model, variables: removeIndex(data.variables, index) }
    const result = tableauModel(removed)

    const { tableau, ...tableauRest } = tableauModel({ ...data.model, variables: data.variables })
    // remove the variable's column
    let matrix = new Float64Array(tableau.matrix.length - tableau.height)
    matrix.set(tableau.matrix.subarray(0, index + 1))
    for (let i = 0; i < tableau.height; i++) {
      const start = index + 2 + i * tableau.width
      const sub = tableau.matrix.subarray(start, Math.min(start + tableau.width - 1, tableau.matrix.length))
      matrix.set(sub, start - 1 - i)
    }

    const binary = data.model.binaries?.includes(data.variables[index][0])
    if (binary) {
      let binaryRow = tableau.height - 1
      for (; binaryRow >= 0; binaryRow--) {
        if (tableau.matrix[binaryRow * tableau.width + index + 1] === 1.0) {
          break
        }
      }
      // remove the binary variable's constraint row
      const width = tableau.width - 1
      matrix.set(matrix.subarray((binaryRow + 1) * width), binaryRow * width)
      matrix = matrix.subarray(0, matrix.length - width)
    }
    const b = binary ? 1 : 0
    const expected = {
      tableau: {
        matrix,
        width: tableau.width - 1,
        height: tableau.height - b,
        positionOfVariable: tableau.positionOfVariable.subarray(0, tableau.positionOfVariable.length - 1 - b),
        variableAtPosition: tableau.variableAtPosition.subarray(0, tableau.variableAtPosition.length - 1 - b)
      },
      sign: tableauRest.sign,
      variables: removeIndex(tableauRest.variables, index),
      integers: tableauRest.integers.filter(x => x != index + 1).map(x => x <= index ? x : (x - 1))
    }

    assert.deepEqual(result, expected)
  })

  testProperty("Binary has higher precedence than integer", data => {
    // I.e., variable is added as binary if indicated as both integer and binary
    if (data.variables.length === 0) return // model not applicable
    const [key, ] = randomElement(data.variables)
    const both = tableauModel({ ...data.model, integers: [key], binaries: [key] })
    const expected = tableauModel({ ...data.model, integers: [], binaries: [key] })
    assert.deepEqual(both, expected)
  })
})

const solutionOptimal = (data: TestCase, { status, result, variables }: Solution, relaxPrecision: boolean = false) => {
  const sums = new Map<string, number>()
  if (status === "infeasible" || status === "cycled") {
    assert(Number.isNaN(result))
    assert.deepEqual(variables, [])
  } else if (status === "unbounded") {
    assert.equal(result, Infinity)
  } else {
    const expected = data.expected.result
    let precision = data.options.precision * (relaxPrecision ? 1e3 : 1.0)
    const tolerance = data.options.tolerance
    if (data.model.direction === "minimize") {
      assert(expected / (1.0 + tolerance) - result <= precision
        && result - expected * (1.0 + tolerance) <= precision)
    } else {
      assert(expected * (1.0 - tolerance) - result <= precision
        && result - expected / (1.0 - tolerance) <= precision)
    }

    precision = data.options.precision * 1e3
    for (const [key, num] of variables) {
      const variable = (data.model.variables as any)[key] as Coefficients
      for (const [constraint, coef] of Object.entries(variable)) {
        sums.set(constraint, num * coef + (sums.get(constraint) ?? 0.0))
      }
    }
    const objectiveSum = data.model.objective == null ? 0.0 : (sums.get(data.model.objective) ?? 0.0)
    assert(Math.abs(objectiveSum - result) <= precision)
    for (const [key, constraint] of data.constraints) {
      const sum = sums.get(key) ?? 0.0
      if (constraint.equal == null) {
        if (constraint.min != null) {
          assert(constraint.min - sum <= precision)
        }
        if (constraint.max != null) {
          assert(sum - constraint.max <= precision)
        }
      } else {
        assert(Math.abs(sum - constraint.equal) <= precision)
      }
    }
  }
  return sums
}

section("Solver Tests", () => {
  type SolutionData = {
    readonly solution: Solution
    readonly constraintSums: Map<string, number>
  }

  const solutionData: SolutionData[] = []
  section("Specific Test Cases", () => {
    for (const data of testData) {
      test(data.file, () => {
        const solution = solve(data.model, data.options)
        solutionData.push({ solution, constraintSums: solutionOptimal(data, solution) })
      })
    }
  })

  section("Properties", () => {
    const testProperty = (desc: string, property: (data: TestCase, solution: SolutionData) => void) => {
      test(desc, () => {
        for (let i = 0; i < testData.length; i++) {
          const data = testData[i]
          try { property(data, solutionData[i]) }
          catch (e: any) { e.message = data.file + ": " + e.message; throw e }
        }
      })
    }

    testProperty("Variable order is preserved in solution (zero variables not included)", (data, {solution}) => {
      // i.e., solution.variables should be a subsequence of data.variables
      let i = 0
      for (const [key, ] of solution.variables) {
        let found = false
        while (!found && i < data.variables.length) {
          found = key === data.variables[i][0]
          i++
        }
        assert(found)
      }
    })

    testProperty("Variable order is preserved in solution (zero variables included)", data => {
      const solution = solve(data.model, { ...data.options, includeZeroVariables: true })
      if (solution.status == "optimal") {
        assert.deepEqual(solution.variables.map(([key,]) => key), data.variables.map(([key,]) => key))
      }
      solutionOptimal(data, solution)
    })

    testProperty("Removing unused variables gives optimal solution", (data, {solution}) => {
      if (solution.status !== "optimal" || data.variables.length === solution.variables.length)
        return // model not applicable

      const variables: (readonly [string, Variable])[] = []
      let i = 0
      for (const variable of data.variables) {
        // assume no duplicate keys
        if (i < solution.variables.length && variable[0] === solution.variables[i][0]) {
          // used variable, present in solution
          variables.push(variable)
          i++
        } else if (Math.random() < 0.5) {
          // unused variable, omit with some probability
          variables.push(variable)
        }
      }

      const removed = solve({ ...data.model, variables }, data.options)

      solutionOptimal(data, removed)
    })

    testProperty("Duplicating non-binary variable gives optimal solution", data => {
      const binaries = new Set(data.model.binaries)
      const variables = data.variables.filter(([k, ]) => !binaries.has(k))
      if (variables.length === 0) return // model not applicable
      variables.push(randomElement(data.variables))
      const duplicate = solve({ ...data.model, variables }, data.options)
      solutionOptimal(data, duplicate)
    })

    testProperty("A more restrictive constraint that does not conflict with the optimal solution",
      (data, { solution, constraintSums }) => {
        // model not applicable, constraintSums does not reflect the actual/most optimal solution
        if (data.options.tolerance !== 0.0 || solution.status === "cycled") return

        const constraints = data.constraints.slice()
        const nonEqual = constraints.filter(([, con]) => con.equal == null)
        if (nonEqual.length === 0) return // model not applicable
        const [key, constraint] = randomElement(nonEqual)
        const sum = constraintSums.get(key) ?? 0.0
        const lower = Math.max(constraint.min ?? -Infinity, sum / 2.0)
        const upper = Math.min(constraint.max ?? Infinity, sum * 2.0)
        const min = Math.random() * (sum - lower) + lower
        const max = Math.random() * (upper - sum) + sum
        constraints.push([key, { min, max }])
        const restricted = solve({ ...data.model, constraints }, data.options)
        solutionOptimal(data, restricted, true)
    })
  })
})
