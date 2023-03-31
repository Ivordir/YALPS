import { Constraint, OptimizationDirection, Options } from "../src/index.js"
import { performance } from "node:perf_hooks"
import { strict as assert } from "node:assert"

export type Runner = {
  readonly name: string,
  readonly convert: (model: BenchModel, options: Required<Options>) => any
  readonly solve: (input: any) => any
  readonly value: (solution: any) => number
}

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
