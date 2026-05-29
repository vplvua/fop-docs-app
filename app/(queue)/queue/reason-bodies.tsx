"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { ClientSelector } from "./client-selector";
import { searchClientsAction } from "./queue-actions";
import type { ClientCandidate, QueueItemVM } from "./types";

interface LinkProps {
  onLink: (clientId: string) => void;
  linkingId: string | null;
  linkError: string | null;
}

function NoMatchSearch({ onLink, linkingId, linkError }: LinkProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClientCandidate[]>([]);
  const [searching, setSearching] = useState(false);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  }, []);

  const handleSearch = useCallback(async () => {
    setSearching(true);
    setResults(await searchClientsAction(query));
    setSearching(false);
  }, [query]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={handleChange}
          placeholder="Прив'язати до існуючого — пошук за назвою або ЄДРПОУ"
          aria-label="Пошук клієнта"
          className="block h-9 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          disabled={searching || query.trim().length < 2}
          onClick={handleSearch}
          className="shrink-0 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          {searching ? "Пошук…" : "Знайти"}
        </button>
      </div>
      {results.length > 0 ? (
        <ClientSelector
          candidates={results}
          onLink={onLink}
          linkingId={linkingId}
          error={linkError}
        />
      ) : null}
    </div>
  );
}

export function NoMatchBody({ item, ...linkProps }: { item: QueueItemVM } & LinkProps) {
  const newClientHref = `/clients/new?name=${encodeURIComponent(item.payerName)}&legal_id=${encodeURIComponent(item.payerLegalId)}${
    item.payerBankAccount ? `&bank_account=${encodeURIComponent(item.payerBankAccount)}` : ""
  }`;
  return (
    <div className="space-y-3">
      <Link
        href={newClientHref}
        className="inline-flex rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Створити нового клієнта
      </Link>
      <NoMatchSearch {...linkProps} />
    </div>
  );
}

export function MissingFieldsBody({ item }: { item: QueueItemVM }) {
  if (item.missingFields.length === 0) {
    return <p className="text-sm text-muted-foreground">Усі поля заповнено — спробуйте ще раз.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {item.missingFields.map((f) => (
        <li key={f.field} className="text-sm text-foreground">
          <span className="text-muted-foreground">Відсутнє: </span>
          {item.clientId ? (
            <Link
              href={`/clients/${item.clientId}?tab=${f.tab}`}
              className="text-primary underline underline-offset-2"
            >
              {f.label} →
            </Link>
          ) : (
            f.label
          )}
        </li>
      ))}
    </ul>
  );
}

export function MismatchBody({ item }: { item: QueueItemVM }) {
  const amount = Number(item.amount);
  const unit = item.unitPrice ? Number(item.unitPrice) : null;
  const implied = unit && unit !== 0 ? (amount / unit).toFixed(2) : null;
  const unitLabel = item.serviceType === "sms" ? "Ціна СМС" : "Тариф";
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-3">
      <div>
        <dt className="text-muted-foreground">Сума платежу</dt>
        <dd className="text-foreground">{item.amount} грн</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">{unitLabel}</dt>
        <dd className="text-foreground">{item.unitPrice ? `${item.unitPrice} грн` : "—"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Поділ суми на ціну</dt>
        <dd className="text-foreground">{implied ?? "—"}</dd>
      </div>
    </dl>
  );
}

export function MultipleContractsBody({ item }: { item: QueueItemVM }) {
  if (item.parsedContractNumbers.length === 0) {
    return <p className="text-sm text-muted-foreground">Номери договорів не розпізнано.</p>;
  }
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm text-muted-foreground">Знайдені номери договорів:</legend>
      {item.parsedContractNumbers.map((n) => (
        <label key={n} className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="radio"
            name={`contract-${item.id}`}
            value={n}
            aria-label={`Договір ${n}`}
            className="accent-primary"
          />
          {n}
        </label>
      ))}
    </fieldset>
  );
}

export function ExternalEdoBody() {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
        Вчасно
      </span>
      <span className="text-sm text-muted-foreground">
        Акт для цього клієнта створюється вручну у Вчасно.
      </span>
    </div>
  );
}
