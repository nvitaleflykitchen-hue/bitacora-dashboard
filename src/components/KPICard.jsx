export default function KPICard({ label, value, sub, color = 'blue', icon: Icon }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-[#1A56A0]',
    orange: 'bg-orange-50 border-orange-200 text-[#E8401C]',
    green: 'bg-green-50 border-green-200 text-green-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
  }

  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-2 ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</span>
        {Icon && <Icon size={16} className="opacity-50" />}
      </div>
      <span className="text-3xl font-bold leading-none">{value ?? '—'}</span>
      {sub && <span className="text-xs opacity-60">{sub}</span>}
    </div>
  )
}
