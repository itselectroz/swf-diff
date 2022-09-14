import {
  AbcFile,
  ClassInfo,
  InstanceInfo,
  InstructionDisassembler,
  MethodBodyInfo,
  MultinameInfo,
  MultinameKind,
  MultinameKindMultiname,
  MultinameKindMultinameL,
  MultinameKindQName,
  MultinameKindTypeName,
  NamespaceInfo,
  TraitFunction,
  TraitMethod,
  TraitsInfo,
  TraitSlot,
  TraitTypes,
  instructionMap,
  Instruction,
} from "abc-disassembler";

export const comparableTypes = [
  "BOOLEAN",
  "INT",
  "UINT",
  "NUMBER",
  "STRING",
  "OBJECT",
  "VOID",
  "NULL",
  "*",
  "ARRAY",
  "UNDEFINED",
  "SPRITE",
  "MOVIECLIP",
  "RECTANGLETEXTURE",
  "POINT",
  "SOUNDCHANNEL",
  "SOUNDTRANSFORM",
  "BYTEARRAY",
  "MATRIX",
  "RECTANGLE",
  "SOCKET",
  "FUNCTION",
  "GAMEINPUTDEVICE",
  "TEXTFIELD",
  "DISPLAYOBJECT",
  "BITMAP",
  "FILEREFERENCE",
  "FILE",
  "BITMAPDATA",
  "AGALMINIASSEMBLER",
  "STAGE3D",
  "STAGE",
  "DICTIONARY",
  "CLASS",
  "FILESTREAM",
  "SOUND",
  "URLLOADER",
  "LOADER",
  "SHAREDOBJECT",
  "REGEXP",
  "DATAGRAMSOCKET",
  "INTERACTIVEOBJECT",
  "VERTEXBUFFER3D",
  "INDEXBUFFER3D",
  "DISPLAYOBJECTCONTAINER",
  "GAMEINPUT",
  "ERROR",
  "DATE",
  "COLORTRANSFORM",
  "MATRIX3D",
  "GLOWFILTER",
  "COLORMATRIXFILTER",
  "TEXTFORMAT",
  "PROGRAM3D",
  "CONTEXT3D",
  "URLREQUEST",
  "LOADERINFO",
  "TOUCHEVENT",
  "INVOKEEVENT",
  "MOUSEEVENT",
  "KEYBOARDEVENT",
  "SHAPE",
  "GRAPHICS",
  "GAMEINPUTEVENT",
  "UNCAUGHTERROREVENT",
  "HTTPSTATUSEVENT",
  "PROGRESSEVENT",
  "IOERROREVENT",
  "TEXTEVENT",
  "FILELISTEVENT",
  "DATAGRAMSOCKETDATAEVENT",
  "EVENT",
  "ERROREVENT",
  "FOCUSEVENT",
  "VECTOR",
  "MATH",
  "JSON",
  "ENDIAN",
  "CAPABILITIES",
  "NATIVEAPPLICATION",
  "STAGESCALEMODE",
  "STAGEALIGN",
  "STAGEDISPLAYSTATE",
  "TEXTFIELDAUTOSIZE",
  "PIXELSNAPPING",
  "IGRAPHICSDATA",
  "GRAPHICSPATH",
  "GRAPHICSSTROKE",
  "GRAPHICSSOLIDFILL",
  "KEYBOARD",
  "FILEMODE",
  "STAGEQUALITY",
  "CLIPBOARD",
  "CLIPBOARDFORMATS",
  "NOTIFCATIONTYPE",
  "GRAPHICSGRADIENTFILL",
  "CONTEXT3DTEXTUREFORMAT",
  "SECURITYERRORERROR",
  "APPLICATIONDOMAIN",
  "CONTEXT3DPROGRAMTYPE",
  "CONTEXT3DVERTEXBUFFERFORMAT",
  "GRADIENTTYPE",
  "CONTEXT3DPROFILE",
  "CONTEXT3DCOMPAREMODE",
  "CONTEXT3DTRIANGLEFACE",
  "CONTEXT3DBLENDFACTOR",
  "ANTIALIASTYPE",
  "FRAMELABEL",
  "TRANSFORM",
  "ARGUMENTERROR",
  "IGRAPHICSFILL",
  "GAMEINPUTCONTROL",
  "DOCKICON",
  "LOADERCONTEXT",
  "SOUNDLOADERCONTEXT",
  "TEXTUREBASE",
  "BITMAPFILTER",
  "NAVIGATETOURL",
  "NOTIFICATIONTYPE",
  "SECURITYERRORERROR",
  "FONT",
  "SECURITYERROREVENT",


  // Brawlhalla Specific
  "STEAMAIR",
  "ANE_RAWKEYBOARD",
  "ANE_RAWDATA",
  "NETWORKNEXTAIR",
  "STEAMEVENT",
  "ANE_DNAMANAGER",
  "ANE_MULTIKEYBOARD",
  "ANE_EPICAIR",
];

export class Comparator {
  protected abcFile: AbcFile;
  protected abcFile2: AbcFile;

  protected disassembler: InstructionDisassembler;
  protected disassembler2: InstructionDisassembler;

  private nameMap: Map<string, string>;
  private reverseNameMap: Map<string, string>;

  constructor(abcFile: AbcFile, abcFile2: AbcFile) {
    this.abcFile = abcFile;
    this.abcFile2 = abcFile2;

    this.disassembler = new InstructionDisassembler(this.abcFile);
    this.disassembler2 = new InstructionDisassembler(this.abcFile2);

    this.nameMap = new Map<string, string>();
    this.reverseNameMap = new Map<string, string>();
  }

  private times: number = 0;
  public registerNameConversion(nameOne: string, nameTwo: string): void {
    if (this.times++ == 2 && nameOne == "_-133") {
      throw new Error("Debug");
    }
    this.nameMap.set(nameOne, nameTwo);
    this.reverseNameMap.set(nameTwo, nameOne);
  }

  public getNameConversion(name: string, reverse: boolean = false) {
    return (reverse ? this.reverseNameMap : this.nameMap).get(name);
  }

  public getNameMap() {
    return this.nameMap;
  }

  public getUnnamedInstances(): number[] {
    const unnamedInstances: number[] = [];

    for (let i = 0; i < this.abcFile.instance.length; i++) {
      const instance = this.abcFile.instance[i];
      const name = this.getInstanceName(instance);

      if (!name || !this.getNameConversion(name)) {
        unnamedInstances.push(i);
      }
    }

    return unnamedInstances;
  }

  protected findMethodBody(
    methodIndex: number,
    abcOne: boolean
  ): MethodBodyInfo | false {
    const abc = abcOne ? this.abcFile : this.abcFile2;

    for (const method of abc.method_body) {
      if (method.method == methodIndex) {
        return method;
      }
    }

    return false;
  }

  public compareNamespaces(
    namespaceOne: NamespaceInfo,
    namespaceTwo: NamespaceInfo
  ): boolean {
    if (!namespaceOne || !namespaceTwo) {
      return namespaceOne == namespaceTwo;
    }

    if (namespaceOne.kind !== namespaceTwo.kind) {
      return false;
    }

    if (namespaceOne.name !== 0 && namespaceTwo.name !== 0) {
      const name = this.abcFile.constant_pool.string[namespaceOne.name - 1];
      const name2 = this.abcFile2.constant_pool.string[namespaceTwo.name - 1];

      if (name != name2) {
        return false;
      }
    } else if (namespaceOne.name !== namespaceTwo.name) {
      return false;
    }

    return true;
  }

  public compareTypeNames(typeNameOne: string, typeNameTwo: string): boolean {
    // there are a lot of comparable type names missing

    if (
      comparableTypes.includes(typeNameOne.toUpperCase()) ||
      comparableTypes.includes(typeNameTwo.toUpperCase())
    ) {
      if (typeNameOne != typeNameTwo) {
        return false;
      }

      return true;
    }

    if (this.nameMap.has(typeNameOne)) {
      if (this.nameMap.get(typeNameOne) != typeNameTwo) {
        return false;
      }
    }

    return true;
  }

  public compareQNames(
    qnameOne: MultinameInfo,
    qnameTwo: MultinameInfo
  ): boolean {
    if (!qnameOne || !qnameTwo) {
      return qnameOne == qnameTwo;
    }

    const qname = qnameOne.data as MultinameKindQName;
    const qname2 = qnameTwo.data as MultinameKindQName;

    if (!!qname.ns && !!qname2.ns) {
      const ns = this.abcFile.constant_pool.namespace[qname.ns - 1];
      const ns2 = this.abcFile2.constant_pool.namespace[qname2.ns - 1];

      if (!this.compareNamespaces(ns, ns2)) {
        return false;
      }
    } else if (qname.ns !== qname2.ns) {
      return false;
    }

    if (!!qname.name && !!qname2.name) {
      const name = this.abcFile.constant_pool.string[qname.name - 1];
      const name2 = this.abcFile2.constant_pool.string[qname2.name - 1];

      if (!this.compareTypeNames(name, name2)) {
        return false;
      }
    } else if (qname.name !== qname2.name) {
      return false;
    }

    return true;
  }

  public compareRTQNames(
    rtqnameOne: MultinameInfo,
    rtqnameTwo: MultinameInfo
  ): boolean {
    if (!rtqnameOne || !rtqnameTwo) {
      return rtqnameOne == rtqnameTwo;
    }

    const rtqname = rtqnameOne.data as MultinameKindQName;
    const rtqname2 = rtqnameTwo.data as MultinameKindQName;

    if (!!rtqname.ns && !!rtqname2.ns) {
      const name = this.abcFile.constant_pool.string[rtqname.name - 1];
      const name2 = this.abcFile2.constant_pool.string[rtqname2.name - 1];

      if (!this.compareTypeNames(name, name2)) {
        return false;
      }
    } else if (rtqname.ns !== rtqname2.ns) {
      return false;
    }

    return true;
  }

  /**
   * A method two compare two MultinameKind.Multiname multinames.
   * @param multinameOne The first MultinameKind.Multiname
   * @param multinameTwo The second MultinameKind.Multiname
   */
  public compareMultinameMultinames(
    multinameOne: MultinameInfo,
    multinameTwo: MultinameInfo
  ): boolean {
    if (!multinameOne || !multinameTwo) {
      return multinameOne == multinameTwo;
    }

    const multiname = multinameOne.data as MultinameKindMultiname;
    const multiname2 = multinameTwo.data as MultinameKindMultiname;

    if (multiname.name !== 0 && multiname2.name !== 0) {
      const name = this.abcFile.constant_pool.string[multiname.name - 1];
      const name2 = this.abcFile2.constant_pool.string[multiname2.name - 1];

      if (!this.compareTypeNames(name, name2)) {
        return false;
      }
    } else if (multiname.name !== multiname2.name) {
      return false;
    }

    const ns_set = this.abcFile.constant_pool.ns_set[multiname.ns_set - 1];
    const ns_set2 = this.abcFile2.constant_pool.ns_set[multiname2.ns_set - 1];

    if (ns_set.ns.length !== ns_set2.ns.length) {
      return false;
    }

    for (let i = 0; i < ns_set.ns.length; i++) {
      const nsIndex = ns_set.ns[i];
      const nsIndex2 = ns_set2.ns[i];

      const ns = this.abcFile.constant_pool.namespace[nsIndex - 1];
      const ns2 = this.abcFile2.constant_pool.namespace[nsIndex2 - 1];

      if (!this.compareNamespaces(ns, ns2)) {
        return false;
      }
    }

    return true;
  }

  /**
   * A method two compare two MultinameKind.MultinameL multinames.
   * @param multinameOne The first MultinameKind.MultinameL
   * @param multinameTwo The second MultinameKind.MultinameL
   */
  public compareMultinameMultinamesL(
    multinameOne: MultinameInfo,
    multinameTwo: MultinameInfo
  ): boolean {
    if (!multinameOne || !multinameTwo) {
      return multinameOne == multinameTwo;
    }

    const multiname = multinameOne.data as MultinameKindMultinameL;
    const multiname2 = multinameTwo.data as MultinameKindMultinameL;

    const ns_set = this.abcFile.constant_pool.ns_set[multiname.ns_set - 1];
    const ns_set2 = this.abcFile2.constant_pool.ns_set[multiname2.ns_set - 1];

    if (ns_set.ns.length !== ns_set2.ns.length) {
      return false;
    }

    for (let i = 0; i < ns_set.ns.length; i++) {
      const nsIndex = ns_set.ns[i];
      const nsIndex2 = ns_set2.ns[i];

      const ns = this.abcFile.constant_pool.namespace[nsIndex - 1];
      const ns2 = this.abcFile2.constant_pool.namespace[nsIndex2 - 1];

      if (!this.compareNamespaces(ns, ns2)) {
        return false;
      }
    }

    return true;
  }

  public compareTypeNameMultinames(
    typeNameMultiNameOne: MultinameInfo,
    typeNameMultiNameTwo: MultinameInfo
  ): boolean {
    if (!typeNameMultiNameOne || !typeNameMultiNameTwo) {
      return typeNameMultiNameOne == typeNameMultiNameTwo;
    }

    const typeName = typeNameMultiNameOne.data as MultinameKindTypeName;
    const typeName2 = typeNameMultiNameTwo.data as MultinameKindTypeName;

    const qname = this.abcFile.constant_pool.multiname[typeName.qname - 1];
    const qname2 = this.abcFile2.constant_pool.multiname[typeName2.qname - 1];

    const qnameKind = qname.kind & 0b1111;
    const qnameKind2 = qname2.kind & 0b1111;

    if (qnameKind !== qnameKind2 || qnameKind !== MultinameKind.QName) {
      return false;
    }

    if (!this.compareQNames(qname, qname2)) {
      return false;
    }

    if (typeName.params.length != typeName2.params.length) {
      return false;
    }

    for (let i = 0; i < typeName.params.length; i++) {
      const param =
        this.abcFile.constant_pool.multiname[typeName.params[i] - 1];
      const param2 =
        this.abcFile2.constant_pool.multiname[typeName2.params[i] - 1];

      if (!this.compareMultinames(param, param2)) {
        return false;
      }
    }

    return true;
  }

  public compareMultinames(
    multinameOne: MultinameInfo,
    multinameTwo: MultinameInfo
  ): boolean {
    if (!multinameOne || !multinameTwo) {
      return multinameOne == multinameTwo;
    }

    if ((multinameOne.kind & 0b1111) !== (multinameTwo.kind & 0b1111)) {
      return false;
    }

    switch (multinameOne.kind & 0b1111) {
      case MultinameKind.QName:
      case MultinameKind.QNameA:
        return this.compareQNames(multinameOne, multinameTwo);
      case MultinameKind.RTQName:
      case MultinameKind.RTQNameA:
        return this.compareRTQNames(multinameOne, multinameTwo);
      case MultinameKind.RTQNameL:
      case MultinameKind.RTQNameLA:
        return true;
      case MultinameKind.Multiname:
      case MultinameKind.MultinameA:
        return this.compareMultinames(multinameOne, multinameTwo);
      case MultinameKind.MultinameL:
      case MultinameKind.MultinameLA:
        return this.compareMultinameMultinamesL(multinameOne, multinameTwo);
      case MultinameKind.TypeName:
        return this.compareTypeNameMultinames(multinameOne, multinameTwo);
    }

    return false;
  }

  public compareInstructions(
    instructionOne: Instruction,
    instructionTwo: Instruction
  ): boolean {
    if (!instructionOne || !instructionTwo) {
      return instructionOne == instructionTwo;
    }

    if (instructionOne.id !== instructionTwo.id) {
      return false;
    }

    const instructionDetails = instructionMap[instructionOne.id];

    for (let i = 0; i < instructionDetails.length - 2; i++) {
      const paramType = instructionDetails[i + 2];

      if (
        ["string", "u30", "u8", "double", "int", "u_int"].includes(paramType)
      ) {
        if (instructionOne.params[i] !== instructionTwo.params[i]) {
          return false;
        }
      }
    }

    return true;
  }

  public compareMethods(
    methodIndexOne: number,
    methodIndexTwo: number
  ): boolean {
    const methodOne = this.abcFile.method[methodIndexOne];
    const methodTwo = this.abcFile2.method[methodIndexTwo];

    if (!methodOne || !methodTwo) {
      return methodOne == methodTwo;
    }

    if (methodOne.param_count !== methodTwo.param_count) {
      return false;
    }

    for (let i = 0; i < methodOne.param_count; i++) {
      const type = methodOne.param_type[i];
      const type2 = methodTwo.param_type[i];

      const typeMultiname = this.abcFile.constant_pool.multiname[type - 1];
      const typeMultiname2 = this.abcFile2.constant_pool.multiname[type2 - 1];

      if (!this.compareMultinames(typeMultiname, typeMultiname2)) {
        return false;
      }
    }

    const returnType =
      this.abcFile.constant_pool.multiname[methodOne.return_type - 1];
    const returnType2 =
      this.abcFile2.constant_pool.multiname[methodTwo.return_type - 1];

    if (
      methodOne.return_type !== 0 &&
      methodTwo.return_type !== 0 &&
      !this.compareMultinames(returnType, returnType2)
    ) {
      return false;
    }

    if (methodOne.flags !== methodTwo.flags) {
      return false;
    }

    // still need to compare method bodies

    const method_body = this.findMethodBody(methodIndexOne, true);
    const method_body2 = this.findMethodBody(methodIndexTwo, false);

    if (!method_body || !method_body2) {
      return method_body == method_body2;
    }

    if (method_body.max_stack !== method_body2.max_stack) {
      return false;
    }

    if (method_body.local_count !== method_body2.local_count) {
      return false;
    }

    if (method_body.init_scope_depth !== method_body2.init_scope_depth) {
      return false;
    }

    if (method_body.max_scope_depth !== method_body2.max_scope_depth) {
      return false;
    }

    const instructions = this.disassembler.disassemble(method_body);
    const instructions2 = this.disassembler2.disassemble(method_body2);

    if (instructions.length !== instructions2.length) {
      return false;
    }

    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i];
      const instruction2 = instructions2[i];

      if (instruction.id !== instruction2.id) {
        return false;
      }

      if (!this.compareInstructions(instruction, instruction2)) {
        return false;
      }
    }

    return true;
  }

  public compareSlotTrait(
    slotTraitOne: TraitSlot,
    slotTraitTwo: TraitSlot
  ): boolean {
    const typeMultiname =
      this.abcFile.constant_pool.multiname[slotTraitOne.type_name - 1];
    const typeMultiname2 =
      this.abcFile2.constant_pool.multiname[slotTraitTwo.type_name - 1];

    if (!this.compareMultinames(typeMultiname, typeMultiname2)) {
      return false;
    }

    if (
      slotTraitOne.vindex != slotTraitTwo.vindex &&
      (!slotTraitOne.vindex || !slotTraitTwo.vindex)
    ) {
      return false;
    }

    if (slotTraitOne.vindex !== 0) {
      if (slotTraitOne.vkind != slotTraitTwo.vkind) {
        return false;
      }

      switch (slotTraitOne.vkind) {
        case 0: // Undefined
        case 0xa: // False
        case 0xb: // True
        case 0xc: // Null
          break;
        case 0x1: // String
          if (
            this.abcFile.constant_pool.string[slotTraitOne.vindex - 1] !==
            this.abcFile2.constant_pool.string[slotTraitTwo.vindex - 1]
          ) {
            return false;
          }
          break;
        case 0x3: // Int
          if (
            this.abcFile.constant_pool.integer[slotTraitOne.vindex - 1] !==
            this.abcFile2.constant_pool.integer[slotTraitTwo.vindex - 1]
          ) {
            return false;
          }
          break;
        case 0x4: // UInt
          if (
            this.abcFile.constant_pool.uinteger[slotTraitOne.vindex - 1] !==
            this.abcFile2.constant_pool.uinteger[slotTraitTwo.vindex - 1]
          ) {
            return false;
          }
          break;
        case 0x6: // Double
          if (
            this.abcFile.constant_pool.double[slotTraitOne.vindex - 1] !==
            this.abcFile2.constant_pool.double[slotTraitTwo.vindex - 1]
          ) {
            return false;
          }
          break;
        case 0x05:
        case 0x08:
        case 0x16:
        case 0x17:
        case 0x18:
        case 0x19:
        case 0x1a: // All namespace
          const namespace =
            this.abcFile.constant_pool.namespace[slotTraitOne.vindex - 1];
          const namespace2 =
            this.abcFile2.constant_pool.namespace[slotTraitTwo.vindex - 1];

          if (!this.compareNamespaces(namespace, namespace2)) {
            return false;
          }
          break;
      }
    }

    return true;
  }

  public compareTraits(traitOne: TraitsInfo, traitTwo: TraitsInfo): boolean {
    if (!traitOne || !traitTwo) {
      return traitOne == traitTwo;
    }

    const traitKindOne = traitOne.kind & 0b1111;
    const traitKindTwo = traitTwo.kind & 0b1111;

    if (traitKindOne !== traitKindTwo) {
      return false;
    }

    // compare name
    const nameMultiname =
      this.abcFile.constant_pool.multiname[traitOne.name - 1];
    const nameMultiname2 =
      this.abcFile2.constant_pool.multiname[traitTwo.name - 1];

    const name =
      this.abcFile.constant_pool.string[
        (nameMultiname.data as MultinameKindQName).name - 1
      ];
    const name2 =
      this.abcFile2.constant_pool.string[
        (nameMultiname2.data as MultinameKindQName).name - 1
      ];

    if (name !== name2 && !(name.startsWith("_-") || name2.startsWith("_-"))) {
      return false;
    }

    switch (traitKindOne) {
      case TraitTypes.Method:
      case TraitTypes.Getter:
      case TraitTypes.Setter:
        const methodTrait = traitOne.data as TraitMethod;
        const methodTrait2 = traitTwo.data as TraitMethod;
        return this.compareMethods(methodTrait.method, methodTrait2.method);
      case TraitTypes.Function:
        const functionTrait = traitOne.data as TraitFunction;
        const functionTrait2 = traitTwo.data as TraitFunction;
        return this.compareMethods(
          functionTrait.function,
          functionTrait2.function
        );
      case TraitTypes.Slot:
      case TraitTypes.Const:
        const slotTrait = traitOne.data as TraitSlot;
        const slotTrait2 = traitTwo.data as TraitSlot;

        return this.compareSlotTrait(slotTrait, slotTrait2);
    }

    return true;
  }

  public compareInstances(
    instanceOne: InstanceInfo,
    instanceTwo: InstanceInfo
  ): boolean {
    if (!instanceOne || !instanceTwo) {
      return instanceOne == instanceTwo;
    }

    const multiname =
      this.abcFile.constant_pool.multiname[instanceOne.name - 1];
    // const name = this.abcFile.constant_pool.string[(multiname.data as MultinameKindQName).name - 1];

    const multiname2 =
      this.abcFile2.constant_pool.multiname[instanceTwo.name - 1];
    // const name2 = this.abcFile2.constant_pool.string[(multiname2.data as MultinameKindQName).name - 1];

    if (instanceOne.flags !== instanceTwo.flags) {
      return false;
    }

    if (instanceOne.interface.length !== instanceTwo.interface.length) {
      return false;
    }

    if (!this.compareMethods(instanceOne.iinit, instanceTwo.iinit)) {
      return false;
    }

    // Definitely need to improve trait comparison

    if (instanceOne.trait.length !== instanceTwo.trait.length) {
      return false;
    }

    for (let i = 0; i < instanceOne.trait.length; i++) {
      const trait = instanceOne.trait[i];
      const trait2 = instanceTwo.trait[i];

      if (!this.compareTraits(trait, trait2)) {
        return false;
      }
    }

    return true;
  }

  public compareClasses(
    classObject: ClassInfo,
    classObject2: ClassInfo
  ): boolean {
    if (!this.compareMethods(classObject.cinit, classObject2.cinit)) {
      return false;
    }

    if (classObject.traits.length !== classObject2.traits.length) {
      return false;
    }

    for (let i = 0; i < classObject.traits.length; i++) {
      const trait = classObject.traits[i];
      const trait2 = classObject2.traits[i];

      if (!this.compareTraits(trait, trait2)) {
        return false;
      }
    }

    return true;
  }

  public getInstanceName(
    instance: InstanceInfo,
    abcFile2: boolean = false
  ): string {
    if (!instance.name) {
      return "";
    }

    const abcFile: AbcFile = abcFile2 ? this.abcFile2 : this.abcFile;

    const multiname = abcFile.constant_pool.multiname[instance.name - 1];

    return abcFile.constant_pool.string[
      (multiname.data as MultinameKindQName).name - 1
    ];
  }

  public findChangedInstances(): number[] {
    let changed = [];

    for (let i = 0; i < this.abcFile.class_count; i++) {
      const instance = this.abcFile.instance[i];
      const classObject = this.abcFile.class[i];

      const name = this.getInstanceName(instance);

      let matches = 0;
      let lastName = "";

      for (let j = 0; j < this.abcFile2.class_count; j++) {
        const instance2 = this.abcFile2.instance[j];
        const classObject2 = this.abcFile2.class[j];

        const name2 = this.getInstanceName(instance2, true);

        if (name == name2 && !name.startsWith("_-")) {
          matches = 1;
          lastName = name2;
          break;
        }
        const instanceComparison = this.compareInstances(instance, instance2);
        const classComparison = this.compareClasses(classObject, classObject2);

        if (instanceComparison && classComparison) {
          matches++;
          lastName = name2;
        }
      }

      if (matches != 1) {
        changed.push(i);
      } else if (matches == 1 && !!lastName) {
        this.registerNameConversion(name, lastName);
      }
    }

    return changed;
  }
}
