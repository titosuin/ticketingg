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
  LifeBuoy,
  Lock,
  User,
  Eye,
  EyeOff,
  UserPlus,
  ArrowRight,
  AlertCircle,
  Clock,
  Shield,
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
      setErrorMessage('Introduce tu nombre de usuario.');
      return;
    }
    if (!password) {
      setErrorMessage('Introduce tu contraseña.');
      return;
    }

    if (lockoutSeconds > 0) {
      setErrorMessage(`Cuenta bloqueada temporalmente. Espera ${lockoutSeconds} segundos.`);
      return;
    }

    // Buscar usuario en base de datos o authManager
    let targetUser = authManager.getUserByUsername(cleanUser);
    if (!targetUser) {
      targetUser = appDatabase.getUserByUsername(cleanUser);
    }

    if (!targetUser) {
      const failInfo = authManager.recordLoginFailure(cleanUser);
      appDatabase.recordLoginAttempt(cleanUser, false, 'Usuario no encontrado');
      if (failInfo.isLocked) setLockoutSeconds(failInfo.remainingSeconds);
      setErrorMessage(failInfo.message || 'Usuario o contraseña incorrectos.');
      return;
    }

    // Validar contraseña
    const isValid = authManager.verifyPassword(targetUser.username, password);
    if (!isValid) {
      const failInfo = authManager.recordLoginFailure(cleanUser);
      appDatabase.recordLoginAttempt(cleanUser, false, 'Contraseña incorrecta');
      if (failInfo.isLocked) setLockoutSeconds(failInfo.remainingSeconds);
      setErrorMessage(failInfo.message || 'Usuario o contraseña incorrectos.');
      return;
    }

    // Éxito de login
    authManager.recordLoginSuccess(cleanUser);
    appDatabase.recordLoginAttempt(cleanUser, true);
    appDatabase.saveSession(targetUser, rememberMe);
    onLoginSuccess(targetUser);
  };

  // Manejador de Registro
  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const input: RegisterUserInput = {
        name: regName.trim(),
        username: regUsername.trim().toLowerCase(),
        department: regDepartment.trim(),
        passwordPlain: regPassword,
        requestedRole: 'requester',
      };

      const newUser = authManager.registerUser(input);
      appDatabase.saveUser(newUser);

      setSuccessMessage(`¡Cuenta creada exitosamente para @${newUser.username}! Ya puedes iniciar sesión.`);
      setTab('login');
      setUsername(newUser.username);
      setPassword(regPassword);
      setRegName('');
      setRegUsername('');
      setRegPassword('');
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Ocurrió un error al registrar la cuenta.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4">
      {/* Tarjeta de Inicio de Sesión */}
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl p-7">
        {/* Cabecera / Marca */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-zinc-800 border border-zinc-700/80 text-zinc-100 shadow-sm mb-3">
            <LifeBuoy className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex items-center justify-center gap-1.5 mb-0.5">
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
              AegisFlow
            </h1>
            <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60 font-medium">
              Enterprise
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Mesa de Ayuda & Despacho de Incidencias
          </p>
        </div>

        {/* Pestañas: Iniciar Sesión / Crear Cuenta */}
        <div className="flex bg-zinc-950 p-1 rounded-xl mb-5 border border-zinc-800">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setErrorMessage(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              tab === 'login'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
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
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
              tab === 'register'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* Alertas */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs flex items-start gap-2">
            <span className="leading-snug">{successMessage}</span>
          </div>
        )}

        {/* FORMULARIO: LOGIN */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Usuario
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Nombre de usuario"
                  required
                  autoFocus
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-3 pr-8 py-2 text-xs text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
                <User className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-3 pr-8 py-2 text-xs text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded bg-zinc-950 border-zinc-700 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-zinc-400">Recordar sesión</span>
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
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <span>Acceder al Sistema</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

          </form>
        )}

        {/* FORMULARIO: REGISTRO */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Nombre Completo
              </label>
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Ej: Daniel Gómez"
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Usuario
                </label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="dgomez"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Departamento
                </label>
                <input
                  type="text"
                  value={regDepartment}
                  onChange={(e) => setRegDepartment(e.target.value)}
                  placeholder="Backend"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Mínimo 12 caracteres seguros"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-3 pr-8 py-2 text-xs text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                >
                  {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="text-[11px] text-zinc-400 text-center py-1">
              Cupos utilizados: <span className="font-semibold text-zinc-200">{quota.total}</span> de <span className="font-semibold text-zinc-200">{MAX_SYSTEM_USERS_QUOTA}</span>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Crear Cuenta</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
