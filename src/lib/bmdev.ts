import "server-only";
import { normalizeWhatsapp, whatsappUrl } from "@/lib/whatsapp";
import { bmdevInterestMessage } from "@/lib/services/leads/form";

/**
 * The only place that reads BM Dev's sales WhatsApp (BMDEV_WHATSAPP).
 * Returns null when it is not configured so callers can hide the button.
 */
export function bmdevWhatsappUrl(details?: Parameters<typeof bmdevInterestMessage>[0]): string | null {
  const number = normalizeWhatsapp(process.env.BMDEV_WHATSAPP);
  return number ? whatsappUrl(number, bmdevInterestMessage(details)) : null;
}
