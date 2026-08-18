import { Suspense } from "react"

import { AuthShell } from "@/components/auth/auth-shell"
import { AuthNextLink } from "@/components/auth/auth-next-link"
import { RegisterForm } from "@/components/auth/register-form"

export const metadata = {
  title: "Create account — Geoffit",
}

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up Geoffit with the preferences that fit how you live."
      footer={
        <>
          Already have an account?{" "}
          <Suspense fallback={<span className="text-primary">Sign in</span>}>
            <AuthNextLink href="/login" className="text-primary hover:underline">
              Sign in
            </AuthNextLink>
          </Suspense>
        </>
      }
    >
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  )
}
