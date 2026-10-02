import type { LeadStatus } from "@/generated/prisma/enums";

/** Pure helpers for the BM Dev internal panel. No server-only imports. */

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "Nueva",
  CONTACTED: "Contactada",
  QUALIFIED: "Presupuesto enviado",
  WON: "Ganada",
  LOST: "Perdida",
  SPAM: "Spam",
};
export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST", "SPAM"] as const satisfies readonly LeadStatus[];

// No 0/O, 1/l/I: the password is read aloud or copied by hand.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Readable temporary password (default 14 chars ≈ 81 bits), shown once to the superadmin. */
export function tempPassword(length = 14, random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  let out = "";
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % ALPHABET.length);
  while (out.length < length) {
    for (const byte of random(length * 2)) {
      if (byte < limit) out += ALPHABET[byte % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/** Suggested store slug from a business name ("Dulce Ana!" -> "dulce-ana"). */
export function suggestSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}
