/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EnqueueTicketInput, Severity } from './types.ts';

export const INITIAL_SEED_TICKETS: EnqueueTicketInput[] = [
  {
    title: 'Tiempo de Espera Agotado en Webhook de Pasarela de Pagos',
    description: 'El receptor de webhooks de pagos está descartando eventos con error HTTP 504. La conciliación del libro mayor está detenida.',
    tags: ['pagos', 'stripe', 'incidente-p0', 'webhooks'],
    severity: 4 as Severity,
    author: {
      id: 'usr_finops_92',
      name: 'Elena Rostova',
      department: 'Liquidaciones y Pagos',
      channel: 'MONITORING',
    },
    slaMinutes: 15,
    maxRetries: 3,
    context: {
      tasaError: '34.2%',
      pasarela: 'stripe-us-east',
      cuentasAfectadas: 1820,
    },
  },
  {
    title: 'Saturación del Pool de Conexiones de Postgres Principal',
    description: 'El pool de lectura/escritura está al 98% de capacidad. Se alcanzaron 400 conexiones máximas; la latencia de consultas subió a 850ms.',
    tags: ['base-de-datos', 'postgres', 'agotamiento-pool'],
    severity: 4 as Severity,
    author: {
      id: 'usr_dba_14',
      name: 'Marcus Chen',
      department: 'Plataforma de Datos',
      channel: 'API',
    },
    slaMinutes: 20,
    maxRetries: 3,
    context: {
      utilizacionPool: '98.4%',
      clientesActivos: 395,
      consultasLentas: 142,
    },
  },
  {
    title: 'Invalidación de Caché de Clave de Firma JWT en Auth0',
    description: 'Los nodos de cómputo están rechazando tokens válidos debido a la expiración de la clave pública RS256 en caché JWKS.',
    tags: ['seguridad', 'auth', 'jwt', 'iam'],
    severity: 3 as Severity,
    author: {
      id: 'usr_sec_09',
      name: 'Amina Al-Mansoor',
      department: 'Seguridad de Infraestructura',
      channel: 'PORTAL',
    },
    slaMinutes: 45,
    maxRetries: 3,
    context: {
      ttlCacheRestanteSeg: 0,
      tasaPeticionesRechazadas: '4.8%',
    },
  },
  {
    title: 'Tormenta de Rebalanceo en Grupo Consumidor de Kafka',
    description: 'El tópico `user.audit.events` se rebalancea continuamente por timeouts de heartbeat durante la deserialización de lotes.',
    tags: ['kafka', 'streaming', 'rebalanceo'],
    severity: 3 as Severity,
    author: {
      id: 'usr_stream_33',
      name: 'Liam Vance',
      department: 'Transmisión de Eventos',
      channel: 'SLACK',
    },
    slaMinutes: 60,
    maxRetries: 3,
    context: {
      retrasoConsumidor: 45092,
      particiones: 32,
    },
  },
  {
    title: 'Asignación de Shards Bloqueada en Clúster Frío Elasticsearch',
    description: 'Se alcanzó el umbral de disco en el nodo data-07. La rotación automática de índices de baja prioridad está en pausa.',
    tags: ['busqueda', 'elasticsearch', 'almacenamiento'],
    severity: 2 as Severity,
    author: {
      id: 'usr_sre_88',
      name: 'Sophia Lindqvist',
      department: 'Ingeniería de Confiabilidad (SRE)',
      channel: 'WEBHOOK',
    },
    slaMinutes: 180,
    maxRetries: 3,
    context: {
      usoDiscoPorcentaje: 86.4,
      shardsSinAsignar: 3,
    },
  },
  {
    title: 'Discrepancia en Sincronización de Evidencia SOC-2',
    description: 'El recolector automatizado no pudo extraer registros CloudTrail para eu-central-1 por desfase en la política IAM.',
    tags: ['cumplimiento', 'auditoria', 'soc2'],
    severity: 2 as Severity,
    author: {
      id: 'usr_grc_12',
      name: 'Carlos Mendez',
      department: 'Gobierno y Riesgo',
      channel: 'PORTAL',
    },
    slaMinutes: 360,
    maxRetries: 2,
    context: {
      marco: 'SOC2-Tipo-II',
      diasFaltantes: 2,
    },
  },
  {
    title: 'Limpieza y Purga de Caché de Recursos CDN Obsoletos',
    description: 'Purga programada de caché para paquetes estáticos del portal de mercadotecnia legado v1.',
    tags: ['cdn', 'frontend', 'mantenimiento'],
    severity: 1 as Severity,
    author: {
      id: 'usr_web_05',
      name: 'Nadia Thorne',
      department: 'Experiencia Frontend',
      channel: 'PORTAL',
    },
    slaMinutes: 1440,
    maxRetries: 3,
    context: {
      dominios: ['static.corp.internal'],
      alcance: 'coincidencia-prefijo',
    },
  },
  {
    title: 'Ajuste de Verbosidad en Agente de Telemetría (Staging)',
    description: 'Reducir nivel de registro de DEBUG a INFO en clústeres de staging para optimizar costos de ingesta en Datadog.',
    tags: ['observabilidad', 'staging', 'optimizacion-costos'],
    severity: 1 as Severity,
    author: {
      id: 'usr_fin_41',
      name: 'David Kim',
      department: 'Economía de la Nube',
      channel: 'SLACK',
    },
    slaMinutes: 1440,
    maxRetries: 3,
    context: {
      ahorroObjetivo: '$340/mes',
      clusteresAfectados: 4,
    },
  },
];
