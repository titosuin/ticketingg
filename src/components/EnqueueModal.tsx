/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { EnqueueTicketInput, Severity, UserAccount } from '../engine/types.ts';
import { X, PlusCircle, AlertCircle } from 'lucide-react';

interface EnqueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnqueue: (input: EnqueueTicketInput) => void;
  currentUser: UserAccount;
}

export const EnqueueModal: React.FC<EnqueueModalProps> = ({
  isOpen,
  onClose,
  onEnqueue,
  currentUser,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<Severity>(2);
  const [tagsInput, setTagsInput] = useState('soporte, general');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Por favor indica el asunto del problema.');
      return;
    }
    if (!description.trim()) {
      setError('Por favor describe detalladamente el problema o solicitud.');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0);

    onEnqueue({
      title: title.trim(),
      description: description.trim(),
      tags: tags.length > 0 ? tags : ['soporte'],
      severity,
      author: {
        id: currentUser.id,
        name: currentUser.name,
        department: currentUser.department,
        channel: 'PORTAL',
      },
      slaMinutes: severity === 4 ? 30 : severity === 3 ? 60 : severity === 2 ? 120 : 240,
      maxRetries: 3,
    });

    // Limpiar formulario y cerrar
    setTitle('');
    setDescription('');
    setSeverity(2);
    setTagsInput('soporte, general');
    onClose();
  };

  const priorityOptions = [
    { value: 1 as Severity, label: 'Baja', desc: 'Consultas o mejoras menores', color: 'border-slate-700 text-slate-300' },
    { value: 2 as Severity, label: 'Media', desc: 'Problema estándar sin bloqueo total', color: 'border-blue-500/40 text-blue-300' },
    { value: 3 as Severity, label: 'Alta', desc: 'Impacto significativo en operaciones', color: 'border-amber-500/40 text-amber-300' },
    { value: 4 as Severity, label: 'Urgente', desc: 'Incidente crítico con detención de servicio', color: 'border-rose-500/40 text-rose-300' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Cabecera */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Crear Nueva Solicitud de Soporte
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Reportado por: <span className="text-slate-200 font-medium">{currentUser.name}</span> ({currentUser.department})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Asunto del Problema */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Asunto del Problema *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Error 500 al procesar pago con tarjeta"
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* 2. Descripción Detallada */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Descripción Detallada *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Explica qué sucedió, pasos para reproducir o detalles importantes para el equipo de soporte..."
              required
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
            />
          </div>

          {/* 3. Prioridad */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Prioridad
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSeverity(opt.value)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    severity === opt.value
                      ? 'bg-indigo-600/20 border-indigo-500 text-white font-semibold shadow-sm'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span className="block text-xs font-bold">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Categoría / Etiquetas */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Categoría / Etiquetas (separadas por coma)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="pagos, frontend, base-de-datos"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Enviar Solicitud</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
