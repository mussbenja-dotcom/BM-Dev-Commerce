import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { demoLoginAction } from "@/lib/auth/actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Ingresar — BM Dev Commerce", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const session = await getSession();
  if (session) redirect(session.role === "SUPERADMIN_BMDEV" && !session.storeId ? "/superadmin" : "/admin");
  const { next, error } = await searchParams;
  const demoEnabled = process.env.DEMO_LOGIN_ENABLED === "true";

  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-[400px]">
        <Link href="/tienda-online" className="mb-8 flex items-center justify-center gap-2 text-fg">
          <span className="grid size-8 place-items-center rounded-lg bg-fg text-sm font-bold text-bg">BM</span>
          <span className="font-semibold tracking-tight">BM Dev Commerce</span>
        </Link>
        <div className="rounded-2xl border border-line bg-bg p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">Ingresá a tu panel</h1>
          <p className="mt-1 mb-6 text-sm text-muted">Administrá tus productos, pedidos y tu tienda.</p>
          {error === "rate" ? (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="alert">
              Demasiados intentos. Esperá unos minutos.
            </p>
          ) : null}
          <LoginForm next={next} />
        </div>
        {demoEnabled ? (
          <form action={demoLoginAction} className="mt-4 text-center">
            <input type="hidden" name="slug" value="alma" />
            <button type="submit" className="text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
              ¿Querés probarlo? Entrar al panel de la tienda demo
            </button>
          </form>
        ) : null}
      </div>
    </main>
  );
}
