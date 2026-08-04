"use client"

import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SectionLabel } from "@/components/ui/section-label"
import type { Treatment } from "@/lib/domain/treatment"
import { STORAGE_LOCATION_LABELS } from "@/lib/domain/treatment"
import {
  calculateConcentration,
  calculateInjectionVolumeMl,
  calculateInsulinUnits,
  formatUnits,
  getTreatmentStore,
} from "@/lib/health/treatment"

export function TreatmentReconstitutionEditor({
  treatment,
  remainingMg,
  remainingInjections,
}: {
  treatment: Treatment
  remainingMg: number | null
  remainingInjections: number | null
}) {
  const recon = treatment.reconstitution
  const [vialMg, setVialMg] = useState(
    String(recon?.vialStrengthMg ?? "")
  )
  const [bacMl, setBacMl] = useState(String(recon?.bacWaterMl ?? ""))
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setVialMg(String(treatment.reconstitution?.vialStrengthMg ?? ""))
    setBacMl(String(treatment.reconstitution?.bacWaterMl ?? ""))
  }, [
    treatment.id,
    treatment.reconstitution?.vialStrengthMg,
    treatment.reconstitution?.bacWaterMl,
  ])

  const preview = useMemo(() => {
    const vial = Number(vialMg)
    const bac = Number(bacMl)
    if (!(vial > 0) || !(bac > 0)) return null
    const concentration = calculateConcentration(vial, bac)
    const volume = calculateInjectionVolumeMl(
      treatment.currentDose,
      concentration
    )
    const units = calculateInsulinUnits(volume)
    return { concentration, volume, units }
  }, [vialMg, bacMl, treatment.currentDose])

  const dirty = useMemo(() => {
    const vial = Number(vialMg)
    const bac = Number(bacMl)
    if (!Number.isFinite(vial) || !Number.isFinite(bac)) return false
    if (!recon) return vial > 0 && bac > 0
    return vial !== recon.vialStrengthMg || bac !== recon.bacWaterMl
  }, [vialMg, bacMl, recon])

  function save() {
    const vial = Number(vialMg)
    const bac = Number(bacMl)
    if (!(vial > 0) || !(bac > 0)) return
    getTreatmentStore().updateReconstitution(treatment.id, {
      vialStrengthMg: vial,
      bacWaterMl: bac,
    })
    setSaved(true)
  }

  return (
    <section className="space-y-4">
      <SectionLabel>Reconstitution</SectionLabel>
      <div className="mc-card space-y-6 px-5 py-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              Vial size
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={vialMg}
                onChange={(event) => {
                  setVialMg(event.target.value)
                  setSaved(false)
                }}
                className="h-11 max-w-[160px] border-border/40 bg-card/30 text-[18px] font-medium tracking-tight"
              />
              <span className="text-[15px] text-muted-foreground">mg</span>
            </div>
          </label>

          <label className="block space-y-2">
            <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
              Bac water added
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={bacMl}
                onChange={(event) => {
                  setBacMl(event.target.value)
                  setSaved(false)
                }}
                className="h-11 max-w-[160px] border-border/40 bg-card/30 text-[18px] font-medium tracking-tight"
              />
              <span className="text-[15px] text-muted-foreground">ml</span>
            </div>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Concentration"
            value={
              preview
                ? `${preview.concentration.toFixed(2)} mg/ml`
                : "—"
            }
          />
          <Metric
            label="Injection volume"
            value={preview ? `${preview.volume.toFixed(3)} ml` : "—"}
          />
          <Metric
            label="Insulin units"
            value={preview ? (formatUnits(preview.units) ?? "—") : "—"}
          />
          <Metric
            label="Storage"
            value={
              recon
                ? STORAGE_LOCATION_LABELS[recon.storage]
                : "—"
            }
          />
          <Metric
            label="Remaining"
            value={
              remainingMg != null ? `${remainingMg.toFixed(1)} mg` : "—"
            }
          />
          <Metric
            label="Injections left"
            value={
              remainingInjections != null
                ? String(remainingInjections)
                : "—"
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={save}
            disabled={!dirty}
            className="rounded-full px-5"
          >
            Save reconstitution
          </Button>
          {saved ? (
            <span className="text-[13px] text-success">Saved</span>
          ) : dirty ? (
            <span className="text-[13px] text-muted-foreground">
              Unsaved changes
            </span>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
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
