import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { ReportColumn } from "../reportData";
import React from "react";

const COLORS = {
  ink: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  headerBg: "#0f172a",
  headerText: "#ffffff",
  rowAlt: "#f8fafc",
  brandTeal: "#0f766e",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 32,
    fontSize: 9,
    color: COLORS.ink,
    fontFamily: "Helvetica",
  },
  letterhead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: COLORS.brandTeal,
    paddingBottom: 10,
    marginBottom: 14,
  },
  logo: { width: 70, height: 40, objectFit: "contain" },
  companyBlock: { flexDirection: "column" },
  companyName: { fontSize: 13, fontWeight: 700, color: COLORS.ink },
  companySub: { fontSize: 8, color: COLORS.muted, marginTop: 2 },
  metaBlock: { alignItems: "flex-end" },
  metaLine: { fontSize: 8, color: COLORS.muted, marginTop: 1 },
  titleRow: { marginBottom: 10 },
  reportTitle: { fontSize: 15, fontWeight: 700, color: COLORS.ink },
  filterLine: { fontSize: 8.5, color: COLORS.muted, marginTop: 3 },
  table: { display: "flex", width: "100%", borderWidth: 1, borderColor: COLORS.border },
  tRow: { flexDirection: "row" },
  tHeadRow: { flexDirection: "row", backgroundColor: COLORS.headerBg },
  tHeadCell: {
    color: COLORS.headerText,
    fontSize: 8,
    fontWeight: 700,
    paddingVertical: 6,
    paddingHorizontal: 5,
    textTransform: "uppercase",
  },
  tCell: {
    fontSize: 8.5,
    paddingVertical: 5,
    paddingHorizontal: 5,
    color: COLORS.ink,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  altRow: { backgroundColor: COLORS.rowAlt },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: COLORS.muted,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 6,
  },
  summaryBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: -2,
    fontSize: 8,
    color: COLORS.muted,
  },
});

export interface ReportDocumentProps {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  logoBase64?: string; // data URI, e.g. "data:image/jpeg;base64,..."
  companyName?: string;
  companySub?: string;
  filterSummary?: string; // e.g. "Department: Machining · Scope: Filtered view"
  generatedBy?: string;
}

const ROWS_PER_PAGE_ESTIMATE = 28;

export function ReportDocument({
  title,
  columns,
  rows,
  logoBase64,
  companyName = "PED Tool Room",
  companySub = "Production Engineering Department — Store & Inventory Management",
  filterSummary,
  generatedBy,
}: ReportDocumentProps) {
  const now = new Date();
  const totalFlex = columns.reduce((s, c) => s + (c.width ?? 1), 0);

  return (
    <Document title={`${title} — PED Tool Room`}>
      <Page size="A4" orientation="landscape" style={styles.page} wrap>
        <View style={styles.letterhead} fixed>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {/* @react-pdf/renderer's Image renders into a PDF, not a browser DOM — it has no alt prop. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logoBase64 ? <Image src={logoBase64} style={styles.logo} /> : null}
            <View style={styles.companyBlock}>
              <Text style={styles.companyName}>{companyName}</Text>
              <Text style={styles.companySub}>{companySub}</Text>
            </View>
          </View>
          <View style={styles.metaBlock}>
            <Text style={styles.metaLine}>Generated: {now.toLocaleDateString()} {now.toLocaleTimeString()}</Text>
            {generatedBy && <Text style={styles.metaLine}>By: {generatedBy}</Text>}
          </View>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.reportTitle}>{title}</Text>
          {filterSummary && <Text style={styles.filterLine}>{filterSummary}</Text>}
        </View>

        <View style={styles.summaryBar}>
          <Text>{rows.length} record{rows.length === 1 ? "" : "s"}</Text>
        </View>

        <View style={{ marginTop: 8 }}>
          <View style={styles.table}>
            <View style={styles.tHeadRow} fixed>
              {columns.map((c) => (
                <Text
                  key={c.key}
                  style={[styles.tHeadCell, { flex: c.width ?? 1, textAlign: c.align ?? "left" }]}
                >
                  {c.header}
                </Text>
              ))}
            </View>

            {rows.length === 0 ? (
              <View style={styles.tRow}>
                <Text style={[styles.tCell, { flex: totalFlex, textAlign: "center", color: COLORS.muted }]}>
                  No records found for the selected filters.
                </Text>
              </View>
            ) : (
              rows.map((row, i) => (
                <View key={i} style={[styles.tRow, i % 2 === 1 ? styles.altRow : {}]} wrap={false}>
                  {columns.map((c) => (
                    <Text
                      key={c.key}
                      style={[styles.tCell, { flex: c.width ?? 1, textAlign: c.align ?? "left" }]}
                    >
                      {String(row[c.key] ?? "-")}
                    </Text>
                  ))}
                </View>
              ))
            )}
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>PED Tool Room Management System — Internal Use Only</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

// silence unused import warning for React in some TS configs
void React;
export { ROWS_PER_PAGE_ESTIMATE };
