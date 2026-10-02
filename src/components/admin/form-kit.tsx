"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import type { ActionResult, ActionState } from "@/lib/services/admin/types";

export type AdminAction = (prev: ActionState, fd: FormData) => Promise<ActionResult>;

export function Submit({ children, pendingLabel, pending: pendingProp, ...props }: React.ComponentProps<typeof Button> & { pendingLabel: string; pending?: boolean }) {
  const { pending: formPending } = useFormStatus();
  const pending = pendingProp ?? formPending;
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function Feedback({ state }: { state: ActionState }) {
  if (!state) return null;
  return state.ok ? (
    <p className="text-[13px] text-emerald-700" role="status">
      {state.message}
    </p>
  ) : (
    <p className="text-[13px] text-red-600" role="alert">
      {state.error}
    </p>
  );
}

/**
 * Form bound to an admin Server Action. Submits inside a transition instead of
 * through the form action so React does not reset the fields: when the server
 * rejects the input, the merchant keeps what they typed.
 */
export function AdminForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  label,
}: {
  action: AdminAction;
  children: (state: ActionState, pending: boolean) => ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  label?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const native = event.nativeEvent as SubmitEvent;
    const data = new FormData(event.currentTarget, native.submitter);
    startTransition(() => formAction(data));
  }
  return (
    <form ref={ref} action={formAction} onSubmit={onSubmit} className={className} aria-label={label} noValidate>
      {children(state, pending)}
    </form>
  );
}
