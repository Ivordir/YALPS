import { OptimizationDirection } from "../src/index.js"

// Reads and parses a MPS file
// OBJSENSE, OBJNAME, and SOS sections are not supported
// Comments must have an asterisk (*) at the start of the line
// Comments can also be placed after column 61
// Each column/variable is assumed to have only one entry in the BOUNDS section
// except for a pair of (LO and UP) or (LI and UI).

type ConstraintType = "L" | "G" | "E" | "N"

export type Bounds = [number, number]

export type ModelFromMPS = {
  name: string
  direction: OptimizationDirection
  objective?: string
  constraints: Map<string, Bounds>
  variables: Map<string, Map<string, number>>
  bounds: Map<string, Bounds>
  integers: Set<string>
  binaries: Set<string>
}

type ParseState = {
  readonly lines: string[]
  index: number
  readonly constraintTypes: Map<string, ConstraintType>
}

const field1 = (line: string) => line.substring(1, 3).trim()
const field2 = (line: string) => line.substring(4, 12).trim()
const field3 = (line: string) => line.substring(14, 22).trim()
const field4 = (line: string) => line.substring(24, 36).trim()
const field5 = (line: string) => line.substring(39, 47).trim()
const field6 = (line: string) => line.substring(49, 61).trim()

const err = (msg: string) => new Error(msg)

const readName = (s: ParseState, m: ModelFromMPS) => {
  const i = s.lines.findIndex(line => line.startsWith("NAME"))
  if (i < 0) return err("No NAME section was found")
  m.name = field3(s.lines[i])
  s.index = i + 1
  return readRows(s, m)
}

const notSectionEnd = (line: string | undefined): line is string => line !== undefined && line.startsWith(' ')

const nextLine = (s: ParseState) => {
  for (let i = s.index + 1; i < s.lines.length; i++) {
    if (!s.lines[i].startsWith('*')) {
      s.index = i
      return s.lines[i]
    }
  }
  return undefined
}

const readSection = (s: ParseState): string | undefined => s.lines[s.index]?.trimEnd()

const sectionErr = (expected: string, section: string | undefined) =>
  err(`Expected section ${expected} but got ${section === undefined ? "end of file" : `'${section}'`}`)

const expectSection = (s: ParseState, section: string) => {
  const name = readSection(s)
  return name === section ? null : sectionErr(section, name)
}

const readRows = (s: ParseState, m: ModelFromMPS) => {
  const sectionErr = expectSection(s, "ROWS")
  if (sectionErr != null) return sectionErr

  for (let line = nextLine(s); notSectionEnd(line); line = nextLine(s)) {
    // warn/error on extra fields5 or field6?

    const name = field2(line)
    if (name === "") return err(`Missing row name`)
    if (s.constraintTypes.has(name)) return err(`The row '${name}' was already defined`)

    const type = field1(line)
    switch (type) {
      case "L": m.constraints.set(name, [-Infinity, 0.0]); break
      case "G": m.constraints.set(name, [0.0, Infinity]); break
      case "E": m.constraints.set(name, [0.0, 0.0]); break
      case "N":
        m.objective ??= name
        m.constraints.set(name, [-Infinity, Infinity])
        break
      case "": return err(`Missing row type`)
      default: return err(`Unexpected row type '${type}'`)
    }
    s.constraintTypes.set(name, type)
  }

  return readColumns(s, m)
}

const addCoefficient = (s: ParseState, variable: Map<string, number>, row: string, value: string) => {
  if (row === "") return err("Missing row name")
  if (value === "") return err("Missing coefficient value")
  if (!s.constraintTypes.has(row)) return err(`The row '${row}' was not defined in the ROWS section`)
  if (variable.has(row)) return err(`The coefficient for row '${row}' was previously set for this column`)

  const val = parseFloat(value)
  if (Number.isNaN(val)) return err(`Failed to parse number '${value}'`)

  variable.set(row, val)

  return null
}

const readColumns = (s: ParseState, m: ModelFromMPS) => {
  const sectionErr = expectSection(s, "COLUMNS")
  if (sectionErr != null) return sectionErr

  let integerMarked = false
  let line = nextLine(s)
  while (notSectionEnd(line)) {
    if (field3(line) === "'MARKER'") {
      const marker = field4(line)
      switch (marker) {
        case "'INTORG'": integerMarked = true; break
        case "'INTEND'": integerMarked = false; break
        default: return err(`Unexpected MARKER '${marker}'`)
      }
      line = nextLine(s)
      continue
    }

    const name = field2(line)
    if (name === "") return err("Missing column name")
    if (m.variables.has(name)) return err(`Values for the column '${name}' were previously provided -- all values for a column must come consecutively`)

    const variable = new Map<string, number>()
    do {
      // warn/error on extra field1?

      const err1 = addCoefficient(s, variable, field3(line), field4(line))
      if (err1 != null) return err1

      const name2 = field5(line)
      const value2 = field6(line)
      if (name2 !== "" || value2 !== "") {
        const err2 = addCoefficient(s, variable, name2, value2)
        if (err2 != null) return err2
      }

      line = nextLine(s)
    } while (notSectionEnd(line) && field2(line) === name)

    m.variables.set(name, variable)
    if (integerMarked) m.integers.add(name)
  }

  return readRHS(s, m)
}

const addConstraint = (s: ParseState, m: ModelFromMPS, row: string, value: string) => {
  if (row === "") return err("Missing row name")
  if (value === "") return err("Missing rhs value")

  const type = s.constraintTypes.get(row)
  if (type === undefined) return err(`The row '${row}' was not defined in the ROWS section`)

  const val = parseFloat(value)
  if (Number.isNaN(val)) return err(`Failed to parse number '${value}'`)

  // ignore duplicates?
  const constraint = m.constraints.get(row) as Bounds
  if (type === "L" || type === "E") constraint[1] = val
  if (type === "G" || type === "E") constraint[0] = val

  return null
}

const readRHS = (s: ParseState, m: ModelFromMPS) => {
  const error = expectSection(s, "RHS")
  if (error != null) return error

  for (let line = nextLine(s); notSectionEnd(line); line = nextLine(s)) {
    // warn/error on extra field1?
    // const name = field2(line) // ignore rhs name?

    const err1 = addConstraint(s, m, field3(line), field4(line))
    if (err1 != null) return err1

    const name2 = field5(line)
    const value2 = field6(line)
    if (name2 !== "" || value2 !== "") {
      const err2 = addConstraint(s, m, name2, value2)
      if (err2 != null) return err2
    }
  }

  const section = readSection(s)
  switch (section) {
    case "RANGES": return readRanges(s, m)
    case "BOUNDS": return readBounds(s, m)
    case "ENDATA": return null
    default: return sectionErr("RANGES, BOUNDS, or ENDATA", section)
  }
}

const addRange = (s: ParseState, m: ModelFromMPS, row: string, value: string) => {
  if (row === "") return err("Missing row name")
  if (value === "") return err("Missing range value")

  const type = s.constraintTypes.get(row)
  if (type === undefined) return err(`The row '${row}' was not defined in the ROWS section`)

  const val = parseFloat(value)
  if (Number.isNaN(val)) return err(`Failed to parse number '${value}'`)

  const bounds = m.constraints.get(row) as Bounds
  // ignore duplicates?
  if (type === "L" || (type === "E" && val < 0.0)) bounds[0] = bounds[1] - Math.abs(val)
  if (type === "G" || (type === "E" && val > 0.0)) bounds[1] = bounds[0] + Math.abs(val)

  return null
}

const readRanges = (s: ParseState, m: ModelFromMPS) => {
  for (let line = nextLine(s); notSectionEnd(line); line = nextLine(s)) {
    // warn/error on extra field1?
    // const name = field2(line) // ignore range name?

    const err1 = addRange(s, m, field3(line), field4(line))
    if (err1 != null) return err1

    const name2 = field5(line)
    const value2 = field6(line)
    if (name2 !== "" || value2 !== "") {
      const err2 = addRange(s, m, name2, value2)
      if (err2 != null) return err2
    }
  }

  const section = readSection(s)
  switch (section) {
    case "BOUNDS": return readBounds(s, m)
    case "ENDATA": return null
    default: return sectionErr("BOUNDS or ENDATA", section)
  }
}

const setBounds = ({ bounds }: ModelFromMPS, name: string, lower: number, upper: number) => {
  const bnds = (bounds.has(name) ? bounds : bounds.set(name, [0.0, Infinity])).get(name) as Bounds
  if (!Number.isNaN(lower)) bnds[0] = lower
  if (!Number.isNaN(upper)) bnds[1] = upper
}

const readBounds = (s: ParseState, m: ModelFromMPS) => {
  for (let line = nextLine(s); notSectionEnd(line); line = nextLine(s)) {
    // warn on extra field5 or field6?
    // const name = field2(line) // ignore bounds name?
    const type = field1(line)

    const col = field3(line)
    if (col === "") return err("Mising column name")
    if (!m.variables.has(col)) return err(`The column '${col}' was not defined in the COLUMNS section`)

    let val = NaN
    if (["LO", "UP", "FX", "LI", "UI"].includes(type)) {
      const value = field4(line)
      if (value === "") return err("Missing bound value")
      val = parseFloat(value)
      if (Number.isNaN(val)) return err(`Failed to parse number '${value}'`)
    }

    switch (type) {
      case "LO": setBounds(m, col, val, Infinity); break
      case "UP": setBounds(m, col, 0.0, val); break
      case "FX": setBounds(m, col, val, val); break
      case "FR": setBounds(m, col, -Infinity, Infinity); break
      case "MI": setBounds(m, col, -Infinity, 0.0); break
      case "PL": setBounds(m, col, 0.0, Infinity); break
      case "BV": m.binaries.add(col); break
      case "LI":
        m.integers.add(col)
        setBounds(m, col, val, Infinity)
        break
      case "UI":
        m.integers.add(col)
        setBounds(m, col, 0.0, val)
        break
      case "SC": return err("SC bound type is unsupported")
      case "": return err("Missing bound type")
      default: return err(`Unexpected bound type '${type}'`)
    }
  }

  return expectSection(s, "ENDATA")
}

export const modelFromMps = (mps: string, direction: OptimizationDirection): ModelFromMPS => {
  const parseState = {
    lines: mps.split(/\r?\n/),
    index: 0,
    constraintTypes: new Map<string, ConstraintType>()
  }

  const model = {
    name: "",
    direction,
    constraints: new Map<string, Bounds>(),
    variables: new Map<string, Map<string, number>>(),
    integers: new Set<string>(),
    binaries: new Set<string>(),
    bounds: new Map<string, Bounds>()
  }

  const error = readName(parseState, model)
  if (error != null) throw new Error(`Line ${parseState.index + 1}: ${error.message}`)

  return model
}
