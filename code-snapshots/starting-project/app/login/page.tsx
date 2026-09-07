import type { Metadata } from "next";
import AuthForm from "@/app/components/auth-form";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await getSession()) redirect("/notes");
  return <AuthForm key="login" mode="login" />;
}
