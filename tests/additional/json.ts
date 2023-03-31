import { solve } from "../../src/index.js"
import { validSolution } from "../helpers/validate.js"
import { convertBenchmarks } from "../helpers/read.js"
import { read } from "../../benchmarks/json/read.js"
import test from "ava"

const testData = convertBenchmarks(read())

test("Validate additional test case solutions", t => {
  for (const data of testData) {
    const solution = solve(data.model, data.options)
    t.assert(validSolution(solution, data.expected.result, data.model, data.options))
  }
})
