import { Benchmark, benchmark } from "./benchmark.js"
import { runners } from "./runners.js"
import { readBenchmarks as readJson } from "./json/read.js"
import { readBenchmarks as readNetlib } from "./netlib/read.js"

// current selection of netlib benchmarks included in the README
const netlibSelection: readonly string[] = [
  "AGG2", "BEACONFD", "SC205", "SCFXM1", "SCRS8", "SC205", "SCTAP2", "SHIP08S"
]

const benchmarks: readonly Benchmark[] = [ ...readJson(), ...readNetlib(netlibSelection) ]

benchmark(benchmarks, runners)

/*
Take these synthetic benchmarks with a grain of salt;
performance is not always straightforward to measure.
Many various factors can have varying degrees of impact.
May I recommend: https://youtu.be/r-TLSBdHe1A?t=428
*/
