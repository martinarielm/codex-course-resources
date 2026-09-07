import type { Metadata } from "next";
import AuthForm from "@/app/components/auth-form";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Register" };

export default async function RegisterPage() {
  if (await getSession()) redirect("/notes");
  return <AuthForm key="register" mode="register" />;
}
