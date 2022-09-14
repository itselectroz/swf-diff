import { readFileSync } from "fs";
import { join } from "path";
import { SWFFile } from "swf-parser";
import {
  AbcFile,
  ExtendedBuffer,
  InstanceInfo,
  MultinameKindQName,
  TraitMethod,
  TraitTypes,
} from "abc-disassembler";
import { DiffComparator } from "./diff-comparator";
import { comparableTypes, Comparator } from "./comparator";

const path =
  "/Users/harrywhittle/Library/Application Support/Steam/steamapps/common/Brawlhalla/Brawlhalla.app/Contents/Resources";

// const rawSWF = readFileSync(join(path, "BrawlhallaAir.swf"));
// const rawSWF2 = readFileSync(join(path, "BrawlhallaAir old.swf"));
const rawSWF = readFileSync(
  "/Users/harrywhittle/repos/brawlhalla-source/bin/Brawlhalla.app/Contents/Resources/BrawlhallaAir.original.swf"
);
const rawSWF2 = readFileSync(join(path, "BrawlhallaAir.swf"));

const swf = SWFFile.load(rawSWF);
const swf2 = SWFFile.load(rawSWF2);

function getABCFile(swfFile: SWFFile): false | AbcFile {
  for (const tag of swfFile.tags) {
    if (tag.type == 72) {
      const abcData = tag.data;
      return AbcFile.read(new ExtendedBuffer(abcData)) as AbcFile;
    }
  }

  return false;
}

const res1 = getABCFile(swf);
const res2 = getABCFile(swf2);

if (!res1 || !res2) {
  console.log(res2);
  throw new Error("Could not find ABC");
}

const abc: AbcFile = res1;
const abc2: AbcFile = res2;

function findMethodByName(name: string): number {
  const strings = abc.constant_pool.string;
  const instances = abc.instance;
  const multinames = abc.constant_pool.multiname;

  let i = 0;
  for (const instance of instances) {
    for (const trait of instance.trait) {
      if (trait.name == 0) {
        continue;
      }

      const kind = trait.kind & 0b1111;
      if (kind == TraitTypes.Method) {
        const traitMultiname = multinames[trait.name - 1];
        const traitQName = traitMultiname.data as MultinameKindQName;
        const traitName = strings[traitQName.name - 1];

        if (traitName == name) {
          const method = trait.data as TraitMethod;
          // return method.method;
          return i;
        }
      }
    }
    i++;
  }

  return -1;
}

function findInstanceByName(name: string, comparator: Comparator): number {
  for (let i = 0; i < abc2.instance.length; i++) {
    const instance = abc2.instance[i];
    const instanceName = comparator.getInstanceName(instance, true);

    if (instanceName == name) {
      return i;
    }
  }

  return -1;
}

// const methodIndex = findMethodByName("method_2582");

const comparator = new DiffComparator(abc, abc2);

const changedInstances = comparator.findChangedInstances();

comparator.compareInstancesWithConstants(changedInstances);
comparator.compareClassesWithConstants(comparator.getUnnamedInstances());

console.log(comparator.getUnnamedInstances().length);

for (let i = 0; i < abc.instance.length; i++) {
  const instance = abc.instance[i];
  const classObj = abc.class[i];

  if (instance.name == 0) {
    continue;
  }

  const name = comparator.getInstanceName(instance);

  if (!comparator.getNameConversion(name)) {
    continue;
  }

  const instanceSlotTypes = comparator
    .getObjectTypes(instance)
    .filter(
      (slotType) =>
        !comparableTypes.includes(slotType.toUpperCase()) &&
        !comparator.getNameConversion(slotType)
    );

  const classSlotTypes = comparator
    .getObjectTypes(classObj)
    .filter(
      (slotType) =>
        !comparableTypes.includes(slotType.toUpperCase()) &&
        !comparator.getNameConversion(slotType)
    );

  const otherInstanceIndex = findInstanceByName(
    comparator.getNameConversion(name) as any,
    comparator
  );

  if (otherInstanceIndex == -1) {
    console.log(`Could not find ${name}`);
    continue;
  }

  const otherInstance = abc2.instance[otherInstanceIndex];
  const otherClassObj = abc2.class[otherInstanceIndex];

  const otherInstanceSlotTypes = comparator
    .getObjectTypes(otherInstance, false)
    .filter(
      (slotType) =>
        !comparableTypes.includes(slotType.toUpperCase()) &&
        !comparator.getNameConversion(slotType, true)
    );

  const otherClassSlotTypes = comparator
    .getObjectTypes(otherClassObj, false)
    .filter(
      (slotType) =>
        !comparableTypes.includes(slotType.toUpperCase()) &&
        !comparator.getNameConversion(slotType, true)
    );

  if (name == "_-G4v") {
    console.log(instanceSlotTypes, otherInstanceSlotTypes);
  }

  let hasBeenRegistered = false;

  if (instanceSlotTypes.length == otherInstanceSlotTypes.length) {
    for (let j = 0; j < instanceSlotTypes.length; j++) {
      const slotType = instanceSlotTypes[j];
      const otherSlotType = otherInstanceSlotTypes[j];

      comparator.registerNameConversion(slotType, otherSlotType);
      console.log(`${slotType} -> ${otherSlotType}`);
      hasBeenRegistered = true;
    }
  }

  if (
    !hasBeenRegistered &&
    classSlotTypes.length == otherClassSlotTypes.length
  ) {
    for (let j = 0; j < classSlotTypes.length; j++) {
      const slotType = classSlotTypes[j];
      const otherSlotType = otherClassSlotTypes[j];

      comparator.registerNameConversion(slotType, otherSlotType);
      console.log(`${slotType} -> ${otherSlotType}`);
    }
  }
}

const unnamed = comparator.getUnnamedInstances();

console.log(unnamed.length);

for (let i = 0; i < unnamed.length; i++) {
  const instance = abc.instance[unnamed[i]];
  const name = comparator.getInstanceName(instance);

  console.log(`${name}`);
}

// console.log(comparator.getNameMap());
