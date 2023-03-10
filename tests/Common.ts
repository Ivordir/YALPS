import { Constraint, OptimizationDirection, Options, Solution } from "../src/YALPS.js"
import { defaultOptions } from "../src/YALPS.js"
import * as File from "fs"
import assert from "assert"

export type Variable = { readonly [constraint: string]: number }

export type TestCase = {
  readonly file: string
  readonly model: {
    readonly direction?: OptimizationDirection
    readonly objective?: string
    readonly constraints: { readonly [constraint: string]: Constraint }
    readonly variables: { readonly [variable: string]: Variable }
    readonly integers?: string[]
    readonly binaries?: string[]
  }
  readonly constraints: readonly (readonly [string, Constraint])[]
  readonly variables: readonly (readonly [string, Variable])[]
  readonly options: Required<Options>
  readonly expected: Solution
}

export const readCases = (): readonly TestCase[] => {
  return File.readdirSync("tests/cases").map(file => {
    const json = File.readFileSync("tests/cases/" + file) as any as string
    const data = JSON.parse(json)
    data.file = file
    data.variables = Object.entries(data.model.variables)
    data.constraints = Object.entries(data.model.constraints)
    data.options = { ...defaultOptions, ...data.options }
    data.expected.result =
      data.expected.result === null ? NaN
      : data.expected.result === "Infinity" ? Infinity
      : data.expected.result
    return data
  })
}

export const relaxPrecisionFactor = 1E3

export const assertResultOptimal = (result: number, data: TestCase, relaxPrecision: boolean = false) => {
  const expected = data.expected.result
  const precision = data.options.precision * (relaxPrecision ? relaxPrecisionFactor : 1.0)
  const tolerance = data.options.tolerance
  if (data.model.direction === "minimize") {
    assert(expected / (1 + tolerance) - result <= precision
      && result - expected * (1 + tolerance) <= precision)
  } else {
    assert(expected * (1 - tolerance) - result <= precision
      && result - expected / (1 - tolerance) <= precision)
  }
}
