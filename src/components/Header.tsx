/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LifeBuoy,
  PlusCircle,
  Users,
  LogOut,
  Shield,
  UserCheck,
  Headphones,
  AlertOctagon,
} from 'lucide-react';
import type { UserAccount, UserRole } from '../engine/types.ts';
import { getRoleLabelEs } from '../engine/security.ts';

interface HeaderProps {
  currentUser: UserAccount;
  onOpenEnqueue: () => void;
  onOpenUserModal: () => void;
  onLogout: () => void;
  dlqCount?: number;
  activeView?: 'main' | 'dlq';
  setActiveView?: (view: 'main' | 'dlq') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenEnqueue,
  onOpenUserModal,
  onLogout,
  dlqCount = 0,
  activeView = 'main',
  setActiveView,
}) => {
  const isSysAdmin = currentUser.role === 'system_admin';
  const isAgent = currentUser.role === 'ticket_admin';
  const isRequester = currentUser.role === 'requester';

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'system_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <Shield className="w-3 h-3 text-rose-400" />
            Administrador
          </span>
        );
      case 'ticket_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Headphones className="w-3 h-3 text-amber-400" />
            Agente de Soporte
          </span>
        );
      case 'requester':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            <UserCheck className="w-3 h-3 text-cyan-400" />
            Solicitante
          </span>
        );
    }
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-30 px-4 sm:px-6 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        {/* Título y Marca Limpios */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-600 text-white shadow-md shadow-indigo-600/20">
            <LifeBuoy className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Centro de Soporte y Tickets
            </h1>
            <p className="text-xs text-slate-400">
              Sistema de gestión y despacho de solicitudes
            </p>
          </div>
        </div>

        {/* Acciones y Perfil */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Tarjeta de Usuario Conectado */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <div className="flex flex-col text-right">
              <span className="text-xs font-semibold text-slate-200">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-slate-400">
                {currentUser.department}
              </span>
            </div>
            {getRoleBadge(currentUser.role)}
          </div>

          {/* Botón "+ Nuevo Ticket" */}
          <button
            type="button"
            onClick={onOpenEnqueue}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Nuevo Ticket</span>
          </button>

          {/* Botón "Usuarios" (solo visible para Administrador) */}
          {isSysAdmin && (
            <button
              type="button"
              onClick={onOpenUserModal}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
              title="Gestión de Cuentas y Cupos de Usuarios"
            >
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Usuarios</span>
            </button>
          )}

          {/* Pestaña DLQ / Error (visible solo para administradores/soporte si hay tickets fallidos) */}
          {!isRequester && dlqCount > 0 && setActiveView && (
            <button
              type="button"
              onClick={() => setActiveView(activeView === 'dlq' ? 'main' : 'dlq')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                activeView === 'dlq'
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
            >
              <AlertOctagon className="w-4 h-4 text-rose-400" />
              <span>Con Error ({dlqCount})</span>
            </button>
          )}

          {/* Botón "Cerrar Sesión" */}
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 transition-all text-xs font-medium cursor-pointer"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </header>
  );
};
