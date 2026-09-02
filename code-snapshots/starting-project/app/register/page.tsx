import type { Metadata } from "next";
import AuthForm from "@/app/components/auth-form";

export const metadata: Metadata = { title: "Register" };

export default function RegisterPage() {
  return <AuthForm key="register" mode="register" />;
}
