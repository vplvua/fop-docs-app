"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { Client } from "@/lib/db/schema/clients";

import { initialClientActionState } from "../action-state";
import { updateClient } from "../actions";
import { ClientField } from "../client-field";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Збереження…" : "Зберегти"}
    </button>
  );
}

function SuccessAlert({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-green-300/50 bg-green-50 p-3 text-sm text-green-800 dark:border-green-700/50 dark:bg-green-950/30 dark:text-green-200">
      {message}
    </div>
  );
}

function SyncFields({ client, fe }: { client: Client; fe: Record<string, string> | undefined }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium text-muted-foreground">🔄 Синхронізовані поля</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <ClientField id="name" label="Назва" defaultValue={client.name} error={fe?.name} required />
        <ClientField
          id="legalId"
          label="ЄДРПОУ / РНОКПП"
          defaultValue={client.legalId}
          error={fe?.legalId}
          required
        />
        <ClientField
          id="email"
          label="Email"
          type="email"
          defaultValue={client.email}
          error={fe?.email}
          required
        />
        <ClientField
          id="address"
          label="Адреса"
          defaultValue={client.address}
          error={fe?.address}
        />
        <ClientField
          id="bankName"
          label="Назва банку"
          defaultValue={client.bankName}
          error={fe?.bankName}
        />
        <ClientField
          id="bankAccount"
          label="IBAN"
          defaultValue={client.bankAccount}
          error={fe?.bankAccount}
        />
      </div>
    </fieldset>
  );
}

function ManualFields({ client, fe }: { client: Client; fe: Record<string, string> | undefined }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium text-muted-foreground">⚙️ Manual only</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <ClientField
          id="apartmentsCount"
          label="Кількість квартир"
          type="number"
          defaultValue={client.apartmentsCount}
          error={fe?.apartmentsCount}
        />
        <ClientField
          id="accessPriceOverride"
          label="Індивідуальна ціна доступу"
          defaultValue={client.accessPriceOverride}
          error={fe?.accessPriceOverride}
        />
        <div className="space-y-1.5">
          <label htmlFor="edoProvider" className="block text-sm font-medium text-foreground">
            Канал ЕДО
          </label>
          <select
            id="edoProvider"
            name="edoProvider"
            aria-label="Канал ЕДО"
            defaultValue={client.edoProvider}
            className="block h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="dubidoc">Дубідок</option>
            <option value="vchasno_external">Вчасно (зовнішнє ЕДО)</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Зміна каналу ЕДО не переоформлює вже згенеровані акти.
          </p>
        </div>
        <ClientField
          id="moeosbbUserId"
          label="ID у Моє ОСББ"
          type="number"
          defaultValue={client.moeosbbUserId}
          error={fe?.moeosbbUserId}
        />
      </div>
    </fieldset>
  );
}

export function ClientInfoForm({ client }: { client: Client }) {
  const [state, formAction] = useActionState(updateClient, initialClientActionState);
  const fe = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={client.id} />
      <SyncFields client={client} fe={fe} />
      <ManualFields client={client} fe={fe} />
      {state.status === "success" && state.message ? (
        <SuccessAlert message={state.message} />
      ) : null}
      <SaveButton />
    </form>
  );
}
