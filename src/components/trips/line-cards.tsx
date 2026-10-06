"use client";

import { Car, Pencil, Phone, Trash2 } from "lucide-react";
import type { TripActivity, TripTransport } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Pill } from "@/components/app/badges";
import { fmtDow, fmtDuration, fmtTime, toISO } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { ACTIVITY_KIND_LABEL, TRANSPORT_KIND_LABEL, type ActivityKindValue, type TransportKindValue } from "@/lib/labels";
import { useAction } from "@/lib/use-action";
import { removeActivityAction, removeTransportAction } from "@/server/actions/trips";
import { ActivityDialog, TransportDialog } from "./line-forms";
import { ItemIcon } from "./item-icon";

type Range = { min: string; max: string };

function RowMenu({ onEdit, onDelete, label }: { onEdit: React.ReactNode; onDelete: () => Promise<unknown>; label: string }) {
  return (
    <div className="flex items-center gap-1">
      {onEdit}
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${label}`}>
            <Trash2 className="size-4" />
          </Button>
        }
        title={`Remove ${label}?`}
        description="It will also be removed from the itinerary."
        confirmLabel="Remove"
        destructive
        onConfirm={onDelete}
      />
    </div>
  );
}

export function TransportCard({ t, tripId, range, editable = true }: { t: TripTransport; tripId: string; range: Range; editable?: boolean }) {
  const remove = useAction(removeTransportAction);
  const missing = !t.driverName || !t.driverPhone || !t.vehicleNumber;
  return (
    <li className="flex gap-3 rounded-xl border bg-card p-4">
      <ItemIcon type="TRANSPORT" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="font-medium">
            {t.pickup} → {t.dropoff}
          </p>
          <span className="text-[12.5px] text-muted-foreground">{TRANSPORT_KIND_LABEL[t.kind as TransportKindValue]}</span>
          {missing ? <Pill tone="warn">Driver details missing</Pill> : null}
        </div>
        <p className="mt-0.5 text-[13px] text-muted-foreground tabular">
          {fmtDow(t.date)}
          {t.time ? ` · ${fmtTime(t.time)}` : " · time not set"}
          {t.price ? ` · ${formatINR(t.price)}` : ""}
        </p>
        {(t.vehicle || t.vehicleNumber || t.driverName) && (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            {t.vehicle || t.vehicleNumber ? (
              <span className="inline-flex items-center gap-1.5">
                <Car className="size-3.5 text-muted-foreground" aria-hidden />
                {[t.vehicle, t.vehicleNumber].filter(Boolean).join(" · ")}
              </span>
            ) : null}
            {t.driverName ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5 text-muted-foreground" aria-hidden />
                {t.driverName}
                {t.driverPhone ? (
                  <a href={`tel:${t.driverPhone.replace(/\s/g, "")}`} className="text-primary underline-offset-2 hover:underline">
                    {t.driverPhone}
                  </a>
                ) : null}
              </span>
            ) : null}
          </p>
        )}
        {t.notes ? <p className="mt-1 text-[12.5px] text-muted-foreground">{t.notes}</p> : null}
      </div>
      {editable ? (
        <RowMenu
          label="transport"
          onDelete={() => remove.run(t.id)}
          onEdit={
            <TransportDialog
              tripId={tripId}
              transportId={t.id}
              range={range}
              initial={{
                kind: t.kind,
                date: toISO(t.date)!,
                time: t.time ?? "",
                pickup: t.pickup,
                dropoff: t.dropoff,
                vehicle: t.vehicle ?? "",
                driverName: t.driverName ?? "",
                driverPhone: t.driverPhone ?? "",
                vehicleNumber: t.vehicleNumber ?? "",
                notes: t.notes ?? "",
                price: t.price,
                addToItinerary: t.addToItinerary,
              }}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label="Edit transport">
                  <Pencil className="size-4" />
                </Button>
              }
            />
          }
        />
      ) : null}
    </li>
  );
}

export function ActivityCard({ a, tripId, range, editable = true }: { a: TripActivity; tripId: string; range: Range; editable?: boolean }) {
  const remove = useAction(removeActivityAction);
  return (
    <li className="flex gap-3 rounded-xl border bg-card p-4">
      <ItemIcon type={a.kind} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2">
          <p className="font-medium">{a.title}</p>
          <span className="text-[12.5px] text-muted-foreground">{ACTIVITY_KIND_LABEL[a.kind as ActivityKindValue]}</span>
        </div>
        <p className="mt-0.5 text-[13px] text-muted-foreground tabular">
          {[fmtDow(a.date), a.time ? fmtTime(a.time) : null, a.location, fmtDuration(a.durationMins), a.price ? formatINR(a.price) : null].filter(Boolean).join(" · ")}
        </p>
        {a.description ? <p className="mt-1 text-[13px]">{a.description}</p> : null}
      </div>
      {editable ? (
        <RowMenu
          label="activity"
          onDelete={() => remove.run(a.id)}
          onEdit={
            <ActivityDialog
              tripId={tripId}
              activityId={a.id}
              range={range}
              initial={{
                kind: a.kind,
                date: toISO(a.date)!,
                time: a.time ?? "",
                title: a.title,
                location: a.location ?? "",
                description: a.description ?? "",
                durationMins: a.durationMins,
                notes: a.notes ?? "",
                price: a.price,
                addToItinerary: a.addToItinerary,
              }}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label="Edit activity">
                  <Pencil className="size-4" />
                </Button>
              }
            />
          }
        />
      ) : null}
    </li>
  );
}

