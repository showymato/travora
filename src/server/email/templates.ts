// Transactional email templates. Each returns subject + HTML + plain text.
// HTML is table-free but inline-styled so it renders in common mail clients.
// Every interpolated value goes through esc().

export type Rendered = { subject: string; html: string; text: string };

export function esc(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type Brand = { agencyName: string; supportEmail?: string | null; supportPhone?: string | null };

function layout(brand: Brand, title: string, bodyHtml: string, cta?: { label: string; url: string }) {
  const button = cta
    ? `<p style="margin:28px 0 8px"><a href="${esc(cta.url)}" style="display:inline-block;background:#1f2a5c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px">${esc(cta.label)}</a></p>
       <p style="margin:0;color:#6b7280;font-size:12px">Or open: <a href="${esc(cta.url)}" style="color:#1f2a5c">${esc(cta.url)}</a></p>`
    : "";
  const contact = [brand.supportEmail, brand.supportPhone].filter(Boolean).map(esc).join(" · ");
  return `<!doctype html><html><body style="margin:0;background:#f5f6f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827">
<div style="max-width:560px;margin:0 auto;padding:32px 16px">
  <div style="font-size:13px;font-weight:600;letter-spacing:.08em;color:#1f2a5c;text-transform:uppercase">${esc(brand.agencyName)}</div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;margin-top:12px">
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${esc(title)}</h1>
    <div style="font-size:15px;line-height:1.6;color:#374151">${bodyHtml}</div>
    ${button}
  </div>
  <p style="color:#9ca3af;font-size:12px;margin:16px 4px">${contact ? `${contact}<br>` : ""}Sent with TRAVORA on behalf of ${esc(brand.agencyName)}.</p>
</div></body></html>`;
}

function text(lines: (string | false | null | undefined)[]) {
  return lines.filter(Boolean).join("\n");
}

const TRAVORA: Brand = { agencyName: "TRAVORA" };

export const templates = {
  welcomeAgent(d: { name: string; agencyName: string; email: string; tempPassword: string; loginUrl: string }): Rendered {
    return {
      subject: `Your TRAVORA workspace for ${d.agencyName} is ready`,
      html: layout(
        TRAVORA,
        `Welcome to TRAVORA, ${d.name}`,
        `<p>Your agency workspace <strong>${esc(d.agencyName)}</strong> has been created.</p>
         <p>Sign in with <strong>${esc(d.email)}</strong> and this temporary password:</p>
         <p style="font-family:ui-monospace,Menlo,monospace;font-size:16px;background:#f3f4f6;padding:10px 14px;border-radius:8px">${esc(d.tempPassword)}</p>
         <p>You'll be asked to choose your own password after signing in.</p>`,
        { label: "Sign in to TRAVORA", url: d.loginUrl },
      ),
      text: text([`Welcome to TRAVORA, ${d.name}`, `Workspace: ${d.agencyName}`, `Email: ${d.email}`, `Temporary password: ${d.tempPassword}`, `Sign in: ${d.loginUrl}`]),
    };
  },

  accessReset(d: { name: string; email: string; tempPassword: string; loginUrl: string }): Rendered {
    return {
      subject: "Your TRAVORA access has been reset",
      html: layout(
        TRAVORA,
        "Your access was reset",
        `<p>Hi ${esc(d.name)}, an administrator reset your TRAVORA password. All existing sessions were signed out.</p>
         <p>Temporary password:</p>
         <p style="font-family:ui-monospace,Menlo,monospace;font-size:16px;background:#f3f4f6;padding:10px 14px;border-radius:8px">${esc(d.tempPassword)}</p>`,
        { label: "Sign in", url: d.loginUrl },
      ),
      text: text([`Your TRAVORA access was reset.`, `Email: ${d.email}`, `Temporary password: ${d.tempPassword}`, d.loginUrl]),
    };
  },

  tripCreated(d: Brand & { agentName: string; tripCode: string; guestName: string; dates: string; url: string }): Rendered {
    return {
      subject: `Trip ${d.tripCode} created for ${d.guestName}`,
      html: layout(d, `Trip ${d.tripCode} created`, `<p>${esc(d.agentName)} created a trip for <strong>${esc(d.guestName)}</strong> (${esc(d.dates)}).</p>`, {
        label: "Open trip",
        url: d.url,
      }),
      text: text([`Trip ${d.tripCode} created for ${d.guestName} (${d.dates}).`, d.url]),
    };
  },

  itinerarySent(d: Brand & { guestName: string; tripTitle: string; dates: string; url: string; agentName: string; message?: string | null }): Rendered {
    return {
      subject: `Your itinerary: ${d.tripTitle}`,
      html: layout(
        d,
        `Your trip is ready, ${d.guestName.split(" ")[0]}`,
        `<p>${esc(d.agentName)} from ${esc(d.agencyName)} has prepared your itinerary for <strong>${esc(d.tripTitle)}</strong>, ${esc(d.dates)}.</p>
         ${d.message ? `<p style="border-left:3px solid #1f2a5c;padding-left:12px;color:#4b5563">${esc(d.message)}</p>` : ""}
         <p>Your personal trip page has the day-by-day plan, hotels, transfers and documents. It always shows the latest version.</p>`,
        { label: "View your trip", url: d.url },
      ),
      text: text([`Your itinerary for ${d.tripTitle} (${d.dates}) is ready.`, d.message, `View it: ${d.url}`]),
    };
  },

  itineraryUpdated(d: Brand & { guestName: string; tripTitle: string; url: string; summary: string }): Rendered {
    return {
      subject: `Your itinerary has been updated — ${d.tripTitle}`,
      html: layout(
        d,
        "Your itinerary has been updated",
        `<p>Hi ${esc(d.guestName.split(" ")[0])}, ${esc(d.agencyName)} has updated your trip.</p><p style="color:#4b5563">${esc(d.summary)}</p>`,
        { label: "See the latest itinerary", url: d.url },
      ),
      text: text([`Your itinerary for ${d.tripTitle} has been updated.`, d.summary, d.url]),
    };
  },

  tripConfirmed(d: Brand & { guestName: string; tripTitle: string; dates: string; url: string }): Rendered {
    return {
      subject: `Confirmed: ${d.tripTitle}`,
      html: layout(d, "Your trip is confirmed", `<p>Hi ${esc(d.guestName.split(" ")[0])}, your trip <strong>${esc(d.tripTitle)}</strong> (${esc(d.dates)}) is confirmed.</p>`, {
        label: "View trip",
        url: d.url,
      }),
      text: text([`Your trip ${d.tripTitle} (${d.dates}) is confirmed.`, d.url]),
    };
  },

  tripReminder(d: Brand & { guestName: string; tripTitle: string; startsOn: string; url: string; firstItem?: string | null }): Rendered {
    return {
      subject: `See you soon — ${d.tripTitle} starts ${d.startsOn}`,
      html: layout(
        d,
        "Your trip starts soon",
        `<p>Hi ${esc(d.guestName.split(" ")[0])}, your trip starts on <strong>${esc(d.startsOn)}</strong>.</p>${d.firstItem ? `<p>First up: ${esc(d.firstItem)}</p>` : ""}`,
        { label: "Open your itinerary", url: d.url },
      ),
      text: text([`Your trip ${d.tripTitle} starts on ${d.startsOn}.`, d.firstItem, d.url]),
    };
  },

  documentAvailable(d: Brand & { guestName: string; documentTitle: string; url: string }): Rendered {
    return {
      subject: `New document: ${d.documentTitle}`,
      html: layout(d, "A new travel document is available", `<p>Hi ${esc(d.guestName.split(" ")[0])}, <strong>${esc(d.documentTitle)}</strong> is ready on your trip page.</p>`, {
        label: "View documents",
        url: d.url,
      }),
      text: text([`${d.documentTitle} is available.`, d.url]),
    };
  },

  paymentRecorded(d: Brand & { guestName: string; amount: string; tripTitle: string; paid: string; pending: string; url?: string | null }): Rendered {
    return {
      subject: `Payment received — ${d.amount}`,
      html: layout(
        d,
        "Thank you, we've received your payment",
        `<p>Hi ${esc(d.guestName.split(" ")[0])}, we've recorded a payment of <strong>${esc(d.amount)}</strong> for ${esc(d.tripTitle)}.</p>
         <p style="color:#4b5563">Paid so far: ${esc(d.paid)} · Balance: ${esc(d.pending)}</p>`,
        d.url ? { label: "View trip", url: d.url } : undefined,
      ),
      text: text([`Payment of ${d.amount} received for ${d.tripTitle}.`, `Paid: ${d.paid}. Balance: ${d.pending}.`, d.url]),
    };
  },
};

export type TemplateName = keyof typeof templates;
