import {
  AbcFile,
  ClassInfo,
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
import { diff } from "./myers";
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

const cache: any[] = [];
function findMultiname(
  one: boolean,
  nameIndex: number
): {
  instances: InstanceInfo[];
  instance_traits: TraitsInfo[];
  class: ClassInfo[];
  class_traits: TraitsInfo[];
} {
  if (!!cache[nameIndex * 2 + (one ? 0 : 1)]) {
    return cache[nameIndex * 2 + (one ? 0 : 1)];
  }

  const file = one ? abc : abc2;

  const instance = file.instance;
  const classList = file.class;

  const data = {
    instances: [] as InstanceInfo[],
    instance_traits: [] as TraitsInfo[],
    class: [] as ClassInfo[],
    class_traits: [] as TraitsInfo[],
  };

  instance.forEach((v) => {
    if (v.name - 1 === nameIndex) data.instances.push(v);

    v.trait
      .filter((t) => t.name - 1 === nameIndex)
      .forEach((t) => data.instance_traits.push(t));
  });

  classList.forEach((v) => {
    v.traits
      .filter((t) => t.name - 1 === nameIndex)
      .forEach((t) => data.class_traits.push(t));
  });

  cache[nameIndex * 2 + (one ? 0 : 1)] = data;

  return data;
}

function compareNames(name: string, name2: string) {
  const isObfuscated = name.startsWith("_-");
  const isObfuscated2 = name2.startsWith("_-");

  if (isObfuscated !== isObfuscated2) {
    return false;
  }

  if (!isObfuscated && name !== name2) {
    return false;
  }

  return true;
}

const traitCache: any = {};
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

      if (!compare(traitData.type_name, traitData2.type_name, true))
        return false;
      // if (!compareTypeNames(traitData.type_name, traitData2.type_name))
      // compare vindex here

      break;
    }
  }

  if (!traitCache[trait.name]) traitCache[trait.name] = new Set();
  traitCache[trait.name].add(trait2.name);

  return true;
}

async function compareQNames(
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

    if (!compareNames(name, name2)) return false;
  }

  let data = findMultiname(true, indexA);
  let data2 = findMultiname(false, indexB);

  if (data.instances.length !== data2.instances.length) return false;

  if (data.instance_traits.length !== data2.instance_traits.length)
    return false;

  if (data.class.length !== data2.class.length) return false;

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

  // const codeData = await findMultinameInCode(true, indexA);
  // const codeData2 = await findMultinameInCode(false, indexB);

  // if (codeData.instance_traits.length !== codeData2.instance_traits.length)
  //   return false;
  // if (codeData.class_traits.length !== codeData2.class_traits.length)
  //   return false;

  // if (
  //   !codeData.instance_traits.every((v, i) =>
  //     compareTraits(v, codeData2.instance_traits[i])
  //   )
  // )
  //   return false;

  // if (
  //   !codeData.class_traits.every((v, i) =>
  //     compareTraits(v, codeData2.class_traits[i])
  //   )
  // )
  //   return false;

  return true;
}

async function compare(
  iA: number,
  iB: number,
  roughComparison: boolean = false
): Promise<boolean> {
  const a = multinames[iA];
  const b = multinames2[iB];

  if (a.kind !== b.kind) {
    return false;
  }

  switch (a.kind) {
    case MultinameKind.QName:
    case MultinameKind.QNameA:
      if (!(await compareQNames(a, b, iA, iB, roughComparison))) return false;
      break;
  }
  return true;
}

async function main() {
  const changes = await diff(multinames, multinames2, compare);
  for (const change of changes) {
    if (change.operation === "delete") {
      console.log(
        `[${change.position_old.toString().padStart(6, "0")}]\x1b[31m - ${
          abc.constant_pool.string[
            (multinames[change.position_old].data as any).name - 1
          ]
        }\x1b[0m`
      );
    } else {
      console.log(
        `[${change.position_old.toString().padStart(6, "0")}]\x1b[92m + ${
          abc2.constant_pool.string[
            (multinames2[change.position_new as number].data as any).name - 1
          ]
        }\x1b[0m`
      );
    }
  }
}

main();
