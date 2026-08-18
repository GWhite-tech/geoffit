import { Suspense } from "react"

import { AuthShell } from "@/components/auth/auth-shell"
import { AuthNextLink } from "@/components/auth/auth-next-link"
import { LoginForm } from "@/components/auth/login-form"

export const metadata = {
  title: "Sign in — Geoffit",
}

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your Geoffit health OS."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Suspense fallback={<span className="text-primary">Create one</span>}>
            <AuthNextLink
              href="/register"
              className="text-primary hover:underline"
            >
              Create one
            </AuthNextLink>
          </Suspense>
        </>
      }
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
