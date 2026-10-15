/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  LifeBuoy,
  PlusCircle,
  Users,
  LogOut,
  Shield,
  UserCheck,
  Headphones,
  AlertOctagon,
  MessageSquare,
  Bell,
} from 'lucide-react';
import type { UserAccount, UserRole, AdminNotification } from '../engine/types.ts';
import { NotificationsPopover } from './NotificationsPopover.tsx';

interface HeaderProps {
  currentUser: UserAccount;
  onOpenEnqueue: () => void;
  onOpenUserModal: () => void;
  onOpenTour?: () => void;
  onOpenChat?: () => void;
  onLogout: () => void;
  dlqCount?: number;
  activeView?: 'main' | 'dlq';
  setActiveView?: (view: 'main' | 'dlq') => void;
  notifications?: AdminNotification[];
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onSelectTicketFromNotification?: (ticketId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onOpenEnqueue,
  onOpenUserModal,
  onOpenTour,
  onOpenChat,
  onLogout,
  dlqCount = 0,
  activeView = 'main',
  setActiveView,
  notifications = [],
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onSelectTicketFromNotification,
}) => {
  const [isNotifsOpen, setIsNotifsOpen] = useState(false);

  const isSysAdmin = currentUser.role === 'system_admin';
  const isAgent = currentUser.role === 'ticket_admin';
  const isRequester = currentUser.role === 'requester';

  const unreadNotifs = notifications.filter((n) => !n.read).length;

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'system_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
            <Shield className="w-3 h-3 text-rose-400" />
            Administrador
          </span>
        );
      case 'ticket_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
            <Headphones className="w-3 h-3 text-amber-400" />
            Soporte
          </span>
        );
      case 'requester':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
            <UserCheck className="w-3 h-3 text-cyan-400" />
            Solicitante
          </span>
        );
    }
  };

  return (
    <header className="border-b border-zinc-800 bg-zinc-900/90 backdrop-blur sticky top-0 z-30 px-4 sm:px-6 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        {/* Título y Marca AegisFlow */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-zinc-800 border border-zinc-700/80 text-zinc-100 shadow-sm">
            <LifeBuoy className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-zinc-100 tracking-tight">
                AegisFlow
              </h1>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60 font-medium">
                Enterprise
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Mesa de Ayuda & Despacho Operativo
            </p>
          </div>
        </div>

        {/* Acciones y Perfil */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Tarjeta de Usuario Conectado */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="flex flex-col text-right">
              <span className="text-xs font-semibold text-zinc-200">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-zinc-400">
                {currentUser.department}
              </span>
            </div>
            {getRoleBadge(currentUser.role)}
          </div>

          {/* Sistema de Notificaciones para Administradores (Julio, Domingo, etc.) */}
          {isSysAdmin && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotifsOpen(!isNotifsOpen)}
                className={`relative p-2 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                  isNotifsOpen
                    ? 'bg-zinc-800 border-zinc-600 text-zinc-100'
                    : 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                }`}
                title="Notificaciones de Administrador"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifs > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                    {unreadNotifs}
                  </span>
                )}
              </button>

              <NotificationsPopover
                isOpen={isNotifsOpen}
                onClose={() => setIsNotifsOpen(false)}
                notifications={notifications}
                onMarkAsRead={(id) => onMarkNotificationRead && onMarkNotificationRead(id)}
                onMarkAllAsRead={() => onMarkAllNotificationsRead && onMarkAllNotificationsRead()}
                onSelectTicket={onSelectTicketFromNotification}
                adminName={currentUser.name}
              />
            </div>
          )}

          {/* Botón "+ Nuevo Ticket" */}
          <button
            type="button"
            onClick={onOpenEnqueue}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ Nuevo Ticket</span>
          </button>

          {/* Botón "Chat de Equipo" */}
          {onOpenChat && (
            <button
              type="button"
              onClick={onOpenChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-950 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-colors cursor-pointer"
              title="Chat interno de equipo"
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>Chat</span>
            </button>
          )}

          {/* Botón "Tour" */}
          {onOpenTour && (
            <button
              type="button"
              onClick={onOpenTour}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition-colors cursor-pointer"
              title="Tour guiado"
            >
              <LifeBuoy className="w-3.5 h-3.5 text-zinc-400" />
              <span>Tour</span>
            </button>
          )}

          {/* Botón "Usuarios" (solo visible para Administrador) */}
          {isSysAdmin && (
            <button
              type="button"
              onClick={onOpenUserModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-950 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 transition-colors cursor-pointer"
              title="Gestión de Cuentas y Cupos"
            >
              <Users className="w-3.5 h-3.5 text-zinc-400" />
              <span>Usuarios</span>
            </button>
          )}

          {/* Pestaña DLQ / Error */}
          {!isRequester && dlqCount > 0 && setActiveView && (
            <button
              type="button"
              onClick={() => setActiveView(activeView === 'dlq' ? 'main' : 'dlq')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                activeView === 'dlq'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  : 'bg-zinc-950 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
              <span>Con Error ({dlqCount})</span>
            </button>
          )}

          {/* Botón "Cerrar Sesión" */}
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors text-xs font-medium cursor-pointer"
            title="Cerrar Sesión"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
};
