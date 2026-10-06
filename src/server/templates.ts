import "server-only";
import type { ItineraryItemType } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { notFound } from "./errors";
import { assertAgent, assertSuperAdmin, type Actor } from "./auth/session";
import { nul, templateSchema, type TemplateInput } from "@/lib/schemas";

export async function listTemplatesAdmin(actor: Actor | null) {
  assertSuperAdmin(actor);
  return db.itineraryTemplate.findMany({
    where: { agencyId: null },
    orderBy: [{ destination: "asc" }, { nights: "asc" }, { name: "asc" }],
    include: { days: { select: { _count: { select: { items: true } } } } },
  });
}

export async function getTemplate(actor: Actor | null, id: string) {
  if (!actor) throw notFound("Template");
  const t = await db.itineraryTemplate.findUnique({
    where: { id },
    include: { days: { orderBy: { dayNumber: "asc" }, include: { items: { orderBy: { position: "asc" } } } } },
  });
  // Agents may read platform templates and their own; admins read platform ones.
  if (!t || (t.agencyId && (actor.kind !== "AGENT" || actor.agencyId !== t.agencyId))) throw notFound("Template");
  if (actor.kind === "AGENT" && t.status !== "ACTIVE") throw notFound("Template");
  return t;
}

function daysData(input: TemplateInput) {
  return input.days.map((d, i) => ({
    dayNumber: i + 1,
    title: nul(d.title),
    summary: nul(d.summary),
    items: {
      create: d.items.map((it, p) => ({
        position: p,
        time: nul(it.time),
        type: it.type as ItineraryItemType,
        title: it.title,
        description: nul(it.description),
        location: nul(it.location),
        durationMins: it.durationMins,
        notes: nul(it.notes),
      })),
    },
  }));
}

export async function saveTemplate(actor: Actor | null, id: string | null, raw: unknown) {
  assertSuperAdmin(actor);
  const input = templateSchema.parse(raw);
  const base = {
    name: input.name,
    description: nul(input.description),
    destination: input.destination,
    nights: input.nights,
    tags: [...new Set(input.tags)],
    status: input.status,
  };
  return db.$transaction(async (tx) => {
    if (id) {
      const existing = await tx.itineraryTemplate.findFirst({ where: { id, agencyId: null } });
      if (!existing) throw notFound("Template");
      await tx.templateDay.deleteMany({ where: { templateId: id } });
      await tx.itineraryTemplate.update({ where: { id }, data: { ...base, days: { create: daysData(input) } } });
      await audit(actor, { action: "template.updated", entity: "ItineraryTemplate", entityId: id, agencyId: null, summary: `Updated template ${input.name}` }, tx);
      return id;
    }
    const t = await tx.itineraryTemplate.create({ data: { ...base, createdById: actor.userId, days: { create: daysData(input) } } });
    await audit(actor, { action: "template.created", entity: "ItineraryTemplate", entityId: t.id, agencyId: null, summary: `Created template ${input.name}` }, tx);
    return t.id;
  });
}

export async function deleteTemplate(actor: Actor | null, id: string) {
  assertSuperAdmin(actor);
  const t = await db.itineraryTemplate.findFirst({ where: { id, agencyId: null } });
  if (!t) throw notFound("Template");
  await db.itineraryTemplate.delete({ where: { id } });
  await audit(actor, { action: "template.deleted", entity: "ItineraryTemplate", entityId: id, agencyId: null, summary: `Deleted template ${t.name}` });
}

export async function listTemplatesForAgent(actor: Actor | null) {
  assertAgent(actor);
  return db.itineraryTemplate.findMany({
    where: { status: "ACTIVE", OR: [{ agencyId: null }, { agencyId: actor.agencyId }] },
    orderBy: [{ destination: "asc" }, { nights: "asc" }],
    select: { id: true, name: true, description: true, destination: true, nights: true, tags: true, _count: { select: { days: true } } },
  });
}
