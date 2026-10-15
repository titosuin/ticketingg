/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { UserAccount, UserRole, RegisterUserInput } from '../engine/types.ts';
import {
  AuthManager,
  SecurityViolationError,
  ADMIN_INVITE_TOKEN_SECRET,
  MAX_SYSTEM_USERS_QUOTA,
  validatePasswordSecurity,
  generateUltraSecurePassword,
} from '../engine/security.ts';
import { appDatabase } from '../engine/database.ts';
import {
  ShieldCheck,
  ShieldAlert,
  Server,
  KeyRound,
  Lock,
  UserCheck,
  Code2,
  AlertTriangle,
  Eye,
  EyeOff,
  UserPlus,
  ArrowRight,
  Zap,
  Check,
  Database,
  Clock,
} from 'lucide-react';

interface LoginScreenProps {
  authManager: AuthManager;
  onLoginSuccess: (user: UserAccount) => void;
}

// Credenciales predeterminadas para los 8 usuarios
const DEMO_CREDENTIALS: Record<string, string> = {
  msilva_admin: 'K$9#vP2!mX8@zQ7&wL4*',
  vrios_admin: 'R#5!bN8$yT1^jM9@eK3&',
  lbenitez: 'L!9#uC4$bN7@zT2^kW8*',
  sherrera: 'S#7@oF1$hE9!rR3&tY5*',
  dmorales: 'D!3^iE8#mO2$rA7@lS6*',
  cvega: 'C#8$aM1!vE9&gA2@wK4*',
  anavarro: 'A!6@nN2#vA8$rR1^oW9*',
  mcastro: 'M#2$aR8!cT4&rO9@sZ7*',
};

export const LoginScreen: React.FC<LoginScreenProps> = ({
  authManager,
  onLoginSuccess,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Login form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Register form
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regDepartment, setRegDepartment] = useState('Ingeniería de Software');
  const [regRole, setRegRole] = useState<UserRole>('requester');
  const [regPassword, setRegPassword] = useState('');
  const [regAdminToken, setRegAdminToken] = useState('');
  const [regCopied, setRegCopied] = useState(false);

  // Errors and status
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
  const [showQuickAccess, setShowQuickAccess] = useState(true);

  const users = authManager.getUsers();
  const admins = users.filter((u) => u.role === 'system_admin' || u.role === 'ticket_admin');
  const developers = users.filter((u) => u.role === 'requester');
  const quota = authManager.getQuota();

  // Monitoreo de bloqueo por fuerza bruta
  useEffect(() => {
    if (!username) return;
    const status = appDatabase.getLockoutStatus(username);
    setLockoutSeconds(status.remainingSeconds);
  }, [username]);

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Reporte de seguridad de contraseña de registro
  const regPasswordReport = useMemo(() => {
    return validatePasswordSecurity(regPassword, regUsername);
  }, [regPassword, regUsername]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser) {
      setErrorMessage('Por favor ingresa tu nombre de usuario.');
      return;
    }

    // Verificar si la cuenta está bloqueada temporalmente
    const lockout = appDatabase.getLockoutStatus(cleanUser);
    if (lockout.isLocked) {
      setLockoutSeconds(lockout.remainingSeconds);
      setErrorMessage(
        `[429 RATE_LIMIT_LOCKOUT] Múltiples intentos fallidos detectados. Por seguridad, la cuenta está bloqueada durante ${lockout.remainingSeconds}s.`
      );
      return;
    }

    const user = authManager.getUserByUsername(cleanUser);
    if (!user) {
      appDatabase.recordLoginAttempt(cleanUser, false, 'Usuario no existe');
      setErrorMessage('Credenciales inválidas. Verifica tu usuario y contraseña.');
      return;
    }

    const isValid = authManager.verifyPassword(user.id, password);
    if (!isValid) {
      appDatabase.recordLoginAttempt(cleanUser, false, 'Contraseña incorrecta');
      const updatedLockout = appDatabase.getLockoutStatus(cleanUser);
      if (updatedLockout.isLocked) {
        setLockoutSeconds(updatedLockout.remainingSeconds);
        setErrorMessage(
          `[429 RATE_LIMIT_LOCKOUT] Se superó el límite de 5 intentos fallidos. Cuenta bloqueada por 30 segundos.`
        );
      } else {
        setErrorMessage('Contraseña incorrecta. Inténtalo de nuevo.');
      }
      return;
    }

    // Login Exitoso
    appDatabase.recordLoginAttempt(cleanUser, true, 'Autenticación exitosa');
    appDatabase.saveSession(user, rememberMe);
    onLoginSuccess(user);
  };

  const handleQuickFill = (u: UserAccount) => {
    setUsername(u.username);
    const pwd = DEMO_CREDENTIALS[u.username] || 'Str0ng!P@ss2026#Sec';
    setPassword(pwd);
    setErrorMessage(null);
  };

  const handleGenerateUltraSecureRegPassword = () => {
    const ultra = generateUltraSecurePassword(20);
    setRegPassword(ultra);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(ultra).catch(() => {});
      setRegCopied(true);
      setTimeout(() => setRegCopied(false), 2500);
    }
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const input: RegisterUserInput = {
        name: regName.trim(),
        username: regUsername.trim(),
        department: regDepartment.trim(),
        requestedRole: regRole,
        passwordPlain: regPassword.trim() || undefined,
        adminInviteToken: regAdminToken.trim() || undefined,
      };

      const created = authManager.registerUser(input, null);
      appDatabase.saveUser(created);
      setSuccessMessage(`¡Cuenta @${created.username} registrada exitosamente! Inicia sesión ahora.`);
      setUsername(created.username);
      setPassword(regPassword.trim());
      setTab('login');
    } catch (err: unknown) {
      if (err instanceof SecurityViolationError) {
        setErrorMessage(`[${err.code}] ${err.message}`);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Error durante el registro.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Fondo con resplandor moderno */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-xl w-full z-10 space-y-6">
        {/* Encabezado y Marca */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-mono mb-1">
            <Server className="w-4 h-4 animate-pulse" />
            <span>SISTEMA DE DESPACHO &amp; CONTROL DE ACCESO RBAC</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono text-slate-100">
            MOTOR DE FLUJO DE TICKETS EMPRESARIAL
          </h1>
          <p className="text-xs text-slate-400 font-sans max-w-md mx-auto">
            Acceso seguro con cifrado SHA-256, protección contra ataques de fuerza bruta y políticas estrictas de Row-Level Security.
          </p>
        </div>

        {/* Tarjeta de Autenticación Principal */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 backdrop-blur-xl space-y-5">
          {/* Selector de Pestañas: Login vs Registro */}
          <div className="flex border-b border-slate-800 gap-4 text-xs font-mono">
            <button
              onClick={() => {
                setTab('login');
                setErrorMessage(null);
              }}
              className={`pb-2.5 font-bold transition-colors flex items-center gap-1.5 border-b-2 ${
                tab === 'login'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>INICIAR SESIÓN</span>
            </button>

            <button
              onClick={() => {
                setTab('register');
                setErrorMessage(null);
              }}
              className={`pb-2.5 font-bold transition-colors flex items-center gap-1.5 border-b-2 ${
                tab === 'register'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>REGISTRAR CUENTA ({quota.available} cupos libres)</span>
            </button>
          </div>

          {/* Banner de Mensajes de Error o Éxito */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold font-mono block text-rose-300">AVISO DE SEGURIDAD:</span>
                <p className="mt-0.5 text-rose-200/90 font-mono text-[11px] leading-relaxed">
                  {errorMessage}
                </p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="font-mono">{successMessage}</span>
            </div>
          )}

          {/* Formulario 1: Iniciar Sesión */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              {lockoutSeconds > 0 && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800 text-amber-300 text-xs flex items-center gap-2 font-mono">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-spin" />
                  <span>
                    Cuenta temporalmente bloqueada: espera <strong>{lockoutSeconds}s</strong> para reintentar.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 font-semibold">
                  NOMBRE DE USUARIO (@handle)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ej: msilva_admin o lbenitez"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500 placeholder-slate-600 transition-colors"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono text-slate-400 font-semibold">
                    CONTRASEÑA
                  </label>
                  <span className="text-[11px] font-mono text-slate-500">Hash SHA-256 + Salt</span>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500 placeholder-slate-600 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="flex items-center gap-2 cursor-pointer font-mono text-[11px]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-0"
                  />
                  <span>Recordar sesión en este equipo</span>
                </label>
                <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> TLS 1.3 Cifrado
                </span>
              </div>

              <button
                type="submit"
                disabled={lockoutSeconds > 0}
                className="w-full py-2.5 px-4 rounded-xl font-bold font-mono text-xs text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>INGRESAR AL SISTEMA</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* Formulario 2: Registrar Nueva Cuenta */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1 font-mono text-[11px]">
                    NOMBRE COMPLETO *
                  </label>
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Ej: Daniel Roldán"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-mono text-[11px]">
                    NOMBRE DE USUARIO (@handle) *
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                    placeholder="Ej: droldan"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-mono text-[11px]">
                    DEPARTAMENTO *
                  </label>
                  <input
                    type="text"
                    required
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    placeholder="Ej: Backend Core"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-mono text-[11px]">
                    ROL SOLICITADO *
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                  >
                    <option value="requester">requester (Desarrollador - Solo Petición)</option>
                    <option value="ticket_admin">ticket_admin (Admin de Tickets)</option>
                    <option value="system_admin">system_admin (Superadmin)</option>
                  </select>
                </div>
              </div>

              {/* Generador de Contraseña */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold text-slate-300">
                    CONTRASEÑA ULTRA SEGURA *
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateUltraSecureRegPassword}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  >
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>⚡ Generar Automática</span>
                  </button>
                </div>

                <input
                  type="text"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Mínimo 12 caracteres, mayúsculas, símbolos..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                />

                {regCopied && (
                  <p className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> ¡Copiada al portapapeles!
                  </p>
                )}

                {regPassword && (
                  <div className="text-[10px] font-mono flex items-center justify-between">
                    <span className="text-slate-400">Fortaleza:</span>
                    <span className={`font-bold ${regPasswordReport.isValid ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {regPasswordReport.level} ({regPasswordReport.score}/100)
                    </span>
                  </div>
                )}
              </div>

              {/* Token admin si pide rol elevado */}
              {(regRole === 'ticket_admin' || regRole === 'system_admin') && (
                <div>
                  <label className="block text-amber-300 mb-1 font-mono text-[11px] font-bold">
                    TOKEN DE SEGURIDAD PARA ELEVAR PRIVILEGIOS *
                  </label>
                  <input
                    type="text"
                    required
                    value={regAdminToken}
                    onChange={(e) => setRegAdminToken(e.target.value)}
                    placeholder="Token maestro (ej: ARGON-SEC-2026)"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-amber-800/60 text-amber-200 font-mono text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={quota.available <= 0}
                className="w-full py-2.5 px-4 rounded-xl font-bold font-mono text-xs text-white bg-indigo-600 hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                <span>REGISTRAR NUEVA CUENTA</span>
              </button>
            </form>
          )}

          {/* Acceso Rápido con las 8 Cuentas Sembradas */}
          <div className="pt-3 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowQuickAccess(!showQuickAccess)}
              className="w-full flex items-center justify-between text-xs font-mono text-slate-400 hover:text-slate-200 transition-colors py-1"
            >
              <span className="flex items-center gap-1.5 font-bold">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                <span>CUENTAS CORPORATIVAS (ACCESO RÁPIDO PARA PRUEBAS)</span>
              </span>
              <span className="text-[10px] text-indigo-400 underline">
                {showQuickAccess ? 'Ocultar' : 'Mostrar'}
              </span>
            </button>

            {showQuickAccess && (
              <div className="mt-3 space-y-3 animate-in fade-in duration-150">
                {/* 2 Administradores */}
                <div>
                  <span className="text-[10px] font-mono font-bold text-purple-400 block mb-1.5">
                    🛡️ 2 ADMINISTRADORES (Control del Sistema &amp; Despacho):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {admins.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => handleQuickFill(u)}
                        className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-500/30 hover:border-purple-500/60 cursor-pointer transition-all flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-200 group-hover:text-purple-300">
                            {u.name}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">@{u.username}</div>
                        </div>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {u.role === 'system_admin' ? 'SYSADMIN' : 'TICKET ADMIN'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 6 Desarrolladores */}
                <div>
                  <span className="text-[10px] font-mono font-bold text-cyan-400 block mb-1.5">
                    💻 6 DESARROLLADORES (Limitados a Solicitar Tickets):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {developers.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => handleQuickFill(u)}
                        className="p-2 rounded-lg bg-cyan-950/20 border border-cyan-500/30 hover:border-cyan-500/60 cursor-pointer transition-all group"
                      >
                        <div className="text-[11px] font-bold text-slate-200 group-hover:text-cyan-300 truncate">
                          {u.name}
                        </div>
                        <div className="text-[9px] font-mono text-slate-400">@{u.username}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Pie de Página de Seguridad */}
        <div className="text-center text-[10px] font-mono text-slate-500 flex items-center justify-center gap-4">
          <span>Base de Datos: SQLite / Persistent Storage</span>
          <span>&bull;</span>
          <span>Cupos: {quota.total} / {quota.max}</span>
          <span>&bull;</span>
          <span>Monotonic Fencing Tokens RFC 9562</span>
        </div>
      </div>
    </div>
  );
};
