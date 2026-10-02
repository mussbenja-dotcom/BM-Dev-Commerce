/**
 * CSV for spreadsheets (Excel / Google Sheets in Spanish locales use ";").
 * Cells that start with = + - @ (or tab/CR) are prefixed with ' so a customer
 * name can never run as a formula when the merchant opens the file.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // BOM so Excel opens UTF-8 accents correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}
