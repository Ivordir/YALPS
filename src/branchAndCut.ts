import { Options, SolutionStatus } from "./types.js"
import { index, Tableau, TableauModel } from "./tableau.js"
import { simplex } from "./simplex.js"
import Heap from "heap"

type Buffer = {
  readonly matrix: Float64Array
  readonly positionOfVariable: Int32Array
  readonly variableAtPosition: Int32Array
}

const buffer = (matrixLength: number, posVarLength: number): Buffer => ({
  matrix: new Float64Array(matrixLength),
  positionOfVariable: new Int32Array(posVarLength),
  variableAtPosition: new Int32Array(posVarLength)
})

type Cut = readonly [sign: number, variable: number, value: number]
type Branch = readonly [eval: number, cuts: readonly Cut[]]

// Creates a new tableau with additional cut constraints from a buffer.
const applyCuts = (
  tableau: Tableau,
  { matrix, positionOfVariable, variableAtPosition }: Buffer,
  cuts: readonly Cut[]
): Tableau => {
  const { width, height } = tableau
  matrix.set(tableau.matrix)
  for (let i = 0; i < cuts.length; i++) {
    const [sign, variable, value] = cuts[i]
    const r = (height + i) * width
    const pos = tableau.positionOfVariable[variable]
    if (pos < width) {
      matrix[r] = sign * value
      matrix.fill(0.0, r + 1, r + width)
      matrix[r + pos] = sign
    } else {
      const row = (pos - width) * width
      matrix[r] = sign * (value - matrix[row])
      for (let c = 1; c < width; c++) {
        matrix[r + c] = -sign * matrix[row + c]
      }
    }
  }

  positionOfVariable.set(tableau.positionOfVariable)
  variableAtPosition.set(tableau.variableAtPosition)
  const length = width + height + cuts.length
  for (let i = width + height; i < length; i++) {
    positionOfVariable[i] = i
    variableAtPosition[i] = i
  }

  return {
    matrix: matrix.subarray(0, tableau.matrix.length + width * cuts.length),
    width,
    height: height + cuts.length,
    positionOfVariable: positionOfVariable.subarray(0, length),
    variableAtPosition: variableAtPosition.subarray(0, length)
  }
}

// Finds the integer variable with the most fractional value.
const mostFractionalVar = (
  tableau: Tableau,
  intVars: readonly number[]
): [variable: number, value: number, frac: number] => {
  let highestFrac = 0.0
  let variable = 0
  let value = 0.0
  for (let i = 0; i < intVars.length; i++) {
    const intVar = intVars[i]
    const row = tableau.positionOfVariable[intVar] - tableau.width
    if (row < 0) continue

    const val = index(tableau, row, 0)
    const frac = Math.abs(val - Math.round(val))
    if (frac > highestFrac) {
      highestFrac = frac
      variable = intVar
      value = val
    }
  }
  return [variable, value, highestFrac]
}

// Runs the branch and cut algorithm to solve an integer problem.
// Requires the non-integer solution as input.
export const branchAndCut = <VarKey, ConKey>(
  tabmod: TableauModel<VarKey, ConKey>,
  initResult: number,
  options: Required<Options>
): [TableauModel<VarKey, ConKey>, SolutionStatus, number] => {
  const { tableau, sign, integers } = tabmod
  const { precision, maxIterations, tolerance, timeout } = options
  const [initVariable, initValue, initFrac] = mostFractionalVar(tableau, integers)
  // Wow, the initial solution is integer
  if (initFrac <= precision) return [tabmod, "optimal", initResult]

  const branches = new Heap<Branch>((x, y) => x[0] - y[0])
  branches.push([initResult, [[-1, initVariable, Math.ceil(initValue)]]])
  branches.push([initResult, [[1, initVariable, Math.floor(initValue)]]])

  // Set aside arrays/buffers to be reused over the course of the algorithm.
  // One set of buffers stores the state of the currrent best solution.
  // The other is used to solve the current candidate solution.
  // The two buffers are "swapped" once a new best solution is found.
  const maxExtraRows = integers.length * 2
  const matrixLength = tableau.matrix.length + maxExtraRows * tableau.width
  const posVarLength = tableau.positionOfVariable.length + maxExtraRows
  let candidateBuffer = buffer(matrixLength, posVarLength)
  let solutionBuffer = buffer(matrixLength, posVarLength)

  const optimalThreshold = initResult * (1.0 - sign * tolerance)
  const stopTime = timeout + Date.now()
  let timedout = Date.now() >= stopTime // in case options.timeout <= 0
  let solutionFound = false
  let bestEval = Infinity
  let bestTableau = tableau
  let iter = 0

  while (iter < maxIterations && !branches.empty() && bestEval >= optimalThreshold && !timedout) {
    const [relaxedEval, cuts] = branches.pop()!
    if (relaxedEval > bestEval) break // the remaining branches are worse than the current best solution

    const currentTableau = applyCuts(tableau, candidateBuffer, cuts)
    const [status, result] = simplex(currentTableau, options)
    // The initial tableau is not unbounded and adding more cuts/constraints cannot make it become unbounded
    // assert(status !== "unbounded")
    if (status === "optimal" && result < bestEval) {
      const [variable, value, frac] = mostFractionalVar(currentTableau, integers)
      if (frac <= precision) {
        // The solution is integer
        solutionFound = true
        bestEval = result
        bestTableau = currentTableau
        const temp = solutionBuffer
        solutionBuffer = candidateBuffer
        candidateBuffer = temp
      } else {
        const cutsUpper: Cut[] = []
        const cutsLower: Cut[] = []
        for (let i = 0; i < cuts.length; i++) {
          const cut = cuts[i]
          const [dir, v] = cut
          if (v === variable) {
            dir < 0 ? cutsLower.push(cut) : cutsUpper.push(cut)
          } else {
            cutsUpper.push(cut)
            cutsLower.push(cut)
          }
        }
        cutsLower.push([1, variable, Math.floor(value)])
        cutsUpper.push([-1, variable, Math.ceil(value)])
        branches.push([result, cutsUpper])
        branches.push([result, cutsLower])
      }
    }
    // Otherwise, this branch's result is worse than the current best solution.
    // This could be because this branch is infeasible or cycled.
    // Either way, skip this branch and see if any other branches have a valid, better solution.
    timedout = Date.now() >= stopTime
    iter++
  }

  // Did the solver "timeout"?
  const unfinished = (timedout || iter >= maxIterations) && !branches.empty() && bestEval >= optimalThreshold

  // prettier-ignore
  const status =
    unfinished ? "timedout"
    : !solutionFound ? "infeasible"
    : "optimal"

  return [{ ...tabmod, tableau: bestTableau }, status, solutionFound ? bestEval : NaN]
}
