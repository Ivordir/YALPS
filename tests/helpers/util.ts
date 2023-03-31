import { TupleArray } from "./read.js"

export const keys = <K, V>(array: TupleArray<K, V>) => array.map(([key, ]) => key)

export const valueMapping = <V1, V2, K>(mapping: (v: V1) => V2) =>
  ([key, value]: readonly [K, V1]): [K, V2] => [key, mapping(value)]

export const enumerate = <T>(array: readonly T[]) => array.map((x, i): [number, T] => [i, x])

// https://github.com/skeeto/hash-prospector
const prospectorHash = (x: number) => {
  x ^= x >>> 16
  x = Math.imul(x, 0x21f0aaad)
  x ^= x >>> 15
  x = Math.imul(x, 0xd35a2d97)
  x ^= x >>> 15
  return x
}

export const hashString = (s: string) => {
  let x = 42
  for (let i = 0; i < s.length; i++) {
    x = prospectorHash(x ^ s.charCodeAt(i))
  }
  return x
}

export const newRand = (seed: number) => () => {
  seed += 0x9e3779b9
  return (prospectorHash(seed) >>> 0) / 4294967296
}

export const randomIndex = (rand: () => number, array: readonly any[], startingIndex = 0) =>
  (rand() * (array.length - startingIndex) | 0) + startingIndex

export const randomElement = <T>(rand: () => number, array: readonly T[]) => array[randomIndex(rand, array)]

// Fisher-Yates shuffle
export const sample = <T>(rand: () => number, array: T[], n?: number) => {
  n ??= randomIndex(rand, array)
  for (let i = 0; i < n; i++) {
    const j = randomIndex(rand, array, i)
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
  return array.slice(0, n)
}
