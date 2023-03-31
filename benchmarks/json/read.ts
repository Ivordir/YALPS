import { defaultOptions } from "../../src/index.js"
import { JsonTestCase } from "../../tests/helpers/read.js"
import { valueMapping } from "../../tests/helpers/util.js"
import { Benchmark } from "../benchmark.js"
import * as File from "node:fs"
import * as Path from "node:path"

const toMap = <T>(obj: { [key: string]: T }) => new Map(Object.entries(obj))

export const read = (): Benchmark[] =>
  File.readdirSync("benchmarks/json/cases").map(file => {
    const data = JSON.parse(File.readFileSync(`benchmarks/json/cases/${file}`, "utf-8")) as JsonTestCase

    const name = Path.parse(file).name
    const constraints = toMap(data.model.constraints)
    const variables = new Map(Object.entries(data.model.variables).map(valueMapping(toMap)))
    const model = {
      ...data.model,
      constraints,
      variables,
      integers: new Set(data.model.integers),
      binaries: new Set(data.model.binaries)
    }

    const options = { ...defaultOptions, ...data.options }
    const expected = data.expected.result

    return { name, model, options, expected }
  })
