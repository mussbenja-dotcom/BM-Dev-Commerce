import Link from "next/link";

export default function NotFound() {
  return <div className="px-5 py-24 text-center"><h1 className="font-heading text-3xl">No encontramos esta página</h1><p className="mt-4 text-muted">El enlace puede haber cambiado o el producto ya no está disponible.</p><Link href="." className="mt-6 inline-block underline">Volver</Link></div>;
}
