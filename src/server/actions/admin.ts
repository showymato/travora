"use server";

import type { AgencyStatus } from "@prisma/client";
import { getActor } from "../auth/context";
import { runAction } from "../errors";
import * as agencies from "../agencies";
import * as hotels from "../hotels";
import * as tpl from "../templates";
import { renewSubscription } from "../subscriptions";

export async function createAgencyAction(input: unknown) {
  return runAction(async () => agencies.createAgency(await getActor(), input), "Agency created.");
}

export async function updateAgencyAction(agencyId: string, input: unknown) {
  return runAction(async () => agencies.updateAgency(await getActor(), agencyId, input), "Agency updated.");
}

export async function setAgencyStatusAction(agencyId: string, status: AgencyStatus) {
  return runAction(async () => agencies.setAgencyStatus(await getActor(), agencyId, status), status === "SUSPENDED" ? "Agency suspended. Its users were signed out." : "Agency activated.");
}

export async function resetAgencyAccessAction(agencyId: string) {
  return runAction(async () => agencies.resetAgencyAccess(await getActor(), agencyId));
}

export async function renewSubscriptionAction(agencyId: string, months: number) {
  return runAction(async () => renewSubscription(await getActor(), agencyId, months), "Subscription extended.");
}

export async function saveHotelAction(hotelId: string | null, input: unknown) {
  return runAction(async () => {
    const actor = await getActor();
    if (hotelId) {
      await hotels.updateHotel(actor, hotelId, input);
      return hotelId;
    }
    return (await hotels.createHotel(actor, input)).id;
  }, hotelId ? "Hotel saved." : "Hotel created.");
}

export async function uploadHotelImageAction(hotelId: string, form: FormData) {
  return runAction(async () => {
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("No file");
    return hotels.addHotelImage(await getActor(), hotelId, file);
  }, "Image added.");
}

export async function removeHotelImageAction(hotelId: string, key: string) {
  return runAction(async () => hotels.removeHotelImage(await getActor(), hotelId, key), "Image removed.");
}

export async function saveRoomAction(hotelId: string, roomId: string | null, input: unknown) {
  return runAction(async () => hotels.upsertRoom(await getActor(), hotelId, roomId, input), roomId ? "Room saved." : "Room added.");
}

export async function deleteRoomAction(hotelId: string, roomId: string) {
  return runAction(async () => hotels.deleteRoom(await getActor(), hotelId, roomId));
}

export async function setRoomRatesAction(input: unknown) {
  return runAction(async () => hotels.setRoomRates(await getActor(), input), "Agency rates saved.");
}

export async function setAssignmentsAction(agencyId: string, hotelIds: string[]) {
  return runAction(async () => hotels.setAssignments(await getActor(), agencyId, hotelIds));
}

export async function setHotelAgenciesAction(hotelId: string, agencyIds: string[]) {
  return runAction(async () => hotels.setHotelAgencies(await getActor(), hotelId, agencyIds), "Agency access updated.");
}

export async function saveTemplateAction(id: string | null, input: unknown) {
  return runAction(async () => tpl.saveTemplate(await getActor(), id, input), "Template saved.");
}

export async function deleteTemplateAction(id: string) {
  return runAction(async () => tpl.deleteTemplate(await getActor(), id), "Template deleted.");
}
