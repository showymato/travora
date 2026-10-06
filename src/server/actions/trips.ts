"use server";

import type { TripStatus } from "@prisma/client";
import { getActor } from "../auth/context";
import { runAction } from "../errors";
import * as core from "../trips/core";
import * as lines from "../trips/lines";
import * as itin from "../trips/itinerary";
import * as publish from "../trips/publish";
import * as payments from "../payments";
import * as docs from "../documents/service";
import { sendTripSchema } from "@/lib/schemas";

// Trip basics ------------------------------------------------------------------

export async function startTripAction(input: unknown) {
  return runAction(async () => (await core.startTrip(await getActor(), input)).id, "Draft saved.");
}
export async function updateTravelersAction(tripId: string, input: unknown) {
  return runAction(async () => core.updateTravelers(await getActor(), tripId, input));
}
export async function updateDatesAction(tripId: string, input: unknown) {
  return runAction(async () => core.updateDates(await getActor(), tripId, input));
}
export async function setDestinationsAction(tripId: string, input: unknown) {
  return runAction(async () => core.setDestinations(await getActor(), tripId, input));
}
export async function updateTripMetaAction(tripId: string, input: { title?: string | null; notes?: string | null; priceOverride?: number | null; wizardStep?: number }) {
  return runAction(async () => core.updateTripMeta(await getActor(), tripId, input));
}
export async function setTripStatusAction(tripId: string, status: TripStatus) {
  return runAction(async () => core.setTripStatus(await getActor(), tripId, status), "Status updated.");
}
export async function deleteDraftAction(tripId: string) {
  return runAction(async () => core.deleteDraft(await getActor(), tripId), "Draft deleted.");
}
export async function addTripNoteAction(tripId: string, body: string) {
  return runAction(async () => {
    await core.addTripNote(await getActor(), tripId, body);
  }, "Note added.");
}
export async function deleteTripNoteAction(noteId: string) {
  return runAction(async () => core.deleteTripNote(await getActor(), noteId), "Note deleted.");
}

// Hotels & rooms --------------------------------------------------------------

export async function addStayAction(tripId: string, input: unknown) {
  return runAction(async () => (await lines.addStay(await getActor(), tripId, input)).id, "Hotel added to trip.");
}
export async function updateStayAction(stayId: string, input: unknown) {
  return runAction(async () => lines.updateStay(await getActor(), stayId, input), "Stay updated.");
}
export async function removeStayAction(stayId: string) {
  return runAction(async () => lines.removeStay(await getActor(), stayId), "Hotel removed.");
}
export async function addStayRoomAction(stayId: string, input: unknown) {
  return runAction(async () => lines.addStayRoom(await getActor(), stayId, input), "Room added.");
}
export async function updateStayRoomAction(tripRoomId: string, input: unknown) {
  return runAction(async () => lines.updateStayRoom(await getActor(), tripRoomId, input), "Room updated.");
}
export async function removeStayRoomAction(tripRoomId: string) {
  return runAction(async () => lines.removeStayRoom(await getActor(), tripRoomId), "Room removed.");
}

// Transport & activities ------------------------------------------------------

export async function saveTransportAction(tripId: string, transportId: string | null, input: unknown) {
  return runAction(async () => {
    await lines.saveTransport(await getActor(), tripId, transportId, input);
  }, transportId ? "Transport updated." : "Transport added.");
}
export async function removeTransportAction(transportId: string) {
  return runAction(async () => lines.removeTransport(await getActor(), transportId), "Transport removed.");
}
export async function saveActivityAction(tripId: string, activityId: string | null, input: unknown) {
  return runAction(async () => {
    await lines.saveActivity(await getActor(), tripId, activityId, input);
  }, activityId ? "Activity updated." : "Activity added.");
}
export async function removeActivityAction(activityId: string) {
  return runAction(async () => lines.removeActivity(await getActor(), activityId), "Activity removed.");
}

// Itinerary -------------------------------------------------------------------

export async function generateItineraryAction(tripId: string, templateId: string | null) {
  return runAction(async () => itin.generateItinerary(await getActor(), tripId, { templateId }), templateId ? "Template applied." : "Itinerary generated.");
}
export async function createDaysAction(tripId: string) {
  return runAction(async () => itin.createDays(await getActor(), tripId));
}
export async function addItemAction(dayId: string, input: unknown) {
  return runAction(async () => {
    await itin.addItem(await getActor(), dayId, input);
  }, "Item added.");
}
export async function updateItemAction(itemId: string, input: unknown) {
  return runAction(async () => itin.updateItem(await getActor(), itemId, input), "Item saved.");
}
export async function deleteItemAction(itemId: string) {
  return runAction(async () => itin.deleteItem(await getActor(), itemId), "Item removed.");
}
export async function duplicateItemAction(itemId: string) {
  return runAction(async () => {
    await itin.duplicateItem(await getActor(), itemId);
  }, "Item duplicated.");
}
export async function reorderItemsAction(tripId: string, layout: Record<string, string[]>) {
  return runAction(async () => itin.reorderItems(await getActor(), tripId, layout));
}
export async function updateDayAction(dayId: string, input: { title: string; summary: string }) {
  return runAction(async () => itin.updateDay(await getActor(), dayId, input), "Day updated.");
}

// Publishing --------------------------------------------------------------------

export async function sendTripAction(tripId: string, input: unknown) {
  return runAction(async () => {
    const v = sendTripSchema.parse(input);
    return publish.sendTrip(await getActor(), tripId, { message: v.message, email: v.email });
  });
}
export async function publishUpdateAction(tripId: string, input: { summary: string; notify: boolean }) {
  return runAction(async () => publish.publishUpdate(await getActor(), tripId, { summary: String(input.summary ?? ""), notify: Boolean(input.notify) }));
}
export async function confirmTripAction(tripId: string, notify: boolean) {
  return runAction(async () => publish.confirmTrip(await getActor(), tripId, notify), "Trip confirmed.");
}
export async function setShareAction(tripId: string, enabled: boolean, rotate = false) {
  return runAction(async () => publish.setShareEnabled(await getActor(), tripId, enabled, rotate), rotate ? "New guest link created." : enabled ? "Guest page enabled." : "Guest page disabled.");
}

// Money & documents ---------------------------------------------------------------

export async function recordPaymentAction(tripId: string, input: unknown) {
  return runAction(async () => payments.recordPayment(await getActor(), tripId, input));
}
export async function voidPaymentAction(paymentId: string, reason: string) {
  return runAction(async () => payments.voidPayment(await getActor(), paymentId, reason), "Payment voided.");
}
export async function generateDocumentAction(tripId: string, kind: string, subjectId?: string | null) {
  return runAction(async () => {
    const d = await docs.generateDocument(await getActor(), tripId, kind, subjectId);
    return { id: d.id, title: d.title };
  });
}
export async function sendDocumentAction(docId: string) {
  return runAction(async () => docs.sendDocument(await getActor(), docId));
}
export async function deleteDocumentAction(docId: string) {
  return runAction(async () => docs.deleteDocument(await getActor(), docId), "Document deleted.");
}
export async function setDocumentVisibilityAction(docId: string, visible: boolean) {
  return runAction(async () => docs.setDocumentVisibility(await getActor(), docId, visible), visible ? "Shared with guest." : "Hidden from guest.");
}
