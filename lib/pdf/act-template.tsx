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

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function totalAmount(unitPrice: string, quantity: string): string {
  return (Number(unitPrice) * Number(quantity)).toFixed(2);
}

const TEMPLATE_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #000; padding: 40px 50px; }
  h1 { font-size: 14pt; text-align: center; margin: 24px 0 16px; }
  .center { text-align: center; font-size: 11pt; }
  .center-mt { text-align: center; font-size: 11pt; margin-top: 4px; }
  .parties { margin-bottom: 20px; line-height: 1.6; }
  .parties p { margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 11pt; }
  th { background: #f0f0f0; font-weight: bold; }
  .w5 { width: 5%; } .w12 { width: 12%; } .w15 { width: 15%; }
  .total { font-weight: bold; }
  .total-right { font-weight: bold; text-align: right; }
  .signatures { margin-top: 40px; display: flex; justify-content: space-between; }
  .sig-block { width: 45%; }
  .sig-line { border-bottom: 1px solid #000; margin-top: 40px; margin-bottom: 4px; }
  .sig-label { font-size: 10pt; }
  .note { font-size: 10pt; color: #333; margin-top: 8px; }
`;

const cssInject = { __html: TEMPLATE_CSS };

function ActHeader({ act, contract }: { act: Act; contract: ContractSnapshot }) {
  return (
    <div>
      <h1>АКТ {act.number} виконаних робіт (наданих послуг)</h1>
      <p className="center">від {formatDate(act.actDate)} р.</p>
      <p className="center-mt">
        по договору №{contract.number} від {formatDate(contract.signedDate)} р.
      </p>
    </div>
  );
}

function Parties({ fop, client }: { fop: FopDetails; client: ClientSnapshot }) {
  return (
    <div className="parties">
      <p>
        <strong>Виконавець:</strong> {fop.name}, ЄДРПОУ/РНОКПП: {fop.legalId}, {fop.address}.
        Поточний рахунок: {fop.bankAccount} в {fop.bankName}.
      </p>
      <p>
        <strong>Замовник:</strong> {client.name}, ЄДРПОУ: {client.legalId}, {client.address}.
        {client.bankAccount
          ? ` Поточний рахунок: ${client.bankAccount} в ${client.bankName ?? ""}.`
          : ""}
      </p>
    </div>
  );
}

function ServiceTable({ act, total }: { act: Act; total: string }) {
  return (
    <table>
      <thead>
        <tr>
          <th className="w5">№</th>
          <th>Найменування послуги</th>
          <th className="w12">Кількість</th>
          <th className="w15">Ціна, грн</th>
          <th className="w15">Сума, грн</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>{act.serviceDescription}</td>
          <td>
            {act.quantity} {act.quantityUnit}
          </td>
          <td>{act.unitPrice}</td>
          <td>{total}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={4} className="total-right">
            Всього:
          </td>
          <td className="total">{total} грн</td>
        </tr>
      </tfoot>
    </table>
  );
}

function Signatures({ fop, client }: { fop: FopDetails; client: ClientSnapshot }) {
  return (
    <div className="signatures">
      <div className="sig-block">
        <p>
          <strong>Виконавець:</strong>
        </p>
        <div className="sig-line" />
        <p className="sig-label">{fop.name}</p>
      </div>
      <div className="sig-block">
        <p>
          <strong>Замовник:</strong>
        </p>
        <div className="sig-line" />
        <p className="sig-label">{client.name}</p>
      </div>
    </div>
  );
}

export function ActTemplate({ act, fop }: ActTemplateProps) {
  const client = act.clientSnapshot as ClientSnapshot;
  const contract = act.contractSnapshot as ContractSnapshot;
  const total = totalAmount(act.unitPrice, act.quantity);

  return (
    <html lang="uk">
      <head>
        <meta charSet="utf-8" />
        {/* eslint-disable-next-line react/no-danger -- static CSS literal */}
        <style dangerouslySetInnerHTML={cssInject} />
      </head>
      <body>
        <ActHeader act={act} contract={contract} />
        <Parties fop={fop} client={client} />
        <ServiceTable act={act} total={total} />
        <p className="note">Без ПДВ згідно ст. 297 ПКУ (ФОП 3 група єдиного податку).</p>
        <Signatures fop={fop} client={client} />
      </body>
    </html>
  );
}
