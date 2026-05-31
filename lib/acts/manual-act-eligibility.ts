/**
 * Eligibility predicates for operator-driven edit/delete of manual acts.
 *
 * A *manual* act is one whose backing payment has `source = 'manual_external'`
 * (recorded by hand for money that never reached PrivatBank). It is *mutable*
 * only while it has not left the building — the same `canEdit` predicate that
 * already gates the service-description edit: `status = 'draft'` OR
 * `edo_provider = 'vchasno_external'`. Acts already sent to DubiDoc
 * (`sent_to_edo`) or signed are excluded, because DubiDoc exposes no
 * cancel/delete API and amending them would orphan the external document.
 */

export interface ManualActEligibility {
  /** `payments.source` of the backing payment (null when none joined). */
  source: string | null;
  status: string;
  edoProvider: string;
}

/**
 * Whether an act may still be edited at all (independent of how it was created):
 * draft, or a Vchasno-external act (no external document to amend).
 */
export function isMutableAct(status: string, edoProvider: string): boolean {
  return status === "draft" || edoProvider === "vchasno_external";
}

/**
 * Whether an act is an editable/deletable *manual* act: backed by a
 * `manual_external` payment AND still mutable.
 */
export function isEditableManualAct(e: ManualActEligibility): boolean {
  return e.source === "manual_external" && isMutableAct(e.status, e.edoProvider);
}
