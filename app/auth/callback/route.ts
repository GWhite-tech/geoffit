import { NextResponse, type NextRequest } from "next/server"

import { DEFAULT_AUTH_REDIRECT } from "@/lib/auth/constants"
import { createClient } from "@/lib/supabase/server"

/**
 * OAuth / magic-link / password-recovery code exchange.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get("code")
  const nextParam = searchParams.get("next")
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : DEFAULT_AUTH_REDIRECT

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    }
  }

  return NextResponse.redirect(
    new URL(`/login?error=auth_callback&next=${encodeURIComponent(next)}`, origin)
  )
}
