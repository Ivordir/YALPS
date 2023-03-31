import { Options, solve } from "../src/index.js"
import { BenchModel, Runner } from "./benchmark"
// @ts-ignore
import jsLP from "javascript-lp-solver"
import GLPK from "glpk.js"

const glpk = (GLPK as any)() as any

export const yalpsRunner: Runner = {
  name: "YALPS",
  convert: (model, options) => ({ model, options: { ...options, maxPivots: Infinity } }),
  solve: ({ model, options }) => solve(model, options),
  value: solution => solution.result
}

const objectSet = (set: ReadonlySet<string> | undefined) => {
  const obj: { [key: string]: 1 } = {}
  if (set != null) {
    for (const key of set) {
      obj[key] = 1
    }
  }
  return obj
}

const jsLPVariablesObject = (model: BenchModel) => {
  const obj: { [key: string]: { [key: string]: number } } = {}
  for (const [key, variable] of model.variables) {
    obj[key] = Object.fromEntries(variable)
  }
  return obj
}

const jsLPOptions = (options: Required<Options>) => ({
  tolerance: options.tolerance,
  timeout: options.timeout,
  exitOnCycles: options.checkCycles
})

const jsLPModel = (model: BenchModel, options: Required<Options>) => ({
  opType: model.direction === "minimize" ? "min" : "max",
  optimize: model.objective,
  constraints: Object.fromEntries(model.constraints),
  variables: jsLPVariablesObject(model),
  ints: objectSet(model.integers),
  binaries: objectSet(model.binaries),
  options: jsLPOptions(options)
})

export const jsLPRunner: Runner = {
  name: "jsLPSolver",
  convert: (model, options) => ({
    model: jsLPModel(model, options),
    precision: options.precision
  }),
  solve: ({ model, precision }) => jsLP.Solve(model, precision),
  value: solution => solution.feasible ? solution.result : NaN,
}

const glpkModel = (model: BenchModel) => {
  type Bounds = { type: number, ub: number, lb: number }
  type Coefs = { name: string, coef: number }[]
  type Constraint = { name: string, vars: Coefs, bnds: Bounds }

  const constraints = new Map<string, Constraint>()
  for (const [name, { equal, min, max }] of model.constraints) {
    const bnds =
      equal != null ? { type: glpk.GLP_FX, ub: 0.0, lb: equal }
      : min != null && max != null ? { type: glpk.GLP_DB, ub: max, lb: min }
      : min != null ? { type: glpk.GLP_LO, ub: 0.0, lb: min }
      : max != null ? { type: glpk.GLP_UP, ub: max, lb: 0.0 }
      : { type: glpk.GLP_FR, ub: 0.0, lb: 0.0 }

    constraints.set(name, { name, vars: [], bnds })
  }

  const objective: Coefs = []
  for (const [name, variable] of model.variables) {
    for (const [key, coef] of variable) {
      if (model.objective === key) {
        objective.push({ name, coef })
      }
      constraints.get(key)?.vars.push({ name, coef })
    }
  }

  return {
    name: "GLPK",
    objective: {
      direction: model.direction === "minimize" ? glpk.GLP_MIN : glpk.GLP_MAX,
      name: model.objective,
      vars: objective
    },
    subjectTo: Array.from(constraints.values()),
    binaries: Array.from(model.binaries),
    generals: Array.from(model.integers)
  }
}

const glpkOptions = (options: Required<Options>) => ({ mipgap: options.tolerance })

export const glpkRunner: Runner = {
  name: "glpk.js",
  convert: (model, options) => ({
    model: glpkModel(model),
    options: glpkOptions(options)
  }),
  solve: ({ model, options }) => glpk.solve(model, options),
  value: ({ result }) =>
    [glpk.GLP_OPT, glpk.GLP_FEAS, glpk.GLP_UNBND].includes(result.status) ? result.z : NaN
}

export const runners: readonly Runner[] = [yalpsRunner, jsLPRunner, glpkRunner]
