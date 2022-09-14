import { AbcFile, ExtendedBuffer } from "abc-disassembler";
import { SWFFile } from "swf-parser";

export function getABCFile(swfFile: SWFFile): false | AbcFile {
  for (const tag of swfFile.tags) {
    if (tag.type == 72) {
      const abcData = tag.data;
      return AbcFile.read(new ExtendedBuffer(abcData)) as AbcFile;
    }
  }

  return false;
}

export function getUInt30Size(value: number) {
  value &= 0xffffffff;

  let bytes = 0;
  while (true) {
    bytes++;
    if (value < 0x80) break;
    value >>= 7;
  }

  return bytes;
}
