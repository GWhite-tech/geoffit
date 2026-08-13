/**
 * Authenticated coach accepts an invitation by raw token.
 * Server hashes the token; never accepts a client-supplied token_hash.
 * Email match + single-use enforced in accept_coach_invitation().
 */

import { NextResponse } from "next/server"

import {
  acceptCoachInvitation,
  parseAcceptInvitationToken,
} from "@/lib/coach/invitations"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = parseAcceptInvitationToken(body)
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.message, code: parsed.code },
        { status: parsed.status }
      )
    }

    const result = await acceptCoachInvitation(supabase, parsed.data.token)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: result.status }
      )
    }

    return NextResponse.json(
      {
        relationshipId: result.data.relationshipId,
        clientUserId: result.data.clientUserId,
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      }
    )
  } catch (error) {
    console.error("[api/coach/invitations/accept]", error)
    return NextResponse.json(
      { error: "Could not accept invitation." },
      { status: 500 }
    )
  }
}
