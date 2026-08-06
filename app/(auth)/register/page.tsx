import Link from "next/link"

import { AuthShell } from "@/components/auth/auth-shell"
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
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  )
}
