export default function Cargando() {
  return (
    <div className="mx-auto w-full max-w-3xl animate-pulse px-4 py-8">
      <div className="flex items-center gap-4">
        <div className="h-24 w-24 rounded-full bg-borde" />
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-borde" />
          <div className="h-4 w-32 rounded bg-borde" />
        </div>
      </div>
      <div className="mt-8 h-20 rounded-2xl bg-borde" />
    </div>
  );
}
