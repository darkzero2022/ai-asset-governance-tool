export function Forbidden({ message }: { message?: string }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">Access denied</h1>
      <p className="mt-2 text-slate-500">{message ?? "You don't have permission to view this page."}</p>
    </section>
  );
}
