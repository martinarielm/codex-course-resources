import type { Metadata } from "next";
import AuthForm from "@/app/components/auth-form";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  return <AuthForm key="login" mode="login" />;
}
