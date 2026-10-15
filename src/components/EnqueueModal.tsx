/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import type { EnqueueTicketInput, Severity, IngestChannel, UserAccount } from '../engine/types.ts';
import { X, PlusCircle, Sparkles, UserCheck } from 'lucide-react';

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
  const [tagsInput, setTagsInput] = useState('producción, incidente, crítico');
  const [severity, setSeverity] = useState<Severity>(3);
  const [authorName, setAuthorName] = useState(currentUser.name);
  const [department, setDepartment] = useState(currentUser.department);
  const [channel, setChannel] = useState<IngestChannel>('PORTAL');
  const [slaMinutes, setSlaMinutes] = useState(60);
  const [maxRetries, setMaxRetries] = useState(3);

  // Sync author if currentUser changes
  React.useEffect(() => {
    setAuthorName(currentUser.name);
    setDepartment(currentUser.department);
  }, [currentUser]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // If requester, always bind strictly to currentUser identity
    const authorId = currentUser.role === 'requester' ? currentUser.id : `usr_${Math.floor(Math.random() * 9000 + 1000)}`;
    const finalAuthorName = currentUser.role === 'requester' ? currentUser.name : authorName.trim() || currentUser.name;
    const finalDepartment = currentUser.role === 'requester' ? currentUser.department : department.trim() || currentUser.department;

    onEnqueue({
      title: title.trim(),
      description: description.trim(),
      tags,
      severity,
      author: {
        id: authorId,
        name: finalAuthorName,
        department: finalDepartment,
        channel,
      },
      slaMinutes: Number(slaMinutes) || 60,
      maxRetries: Number(maxRetries) || 3,
    });

    onClose();
  };

  const loadPreset = (presetType: 'CRIT' | 'HIGH' | 'MED') => {
    if (presetType === 'CRIT') {
      setTitle('Pérdida de Quórum en Clúster Kubernetes Etcd');
      setDescription('Clúster Raft de Etcd degradado. Dos nodos miembros reportan pérdida de paquetes de red sobre la malla Calico CNI.');
      setTagsInput('kubernetes, etcd, p0-incidente, alta-concurrencia');
      setSeverity(4);
      setSlaMinutes(15);
    } else if (presetType === 'HIGH') {
      setTitle('Umbral de Fragmentación de Memoria Redis Excedido (1.6)');
      setDescription('El nodo de caché shard-3 saturó la CPU en desfragmentación activa. La latencia subió a 32ms.');
      setTagsInput('redis, cache, memoria, fragmentacion');
      setSeverity(3);
      setSlaMinutes(45);
    } else {
      setTitle('Demora en Sincronización Glacier del Repositorio de Snapshots');
      setDescription('La regla de ciclo de vida del bucket s3 para transición a Glacier reportó fallos de verificación.');
      setTagsInput('almacenamiento, backup, snapshots, s3');
      setSeverity(2);
      setSlaMinutes(180);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Encabezado */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold font-mono text-slate-100">
              ENCOLAR NUEVO TICKET CANÓNICO
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-mono">
          {/* Plantillas Rápidas */}
          <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Plantillas Rápidas:
            </span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => loadPreset('CRIT')}
                className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] hover:bg-rose-500/30 transition-colors"
              >
                P0 Crítico
              </button>
              <button
                type="button"
                onClick={() => loadPreset('HIGH')}
                className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] hover:bg-amber-500/30 transition-colors"
              >
                P1 Alto
              </button>
              <button
                type="button"
                onClick={() => loadPreset('MED')}
                className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] hover:bg-blue-500/30 transition-colors"
              >
                P2 Medio
              </button>
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-slate-400 font-bold mb-1">
              TÍTULO DEL INCIDENTE / ASUNTO *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Tiempo de espera agotado en ingesta de webhooks"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-slate-400 font-bold mb-1">
              DESCRIPCIÓN ESTRUCTURADA DEL PROBLEMA *
            </label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalla contexto de telemetría, códigos de error y síntomas operativos..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-sans"
            />
          </div>

          {/* Nivel de Severidad y Canal */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-bold mb-1">
                NIVEL DE SEVERIDAD
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(Number(e.target.value) as Severity)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value={4}>Severidad 4 - Crítico (P0, Base 1000 pts)</option>
                <option value={3}>Severidad 3 - Alto (P1, Base 500 pts)</option>
                <option value={2}>Severidad 2 - Medio (P2, Base 250 pts)</option>
                <option value={1}>Severidad 1 - Bajo (P3, Base 100 pts)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-1">
                CANAL DE INGESTA
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as IngestChannel)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="API">Pasarela API</option>
                <option value="WEBHOOK">Receptor de Webhooks</option>
                <option value="MONITORING">Monitoreo Automatizado</option>
                <option value="SLACK">Slack / PagerDuty</option>
                <option value="PORTAL">Portal Interno de Operaciones</option>
                <option value="EMAIL">Correo de Soporte Técnico</option>
              </select>
            </div>
          </div>

          {/* Autor y Departamento */}
          {currentUser.role === 'requester' ? (
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-400">
                  AUTOR REGISTRADO (VINCULADO A SESIÓN RBAC)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  FIRMA AUTÉNTICA @{currentUser.username}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-slate-200 font-mono">
                <span className="font-bold">{currentUser.name} ({currentUser.id})</span>
                <span className="text-slate-400">{currentUser.department}</span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-bold mb-1">
                  NOMBRE DEL CREADOR / OPERADOR
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 font-bold mb-1">
                  DEPARTAMENTO
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Etiquetas y SLA */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-bold mb-1">
                ETIQUETAS (SEPARADAS POR COMA)
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-bold mb-1">
                META DE SLA (MINUTOS)
              </label>
              <input
                type="number"
                min={5}
                max={10000}
                value={slaMinutes}
                onChange={(e) => setSlaMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Botones de Envío */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-md shadow-indigo-600/30"
            >
              Encolar Ticket [O(log N)]
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
