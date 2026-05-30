import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { ClientSnapshot, ContractSnapshot } from "@/lib/classification/types";
import type { Act } from "@/lib/db/schema/acts";
import { uahInWords } from "@/lib/money/uah-in-words";
import type { FopRequisites } from "@/lib/requisites";

import { dejaVuSans } from "./fonts/dejavu-sans";
import { dejaVuSansBold } from "./fonts/dejavu-sans-bold";

export interface ActTemplateProps {
  act: Act;
  fop: FopRequisites;
}

// Fonts are embedded as base64 data URLs (lib/pdf/fonts) so rendering needs no
// network or filesystem font lookup — @react-pdf decodes data: URLs in-process.
Font.register({
  family: "DejaVuSans",
  fonts: [{ src: dejaVuSans }, { src: dejaVuSansBold, fontWeight: "bold" }],
});

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

// The act's total is the stored paid amount (D3), NOT unit_price × quantity —
// a discounted annual act shows its exact paid sum (e.g. 12 шт. – 2000.00).
function totalAmount(amount: string): string {
  return Number(amount).toFixed(2);
}

function formatQuantity(quantity: string): string {
  return String(Math.round(Number(quantity)));
}

const s = StyleSheet.create({
  page: {
    fontFamily: "DejaVuSans",
    fontSize: 11,
    lineHeight: 1.5,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 50,
  },
  title: { fontSize: 14, textAlign: "center" },
  subtitle: { fontSize: 14, textAlign: "center", marginBottom: 24 },

  placeDate: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 },

  paragraph: { textAlign: "justify", marginBottom: 14 },
  bold: { fontWeight: "bold" },

  serviceLine: { marginBottom: 10 },
  totalLine: { marginBottom: 18 },
  claims: { marginBottom: 28 },

  table: { borderWidth: 1, borderColor: "#000", marginTop: 8 },
  headRow: { flexDirection: "row" },
  bodyRow: { flexDirection: "row" },
  headCell: {
    width: "50%",
    padding: 6,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
  },
  headCellLeft: { borderRightWidth: 1, borderRightColor: "#000" },
  cell: { width: "50%", padding: 8, fontSize: 10 },
  cellLeft: { borderRightWidth: 1, borderRightColor: "#000" },
  reqLine: { marginBottom: 2 },
});

// Pre-composed style arrays (hoisted so they are not re-created per render).
const headCellLeftBold = [s.headCell, s.headCellLeft, s.bold];
const headCellBold = [s.headCell, s.bold];
const cellLeft = [s.cell, s.cellLeft];
const reqLineBold = [s.reqLine, s.bold];

function Preamble({
  client,
  contract,
  fop,
}: {
  client: ClientSnapshot;
  contract: ContractSnapshot;
  fop: FopRequisites;
}) {
  return (
    <Text style={s.paragraph}>
      Ми, представник Замовника <Text style={s.bold}>{client.name}</Text>, з одного боку, та
      представник Виконавця {fop.nameGenitive}, з іншого боку, склали цей акт про те, що Виконавцем
      були проведені роботи (надані послуги) по договору №
      <Text style={s.bold}>{contract.number}</Text> від{" "}
      <Text style={s.bold}>{formatDate(contract.signedDate)}</Text>:
    </Text>
  );
}

function ExecutorRequisites({ fop }: { fop: FopRequisites }) {
  return (
    <View>
      <Text style={s.reqLine}>{fop.nameNominative}</Text>
      <Text style={s.reqLine}>ІПН {fop.ipn}</Text>
      <Text style={s.reqLine}>Юридична адреса: {fop.legalAddress}</Text>
      <Text style={s.reqLine}>
        Поточний рахунок: {fop.bankAccount} в {fop.bankName}
      </Text>
      <Text style={s.reqLine}>{fop.taxNote}</Text>
      <Text style={s.reqLine}>Тел.: {fop.phone}</Text>
      <Text style={s.reqLine}>Електронна адреса: {fop.email}</Text>
    </View>
  );
}

function ClientRequisites({ client }: { client: ClientSnapshot }) {
  return (
    <View>
      <Text style={reqLineBold}>{client.name}</Text>
      <Text style={s.reqLine}>Код ЄДРПОУ: {client.legalId}</Text>
      <Text style={s.reqLine}>Юридична адреса: {client.address}</Text>
      {client.bankAccount ? (
        <Text style={s.reqLine}>
          Поточний рахунок: {client.bankAccount} в {client.bankName ?? ""}
        </Text>
      ) : null}
    </View>
  );
}

function RequisitesTable({ client, fop }: { client: ClientSnapshot; fop: FopRequisites }) {
  return (
    <View style={s.table}>
      <View style={s.headRow}>
        <Text style={headCellLeftBold}>Від Виконавця</Text>
        <Text style={headCellBold}>Від Замовника</Text>
      </View>
      <View style={s.bodyRow}>
        <View style={cellLeft}>
          <ExecutorRequisites fop={fop} />
        </View>
        <View style={s.cell}>
          <ClientRequisites client={client} />
        </View>
      </View>
    </View>
  );
}

export function ActTemplate({ act, fop }: ActTemplateProps) {
  const client = act.clientSnapshot as ClientSnapshot;
  const contract = act.contractSnapshot as ContractSnapshot;
  const total = totalAmount(act.amount);
  const quantity = formatQuantity(act.quantity);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View>
          <Text style={s.title}>АКТ {act.number}</Text>
          <Text style={s.subtitle}>здачі-приймання робіт (надання послуг)</Text>
          <View style={s.placeDate}>
            <Text>{fop.city}</Text>
            <Text>{formatDate(act.actDate)}</Text>
          </View>
        </View>

        <Preamble client={client} contract={contract} fop={fop} />

        <Text style={s.serviceLine}>
          {act.serviceDescription}, {quantity} шт. – {total} грн.
        </Text>
        <Text style={s.totalLine}>
          Загальна вартість робіт (послуг) без ПДВ {total} грн. ({uahInWords(total)}), ПДВ 0.00 грн.
        </Text>

        <Text style={s.claims}>Сторони претензій одна до одної не мають.</Text>

        <RequisitesTable client={client} fop={fop} />
      </Page>
    </Document>
  );
}
