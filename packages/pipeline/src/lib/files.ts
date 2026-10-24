import ExcelJS from "exceljs";
import { unzipSync } from "fflate";

/** Rows of the first worksheet as arrays of cell values (1-based columns shifted to 0-based). */
export async function xlsxRows(bytes: Buffer): Promise<unknown[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("workbook has no sheets");
  const rows: unknown[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[];
    rows.push(
      values
        .slice(1)
        .map((v) =>
          v && typeof v === "object" && "result" in v ? v.result : v,
        ),
    );
  });
  return rows;
}

/** The single file in a zip archive whose name ends with `suffix`. */
export function zipEntry(zip: Buffer, suffix: string): Buffer {
  const files = unzipSync(new Uint8Array(zip));
  const name = Object.keys(files).find((n) => n.endsWith(suffix));
  if (!name)
    throw new Error(
      `no ${suffix} in archive (${Object.keys(files).join(", ")})`,
    );
  return Buffer.from(files[name]!);
}

/** Delimited text with a header row into objects keyed by header. */
export function csvRecords(
  bytes: Buffer,
  delimiter: string,
  encoding: "utf-8" | "windows-1250" = "utf-8",
  /** Title lines before the header row. */
  skipLines = 0,
): Record<string, string>[] {
  const lines = new TextDecoder(encoding)
    .decode(bytes)
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .slice(skipLines)
    .filter(
      (l) => l.replace(new RegExp(`\\${delimiter}`, "g"), "").trim() !== "",
    );
  const header = lines[0]!.split(delimiter).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(delimiter);
    return Object.fromEntries(
      header.map((h, i) => [h, (cells[i] ?? "").trim()]),
    );
  });
}
