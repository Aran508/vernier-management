/**
 * Excel/CSV imports historically required the header row to match our
 * internal field names exactly (e.g. "partNumber"). In practice, people
 * type natural headers in Excel — "Part Number", "Part No.", "PN" — and an
 * exact-match lookup silently failed on every row, always reporting
 * "missing partNumber" even on a correctly-filled file.
 *
 * This normalizes any header spelling/casing/punctuation variant to our
 * canonical field name, and simply ignores columns it doesn't recognize
 * (rather than erroring) — so extra columns in someone's spreadsheet don't
 * break the import either.
 */

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Canonical field -> accepted header variants (already run through normalizeKey).
const ALIASES: Record<string, string[]> = {
  date: ["date", "transactiondate", "entrydate"],
  partNumber: ["partnumber", "partno", "pno", "pn", "materialcode", "itemcode", "part"],
  description: ["description", "desc", "materialdescription", "itemdescription", "materialname", "itemname"],
  category: ["category", "cat", "materialcategory"],
  department: ["department", "dept", "dep"],
  unit: ["unit", "uom", "unitofmeasure", "units"],
  location: ["location", "loc", "locationcode", "rackrowshelf"],
  minStock: ["minstock", "minimumstock", "min"],
  maxStock: ["maxstock", "maximumstock", "max"],
  openingStock: ["openingstock", "openingqty", "openingquantity", "opening"],
  unitValue: ["unitvalue", "rate", "price", "unitprice", "unitcost", "cost", "value"],
  supplier: ["supplier", "vendor", "supplierviname"],
  remarks: ["remarks", "remark", "notes", "note", "comment", "comments"],
  invoiceNumber: ["invoicenumber", "invoiceno", "invno", "invoice", "billno", "billnumber"],
  grnNumber: ["grnnumber", "grnno", "grn", "goodsreceiptnote", "goodsreceiptnumber"],
  quantity: ["quantity", "qty", "qtynos", "nos", "issuequantity", "receivedquantity"],
  receivedBy: ["receivedby", "receiver", "storekeeper"],
  verifiedBy: ["verifiedby", "verifier", "checkedby"],
  issuedTo: ["issuedto", "issueto", "issuedfor", "recipient", "givento"],
  purpose: ["purpose", "reason", "usage"],
};

/**
 * Takes one raw row object as parsed by SheetJS (keys = whatever the
 * spreadsheet's header row literally said) and returns an object using our
 * canonical field names. Unrecognized columns are dropped.
 */
export function normalizeImportRow(raw: Record<string, unknown>): Record<string, unknown> {
  const normalizedInput: [string, unknown][] = Object.entries(raw).map(([key, value]) => [normalizeKey(key), value]);

  const result: Record<string, unknown> = {};
  const used = new Set<string>();

  // Pass 1: exact match against a known header spelling (e.g. "Part No" -> partNumber).
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    for (const alias of aliases) {
      const hit = normalizedInput.find(([k]) => k === alias && !used.has(k));
      if (hit && hit[1] !== undefined && hit[1] !== "") {
        result[canonical] = hit[1];
        used.add(hit[0]);
        break;
      }
    }
  }

  // Pass 2: some real-world exports cram two labels into one header cell
  // (e.g. "Part No Material Description" for what is really just the
  // description column), which never matches any alias exactly. Fall back
  // to a "contains" check for aliases long enough (>=6 normalized chars)
  // that a substring match is still a reliable signal, skipping columns
  // pass 1 already claimed so one column can't feed two fields.
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    if (result[canonical] !== undefined) continue;
    for (const alias of aliases) {
      if (alias.length < 6) continue;
      const hit = normalizedInput.find(([k]) => !used.has(k) && k.includes(alias));
      if (hit && hit[1] !== undefined && hit[1] !== "") {
        result[canonical] = hit[1];
        used.add(hit[0]);
        break;
      }
    }
  }

  return result;
}

export function normalizeImportRows(rows: unknown[]): Record<string, unknown>[] {
  return (rows as Record<string, unknown>[]).map(normalizeImportRow);
}

const ALL_ALIAS_KEYS = new Set(Object.values(ALIASES).flat());

/**
 * How many cells in a raw spreadsheet row look like one of our known
 * column headers (Part Number, Description, Qty, ...). Used to locate the
 * real header row in files that have a title, logo, or blank rows above
 * the actual column headers — a common shape for exports from other
 * systems, which previously caused every field to come through blank
 * because row 1 (the title) was treated as the header row.
 */
function headerMatchScore(row: unknown[]): number {
  let score = 0;
  for (const cell of row) {
    if (typeof cell !== "string" && typeof cell !== "number") continue;
    if (ALL_ALIAS_KEYS.has(normalizeKey(String(cell)))) score++;
  }
  return score;
}

/**
 * Scans the first `maxScan` rows of a sheet (parsed as arrays, e.g. via
 * XLSX's `{ header: 1 }` option) and returns the index of the row that
 * looks most like our column headers. Falls back to row 0 if nothing
 * scores above zero, so well-formed files behave exactly as before.
 */
export function findHeaderRowIndex(rows: unknown[][], maxScan = 10): number {
  let bestIdx = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const score = headerMatchScore(rows[i] ?? []);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}
