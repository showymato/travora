"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { TripNote } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fmtRelative } from "@/lib/dates";
import { useAction } from "@/lib/use-action";
import { addTripNoteAction, deleteTripNoteAction } from "@/server/actions/trips";

/** Internal team notes (never shown to the guest). */
export function NotesPanel({ tripId, notes }: { tripId: string; notes: TripNote[] }) {
  const [body, setBody] = useState("");
  const add = useAction((b: string) => addTripNoteAction(tripId, b), { onSuccess: () => setBody("") });
  const del = useAction(deleteTripNoteAction);
  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) add.run(body);
        }}
        className="space-y-2"
      >
        <label htmlFor="note" className="sr-only">
          New internal note
        </label>
        <Textarea id="note" value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={4000} placeholder="Internal note — e.g. guest asked for a vegetarian dinner on Day 2. Only your team sees this." />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!body.trim() || add.pending}>
            {add.pending ? "Saving…" : "Add note"}
          </Button>
        </div>
      </form>
      {notes.length ? (
        <ul className="mt-4 space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="group rounded-lg border bg-surface/50 px-3 py-2.5">
              <p className="text-[13.5px] whitespace-pre-line">{n.body}</p>
              <div className="mt-1.5 flex items-center justify-between text-[12px] text-muted-foreground">
                <span>
                  {n.authorName ?? "Team"} · {fmtRelative(n.createdAt)}
                </span>
                <Button variant="ghost" size="icon-xs" onClick={() => del.run(n.id)} aria-label="Delete note" className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100">
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
