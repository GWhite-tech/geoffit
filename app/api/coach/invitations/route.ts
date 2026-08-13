/**
 * Client creates a coach invitation (no email delivery in Phase 1).
 * Returns the raw token once; only token_hash is persisted.
 */

import { NextResponse } from "next/server"

import { createCoachInvitation } from "@/lib/coach/invitations"
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

    const coachEmail =
      typeof body === "object" &&
      body !== null &&
      "coachEmail" in body &&
      typeof (body as { coachEmail: unknown }).coachEmail === "string"
        ? (body as { coachEmail: string }).coachEmail
        : ""

    const permissions =
      typeof body === "object" &&
      body !== null &&
      "permissions" in body &&
      Array.isArray((body as { permissions: unknown }).permissions)
        ? ((body as { permissions: unknown[] }).permissions as string[])
        : []

    const result = await createCoachInvitation(supabase, {
      coachEmail,
      permissions,
    })

    if (!result.ok) {
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: result.status }
      )
    }

    return NextResponse.json(
      {
        invitationId: result.data.invitationId,
        token: result.data.token,
        coachEmail: result.data.coachEmail,
        permissions: result.data.permissions,
        expiresAt: result.data.expiresAt,
        status: result.data.status,
      },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      }
    )
  } catch (error) {
    console.error("[api/coach/invitations]", error)
    return NextResponse.json(
      { error: "Could not create invitation." },
      { status: 500 }
    )
  }
}
