"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Quote } from "@/lib/pricing";

/**
 * Cart lives in localStorage per store. Items keep a display snapshot so the
 * drawer renders instantly; prices and totals always come from the server quote.
 */

export type CartItem = {
  variantId: string;
  productSlug: string;
  name: string;
  variantLabel: string | null;
  image: string | null;
  unitPrice: number;
  quantity: number;
};

type CartState = { items: CartItem[]; coupon: string | null };
const EMPTY: CartState = { items: [], coupon: null };

function createCartStore(key: string) {
  let state: CartState = EMPTY;
  let loaded = false;
  const listeners = new Set<() => void>();

  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = window.localStorage.getItem(key);
      state = EMPTY;
      if (raw) {
        const parsed = JSON.parse(raw) as CartState;
        if (Array.isArray(parsed.items)) state = {
          items: parsed.items.filter((item) => item && typeof item.variantId === "string" && typeof item.productSlug === "string" && typeof item.name === "string" && typeof item.unitPrice === "number" && Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 20).slice(0, 50),
          coupon: typeof parsed.coupon === "string" ? parsed.coupon : null,
        };
      }
    } catch {
      state = EMPTY;
    }
  };
  const persist = () => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* storage full or blocked: cart still works for this tab */
    }
  };
  return {
    subscribe(fn: () => void) {
      listeners.add(fn);
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) {
          loaded = false;
          load();
          fn();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(fn);
        window.removeEventListener("storage", onStorage);
      };
    },
    get() {
      load();
      return state;
    },
    set(next: CartState) {
      state = next;
      persist();
      listeners.forEach((l) => l());
    },
  };
}

const stores = new Map<string, ReturnType<typeof createCartStore>>();
function getCartStore(slug: string) {
  let s = stores.get(slug);
  if (!s) {
    s = createCartStore(`bm_cart_${slug}`);
    stores.set(slug, s);
  }
  return s;
}

type CartApi = {
  items: CartItem[];
  coupon: string | null;
  count: number;
  hydrated: boolean;
  isOpen: boolean;
  lastAddedAt: number;
  open: () => void;
  close: () => void;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  setCoupon: (code: string | null) => void;
};

const CartCtx = createContext<CartApi | null>(null);
const noopSubscribe = () => () => {};

export function CartProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const store = getCartStore(slug);
  const state = useSyncExternalStore(store.subscribe, store.get, () => EMPTY);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [isOpen, setOpen] = useState(false);
  const [lastAddedAt, setLastAddedAt] = useState(0);

  const api = useMemo<CartApi>(() => {
    const update = (fn: (s: CartState) => CartState) => store.set(fn(store.get()));
    return {
      items: state.items,
      coupon: state.coupon,
      count: state.items.reduce((a, i) => a + i.quantity, 0),
      hydrated,
      isOpen,
      lastAddedAt,
      open: () => setOpen(true),
      close: () => setOpen(false),
      add: (item, quantity = 1) => {
        update((s) => {
          const existing = s.items.find((i) => i.variantId === item.variantId);
          const items = existing
            ? s.items.map((i) => (i.variantId === item.variantId ? { ...i, ...item, quantity: Math.min(20, i.quantity + quantity) } : i))
            : [...s.items, { ...item, quantity: Math.min(20, quantity) }];
          return { ...s, items };
        });
        setLastAddedAt(Date.now());
      },
      setQuantity: (variantId, quantity) =>
        update((s) => ({
          ...s,
          items:
            quantity <= 0
              ? s.items.filter((i) => i.variantId !== variantId)
              : s.items.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(20, quantity) } : i)),
        })),
      remove: (variantId) => update((s) => ({ ...s, items: s.items.filter((i) => i.variantId !== variantId) })),
      clear: () => store.set(EMPTY),
      setCoupon: (code) => update((s) => ({ ...s, coupon: code ? code.trim().toUpperCase() : null })),
    };
  }, [state, hydrated, isOpen, lastAddedAt, store]);

  return <CartCtx.Provider value={api}>{children}</CartCtx.Provider>;
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}

export type QuoteParams = {
  shippingMethodId?: string | null;
  paymentMethod?: string | null;
  enabled?: boolean;
};

/** Debounced server quote for the current cart. */
export function useQuote(slug: string, items: CartItem[], coupon: string | null, params: QuoteParams = {}) {
  const [result, setResult] = useState<{ body: string; quote: Quote } | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<{ body: string; message: string } | null>(null);
  const reqId = useRef(0);
  const enabled = params.enabled ?? true;
  const body = JSON.stringify({
    lines: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    couponCode: coupon,
    shippingMethodId: params.shippingMethodId ?? null,
    paymentMethod: params.paymentMethod ?? null,
  });

  const run = useCallback(async (signal?: AbortSignal) => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/store/${slug}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal,
      });
      if (!res.ok) throw new Error("No pudimos actualizar los precios.");
      const data = (await res.json()) as Quote;
      if (!signal?.aborted && id === reqId.current) {
        setResult({ body, quote: data });
        setFailure(null);
      }
    } catch (e) {
      if (!signal?.aborted && id === reqId.current) setFailure({ body, message: e instanceof Error ? e.message : "Error de conexión." });
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [slug, body]);

  useEffect(() => {
    if (!enabled || items.length === 0) return;
    const controller = new AbortController();
    const t = setTimeout(() => run(controller.signal), 180);
    return () => { clearTimeout(t); controller.abort(); };
  }, [run, enabled, items.length]);

  const currentQuote = result?.body === body ? result.quote : null;
  const error = failure?.body === body ? failure.message : null;
  return { quote: items.length ? currentQuote : null, loading: enabled && items.length > 0 && (loading || (!currentQuote && !error)), error, refresh: run };
}
