import type { Metadata } from "next";
import { requireAdminPage } from "@/server/auth/context";
import { getTemplate } from "@/server/templates";
import { or404 } from "@/server/pages";
import { PageHeader } from "@/components/app/page";
import { TemplateEditor } from "@/components/admin/template-editor";
import type { ItemTypeValue } from "@/lib/labels";

export const metadata: Metadata = { title: "Template" };

export default async function TemplatePage({ params }: PageProps<"/admin/templates/[id]">) {
  const actor = await requireAdminPage();
  const { id } = await params;
  const t = await or404(getTemplate(actor, id));
  return (
    <>
      <PageHeader back={{ href: "/admin/templates", label: "Templates" }} title={t.name} />
      <TemplateEditor
        key={t.updatedAt.toISOString()}
        templateId={t.id}
        initial={{
          name: t.name,
          description: t.description ?? "",
          destination: t.destination,
          nights: t.nights,
          tags: t.tags,
          status: t.status,
          days: Array.from({ length: t.nights + 1 }, (_, i) => {
            const d = t.days.find((x) => x.dayNumber === i + 1);
            return {
              title: d?.title ?? "",
              summary: d?.summary ?? "",
              items: (d?.items ?? []).map((it) => ({
                time: it.time ?? "",
                type: it.type as ItemTypeValue,
                title: it.title,
                description: it.description ?? "",
                location: it.location ?? "",
                durationMins: it.durationMins,
                notes: it.notes ?? "",
              })),
            };
          }),
        }}
      />
    </>
  );
}
