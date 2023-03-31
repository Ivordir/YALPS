import { solve } from "../../src/index.js"
import { validSolution } from "../helpers/validate.js"
import { readCases, largeCases, TestCase } from "../helpers/read.js"
import test from "ava"

const testData: readonly TestCase[] = readCases(largeCases)

test("Validate additional test case solutions", t => {
  for (const data of testData) {
    const solution = solve(data.model, data.options)
    t.assert(validSolution(solution, data.expected.result, data.model, data.options))
  }
})
