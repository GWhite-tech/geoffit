/**
 * Proof coach read: Mission Control for an authorised client.
 * Separate from /api/reads/* — never accepts arbitrary self userId override.
 */

import { NextResponse } from "next/server"

import { requireCoachClientRelationship } from "@/lib/coach/access"
import { permissionsIncludeAny } from "@/lib/coach/categories"
import {
  filterMissionControlForCoach,
  MISSION_CONTROL_COACH_CATEGORIES,
} from "@/lib/coach/mission-control-filter"
import { fetchMissionControlRead } from "@/lib/cloud/reads/mission-control-fetch"
import { isMcTimeRange } from "@/lib/cloud/reads/mission-control-query"
import type { McTimeRange } from "@/lib/health/analytics/types"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ clientId: string }>
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { clientId } = await context.params
    const supabase = await createClient()

    const access = await requireCoachClientRelationship(supabase, clientId)
    if (!access.ok) {
      return NextResponse.json(
        { error: access.message, code: access.code },
        { status: access.status }
      )
    }

    if (
      !permissionsIncludeAny(
        access.permissions,
        MISSION_CONTROL_COACH_CATEGORIES
      )
    ) {
      return NextResponse.json(
        { error: "Access denied.", code: "permission_denied" },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    if (url.searchParams.has("userId")) {
      return NextResponse.json(
        { error: "userId must not be supplied by the client." },
        { status: 400 }
      )
    }

    const rawRange = url.searchParams.get("bodyRange")
    const bodyRange: McTimeRange = isMcTimeRange(rawRange) ? rawRange : "90d"

    // Authorised subject only — never the coach's own user id.
    const raw = await fetchMissionControlRead(
      supabase,
      access.clientUserId,
      bodyRange
    )
    const body = filterMissionControlForCoach(raw, access.permissions)

    return NextResponse.json(
      {
        ...body,
        clientUserId: access.clientUserId,
        grantedPermissions: access.permissions,
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    )
  } catch (error) {
    console.error("[api/coach/clients/.../mission-control]", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Coach Mission Control read failed.",
      },
      { status: 500 }
    )
  }
}
