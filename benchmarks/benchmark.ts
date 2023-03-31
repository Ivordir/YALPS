import { Constraint, defaultOptions, OptimizationDirection, Options, solve } from "../src/index.js"
import { modelFromMps } from "./mps.js"
import * as File from "node:fs"
import { performance } from "node:perf_hooks"
import { strict as assert } from "node:assert"
// @ts-ignore
import jsLP from "javascript-lp-solver"
import GLPK from "glpk.js"

const glpk = (GLPK as any)() as any

export type BenchModel = {
  readonly direction?: OptimizationDirection
  readonly objective?: string
  readonly constraints: ReadonlyMap<string, Constraint>
  readonly variables: ReadonlyMap<string, ReadonlyMap<string, number>>
  readonly integers: ReadonlySet<string>
  readonly binaries: ReadonlySet<string>
}

export type Benchmark = {
  readonly name: string
  readonly model: BenchModel
  readonly options: Required<Options>
  readonly expected: number
}

type Runner = {
  readonly name: string,
  readonly convert: (model: BenchModel, options: Required<Options>) => any
  readonly solve: (input: any) => any
  readonly value: (solution: any) => number
}

const yalpsRunner: Runner = {
  name: "YALPS",
  convert: (model, options) => ({ model, options: { ...options, maxPivots: Infinity } }),
  solve: ({ model, options }) => solve(model, options),
  value: solution => solution.result
}

const objectSet = (set: Set<string> | undefined) => {
  const obj: any = {}
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

const jsLPRunner: Runner = {
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
  for (const [name, constraint] of model.constraints) {
    let bnds: Bounds
    if (constraint.equal == null) {
      const min = constraint.min != null
      const max = constraint.max != null
      bnds =
        min && max ? { type: glpk.GLP_DB, ub: constraint.max, lb: constraint.min }
        : min ? { type: glpk.GLP_LO, ub: 0.0, lb: constraint.min }
        : max ? { type: glpk.GLP_UP, ub: constraint.max, lb: 0.0 }
        : { type: glpk.GLP_FR, ub: 0.0, lb: 0.0 }
    } else {
      bnds = { type: glpk.GLP_FX, ub: 0.0, lb: constraint.equal }
    }
    constraints.set(name, { name, vars: [], bnds })
  }

  const objective: Coefs = []
  for (const [name, variable] of model.variables) {
    for (const [key, val] of variable) {
      const coef = val as number
      if (model.objective === key) {
        objective.push({ name, coef })
      }
      const constraint = constraints.get(key)
      if (constraint != null) {
        constraint.vars.push({ name, coef })
      }
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
    binaries: Array.from(model.binaries ?? []),
    generals: Array.from(model.integers ?? [])
  }
}

const glpkOptions = (options: Required<Options>) => ({ mipgap: options.tolerance })

const glpkRunner: Runner = {
  name: "glpk.js",
  convert: (model, options) => ({
    model: glpkModel(model),
    options: glpkOptions(options)
  }),
  solve: ({ model, options }) => glpk.solve(model, options),
  value: ({ result }) =>
    [glpk.GLP_OPT, glpk.GLP_FEAS, glpk.GLP_UNBND].includes(result.status) ? result.z : NaN
}

const time = (runner: Runner, input: any) => {
  const start = performance.now()
  runner.solve(input)
  const fin = performance.now()
  return fin - start
}

// https://en.wikipedia.org/wiki/Kahan_summation_algorithm#Further_enhancements
// Might be overkill, but might as well since it's simple enough
const kahanBabushkaNeumaierSum = (values: readonly number[]) => {
  let sum = 0.0
  let c = 0.0
  for (const value of values) {
    const t = sum + value
    c +=
      Math.abs(sum) >= Math.abs(value)
      ? ((sum - t) + value)
      : ((value - t) + sum)
    sum = t
  }
  return sum + c
}

const square = (x: number) => x * x

const validate = ({ model, expected, options }: Benchmark, run: Runner) => {
  const input = run.convert(model, options)
  const solution = run.solve(input)
  const result = run.value(solution)

  if (Number.isNaN(expected)) {
    assert(Number.isNaN(result))
  } else if (!Number.isFinite(expected)) {
    assert.equal(expected, result)
  } else {
    assert(Number.isFinite(result))
    const error = (Math.abs(result - expected) - options.precision) / Math.abs(expected || 1.0)
    assert(error <= Math.max(options.tolerance, 1e-5))
  }
}

type Stats = {
  mean: number
  variance: number
}

const stats = (samples: readonly number[]) => {
  const mean = kahanBabushkaNeumaierSum(samples) / samples.length
  const variance = kahanBabushkaNeumaierSum(samples.map(x => square(x - mean))) / (samples.length - 1)
  return { mean, variance }
}

type BenchmarkResults = (readonly [string, Stats])[]

const sampleBenchmark = (solvers: readonly Runner[], bench: Benchmark, numSamples: number) => {
  const data: BenchmarkResults = []
  for (const runner of solvers) {
    const input = runner.convert(bench.model, bench.options)
    const times: number[] = []

    global.gc?.() // isolate time due to gc between solvers
    for (let n = 0; n < numSamples; n++) {
      // do not reject outliers, as this may be due to gc which we want to account for
      times.push(time(runner, input))
    }

    data.push([runner.name, stats(times)])
  }
  return data
}

const formatNum = (x: number) => parseFloat(x.toFixed(2))

const resultsTable = (results: BenchmarkResults) => {
  const rows = results.sort((a, b) => a[1].mean - b[1].mean)
  const fastest = rows[0][1].mean

  const table: { [runner: string]: any } = {}
  for (const [name, { mean, variance }] of rows) {
    table[name] = {
      mean: formatNum(mean),
      stdDev: formatNum(Math.sqrt(variance)),
      slowdown: formatNum(mean / fastest)
    }
  }
  return table
}

const benchmark = (
  solvers: readonly Runner[],
  benchmarks: readonly Benchmark[],
  numSamples = 30,
  runValidation = true
) => {
  for (const bench of benchmarks) {
    if (runValidation) {
      for (const runner of solvers) {
        validate(bench, runner)
      }
    }

    const model = bench.model
    const numInteger = model.integers.size + model.binaries.size
    console.log(`${bench.name}: ${model.constraints.size} constraints, ${model.variables.size} variables, ${numInteger} integers:`)
    console.table(resultsTable(sampleBenchmark(solvers, bench, numSamples)))
    console.log("")
  }
}
