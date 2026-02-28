export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex justify-center px-4 pt-[10vh] pb-8">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
