/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { AdminNotification } from '../engine/types.ts';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  AlertOctagon,
  MessageSquare,
  Shield,
  CheckCircle2,
  X,
} from 'lucide-react';

interface NotificationsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AdminNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onSelectTicket?: (ticketId: string) => void;
  adminName: string;
}

export const NotificationsPopover: React.FC<NotificationsPopoverProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onSelectTicket,
  adminName,
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatRelativeTime = (timestamp: number) => {
    const diffMs = Date.now() - timestamp;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `hace ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `hace ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    return `hace ${diffDays} d`;
  };

  const getIcon = (type: AdminNotification['type']) => {
    switch (type) {
      case 'CRITICAL_TICKET':
        return <AlertOctagon className="w-4 h-4 text-rose-400" />;
      case 'DLQ_ALERT':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'CHAT_MENTION':
        return <MessageSquare className="w-4 h-4 text-blue-400" />;
      case 'RESOLUTION':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'SECURITY':
      default:
        return <Shield className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <>
      {/* Backdrop invisible para cerrar al hacer clic fuera */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Cabecera del Panel */}
        <div className="px-4 py-3 border-b border-zinc-800/80 bg-zinc-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-zinc-300" />
            <h3 className="text-xs font-semibold text-zinc-100">
              Notificaciones de Administrador
            </h3>
            {unreadCount > 0 && (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {unreadCount} nuevas
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
                title="Marcar todas como leídas"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Leídas</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-zinc-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Subtítulo sobrio */}
        <div className="px-4 py-1.5 bg-zinc-900 border-b border-zinc-800/40 text-[10px] text-zinc-400">
          Supervisión operativa para <strong className="text-zinc-300">{adminName}</strong>
        </div>

        {/* Lista de Notificaciones */}
        <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/50">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-400">
              No tienes notificaciones pendientes
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  if (!n.read) onMarkAsRead(n.id);
                  if (n.ticketId && onSelectTicket) {
                    onSelectTicket(n.ticketId);
                    onClose();
                  }
                }}
                className={`p-3.5 text-xs transition-colors flex items-start gap-3 cursor-pointer ${
                  n.read
                    ? 'bg-zinc-900/60 hover:bg-zinc-800/40 text-zinc-400'
                    : 'bg-zinc-850 hover:bg-zinc-800/80 text-zinc-200 border-l-2 border-l-indigo-500'
                }`}
              >
                <div className="p-1.5 rounded-lg bg-zinc-800/90 border border-zinc-700/60 shrink-0 mt-0.5">
                  {getIcon(n.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className={`font-semibold truncate text-[11px] ${n.read ? 'text-zinc-300' : 'text-zinc-100'}`}>
                      {n.title}
                    </span>
                    <span className="text-[10px] text-zinc-400 shrink-0 font-mono">
                      {formatRelativeTime(n.timestamp)}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-400 line-clamp-2">
                    {n.message}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
