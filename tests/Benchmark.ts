import { Model, Options, solve } from "../src/YALPS.js"
import { TestCase, readCases, assertResultOptimal } from "./Common.js"
import { performance } from "perf_hooks"
// @ts-ignore
import jsLP from "javascript-lp-solver"
import GLPK from "glpk.js"

const glpk = (GLPK as any)() as any

type Benchmark = TestCase

const benchmarks: readonly Benchmark[] = readCases().filter(bench => bench.constraints.length > 10 && bench.variables.length > 10)

type Runner = {
  name: string
  convert: (model: Model, options?: Options) => any
  solve: (input: any) => any
  value: (solution: any) => number
}

const yalpsRunner: Runner = {
  name: "YALPS",
  convert: (model, options) => ({ model, options }),
  solve: ({ model, options }) => solve(model, options),
  value: solution => solution.result
}

const objectSet = (set: boolean | Iterable<string> | undefined) => {
  if (set === true || set === false) throw "Not Implemented"
  const obj: any = {}
  if (set != null) {
    for (const key of set) {
      obj[key] = 1
    }
  }
  return obj
}

const jsLPModel = (model: Model, options?: Options) => ({
  optimize: model.objective,
  opType: model.direction === "minimize" ? "min" : "max",
  constraints: model.constraints,
  variables: model.variables,
  ints: objectSet(model.integers),
  binaries: objectSet(model.binaries),
  options: jsLPOptions(options)
})

const jsLPOptions = (options?: Options) =>
  options == null ? options : {
    tolerance: options?.tolerance ?? 0,
    timeout: options.timeout,
    exitOnCycles: options?.checkCycles ?? false
  }

const jsLPRunner: Runner = {
  name: "jsLPSolver",
  convert: (model, options) => ({
    model: jsLPModel(model, options),
    precision: options?.precision
  }),
  solve: ({ model, precision }) => jsLP.Solve(model, precision),
  value: solution => solution.result
}

const glpkModel = (model: Model) => {
  type Bounds = { type: number, ub: number, lb: number }
  type Coefs = { name: string, coef: number }[]
  type Constraint = { name: string, vars: Coefs, bnds: Bounds }

  const constraints = new Map<string, Constraint>()
  for (const [name, constraint] of Object.entries(model.constraints)) {
    let bnds: Bounds
    if (constraint.equal == null) {
      const min = constraint.min != null
      const max = constraint.max != null
      bnds =
        min && max ? { type: glpk.GLP_DB, ub: constraint.max, lb: constraint.min }
        : min && !max ? { type: glpk.GLP_LO, ub: 0, lb: constraint.min }
        : !min && max ? { type: glpk.GLP_UP, ub: constraint.max, lb: 0 }
        : { type: glpk.GLP_FR, ub: 0, lb: 0 }
    } else {
      bnds = { type: glpk.GLP_FX, ub: 0, lb: constraint.equal }
    }
    constraints.set(name, { name, vars: [], bnds })
  }

  const objective: Coefs = []
  const hasObjective = "objective" in model
  for (const [name, variable] of Object.entries(model.variables)) {
    for (const [key, val] of Object.entries(variable)) {
      const coef = val as number
      if (hasObjective && model.objective === key) {
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
    binaries: model.binaries,
    generals: model.integers
  }
}

const glpkOptions = (options?: Options) => ({
  mipgap: options?.tolerance ?? 0
})

const glpkRunner: Runner = {
  name: "glpk.js",
  convert: (model, options) => ({
    model: glpkModel(model),
    options: glpkOptions(options)
  }),
  solve: ({ model, options }) => glpk.solve(model, options),
  value: solution => solution.result.z
}

const time = (runner: Runner, input: any) => {
  const start = performance.now()
  runner.solve(input)
  const fin = performance.now()
  return fin - start
}

// The following Welch t-test code was adapted from Expecto: https://github.com/haf/expecto

// Student's t-distribution inverse for 0.01% probability by degrees of freedom.
const tInv01 = [ 6366.198, 99.992, 28.000, 15.544, 11.178, 9.082, 7.885, 7.120, 6.594, 6.211, 5.921, 5.694, 5.513, 5.363, 5.239, 5.134, 5.044, 4.966, 4.897, 4.837, 4.784, 4.736, 4.693, 4.654, 4.619, 4.587, 4.558, 4.530, 4.506, 4.482, 4.461, 4.441, 4.422, 4.405, 4.389, 4.374, 4.359, 4.346, 4.333, 4.321, 4.309, 4.298, 4.288, 4.278, 4.269, 4.260, 4.252, 4.243, 4.236, 4.228, 4.221, 4.214, 4.208, 4.202, 4.196, 4.190, 4.184, 4.179, 4.174, 4.169, 4.164, 4.159, 4.155, 4.150, 4.146, 4.142, 4.138, 4.134, 4.130, 4.127, 4.123, 4.120, 4.117, 4.113, 4.110, 4.107, 4.104, 4.101, 4.099, 4.096, 4.093, 4.091, 4.088, 4.086, 4.083, 4.081, 4.079, 4.076, 4.074, 4.072, 4.070, 4.068, 4.066, 4.064, 4.062, 4.060, 4.059, 4.057, 4.055, 4.053 ]
// Student's t-distribution inverse for 99.99% probability by degrees of freedom.
const tInv99 = [ 1.571E-04, 1.414E-04, 1.360E-04, 1.333E-04, 1.317E-04, 1.306E-04, 1.299E-04, 1.293E-04, 1.289E-04, 1.285E-04, 1.282E-04, 1.280E-04, 1.278E-04, 1.276E-04, 1.274E-04, 1.273E-04, 1.272E-04, 1.271E-04, 1.270E-04, 1.269E-04, 1.268E-04, 1.268E-04, 1.267E-04, 1.266E-04, 1.266E-04, 1.265E-04, 1.265E-04, 1.265E-04, 1.264E-04, 1.264E-04, 1.263E-04, 1.263E-04, 1.263E-04, 1.263E-04, 1.262E-04, 1.262E-04, 1.262E-04, 1.262E-04, 1.261E-04, 1.261E-04, 1.261E-04, 1.261E-04, 1.261E-04, 1.260E-04, 1.260E-04, 1.260E-04, 1.260E-04, 1.260E-04, 1.260E-04, 1.260E-04, 1.259E-04, 1.259E-04, 1.259E-04, 1.259E-04, 1.259E-04, 1.259E-04, 1.259E-04, 1.259E-04, 1.259E-04, 1.259E-04, 1.258E-04, 1.258E-04, 1.258E-04, 1.258E-04, 1.258E-04, 1.258E-04, 1.258E-04, 1.258E-04, 1.258E-04, 1.258E-04, 1.258E-04, 1.258E-04, 1.258E-04, 1.258E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.257E-04, 1.256E-04, 1.256E-04 ]

type Stats = {
  n: number
  mean: number
  sqrErr: number
}

const square = (x: number) => x * x

const addSample = (s: Stats, x: number) => {
  const mean = s.mean + (x - s.mean) / (s.n + 1)
  const sqrErr = s.sqrErr + (x - s.mean) * (x - mean)
  // Reject outlier samples
  if (square(x - mean) * s.n <= square(3.890591886) * sqrErr) {
    s.n += 1;
    s.mean = mean
    s.sqrErr = sqrErr
  }
}

const variance = (s: Stats) => s.sqrErr / (s.n - 1)

// Welch's t-test
const welch = (
  bench: Benchmark,
  run1: Runner,
  run2: Runner,
  warmup: number,
  minSamples: number,
  maxSamples: number
) => {
  const input1 = run1.convert(bench.model, bench.options)
  const input2 = run2.convert(bench.model, bench.options)
  for (let i = 0; i < warmup; i++) {
    run1.solve(input1)
    run2.solve(input2)
  }
  const s1 = { n: 0, mean: 0, sqrErr: 0 }
  const s2 = { n: 0, mean: 0, sqrErr: 0 }
  for (let i = 1; i <= maxSamples; i++) {
    addSample(s1, time(run1, input1))
    addSample(s2, time(run2, input2))
    // variance / N = mean squared error?
    const mse1 = variance(s1) / s1.n
    const mse2 = variance(s2) / s2.n
    const t = Math.abs(s2.mean - s1.mean) / Math.sqrt(mse1 + mse2)
    const df =
      mse1 === 0 && mse2 === 0 ? 1
      : Math.floor((square(mse1 + mse2) / (square(mse1) / (s1.n - 1) + square(mse2) / (s2.n - 1))))

    const result =
      t > tInv01[Math.min(tInv01.length - 1, df)] ? t
      : t < tInv99[Math.min(tInv99.length - 1, df)] ? 0
      : NaN

    if (i >= minSamples && !Number.isNaN(result)) {
      const firstGreater = s1.mean >= s2.mean

      const [name1, name2] =
        firstGreater
        ? [run1.name, run2.name]
        : [run2.name, run1.name]

      const [mean1, mean2] =
        firstGreater
        ? [s1.mean, s2.mean]
        : [s2.mean, s1.mean]

      const percentFaster = (mean1 - mean2) / mean1 * 100.0

      console.log(`${name2} is ${percentFaster.toFixed(2)}% faster on average compared to ${name1} (t=${result.toFixed(2)}).`)
      console.table({
        [run1.name]: outputTable(s1, mse1),
        [run2.name]: outputTable(s2, mse2)
      })
      return
    }
  }
  console.log("max samples reached: equivalent performance")
}

const outputTable = (stats: Stats, mse: number) => ({
  n: stats.n,
  mean: parseFloat(stats.mean.toFixed(2)),
  stdErr: parseFloat(Math.sqrt(mse).toFixed(2))
})

const validate = (bench: Benchmark, run: Runner) => {
  const input = run.convert(bench.model, bench.options)
  const solution = run.solve(input)
  const result = run.value(solution)
  assertResultOptimal(result, bench)
}

const benchmark = (
  benchmarks: readonly Benchmark[],
  run1: Runner,
  run2: Runner,
  warmup = 0,
  minSamples = 10,
  maxSamples = 100,
  runValidation = true
) => {
  for (const bench of benchmarks) {
    if (runValidation) {
      validate(bench, run1)
      validate(bench, run2)
    }
    console.log(`${bench.file}: ${bench.constraints.length} constraints, ${bench.variables.length} variables, ${bench.model.integers?.length ?? 0} integers:`)
    welch(bench, run1, run2, warmup, minSamples, maxSamples)
    console.log("")
  }
}

/*
Take these synthetic benchmarks with a grain of salt;
performance is not always straightforward to measure.
Many various factors can have varying degrees of impact.
May I recommend: https://youtu.be/r-TLSBdHe1A?t=428
*/

// @ts-ignore
const benchmarkCheckCycles = () =>
  // Only Monster 2 seems to be affected when benchmarking all largeProblems,
  // but benchmarking Monster 2 by itself gives no performance difference?
  benchmark(benchmarks, yalpsRunner, {
    ...yalpsRunner,
    name: "Check Cycles",
    convert: (model, options) => ({ model, options: { ...options, checkCycles: true } })
  })

// @ts-ignore
const benchamrkjsLP = () => benchmark(benchmarks, yalpsRunner, jsLPRunner)

// @ts-ignore
const benchamrkGLPK = () => benchmark(benchmarks, yalpsRunner, glpkRunner)

// benchmarkCheckCycles()

// benchamrkjsLP()

// benchamrkGLPK()
