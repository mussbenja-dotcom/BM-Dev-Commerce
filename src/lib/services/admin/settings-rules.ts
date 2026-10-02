/** Pure validation for the store settings. Shared by server and UI. No server-only imports. */

const digits = (v: string) => v.replace(/\D/g, "");

/** Argentine CBU/CVU: 22 digits in two blocks, each with its own check digit. */
export function isValidCbu(raw: string): boolean {
  const v = digits(raw);
  if (v.length !== 22 || raw.replace(/[\s-]/g, "") !== v) return false;
  const check = (block: string, weights: number[]) => {
    const sum = weights.reduce((acc, w, i) => acc + w * Number(block[i]), 0);
    return (10 - (sum % 10)) % 10 === Number(block[weights.length]);
  };
  return check(v.slice(0, 8), [7, 1, 3, 9, 7, 1, 3]) && check(v.slice(8), [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3]);
}

/** CUIT/CUIL: 11 digits with a mod-11 check digit. */
export function isValidCuit(raw: string): boolean {
  const v = digits(raw);
  if (v.length !== 11 || !/^[\d\s-]+$/.test(raw)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(v[i]), 0);
  const mod = 11 - (sum % 11);
  const expected = mod === 11 ? 0 : mod === 10 ? 9 : mod;
  return expected === Number(v[10]);
}

export const ALIAS = /^[a-zA-Z0-9.-]{6,20}$/;

export type PaymentSettingsInput = {
  enableMercadoPago: boolean;
  enableTransfer: boolean;
  enableCash: boolean;
  enableWhatsappOrder: boolean;
  bankHolder: string | null;
  bankCbu: string | null;
  bankAlias: string | null;
  bankCuit: string | null;
};

/** Mercado Pago is usable in a demo store (simulation) or once BM Dev connected real credentials. */
export function mercadoPagoAvailable(s: { isDemo: boolean; mpMode: string; hasToken: boolean }): boolean {
  return s.isDemo || (s.mpMode !== "DEMO" && s.hasToken);
}

export function paymentSettingsErrors(input: PaymentSettingsInput, mpAvailable: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  const usable = (input.enableMercadoPago && mpAvailable) || input.enableTransfer || input.enableCash || input.enableWhatsappOrder;
  if (!usable) errors.enableTransfer = "Dejá activo al menos un medio de pago que tus clientes puedan usar.";
  if (input.bankCbu && !isValidCbu(input.bankCbu)) errors.bankCbu = "Revisá el CBU/CVU: son 22 números.";
  if (input.bankAlias && !ALIAS.test(input.bankAlias)) errors.bankAlias = "El alias tiene de 6 a 20 letras, números, puntos o guiones.";
  if (input.bankCuit && !isValidCuit(input.bankCuit)) errors.bankCuit = "Revisá el CUIT: son 11 números.";
  if (input.enableTransfer) {
    if (!input.bankCbu && !input.bankAlias) errors.bankAlias ??= "Para cobrar por transferencia cargá el alias o el CBU.";
    if (!input.bankHolder) errors.bankHolder = "Indicá el titular de la cuenta.";
  }
  return errors;
}
