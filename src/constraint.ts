import { Constraint } from "./types.js"

/**
 * Returns a `Constraint` that specifies something should be less than or equal to `value`.
 * Equivalent to `{ max: value }`.
 */
export const lessEq = (value: number): Constraint => ({ max: value })

/**
 * Returns a `Constraint` that specifies something should be greater than or equal to `value`.
 * Equivalent to `{ min: value }`.
 */
export const greaterEq = (value: number): Constraint => ({ min: value })

/**
 * Returns a `Constraint` that specifies something should be exactly equal to `value`.
 * Equivalent to `{ equal: value }`.
 */
export const equalTo = (value: number): Constraint => ({ equal: value })

/**
 * Returns a `Constraint` that specifies something should be between `lower` and `upper` (both inclusive).
 * Equivalent to `{ min: lower, max: upper }`.
 */
export const inRange = (lower: number, upper: number): Constraint => ({ min: lower, max: upper })
