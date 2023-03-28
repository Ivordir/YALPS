import { Constraint, OptimizationDirection, Options, Solution } from "../src/YALPS.js"
import { defaultOptions } from "../src/YALPS.js"
import * as File from "node:fs"

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
      data.expected.status === "optimal" ? data.expected.result
      : data.expected.status === "unbounded" ? Infinity * (data.model.direction === "minimize" ? -1.0 : 1.0)
      : NaN
    return data
  })
}
