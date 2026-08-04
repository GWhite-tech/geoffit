"use client"

import Link from "next/link"
import { motion } from "framer-motion"

import { SectionLabel } from "@/components/ui/section-label"
import {
  DOSE_EVENT_LABELS,
  INVENTORY_STATUS_LABELS,
  STORAGE_LOCATION_LABELS,
  TREATMENT_CATEGORY_LABELS,
  TREATMENT_STATUS_LABELS,
} from "@/lib/domain/treatment"
import { TreatmentDoseEditor } from "@/components/treatment/treatment-dose-editor"
import { TreatmentDoseHistory } from "@/components/treatment/treatment-dose-history"
import { TreatmentReconstitutionEditor } from "@/components/treatment/treatment-reconstitution-editor"
import { TreatmentStartDate } from "@/components/treatment/treatment-start-date"
import {
  formatAnalyticsDelta,
  formatDose,
  formatUnits,
  getTreatmentStore,
  useTreatmentDetail,
} from "@/lib/health/treatment"
import { transitions } from "@/lib/theme"
import { cn } from "@/lib/utils"

export function TreatmentDetail({ treatmentId }: { treatmentId: string }) {
  const detail = useTreatmentDetail(treatmentId)

  if (!detail) {
    return (
      <div className="mx-auto max-w-[960px] px-6 py-12">
        <p className="text-[15px] text-muted-foreground">Unknown treatment.</p>
        <Link href="/treatment" className="mt-4 inline-block text-primary">
          Back to treatments
        </Link>
      </div>
    )
  }

  const { treatment, lots, events, analytics, peptide, reminders } = detail

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[960px] flex-col gap-10 px-6 py-10 lg:px-10">
      <div>
        <Link
          href="/treatment"
          className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Treatments
        </Link>
        <SectionLabel className="mt-6">
          {TREATMENT_CATEGORY_LABELS[treatment.category]}
        </SectionLabel>
        <h1 className="mt-3 text-[36px] font-semibold tracking-tight text-foreground">
          {treatment.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-[28px] font-medium tracking-tight text-foreground">
            {formatDose(treatment.currentDose, treatment.doseUnit)}
          </p>
          <p
            className={cn(
              "text-[15px] font-medium",
              treatment.status === "active" ? "text-success" : "text-muted-foreground"
            )}
          >
            {TREATMENT_STATUS_LABELS[treatment.status]}
          </p>
          {treatment.startedAt ? (
            <p className="text-[14px] text-muted-foreground">
              Started {treatment.startedAt}
            </p>
          ) : null}
        </div>
        {treatment.notes ? (
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            {treatment.notes}
          </p>
        ) : null}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.fadeUp}
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <Stat
          label="Current dose"
          value={formatDose(treatment.currentDose, treatment.doseUnit)}
        />
        <Stat
          label="Injection"
          value={
            formatUnits(peptide.injectionUnits ?? treatment.injectionUnits) ??
            "—"
          }
        />
        <Stat
          label="Adherence"
          value={
            analytics.adherencePercent != null
              ? `${analytics.adherencePercent}%`
              : "—"
          }
        />
        <Stat
          label="Supply"
          value={
            analytics.supplyDaysRemaining != null
              ? `${analytics.supplyDaysRemaining} days`
              : "—"
          }
        />
      </motion.div>

      {treatment.category === "peptide" || treatment.reconstitution ? (
        <TreatmentReconstitutionEditor
          treatment={treatment}
          remainingMg={analytics.remainingMg}
          remainingInjections={analytics.remainingInjections}
        />
      ) : null}

      {(treatment.category === "prescription" ||
        treatment.category === "supplement") && (
        <section className="space-y-4">
          <SectionLabel>Prescription</SectionLabel>
          <div className="mc-card grid gap-4 px-5 py-5 sm:grid-cols-3">
            <Stat
              label="Tablets remaining"
              value={
                treatment.tabletsRemaining != null
                  ? String(treatment.tabletsRemaining)
                  : "—"
              }
            />
            <Stat
              label="Doses / day"
              value={
                treatment.dosesPerDay != null
                  ? String(treatment.dosesPerDay)
                  : "—"
              }
            />
            <Stat
              label="Lead time"
              value={
                treatment.prescriptionLeadTimeDays != null
                  ? `${treatment.prescriptionLeadTimeDays} days`
                  : "—"
              }
            />
          </div>
        </section>
      )}

      <TreatmentStartDate treatment={treatment} />

      <TreatmentDoseEditor treatment={treatment} />

      <TreatmentDoseHistory treatment={treatment} events={events} />

      <section className="space-y-4">
        <SectionLabel>Inventory</SectionLabel>
        {lots.length === 0 ? (
          <div className="mc-card px-5 py-6 text-[15px] text-muted-foreground">
            No inventory lots yet.
          </div>
        ) : (
          <ul className="space-y-2">
            {lots.map((lot) => (
              <li key={lot.id} className="mc-card px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[15px] font-medium text-foreground">
                      {lot.batchNumber ?? "Lot"} ·{" "}
                      {INVENTORY_STATUS_LABELS[lot.status]}
                    </p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      {lot.quantity} {lot.quantityUnit}
                      {lot.supplier ? ` · ${lot.supplier}` : ""}
                      {lot.expiry ? ` · Exp ${lot.expiry}` : ""}
                    </p>
                    <p className="mt-1 text-[12px] text-muted-foreground/70">
                      {STORAGE_LOCATION_LABELS[lot.storageLocation]} · received{" "}
                      {lot.receivedDate}
                    </p>
                  </div>
                  {lot.status === "frozen" ? (
                    <button
                      type="button"
                      onClick={() =>
                        getTreatmentStore().moveLotToFridge(lot.id)
                      }
                      className="rounded-full bg-primary/15 px-3 py-1.5 text-[12px] font-medium text-primary transition-colors hover:bg-primary/25"
                    >
                      Move to fridge
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <SectionLabel>Analytics</SectionLabel>
        <div className="mc-card grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Days on treatment"
            value={
              analytics.daysOnTreatment != null
                ? String(analytics.daysOnTreatment)
                : "—"
            }
          />
          <Stat
            label="Taken / missed"
            value={`${analytics.takenDoses} / ${analytics.missedDoses}`}
          />
          <Stat
            label="Weight since start"
            value={formatAnalyticsDelta(
              analytics.weightSinceStart.delta,
              analytics.weightSinceStart.unit
            )}
          />
          <Stat
            label="HbA1c since start"
            value={
              analytics.hba1cSinceStart.display ??
              formatAnalyticsDelta(analytics.hba1cSinceStart.delta, "mmol/mol")
            }
          />
          <Stat
            label="Body fat since start"
            value={formatAnalyticsDelta(
              analytics.bodyFatSinceStart.delta,
              "%"
            )}
          />
          <Stat
            label="Adherence"
            value={
              analytics.adherencePercent != null
                ? `${analytics.adherencePercent}%`
                : "—"
            }
          />
        </div>
      </section>

      {reminders.length > 0 ? (
        <section className="space-y-4">
          <SectionLabel>Reminders</SectionLabel>
          <ul className="space-y-2">
            {reminders.map((reminder) => (
              <li key={reminder.id} className="mc-card px-5 py-4">
                <p className="text-[14px] font-medium text-foreground">
                  {reminder.title}
                </p>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  {reminder.detail}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionLabel>History</SectionLabel>
        {events.length === 0 ? (
          <div className="mc-card px-5 py-6 text-[15px] text-muted-foreground">
            Dose events will appear here as you use the weekly planner.
          </div>
        ) : (
          <ul className="mc-card divide-y divide-border/25">
            {events.slice(0, 40).map((event) => (
              <li
                key={event.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div>
                  <p className="text-[14px] font-medium text-foreground">
                    {DOSE_EVENT_LABELS[event.kind]}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    {event.date}
                    {event.scheduledTime ? ` · ${event.scheduledTime}` : ""}
                    {event.dose != null
                      ? ` · ${formatDose(event.dose, event.doseUnit ?? "")}`
                      : ""}
                  </p>
                  {event.notes ? (
                    <p className="mt-1 text-[12px] text-muted-foreground/80">
                      {event.notes}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
        {label}
      </p>
      <p className="mt-2 text-[18px] leading-none font-medium tracking-tight text-foreground">
        {value}
      </p>
    </div>
  )
}
