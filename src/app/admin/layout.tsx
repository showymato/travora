import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAdminPage } from "@/server/auth/context";
import { AppShell } from "@/components/shell/app-shell";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const actor = await requireAdminPage();
  if (actor.mustChangePassword) redirect("/account/password");
  const collapsed = (await cookies()).get("tv_sidebar")?.value === "1";
  return (
    <AppShell role="admin" user={{ name: actor.name, email: actor.email, workspace: "TRAVORA Admin" }} initialCollapsed={collapsed}>
      {children}
    </AppShell>
  );
}
