import { benchmark } from "./benchmark.js"
import { runners } from "./runners.js"
import { read as readJson } from "./json/read.js"
import { read as readNetlib } from "./netlib/read.js"

benchmark([...readJson(), ...readNetlib()], runners)

/*
Take these synthetic benchmarks with a grain of salt;
performance is not always straightforward to measure.
Many various factors can have varying degrees of impact.
May I recommend: https://youtu.be/r-TLSBdHe1A?t=428
*/

debugger
