import { AbcFile } from "abc-disassembler";
import { ArrayChange } from "diff";
import { readFileSync } from "fs";
import { join } from "path";
import { SWFFile } from "swf-parser";

import { Comparator } from "./comparator";
import { getABCFile, round } from "./util";

const assets = join(__dirname, "../assets");

const june = join(assets, "BrawlhallaAir - techtest - 2023-06-14.swf");
const july = join(assets, "BrawlhallaAir - techtest - 2023-07-12.swf");
const august = join(assets, "BrawlhallaAir - techtest - 2023-08-09.swf");

const rawSWF = readFileSync(june);
const rawSWF2 = readFileSync(august);

const swf = SWFFile.load(rawSWF);
const swf2 = SWFFile.load(rawSWF2);

const abc: AbcFile = getABCFile(swf) as AbcFile;
const abc2: AbcFile = getABCFile(swf2) as AbcFile;

if (!abc || !abc2) {
  throw new Error("No ABC file found");
}

const multinames = abc.constant_pool.multiname;
const multinames2 = abc2.constant_pool.multiname;

function printChanges(
  changes: ArrayChange<{
    type: number;
    index: number;
  }>[]
) {
  let oI = 0;
  let pending = 0;
  for (const change of changes) {
    if (change.removed) {
      for (const data of change.value) {
        console.log(
          `[${oI.toString().padStart(6, "0")}]\x1b[31m - ${
            abc.constant_pool.string[
              (multinames[data.index].data as any).name - 1
            ]
          }\x1b[0m`
        );
      }
    } else if (change.added) {
      for (const data of change.value) {
        console.log(
          `[${oI.toString().padStart(6, "0")}]\x1b[92m + ${
            abc2.constant_pool.string[
              (multinames2[data.index].data as any).name - 1
            ]
          }\x1b[0m`
        );
      }

      if (pending === change.count) {
        console.log("DETECETD CHANGE");
      }
    }
    if (!change.added && !change.removed) {
      oI += (change.count || 0) + pending;
      pending = 0;
    } else if (change.removed) {
      pending += change.count || 0;
    }
  }
}

async function main() {
  const start = performance.now();
  const originalMem = process.memoryUsage();

  const comparator = new Comparator(abc, abc2);
  await comparator.buildCaches();

  const cacheMemory = process.memoryUsage();

  const changes = comparator.diff();

  const end = performance.now();
  const mem = process.memoryUsage();

  printChanges(changes);

  const insertions = changes
    .filter((v) => v.added)
    .reduce((pv, v) => pv + (v.count || 0), 0);
  const deletions = changes
    .filter((v) => v.removed)
    .reduce((pv, v) => pv + (v.count || 0), 0);

  console.log();
  console.log(`Statistics:`);
  console.log(`  Insertions: ${insertions}`);
  console.log(`  Deletions: ${deletions}`);
  console.log(`  Total: ${insertions + deletions}`);
  console.log(`  Delta: ${insertions - deletions}`);
  console.log(
    `  Multiname Difference: ${multinames2.length - multinames.length} (${multinames2.length} - ${multinames.length}})`
  );

  console.log();

  console.log("Performance:");
  console.log(`  Total time: ${round(end - start, 2)}ms`);
  console.log(
    `  Cache Memory: ${round(
      (cacheMemory.heapUsed - originalMem.heapUsed) / 1024 / 1024,
      2
    )}MB`
  );
  console.log(
    `  Comparison Cache Memory: ${round(
      (mem.heapUsed - cacheMemory.heapUsed) / 1024 / 1024,
      2
    )}MB`
  );
  console.log(`  Total Memory: ${round(mem.heapUsed / 1024 / 1024, 2)}MB`);
}

async function test() {
  const comparator = new Comparator(abc, abc2);
  await comparator.buildCaches();

  const changes = comparator.diff();

  const mappings = comparator.generateSymbolMapping(changes);

  let ohFuck = multinames.map((_, i) => i).filter((i) => mappings[i] === undefined)

  console.log(`Failed to map ${ohFuck.length} symbols`);

  comparator.setSymbolMapping(mappings);
}

// main();
test();
