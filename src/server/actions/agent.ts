"use server";

import { getActor } from "../auth/context";
import { runAction } from "../errors";
import * as guests from "../guests";
import * as agencies from "../agencies";
import { listNotifications, markNotificationsRead } from "../notifications";

export async function listNotificationsAction() {
  return runAction(async () => {
    const actor = await getActor();
    if (!actor) return { items: [], unread: 0 };
    const { items, unread } = await listNotifications(actor, 30);
    return { items: items.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, type: n.type, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() })), unread };
  });
}
import { globalSearch } from "../ops";

export async function createGuestAction(input: unknown) {
  return runAction(async () => {
    const g = await guests.createGuest(await getActor(), input);
    return { id: g.id, fullName: g.fullName, phone: g.phone, email: g.email };
  }, "Guest added.");
}

export async function updateGuestAction(guestId: string, input: unknown) {
  return runAction(async () => guests.updateGuest(await getActor(), guestId, input), "Guest saved.");
}

export async function deleteGuestAction(guestId: string) {
  return runAction(async () => guests.deleteGuest(await getActor(), guestId), "Guest deleted.");
}

export async function searchGuestsAction(q: string) {
  return runAction(async () => guests.searchGuests(await getActor(), q));
}

export async function uploadGuestDocumentAction(guestId: string, form: FormData) {
  return runAction(async () => {
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("No file");
    const doc = await guests.uploadGuestDocument(await getActor(), guestId, file, String(form.get("kind") ?? "OTHER"), String(form.get("label") ?? ""));
    return doc.id;
  }, "Document uploaded.");
}

export async function deleteGuestDocumentAction(docId: string) {
  return runAction(async () => guests.deleteGuestDocument(await getActor(), docId), "Document deleted.");
}

export async function updateAgencySettingsAction(input: unknown) {
  return runAction(async () => agencies.updateOwnAgency(await getActor(), input), "Workspace settings saved.");
}

export async function markNotificationsReadAction(ids?: string[]) {
  return runAction(async () => {
    const actor = await getActor();
    if (actor) await markNotificationsRead(actor, ids);
  });
}

export async function searchAction(q: string) {
  return runAction(async () => globalSearch(await getActor(), q));
}
