import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Mail, Lock } from 'lucide-react'
import logoVilena from '@/assets/logo-vilena.jpg'
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
        {/* Card — completamente blanca */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/40 overflow-hidden">

          {/* Logo */}
          <div className="px-8 pt-8 pb-4 text-center border-b border-gray-100">
            <img src={logoVilena} alt="Vilena Cloud" className="h-16 w-auto mx-auto" />
            <p className="text-[#5F6B7A] text-xs mt-3 font-medium">Sistema de gestión empresarial</p>
          </div>

          {/* Form */}
          <div className="px-8 py-7">
            <h2 className="text-base font-bold text-[#072B5A] mb-6">Iniciar sesión</h2>

            {serverError && (
              <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
                <span className="mt-0.5">⚠</span>
                {serverError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide">Correo electrónico</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    placeholder="tu@correo.com"
                    className={`w-full rounded-lg border pl-9 pr-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all ${errors.correo ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-[#0E78D8]/50'}`}
                    {...register('correo')}
                  />
                </div>
                {errors.correo && <p className="text-xs text-red-600">{errors.correo.message}</p>}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#072B5A] uppercase tracking-wide">Contraseña</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`w-full rounded-lg border pl-9 pr-10 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0E78D8]/30 focus:border-[#0E78D8] transition-all ${errors.password ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-[#0E78D8]/50'}`}
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

        <p className="text-center text-white/40 text-xs mt-5 font-medium">
          © {new Date().getFullYear()} Vilena Dev Studio
        </p>
      </div>
    </div>
  )
}
