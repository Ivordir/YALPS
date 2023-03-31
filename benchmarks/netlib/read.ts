import { Constraint, defaultOptions, Options } from "../../src/index.js"
import { Benchmark } from "../benchmark.js"
import { ModelFromMPS, modelFromMps } from "../mps.js"
import * as File from "node:fs"

type IndexEntry = {
  name: string
  rows: number
  cols: number
  value: number | null
  options?: Options
}

const readIndex = (): IndexEntry[] => JSON.parse(File.readFileSync("benchmarks/netlib/index.json", "utf-8"))

const convertConstraints = (map: ModelFromMPS["constraints"]) => {
  const constraints = new Map<string, Constraint>()
  for (const [key, [min, max]] of map) {
    if (Number.isFinite(min) && Number.isFinite(max)) {
      constraints.set(key, min === max ? { equal: min } : { min, max })
    } else if (Number.isFinite(min)) {
      constraints.set(key, { min })
    } else if (Number.isFinite(max)) {
      constraints.set(key, { max })
    }
  }
  return constraints
}

export const readBenchmarks = (benchmarks?: readonly string[]): Benchmark[] =>
  readIndex()
  .filter(b => !timeout.includes(b.name))
  .filter(b => benchmarks === undefined || benchmarks.includes(b.name))
  .filter(b => b.rows * b.cols <= 6_400_000) // solver is not yet intended for problems larger than this
  .filter(b => b.rows * b.cols >= 10_000) // problems of significant size worth benchmarking
  .map(benchmark => {
    try {
      const mps = File.readFileSync(`benchmarks/netlib/cases/${benchmark.name.toLowerCase()}.mps`, "utf-8")
      const mpsModel = modelFromMps(mps, "minimize")
      const constraints = convertConstraints(mpsModel.constraints)
      const model = { ...mpsModel, constraints }
      const options = { ...defaultOptions, ...benchmark.options }
      return { name: model.name, expected: benchmark.value ?? NaN, model, options }
    } catch {
      console.log(`Failed to parse ${benchmark.name}`)
      return null
    }
  })
  .filter((x): x is Exclude<typeof x, null> => x != null)
  .filter(bench => bench.model.bounds.size === 0) // bounds are currently unsupported

// of the benchmarks not filtered out by the function above,
// these are the problems YALPS and jsLPSolver currently cannot handle
// @ts-ignore
export const timeout: readonly string[] = [
  "25FV47", "AGG", "BANDM", "BNL1", "BRANDY", "DEGEN2", "DEGEN3", "E226",
  "FFFFF800", "SCFXM2", "SCFXM3", "SCSD1", "SCSD8", "STOCFOR2",
  "WOOD1P", "KLEIN3"
]

// @ts-ignore
export const ok: readonly string[] = [
  "AGG2", "AGG3", "BEACONFD", "ISRAEL", "LOTFI", "SC105", "SC205", "SCAGR25", "SCAGR7",
  "SCFXM1", "SCORPION", "SCRS8", "SCSD6", "SCTAP1", "SCTAP2", "SCTAP3", "SHARE1B",
  "SHIP04L", "SHIP04S", "SHIP08L", "SHIP08S", "SHIP12S", "SHIP12L", "STOCFOR1",
  "KLEIN2"
]
