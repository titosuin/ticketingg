import React from 'react';
import {
  Server,
  Play,
  Pause,
  PlusCircle,
  Zap,
  RotateCcw,
  BookOpen,
  FlaskConical,
  ShieldAlert,
  Layers,
  UserCheck,
  ShieldCheck,
  Lock,
  KeyRound,
  LogOut,
} from 'lucide-react';
import type { UserAccount, UserRole } from '../engine/types.ts';

interface HeaderProps {
  activeTab: 'main' | 'dlq' | 'concurrency' | 'architecture';
  setActiveTab: (tab: 'main' | 'dlq' | 'concurrency' | 'architecture') => void;
  isSimRunning: boolean;
  setIsSimRunning: (running: boolean) => void;
  simSpeed: number;
  setSimSpeed: (speed: number) => void;
  onOpenEnqueue: () => void;
  onBurstEnqueue: () => void;
  onReset: () => void;
  dlqCount: number;
  totalQueued: number;
  currentUser: UserAccount;
  onOpenUserModal: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isSimRunning,
  setIsSimRunning,
  simSpeed,
  setSimSpeed,
  onOpenEnqueue,
  onBurstEnqueue,
  onReset,
  dlqCount,
  totalQueued,
  currentUser,
  onOpenUserModal,
  onLogout,
}) => {
  const isRequester = currentUser.role === 'requester';
  const isSysAdmin = currentUser.role === 'system_admin';

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'system_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <ShieldAlert className="w-3 h-3 text-purple-400" />
            SYSTEM ADMIN / DEV
          </span>
        );
      case 'ticket_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <ShieldCheck className="w-3 h-3 text-amber-400" />
            ADMIN DE TICKETS
          </span>
        );
      case 'requester':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            <UserCheck className="w-3 h-3 text-cyan-400" />
            DESARROLLADOR (SOLO TICKETS)
          </span>
        );
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-30 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Marca y Estado */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Server className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight font-mono">
                MOTOR DE FLUJO Y DESPACHO DE TICKETS EMPRESARIAL
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                DESPACHO ATÓMICO ACTIVO
              </span>
            </div>
            <p className="text-xs text-slate-400">
              FSM Tolerante a Fallos &bull; Prevención de Inanición O(log N) &bull; Bloqueo Lease con TTL &bull; DLQ Forense
            </p>
          </div>
        </div>

        {/* Barra de Herramientas y Sesión RBAC */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Tarjeta de Sesión Activa RBAC */}
          <div
            onClick={onOpenUserModal}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-all group"
            title="Haz clic para cambiar de usuario o gestionar cuentas RBAC"
          >
            <div className="flex flex-col text-right">
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-xs font-bold text-slate-200 group-hover:text-indigo-300 transition-colors">
                  {currentUser.name}
                </span>
                <span className="text-[10px] font-mono text-slate-400">(@{currentUser.username})</span>
              </div>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                {getRoleBadge(currentUser.role)}
              </div>
            </div>
            <div className="p-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <KeyRound className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Botón de Cerrar Sesión */}
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-rose-500/50 hover:bg-rose-950/20 text-slate-400 hover:text-rose-300 transition-all font-mono text-xs"
              title="Cerrar sesión y salir"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          )}

          {/* Alternar Simulación (Solo Admins) */}
          {!isRequester && (
            <button
              onClick={() => setIsSimRunning(!isSimRunning)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isSimRunning
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30'
              }`}
              title={isSimRunning ? 'Pausar la flota autónoma de 5 trabajadores' : 'Reanudar la flota autónoma de 5 trabajadores'}
            >
              {isSimRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isSimRunning ? 'Pausar Flota' : 'Reanudar Flota'}</span>
            </button>
          )}

          {/* Selector de Velocidad (Solo Admins) */}
          {!isRequester && (
            <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-xs">
              <span className="px-2 text-slate-400 font-mono text-[10px]">VEL:</span>
              {[1, 2, 4].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSimSpeed(spd)}
                  className={`px-2 py-1 rounded font-mono transition-colors ${
                    simSpeed === spd
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
          )}

          {/* Acciones de Ingesta */}
          <button
            onClick={onOpenEnqueue}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm shadow-indigo-500/20"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{isRequester ? 'Pedir Ticket' : 'Encolar Ticket'}</span>
          </button>

          {/* Ráfaga y Reset (Solo Admins) */}
          {!isRequester && (
            <>
              <button
                onClick={onBurstEnqueue}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                title="Inyectar ráfaga de 5 tickets empresariales aleatorios a la cola"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Ráfaga +5</span>
              </button>

              <button
                onClick={onReset}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-all"
                title="Reiniciar cola y restablecer dataset de prueba"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Pestañas de Navegación Dinámicas según Rol */}
      <div className="max-w-7xl mx-auto mt-3 flex items-center border-t border-slate-800/80 pt-2 gap-1 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('main')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
            activeTab === 'main'
              ? 'bg-slate-800 text-indigo-400 border border-slate-700 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{isRequester ? 'Mis Tickets (Vista Solicitante)' : 'Cola y Flota de Trabajadores'}</span>
          {totalQueued > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300 font-mono">
              {totalQueued}
            </span>
          )}
        </button>

        {!isRequester ? (
          <>
            <button
              onClick={() => setActiveTab('dlq')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'dlq'
                  ? 'bg-slate-800 text-rose-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Cola de Mensajes Muertos (DLQ)</span>
              {dlqCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-mono font-bold animate-pulse">
                  {dlqCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('concurrency')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'concurrency'
                  ? 'bg-slate-800 text-teal-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>Suite de Concurrencia (5 Workers)</span>
            </button>

            <button
              onClick={() => setActiveTab('architecture')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'architecture'
                  ? 'bg-slate-800 text-purple-400 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Arquitectura y Especificación Formal</span>
            </button>
          </>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-slate-500 text-[11px] font-mono italic">
            <Lock className="w-3 h-3 text-slate-600" />
            <span>Pestañas DLQ, Concurrencia y Arquitectura ocultas para rol Solicitante (RBAC Enforced)</span>
          </div>
        )}
      </div>
    </header>
  );
};

