"use client";

import { createContext, useContext, type ReactNode } from "react";

export type StorePublic = {
  slug: string;
  name: string;
  base: string;
  whatsapp: string | null;
  instagram: string | null;
  freeShippingThreshold: number | null;
  transferDiscountPct: number;
  maxInstallments: number;
  cardStyle: "portrait" | "square";
  logoUrl: string | null;
};

const Ctx = createContext<StorePublic | null>(null);

export function StoreProvider({ value, children }: { value: StorePublic; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used inside StoreProvider");
  return v;
}

/** Builds a storefront href respecting custom-domain vs /s/[slug] routing. */
export function useHref() {
  const { base } = useStore();
  return (path: string) => `${base}${path === "/" ? "" : path}` || "/";
}
