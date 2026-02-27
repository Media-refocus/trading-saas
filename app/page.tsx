import Link from 'next/link';
import {
  Shield,
  Zap,
  LineChart,
  Server,
  Bell,
  Lock,
  CheckCircle,
  ArrowRight,
  Bot,
  Gauge,
  AlertTriangle,
} from 'lucide-react';

const features = [
  {
    icon: Bot,
    title: 'Ejecucion Automatica 24/7',
    description:
      'El bot opera por ti las 24 horas. Recibe senales de tu canal de Telegram y las ejecuta en MT5 automaticamente.',
  },
  {
    icon: Gauge,
    title: 'Dashboard Completo',
    description:
      'Controla todo desde una unica pantalla: posiciones, balance, metricas, historico de operaciones.',
  },
  {
    icon: Shield,
    title: 'Kill Switch de Emergencia',
    description:
      'Un clic para cerrar TODAS las posiciones y detener el bot. Proteccion total ante imprevistos.',
  },
  {
    icon: AlertTriangle,
    title: 'Daily Loss Limit',
    description:
      'El bot se detiene automaticamente si pierdes mas del limite diario que configures. Protege tu capital.',
  },
  {
    icon: LineChart,
    title: 'Backtester Avanzado',
    description:
      '25,000+ senales historicas para probar estrategias antes de arriesgar dinero real.',
  },
  {
    icon: Bell,
    title: 'Notificaciones Telegram',
    description:
      'Recibe alertas en tiempo real: operaciones abiertas, cerradas, errores, limites alcanzados.',
  },
];

const howItWorks = [
  {
    step: 1,
    title: 'Contrata tu VPS Windows',
    description:
      'Necesitas un VPS con Windows (4GB RAM minimo). Nosotros te guiamos en la eleccion.',
  },
  {
    step: 2,
    title: 'Instala el bot con un script',
    description:
      'Te damos un script que instala todo automaticamente: Python, dependencias, el bot.',
  },
  {
    step: 3,
    title: 'Configura MT5 con tus credenciales',
    description:
      'Pones tu usuario y contrasena de MT5 en TU VPS. NUNCA salen de ahi.',
  },
  {
    step: 4,
    title: 'Conecta con tu API Key',
    description:
      'Generas una API Key en el dashboard y la pones en el bot. Ya esta, a operar.',
  },
];

const securityPoints = [
  'Tus credenciales de broker NUNCA salen de tu VPS',
  'No guardamos ningun dato bancario',
  'Conexion encriptada entre bot y dashboard',
  'Tu capital siempre bajo tu control',
  'Cumplimiento regulatorio: no manejamos tu dinero',
];

const faqs = [
  {
    question: 'Necesito tener el PC encendido todo el dia?',
    answer:
      'No. Usamos un VPS Windows (servidor virtual) que esta encendido 24/7. Tu PC puede estar apagado.',
  },
  {
    question: 'Es seguro? Teneis acceso a mi cuenta?',
    answer:
      'No. Tus credenciales de MT5 se quedan en tu VPS. Nosotros solo recibimos datos de operativa (no dinero). Nunca podemos tocar tu capital.',
  },
  {
    question: 'Que VPS necesito?',
    answer:
      'Windows Server 2019+, 4GB RAM minimo, 50GB disco. Recomendamos contybo, forexvps o similar. Te ayudamos a configurarlo.',
  },
  {
    question: 'Puedo usar MT4 en lugar de MT5?',
    answer:
      'Actualmente solo soportamos MT5. MT4 es una plataforma legacy con menos funcionalidades.',
  },
  {
    question: 'Que pasa si el bot falla?',
    answer:
      'El bot tiene un sistema de heartbeat que nos avisa si se cae. Ademas, puedes reiniciarlo remotamente desde el dashboard.',
  },
  {
    question: 'Puedo cancelar cuando quiera?',
    answer:
      'Si, sin penalizaciones. El acceso sigue activo hasta el final del periodo pagado.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navbar */}
      <header className="border-b border-slate-700/50 sticky top-0 bg-slate-900/80 backdrop-blur z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-white flex items-center gap-2">
            <Bot className="h-6 w-6 text-blue-500" />
            Trading Bot
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              href="/pricing"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Precios
            </Link>
            <Link
              href="/login"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Iniciar Sesion
            </Link>
            <Link
              href="/register"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Prueba Gratis
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 rounded-full px-4 py-2 mb-6">
            <Zap className="h-4 w-4 text-blue-400" />
            <span className="text-blue-300 text-sm">14 dias gratis. Sin tarjeta.</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Automatiza tu trading{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              sin arriesgar tu capital
            </span>
          </h1>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            Bot que ejecuta senales de Telegram en MT5. Control total desde el dashboard.
            Sin guardar credenciales. Sin manejar tu dinero.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/register"
              className="px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition inline-flex items-center gap-2 font-semibold"
            >
              Comenzar Gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-4 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition inline-block"
            >
              Ver Precios
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mt-16 max-w-3xl mx-auto">
          <div className="text-center">
            <div className="text-3xl font-bold text-white">25,000+</div>
            <div className="text-slate-400 text-sm">Senales en backtester</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-white">24/7</div>
            <div className="text-slate-400 text-sm">Operacion automatica</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-white">0</div>
            <div className="text-slate-400 text-sm">Credenciales guardadas</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t border-slate-700/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Todo lo que necesitas para operar
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Herramientas profesionales sin complicaciones tecnicas.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition"
              >
                <feature.icon className="h-10 w-10 text-blue-500 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-slate-400 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="py-20 bg-slate-800/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Lock className="h-8 w-8 text-green-500" />
              <h2 className="text-3xl font-bold text-white">Seguridad Primero</h2>
            </div>
            <p className="text-slate-300 text-lg mb-8">
              Tu capital y credenciales nunca salen de tu control. Nosotros solo
              proporcionamos la herramienta, no tocamos tu dinero.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {securityPoints.map((point, index) => (
                <div key={index} className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <span className="text-slate-300">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 border-t border-slate-700/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Como Funciona</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Configuracion en menos de 30 minutos. Sin conocimientos tecnicos.
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {howItWorks.map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-slate-400 text-sm">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VPS Requirements */}
      <section className="py-20 bg-slate-800/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <Server className="h-8 w-8 text-purple-500" />
              <h2 className="text-3xl font-bold text-white">Requisitos del VPS</h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Minimo Recomendado
                </h3>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li>Windows Server 2019 o superior</li>
                  <li>4 GB RAM</li>
                  <li>50 GB disco SSD</li>
                  <li>2 vCPU</li>
                  <li>Latencia &lt;50ms a tu broker</li>
                </ul>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Proveedores Recomendados
                </h3>
                <ul className="space-y-2 text-slate-300 text-sm">
                  <li>Contabo - Economico, buena opcion</li>
                  <li>ForexVPS - Optimizado para trading</li>
                  <li>Vultr - Buen rendimiento general</li>
                  <li>Hetzner - Calidad-precio excelente</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="py-20 border-t border-slate-700/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">
              Preguntas Frecuentes
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-slate-800/50 border border-slate-700 rounded-lg p-4"
              >
                <h3 className="font-semibold text-white mb-2">{faq.question}</h3>
                <p className="text-slate-400 text-sm">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Empieza tu prueba gratis de 14 dias
          </h2>
          <p className="text-slate-300 mb-8 max-w-xl mx-auto">
            Todas las funciones del plan Pro. Sin tarjeta de credito.
            Cancela cuando quieras.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Crear Cuenta Gratis
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-500" />
              <span className="text-white font-semibold">Trading Bot</span>
            </div>
            <p className="text-slate-500 text-sm">
              © {new Date().getFullYear()} Trading Bot SaaS. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-4 text-slate-400 text-sm">
              <span>Soporte: soporte@tradingbot.com</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
