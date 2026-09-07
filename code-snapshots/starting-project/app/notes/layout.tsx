import { requireSession } from "@/lib/session";

export default async function NotesLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return children;
}
