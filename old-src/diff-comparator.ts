import {
  AbcFile,
  InstanceInfo,
  MultinameKindQName,
  TraitsInfo,
  TraitTypes,
  TraitSlot,
  TraitMethod,
  instructionMap,
  MethodBodyInfo,
  TraitFunction,
  ClassInfo,
  MultinameKind,
  MultinameInfo,
} from "abc-disassembler";
import { Comparator } from "./comparator";

export class DiffComparator extends Comparator {
  constructor(abcFile: AbcFile, abcFile2: AbcFile) {
    super(abcFile, abcFile2);
  }

  private getSlotConstant(slot: TraitSlot): any {
    if (slot.vindex === 0) {
      return undefined;
    }

    switch (slot.vkind) {
      case 0: // Undefined
        return "undefined";
      case 0xa: // False
        return false;
      case 0xb: // True
        return true;
      case 0xc: // Null
        return null;
      case 0x1: // String
        return this.abcFile.constant_pool.string[slot.vindex - 1];
      case 0x3: // Int
        return this.abcFile.constant_pool.integer[slot.vindex - 1];
      case 0x4: // UInt
        return this.abcFile.constant_pool.uinteger[slot.vindex - 1];
      case 0x6: // Double
        return this.abcFile.constant_pool.double[slot.vindex - 1];
      case 0x05:
      case 0x08:
      case 0x16:
      case 0x17:
      case 0x18:
      case 0x19:
      case 0x1a: // All namespace
        const namespace = this.abcFile.constant_pool.namespace[slot.vindex - 1];
        // not implementing this yet
        break;
    }

    return undefined;
  }

  private getMethodConstants(
    method: MethodBodyInfo,
    fileOne: boolean = true
  ): any[] {
    const constants: any[] = [];

    const disassembler = fileOne ? this.disassembler : this.disassembler2;
    const instructions = disassembler.disassemble(method);

    for (const instruction of instructions) {
      const instructionDetails = instructionMap[instruction.id];

      for (let i = 0; i < instructionDetails.length - 2; i++) {
        const paramType = instructionDetails[i + 2];

        if (
          ["string", "u30", "u8", "double", "int", "u_int"].includes(paramType)
        ) {
          constants.push(instruction.params[i]);
        }
      }
    }

    return constants;
  }

  getInstanceConstants(instance: InstanceInfo, fileOne: boolean = true): any[] {
    const constants: any[] = [];
    const abc = fileOne ? this.abcFile : this.abcFile2;

    for (const trait of instance.trait) {
      const traitKind = trait.kind & 0b1111;

      switch (traitKind) {
        case TraitTypes.Slot:
        case TraitTypes.Const:
          const traitSlot = trait.data as TraitSlot;
          const slotConstant = this.getSlotConstant(traitSlot);
          if (slotConstant !== undefined) {
            !constants.includes(slotConstant) && constants.push(slotConstant);
          }
          break;
        case TraitTypes.Function:
          const functionTrait = trait.data as TraitFunction;
          const functionBody = this.findMethodBody(
            functionTrait.function,
            fileOne
          );

          if (!!functionBody) {
            this.getMethodConstants(functionBody, fileOne).forEach(
              (constant) =>
                !constants.includes(constant) && constants.push(constant)
            );
          }
          break;
        case TraitTypes.Method:
        case TraitTypes.Getter:
        case TraitTypes.Setter:
          const methodTrait = trait.data as TraitMethod;
          const method = this.findMethodBody(methodTrait.method, fileOne);

          if (!!method) {
            this.getMethodConstants(method, fileOne).forEach(
              (constant) =>
                !constants.includes(constant) && constants.push(constant)
            );
          }
          break;
      }
    }

    return constants;
  }

  getClassConstants(classInfo: ClassInfo, fileOne: boolean = true): any[] {
    const constants: any[] = [];
    const abc = fileOne ? this.abcFile : this.abcFile2;

    for (const trait of classInfo.traits) {
      const traitKind = trait.kind & 0b1111;

      switch (traitKind) {
        case TraitTypes.Slot:
        case TraitTypes.Const:
          const traitSlot = trait.data as TraitSlot;
          const slotConstant = this.getSlotConstant(traitSlot);
          if (slotConstant !== undefined) {
            !constants.includes(slotConstant) && constants.push(slotConstant);
          }
          break;
        case TraitTypes.Function:
          const functionTrait = trait.data as TraitFunction;
          const functionBody = this.findMethodBody(
            functionTrait.function,
            fileOne
          );

          if (!!functionBody) {
            this.getMethodConstants(functionBody, fileOne).forEach(
              (constant) =>
                !constants.includes(constant) && constants.push(constant)
            );
          }
          break;
        case TraitTypes.Method:
        case TraitTypes.Getter:
        case TraitTypes.Setter:
          const multiname = abc.constant_pool.multiname[trait.name - 1];
          const name =
            abc.constant_pool.string[
              (multiname.data as MultinameKindQName).name - 1
            ];

          const methodTrait = trait.data as TraitMethod;
          const method = this.findMethodBody(methodTrait.method, fileOne);

          if (!!method) {
            this.getMethodConstants(method, fileOne).forEach(
              (constant) =>
                !constants.includes(constant) && constants.push(constant)
            );
          }
          break;
      }
    }

    return constants;
  }

  compareInstancesWithConstants(instances: number[], exact: boolean = false) {
    for (const changedInstanceIndex of instances) {
      const changedInstance = this.abcFile.instance[changedInstanceIndex];

      const constants = this.getInstanceConstants(changedInstance, true);
      const stringConstants = constants
        .filter((c) => typeof c == "string")
        .sort();

      if (this.getInstanceName(changedInstance) == "_-133") {
        console.log(stringConstants);
      }

      let instancesFound = 0;

      let lastInstance: InstanceInfo | undefined = undefined;
      for (const instance2 of this.abcFile2.instance) {
        const constants2 = this.getInstanceConstants(instance2, false);
        const instanceName2 = this.getInstanceName(instance2, true);

        if (!!this.getNameConversion(instanceName2, true)) {
          continue;
        }

        // For now lets only care about strings
        const stringConstants2 = constants2
          .filter((c) => typeof c == "string")
          .sort();

        if (!stringConstants2.length) {
          continue;
        }

        const len = stringConstants.length;
        let count = 0;

        for (let i = 0; i < len; i++) {
          const c1 = stringConstants[i];

          if (stringConstants2.includes(c1)) {
            count++;
          }
        }

        if ((exact && count == len) || (!exact && count / len > 0.7)) {
          instancesFound++;
          lastInstance = instance2;
        }
      }

      if (instancesFound == 1 && !!lastInstance) {
        this.registerNameConversion(
          this.getInstanceName(changedInstance),
          this.getInstanceName(lastInstance, true)
        );
      }
    }
  }

  compareClassesWithConstants(classes: number[], exact: boolean = false) {
    for (const changedClassIndex of classes) {
      const changedClass = this.abcFile.class[changedClassIndex];

      const constants = this.getClassConstants(changedClass, true);
      const stringConstants = constants
        .filter((c) => typeof c == "string")
        .sort();

      let classesFound = 0;

      let lastClass: number | undefined = undefined;
      for (let i = 0; i < this.abcFile2.class.length; i++) {
        const classInfo2 = this.abcFile2.class[i];
        const constants2 = this.getClassConstants(classInfo2, false);
        const instance2 = this.abcFile2.instance[i];

        const instanceName2 = this.getInstanceName(instance2, true);

        if (!!this.getNameConversion(instanceName2, true)) {
          continue;
        }

        // For now lets only care about strings
        const stringConstants2 = constants2
          .filter((c) => typeof c == "string")
          .sort();

        if (!stringConstants2.length) {
          continue;
        }

        const len = stringConstants.length;
        let count = 0;

        for (let j = 0; j < len; j++) {
          const c1 = stringConstants[j];

          if (stringConstants2.includes(c1)) {
            count++;
          }
        }

        if ((exact && count == len) || (!exact && count / len > 0.7)) {
          classesFound++;
          lastClass = i;
        }
      }

      if (classesFound == 1 && !!lastClass) {
        this.registerNameConversion(
          this.getInstanceName(this.abcFile.instance[changedClassIndex]),
          this.getInstanceName(this.abcFile2.instance[lastClass], true)
        );
      }
    }
  }

  private diffTraitsInternal(
    traitsOne: TraitsInfo[],
    traitsTwo: TraitsInfo[],
    i: number,
    j: number
  ): number[] {
    if (i < 0 || j < 0) {
      return [];
    }

    const traitOne = traitsOne[i];
    const traitTwo = traitsTwo[j];

    const traitOneMultiname =
      this.abcFile.constant_pool.multiname[traitOne.name - 1];
    const traitTwoMultiname =
      this.abcFile2.constant_pool.multiname[traitTwo.name - 1];

    const traitOneName =
      this.abcFile.constant_pool.string[
        (traitOneMultiname.data as MultinameKindQName).name - 1
      ];
    const traitTwoName =
      this.abcFile2.constant_pool.string[
        (traitTwoMultiname.data as MultinameKindQName).name - 1
      ];

    const kindOne = traitOne.kind & 0b1111;
    const kindTwo = traitTwo.kind & 0b1111;

    if (kindTwo != TraitTypes.Method && kindOne != TraitTypes.Method) {
      return [...this.diffTraitsInternal(traitsOne, traitsTwo, i - 1, j - 1)];
    } else if (kindTwo == TraitTypes.Method && kindOne != TraitTypes.Method) {
      return [...this.diffTraitsInternal(traitsOne, traitsTwo, i - 1, j)];
    } else if (kindTwo != TraitTypes.Method && kindOne == TraitTypes.Method) {
      return [...this.diffTraitsInternal(traitsOne, traitsTwo, i, j - 1)];
    }

    if (!this.compareTraits(traitOne, traitTwo)) {
      const traitDiffLeft = this.diffTraitsInternal(
        traitsOne,
        traitsTwo,
        i - 1,
        j
      );
      const traitDiffRight = this.diffTraitsInternal(
        traitsOne,
        traitsTwo,
        i,
        j - 1
      );

      return traitDiffLeft.length > traitDiffRight.length
        ? traitDiffLeft
        : traitDiffRight;
    }

    return [i, ...this.diffTraitsInternal(traitsOne, traitsTwo, i - 1, j - 1)];
  }

  public diffTraits(traitsOne: TraitsInfo[], traitsTwo: TraitsInfo[]) {
    console.log(traitsOne.length - 1, traitsTwo.length - 1);
    const longestCommonSubsequence = this.diffTraitsInternal(
      traitsOne,
      traitsTwo,
      traitsOne.length - 1,
      traitsTwo.length - 1
    );

    return longestCommonSubsequence;
  }

  public getMultinameType(multiname: MultinameInfo, abcOne: boolean = true) {
    const abc = abcOne ? this.abcFile : this.abcFile2;

    if (!multiname) {
      return;
    }

    switch (multiname.kind) {
      case MultinameKind.QName:
        const qname = multiname.data as MultinameKindQName;
        const name = abc.constant_pool.string[qname.name - 1];
        return name;
      default:
        // console.log("Unhandled slot type multiname", multiname.kind);
        return;
    }
  }

  public getObjectTypes(
    instance: ClassInfo | InstanceInfo,
    abcOne: boolean = true
  ) {
    const abc = abcOne ? this.abcFile : this.abcFile2;
    const disassembler = abcOne ? this.disassembler : this.disassembler2;
    const slotTypes: string[] = [];
    const traits =
      instance instanceof ClassInfo ? instance.traits : instance.trait;
    for (const trait of traits) {
      const traitKind = trait.kind & 0b1111;
      if (traitKind == TraitTypes.Slot || traitKind == TraitTypes.Const) {
        const slotInfo = trait.data as TraitSlot;
        const slotType = this.getMultinameType(
          abc.constant_pool.multiname[slotInfo.type_name - 1],
          abcOne
        );
        if (!!slotType && !slotTypes.includes(slotType)) {
          slotTypes.push(slotType);
        }
      } else if (
        traitKind == TraitTypes.Getter ||
        traitKind == TraitTypes.Setter ||
        traitKind == TraitTypes.Method
      ) {
        const methodTrait = trait.data as TraitMethod;
        const method = abc.method[methodTrait.method];

        if (!method) {
          continue;
        }

        const returnType = this.getMultinameType(
          abc.constant_pool.multiname[method.return_type - 1],
          abcOne
        );

        if (!!returnType && !slotTypes.includes(returnType)) {
          slotTypes.push(returnType);
        }

        for (const param of method.param_type) {
          const paramTypes = this.getMultinameType(
            abc.constant_pool.multiname[param - 1],
            abcOne
          );

          if (!!paramTypes && !slotTypes.includes(paramTypes)) {
            slotTypes.push(paramTypes);
          }
        }

        const methodBody = this.findMethodBody(methodTrait.method, abcOne);

        if (!methodBody || !methodBody.code) {
          continue;
        }

        const instructions = disassembler.disassemble(methodBody);

        for (const instruction of instructions) {
          if (!["getlex", "coerce", "astype", "constructprop"].includes(instruction.name)) {
            continue;
          }
          
          const instructionDetails = instructionMap[instruction.id];

          for (let i = 0; i < instructionDetails.length - 2; i++) {
            const paramType = instructionDetails[i + 2];

            if (paramType == "multiname") {
              const multiname = instruction.params[i];
              const multinameType = this.getMultinameType(multiname, abcOne);

              if (!!multinameType && !slotTypes.includes(multinameType)) {
                slotTypes.push(multinameType);
              }
            }
          }
        }
      }
    }

    return slotTypes;
  }
}
