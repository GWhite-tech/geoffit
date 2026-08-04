import type {
  InventoryLot,
  Treatment,
} from "@/lib/domain/treatment"
import { buildReconstitutionProfile } from "@/lib/health/treatment/calculations"

function fp(prefix: string, id: string): string {
  return `${prefix}:${id}`
}

/** Starter stack so the Treatment OS is usable on first open. */
export function createStarterTreatments(): {
  treatments: Treatment[]
  lots: InventoryLot[]
} {
  const recon = buildReconstitutionProfile(24, 3, {
    storage: "fridge",
    openedDate: new Date().toISOString().slice(0, 10),
  })

  const treatments: Treatment[] = [
    {
      id: "retatrutide",
      name: "Retatrutide",
      shortName: "Retatrutide",
      category: "peptide",
      status: "active",
      doseUnit: "mg",
      currentDose: 4,
      schedules: [{ daysOfWeek: [0, 1, 2, 3, 4, 5, 6], time: "19:00" }],
      reconstitution: recon,
      injectionVolumeMl: 0.5,
      injectionUnits: 50,
      startedAt: "2026-01-15",
      sortOrder: 10,
      fingerprint: fp("treatment", "retatrutide"),
      notes: "Evening injection. Titrate carefully.",
    },
    {
      id: "metformin",
      name: "Metformin",
      shortName: "Metformin",
      category: "prescription",
      status: "active",
      doseUnit: "mg",
      currentDose: 500,
      dosesPerDay: 2,
      tabletsRemaining: 56,
      prescriptionLeadTimeDays: 7,
      schedules: [
        { daysOfWeek: [], time: "08:00", label: "Morning" },
        { daysOfWeek: [], time: "20:00", label: "Evening" },
      ],
      startedAt: "2025-11-01",
      sortOrder: 20,
      fingerprint: fp("treatment", "metformin"),
    },
    {
      id: "vitamin-d",
      name: "Vitamin D3",
      shortName: "Vitamin D",
      category: "supplement",
      status: "active",
      doseUnit: "IU",
      currentDose: 4000,
      dosesPerDay: 1,
      tabletsRemaining: 90,
      schedules: [{ daysOfWeek: [], time: "08:30" }],
      startedAt: "2025-10-01",
      sortOrder: 30,
      fingerprint: fp("treatment", "vitamin-d"),
    },
  ]

  const lots: InventoryLot[] = [
    {
      id: "reta-lot-active",
      treatmentId: "retatrutide",
      batchNumber: "RTA-2401",
      supplier: "Research",
      receivedDate: "2026-03-01",
      expiry: "2027-03-01",
      storageLocation: "fridge",
      quantity: 16,
      quantityUnit: "mg",
      status: "active",
      reconstitution: recon,
      fingerprint: fp("lot", "reta-lot-active"),
    },
    {
      id: "reta-lot-frozen",
      treatmentId: "retatrutide",
      batchNumber: "RTA-2402",
      supplier: "Research",
      receivedDate: "2026-04-01",
      expiry: "2027-04-01",
      storageLocation: "freezer",
      quantity: 1,
      quantityUnit: "vials",
      status: "frozen",
      reconstitution: buildReconstitutionProfile(24, 3, { storage: "freezer" }),
      fingerprint: fp("lot", "reta-lot-frozen"),
    },
    {
      id: "metformin-lot",
      treatmentId: "metformin",
      receivedDate: "2026-07-01",
      storageLocation: "room_temperature",
      quantity: 56,
      quantityUnit: "tablets",
      status: "active",
      fingerprint: fp("lot", "metformin-lot"),
    },
  ]

  return { treatments, lots }
}
