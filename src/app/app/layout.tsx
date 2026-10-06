import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireAgentPage } from "@/server/auth/context";
import { AppShell } from "@/components/shell/app-shell";

export const metadata = { robots: { index: false, follow: false } };

export default async function AgentLayout({ children }: LayoutProps<"/app">) {
  const actor = await requireAgentPage();
  if (actor.mustChangePassword) redirect("/account/password");
  const collapsed = (await cookies()).get("tv_sidebar")?.value === "1";
  return (
    <AppShell role="agent" user={{ name: actor.name, email: actor.email, workspace: actor.agencyName }} initialCollapsed={collapsed}>
      {children}
    </AppShell>
  );
}
