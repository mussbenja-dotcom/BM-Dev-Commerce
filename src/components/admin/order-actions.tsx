"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Feedback, Submit } from "./form-kit";
import { Field, Select, Textarea } from "@/components/ui/field";
import type { ActionResult, ActionState } from "@/lib/services/admin/types";
import { addOrderNoteAction, cancelOrderAction, updateOrderStatusAction, updatePaymentStatusAction } from "@/app/admin/pedidos/actions";
import { ORDER_STATUS, PAYMENT_STATUS, type OrderStatusKey, type PaymentStatusKey } from "./labels";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionResult>;

function useAction(action: Action) {
  return useActionState<ActionState, FormData>(action, undefined);
}

export function StatusForm({ orderId, options }: { orderId: string; options: OrderStatusKey[] }) {
  const [state, action] = useAction(updateOrderStatusAction);
  if (!options.length) return null;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex gap-2">
        <label className="flex-1">
          <span className="sr-only">Nuevo estado</span>
          <Select name="status" defaultValue={options[0]} className="h-10" key={options[0]}>
            {options.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS[s].label}
              </option>
            ))}
          </Select>
        </label>
        <Submit size="sm" className="h-10" pendingLabel="Guardando…">
          Actualizar
        </Submit>
      </div>
      <Feedback state={state} />
    </form>
  );
}

const PAYMENT_ACTION_LABEL: Record<PaymentStatusKey, string> = {
  PAID: "Marcar como pagado",
  PENDING: "Volver a pendiente",
  REFUNDED: "Marcar como reintegrado",
  FAILED: "",
};

export function PaymentForm({ orderId, targets }: { orderId: string; targets: PaymentStatusKey[] }) {
  const [state, action] = useAction(updatePaymentStatusAction);
  if (!targets.length) return null;
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <div className="flex flex-wrap gap-2">
        {targets.map((t, i) => (
          <Submit key={t} name="paymentStatus" value={t} size="sm" variant={i === 0 && t === "PAID" ? "primary" : "secondary"} pendingLabel="Guardando…">
            {PAYMENT_ACTION_LABEL[t]}
          </Submit>
        ))}
      </div>
      <p className="text-xs text-muted">Confirmá el cobro en tu cuenta antes de marcarlo como {PAYMENT_STATUS.PAID.label.toLowerCase()}.</p>
      <Feedback state={state} />
    </form>
  );
}

export function CancelForm({ orderId, paid, number }: { orderId: string; paid: boolean; number: number }) {
  const [state, action] = useAction(cancelOrderAction);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="secondary" size="sm" className="text-red-700" onClick={() => setOpen(true)}>
          Cancelar pedido
        </Button>
        <Feedback state={state} />
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50/50 p-3">
      <input type="hidden" name="orderId" value={orderId} />
      <p className="text-sm">
        El pedido #{number} queda cancelado y sus productos vuelven al stock. Esta acción no se puede deshacer.
      </p>
      <Field label="Motivo (opcional)" error={state?.fieldErrors?.reason}>
        {(p) => <Textarea {...p} name="reason" maxLength={300} className="min-h-16 bg-bg" placeholder="Ej.: el cliente se arrepintió" />}
      </Field>
      {paid ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="refundAcknowledged" required className="mt-0.5 size-4 accent-red-600" />
          <span>
            Este pedido está pagado. Cancelarlo <strong>no devuelve el dinero</strong>: voy a gestionar el reintegro desde Mercado Pago o por
            transferencia.
          </span>
        </label>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Submit variant="danger" size="sm" pendingLabel="Cancelando…">
          Confirmar cancelación
        </Submit>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Volver
        </Button>
      </div>
      <Feedback state={state} />
    </form>
  );
}

export function NoteForm({ orderId }: { orderId: string }) {
  const [state, action] = useAction(addOrderNoteAction);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <label>
        <span className="sr-only">Nota interna</span>
        <Textarea name="message" maxLength={500} required className="min-h-16" placeholder="Agregá una nota interna (el cliente no la ve)" />
      </label>
      <div className="flex items-center justify-between gap-3">
        <Feedback state={state} />
        <Submit size="sm" variant="secondary" className="ml-auto" pendingLabel="Guardando…">
          Agregar nota
        </Submit>
      </div>
    </form>
  );
}
