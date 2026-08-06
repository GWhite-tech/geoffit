"use client"

import { useCallback, useRef, useState } from "react"
import { motion } from "framer-motion"

import { ImportDropzone } from "@/components/import/import-dropzone"
import { ImportPreviewPanel } from "@/components/import/import-preview-panel"
import { ImportProfilePanel } from "@/components/import/import-profile-panel"
import { ImportProgressPanel } from "@/components/import/import-progress-panel"
import { ImportResultCard } from "@/components/import/import-result-card"
import { ImportSourcePicker } from "@/components/import/import-source-picker"
import { ManualBloodEntryPanel } from "@/components/import/manual-blood-entry-panel"
import { ScreenshotBloodReviewPanel } from "@/components/import/screenshot-blood-review-panel"
import {
  confirmParsedImport,
  rollbackImportBatch,
} from "@/lib/importers/confirm-import"
import {
  extensionAllowed,
  getImportEndpoint,
  toClientImportPreview,
  uploadImportFiles,
  usesDirectStorageUpload,
  type ClientImportPreview,
} from "@/lib/importers/client-upload"
import type { ImportResult } from "@/lib/importers/ImportResult"
import {
  createDefaultImportProfile,
  type ImportProfileToggles,
} from "@/lib/importers/apple-health/import-profile"
import {
  createEmptyProgressEvent,
  type AppleHealthProgressEvent,
} from "@/lib/importers/apple-health/progress"
import {
  type DataSourceDefinition,
  type DataSourceId,
} from "@/lib/importers/sources"
import { BloodTestImporter } from "@/lib/importers/blood-tests/BloodTestImporter"
import { ManualBloodTestImporter } from "@/lib/importers/blood-tests/ManualBloodTestImporter"
import type { ManualBloodEntryRow } from "@/lib/importers/blood-tests/ManualBloodTestImporter"
import { ScreenshotBloodTestImporter } from "@/lib/importers/blood-tests/ScreenshotBloodTestImporter"
import {
  applyManualBloodMarkerValues,
  isOcrGarbledWarning,
} from "@/lib/importers/blood-tests/apply-manual-entry"
import type { BloodManualEntryMarker } from "@/lib/importers/blood-tests/manual-entry"
import type {
  ScreenshotImportDiagnostics,
  ScreenshotReviewRow,
} from "@/lib/importers/blood-tests/ResultNormalizer"
import type { BloodTest } from "@/lib/domain/blood"
import { transitions } from "@/lib/theme"

type ImportStage =
  | "select-source"
  | "upload"
  | "progress"
  | "preview"
  | "importing"
  | "complete"
  | "error"

export function ImportCentre() {
  const [stage, setStage] = useState<ImportStage>("select-source")
  const [source, setSource] = useState<DataSourceDefinition | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorDetails, setErrorDetails] = useState<string[]>([])
  const [pipelinePreview, setPipelinePreview] =
    useState<ClientImportPreview | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [isRollingBack, setIsRollingBack] = useState(false)
  const [progress, setProgress] = useState<AppleHealthProgressEvent>(
    createEmptyProgressEvent()
  )
  const [profile, setProfile] = useState<ImportProfileToggles>(
    createDefaultImportProfile
  )

  const cancelledRef = useRef(false)

  const resetToSource = useCallback(() => {
    cancelledRef.current = true
    setStage("select-source")
    setSource(null)
    setPipelinePreview(null)
    setResult(null)
    setError(null)
    setErrorDetails([])
    setProgress(createEmptyProgressEvent())
  }, [])

  const backToUpload = useCallback(() => {
    cancelledRef.current = true
    setStage(source ? "upload" : "select-source")
    setPipelinePreview(null)
    setResult(null)
    setError(null)
    setErrorDetails([])
    setProgress(createEmptyProgressEvent())
  }, [source])

  const handleSourceSelect = useCallback((next: DataSourceDefinition) => {
    setError(null)
    setErrorDetails([])
    setResult(null)
    setPipelinePreview(null)
    setSource(next)
    setStage("upload")
  }, [])

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      if (!source || files.length === 0) return

      setError(null)
      setErrorDetails([])
      setResult(null)
      setPipelinePreview(null)
      cancelledRef.current = false

      const invalid = files.find(
        (file) => !extensionAllowed(file.name, source.acceptedExtensions)
      )
      if (invalid) {
        const message =
          source.id === "blood-screenshots"
            ? "This importer only supports PNG, JPEG, or HEIC screenshots."
            : source.id === "blood-test"
              ? "This importer only supports PDF blood test reports."
              : source.id === "apple-health"
                ? "This importer only supports Apple Health .xml or .zip exports."
                : source.id === "csv"
                  ? "This importer only supports CSV files."
                  : source.id === "hevy"
                    ? "This importer only supports Hevy workout export CSV files."
                    : `Unsupported file type for ${source.label}.`
        setError(message)
        setStage("error")
        return
      }

      const endpoint = getImportEndpoint(source.id)
      if (!endpoint) {
        setError(
          source.comingSoonNote ??
            "This data source is not available for server import yet."
        )
        setStage("error")
        return
      }

      setStage("progress")
      setProgress(
        createEmptyProgressEvent({
          message: usesDirectStorageUpload(source.id)
            ? files.length > 1
              ? `Uploading ${files.length} files to secure storage…`
              : `Uploading ${source.label} to secure storage…`
            : files.length > 1
              ? `Uploading ${files.length} ${source.label.toLowerCase()} for OCR…`
              : `Uploading ${source.label} file for server-side parsing…`,
          progress: 18,
        })
      )

      try {
        const apiResult = await uploadImportFiles(source.id, files, {
          profile: source.id === "apple-health" ? profile : undefined,
        })

        if (cancelledRef.current) return

        if (!apiResult.success) {
          const failedStage =
            apiResult.diagnostics &&
            typeof apiResult.diagnostics === "object"
              ? (() => {
                  const d = apiResult.diagnostics as {
                    failedStage?: unknown
                    failed_stage?: unknown
                  }
                  if (typeof d.failedStage === "string") return d.failedStage
                  if (typeof d.failed_stage === "string") return d.failed_stage
                  return null
                })()
              : null
          const message = apiResult.error?.trim() || "Import failed."
          setError(
            failedStage
              ? `[${failedStage}] ${message}`
              : message
          )
          const details = [...apiResult.warnings]
          if (failedStage) details.unshift(`Failed stage: ${failedStage}`)
          if (
            apiResult.errorCode &&
            !details.includes(apiResult.errorCode)
          ) {
            details.push(`Code: ${apiResult.errorCode}`)
          }
          const totalChars =
            apiResult.diagnostics &&
            typeof apiResult.diagnostics === "object"
              ? (() => {
                  const d = apiResult.diagnostics as {
                    totalChars?: unknown
                    total_characters?: unknown
                  }
                  if (typeof d.totalChars === "number") return d.totalChars
                  if (typeof d.total_characters === "number")
                    return d.total_characters
                  return null
                })()
              : null
          if (totalChars != null) {
            details.push(`Extracted characters: ${totalChars}`)
          }
          setErrorDetails(details)
          setStage("error")
          return
        }

        const preview = toClientImportPreview(apiResult)
        if (!preview) {
          setError("Server returned an empty import preview.")
          setStage("error")
          return
        }

        setPipelinePreview(preview)
        setStage("preview")
      } catch (err) {
        if (cancelledRef.current) {
          setStage("upload")
          setProgress(createEmptyProgressEvent())
          return
        }
        console.error("[import-centre] upload/parse failed", err)
        const message =
          err instanceof Error && err.message.trim()
            ? err.message
            : "Failed to upload import file."
        // Never surface Safari's opaque JSON SyntaxError as the primary UX.
        setError(
          message === "The string did not match the expected pattern."
            ? "Import failed. Server returned an unreadable response."
            : message
        )
        setErrorDetails([])
        setStage("error")
      }
    },
    [profile, source]
  )

  const handleFileSelected = useCallback(
    async (file: File) => {
      await handleFilesSelected([file])
    },
    [handleFilesSelected]
  )

  const handleConfirm = useCallback(async () => {
    if (!source?.importerId || !pipelinePreview) return

    setStage("importing")
    try {
      const importResult = await confirmParsedImport(
        source.importerId,
        pipelinePreview.parsed
      )
      setResult(importResult)
      setStage("complete")
    } catch {
      setError("Import failed. Please try again.")
      setStage("error")
    }
  }, [pipelinePreview, source])

  const manualEntryRequired = Array.isArray(
    pipelinePreview?.parsed.metadata.manualEntryRequired
  )
    ? (pipelinePreview!.parsed.metadata
        .manualEntryRequired as BloodManualEntryMarker[])
    : []

  const screenshotRows = Array.isArray(
    pipelinePreview?.parsed.metadata.reviewRows
  )
    ? (pipelinePreview!.parsed.metadata.reviewRows as ScreenshotReviewRow[])
    : []

  const screenshotDiagnostics = (pipelinePreview?.parsed.metadata
    .diagnostics ?? pipelinePreview?.diagnostics) as
    | ScreenshotImportDiagnostics
    | null

  const clearManualEntryState = useCallback(
    (nextBloodTest: BloodTest, warnings: string[]) => {
      const hydrator = new BloodTestImporter()
      const parsed = hydrator.hydrateFromServerResult(
        nextBloodTest,
        warnings,
        []
      )
      const preview = hydrator.preview(parsed)
      const validation = hydrator.validate(parsed)
      setPipelinePreview({
        preview,
        validation,
        parsed,
        warnings: validation.warnings,
        diagnostics: pipelinePreview?.diagnostics ?? null,
      })
    },
    [pipelinePreview?.diagnostics]
  )

  const handleApplyManualEntry = useCallback(
    (values: Record<string, { value: number; unit: string }>) => {
      if (!pipelinePreview) return
      const bloodTest = pipelinePreview.parsed.metadata
        .domainBloodTest as BloodTest | undefined
      if (!bloodTest) return

      const nextBloodTest = applyManualBloodMarkerValues(
        bloodTest,
        manualEntryRequired,
        values
      )
      const warnings = (
        Array.isArray(pipelinePreview.parsed.metadata.extractWarnings)
          ? (pipelinePreview.parsed.metadata.extractWarnings as string[])
          : pipelinePreview.warnings
      ).filter((w) => !isOcrGarbledWarning(w))

      clearManualEntryState(nextBloodTest, warnings)
    },
    [clearManualEntryState, manualEntryRequired, pipelinePreview]
  )

  const handleSkipManualEntry = useCallback(() => {
    if (!pipelinePreview) return
    const bloodTest = pipelinePreview.parsed.metadata
      .domainBloodTest as BloodTest | undefined
    if (!bloodTest) return

    const warnings = (
      Array.isArray(pipelinePreview.parsed.metadata.extractWarnings)
        ? (pipelinePreview.parsed.metadata.extractWarnings as string[])
        : pipelinePreview.warnings
    ).filter((w) => !isOcrGarbledWarning(w))

    clearManualEntryState(bloodTest, [
      ...warnings,
      `Skipped manual entry for: ${manualEntryRequired.map((m) => m.name).join(", ")}.`,
    ])
  }, [clearManualEntryState, manualEntryRequired, pipelinePreview])

  const handleScreenshotRowsChange = useCallback(
    (rows: ScreenshotReviewRow[]) => {
      if (!pipelinePreview) return
      const hydrator = new ScreenshotBloodTestImporter()
      const parsed = hydrator.applyReviewRows(pipelinePreview.parsed, rows)
      const preview = hydrator.preview(parsed)
      const validation = hydrator.validate(parsed)
      setPipelinePreview({
        preview,
        validation,
        parsed,
        warnings: validation.warnings,
        diagnostics:
          (parsed.metadata.diagnostics as Record<string, unknown>) ??
          pipelinePreview.diagnostics,
      })
    },
    [pipelinePreview]
  )

  const handleManualRowsSubmit = useCallback(
    async (rows: ManualBloodEntryRow[]) => {
      if (!source?.importerId) return

      const hydrator = new ManualBloodTestImporter()
      const parsed = hydrator.hydrateFromRows(rows)
      const validation = hydrator.validate(parsed)
      if (!validation.valid) {
        setError(validation.errors[0] ?? "Could not build manual blood entry.")
        setStage("error")
        return
      }

      setError(null)
      setErrorDetails([])
      setStage("importing")
      try {
        const importResult = await confirmParsedImport(
          source.importerId,
          parsed
        )
        setResult(importResult)
        setStage("complete")
      } catch {
        setError("Import failed. Please try again.")
        setStage("error")
      }
    },
    [source?.importerId]
  )

  const handleRollback = useCallback(async () => {
    if (!source?.importerId || !result?.batchId) return

    setIsRollingBack(true)
    try {
      const rollbackResult = await rollbackImportBatch(
        source.importerId,
        result.batchId
      )
      setResult(rollbackResult)
    } finally {
      setIsRollingBack(false)
    }
  }, [result?.batchId, source?.importerId])

  const selectedSourceId = (source?.id ?? null) as DataSourceId | null
  const isScreenshotSource = source?.id === "blood-screenshots"
  const isManualSource = Boolean(source?.manualEntry)

  return (
    <div className="mx-auto w-full max-w-[960px] px-6 py-10 lg:px-10 lg:py-12">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transitions.fadeUp}
      >
        <p className="text-[13px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Data Sources
        </p>
        <h1 className="mt-4 font-sans text-[2.25rem] font-semibold tracking-[-0.02em] text-foreground lg:text-[2.5rem]">
          Bring your health data into Geoffit.
        </h1>
        <p className="mt-4 max-w-2xl text-[17px] leading-[1.75] text-foreground/80">
          Choose a source, then upload a compatible file. Nothing is saved until
          you confirm.
        </p>
      </motion.div>

      <div className="mt-10 space-y-8">
        {stage === "select-source" ? (
          <ImportSourcePicker
            selectedId={selectedSourceId}
            onSelect={handleSourceSelect}
          />
        ) : null}

        {(stage === "upload" || stage === "error") && source ? (
          <>
            {!source.available ||
            (!source.manualEntry && !getImportEndpoint(source.id)) ? (
              <div className="surface-functional space-y-4 p-8">
                <p className="text-[15px] font-medium text-foreground">
                  {source.label}
                </p>
                <p className="text-[14px] leading-relaxed text-muted-foreground">
                  {source.comingSoonNote ??
                    "This data source is not available yet."}
                </p>
                <button
                  type="button"
                  onClick={resetToSource}
                  className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                >
                  Choose another source
                </button>
              </div>
            ) : isManualSource ? (
              <ManualBloodEntryPanel
                onBack={resetToSource}
                onSubmit={handleManualRowsSubmit}
              />
            ) : (
              <>
                {source.id === "apple-health" ? (
                  <ImportProfilePanel
                    profile={profile}
                    onChange={setProfile}
                  />
                ) : null}
                <ImportDropzone
                  onFileSelected={handleFileSelected}
                  onFilesSelected={handleFilesSelected}
                  onBack={resetToSource}
                  acceptedExtensions={source.acceptedExtensions}
                  sourceLabel={source.label}
                  multiple={Boolean(source.allowMultiple)}
                  helperText={
                    isScreenshotSource
                      ? "Drop one or more screenshots. OCR runs on the server — nothing is saved until you confirm."
                      : "Your file is uploaded securely and parsed on the server."
                  }
                />
              </>
            )}

            {error ? (
              <div className="space-y-3">
                <p className="text-[14px] text-destructive">{error}</p>
                {errorDetails.length > 0 ? (
                  <pre className="surface-functional overflow-x-auto rounded-lg p-4 text-[12px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                    {errorDetails.join("\n\n")}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {stage === "progress" ? (
          <ImportProgressPanel
            progress={progress}
            onCancelImport={backToUpload}
            mode="simple"
          />
        ) : null}

        {stage === "preview" &&
        pipelinePreview &&
        source &&
        isScreenshotSource &&
        screenshotRows.length > 0 &&
        screenshotDiagnostics ? (
          <ScreenshotBloodReviewPanel
            fileName={pipelinePreview.preview.fileName}
            rows={screenshotRows}
            diagnostics={screenshotDiagnostics}
            warnings={pipelinePreview.warnings}
            onRowsChange={handleScreenshotRowsChange}
            onConfirm={handleConfirm}
            onCancel={backToUpload}
          />
        ) : null}

        {stage === "preview" &&
        pipelinePreview &&
        source &&
        !isScreenshotSource ? (
          <ImportPreviewPanel
            preview={pipelinePreview.preview}
            validation={pipelinePreview.validation}
            importerName={source.label}
            onConfirm={handleConfirm}
            onCancel={backToUpload}
            manualEntryRequired={manualEntryRequired}
            onApplyManualEntry={handleApplyManualEntry}
            onSkipManualEntry={handleSkipManualEntry}
          />
        ) : null}

        {stage === "importing" ? (
          <div className="surface-functional p-8 text-[15px] text-muted-foreground">
            Persisting import…
          </div>
        ) : null}

        {stage === "complete" && result ? (
          <>
            <ImportResultCard
              result={result}
              onRollback={handleRollback}
              isRollingBack={isRollingBack}
            />
            <button
              type="button"
              onClick={resetToSource}
              className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Import another file
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
