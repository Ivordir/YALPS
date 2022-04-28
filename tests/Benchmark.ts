import { performance } from "perf_hooks"
import * as File from "fs"
import { Model, Options, Solution, solve } from "../src/YALPS.js"
// @ts-ignore
import jslp from "javascript-lp-solver"
// @ts-ignore
import glpk from "glpk.js"

const GLPK: any = (glpk as any)()

type Benchmark = {
  readonly file: string
  readonly model: Model
  readonly options?: Options
  readonly expected: Solution
  readonly numConstraints: number
  readonly numVariables: number
  readonly numIntegers: number
}

const benchmarks: Benchmark[] =
  File.readdirSync("tests/cases").map(file => {
    const json = File.readFileSync("tests/cases/" + file) as any as string
    const data = JSON.parse(json)
    data.file = file
    data.options = data.options
    data.numConstraints = Object.entries(data.model.constraints).length
    data.numVariables = Object.entries(data.model.variables).length
    data.numIntegers = (data.model?.integers?.length ?? 0) + (data.model?.binaries?.length ?? 0)
    return data
  })

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

const yalpsTimer = (bench: Benchmark) => () => solve(bench.model, bench.options)

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

const jsLPSolve = (model: any, precision?: number) => jslp.Solve(model, precision)

const jsLPTimer = (bench: Benchmark) => {
  const model = jsLPModel(bench.model, bench.options)
  return () => jsLPSolve(model, bench.options?.precision)
}

const glpkModel = (model: Model) => {
  type Bounds = { type: number, ub: number, lb: number }
  type Coefs =  { name: string, coef: number }[]
  type Constraint = { name: string, vars: Coefs, bnds: Bounds }
  const constraints = new Map<string, Constraint>()
  for (const [name, constraint] of Object.entries(model.constraints)) {
    let bounds: Bounds
    if (constraint.equal == null) {
      const min = constraint.min != null
      const max = constraint.max != null
      bounds =
        min && max ? { type: GLPK.GLP_DB, ub: constraint.max, lb: constraint.min }
        : min && !max ? { type: GLPK.GLP_LO, ub: 0, lb: constraint.min }
        : !min && max ? { type: GLPK.GLP_UP, ub: constraint.max, lb: 0 }
        : { type: GLPK.GLP_FR, ub: 0, lb: 0 }
    } else {
      bounds = { type: GLPK.GLP_FX, ub: 0, lb: constraint.equal }
    }
    constraints.set(name, { name: name, vars: [], bnds: bounds })
  }

  const objective = []
  const hasObjective = "objective" in model
  for (const [name, variable] of Object.entries(model.variables)) {
    for (const [key, coef] of Object.entries(variable)) {
      if (hasObjective && model.objective === key) {
        objective.push({ name: name, coef: coef })
      }
      const constraint = constraints.get(key)
      if (constraint != null) {
        constraint.vars.push({ name: name, coef: coef as number })
      }
    }
  }

  return {
    name: "GLPK",
    objective: {
      direction: model.direction === "minimize" ? GLPK.GLP_MIN : GLPK.GLP_MAX,
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

const glpkSolve = (model: any, options?: any) => GLPK.solve(model, options)

const glpkTimer = (bench: Benchmark) => {
  const model = glpkModel(bench.model)
  const options = glpkOptions(bench.options)
  return () => glpkSolve(model, options)
}

const time = (f: () => any) => {
  const start = performance.now()
  f()
  const fin = performance.now()
  return fin - start
}

// The following Welch t-test code was adapted from Expecto: https://github.com/haf/expecto

/// Student's t-distribution inverse for 0.01% probability by degrees of freedom.
const tInv01 = [ 6366.198, 99.992, 28.000, 15.544, 11.178, 9.082, 7.885, 7.120, 6.594, 6.211, 5.921, 5.694, 5.513, 5.363, 5.239, 5.134, 5.044, 4.966, 4.897, 4.837, 4.784, 4.736, 4.693, 4.654, 4.619, 4.587, 4.558, 4.530, 4.506, 4.482, 4.461, 4.441, 4.422, 4.405, 4.389, 4.374, 4.359, 4.346, 4.333, 4.321, 4.309, 4.298, 4.288, 4.278, 4.269, 4.260, 4.252, 4.243, 4.236, 4.228, 4.221, 4.214, 4.208, 4.202, 4.196, 4.190, 4.184, 4.179, 4.174, 4.169, 4.164, 4.159, 4.155, 4.150, 4.146, 4.142, 4.138, 4.134, 4.130, 4.127, 4.123, 4.120, 4.117, 4.113, 4.110, 4.107, 4.104, 4.101, 4.099, 4.096, 4.093, 4.091, 4.088, 4.086, 4.083, 4.081, 4.079, 4.076, 4.074, 4.072, 4.070, 4.068, 4.066, 4.064, 4.062, 4.060, 4.059, 4.057, 4.055, 4.053 ]
/// Student's t-distribution inverse for 99.99% probability by degrees of freedom.
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
    s.n++
    s.mean = mean
    s.sqrErr = sqrErr
  }
}

const variance = (s: Stats) => s.sqrErr / (s.n - 1)

// Welch's t-test
const welch = (
  name1: string,
  f1: () => any,
  name2: string,
  f2: () => any,
  warmup: number,
  maxSamples: number
) => {
  for (let i = 0; i < warmup; i++) {
    f1()
    f2()
  }
  const s1 = { n: 0, mean: 0, sqrErr: 0 }
  const s2 = { n: 0, mean: 0, sqrErr: 0 }
  for (let i = 0; i < 3; i++) {
    addSample(s1, time(f1))
    addSample(s2, time(f2))
  }
  for (let i = 0; i < maxSamples; i++) {
    addSample(s1, time(f1))
    addSample(s2, time(f2))
    // variance / N = mean squared error?
    const mse1 = variance(s1) / s1.n
    const mse2 = variance(s2) / s2.n
    const t = (s1.mean - s2.mean) / Math.sqrt(mse1 + mse2)
    const df =
      mse1 === 0 && mse2 === 0 ? 1
      : Math.floor((square(mse1 + mse2) / (square(mse1) / (s1.n - 1) + square(mse2) / (s2.n - 1))))

    const result =
      Math.abs(t) > tInv01[Math.min(tInv01.length - 1, df)] ? t
      : Math.abs(t) < tInv99[Math.min(tInv99.length - 1, df)] ? 0
      : NaN

    if (!Number.isNaN(result)) {
      console.log(`t=${result.toFixed(2)}, ${name2} took ${((s2.mean / s1.mean - 1) * 100).toFixed(2)}% more time on average compared to ${name1}
${name2}: (n=${s2.n}, mean=${s2.mean.toFixed(2)}, stdErr=${Math.sqrt(mse2).toFixed(2)})
${name1}: (n=${s1.n}, mean=${s1.mean.toFixed(2)}, stdErr=${Math.sqrt(mse1).toFixed(2)})`)
      return
    }
  }
  console.log("maxSamples reached: equivalent performance")
}

const benchmark = (
  benchmarks: readonly Benchmark[],
  name1: string,
  f1: (bench: Benchmark) => (() => any),
  name2: string,
  f2: (bench: Benchmark) => (() => any),
  warmup = 0,
  maxSamples = 100) => {
  for (const bench of benchmarks) {
    console.log(`${bench.file}: ${bench.numConstraints} constraints, ${bench.numVariables} variables, ${bench.numIntegers} integers:`)
    welch(name1, f1(bench), name2, f2(bench), warmup, maxSamples)
    console.log("")
  }
}

/*
Take these synthetic benchmarks with a grain of salt;
performance is not always straightforward to measure.
Many various factors can have varying degrees of impact.
May I recommend: https://youtu.be/r-TLSBdHe1A?t=428
*/

const largeProblems = benchmarks.filter(bench => bench.numConstraints > 10 && bench.numVariables > 10)

// @ts-ignore
const benchmarkCheckCycles = () =>
  // only Monster 2 seems to be affected, and the performance hit is only ~16%.
  benchmark(largeProblems, "YALPS", yalpsTimer, "CheckCycles", bench => {
    const options = { ...bench.options, checkCycles: true }
    return () => solve(bench.model, options)
  }, 0, 30)

// @ts-ignore
const benchamrkjsLP = () => benchmark(largeProblems, "YALPS", yalpsTimer, "jsLPSolver", jsLPTimer)

// @ts-ignore
const benchamrkGLPK = () => benchmark(largeProblems, "YALPS", yalpsTimer, "GLPK", glpkTimer)

// benchmarkCheckCycles()

// benchamrkjsLP()

// benchamrkGLPK()
