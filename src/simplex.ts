import { Options, SolutionStatus } from "./types.js"
import { index, Tableau, update } from "./tableau.js"
import { roundToPrecision } from "./util.js"

const pivot = (tableau: Tableau, row: number, col: number) => {
  const quotient = index(tableau, row, col)
  const leaving = tableau.variableAtPosition[tableau.width + row]
  const entering = tableau.variableAtPosition[col]
  tableau.variableAtPosition[tableau.width + row] = entering
  tableau.variableAtPosition[col] = leaving
  tableau.positionOfVariable[leaving] = col
  tableau.positionOfVariable[entering] = tableau.width + row

  const nonZeroColumns: number[] = []
  // (1 / quotient) * R_pivot -> R_pivot
  for (let c = 0; c < tableau.width; c++) {
    const value = index(tableau, row, c)
    if (Math.abs(value) > 1e-16) {
      update(tableau, row, c, value / quotient)
      nonZeroColumns.push(c)
    } else {
      update(tableau, row, c, 0.0)
    }
  }
  update(tableau, row, col, 1.0 / quotient)

  // -M[r, col] * R_pivot + R_r -> R_r
  for (let r = 0; r < tableau.height; r++) {
    if (r === row) continue
    const coef = index(tableau, r, col)
    if (Math.abs(coef) > 1e-16) {
      for (let i = 0; i < nonZeroColumns.length; i++) {
        const c = nonZeroColumns[i]
        update(tableau, r, c, index(tableau, r, c) - coef * index(tableau, row, c))
      }
      update(tableau, r, col, -coef / quotient)
    }
  }
}

type PivotHistory = (readonly [row: number, col: number])[]

// Checks if the simplex method has encountered a cycle.
const hasCycle = (history: PivotHistory, tableau: Tableau, row: number, col: number) => {
  // This whole function seems somewhat inefficient,
  // but there was no? noticeable impact in the benchmarks.
  history.push([tableau.variableAtPosition[tableau.width + row], tableau.variableAtPosition[col]])
  // the minimum length of a cycle is 6
  for (let length = 6; length <= Math.trunc(history.length / 2); length++) {
    let cycle = true
    for (let i = 0; i < length; i++) {
      const item = history.length - 1 - i
      const [row1, col1] = history[item]
      const [row2, col2] = history[item - length]
      if (row1 !== row2 || col1 !== col2) {
        cycle = false
        break
      }
    }
    if (cycle) return true
  }
  return false
}

// Finds the optimal solution given some basic feasible solution.
const phase2 = (tableau: Tableau, options: Required<Options>): [SolutionStatus, number] => {
  const pivotHistory: PivotHistory = []
  const { precision, maxPivots, checkCycles } = options
  for (let iter = 0; iter < maxPivots; iter++) {
    // Find the entering column/variable
    let col = 0
    let value = precision
    for (let c = 1; c < tableau.width; c++) {
      const reducedCost = index(tableau, 0, c)
      if (reducedCost > value) {
        value = reducedCost
        col = c
      }
    }
    if (col === 0) return ["optimal", roundToPrecision(index(tableau, 0, 0), precision)]

    // Find the leaving row/variable
    let row = 0
    let minRatio = Infinity
    for (let r = 1; r < tableau.height; r++) {
      const value = index(tableau, r, col)
      if (value <= precision) continue // pivot entry must be positive
      const rhs = index(tableau, r, 0)
      const ratio = rhs / value
      if (ratio < minRatio) {
        row = r
        minRatio = ratio
        if (ratio <= precision) break // ratio is 0, lowest possible
      }
    }
    if (row === 0) return ["unbounded", col]

    if (checkCycles && hasCycle(pivotHistory, tableau, row, col)) return ["cycled", NaN]

    pivot(tableau, row, col)
  }
  return ["cycled", NaN]
}

// Transforms a tableau into a basic feasible solution.
const phase1 = (tableau: Tableau, options: Required<Options>): [SolutionStatus, number] => {
  const pivotHistory: PivotHistory = []
  const { precision, maxPivots, checkCycles } = options
  for (let iter = 0; iter < maxPivots; iter++) {
    // Find the leaving row/variable
    let row = 0
    let rhs = -precision
    for (let r = 1; r < tableau.height; r++) {
      const value = index(tableau, r, 0)
      if (value < rhs) {
        rhs = value
        row = r
      }
    }
    if (row === 0) return phase2(tableau, options)

    // Find the entering column/variable
    let col = 0
    let maxRatio = -Infinity
    for (let c = 1; c < tableau.width; c++) {
      const coefficient = index(tableau, row, c)
      if (coefficient < -precision) {
        const ratio = -index(tableau, 0, c) / coefficient
        if (ratio > maxRatio) {
          maxRatio = ratio
          col = c
        }
      }
    }
    if (col === 0) return ["infeasible", NaN]

    if (checkCycles && hasCycle(pivotHistory, tableau, row, col)) return ["cycled", NaN]

    pivot(tableau, row, col)
  }
  return ["cycled", NaN]
}

export { phase1 as simplex }
