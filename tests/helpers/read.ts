import { Constraint, OptimizationDirection, Options, Solution, defaultOptions } from "../../src/index.js"
import { hashString, lazy, valueMapping } from "./util.js"
import { Benchmark } from "../../benchmarks/benchmark.js"
import * as File from "node:fs"
import * as Path from "node:path"

type JsonTestCase = {
  readonly model: {
    readonly direction?: OptimizationDirection
    readonly objective?: string
    readonly constraints: Readonly<Record<string, Constraint>>
    readonly variables: Readonly<Record<string, Readonly<Record<string, number>>>>
    readonly integers?: readonly string[]
    readonly binaries?: readonly string[]
  }
  readonly options?: Options
  readonly expected: Readonly<Solution>
}

export type TupleArray<T1, T2> = readonly (readonly [T1, T2])[]

export type TestCase = {
  readonly name: string
  readonly model: {
    readonly hash: number
    readonly direction?: OptimizationDirection
    readonly objective?: string
    readonly constraints: TupleArray<string, Constraint>
    readonly variables: TupleArray<string, TupleArray<string, number>>
    readonly integers: ReadonlySet<string>
    readonly binaries: ReadonlySet<string>
  }
  readonly options: Required<Options>
  readonly expected: Readonly<Solution>
}

export const allCases = lazy(() => File.readdirSync("tests/cases").map(file => Path.parse(file).name))

export const largeCases: readonly string[] = [ "Monster 2", "Monster Problem", "Vendor Selection" ]

export const readCases = (cases?: readonly string[]): TestCase[] =>
  (cases ?? allCases()).map(file => {
    const data = JSON.parse(File.readFileSync(`tests/cases/${file}.json`, "utf-8")) as JsonTestCase

    // hash the test case name as the random seed for reproducible tests
    const hash = hashString(file)
    const constraints = Object.entries(data.model.constraints)
    const variables = Object.entries(data.model.variables).map(valueMapping(Object.entries))
    const integers = new Set(data.model.integers)
    const binaries = new Set(data.model.binaries)
    const model = { ...data.model, hash, constraints, variables, integers, binaries }
    const options = { ...defaultOptions, ...data.options }
    const result =
      data.expected.status === "optimal" ? data.expected.result
      : data.expected.status === "unbounded" ? Infinity * (data.model.direction === "minimize" ? -1.0 : 1.0)
      : NaN

    const expected = { ...data.expected, result }

    return { name: file, model, options, expected }
  })

export const testCases = lazy(() => readCases(allCases().filter(name => !largeCases.includes(name))))

const toArray = <K, V>(map: ReadonlyMap<K, V>) => Array.from(map.entries())

export const convertBenchmark = (benchmark: Benchmark): TestCase => {
  const model = {
    ...benchmark.model,
    hash: 0,
    constraints: toArray(benchmark.model.constraints),
    variables: toArray(benchmark.model.variables).map(valueMapping(toArray))
  }
  const expected: Solution = {
    status: "optimal",
    result: benchmark.expected,
    variables: []
  }
  return { ...benchmark, model, expected }
}

export const convertBenchmarks = (benchmarks: readonly Benchmark[]) => benchmarks.map(convertBenchmark)
