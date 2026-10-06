import "server-only";
import type { AgencyStatus, PlanCode, Prisma } from "@prisma/client";
import { db } from "./db";
import { audit, diff } from "./audit";
import { AppError, notFound } from "./errors";
import { assertAgent, assertSuperAdmin, type Actor } from "./auth/session";
import { hashPassword } from "./auth/crypto";
import { generateTempPassword, setTemporaryPassword } from "./auth/service";
import { appUrl, sendEmail } from "./email";
import { templates } from "./email/templates";
import { notifyAdmins } from "./notifications";
import { agencyCreateSchema, agencySettingsSchema, agencyUpdateSchema, nul } from "@/lib/schemas";

const PAGE_SIZE = 12;

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "agency"
  );
}

async function uniqueSlug(base: string, tx: Prisma.TransactionClient | typeof db = db) {
  const root = slugify(base);
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    if (!(await tx.agency.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export type AgencyListQuery = {
  q?: string;
  status?: AgencyStatus | "";
  plan?: PlanCode | "";
  sort?: "created" | "name" | "trips";
  dir?: "asc" | "desc";
  page?: number;
};

export async function listAgencies(actor: Actor | null, query: AgencyListQuery) {
  assertSuperAdmin(actor);
  const page = Math.max(1, query.page ?? 1);
  const q = query.q?.trim();
  const where: Prisma.AgencyWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.plan ? { subscription: { plan: { code: query.plan } } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { ownerName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { city: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const dir = query.dir ?? (query.sort === "name" ? "asc" : "desc");
  const orderBy: Prisma.AgencyOrderByWithRelationInput =
    query.sort === "name" ? { name: dir } : query.sort === "trips" ? { trips: { _count: dir } } : { createdAt: dir };

  const [total, rows] = await Promise.all([
    db.agency.count({ where }),
    db.agency.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        subscription: { include: { plan: { select: { code: true, name: true } } } },
        _count: { select: { trips: true, guests: true } },
      },
    }),
  ]);
  return { rows, total, page, pageSize: PAGE_SIZE, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function createAgency(actor: Actor | null, raw: unknown) {
  assertSuperAdmin(actor);
  const input = agencyCreateSchema.parse(raw);
  const loginEmail = input.loginEmail.toLowerCase();
  if (await db.user.findUnique({ where: { email: loginEmail }, select: { id: true } })) {
    throw new AppError("CONFLICT", "A user with that login email already exists.", { fieldErrors: { loginEmail: "Already in use." } });
  }
  const plan = await db.subscriptionPlan.findUnique({ where: { code: input.plan } });
  if (!plan) throw new AppError("VALIDATION_ERROR", "That plan is not available.");
  const passwordHash = await hashPassword(input.tempPassword);
  const now = new Date();

  // 1–5 + 7: agency, user, role, subscription, workspace and audit commit together.
  const { agency, user } = await db.$transaction(async (tx) => {
    const agency = await tx.agency.create({
      data: {
        name: input.name,
        slug: await uniqueSlug(input.name, tx),
        ownerName: input.ownerName,
        email: input.email.toLowerCase(),
        phone: input.phone,
        city: nul(input.city),
        state: nul(input.state),
        country: nul(input.country) ?? "India",
        address: nul(input.address),
        gstNumber: nul(input.gstNumber),
        status: input.status,
        supportEmail: input.email.toLowerCase(),
        supportPhone: input.phone,
      },
    });
    const user = await tx.user.create({
      data: {
        email: loginEmail,
        name: input.ownerName,
        phone: input.phone,
        role: "AGENT",
        agencyId: agency.id,
        passwordHash,
        mustChangePassword: true,
      },
    });
    const trial = input.status === "TRIAL";
    const periodEnd = new Date(now.getTime() + (trial ? 14 : 30) * 86_400_000);
    await tx.subscription.create({
      data: {
        agencyId: agency.id,
        planId: plan.id,
        status: trial ? "TRIALING" : input.status === "SUSPENDED" ? "PAST_DUE" : "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        trialEndsAt: trial ? periodEnd : null,
      },
    });
    await audit(
      actor,
      {
        action: "agency.created",
        entity: "Agency",
        entityId: agency.id,
        agencyId: agency.id,
        summary: `Created agency ${agency.name} on the ${plan.name} plan`,
        after: { name: agency.name, plan: plan.code, status: agency.status, owner: user.email },
      },
      tx,
    );
    return { agency, user };
  });

  // 6: welcome email (outside the transaction — a mail outage must not undo the agency).
  const email = await sendEmail(
    "welcomeAgent",
    user.email,
    templates.welcomeAgent({ name: user.name, agencyName: agency.name, email: user.email, tempPassword: input.tempPassword, loginUrl: appUrl("/login") }),
    { agencyId: agency.id },
  );
  await notifyAdmins({ type: "agency.created", title: `New agency: ${agency.name}`, body: `${user.name} · ${plan.name} plan`, href: `/admin/agents/${agency.id}` });
  return { agencyId: agency.id, emailStatus: email.status };
}

export async function getAgencyDetail(actor: Actor | null, agencyId: string) {
  assertSuperAdmin(actor);
  const agency = await db.agency.findUnique({
    where: { id: agencyId },
    include: {
      subscription: { include: { plan: true } },
      users: { select: { id: true, name: true, email: true, phone: true, lastLoginAt: true, disabledAt: true, mustChangePassword: true, createdAt: true } },
      _count: { select: { trips: true, guests: true, hotels: true } },
    },
  });
  if (!agency) throw notFound("Agency");
  return agency;
}

export async function updateAgency(actor: Actor | null, agencyId: string, raw: unknown) {
  assertSuperAdmin(actor);
  const input = agencyUpdateSchema.parse(raw);
  const before = await db.agency.findUnique({ where: { id: agencyId }, include: { subscription: { include: { plan: true } } } });
  if (!before) throw notFound("Agency");
  const data = {
    name: input.name,
    ownerName: input.ownerName,
    email: input.email.toLowerCase(),
    phone: input.phone,
    city: nul(input.city),
    state: nul(input.state),
    country: nul(input.country),
    address: nul(input.address),
    gstNumber: nul(input.gstNumber),
  };
  const d = diff(before as unknown as Record<string, unknown>, data);
  await db.$transaction(async (tx) => {
    await tx.agency.update({ where: { id: agencyId }, data });
    if (before.subscription?.plan.code !== input.plan) {
      const plan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { code: input.plan } });
      await tx.subscription.update({ where: { agencyId }, data: { planId: plan.id } });
      await audit(actor, { action: "subscription.plan_changed", entity: "Agency", entityId: agencyId, agencyId, summary: `Plan changed to ${plan.name}`, before: { plan: before.subscription?.plan.code ?? null }, after: { plan: plan.code } }, tx);
    }
    if (d.changed) await audit(actor, { action: "agency.updated", entity: "Agency", entityId: agencyId, agencyId, summary: `Updated ${input.name}`, before: d.before, after: d.after }, tx);
  });
}

export async function setAgencyStatus(actor: Actor | null, agencyId: string, status: AgencyStatus) {
  assertSuperAdmin(actor);
  const before = await db.agency.findUnique({ where: { id: agencyId }, select: { status: true, name: true } });
  if (!before) throw notFound("Agency");
  if (before.status === status) return;
  await db.$transaction(async (tx) => {
    await tx.agency.update({ where: { id: agencyId }, data: { status } });
    await tx.subscription.updateMany({
      where: { agencyId },
      data: { status: status === "SUSPENDED" ? "PAST_DUE" : status === "TRIAL" ? "TRIALING" : "ACTIVE" },
    });
    // Suspending signs everyone in the agency out immediately.
    if (status === "SUSPENDED") await tx.session.deleteMany({ where: { user: { agencyId } } });
    await audit(actor, { action: "agency.status_changed", entity: "Agency", entityId: agencyId, agencyId, summary: `${before.name}: ${before.status} → ${status}`, before: { status: before.status }, after: { status } }, tx);
  });
}

/** Issue a new temporary password for the agency owner and sign them out everywhere. */
export async function resetAgencyAccess(actor: Actor | null, agencyId: string) {
  assertSuperAdmin(actor);
  const user = await db.user.findFirst({ where: { agencyId, role: "AGENT" }, orderBy: { createdAt: "asc" } });
  if (!user) throw notFound("Agency user");
  const tempPassword = generateTempPassword();
  await setTemporaryPassword(user.id, tempPassword);
  await audit(actor, { action: "agency.access_reset", entity: "User", entityId: user.id, agencyId, summary: `Reset access for ${user.email}` });
  const email = await sendEmail("accessReset", user.email, templates.accessReset({ name: user.name, email: user.email, tempPassword, loginUrl: appUrl("/login") }), { agencyId });
  return { email: user.email, tempPassword, emailStatus: email.status };
}

export async function agencyActivity(actor: Actor | null, agencyId: string, take = 40) {
  assertSuperAdmin(actor);
  return db.auditLog.findMany({ where: { agencyId }, orderBy: { createdAt: "desc" }, take });
}

// ---- Agent-side workspace settings ------------------------------------------

export async function getOwnAgency(actor: Actor | null) {
  assertAgent(actor);
  return db.agency.findUniqueOrThrow({
    where: { id: actor.agencyId },
    include: { subscription: { include: { plan: true } }, _count: { select: { users: true, trips: true } } },
  });
}

export async function updateOwnAgency(actor: Actor | null, raw: unknown) {
  assertAgent(actor);
  const input = agencySettingsSchema.parse(raw);
  const before = await db.agency.findUniqueOrThrow({ where: { id: actor.agencyId } });
  const data = { name: input.name, supportEmail: nul(input.supportEmail), supportPhone: nul(input.supportPhone), address: nul(input.address), gstNumber: nul(input.gstNumber) };
  const d = diff(before as unknown as Record<string, unknown>, data);
  await db.agency.update({ where: { id: actor.agencyId }, data });
  if (d.changed) await audit(actor, { action: "agency.settings_updated", entity: "Agency", entityId: actor.agencyId, summary: "Updated workspace settings", before: d.before, after: d.after });
}

export async function listPlans() {
  return db.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function agencyMetrics(actor: Actor | null, agencyId: string) {
  assertSuperAdmin(actor);
  const today = new Date(new Date().toISOString().slice(0, 10));
  const [trips, guests, value, active] = await Promise.all([
    db.trip.count({ where: { agencyId } }),
    db.guest.count({ where: { agencyId } }),
    db.trip.aggregate({ where: { agencyId, status: { notIn: ["DRAFT", "CANCELLED"] } }, _sum: { totalAmount: true } }),
    db.trip.count({ where: { agencyId, status: { in: ["SENT", "CONFIRMED", "ONGOING", "READY", "PLANNING"] }, endDate: { gte: today } } }),
  ]);
  return { trips, guests, tripValue: value._sum.totalAmount ?? 0, active };
}

export async function agencyGuests(actor: Actor | null, agencyId: string, take = 50) {
  assertSuperAdmin(actor);
  return db.guest.findMany({
    where: { agencyId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, fullName: true, phone: true, email: true, createdAt: true, _count: { select: { trips: true } } },
  });
}

export async function agencyHotels(actor: Actor | null, agencyId: string) {
  assertSuperAdmin(actor);
  return db.agentHotel.findMany({
    where: { agencyId },
    orderBy: { hotel: { name: "asc" } },
    include: { hotel: { select: { id: true, name: true, category: true, location: true, rooms: { select: { id: true, name: true, baseRate: true, rates: { where: { agencyId }, select: { rate: true } } } } } } },
  });
}
