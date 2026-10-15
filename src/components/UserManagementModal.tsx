/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import type { UserAccount, UserRole, RegisterUserInput } from '../engine/types.ts';
import {
  AuthManager,
  SecurityViolationError,
  ADMIN_INVITE_TOKEN_SECRET,
  MAX_SYSTEM_USERS_QUOTA,
  validatePasswordSecurity,
  generateUltraSecurePassword,
} from '../engine/security.ts';
import {
  X,
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  UserPlus,
  Users,
  AlertTriangle,
  Sparkles,
  Check,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Zap,
  Gauge,
  Code2,
} from 'lucide-react';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  authManager: AuthManager;
  currentUser: UserAccount;
  onSelectUser: (user: UserAccount) => void;
  onUsersUpdated: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  authManager,
  currentUser,
  onSelectUser,
  onUsersUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'switch' | 'create'>('switch');

  // Form states
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Ingeniería de Software');
  const [requestedRole, setRequestedRole] = useState<UserRole>('requester');
  const [adminInviteToken, setAdminInviteToken] = useState('');
  const [passwordPlain, setPasswordPlain] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  // Alerts
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const quota = authManager.getQuota();
  const isQuotaFull = quota.available <= 0;

  // Evaluación en tiempo real de la contraseña
  const passwordReport = useMemo(() => {
    return validatePasswordSecurity(passwordPlain, username);
  }, [passwordPlain, username]);

  if (!isOpen) return null;

  const users = authManager.getUsers();
  const admins = users.filter((u) => u.role === 'system_admin' || u.role === 'ticket_admin');
  const developers = users.filter((u) => u.role === 'requester');

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'system_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            Administrador
          </span>
        );
      case 'ticket_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <ShieldCheck className="w-3 h-3 text-amber-400" />
            Agente de Soporte
          </span>
        );
      case 'requester':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            <Code2 className="w-3 h-3 text-cyan-400" />
            Solicitante
          </span>
        );
    }
  };

  const handleGenerateUltraSecurePassword = () => {
    const ultra = generateUltraSecurePassword(20);
    setPasswordPlain(ultra);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(ultra).catch(() => {});
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    }
  };

  const handleCreateUser = (e: React.FormEvent, forceBypassToken = false, customPassword?: string) => {
    e.preventDefault();
    setSecurityError(null);
    setSuccessMessage(null);

    const input: RegisterUserInput = {
      username: username.trim(),
      name: name.trim(),
      department: department.trim(),
      requestedRole,
      passwordPlain: customPassword !== undefined ? customPassword : (passwordPlain.trim() || undefined),
      adminInviteToken: forceBypassToken ? '' : adminInviteToken.trim(),
    };

    try {
      const created = authManager.registerUser(input, currentUser);
      onUsersUpdated();
      onSelectUser(created);
      setSuccessMessage(
        `Usuario @${created.username} (${created.name}) registrado exitosamente con rol ${created.role} y contraseña ${created.passwordLevel}. Cupo actual: ${authManager.getQuota().total}/${MAX_SYSTEM_USERS_QUOTA}.`
      );
      setUsername('');
      setName('');
      setPasswordPlain('');
      setAdminInviteToken('');
      setRequestedRole('requester');
      setActiveTab('switch');
    } catch (err: unknown) {
      if (err instanceof SecurityViolationError) {
        setSecurityError(`[${err.code}] ${err.message}`);
      } else if (err instanceof Error) {
        setSecurityError(err.message);
      } else {
        setSecurityError('Error inesperado durante el registro.');
      }
    }
  };

  // Simular Exceso de Cupos (Intentar crear más de 15 personas)
  const handleSimulateQuotaExceeded = () => {
    setSecurityError(null);
    setSuccessMessage(null);

    try {
      // Intentar llenar hasta 15 y forzar el 16
      while (authManager.getQuota().available > 0) {
        const nextIdx = authManager.getQuota().total + 1;
        authManager.registerUser({
          username: `dev_cupo_${nextIdx}`,
          name: `Desarrollador Sintético ${nextIdx}`,
          department: 'Ingeniería',
          passwordPlain: generateUltraSecurePassword(20),
        });
      }

      // Ahora intentar el usuario 16 que debe fallar
      authManager.registerUser({
        username: 'dev_overflow_16',
        name: 'Usuario 16 Fuera de Cupo',
        department: 'Ingeniería Externa',
        passwordPlain: generateUltraSecurePassword(20),
      });

      onUsersUpdated();
    } catch (err: unknown) {
      onUsersUpdated();
      if (err instanceof SecurityViolationError) {
        setSecurityError(`[${err.code}] ${err.message}`);
      } else if (err instanceof Error) {
        setSecurityError(err.message);
      }
    }
  };

  // Simular Contraseña Insegura
  const handleSimulateInsecurePassword = (e: React.FormEvent) => {
    e.preventDefault();
    handleCreateUser(e, false, '123456');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Encabezado */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-mono text-slate-100 uppercase tracking-wider flex items-center gap-2">
                <span>GESTIÓN DE IDENTIDADES &amp; DEVSECOPS RBAC</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  CUPO MÁXIMO: {MAX_SYSTEM_USERS_QUOTA}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                2 Administradores (Control Total) &bull; 6 Desarrolladores (Solo Petición de Tickets) &bull; Hashing Criptográfico SHA-256
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Cupos Corporativos del Sistema (15 Cupos) */}
        <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between gap-4 text-xs font-mono shrink-0">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-300 font-bold">CAPACIDAD DE USUARIOS:</span>
            <span className="text-slate-400">
              <strong className="text-indigo-400">{quota.total}</strong> / {quota.max} personas ({quota.available} cupos libres)
            </span>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  quota.percent >= 100
                    ? 'bg-rose-500'
                    : quota.percent >= 80
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${quota.percent}%` }}
              />
            </div>
            <span
              className={`text-[10px] font-bold ${
                quota.percent >= 100 ? 'text-rose-400' : 'text-slate-400'
              }`}
            >
              {quota.percent}%
            </span>
          </div>
        </div>

        {/* Pestañas internas */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 pt-2 gap-2 text-xs shrink-0">
          <button
            onClick={() => {
              setActiveTab('switch');
              setSecurityError(null);
            }}
            className={`flex items-center gap-2 px-3 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'switch'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Usuarios del Sistema ({users.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('create');
              setSecurityError(null);
            }}
            className={`flex items-center gap-2 px-3 py-2 border-b-2 font-medium transition-colors ${
              activeTab === 'create'
                ? 'border-indigo-500 text-indigo-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Registrar Nuevo Usuario {isQuotaFull ? '(Cupo Agotado)' : ''}</span>
          </button>
        </div>

        {/* Alertas */}
        {securityError && (
          <div className="m-4 p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-150 shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold font-mono block text-rose-300">
                BLOQUEO DE SEGURIDAD DEVSECOPS INTERCEPTADO:
              </span>
              <p className="mt-0.5 text-rose-200/90 font-mono text-[11px] leading-relaxed">
                {securityError}
              </p>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="m-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-emerald-200 text-xs flex items-center gap-2.5 animate-in fade-in duration-150 shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-mono text-emerald-300">{successMessage}</span>
          </div>
        )}

        {/* Contenido con Scroll */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Pestaña 1: Selector de Usuario Activo */}
          {activeTab === 'switch' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Selecciona una identidad para validar sus permisos en tiempo real:</span>
                <span className="font-mono text-[11px] text-slate-400">
                  Sesión Actual: <strong className="text-indigo-400">@{currentUser.username}</strong>
                </span>
              </div>

              {/* Sección 1: Administradores */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                    <span>ADMINISTRADORES ({admins.length}) &bull; CONTROL DEL SISTEMA &amp; WORKERS</span>
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">Control Total &bull; Despacho &bull; DLQ</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {admins.map((u) => {
                    const isSelected = u.id === currentUser.id;
                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          onSelectUser(u);
                          setSuccessMessage(`Sesión cambiada a @${u.username} (${u.name}) - Rol: ${u.role}.`);
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-purple-950/40 border-purple-500/60 ring-1 ring-purple-500/40'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-200">{u.name}</span>
                              <span className="text-[11px] font-mono text-slate-400">(@{u.username})</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{u.department}</p>
                          </div>
                          {isSelected && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              ACTIVO
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-[10px]">
                          {getRoleBadge(u.role)}
                          <span className="font-mono text-emerald-400 text-[9px] flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> PWD ULTRA SEGURA
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sección 2: Desarrolladores (Usuarios solicitantes) */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>DESARROLLADORES ({developers.length}) &bull; LIMITADOS A SOLICITAR TICKETS</span>
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">Row-Level Security &bull; Solo Petición</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {developers.map((u) => {
                    const isSelected = u.id === currentUser.id;
                    return (
                      <div
                        key={u.id}
                        onClick={() => {
                          onSelectUser(u);
                          setSuccessMessage(
                            `Sesión cambiada a @${u.username} (${u.name}). Vista restringida a tus propios tickets.`
                          );
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-cyan-950/40 border-cyan-500/60 ring-1 ring-cyan-500/40'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-200">{u.name}</span>
                              <span className="text-[11px] font-mono text-slate-400">(@{u.username})</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{u.department}</p>
                          </div>
                          {isSelected && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                              ACTIVO
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-800/80 pt-2 text-[10px]">
                          {getRoleBadge(u.role)}
                          <span className="font-mono text-slate-500 text-[9px]">ID: {u.id.slice(0, 10)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Botón de prueba para probar límite de 15 cupos */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">
                  Prueba de Estrés DevSecOps de Capacidad:
                </span>
                <button
                  type="button"
                  onClick={handleSimulateQuotaExceeded}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Simular Exceso de Cupos (Crear 16º Usuario)</span>
                </button>
              </div>
            </div>
          )}

          {/* Pestaña 2: Crear Cuenta / Generar Contraseña Ultra Segura */}
          {activeTab === 'create' && (
            <form onSubmit={(e) => handleCreateUser(e, false)} className="space-y-4">
              {isQuotaFull && (
                <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>
                    <strong>Cupo Corporativo Completo (15/15):</strong> El sistema ha alcanzado el límite máximo de 15 personas.
                  </span>
                </div>
              )}

              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300">
                <span className="font-bold text-slate-200 block mb-1">
                  Políticas de Seguridad &amp; Contraseñas Corporativas:
                </span>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-400 font-mono">
                  <li>Cupos del sistema limitados a un máximo estricto de 15 personas ({quota.available} cupos libres actualmente).</li>
                  <li>Contraseñas seguras obligatorias: mín. 12 caracteres, mayúsculas, minúsculas, números y símbolos especiales.</li>
                  <li>Los desarrolladores creados tendrán rol <code>requester</code> y solo podrán pedir tickets.</li>
                </ul>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-mono text-[11px]">
                    NOMBRE COMPLETO *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isQuotaFull}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Daniel Roldán"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-mono text-[11px]">
                    NOMBRE DE USUARIO (@handle) *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isQuotaFull}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                    placeholder="Ej: droldan"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-mono text-[11px]">
                    DEPARTAMENTO / ÁREA *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isQuotaFull}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Ej: Servicios Core / Backend"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-mono text-[11px]">
                    ROL SOLICITADO *
                  </label>
                  <select
                    disabled={isQuotaFull}
                    value={requestedRole}
                    onChange={(e) => setRequestedRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-mono disabled:opacity-50"
                  >
                    <option value="requester">requester (Desarrollador - Solo Petición de Tickets)</option>
                    <option value="ticket_admin">ticket_admin (Admin de Tickets &amp; Despacho)</option>
                    <option value="system_admin">system_admin (Superusuario / DevSecOps)</option>
                  </select>
                </div>
              </div>

              {/* SECCIÓN DE CONTRASEÑA ULTRA SEGURA */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-400" />
                    <label className="text-xs font-mono font-bold text-slate-200">
                      CONTRASEÑA CORPORATIVA
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateUltraSecurePassword}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 transition-all shadow-sm"
                    title="Genera una contraseña criptográficamente aleatoria de 20 caracteres con alta entropía"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>⚡ Generar Contraseña Ultra Segura</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordPlain}
                    disabled={isQuotaFull}
                    onChange={(e) => setPasswordPlain(e.target.value)}
                    placeholder="Escribe o genera una contraseña ultra segura..."
                    className="w-full px-3 py-2 pr-20 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1 rounded text-slate-400 hover:text-slate-200"
                      title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    {passwordPlain && (
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof navigator !== 'undefined' && navigator.clipboard) {
                            navigator.clipboard.writeText(passwordPlain).catch(() => {});
                            setCopiedToast(true);
                            setTimeout(() => setCopiedToast(false), 2000);
                          }
                        }}
                        className="p-1 rounded text-slate-400 hover:text-indigo-400"
                        title="Copiar contraseña"
                      >
                        {copiedToast ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                {copiedToast && (
                  <p className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> ¡Contraseña copiada al portapapeles!
                  </p>
                )}

                {/* Medidor visual de seguridad de contraseña */}
                {passwordPlain && (
                  <div className="space-y-2 pt-1 border-t border-slate-900">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">Nivel de Fortaleza:</span>
                      <span
                        className={`font-bold ${
                          passwordReport.level === 'ULTRA_SECURE'
                            ? 'text-indigo-400'
                            : passwordReport.level === 'STRONG'
                            ? 'text-emerald-400'
                            : passwordReport.level === 'MEDIUM'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {passwordReport.level} ({passwordReport.score}/100)
                      </span>
                    </div>

                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          passwordReport.level === 'ULTRA_SECURE'
                            ? 'bg-gradient-to-r from-emerald-500 to-indigo-500'
                            : passwordReport.level === 'STRONG'
                            ? 'bg-emerald-500'
                            : passwordReport.level === 'MEDIUM'
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${passwordReport.score}%` }}
                      />
                    </div>

                    {/* Checklist en tiempo real */}
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono pt-1">
                      <span className={`flex items-center gap-1 ${passwordReport.checks.minLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {passwordReport.checks.minLength ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        Mín. 12 caracteres (16+ rec.)
                      </span>
                      <span className={`flex items-center gap-1 ${passwordReport.checks.hasUpper ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {passwordReport.checks.hasUpper ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        Mayúsculas (A-Z)
                      </span>
                      <span className={`flex items-center gap-1 ${passwordReport.checks.hasLower ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {passwordReport.checks.hasLower ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        Minúsculas (a-z)
                      </span>
                      <span className={`flex items-center gap-1 ${passwordReport.checks.hasNumber ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {passwordReport.checks.hasNumber ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        Números (0-9)
                      </span>
                      <span className={`flex items-center gap-1 ${passwordReport.checks.hasSpecial ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {passwordReport.checks.hasSpecial ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        Símbolos (!@#$...)
                      </span>
                      <span className={`flex items-center gap-1 ${passwordReport.checks.noCommonWords && passwordReport.checks.noUsername ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {passwordReport.checks.noCommonWords && passwordReport.checks.noUsername ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        Sin diccionario ni usuario
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Token de Invitación Administrativa si pide admin */}
              {(requestedRole === 'ticket_admin' || requestedRole === 'system_admin') && (
                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-amber-300 font-mono font-bold text-[11px]">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>REQUIERE TOKEN DE INVITACIÓN ADMINISTRATIVA</span>
                  </div>
                  <p className="text-[11px] text-amber-200/70 font-mono">
                    Sesión activa: <span className="font-bold">@{currentUser.username} ({currentUser.role})</span>.
                    {currentUser.role === 'system_admin'
                      ? ' Tu rol de system_admin autoriza la creación sin token.'
                      : ' Ingresa el token de seguridad autorizado para elevar privilegios.'}
                  </p>

                  {currentUser.role !== 'system_admin' && (
                    <div>
                      <input
                        type="text"
                        value={adminInviteToken}
                        onChange={(e) => setAdminInviteToken(e.target.value)}
                        placeholder="Token de Seguridad (ej: ARGON-SEC-2026)"
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-amber-800/60 text-amber-200 font-mono text-xs focus:outline-none focus:border-amber-500"
                      />
                      <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
                        <span>Token maestro: <code>ARGON-SEC-2026</code></span>
                        <button
                          type="button"
                          onClick={() => setAdminInviteToken(ADMIN_INVITE_TOKEN_SECRET)}
                          className="text-amber-400 hover:text-amber-300 underline font-mono"
                        >
                          Autocompletar Token
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Botones de acción y simulación */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Botón Simular Contraseña Insegura */}
                  <button
                    type="button"
                    onClick={handleSimulateInsecurePassword}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors"
                    title="Envía una contraseña '123456' para verificar el rechazo corporativo"
                  >
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Probar Contraseña Débil (Rechazo)</span>
                  </button>

                  {/* Botón Simular Escalamiento sin token */}
                  {currentUser.role !== 'system_admin' && (requestedRole === 'ticket_admin' || requestedRole === 'system_admin') && (
                    <button
                      type="button"
                      onClick={(e) => handleCreateUser(e, true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors"
                      title="Envía sin token para verificar el rechazo de escalamiento"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      <span>Probar Escalamiento sin Token</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isQuotaFull}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white transition-colors shadow-sm"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Crear Cuenta</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
