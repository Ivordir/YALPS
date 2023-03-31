import { defaultOptions } from "../../src/index.js"
import { readCases, largeCases } from "../../tests/helpers/read.js"
import { valueMapping } from "../../tests/helpers/util.js"
import { Benchmark } from "../benchmark.js"

export const readBenchmarks = (): Benchmark[] =>
  readCases([ ...largeCases, "Large Farm MIP" ]).map(data => {
    const name = data.name

    const constraints = new Map(data.model.constraints)
    const variables = new Map(data.model.variables.map(valueMapping(x => new Map(x))))
    const model = {
      ...data.model,
      constraints,
      variables
    }

    const options = { ...defaultOptions, ...data.options }
    const expected = data.expected.result

    return { name, model, options, expected }
  })
