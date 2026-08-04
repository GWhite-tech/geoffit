import type { Reminder, Treatment, InventoryLot } from "@/lib/domain/treatment"
import {
  daysRemainingSupply,
  prescriptionRequestInDays,
  todayKey,
} from "@/lib/health/treatment/calculations"

export function buildTreatmentReminders(
  treatments: Treatment[],
  lots: InventoryLot[],
  now = new Date()
): Reminder[] {
  const today = todayKey(now)
  const reminders: Reminder[] = []

  for (const treatment of treatments) {
    if (treatment.status !== "active") continue
    const treatmentLots = lots.filter((lot) => lot.treatmentId === treatment.id)
    const daysLeft = daysRemainingSupply(treatment, treatmentLots)

    if (daysLeft != null && daysLeft <= 21) {
      reminders.push({
        id: `supply-${treatment.id}`,
        treatmentId: treatment.id,
        kind: "inventory_low",
        title: treatment.shortName,
        detail: `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`,
        dueDate: today,
        fingerprint: `reminder:supply:${treatment.id}:${daysLeft}`,
      })
    }

    if (
      treatment.category === "prescription" ||
      treatment.category === "supplement"
    ) {
      const requestIn = prescriptionRequestInDays(
        daysLeft,
        treatment.prescriptionLeadTimeDays
      )
      if (requestIn != null && requestIn <= 7 && requestIn >= 0) {
        reminders.push({
          id: `rx-${treatment.id}`,
          treatmentId: treatment.id,
          kind: "prescription_renewal",
          title: `${treatment.shortName} prescription`,
          detail:
            requestIn === 0
              ? "Request repeat prescription today"
              : `Repeat prescription due in ${requestIn} day${requestIn === 1 ? "" : "s"}`,
          dueDate: today,
          fingerprint: `reminder:rx:${treatment.id}:${requestIn}`,
        })
      }
    }

    const frozen = treatmentLots.find((lot) => lot.status === "frozen")
    const active = treatmentLots.find((lot) => lot.status === "active")
    if (frozen && active && daysLeft != null && daysLeft <= 5) {
      reminders.push({
        id: `fridge-${treatment.id}`,
        treatmentId: treatment.id,
        kind: "move_to_fridge",
        title: `Move ${treatment.shortName} to fridge`,
        detail: "Move next vial to fridge tomorrow",
        dueDate: today,
        fingerprint: `reminder:fridge:${treatment.id}`,
      })
    }

    for (const lot of treatmentLots) {
      if (
        lot.reconstitution?.discardAfter &&
        lot.reconstitution.discardAfter <= today &&
        ["active", "reconstituted"].includes(lot.status)
      ) {
        reminders.push({
          id: `discard-${lot.id}`,
          treatmentId: treatment.id,
          kind: "discard_expired",
          title: `Discard ${treatment.shortName} vial`,
          detail: `Reconstituted vial past discard date (${lot.reconstitution.discardAfter})`,
          dueDate: today,
          fingerprint: `reminder:discard:${lot.id}`,
        })
      }
    }
  }

  return reminders
}
