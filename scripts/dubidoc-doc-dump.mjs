// Read-only diagnostic: dump a DubiDoc document's status + participants.
// Usage:
//   DUBIDOC_TOKEN=... DUBIDOC_ORGANIZATION_ID=... node scripts/dubidoc-doc-dump.mjs <documentId>
const docId = process.argv[2];
const token = process.env.DUBIDOC_TOKEN;
const org = process.env.DUBIDOC_ORGANIZATION_ID;

if (!docId || !token || !org) {
  console.error("Need DUBIDOC_TOKEN, DUBIDOC_ORGANIZATION_ID env and <documentId> arg");
  process.exit(1);
}

const res = await fetch(`https://api.dubidoc.com.ua/api/v1/documents/${docId}`, {
  headers: { "X-Access-Token": token, "X-Organization": org },
});

if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}

const d = await res.json();
console.log(
  "top-level status:",
  d.status,
  "| state:",
  d.state,
  "| archived:",
  d.archived,
  "| refused:",
  d.refused,
);
console.log(
  "hasParticipants:",
  d.hasParticipants,
  "| canSend:",
  d.canSend,
  "| hasPublicAccess:",
  d.hasPublicAccess,
);
const parts = d.participants ?? [];
console.log(`inline participants: ${parts.length}`);
for (const p of parts) {
  console.log(
    `  role=${p.role} status=${p.status} priority=${p.priority} reqSign=${p.isSignatureRequired} edrpou=${p.edrpou ?? "-"} result=${JSON.stringify(p.result ?? null)}`,
  );
}

const pres = await fetch(`https://api.dubidoc.com.ua/api/v1/documents/${docId}/participants`, {
  headers: { "X-Access-Token": token, "X-Organization": org },
});
console.log(`\nGET /participants -> HTTP ${pres.status}`);
if (pres.ok) {
  const pj = await pres.json();
  const list = Array.isArray(pj) ? pj : (pj.participants ?? pj.data ?? []);
  console.log(`/participants count: ${Array.isArray(list) ? list.length : "?"}`);
  for (const p of Array.isArray(list) ? list : []) {
    console.log(
      `  role=${p.role} status=${p.status} priority=${p.priority} reqSign=${p.isSignatureRequired} email=${p.user?.email ?? p.email ?? "-"} result=${JSON.stringify(p.result ?? null)}`,
    );
  }
}
console.log("\ndoc keys:", Object.keys(d).join(", "));
