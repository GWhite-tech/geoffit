"use client"

import { CheckCircle2, RotateCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ImportResult } from "@/lib/importers"

interface ImportResultCardProps {
  result: ImportResult
  onRollback?: () => void
  isRollingBack?: boolean
}

export function ImportResultCard({
  result,
  onRollback,
  isRollingBack = false,
}: ImportResultCardProps) {
  const isSuccess = result.status === "completed"
  const isRolledBack = result.status === "rolled_back"

  return (
    <div className="surface-functional p-8 lg:p-9">
      <div className="flex items-start gap-4">
        <div
          className={
            isSuccess
              ? "flex size-10 items-center justify-center rounded-full bg-success/10"
              : "flex size-10 items-center justify-center rounded-full bg-muted"
          }
        >
          <CheckCircle2
            className={isSuccess ? "size-5 text-success" : "size-5 text-muted-foreground"}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              {isSuccess ? "Import complete" : isRolledBack ? "Import rolled back" : "Import failed"}
            </h2>
            <Badge variant={isSuccess ? "default" : "secondary"}>{result.status}</Badge>
          </div>
          <p className="mt-2 text-[15px] text-muted-foreground">{result.message}</p>
          {result.recordCount ? (
            <p className="mt-1 text-[13px] text-muted-foreground">
              {result.recordCount} records · {result.fileName}
            </p>
          ) : null}
        </div>
      </div>

      {isSuccess && result.batchId && onRollback ? (
        <Button
          variant="outline"
          className="mt-6"
          onClick={onRollback}
          disabled={isRollingBack}
        >
          <RotateCcw className="size-4" />
          {isRollingBack ? "Rolling back…" : "Rollback import"}
        </Button>
      ) : null}
    </div>
  )
}
