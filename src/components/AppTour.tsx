/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  PlusCircle,
  Users,
  Inbox,
  AlertOctagon,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  Zap,
  CheckCircle2,
} from 'lucide-react';

interface AppTourProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  userRole?: string;
}

interface TourStep {
  title: string;
  badge: string;
  description: string;
  icon: React.ReactNode;
  tips: string[];
  accentColor: string;
}

export const AppTour: React.FC<AppTourProps> = ({
  isOpen,
  onClose,
  userName = 'Usuario',
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const steps: TourStep[] = [
    {
      title: '¡Te damos la bienvenida a AegisFlow!',
      badge: 'Paso 1 de 5 • Introducción',
      description:
        `Hola ${userName}. AegisFlow es el motor empresarial de flujo, despacho y resolución de tickets de alta concurrencia con seguridad DevSecOps integrada.`,
      icon: <LifeBuoy className="w-8 h-8 text-indigo-400" />,
      tips: [
        'Despacho en tiempo real sin colisiones ni condiciones de carrera.',
        'Prevención de inanición (Aging Priority) para que ningún ticket quede rezagado.',
        'Seguridad de nivel corporativo con control de acceso por roles (RBAC) y RLS.',
      ],
      accentColor: 'from-indigo-600 to-cyan-600',
    },
    {
      title: 'Crea y Prioriza Solicitudes (+ Nuevo Ticket)',
      badge: 'Paso 2 de 5 • Gestión de Tickets',
      description:
        'Cualquier miembro del equipo puede emitir solicitudes con prioridades estrictas calculadas al instante con identificadores RFC 9562 (UUIDv7).',
      icon: <PlusCircle className="w-8 h-8 text-cyan-400" />,
      tips: [
        'Prioridades clasificadas de P0 (Crítico - Incidente de Caída) a P3 (Bajo).',
        'Cálculo automático de SLA de atención y vencimiento.',
        'Sanitización estricta anti-XSS y validación de contenido en tiempo real.',
      ],
      accentColor: 'from-cyan-600 to-blue-600',
    },
    {
      title: 'Flota de Agentes con Bloqueo Atómico (Lease)',
      badge: 'Paso 3 de 5 • Despacho Seguro',
      description:
        'Los agentes de soporte toman tickets de forma concurrente mediante un sistema de arrendamiento temporal (Lease de 15s) con Fencing Token.',
      icon: <Users className="w-8 h-8 text-amber-400" />,
      tips: [
        'Evita que dos agentes atiendan el mismo ticket simultáneamente.',
        'Si un agente se desconecta, el ticket regresa automáticamente a la cola tras expirar el lease.',
        'Heartbeat para extender el tiempo de atención si la tarea requiere más minutos.',
      ],
      accentColor: 'from-amber-600 to-orange-600',
    },
    {
      title: 'Cola de Atención & Búsqueda Instantánea',
      badge: 'Paso 4 de 5 • Supervisión en Vivo',
      description:
        'Filtra tickets en cola, en atención o resueltos. Los solicitantes disfrutan de privacidad estricta (RLS), mientras los administradores supervisan la operación completa.',
      icon: <Inbox className="w-8 h-8 text-emerald-400" />,
      tips: [
        'Filtro por estado: En Cola, En Proceso, Resueltos y Fallidos.',
        'Búsqueda en tiempo real por título, código o departamento.',
        'Detalle forense completo de cada ticket con registro histórico inmutable.',
      ],
      accentColor: 'from-emerald-600 to-teal-600',
    },
    {
      title: 'Cola de Errores (DLQ) & Protección DevSecOps',
      badge: 'Paso 5 de 5 • Seguridad & Resiliencia',
      description:
        'Cuando un ticket supera el umbral de reintentos o contiene excepciones graves, es trasladado al Dead Letter Queue (DLQ) con sanitización de credenciales.',
      icon: <AlertOctagon className="w-8 h-8 text-rose-400" />,
      tips: [
        'Sanitización automática de contraseñas, secretos de Postgres y tokens JWT.',
        'Capacidad de reintento manual (Replay) una vez corregida la causa raíz.',
        'Protección activa contra fuerza bruta y bloqueo de 60s tras 5 intentos fallidos.',
      ],
      accentColor: 'from-rose-600 to-pink-600',
    },
  ];

  const step = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('aegisflow_tour_completed', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden relative">
        {/* Glow de fondo superior */}
        <div className={`h-2 w-full bg-gradient-to-r ${step.accentColor}`} />

        {/* Botón Cerrar / Omitir */}
        <button
          type="button"
          onClick={handleComplete}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          title="Omitir Tour"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8">
          {/* Badge & Icono */}
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700 shadow-inner shrink-0">
              {step.icon}
            </div>
            <div>
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block">
                {step.badge}
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">
                {step.title}
              </h2>
            </div>
          </div>

          {/* Descripción */}
          <p className="text-sm text-slate-300 leading-relaxed mb-5">
            {step.description}
          </p>

          {/* Tarjetas de Tips */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 mb-6 space-y-2.5">
            {step.tips.map((tip, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{tip}</span>
              </div>
            ))}
          </div>

          {/* Navegación y Puntos de Progreso */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            {/* Indicadores de Pasos */}
            <div className="flex items-center gap-1.5">
              {steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentStep(i)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    i === currentStep
                      ? 'w-6 bg-indigo-500'
                      : 'w-2 bg-slate-700 hover:bg-slate-600'
                  }`}
                  aria-label={`Ir al paso ${i + 1}`}
                />
              ))}
            </div>

            {/* Botones */}
            <div className="flex items-center gap-2">
              {currentStep > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Atrás</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-lg transition-all flex items-center gap-1.5 cursor-pointer bg-gradient-to-r ${
                  step.accentColor
                } hover:opacity-95`}
              >
                <span>
                  {currentStep === steps.length - 1 ? '¡Comenzar ahora!' : 'Siguiente'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
