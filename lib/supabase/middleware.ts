import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import {
  DEFAULT_AUTH_REDIRECT,
  isAuthPublicPath,
} from "@/lib/auth/constants"

import { getSupabaseEnv } from "./env"

/**
 * Refresh the Auth session cookie and enforce route gates when Supabase is configured.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const { url, anonKey, isConfigured } = getSupabaseEnv()
  if (!isConfigured || !url || !anonKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })
        Object.entries(headers).forEach(([key, value]) => {
          supabaseResponse.headers.set(key, value)
        })
      },
    },
  })

  // Do not run logic between createServerClient and getUser — keeps the
  // session refresh path deterministic.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isPublic = isAuthPublicPath(pathname)

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.searchParams.set(
      "next",
      `${pathname}${request.nextUrl.search}`
    )
    const redirect = NextResponse.redirect(loginUrl)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value)
    })
    return redirect
  }

  if (user && isPublic && pathname !== "/auth/callback") {
    // Allow reset-password while authenticated (recovery session).
    if (pathname === "/reset-password") {
      return supabaseResponse
    }
    const dest = request.nextUrl.clone()
    dest.pathname = DEFAULT_AUTH_REDIRECT
    dest.search = ""
    const redirect = NextResponse.redirect(dest)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value)
    })
    return redirect
  }

  return supabaseResponse
}
