import { Buffer } from "node:buffer";
import * as XLSX from "xlsx";

function guardXlsxContainer(bytes: Uint8Array, maxUncompressedBytes = 25 * 1024 * 1024) {
  if (bytes.length < 22) throw new Error("Le fichier Excel n’est pas une archive XLSX valide.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const readU16 = (position: number) => view.getUint16(position, true);
  const readU32 = (position: number) => view.getUint32(position, true);
  let endRecord = -1;
  for (let position = Math.max(0, bytes.length - 65557); position <= bytes.length - 22; position += 1) {
    if (readU32(position) === 0x06054b50) endRecord = position;
  }
  if (endRecord < 0) throw new Error("Le fichier Excel n’est pas une archive XLSX valide.");
  const entries = readU16(endRecord + 10);
  const directorySize = readU32(endRecord + 12);
  const directoryOffset = readU32(endRecord + 16);
  if (entries < 1 || entries > 160 || directorySize > 1024 * 1024 || directoryOffset + directorySize > endRecord) {
    throw new Error("Le classeur Excel contient trop d’éléments ou une structure non prise en charge.");
  }
  let cursor = directoryOffset;
  let totalUncompressed = 0;
  const decoder = new TextDecoder("utf-8", { fatal: true });
  for (let index = 0; index < entries; index += 1) {
    if (cursor + 46 > endRecord || readU32(cursor) !== 0x02014b50) throw new Error("Le classeur Excel est mal formé.");
    const compressedSize = readU32(cursor + 20);
    const uncompressedSize = readU32(cursor + 24);
    const nameLength = readU16(cursor + 28);
    const extraLength = readU16(cursor + 30);
    const commentLength = readU16(cursor + 32);
    const recordLength = 46 + nameLength + extraLength + commentLength;
    if (cursor + recordLength > endRecord || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) throw new Error("Les archives XLSX Zip64 ne sont pas prises en charge.");
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    if (name.startsWith("/") || name.split("/").includes("..") || /xl\/(?:externallinks|vbaProject)/i.test(name)) throw new Error("Les liens externes et macros ne sont pas acceptés.");
    if (uncompressedSize > 10 * 1024 * 1024) throw new Error("Une partie du classeur dépasse la taille maximale.");
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > maxUncompressedBytes || (uncompressedSize > 1024 * 1024 && compressedSize > 0 && uncompressedSize / compressedSize > 200)) {
      throw new Error("Le classeur semble compressé de manière anormale.");
    }
    cursor += recordLength;
  }
}

export function readCommerceWorkbookRows(bytes: Uint8Array, maxRows: number, maxColumns: number): string[][] {
  guardXlsxContainer(bytes);
  const workbook = XLSX.read(Buffer.from(bytes), { type: "buffer", raw: true, cellFormula: true, cellDates: false, bookVBA: false, WTF: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Le classeur ne contient aucune feuille.");
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error("La première feuille du classeur est illisible.");
  const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"] as string) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
  if (range.e.r + 1 > maxRows + 1 || range.e.c + 1 > maxColumns) throw new Error(`La feuille dépasse ${maxRows} lignes ou ${maxColumns} colonnes.`);
  const cells = Object.keys(sheet).filter((key) => !key.startsWith("!"));
  if (cells.length > (maxRows + 1) * 20) throw new Error("La feuille contient trop de cellules.");
  if (cells.some((address) => Boolean((sheet[address] as XLSX.CellObject | undefined)?.f))) throw new Error("Les cellules contenant des formules ne sont pas acceptées. Utilisez des valeurs simples.");
  return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "", blankrows: false }).map((row) =>
    Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [],
  );
}
