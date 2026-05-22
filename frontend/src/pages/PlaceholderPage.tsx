import { Construction } from 'lucide-react'

interface Props { title: string; description?: string }

export default function PlaceholderPage({ title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-96 text-center">
      <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-4">
        <Construction size={28} className="text-amber-500" />
      </div>
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <p className="text-sm text-gray-400 mt-1">{description ?? 'Esta sección estará disponible próximamente.'}</p>
    </div>
  )
}
