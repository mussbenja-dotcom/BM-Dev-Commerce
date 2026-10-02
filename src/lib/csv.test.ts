import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes separators, quotes and newlines", () => {
    expect(csvCell('Pérez; "La" Tienda')).toBe('"Pérez; ""La"" Tienda"');
    expect(csvCell("línea\notra")).toBe('"línea\notra"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(1500)).toBe("1500");
  });
  it("neutralizes spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe("\"'=HYPERLINK(\"\"http://x\"\")\"");
    expect(csvCell("+5491155550000")).toBe("'+5491155550000");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@user")).toBe("'@user");
  });
  it("builds a UTF-8 file with BOM and CRLF rows", () => {
    expect(toCsv(["a", "b"], [[1, "x"]])).toBe("﻿a;b\r\n1;x\r\n");
  });
});
