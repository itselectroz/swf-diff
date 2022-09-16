import {
  AbcFile,
  InstanceInfo,
  InstructionDisassembler,
  MethodBodyInfo,
  MultinameInfo,
  MultinameKind,
  MultinameKindQName,
  TraitMethod,
  TraitsInfo,
  TraitSlot,
  TraitTypes,
} from "abc-disassembler";
import { readFileSync } from "fs";
import { join } from "path";
import { SWFFile } from "swf-parser";
import { calcPatch } from "./myers";
import { getABCFile } from "./util";

const assets = join(__dirname, "../assets");

const patch0608 = join(assets, "BrawlhallaAir.0608.swf");
const patch0608hotfix = join(assets, "BrawlhallaAir.0608.hotfix.swf");

const rawSWF = readFileSync(patch0608);
const rawSWF2 = readFileSync(patch0608hotfix);

const swf = SWFFile.load(rawSWF);
const swf2 = SWFFile.load(rawSWF2);

const abc: AbcFile = getABCFile(swf) as AbcFile;
const abc2: AbcFile = getABCFile(swf2) as AbcFile;

const disassembler = new InstructionDisassembler(abc);
const disassembler2 = new InstructionDisassembler(abc2);

if (!abc || !abc2) {
  throw new Error("No ABC file found");
}

const multinames = abc.constant_pool.multiname;
const multinames2 = abc2.constant_pool.multiname;

type XRef = {
  instances: InstanceInfo[];
  instance_traits: TraitsInfo[];
  class_traits: TraitsInfo[];
  code_references: MethodBodyInfo[];
};
type XRefCache = {
  [key: number]: XRef;
};

const xrefCache: XRefCache = [];
const xrefCache2: XRefCache = [];
async function buildXRef(file: AbcFile, cache: XRefCache) {
  const disass = new InstructionDisassembler(file);

  await Promise.all(
    file.constant_pool.multiname.map(async (v, i) => {
      cache[i] = {
        instances: [],
        instance_traits: [],
        class_traits: [],
        code_references: [],
      };
    })
  );

  await Promise.all([
    ...file.instance.map(async (v) => {
      const name = v.name;
      cache[name - 1].instances.push(v);

      v.trait.forEach((t) => {
        cache[t.name - 1].instance_traits.push(t);
      });
    }),
    ...file.class.map(async (v) => {
      v.traits.forEach((t) => {
        cache[t.name - 1].class_traits.push(t);
      });
    }),
    ...file.method_body.map(async (v) => {
      const instructions = disass.disassemble(v);

      instructions.forEach((instruction) => {
        for (let i = 0; i < instruction.types.length; i++) {
          const type = instruction.types[i];
          if (type === "multiname") {
            const rawIndex = instruction.rawParams[i];

            cache[rawIndex - 1].code_references.push(v);
          }
        }
      });
    }),
  ]);
}

function findMultiname(one: boolean, nameIndex: number): XRef {
  return (one ? xrefCache : xrefCache2)[nameIndex];
}

function compareTraits(trait: TraitsInfo, trait2: TraitsInfo) {
  if (trait.kind !== trait2.kind) return false;

  switch (trait.kind & 0xf) {
    case TraitTypes.Method: {
      const methodData = trait.data as TraitMethod;
      const methodData2 = trait2.data as TraitMethod;

      const method = abc.method[methodData.method];
      const method2 = abc2.method[methodData2.method];

      if (method.param_count !== method2.param_count) return false;
      if (method.flags !== method2.flags) return false;
      if (method.name !== method2.name && (!method.name || !method2.name))
        return false;

      const body = abc.method_body.find((v) => v.method == methodData.method);
      const body2 = abc2.method_body.find(
        (v) => v.method == methodData2.method
      );

      if (!!body && !!body2) {
        if (body.max_stack !== body2.max_stack) return false;
        if (body.local_count !== body2.local_count) return false;
        if (body.init_scope_depth !== body2.init_scope_depth) return false;
        if (body.max_scope_depth !== body2.max_scope_depth) return false;

        const instructions = disassembler.disassemble(body);
        const instructions2 = disassembler2.disassemble(body2);

        if (instructions.length !== instructions2.length) return false;

        for (let i = 0; i < instructions.length; i++) {
          const a = instructions[i];
          const b = instructions2[i];

          if (a.id !== b.id) return false;
        }
      }

      break;
    }

    case TraitTypes.Slot:
    case TraitTypes.Const: {
      const traitData = trait.data as TraitSlot;
      const traitData2 = trait2.data as TraitSlot;

      if (traitData.slot_id !== traitData2.slot_id) return false;

      if (!compare(traitData.type_name, traitData2.type_name)) return false;

      break;
    }
  }

  return true;
}

function compareQNames(
  a: MultinameInfo,
  b: MultinameInfo,
  indexA: number,
  indexB: number,
  roughComparison: boolean = false
) {
  const qname = a.data as MultinameKindQName;
  const qname2 = b.data as MultinameKindQName;

  if (!!qname.name && !!qname2.name) {
    const name = abc.constant_pool.string[qname.name - 1];
    const name2 = abc2.constant_pool.string[qname2.name - 1];

    const isObfuscated = name.startsWith("_-");
    const isObfuscated2 = name2.startsWith("_-");

    if (isObfuscated !== isObfuscated2) {
      return false;
    }

    if (!isObfuscated) {
      return name === name2;
    }
  }

  let data = findMultiname(true, indexA);
  let data2 = findMultiname(false, indexB);

  if (data.instances.length !== data2.instances.length) return false;

  if (data.instance_traits.length !== data2.instance_traits.length)
    return false;

  if (data.class_traits.length !== data2.class_traits.length) return false;

  if (roughComparison) return true;

  if (
    !data.instance_traits.every((v, i) =>
      compareTraits(v, data2.instance_traits[i])
    )
  )
    return false;

  if (
    !data.class_traits.every((v, i) => compareTraits(v, data2.class_traits[i]))
  )
    return false;

  if (data.code_references.length !== data2.code_references.length)
    return false;

  if (
    !data.code_references.every((body, i) => {
      const body2 = data2.code_references[i];

      const method = abc.method[body.method];
      const method2 = abc2.method[body2.method];

      if (method.flags !== method2.flags) return false;
      if (method.param_count !== method2.param_count) return false;

      return true;
    })
  )
    return false;

  return true;
}

function compare(
  iA: number,
  iB: number,
  roughComparison: boolean = false
): boolean {
  const a = multinames[iA];
  const b = multinames2[iB];

  if (a.kind !== b.kind) {
    return false;
  }

  switch (a.kind) {
    case MultinameKind.QName:
    case MultinameKind.QNameA:
      if (!compareQNames(a, b, iA, iB, roughComparison)) return false;
      break;
  }
  return true;
}

async function main() {
  const start = performance.now();

  await buildXRef(abc, xrefCache);
  await buildXRef(abc2, xrefCache2);

  const changes = Array.from(calcPatch(multinames, multinames2, compare));

  let insertions = 0;
  let deletions = 0;

  for (const change of changes) {
    const insert: any = change[2];

    if (!insert.length) {
      deletions++;
      console.log(
        `[${change[0].toString().padStart(6, "0")}]\x1b[31m - ${
          abc.constant_pool.string[(multinames[change[0]].data as any).name - 1]
        }\x1b[0m`
      );
    } else {
      insertions++;
      console.log(
        `[${change[0].toString().padStart(6, "0")}]\x1b[92m + ${
          abc2.constant_pool.string[insert[0].data.name - 1]
        }\x1b[0m`
      );
    }
  }

  const end = performance.now();

  console.log();
  console.log(`Statistics:`);
  console.log(`  Insertions: ${insertions}`);
  console.log(`  Deletions: ${deletions}`);
  console.log(`  Total: ${insertions + deletions}`);
  console.log(`  Delta: ${insertions - deletions}`);
  console.log(
    `  Multiname Difference: ${multinames2.length - multinames.length}`
  );
  console.log(`  Total time: ${end - start}ms`);
}

async function test() {
  await buildXRef(abc, xrefCache);
  await buildXRef(abc2, xrefCache2);

  let dupes = 0;
  for (let i = 0; i < multinames.length; i++) {
    let count = 0;
    for (let j = 0; j < multinames2.length; j++) {
      if (compare(i, j)) {
        count++;
      }
    }
    dupes += count > 1 ? 1 : 0;
    console.log(dupes);
  }
}

main();
// test();
