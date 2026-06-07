"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { useForm, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { toastError, toastSuccess } from "@/app/components/toast";
import type { Client } from "@/lib/db/schema/clients";
import type { Contract } from "@/lib/db/schema/contracts";
import {
  CONTRACT_FORM_FIELDS,
  type ContractFormValues,
  contractFormSchema,
} from "@/lib/validation/contracts";

import { type ClientActionState, initialClientActionState } from "../action-state";

import { FormErrorSummary, SaveBar } from "./card-form-ui";
import {
  type ContractUpdatePayload,
  createContract,
  deleteContract,
  updateContract,
} from "./contract-actions";
import { RhfField } from "./rhf-field";
import { useUnsavedChanges } from "./unsaved-changes-guard";

type Register = UseFormRegister<ContractFormValues>;
type Errors = FieldErrors<ContractFormValues>;
type OnSave = (
  values: ContractFormValues,
  dirty: Partial<ContractFormValues>,
) => Promise<ClientActionState>;

function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
      {message}
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

function ContractFields({ register, errors }: { register: Register; errors: Errors }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <RhfField
          id="number"
          label="Номер договору"
          registration={register("number")}
          error={errors.number?.message}
          required
        />
        <RhfField
          id="signedDate"
          label="Дата підписання"
          type="date"
          registration={register("signedDate")}
          error={errors.signedDate?.message}
          required
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          id="isStandard"
          type="checkbox"
          {...register("isStandard")}
          aria-label="Типовий договір"
          className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
        />
        <label htmlFor="isStandard" className="text-sm font-medium text-foreground">
          Типовий договір
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <RhfField
          id="fileUrl"
          label="URL документу"
          registration={register("fileUrl")}
          error={errors.fileUrl?.message}
        />
        <div className="space-y-1.5">
          <label htmlFor="notes" className="block text-sm font-medium text-foreground">
            Примітки
          </label>
          <textarea
            id="notes"
            rows={2}
            {...register("notes")}
            aria-label="Примітки"
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
    </div>
  );
}

/** Shared RHF + guard + save wiring for the create and edit contract forms. */
function useContractCardForm(defaultValues: ContractFormValues, onSave: OnSave) {
  const guard = useUnsavedChanges();
  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues,
    mode: "onTouched",
  });
  const { register, formState, reset, setError, setFocus, handleSubmit } = form;
  const { errors, dirtyFields, isDirty, isSubmitting } = formState;

  const save = useCallback(
    async (values: ContractFormValues): Promise<boolean> => {
      const dirty: Partial<ContractFormValues> = {};
      for (const key of CONTRACT_FORM_FIELDS) {
        if (dirtyFields[key]) (dirty as Record<string, unknown>)[key] = values[key];
      }
      const res = await onSave(values, dirty);
      if (res.status === "success") {
        toastSuccess(res.message ?? "Збережено");
        reset(values);
        return true;
      }
      if (res.status === "field_error" && res.fieldErrors) {
        const fieldErrors = res.fieldErrors;
        const keys = Object.keys(fieldErrors) as (keyof ContractFormValues)[];
        for (const k of keys) {
          const message = fieldErrors[k];
          if (message) setError(k, { message });
        }
        if (keys[0]) setFocus(keys[0]);
        toastError("Не вдалося зберегти");
        return false;
      }
      toastError(res.message ?? "Не вдалося зберегти");
      return false;
    },
    [onSave, dirtyFields, reset, setError, setFocus],
  );

  const onInvalid = useCallback(() => toastError("Перевірте виділені поля"), []);
  const onReset = useCallback(() => reset(), [reset]);

  useEffect(() => {
    guard.setDirty(isDirty);
  }, [guard, isDirty]);

  useEffect(() => {
    guard.registerHandle({
      submit: async () => {
        let ok = false;
        await handleSubmit(
          async (values) => {
            ok = await save(values);
          },
          () => {
            ok = false;
          },
        )();
        return ok;
      },
      reset: onReset,
    });
    return () => guard.registerHandle(null);
  }, [guard, handleSubmit, save, onReset]);

  return {
    register,
    errors,
    isDirty,
    isSubmitting,
    onReset,
    onSubmit: handleSubmit(save, onInvalid),
    errorCount: Object.keys(errors).length,
  };
}

function CreateContractForm({ client }: { client: Client }) {
  const onSave = useCallback<OnSave>(
    (values) => createContract({ clientId: client.id, ...values }),
    [client.id],
  );
  const defaultValues = useMemo<ContractFormValues>(
    () => ({
      number: client.moeosbbUserId ? String(client.moeosbbUserId) : "",
      signedDate: "",
      isStandard: true,
      fileUrl: "",
      notes: "",
    }),
    [client.moeosbbUserId],
  );
  const f = useContractCardForm(defaultValues, onSave);
  return (
    <form onSubmit={f.onSubmit} className="space-y-6">
      <p className="text-sm text-muted-foreground">Клієнт ще не має договору. Створіть новий.</p>
      <FormErrorSummary count={f.errorCount} />
      <ContractFields register={f.register} errors={f.errors} />
      <SaveBar dirty={f.isDirty} saving={f.isSubmitting} onReset={f.onReset} />
    </form>
  );
}

function EditContractForm({ contract }: { contract: Contract }) {
  const onSave = useCallback<OnSave>(
    (_values, dirty) => {
      const payload: ContractUpdatePayload = { id: contract.id, ...dirty };
      return updateContract(payload);
    },
    [contract.id],
  );
  const defaultValues = useMemo<ContractFormValues>(
    () => ({
      number: contract.number,
      signedDate: contract.signedDate,
      isStandard: contract.isStandard,
      fileUrl: contract.fileUrl ?? "",
      notes: contract.notes ?? "",
    }),
    [contract.number, contract.signedDate, contract.isStandard, contract.fileUrl, contract.notes],
  );
  const f = useContractCardForm(defaultValues, onSave);
  return (
    <div className="space-y-6">
      <form onSubmit={f.onSubmit} className="space-y-6">
        <p className="text-xs text-muted-foreground">
          Зміна номеру/дати не переоформлює вже згенеровані акти.
        </p>
        <FormErrorSummary count={f.errorCount} />
        <ContractFields register={f.register} errors={f.errors} />
        {contract.fileUrl ? <FileLink url={contract.fileUrl} /> : null}
        <SaveBar dirty={f.isDirty} saving={f.isSubmitting} onReset={f.onReset} />
      </form>
      <div className="border-t border-border pt-4">
        <DeleteButton contractId={contract.id} />
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

export function ContractForm({ contract, client }: { contract: Contract | null; client: Client }) {
  if (contract) {
    return <EditContractForm contract={contract} />;
  }
  return <CreateContractForm client={client} />;
}
