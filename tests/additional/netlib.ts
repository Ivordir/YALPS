import { solve } from "../../src/index.js"
import { validSolution } from "../helpers/validate.js"
import { TestCase, convertBenchmarks } from "../helpers/read.js"
import { readBenchmarks } from "../../benchmarks/netlib/read.js"
import test from "ava"

const testData: readonly TestCase[] = convertBenchmarks(readBenchmarks())

test("Validate netlib solutions", t => {
  for (const data of testData) {
    const solution = solve(data.model, data.options)
    t.assert(validSolution(solution, data.expected.result, data.model, data.options))
  }
})
