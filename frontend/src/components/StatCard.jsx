export default function StatCard({ label, value, accent = "brand" }) {
  const accents = {
    brand: "from-brand-500 to-brand-700",
    orange: "from-orange-400 to-orange-600",
    slate: "from-slate-600 to-slate-800",
  };

  return (
    <div className="rounded-2xl border border-white/50 bg-white/90 p-5 shadow-soft">
      <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-3 bg-gradient-to-r ${accents[accent]} bg-clip-text text-3xl font-extrabold text-transparent`}>{value}</p>
    </div>
  );
}
