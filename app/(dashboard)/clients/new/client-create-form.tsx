"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { initialClientActionState } from "../action-state";
import { createClient } from "../actions";
import { ClientField } from "../client-field";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-10 items-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Створення…" : "Створити"}
    </button>
  );
}

interface Props {
  prefill: {
    name?: string | undefined;
    legal_id?: string | undefined;
    bank_account?: string | undefined;
  };
}

export function ClientCreateForm({ prefill }: Props) {
  const [state, formAction] = useActionState(createClient, initialClientActionState);
  const fe = state.fieldErrors;

  return (
    <form action={formAction} className="space-y-6">
      <RequiredFields prefill={prefill} fe={fe} />
      <OptionalFields fe={fe} />
      <FormAlert state={state} />
      <SubmitButton />
    </form>
  );
}

type FE = Record<string, string> | undefined;

function RequiredFields({ prefill, fe }: { prefill: Props["prefill"]; fe: FE }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ClientField id="name" label="Назва" defaultValue={prefill.name} error={fe?.name} required />
      <ClientField
        id="legalId"
        label="ЄДРПОУ / РНОКПП"
        defaultValue={prefill.legal_id}
        error={fe?.legalId}
        required
        hint="8 цифр (ЄДРПОУ) або 10 цифр (РНОКПП)"
      />
      <ClientField id="email" label="Email" type="email" error={fe?.email} required />
      <ClientField id="address" label="Адреса" error={fe?.address} />
    </div>
  );
}

function OptionalFields({ fe }: { fe: FE }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ClientField id="bankName" label="Назва банку" error={fe?.bankName} />
      <ClientField id="bankAccount" label="IBAN" error={fe?.bankAccount} />
      <ClientField
        id="apartmentsCount"
        label="Кількість квартир"
        type="number"
        error={fe?.apartmentsCount}
        hint="Базис для тарифу (manual only)"
      />
      <ClientField
        id="accessPriceOverride"
        label="Індивідуальна ціна доступу"
        error={fe?.accessPriceOverride}
        hint="Формат: 200 або 300.50 (manual only)"
      />
      <div className="space-y-1.5">
        <label htmlFor="edoProvider" className="block text-sm font-medium text-foreground">
          Канал ЕДО
        </label>
        <select
          id="edoProvider"
          name="edoProvider"
          aria-label="Канал ЕДО"
          defaultValue="dubidoc"
          className="block h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="dubidoc">Дубідок</option>
          <option value="vchasno_external">Вчасно (зовнішнє ЕДО)</option>
        </select>
      </div>
      <ClientField
        id="moeosbbUserId"
        label="ID у Моє ОСББ"
        type="number"
        error={fe?.moeosbbUserId}
        hint="Опціонально; прив'яже до синхронізації"
      />
    </div>
  );
}

function FormAlert({ state }: { state: { status: string; message?: string | undefined } }) {
  if (state.status !== "error") return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
    >
      {state.message}
    </div>
  );
}
