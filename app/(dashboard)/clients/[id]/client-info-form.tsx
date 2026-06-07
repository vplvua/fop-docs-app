"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect } from "react";
import { useForm, type FieldErrors, type UseFormRegister } from "react-hook-form";

import { toastError, toastSuccess } from "@/app/components/toast";
import type { Client } from "@/lib/db/schema/clients";
import {
  CLIENT_CARD_FIELDS,
  type ClientCardField,
  type ClientCardFormValues,
  clientCardFormSchema,
} from "@/lib/validation/clients";

import { updateClient, type ClientUpdatePayload } from "../actions";

import { FormErrorSummary, SaveBar } from "./card-form-ui";
import { RhfField } from "./rhf-field";
import { useUnsavedChanges } from "./unsaved-changes-guard";

type Register = UseFormRegister<ClientCardFormValues>;
type Errors = FieldErrors<ClientCardFormValues>;

function toFormValues(client: Client): ClientCardFormValues {
  return {
    name: client.name ?? "",
    shortName: client.shortName ?? "",
    legalId: client.legalId ?? "",
    email: client.email ?? "",
    address: client.address ?? "",
    bankName: client.bankName ?? "",
    bankAccount: client.bankAccount ?? "",
    apartmentsCount: client.apartmentsCount?.toString() ?? "",
    accessPriceOverride: client.accessPriceOverride ?? "",
    edoProvider: client.edoProvider,
    moeosbbUserId: client.moeosbbUserId?.toString() ?? "",
  };
}

function SyncFields({ register, errors }: { register: Register; errors: Errors }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium text-muted-foreground">🔄 Синхронізовані поля</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <RhfField
          id="name"
          label="Назва"
          registration={register("name")}
          error={errors.name?.message}
          required
        />
        <RhfField
          id="legalId"
          label="ЄДРПОУ / РНОКПП"
          registration={register("legalId")}
          error={errors.legalId?.message}
          required
        />
        <RhfField
          id="email"
          label="Email"
          type="email"
          registration={register("email")}
          error={errors.email?.message}
          required
        />
        <RhfField
          id="address"
          label="Адреса"
          registration={register("address")}
          error={errors.address?.message}
          required
        />
        <RhfField
          id="bankName"
          label="Назва банку"
          registration={register("bankName")}
          error={errors.bankName?.message}
          required
        />
        <RhfField
          id="bankAccount"
          label="IBAN"
          registration={register("bankAccount")}
          error={errors.bankAccount?.message}
          required
        />
      </div>
    </fieldset>
  );
}

function ManualFields({ register, errors }: { register: Register; errors: Errors }) {
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium text-muted-foreground">⚙️ Manual only</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <RhfField
          id="shortName"
          label="Коротка назва"
          registration={register("shortName")}
          error={errors.shortName?.message}
          hint="Для списків і назви в Дубідок; без юр. форми"
        />
        <RhfField
          id="apartmentsCount"
          label="Кількість квартир"
          type="number"
          registration={register("apartmentsCount")}
          error={errors.apartmentsCount?.message}
        />
        <RhfField
          id="accessPriceOverride"
          label="Індивідуальна ціна доступу"
          registration={register("accessPriceOverride")}
          error={errors.accessPriceOverride?.message}
        />
        <div className="space-y-1.5">
          <label htmlFor="edoProvider" className="block text-sm font-medium text-foreground">
            Канал ЕДО
          </label>
          <select
            id="edoProvider"
            aria-label="Канал ЕДО"
            {...register("edoProvider")}
            className="block h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="dubidoc">Дубідок</option>
            <option value="vchasno_external">Вчасно (зовнішнє ЕДО)</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Зміна каналу ЕДО не переоформлює вже згенеровані акти.
          </p>
        </div>
        <RhfField
          id="moeosbbUserId"
          label="ID у Моє ОСББ"
          type="number"
          registration={register("moeosbbUserId")}
          error={errors.moeosbbUserId?.message}
        />
      </div>
    </fieldset>
  );
}

export function ClientInfoForm({ client }: { client: Client }) {
  const guard = useUnsavedChanges();
  const form = useForm<ClientCardFormValues>({
    resolver: zodResolver(clientCardFormSchema),
    defaultValues: toFormValues(client),
    mode: "onTouched",
  });
  const { register, formState, reset, setError, setFocus, handleSubmit } = form;
  const { errors, dirtyFields, isDirty, isSubmitting } = formState;

  const save = useCallback(
    async (values: ClientCardFormValues): Promise<boolean> => {
      const payload: ClientUpdatePayload = { id: client.id };
      for (const key of CLIENT_CARD_FIELDS) {
        if (dirtyFields[key]) payload[key] = values[key];
      }
      const res = await updateClient(payload);
      if (res.status === "success") {
        toastSuccess(res.message ?? "Збережено");
        reset(values);
        return true;
      }
      if (res.status === "field_error" && res.fieldErrors) {
        const fieldErrors = res.fieldErrors;
        const keys = Object.keys(fieldErrors) as ClientCardField[];
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
    [client.id, dirtyFields, reset, setError, setFocus],
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

  return (
    <form onSubmit={handleSubmit(save, onInvalid)} className="space-y-6">
      <FormErrorSummary count={Object.keys(errors).length} />
      <SyncFields register={register} errors={errors} />
      <ManualFields register={register} errors={errors} />
      <SaveBar dirty={isDirty} saving={isSubmitting} onReset={onReset} />
    </form>
  );
}
