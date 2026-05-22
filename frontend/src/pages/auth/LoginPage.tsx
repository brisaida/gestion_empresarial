import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Package } from 'lucide-react'
import { useAuth } from '@/stores/authStore'
import { authApi } from '@/api/auth'
import { getAxiosError } from '@/lib/utils'
import Input from '@/components/ui/Input'

const schema = z.object({
  correo:   z.string().email('Correo inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const { state, login } = useAuth()
  const [showPass, setShowPass] = useState(false)
  const [serverError, setServerError] = useState('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  if (state.token) return <Navigate to="/dashboard" replace />

  const onSubmit = async (values: FormValues) => {
    setServerError('')
    try {
      const res = await authApi.login(values.correo, values.password)
      const { token, usuario, empresas } = res.data.data
      login(token, usuario, empresas)
    } catch (err) {
      setServerError(getAxiosError(err))
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #031B3A 0%, #072B5A 60%, #0E78D8 100%)' }}
    >
      {/* Background decorative circles */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #38D6D4, transparent 70%)' }} />
      <div className="absolute bottom-[-5%] left-[-10%] w-80 h-80 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #0E78D8, transparent 70%)' }} />

      <div className="w-full max-w-md relative z-10">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">

          {/* Header — brand gradient */}
          <div
            className="px-8 py-8 text-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #072B5A 0%, #0E78D8 55%, #38D6D4 100%)' }}
          >
            {/* Subtle shine overlay */}
            <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(255,255,255,0.4), transparent 70%)' }} />

            <div className="relative z-10">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-white/15 rounded-xl mb-4 backdrop-blur-sm border border-white/20">
                <Package size={28} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Inventario</h1>
              <p className="text-white/70 text-sm mt-1 font-medium">Sistema de gestión empresarial</p>
              <p className="text-[#38D6D4] text-xs mt-1 font-semibold tracking-widest uppercase">Vilena Dev Studio</p>
            </div>
          </div>

          {/* Form */}
          <div className="px-8 py-8">
            <h2 className="text-base font-bold text-[#072B5A] mb-6">Iniciar sesión</h2>

            {serverError && (
              <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
                <span className="mt-0.5">⚠</span>
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Correo electrónico"
                type="email"
                placeholder="tu@correo.com"
                error={errors.correo?.message}
                {...register('correo')}
              />

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide">Contraseña</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`w-full rounded-lg border px-3 py-2.5 pr-10 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all ${errors.password ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-[#0E78D8]/50'}`}
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0E78D8] transition-colors"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  style={{ background: isSubmitting ? '#5F6B7A' : 'linear-gradient(135deg, #0E78D8 0%, #38D6D4 100%)', boxShadow: '0 4px 20px rgba(14, 120, 216, 0.4)' }}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Verificando...
                    </>
                  ) : 'Entrar al sistema'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <p className="text-center text-white/30 text-xs mt-6 font-medium">
          © {new Date().getFullYear()} Vilena Dev Studio · Todos los derechos reservados
        </p>
      </div>
    </div>
  )
}
