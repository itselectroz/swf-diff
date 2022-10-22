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
import { ArrayChange, diffArrays } from "diff";

export type XRef = {
  instances: InstanceInfo[];
  instance_traits: TraitsInfo[];
  class_traits: TraitsInfo[];
  code_references: MethodBodyInfo[];
};

export type XRefCache = {
  [key: number]: XRef;
};

export type Cache = {
  xrefs: XRefCache;
  methodBodies: MethodBodyInfo[];
};

export type GenericComparisonCache = {
  [key: number]: {
    [key: number]: boolean;
  };
};

export type SymbolMapping = {
  [key: number]: number;
};

export type Change = ArrayChange<{
  type: number;
  index: number;
}>;

export class Comparator {
  private abc: AbcFile;
  private abc2: AbcFile;

  private disassembler: InstructionDisassembler;
  private disassembler2: InstructionDisassembler;

  private multinames: MultinameInfo[];
  private multinames2: MultinameInfo[];

  private abcCache!: Cache;
  private abcCache2!: Cache;

  private traitCache!: GenericComparisonCache;
  private symbolMapping?: SymbolMapping;

  constructor(abc: AbcFile, abc2: AbcFile) {
    this.abc = abc;
    this.abc2 = abc2;

    this.disassembler = new InstructionDisassembler(abc);
    this.disassembler2 = new InstructionDisassembler(abc2);

    this.multinames = this.abc.constant_pool.multiname;
    this.multinames2 = this.abc2.constant_pool.multiname;

    this.abcCache = {
      xrefs: {},
      methodBodies: [],
    };

    this.abcCache2 = {
      xrefs: {},
      methodBodies: [],
    };

    this.traitCache = {};
  }

  private async buildCache(file: AbcFile, cache: Cache) {
    const disass = new InstructionDisassembler(file);

    await Promise.all(
      file.constant_pool.multiname.map(async (v, i) => {
        cache.xrefs[i] = {
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
        cache.xrefs[name - 1].instances.push(v);

        v.trait.forEach((t) => {
          cache.xrefs[t.name - 1].instance_traits.push(t);
        });
      }),
      ...file.class.map(async (v) => {
        v.traits.forEach((t) => {
          cache.xrefs[t.name - 1].class_traits.push(t);
        });
      }),
      ...file.method_body.map(async (v) => {
        cache.methodBodies[v.method] = v;

        const instructions = disass.disassemble(v);

        instructions.forEach((instruction) => {
          for (let i = 0; i < instruction.types.length; i++) {
            const type = instruction.types[i];
            if (type === "multiname") {
              const rawIndex = instruction.rawParams[i];

              cache.xrefs[rawIndex - 1].code_references.push(v);
            }
          }
        });
      }),
    ]);
  }

  async buildCaches() {
    this.abcCache = {
      xrefs: {},
      methodBodies: [],
    };

    this.abcCache2 = {
      xrefs: {},
      methodBodies: [],
    };

    await Promise.all([
      this.buildCache(this.abc, this.abcCache),
      this.buildCache(this.abc2, this.abcCache2),
    ]);
  }

  private _compareTraits(trait: TraitsInfo, trait2: TraitsInfo): boolean {
    if (trait.kind !== trait2.kind) return false;

    switch (trait.kind & 0xf) {
      case TraitTypes.Method: {
        const methodData = trait.data as TraitMethod;
        const methodData2 = trait2.data as TraitMethod;

        const method = this.abc.method[methodData.method];
        const method2 = this.abc2.method[methodData2.method];

        if (method.param_count !== method2.param_count) return false;
        if (method.flags !== method2.flags) return false;
        if (method.name !== method2.name && (!method.name || !method2.name))
          return false;

        const body = this.abcCache.methodBodies[methodData.method];
        const body2 = this.abcCache2.methodBodies[methodData2.method];

        if (!!body && !!body2) {
          if (body.max_stack !== body2.max_stack) return false;
          if (body.local_count !== body2.local_count) return false;
          if (body.init_scope_depth !== body2.init_scope_depth) return false;
          if (body.max_scope_depth !== body2.max_scope_depth) return false;

          const instructions = this.disassembler.disassemble(body);
          const instructions2 = this.disassembler2.disassemble(body2);

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

        if (!this.compare(traitData.type_name, traitData2.type_name, true))
          return false;

        break;
      }
    }

    return true;
  }

  compareTraits(trait: TraitsInfo, trait2: TraitsInfo) {
    if (
      !!this.traitCache[trait.name] &&
      this.traitCache[trait.name][trait2.name] !== undefined
    ) {
      return this.traitCache[trait.name][trait2.name];
    }

    if (
      !!this.traitCache[trait2.name] &&
      this.traitCache[trait2.name][trait.name] !== undefined
    ) {
      return this.traitCache[trait2.name][trait.name];
    }

    const result = this._compareTraits(trait, trait2);

    if (!this.traitCache[trait.name]) this.traitCache[trait.name] = {};
    this.traitCache[trait.name][trait2.name] = result;

    return result;
  }

  compareQNames(
    a: MultinameInfo,
    b: MultinameInfo,
    indexA: number,
    indexB: number,
    roughComparison: boolean = false
  ) {
    const qname = a.data as MultinameKindQName;
    const qname2 = b.data as MultinameKindQName;

    if (!!qname.name && !!qname2.name) {
      const name = this.abc.constant_pool.string[qname.name - 1];
      const name2 = this.abc2.constant_pool.string[qname2.name - 1];

      const isObfuscated = name.startsWith("_-");
      const isObfuscated2 = name2.startsWith("_-");

      if (isObfuscated !== isObfuscated2) {
        return false;
      }

      if (!isObfuscated) {
        return name === name2;
      }
    }

    let data = this.abcCache.xrefs[indexA];
    let data2 = this.abcCache2.xrefs[indexB];

    if (data.instances.length !== data2.instances.length) return false;

    if (data.instance_traits.length !== data2.instance_traits.length)
      return false;

    if (data.class_traits.length !== data2.class_traits.length) return false;

    if (roughComparison) return true;

    if (
      !data.instance_traits.every((v, i) =>
        this.compareTraits(v, data2.instance_traits[i])
      )
    )
      return false;

    if (
      !data.class_traits.every((v, i) =>
        this.compareTraits(v, data2.class_traits[i])
      )
    )
      return false;

    if (data.code_references.length !== data2.code_references.length)
      return false;

    if (
      !data.code_references.every((body, i) => {
        const body2 = data2.code_references[i];

        const method = this.abc.method[body.method];
        const method2 = this.abc2.method[body2.method];

        if (method.flags !== method2.flags) return false;
        if (method.param_count !== method2.param_count) return false;

        return true;
      })
    )
      return false;

    return true;
  }

  compare(iA: number, iB: number, roughComparison: boolean = false): boolean {
    if (!!this.symbolMapping && this.symbolMapping[iA] !== undefined) {
      return this.symbolMapping[iA] === iB;
    }

    const a = this.multinames[iA];
    const b = this.multinames2[iB];

    if (a.kind !== b.kind) {
      return false;
    }

    switch (a.kind) {
      case MultinameKind.QName:
      case MultinameKind.QNameA:
        if (!this.compareQNames(a, b, iA, iB, roughComparison)) return false;
        break;
    }
    return true;
  }

  diff(): Change[] {
    return diffArrays(
      this.multinames.map((_, i) => ({
        type: 1,
        index: i,
      })),
      this.multinames2.map((_, i) => ({
        type: 2,
        index: i,
      })),
      {
        comparator: (left, right) => {
          if (left.type === right.type) {
            throw new Error("Cannot compare two objects of same type");
          }

          const iA = left.type == 1 ? left.index : right.index;
          const iB = left.type == 2 ? left.index : right.index;

          return this.compare(iA, iB);
        },
      }
    );
  }

  generateSymbolMapping(changes?: Change[]): SymbolMapping {
    changes = !!changes ? changes : this.diff();

    const mapping: { [key: number]: number } = {};

    let offset = 0;
    for (const change of changes) {
      if (!!change.added) {
        offset += change.count || 0;
      } else if (!!change.removed) {
        offset -= change.count || 0;
      } else {
        for (const value of change.value) {
          if (value.type === 1) {
            mapping[value.index] = value.index + offset;
          } else {
            mapping[value.index - offset] = value.index;
          }
        }
      }
    }

    return mapping;
  }

  generateSymbolChanges(changes?: Change[]): {
    mappings: SymbolMapping;
    remaining: Set<number>;
    remaining2: Set<number>;
  } {
    changes = !!changes ? changes : this.diff();

    const mappings: SymbolMapping = {};

    const remaining: Set<number> = new Set();
    const remaining2: Set<number> = new Set();

    let removed: Change | undefined = undefined;

    for (const change of changes) {
      if (!!change.removed) {
        removed = change;
      } else if (
        !!change.added &&
        !!removed &&
        removed.value.length === change.value.length
      ) {
        for (let i = 0; i < change.value.length; i++) {
          mappings[removed.value[i].index] = change.value[i].index;
        }

        removed = undefined;
      } else {
        if (!!removed) {
          removed.value.forEach((v) => remaining.add(v.index));
        }

        if (change.added) {
          change.value.forEach((v) => remaining2.add(v.index));
        }

        removed = undefined;
      }
    }

    if (!!removed) {
      removed.value.forEach((v) => remaining.add(v.index));
    }

    return {
      mappings,
      remaining,
      remaining2,
    };
  }

  setSymbolMapping(mapping?: SymbolMapping) {
    mapping = !!mapping ? mapping : this.generateSymbolMapping();

    this.symbolMapping = mapping;
  }

  reset() {
    this.abcCache = {
      xrefs: {},
      methodBodies: [],
    };

    this.abcCache2 = {
      xrefs: {},
      methodBodies: [],
    };

    this.traitCache = {};

    this.symbolMapping = undefined;
  }
}
