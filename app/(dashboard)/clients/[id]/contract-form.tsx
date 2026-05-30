"use client";

import { useActionState, useCallback, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";

import { initialClientActionState } from "../action-state";
import { ClientField } from "../client-field";

import { createContract, deleteContract, updateContract } from "./contract-actions";

interface FieldDefaults {
  number?: string;
  signedDate?: string;
  isStandard?: boolean;
  fileUrl?: string | null;
  notes?: string | null;
}

function SaveButton({ label = "Зберегти" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-9 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Збереження…" : label}
    </button>
  );
}

function SuccessAlert({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-success/30 bg-success/5 p-3 text-sm text-success-deep">
      {message}
    </div>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </div>
  );
}

function ContractCoreFields({
  defaults,
  fieldErrors,
}: {
  defaults: FieldDefaults;
  fieldErrors: Record<string, string> | undefined;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ClientField
        id="number"
        label="Номер договору"
        defaultValue={defaults.number ?? ""}
        error={fieldErrors?.number}
        required
      />
      <ClientField
        id="signedDate"
        label="Дата підписання"
        type="date"
        defaultValue={defaults.signedDate ?? ""}
        error={fieldErrors?.signedDate}
        required
      />
    </div>
  );
}

function ContractOptionalFields({
  defaults,
  fieldErrors,
}: {
  defaults: FieldDefaults;
  fieldErrors: Record<string, string> | undefined;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          id="isStandard"
          name="isStandard"
          type="checkbox"
          defaultChecked={defaults.isStandard ?? true}
          value="true"
          aria-label="Типовий договір"
          className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
        />
        <label htmlFor="isStandard" className="text-sm font-medium text-foreground">
          Типовий договір
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ClientField
          id="fileUrl"
          label="URL документу"
          defaultValue={defaults.fileUrl ?? ""}
          error={fieldErrors?.fileUrl}
        />
        <div className="space-y-1.5">
          <label htmlFor="notes" className="block text-sm font-medium text-foreground">
            Примітки
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            defaultValue={defaults.notes ?? ""}
            aria-label="Примітки"
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
    </div>
  );
}

function DeleteButton({ contractId }: { contractId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction] = useActionState(deleteContract, initialClientActionState);
  const startConfirm = useCallback(() => setConfirming(true), []);
  const cancelConfirm = useCallback(() => setConfirming(false), []);

  if (state.status === "error") {
    return <ErrorAlert message={state.message ?? "Помилка"} />;
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={startConfirm}
        className="inline-flex h-8 items-center rounded-md border border-destructive/30 bg-destructive/10 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
      >
        Видалити договір
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Підтвердити видалення?</span>
      <form action={formAction}>
        <input type="hidden" name="id" value={contractId} />
        <button
          type="submit"
          className="inline-flex h-8 items-center rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
        >
          Так, видалити
        </button>
      </form>
      <button
        type="button"
        onClick={cancelConfirm}
        className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
      >
        Скасувати
      </button>
    </div>
  );
}

function FileLink({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
    >
      Завантажити документ ↗
    </a>
  );
}

function StatusAlerts({ state }: { state: { status: string; message?: string } }) {
  if (state.status === "success" && state.message) return <SuccessAlert message={state.message} />;
  if (state.status === "error" && state.message) return <ErrorAlert message={state.message} />;
  return null;
}

function CreateContractForm({ client }: { client: Client }) {
  const [state, formAction] = useActionState(createContract, initialClientActionState);
  const defaults = useMemo<FieldDefaults>(
    () => ({ number: client.moeosbbUserId ? String(client.moeosbbUserId) : "" }),
    [client.moeosbbUserId],
  );

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="clientId" value={client.id} />
      <p className="text-sm text-muted-foreground">Клієнт ще не має договору. Створіть новий.</p>
      <ContractCoreFields defaults={defaults} fieldErrors={state.fieldErrors} />
      <ContractOptionalFields defaults={defaults} fieldErrors={state.fieldErrors} />
      <StatusAlerts state={state} />
      <SaveButton label="Створити договір" />
    </form>
  );
}

function EditContractForm({ contract }: { contract: Contract }) {
  const [state, formAction] = useActionState(updateContract, initialClientActionState);

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-6">
        <input type="hidden" name="id" value={contract.id} />
        <p className="text-xs text-muted-foreground">
          Зміна номеру/дати не переоформлює вже згенеровані акти.
        </p>
        <ContractCoreFields defaults={contract} fieldErrors={state.fieldErrors} />
        <ContractOptionalFields defaults={contract} fieldErrors={state.fieldErrors} />
        {contract.fileUrl ? <FileLink url={contract.fileUrl} /> : null}
        <StatusAlerts state={state} />
        <SaveButton />
      </form>
      <div className="border-t border-border pt-4">
        <DeleteButton contractId={contract.id} />
      </div>
    </div>
  );
}

export function ContractForm({ contract, client }: { contract: Contract | null; client: Client }) {
  if (contract) {
    return <EditContractForm contract={contract} />;
  }
  return <CreateContractForm client={client} />;
}
