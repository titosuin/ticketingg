/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import type { UserAccount, RegisterUserInput } from '../engine/types.ts';
import {
  AuthManager,
  MAX_SYSTEM_USERS_QUOTA,
  generateUltraSecurePassword,
} from '../engine/security.ts';
import { appDatabase } from '../engine/database.ts';
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  UserPlus,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface LoginScreenProps {
  authManager: AuthManager;
  onLoginSuccess: (user: UserAccount) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  authManager,
  onLoginSuccess,
}) => {
  const [tab, setTab] = useState<'login' | 'register'>('login');

  // Iniciar Sesión
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Crear Cuenta
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regDepartment, setRegDepartment] = useState('Ingeniería de Software');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  // Mensajes y Bloqueo
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  const quota = authManager.getQuota();

  // Revisar si la cuenta está bloqueada temporalmente
  useEffect(() => {
    if (!username.trim()) {
      setLockoutSeconds(0);
      return;
    }
    const cleanUser = username.trim().toLowerCase();
    const memStatus = authManager.getLockoutStatus(cleanUser);
    const dbStatus = appDatabase.getLockoutStatus(cleanUser);
    const remaining = Math.max(memStatus.remainingSeconds, dbStatus.remainingSeconds);
    setLockoutSeconds(remaining);
  }, [username, authManager]);

  // Contador de bloqueo por fuerza bruta
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          setErrorMessage(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  // Manejador de Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser) {
      setErrorMessage('Por favor introduce tu nombre de usuario.');
      return;
    }
    if (!password) {
      setErrorMessage('Por favor introduce tu contraseña.');
      return;
    }

    // Verificar bloqueo por fuerza bruta
    const memLockout = authManager.getLockoutStatus(cleanUser);
    const dbLockout = appDatabase.getLockoutStatus(cleanUser);
    if (memLockout.isLocked || dbLockout.isLocked) {
      const remaining = Math.max(memLockout.remainingSeconds, dbLockout.remainingSeconds);
      setLockoutSeconds(remaining);
      setErrorMessage(
        `Demasiados intentos fallidos. Tu cuenta ha sido bloqueada temporalmente por ${remaining} segundos por seguridad.`
      );
      return;
    }

    const user = authManager.getUserByUsername(cleanUser);
    if (!user) {
      appDatabase.recordLoginAttempt(cleanUser, false, 'Usuario no existe');
      authManager.recordLoginFailure(cleanUser);
      setErrorMessage('Usuario o contraseña incorrectos. Verifica tus datos.');
      return;
    }

    const isValid = authManager.verifyPassword(user.id, password);
    if (!isValid) {
      appDatabase.recordLoginAttempt(cleanUser, false, 'Contraseña incorrecta');
      const failResult = authManager.recordLoginFailure(cleanUser);
      if (failResult.isLocked) {
        setLockoutSeconds(failResult.remainingSeconds);
        setErrorMessage(
          `Demasiados intentos fallidos. Tu cuenta ha sido bloqueada temporalmente por ${failResult.remainingSeconds} segundos.`
        );
      } else {
        setErrorMessage(failResult.message || 'Contraseña incorrecta. Inténtalo de nuevo.');
      }
      return;
    }

    // Autenticación Exitosa
    authManager.recordLoginSuccess(cleanUser);
    appDatabase.recordLoginAttempt(cleanUser, true, 'Autenticación exitosa');
    appDatabase.saveSession(user, rememberMe);
    onLoginSuccess(user);
  };

  // Generador de contraseña segura para registro
  const handleGeneratePassword = () => {
    const pwd = generateUltraSecurePassword(18);
    setRegPassword(pwd);
  };

  // Manejador de Registro
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!regName.trim() || !regUsername.trim() || !regPassword.trim()) {
      setErrorMessage('Por favor completa todos los campos requeridos.');
      return;
    }

    try {
      const input: RegisterUserInput = {
        name: regName.trim(),
        username: regUsername.trim(),
        department: regDepartment.trim() || 'Desarrollo de Software',
        requestedRole: 'requester',
        passwordPlain: regPassword.trim(),
      };

      const created = authManager.registerUser(input, null);
      appDatabase.saveUser(created);

      setSuccessMessage('¡Cuenta creada exitosamente! Ya puedes iniciar sesión.');
      setUsername(created.username);
      setPassword(regPassword.trim());
      setTab('login');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Ocurrió un error al registrar la cuenta.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Luces de fondo decorativas */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Contenedor Principal Centrado */}
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl p-8 relative z-10">
        {/* Cabecera / Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/25 mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              AegisFlow
            </h1>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
              Enterprise
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Plataforma Segura de Tickets y Despacho Inteligente
          </p>
        </div>

        {/* Pestañas: Iniciar Sesión / Crear Cuenta */}
        <div className="flex bg-slate-950 p-1 rounded-xl mb-6 border border-slate-800/80">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              tab === 'login'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setErrorMessage(null);
            }}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              tab === 'register'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Crear Cuenta
          </button>
        </div>

        {/* Alertas de Error o Éxito */}
        {errorMessage && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-5 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <span className="leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* FORMULARIO: INICIAR SESIÓN */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Nombre de Usuario
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej: lbenitez o msilva_admin"
                  required
                  disabled={lockoutSeconds > 0}
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  required
                  disabled={lockoutSeconds > 0}
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-11 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                />
                <span className="text-xs text-slate-400">Recordar mi sesión</span>
              </label>

              {lockoutSeconds > 0 && (
                <span className="text-xs text-rose-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  Bloqueo: {lockoutSeconds}s
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={lockoutSeconds > 0}
              className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span>Iniciar Sesión</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* FORMULARIO: CREAR CUENTA */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Nombre Completo
              </label>
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Ej: Daniel Gómez"
                required
                className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Usuario
                </label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="dgomez"
                  required
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Departamento
                </label>
                <input
                  type="text"
                  value={regDepartment}
                  onChange={(e) => setRegDepartment(e.target.value)}
                  placeholder="Desarrollo Backend"
                  required
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Generar ultra segura</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Mínimo 12 caracteres (letras, núm, símbolos)"
                  required
                  className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-3.5 pr-10 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Cupo del Sistema */}
            <div className="text-[11px] text-slate-400 text-center py-1">
              Cupos del sistema: <span className="font-semibold text-slate-200">{quota.total}</span> de <span className="font-semibold text-slate-200">{MAX_SYSTEM_USERS_QUOTA}</span> utilizados
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Crear Cuenta</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
