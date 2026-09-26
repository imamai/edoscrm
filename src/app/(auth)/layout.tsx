export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-start justify-center bg-background px-4 py-10 sm:items-center">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-sm">
        <p className="mb-6 text-center text-lg font-semibold text-ink">EDOS CRM</p>
        {children}
      </div>
    </div>
  );
}
