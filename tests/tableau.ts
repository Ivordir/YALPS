import { Coefficients, Constraint, Model } from "../src/index.js"
import { tableauModel, index, TableauModel } from "../src/tableau.js"
import { TupleArray, TestCase, readCases } from "./helpers/read.js"
import { keys, newRand, randomIndex, randomElement, sample, enumerate, valueMapping } from "./helpers/util.js"
import test, { ExecutionContext } from "ava"

const testData: readonly TestCase[] = readCases()

// deepEquals uses Object.is (sameValue algorithm) instead of sameValueZero algorithm, so deepEquals(0, -0) === false
const negate = (x: number) => x === 0.0 ? 0.0 : -x

test("Empty model", t => {
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
  t.deepEqual(result, expected)
})

const testAll = test.macro((t, test: (t: ExecutionContext, model: TestCase["model"]) => void) => {
  for (const data of testData) {
    test(t, data.model)
  }
})

const tableauFromModelWith = (key: keyof Model) =>
  (model: Model, value: any): TableauModel => tableauModel({ ...model, [key]: value })

const tableauFrom: { [key in keyof Model]-?: (model: Model, value: Model[key]) => TableauModel } = {
  direction: tableauFromModelWith("direction"),
  objective: tableauFromModelWith("objective"),
  constraints: tableauFromModelWith("constraints"),
  variables: tableauFromModelWith("variables"),
  integers: tableauFromModelWith("integers"),
  binaries: tableauFromModelWith("binaries")
}

test("Objective row is zero if no objective is given", testAll, (t, model) => {
  const result = tableauFrom.objective(model, undefined)
  const expected = tableauModel(model)
  expected.tableau.matrix.fill(0.0, 0, expected.tableau.width)
  t.deepEqual(result, expected)
})

test("Objective row and sign are negated for opposite optimization direction", testAll, (t, model) => {
  const direction = model.direction === "minimize" ? "maximize": "minimize"
  const result = tableauFrom.direction(model, direction)

  const expected = tableauModel(model)
  for (let c = 0; c < expected.tableau.width; c++) {
    expected.tableau.matrix[c] = negate(expected.tableau.matrix[c])
  }
  (expected as any).sign = -expected.sign

  t.deepEqual(result, expected)
})

const numRows = (constraint: Constraint) =>
  constraint.equal != null ? 2 : ((constraint.max != null ? 1 : 0) + (constraint.min != null ? 1 : 0))

const rowOfConstraint = (constraints: TestCase["model"]["constraints"], index: number) =>
  constraints
  .slice(0, index)
  .reduce(((sum, [, con]) => sum + numRows(con)), 1)

test("Objective can share the same key as a constraint", testAll, (t, model) => {
  const rand = newRand(model.hash)
  const conIndex = randomIndex(rand, model.constraints)
  const [key, constraint] = model.constraints[conIndex]
  const sign =
    constraint.equal != null || constraint.max != null ? 1.0
    : constraint.min != null ? -1.0
    : 0.0
  if (sign === 0.0) return

  const result = tableauFrom.objective(model, key)
  for (let c = 0; c < result.tableau.width; c++) {
    if (result.tableau.matrix[c] === 0.0) {
      result.tableau.matrix[c] = 0.0 // deepEquals(0, -0) === false
    }
  }

  const row = rowOfConstraint(model.constraints, conIndex)
  const expected = tableauModel(model)
  // copy row of constraint to objective row
  for (let c = 1; c < expected.tableau.width; c++) {
    const value = index(expected.tableau, row, c)
    expected.tableau.matrix[c] = value === 0.0 ? 0.0 : (expected.sign * sign * value)
  }

  t.deepEqual(result, expected)
})

test("Constraints as an object, array, and map", testAll, (t, model) => {
  const map = tableauFrom.constraints(model, new Map(model.constraints))
  const object = tableauFrom.constraints(model, Object.fromEntries(model.constraints))
  const array = tableauModel(model)
  t.deepEqual(map, array)
  t.deepEqual(object, array)
})

test("Variables an an object, array, and map", testAll, (t, model) => {
  const map = tableauFrom.variables(model, new Map(model.variables))
  const object = tableauFrom.variables(model, Object.fromEntries(model.variables))
  const array = tableauModel(model)
  t.deepEqual(map, array)
  t.deepEqual(object, array)
})

test("Coefficients as an object, array, and map", testAll, (t, model) => {
  const mapVariables = (mapping: (variable: TupleArray<string, number>) => Coefficients) =>
    tableauFrom.variables(model, model.variables.map(valueMapping(mapping)))

  const map = mapVariables(variable => new Map(variable))
  const object = mapVariables(Object.fromEntries)
  const array = tableauModel(model)

  const equal = (a: TableauModel, b: TableauModel) =>
    t.deepEqual({ ...a, variables: keys(a.variables) }, { ...b, variables: keys(b.variables) })

  equal(map, array)
  equal(object, array)
})

test("No variables marked as integer", testAll, (t, model) => {
  const boolNone = tableauFrom.integers(model, false)
  const setNone = tableauFrom.integers(model, new Set())
  const iterNone = tableauFrom.integers(model, [])
  t.deepEqual(boolNone, setNone)
  t.deepEqual(iterNone, setNone)
})

test("All variables marked as integer", testAll, (t, model) => {
  const varKeys = keys(model.variables)
  const boolAll = tableauFrom.integers(model, true)
  const setAll = tableauFrom.integers(model, new Set(varKeys))
  const iterAll = tableauFrom.integers(model, varKeys)
  t.deepEqual(boolAll, setAll)
  t.deepEqual(iterAll, setAll)
})

test("Integers as a set and array", testAll, (t, model) => {
  const rand = newRand(model.hash)
  const varSmaple = sample(rand, keys(model.variables))
  const setSample = tableauFrom.integers(model, new Set(varSmaple))
  const iterSample = tableauFrom.integers(model, varSmaple)
  t.deepEqual(iterSample, setSample)
})

test("No variables marked as binary", testAll, (t, model) => {
  const boolNone = tableauFrom.binaries(model, false)
  const setNone = tableauFrom.binaries(model, new Set())
  const iterNone = tableauFrom.binaries(model, [])
  t.deepEqual(boolNone, setNone)
  t.deepEqual(iterNone, setNone)
})

test("All variables marked as binary", testAll, (t, model) => {
  const varKeys = keys(model.variables)
  const boolTrue = tableauFrom.binaries(model, true)
  const setAll = tableauFrom.binaries(model, new Set(varKeys))
  const iterAll = tableauFrom.binaries(model, varKeys)
  t.deepEqual(boolTrue, setAll)
  t.deepEqual(iterAll, setAll)
})

test("Binaries as a set and array", testAll, (t, model) => {
  const rand = newRand(model.hash)
  const varSample = sample(rand, keys(model.variables))
  const set = tableauFrom.binaries(model, new Set(varSample))
  const iter = tableauFrom.binaries(model, varSample)
  t.deepEqual(iter, set)
})

test("Binary has higher precedence than integer", testAll, (t, model) => {
  const rand = newRand(model.hash)
  const [key, ] = randomElement(rand, model.variables)
  const result = tableauModel({ ...model, integers: [key], binaries: [key] })
  const expected = tableauModel({ ...model, integers: [], binaries: [key] })
  t.deepEqual(result, expected)
})

test("Swapping bound direction gives negated constraint row", testAll, (t, model) => {
  const constraints =
    enumerate(model.constraints).filter(([, [, con]]) => con.equal == null && (con.max == null) !== (con.min == null))
  if (constraints.length === 0) return // model not applicable

  const rand = newRand(model.hash)
  const [index, [key, constraint]] = randomElement(rand, constraints)
  const swapped =
    constraint.min == null
    ? { min: constraint.max } as Constraint
    : { max: constraint.min }

  const newConstraints = model.constraints.slice()
  newConstraints[index] = [key, swapped]
  const row = rowOfConstraint(model.constraints, index)
  const result = tableauFrom.constraints(model, newConstraints)
  for (let c = 0; c < result.tableau.width; c++) {
    const i = row * result.tableau.width + c
    if (result.tableau.matrix[i] === 0.0) {
      result.tableau.matrix[i] = 0.0 // deepEquals(0, -0) === false
    }
  }

  const expected = tableauModel(model)
  for (let c = 0; c < expected.tableau.width; c++) {
    const i = row * expected.tableau.width + c
    expected.tableau.matrix[i] = negate(expected.tableau.matrix[i])
  }

  t.deepEqual(result, expected)
})

test("Equal has higher precedence than min and max", testAll, (t, model) => {
  const constraints = enumerate(model.constraints).filter(([, [, con]]) => con.equal != null)
  if (constraints.length === 0) return // model not applicable

  const rand = newRand(model.hash)
  const [index, [key, constraint]] = randomElement(rand, constraints)
  const value = constraint.equal!
  const modified = model.constraints.slice()
  const multiple = {
    equal: value,
    min: value + 1.0,
    max: value - 1.0
  }
  modified[index] = [key, multiple]
  const result = tableauFrom.constraints(model, modified)

  const expected = tableauModel(model)

  t.deepEqual(result, expected)
})

test("Constraints with the same key are merged", testAll, (t, model) => {
  const rand = newRand(model.hash)
  const index = randomIndex(rand, model.constraints)
  const [key, constraint] = model.constraints[index]
  const other = {
    max: rand() * 100.0 + (constraint.max ?? 0.0),
    min: rand() * 100.0 + (constraint.min ?? 0.0)
  }
  const sameKey = model.constraints.slice()
  sameKey.push([key, other])
  const result = tableauFrom.constraints(model, sameKey)

  const merged = {
    max: Math.min(constraint.equal ?? constraint.max ?? Infinity, other.max),
    min: Math.max(constraint.equal ?? constraint.min ?? -Infinity, other.min)
  }
  const constraints = model.constraints.slice()
  constraints[index] = [key, merged]
  const expected = tableauFrom.constraints(model, constraints)

  t.deepEqual(result, expected)
})

test("Duplicate variable keys do not affect matrix", testAll, (t, model) => {
  const rand = newRand(model.hash)
  const indexCopy = randomIndex(rand, model.variables)
  const [key, ] = model.variables[indexCopy]
  const indexChange = randomIndex(rand, model.variables) // could be same index...
  const variables = model.variables.slice()
  variables[indexChange] = [key, variables[indexChange][1]]
  const result = tableauFrom.variables(model, variables)

  const expected = tableauModel(model) as any
  expected.variables[indexChange][0] = key

  t.deepEqual(result, expected)
})

test("Last value is used for coefficients with the same key", testAll, (t, model) => {
  const rand = newRand(model.hash)
  const varIndex = randomIndex(rand, model.variables)
  const [varKey, variable] = model.variables[varIndex]
  const coefIndex = randomIndex(rand, variable)
  const [coefKey, value] = variable[coefIndex]

  const newVariable = variable.slice()
  newVariable[coefIndex] = [coefKey, value + rand() * 100.0]
  newVariable.push([coefKey, value])
  const newVariables = model.variables.slice()
  newVariables[varIndex] = [varKey, newVariable]
  const result = tableauFrom.variables(model, newVariables)

  const expected = tableauModel(model) as any
  expected.variables[varIndex] = [varKey, newVariable]

  t.deepEqual(result, expected)
})

const removeIndex = <T>(array: readonly T[], index: number) => {
  const remove = array.slice()
  remove.splice(index, 1)
  return remove
}

test("Removing a constraint gives less rows", testAll, (t, model) => {
  const rand = newRand(model.hash)
  const index = randomIndex(rand, model.constraints)
  const result = tableauFrom.constraints(model, removeIndex(model.constraints, index))

  const row = rowOfConstraint(model.constraints, index)
  const { tableau, ...tableauRest } = tableauModel(model)
  const removedRows = numRows(model.constraints[index][1])
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

  t.deepEqual(result, expected)
})

test("Removing a variable gives one less column (and one row if binary)", testAll, (t, model) => {
  const rand = newRand(model.hash)
  const index = randomIndex(rand, model.variables)
  const result = tableauFrom.variables(model, removeIndex(model.variables, index))

  const { tableau, sign, variables, integers } = tableauModel(model)

  // remove the variable's column
  let matrix = new Float64Array(tableau.matrix.length - tableau.height)
  matrix.set(tableau.matrix.subarray(0, index + 1))
  for (let i = 0; i < tableau.height; i++) {
    const start = index + 2 + i * tableau.width
    const sub = tableau.matrix.subarray(start, Math.min(start + tableau.width - 1, tableau.matrix.length))
    matrix.set(sub, start - 1 - i)
  }

  const binary = model.binaries.has(model.variables[index][0])
  if (binary) {
    // remove the binary variable's constraint row
    let binaryRow = tableau.height - 1
    for (; binaryRow >= 0; binaryRow--) {
      if (tableau.matrix[binaryRow * tableau.width + index + 1] === 1.0) {
        break
      }
    }
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
    sign,
    variables: removeIndex(variables, index),
    integers: integers.filter(x => x != index + 1).map(x => x <= index ? x : (x - 1))
  }

  t.deepEqual(result, expected)
})
