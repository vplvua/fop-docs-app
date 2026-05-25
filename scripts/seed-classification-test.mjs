#!/usr/bin/env node

/**
 * Seed test data for S7 (classification) manual smoke test.
 *
 * Creates: 3 clients, 2 contracts, 6 payments covering different classification scenarios.
 * Idempotent — safe to run multiple times (ON CONFLICT DO NOTHING on payments).
 *
 * Usage:
 *   node scripts/seed-classification-test.mjs
 *
 * Requires POSTGRES_URL in .env.local (run `vercel env pull .env.local` first).
 */

import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../.env.local") });

if (!process.env.POSTGRES_URL) {
  console.error("POSTGRES_URL not set. Run: vercel env pull .env.local");
  process.exit(1);
}

const { neon } = await import("@neondatabase/serverless");
const sql = neon(process.env.POSTGRES_URL);

// ── 1. Clients ──────────────────────────────────────────────────────────────

const CLIENT_COMPLETE = {
  name: "ОСББ Сонячний Промінь",
  legal_id: "33445566",
  address: "м. Київ, вул. Хрещатик 1",
  bank_name: "АТ КБ ПриватБанк",
  bank_account: "UA213223130000026007233566001",
  email: "osbb.soniachnyi@example.com",
  apartments_count: 72,
  edo_provider: "dubidoc",
};

const CLIENT_VCHASNO = {
  name: "ЖБК Дніпровський",
  legal_id: "44556677",
  address: "м. Дніпро, вул. Центральна 5",
  bank_name: "АТ Ощадбанк",
  bank_account: "UA543210987654321098765432101",
  email: "zbk.dnipro@example.com",
  apartments_count: 120,
  edo_provider: "vchasno_external",
};

const CLIENT_INCOMPLETE = {
  name: "ОСББ Без Реквізитів",
  legal_id: "55667788",
  address: "",
  bank_name: null,
  bank_account: null,
  email: "incomplete@example.com",
  apartments_count: null,
  edo_provider: "dubidoc",
};

async function upsertClient(client) {
  const rows = await sql`
    SELECT id FROM clients WHERE legal_id = ${client.legal_id} LIMIT 1
  `;
  if (rows.length > 0) {
    console.log(`  Client "${client.name}" already exists (${rows[0].id})`);
    return rows[0].id;
  }
  const [row] = await sql`
    INSERT INTO clients (name, legal_id, address, bank_name, bank_account, email, apartments_count, edo_provider)
    VALUES (${client.name}, ${client.legal_id}, ${client.address}, ${client.bank_name},
            ${client.bank_account}, ${client.email}, ${client.apartments_count}, ${client.edo_provider})
    RETURNING id
  `;
  console.log(`  Client "${client.name}" created (${row.id})`);
  return row.id;
}

// ── 2. Contracts ────────────────────────────────────────────────────────────

async function upsertContract(clientId, number) {
  const rows = await sql`
    SELECT id FROM contracts WHERE client_id = ${clientId} LIMIT 1
  `;
  if (rows.length > 0) {
    console.log(`  Contract "${number}" already exists`);
    return;
  }
  await sql`
    INSERT INTO contracts (client_id, number, signed_date)
    VALUES (${clientId}, ${number}, '2024-06-01')
  `;
  console.log(`  Contract "${number}" created`);
}

// ── 3. Payments ─────────────────────────────────────────────────────────────

function paymentRow(txId, date, amount, purpose, payerName, payerLegalId, payerIban) {
  return {
    bank_transaction_id: txId,
    payment_date: date,
    amount,
    purpose,
    payer_name: payerName,
    payer_legal_id: payerLegalId,
    payer_bank_account: payerIban,
    raw_data: JSON.stringify({ id: txId, test: true }),
  };
}

async function insertPayment(p) {
  const rows = await sql`
    SELECT id FROM payments WHERE bank_transaction_id = ${p.bank_transaction_id} LIMIT 1
  `;
  if (rows.length > 0) {
    console.log(`  Payment "${p.bank_transaction_id}" already exists`);
    return;
  }
  const [row] = await sql`
    INSERT INTO payments (bank_transaction_id, payment_date, amount, purpose,
                          payer_name, payer_legal_id, payer_bank_account, raw_data, status)
    VALUES (${p.bank_transaction_id}, ${p.payment_date}, ${p.amount}, ${p.purpose},
            ${p.payer_name}, ${p.payer_legal_id}, ${p.payer_bank_account},
            ${p.raw_data}::jsonb, 'received')
    RETURNING id
  `;
  console.log(`  Payment "${p.bank_transaction_id}" created (${row.id})`);
}

// ── Main ────────────────────────────────────────────────────────────────────

console.log("\n=== Seeding classification test data ===\n");

console.log("Clients:");
const completeId = await upsertClient(CLIENT_COMPLETE);
const vchasnoId = await upsertClient(CLIENT_VCHASNO);
await upsertClient(CLIENT_INCOMPLETE);

console.log("\nContracts:");
await upsertContract(completeId, "556770");
await upsertContract(vchasnoId, "556780");
// CLIENT_INCOMPLETE has no contract intentionally

console.log("\nPayments:");
const testPayments = [
  // 1. Happy path: access, known client+contract, amount divisible
  paymentRow(
    "TEST-CLASSIFY-01",
    "2026-05-10",
    "200.00",
    "Оплата за доступ по договір №556770 за травень",
    "ОСББ Сонячний Промінь",
    "33445566",
    "UA213223130000026007233566001",
  ),
  // 2. Happy path: SMS
  paymentRow(
    "TEST-CLASSIFY-02",
    "2026-05-12",
    "140.00",
    "Оплата СМС по договір №556770 у кількості 100",
    "ОСББ Сонячний Промінь",
    "33445566",
    "UA213223130000026007233566001",
  ),
  // 3. no_match: unknown EDRPOU, no contract number in purpose
  paymentRow(
    "TEST-CLASSIFY-03",
    "2026-05-14",
    "500.00",
    "Поповнення рахунку за послуги",
    "ТОВ Невідоме",
    "99887766",
    "UA999999999999999999999999999",
  ),
  // 4. ambiguous_client: contract matches but EDRPOU differs
  paymentRow(
    "TEST-CLASSIFY-04",
    "2026-05-15",
    "200.00",
    "Оплата за доступ по договір №556770",
    "ОСББ Інше",
    "11223344",
    "UA111111111111111111111111111",
  ),
  // 5. external_edo: client uses vchasno
  paymentRow(
    "TEST-CLASSIFY-05",
    "2026-05-16",
    "200.00",
    "Оплата за доступ по договір №556780",
    "ЖБК Дніпровський",
    "44556677",
    "UA543210987654321098765432101",
  ),
  // 6. amount_mismatch: 550 not divisible by 200
  paymentRow(
    "TEST-CLASSIFY-06",
    "2026-05-17",
    "550.00",
    "Оплата за доступ по договір №556770",
    "ОСББ Сонячний Промінь",
    "33445566",
    "UA213223130000026007233566001",
  ),
];

for (const p of testPayments) {
  await insertPayment(p);
}

console.log("\n=== Done ===");
console.log(`
Scenarios to verify in UI (/payments):
  TEST-CLASSIFY-01  → Classify → classified (access, qty=1, unit_price=200)
  TEST-CLASSIFY-02  → Classify → classified (sms, qty=100, unit_price=1.40)
  TEST-CLASSIFY-03  → Classify → in_queue (no_match)
  TEST-CLASSIFY-04  → Classify → in_queue (ambiguous_client)
  TEST-CLASSIFY-05  → Classify → awaiting_review (external_edo)
  TEST-CLASSIFY-06  → Classify → in_queue (amount_mismatch)
`);
