"use client"

import { useCallback, useState } from "react"
import { ArrowLeft, FileUp, Upload } from "lucide-react"

import { cn } from "@/lib/utils"

interface ImportDropzoneProps {
  onFileSelected: (file: File) => void
  onFilesSelected?: (files: File[]) => void
  onBack?: () => void
  disabled?: boolean
  acceptedExtensions: string[]
  sourceLabel: string
  helperText?: string
  multiple?: boolean
}

export function ImportDropzone({
  onFileSelected,
  onFilesSelected,
  onBack,
  disabled = false,
  acceptedExtensions,
  sourceLabel,
  helperText,
  multiple = false,
}: ImportDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length || disabled) return
      const list = Array.from(files)
      if (multiple && onFilesSelected) {
        onFilesSelected(list)
        return
      }
      onFileSelected(list[0]!)
    },
    [disabled, multiple, onFileSelected, onFilesSelected]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            Step 2 · Upload {multiple ? "files" : "file"}
          </p>
          <p className="mt-2 text-[15px] text-foreground/80">
            {sourceLabel} accepts {acceptedExtensions.join(", ")}
            {multiple ? " — drop one or more screenshots." : "."}
          </p>
        </div>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Change source
          </button>
        ) : null}
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          handleFiles(event.dataTransfer.files)
        }}
        className={cn(
          "surface-functional flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed px-8 py-12 text-center transition-colors",
          isDragging
            ? "border-primary/50 bg-primary/[0.04]"
            : "border-border/60 bg-card/40",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
          <Upload className="size-5 text-primary" />
        </div>
        <p className="mt-5 text-[15px] font-medium text-foreground">
          Drop your {sourceLabel.toLowerCase()}{" "}
          {multiple ? "files" : "file"}
        </p>
        <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          {helperText ?? `Supported formats: ${acceptedExtensions.join(", ")}`}
        </p>
        <label className="mt-6">
          <input
            type="file"
            className="sr-only"
            disabled={disabled}
            multiple={multiple}
            accept={acceptedExtensions.join(",")}
            onChange={(event) => {
              handleFiles(event.target.files)
              event.target.value = ""
            }}
          />
          <span className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover">
            <FileUp className="size-4" />
            {multiple ? "Choose files" : "Choose file"}
          </span>
        </label>
      </div>
    </div>
  )
}
