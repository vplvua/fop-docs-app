import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { Act } from "@/lib/db/schema/acts";
import type { ClientSnapshot, ContractSnapshot } from "@/lib/classification/types";

interface FopDetails {
  name: string;
  legalId: string;
  address: string;
  bankAccount: string;
  bankName: string;
}

export interface ActTemplateProps {
  act: Act;
  fop: FopDetails;
}

Font.register({
  family: "Times",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/npm/@canvas-fonts/times-new-roman@1.0.4/Times%20New%20Roman.ttf",
    },
    {
      src: "https://cdn.jsdelivr.net/npm/@canvas-fonts/times-new-roman-bold@1.0.4/Times%20New%20Roman%20Bold.ttf",
      fontWeight: "bold",
    },
  ],
});

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function totalAmount(unitPrice: string, quantity: string): string {
  return (Number(unitPrice) * Number(quantity)).toFixed(2);
}

const cell = { borderWidth: 1, borderColor: "#000", padding: 5, fontSize: 10 } as const;
const thBase = { ...cell, backgroundColor: "#f0f0f0", fontWeight: "bold" } as const;

const s = StyleSheet.create({
  page: {
    fontFamily: "Times",
    fontSize: 11,
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 50,
  },
  title: { fontSize: 13, fontWeight: "bold", textAlign: "center", marginTop: 20, marginBottom: 8 },
  center: { textAlign: "center", fontSize: 10, marginBottom: 2 },
  bold: { fontWeight: "bold" },

  parties: { marginTop: 16, marginBottom: 12, lineHeight: 1.6 },
  partyLine: { marginBottom: 4, fontSize: 10 },

  table: { marginTop: 12, marginBottom: 12 },
  tableRow: { flexDirection: "row" },

  thNum: { ...thBase, width: "5%" },
  thName: { ...thBase, width: "43%" },
  thQty: { ...thBase, width: "15%" },
  thPrice: { ...thBase, width: "17%" },
  thSum: { ...thBase, width: "20%" },

  tdNum: { ...cell, width: "5%" },
  tdName: { ...cell, width: "43%" },
  tdQty: { ...cell, width: "15%" },
  tdPrice: { ...cell, width: "17%" },
  tdSum: { ...cell, width: "20%" },

  totalLabel: { ...cell, width: "80%", textAlign: "right", fontWeight: "bold" },
  totalValue: { ...cell, width: "20%", fontWeight: "bold" },

  note: { fontSize: 9, color: "#333", marginTop: 8 },

  signatures: { flexDirection: "row", justifyContent: "space-between", marginTop: 40 },
  sigBlock: { width: "45%" },
  sigLine: { borderBottomWidth: 1, borderBottomColor: "#000", marginTop: 36, marginBottom: 4 },
  sigLabel: { fontSize: 9 },
});

function ActHeader({ act, contract }: { act: Act; contract: ContractSnapshot }) {
  return (
    <View>
      <Text style={s.title}>АКТ {act.number} виконаних робіт (наданих послуг)</Text>
      <Text style={s.center}>від {formatDate(act.actDate)} р.</Text>
      <Text style={s.center}>
        по договору №{contract.number} від {formatDate(contract.signedDate)} р.
      </Text>
    </View>
  );
}

function Parties({ fop, client }: { fop: FopDetails; client: ClientSnapshot }) {
  return (
    <View style={s.parties}>
      <Text style={s.partyLine}>
        <Text style={s.bold}>Виконавець: </Text>
        {fop.name}, ЄДРПОУ/РНОКПП: {fop.legalId}, {fop.address}. Поточний рахунок: {fop.bankAccount}{" "}
        в {fop.bankName}.
      </Text>
      <Text style={s.partyLine}>
        <Text style={s.bold}>Замовник: </Text>
        {client.name}, ЄДРПОУ: {client.legalId}, {client.address}.
        {client.bankAccount
          ? ` Поточний рахунок: ${client.bankAccount} в ${client.bankName ?? ""}.`
          : ""}
      </Text>
    </View>
  );
}

function ServiceTable({ act, total }: { act: Act; total: string }) {
  return (
    <View style={s.table}>
      <View style={s.tableRow}>
        <Text style={s.thNum}>№</Text>
        <Text style={s.thName}>Найменування послуги</Text>
        <Text style={s.thQty}>Кількість</Text>
        <Text style={s.thPrice}>Ціна, грн</Text>
        <Text style={s.thSum}>Сума, грн</Text>
      </View>
      <View style={s.tableRow}>
        <Text style={s.tdNum}>1</Text>
        <Text style={s.tdName}>{act.serviceDescription}</Text>
        <Text style={s.tdQty}>
          {act.quantity} {act.quantityUnit}
        </Text>
        <Text style={s.tdPrice}>{act.unitPrice}</Text>
        <Text style={s.tdSum}>{total}</Text>
      </View>
      {/* Footer */}
      <View style={s.tableRow}>
        <Text style={s.totalLabel}>Всього:</Text>
        <Text style={s.totalValue}>{total} грн</Text>
      </View>
    </View>
  );
}

function Signatures({ fop, client }: { fop: FopDetails; client: ClientSnapshot }) {
  return (
    <View style={s.signatures}>
      <View style={s.sigBlock}>
        <Text style={s.bold}>Виконавець:</Text>
        <View style={s.sigLine} />
        <Text style={s.sigLabel}>{fop.name}</Text>
      </View>
      <View style={s.sigBlock}>
        <Text style={s.bold}>Замовник:</Text>
        <View style={s.sigLine} />
        <Text style={s.sigLabel}>{client.name}</Text>
      </View>
    </View>
  );
}

export function ActTemplate({ act, fop }: ActTemplateProps) {
  const client = act.clientSnapshot as ClientSnapshot;
  const contract = act.contractSnapshot as ContractSnapshot;
  const total = totalAmount(act.unitPrice, act.quantity);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <ActHeader act={act} contract={contract} />
        <Parties fop={fop} client={client} />
        <ServiceTable act={act} total={total} />
        <Text style={s.note}>Без ПДВ згідно ст. 297 ПКУ (ФОП 3 група єдиного податку).</Text>
        <Signatures fop={fop} client={client} />
      </Page>
    </Document>
  );
}
