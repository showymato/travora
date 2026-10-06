import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/context";
import { PageHeader } from "@/components/app/page";
import { TemplateEditor } from "@/components/admin/template-editor";

export const metadata: Metadata = { title: "New template" };

export default async function NewTemplatePage() {
  await requireAdminPage();
  return (
    <>
      <PageHeader back={{ href: "/admin/templates", label: "Templates" }} title="New itinerary template" />
      <TemplateEditor
        initial={{
          name: "",
          description: "",
          destination: "Kashmir",
          nights: 4,
          tags: [],
          status: "ACTIVE",
          days: Array.from({ length: 5 }, () => ({ title: "", summary: "", items: [] })),
        }}
      />
    </>
  );
}
