import Link from "next/link";

export default function NoEncontrado() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16 text-center">
      <h1 className="text-xl font-bold">Esta página no existe</h1>
      <p className="mt-2 text-texto-2">Revisa el nombre de usuario o la dirección.</p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-marca px-4 py-2 font-semibold text-sobre-marca">
        Ir al inicio
      </Link>
    </div>
  );
}
