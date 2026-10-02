/**
 * Shapes shared by admin Server Actions and the client components that call
 * them. Kept free of server-only imports so client code can import the types.
 */
export type ActionState =
  | {
      ok: boolean;
      message?: string;
      error?: string;
      fieldErrors?: Record<string, string>;
      /** Optional payload, e.g. the id of a newly created record. */
      id?: string;
    }
  | undefined;

export type ActionResult = NonNullable<ActionState>;
