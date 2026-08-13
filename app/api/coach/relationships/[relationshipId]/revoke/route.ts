/**
 * Client or coach revokes an active coach_client_relationship.
 */

import { NextResponse } from "next/server"

import { revokeCoachRelationship } from "@/lib/coach/invitations"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ relationshipId: string }>
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { relationshipId } = await context.params
    if (!relationshipId || !/^[0-9a-f-]{36}$/i.test(relationshipId)) {
      return NextResponse.json(
        { error: "Invalid relationship." },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const result = await revokeCoachRelationship(supabase, relationshipId)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: result.status }
      )
    }

    return NextResponse.json(
      { relationshipId: result.data.relationshipId, status: "revoked" },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    )
  } catch (error) {
    console.error("[api/coach/relationships/revoke]", error)
    return NextResponse.json(
      { error: "Could not revoke relationship." },
      { status: 500 }
    )
  }
}
