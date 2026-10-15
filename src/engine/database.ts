/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Ticket, UserAccount, TicketComment, ChatMessage, AdminNotification } from './types.ts';
import { PRESEEDED_USERS } from './security.ts';

export interface LoginAuditRecord {
  id: string;
  username: string;
  timestamp: number;
  success: boolean;
  reason?: string;
  ip?: string;
}

export interface DatabaseSnapshot {
  version: number;
  savedAt: number;
  users: UserAccount[];
  tickets: Ticket[];
  loginAudit: LoginAuditRecord[];
  chatMessages: ChatMessage[];
  notifications: AdminNotification[];
}

const STORAGE_KEY_TICKETS = 'enterprise_tickets_db_v1';
const STORAGE_KEY_USERS = 'enterprise_users_db_v1';
const STORAGE_KEY_AUDIT = 'enterprise_login_audit_v1';
const STORAGE_KEY_SESSION = 'enterprise_active_session_v1';
const STORAGE_KEY_CHAT = 'enterprise_team_chat_v1';
const STORAGE_KEY_NOTIFS = 'enterprise_admin_notifs_v1';

const now = Date.now();
const ONE_HOUR = 3600 * 1000;

/**
 * Histórico de Tickets Empresariales Pre-Sembrados
 * Incluye tickets resueltos, en proceso, en cola y DLQ con hilos de chat y auditoría.
 */
export const HISTORICAL_TICKETS_SEED: Ticket[] = [
  {
    id: '0192e4a1-0001-7000-8000-000000000001',
    state: 'COMPLETED',
    severity: 4,
    basePriorityScore: 400,
    slaDeadlineMs: now - 2 * ONE_HOUR,
    author: {
      id: 'usr_dev_05',
      name: 'Andrés Navarro',
      department: 'Servicios de Pago & Checkout',
      channel: 'PORTAL',
    },
    payload: {
      title: 'Latencia crítica en Pasarela de Pagos y microservicio Checkout',
      description: 'Alertas de NewRelic reportaron latencia superior a 1400ms y un 35% de timeouts en transacciones de tarjeta de crédito durante el pico de mediodía.',
      tags: ['pagos', 'postgres', 'checkout', 'p0'],
      context: { service: 'checkout-api', cluster: 'prod-us-east-1' },
    },
    timestamps: {
      createdAt: now - 4 * ONE_HOUR,
      enqueuedAt: now - 4 * ONE_HOUR,
      assignedAt: now - 3.8 * ONE_HOUR,
      resolvedAt: now - 2.5 * ONE_HOUR,
      lastEvictionAt: null,
      leaseExpiresAt: null,
      backoffUntil: null,
    },
    dispatchTelemetry: {
      retryCount: 0,
      maxRetries: 3,
      currentWorkerId: 'worker-1',
      leaseTtlMs: 15000,
      fencingToken: 1,
      auditTrail: [
        {
          transitionId: 'tr_01_init',
          fromState: null,
          toState: 'QUEUED',
          timestamp: now - 4 * ONE_HOUR,
          actor: 'Andrés Navarro',
          reason: 'Ticket de emergencia P0 registrado desde portal de soporte',
        },
        {
          transitionId: 'tr_01_proc',
          fromState: 'QUEUED',
          toState: 'PROCESSING',
          timestamp: now - 3.8 * ONE_HOUR,
          actor: 'Domingo (Agente 1)',
          reason: 'Adquisición de ticket mediante lease atómico de 15s con Fencing Token #1',
        },
        {
          transitionId: 'tr_01_comp',
          fromState: 'PROCESSING',
          toState: 'COMPLETED',
          timestamp: now - 2.5 * ONE_HOUR,
          actor: 'Domingo (Administrador)',
          reason: 'Solución validada y completada por Domingo. Pool ampliado y pods reiniciados.',
        },
      ],
    },
    resolutionNotes: 'Se reiniciaron los pods del Gateway de Pagos y se amplió el pool de conexiones de Postgres de 20 a 100. Latencia normalizada a < 45ms. Verificado y firmado por Domingo.',
    comments: [
      {
        id: 'cmt_01_1',
        authorId: 'usr_dev_05',
        authorName: 'Andrés Navarro',
        authorRole: 'requester',
        content: 'Detectamos timeouts del 35% en transacciones de tarjeta. Necesitamos intervención urgente en el pool de Postgres.',
        timestamp: now - 3.9 * ONE_HOUR,
      },
      {
        id: 'cmt_01_2',
        authorId: 'usr_admin_domingo',
        authorName: 'Domingo',
        authorRole: 'system_admin',
        content: 'Tomando el ticket con prioridad P0. Revisando logs y métricas de conexión en el cluster prod-us-east-1.',
        timestamp: now - 3.7 * ONE_HOUR,
      },
      {
        id: 'cmt_01_3',
        authorId: 'usr_admin_julio',
        authorName: 'Julio',
        authorRole: 'system_admin',
        content: 'Aprobado el escalado horizontal de los pods en los nodos de producción. El rebalanceo de tráfico ya inició.',
        timestamp: now - 3.2 * ONE_HOUR,
      },
      {
        id: 'cmt_01_4',
        authorId: 'usr_admin_domingo',
        authorName: 'Domingo',
        authorRole: 'system_admin',
        content: 'Pods desplegados y pool incrementado a 100 conexiones. Latencia estable en 42ms. Doy por resuelto el incidente.',
        timestamp: now - 2.5 * ONE_HOUR,
      },
    ],
  },
  {
    id: '0192e4a1-0002-7000-8000-000000000002',
    state: 'COMPLETED',
    severity: 3,
    basePriorityScore: 300,
    slaDeadlineMs: now - 3 * ONE_HOUR,
    author: {
      id: 'usr_dev_03',
      name: 'Diego Morales',
      department: 'Plataforma de Datos & ML',
      channel: 'PORTAL',
    },
    payload: {
      title: 'Falla de sincronización en réplica de lectura de PostgreSQL',
      description: 'El pipeline de analítica falló debido a un lag de replicación superior a 300 segundos en el nodo secundario us-east-1b.',
      tags: ['base-de-datos', 'postgresql', 'replicacion'],
      context: { replicaHost: 'pg-replica-02.internal' },
    },
    timestamps: {
      createdAt: now - 6 * ONE_HOUR,
      enqueuedAt: now - 6 * ONE_HOUR,
      assignedAt: now - 5.5 * ONE_HOUR,
      resolvedAt: now - 4.2 * ONE_HOUR,
      lastEvictionAt: null,
      leaseExpiresAt: null,
      backoffUntil: null,
    },
    dispatchTelemetry: {
      retryCount: 0,
      maxRetries: 3,
      currentWorkerId: 'worker-2',
      leaseTtlMs: 15000,
      fencingToken: 1,
      auditTrail: [
        {
          transitionId: 'tr_02_init',
          fromState: null,
          toState: 'QUEUED',
          timestamp: now - 6 * ONE_HOUR,
          actor: 'Diego Morales',
          reason: 'Ticket registrado por alerta de lag de datos',
        },
        {
          transitionId: 'tr_02_proc',
          fromState: 'QUEUED',
          toState: 'PROCESSING',
          timestamp: now - 5.5 * ONE_HOUR,
          actor: 'Julio (Agente 2)',
          reason: 'Adquisición de ticket por lease atómico',
        },
        {
          transitionId: 'tr_02_comp',
          fromState: 'PROCESSING',
          toState: 'COMPLETED',
          timestamp: now - 4.2 * ONE_HOUR,
          actor: 'Julio (Administrador)',
          reason: 'Rebalanceo de WAL segments completado con éxito',
        },
      ],
    },
    resolutionNotes: 'Rebalanceo de segmentos WAL y reactivación del stream de replicación hacia el nodo secundario. Resuelto y firmado por Julio.',
    comments: [
      {
        id: 'cmt_02_1',
        authorId: 'usr_dev_03',
        authorName: 'Diego Morales',
        authorRole: 'requester',
        content: 'Los reportes financieros de la mañana están desfasados por el lag de réplica.',
        timestamp: now - 5.8 * ONE_HOUR,
      },
      {
        id: 'cmt_02_2',
        authorId: 'usr_admin_julio',
        authorName: 'Julio',
        authorRole: 'system_admin',
        content: 'Identificado: el backup nocturno saturó el stream. Limpiando buffers y sincronizando WAL.',
        timestamp: now - 5.1 * ONE_HOUR,
      },
      {
        id: 'cmt_02_3',
        authorId: 'usr_admin_julio',
        authorName: 'Julio',
        authorRole: 'system_admin',
        content: 'Replicación al día con lag inferior a 0.2 segundos. Pipeline reanudado.',
        timestamp: now - 4.2 * ONE_HOUR,
      },
    ],
  },
  {
    id: '0192e4a1-0003-7000-8000-000000000003',
    state: 'COMPLETED',
    severity: 2,
    basePriorityScore: 200,
    slaDeadlineMs: now - 5 * ONE_HOUR,
    author: {
      id: 'usr_dev_04',
      name: 'Camila Vega',
      department: 'Cloud & Infraestructura Platform',
      channel: 'PORTAL',
    },
    payload: {
      title: 'Renovación de Certificados SSL Wildcard para dominios internos',
      description: 'El certificado *.internal.aegisflow.corp vence en 48 horas según el escaneo de seguridad.',
      tags: ['seguridad', 'ssl', 'certificados'],
    },
    timestamps: {
      createdAt: now - 12 * ONE_HOUR,
      enqueuedAt: now - 12 * ONE_HOUR,
      assignedAt: now - 10 * ONE_HOUR,
      resolvedAt: now - 9 * ONE_HOUR,
      lastEvictionAt: null,
      leaseExpiresAt: null,
      backoffUntil: null,
    },
    dispatchTelemetry: {
      retryCount: 0,
      maxRetries: 3,
      currentWorkerId: 'worker-3',
      leaseTtlMs: 15000,
      fencingToken: 1,
      auditTrail: [
        {
          transitionId: 'tr_03_init',
          fromState: null,
          toState: 'QUEUED',
          timestamp: now - 12 * ONE_HOUR,
          actor: 'Camila Vega',
          reason: 'Ticket de mantenimiento preventivo',
        },
        {
          transitionId: 'tr_03_comp',
          fromState: 'PROCESSING',
          toState: 'COMPLETED',
          timestamp: now - 9 * ONE_HOUR,
          actor: 'Valeria Ríos',
          reason: 'Certificados Let\'s Encrypt renovados mediante cert-manager',
        },
      ],
    },
    resolutionNotes: 'Certificados Let\'s Encrypt renovados mediante cert-manager con desafío DNS Cloudflare.',
  },
  {
    id: '0192e4a1-0004-7000-8000-000000000004',
    state: 'PROCESSING',
    severity: 3,
    basePriorityScore: 300,
    slaDeadlineMs: now + 4 * ONE_HOUR,
    author: {
      id: 'usr_dev_01',
      name: 'Lucas Benítez',
      department: 'Ingeniería Backend (APIs)',
      channel: 'PORTAL',
    },
    payload: {
      title: 'Monitoreo de saturación de CPU en cluster de ingestión Kafka',
      description: 'El broker 3 de Kafka está al 88% de CPU sostenido desde hace 40 minutos con acumulación de offset en el tópico de eventos.',
      tags: ['kafka', 'infraestructura', 'cpu'],
      context: { topic: 'telemetry.events.raw', broker: 'kafka-03' },
    },
    timestamps: {
      createdAt: now - 45 * 60 * 1000,
      enqueuedAt: now - 45 * 60 * 1000,
      assignedAt: now - 15 * 60 * 1000,
      resolvedAt: null,
      lastEvictionAt: null,
      leaseExpiresAt: now + 12000,
      backoffUntil: null,
    },
    dispatchTelemetry: {
      retryCount: 0,
      maxRetries: 3,
      currentWorkerId: 'worker-1',
      leaseTtlMs: 15000,
      fencingToken: 2,
      auditTrail: [
        {
          transitionId: 'tr_04_init',
          fromState: null,
          toState: 'QUEUED',
          timestamp: now - 45 * 60 * 1000,
          actor: 'Lucas Benítez',
          reason: 'Registro de saturación de CPU',
        },
        {
          transitionId: 'tr_04_proc',
          fromState: 'QUEUED',
          toState: 'PROCESSING',
          timestamp: now - 15 * 60 * 1000,
          actor: 'Domingo (Agente 1)',
          reason: 'Asignación activa para diagnóstico de particiones',
        },
      ],
    },
    comments: [
      {
        id: 'cmt_04_1',
        authorId: 'usr_dev_01',
        authorName: 'Lucas Benítez',
        authorRole: 'requester',
        content: 'El consumer lag está aumentando rápidamente en telemetry.events.raw.',
        timestamp: now - 40 * 60 * 1000,
      },
      {
        id: 'cmt_04_2',
        authorId: 'usr_admin_domingo',
        authorName: 'Domingo',
        authorRole: 'system_admin',
        content: 'Atendiendo este ticket. Voy a rebalancear las particiones hacia los brokers 1 y 2 para distribuir la carga.',
        timestamp: now - 10 * 60 * 1000,
      },
    ],
  },
  {
    id: '0192e4a1-0005-7000-8000-000000000005',
    state: 'QUEUED',
    severity: 4,
    basePriorityScore: 400,
    slaDeadlineMs: now + 2 * ONE_HOUR,
    author: {
      id: 'usr_dev_02',
      name: 'Sofía Herrera',
      department: 'Ingeniería Frontend & UI',
      channel: 'PORTAL',
    },
    payload: {
      title: 'Revisión de Fencing Tokens por sospecha de Split-Brain en Redis Sentinel',
      description: 'Se registraron excepciones de token desfasado durante el failover de Redis en el microservicio de autenticación de sesiones.',
      tags: ['redis', 'fencing-token', 'alta-disponibilidad'],
      context: { sentinelMaster: 'redis-node-01' },
    },
    timestamps: {
      createdAt: now - 20 * 60 * 1000,
      enqueuedAt: now - 20 * 60 * 1000,
      assignedAt: null,
      resolvedAt: null,
      lastEvictionAt: null,
      leaseExpiresAt: null,
      backoffUntil: null,
    },
    dispatchTelemetry: {
      retryCount: 0,
      maxRetries: 3,
      currentWorkerId: null,
      leaseTtlMs: 15000,
      fencingToken: 0,
      auditTrail: [
        {
          transitionId: 'tr_05_init',
          fromState: null,
          toState: 'QUEUED',
          timestamp: now - 20 * 60 * 1000,
          actor: 'Sofía Herrera',
          reason: 'Ticket encolado con prioridad Urgente P0',
        },
      ],
    },
    comments: [
      {
        id: 'cmt_05_1',
        authorId: 'usr_dev_02',
        authorName: 'Sofía Herrera',
        authorRole: 'requester',
        content: 'Dejo el ticket encolado para que el equipo de guardia lo tome en cuanto haya disponibilidad.',
        timestamp: now - 18 * 60 * 1000,
      },
      {
        id: 'cmt_05_2',
        authorId: 'usr_admin_julio',
        authorName: 'Julio',
        authorRole: 'system_admin',
        content: 'Recibido Sofía. Está en la cabecera de la cola de atención como P0 prioritario.',
        timestamp: now - 12 * 60 * 1000,
      },
    ],
  },
  {
    id: '0192e4a1-0006-7000-8000-000000000006',
    state: 'QUEUED',
    severity: 1,
    basePriorityScore: 100,
    slaDeadlineMs: now + 24 * ONE_HOUR,
    author: {
      id: 'usr_dev_06',
      name: 'Mariana Castro',
      department: 'QA & Automatización de Pruebas',
      channel: 'PORTAL',
    },
    payload: {
      title: 'Optimización de consultas SQL en reporte de facturación mensual',
      description: 'La exportación mensual tarda más de 45 segundos. Se requiere crear índices compuestos en created_at y account_id.',
      tags: ['sql', 'optimizacion', 'qa'],
    },
    timestamps: {
      createdAt: now - 10 * 60 * 1000,
      enqueuedAt: now - 10 * 60 * 1000,
      assignedAt: null,
      resolvedAt: null,
      lastEvictionAt: null,
      leaseExpiresAt: null,
      backoffUntil: null,
    },
    dispatchTelemetry: {
      retryCount: 0,
      maxRetries: 3,
      currentWorkerId: null,
      leaseTtlMs: 15000,
      fencingToken: 0,
      auditTrail: [
        {
          transitionId: 'tr_06_init',
          fromState: null,
          toState: 'QUEUED',
          timestamp: now - 10 * 60 * 1000,
          actor: 'Mariana Castro',
          reason: 'Solicitud de mejora de base de datos P3',
        },
      ],
    },
  },
  {
    id: '0192e4a1-0007-7000-8000-000000000007',
    state: 'DEAD_LETTER',
    severity: 3,
    basePriorityScore: 300,
    slaDeadlineMs: now - 1 * ONE_HOUR,
    author: {
      id: 'usr_dev_05',
      name: 'Andrés Navarro',
      department: 'Servicios de Pago & Checkout',
      channel: 'WEBHOOK',
    },
    payload: {
      title: 'Fallo en Webhook de Facturación Externa tras 3 reintentos',
      description: 'El endpoint del proveedor de facturación devolvió HTTP 503 continuo. El ticket superó los 3 reintentos y fue enrutado a la cola DLQ para análisis forense.',
      tags: ['webhook', 'dlq', 'error'],
      context: { endpoint: 'https://api.billing-partner.com/v2/events' },
    },
    timestamps: {
      createdAt: now - 3 * ONE_HOUR,
      enqueuedAt: now - 3 * ONE_HOUR,
      assignedAt: now - 2.5 * ONE_HOUR,
      resolvedAt: null,
      lastEvictionAt: null,
      leaseExpiresAt: null,
      backoffUntil: null,
    },
    dispatchTelemetry: {
      retryCount: 3,
      maxRetries: 3,
      currentWorkerId: null,
      leaseTtlMs: 15000,
      fencingToken: 3,
      auditTrail: [
        {
          transitionId: 'tr_07_init',
          fromState: null,
          toState: 'QUEUED',
          timestamp: now - 3 * ONE_HOUR,
          actor: 'Webhook Ingest',
          reason: 'Ingreso inicial',
        },
        {
          transitionId: 'tr_07_dlq',
          fromState: 'PROCESSING',
          toState: 'DEAD_LETTER',
          timestamp: now - 1.8 * ONE_HOUR,
          actor: 'SYSTEM_DLQ_ROUTER',
          reason: 'Excedido umbral máximo de 3 reintentos. Error: HTTP 503 Service Unavailable timeout [REDACTED_SECRET]',
        },
      ],
    },
    failureReason: 'HTTP 503 Service Unavailable continuo tras 3 reintentos con backoff exponencial. Se sanitizaron credenciales de Postgres y JWT.',
  },
];

/**
 * Mensajes Históricos del Chat de Equipo
 */
export const HISTORICAL_CHAT_MESSAGES_SEED: ChatMessage[] = [
  {
    id: 'msg_01',
    senderId: 'usr_admin_julio',
    senderName: 'Julio',
    senderRole: 'system_admin',
    channelId: 'general',
    content: 'Buenos días equipo. Domingo y yo estamos supervisando la operación y despacho de tickets en AegisFlow.',
    timestamp: now - 3.5 * ONE_HOUR,
  },
  {
    id: 'msg_02',
    senderId: 'usr_admin_domingo',
    senderName: 'Domingo',
    senderRole: 'system_admin',
    channelId: 'general',
    content: 'Confirmado Julio. El motor de despacho está activo con leases de 15 segundos y colas de prioridad sin inanición.',
    timestamp: now - 3.4 * ONE_HOUR,
  },
  {
    id: 'msg_03',
    senderId: 'usr_dev_01',
    senderName: 'Lucas Benítez',
    senderRole: 'requester',
    channelId: 'general',
    content: 'Dejé un ticket P1 por una sobrecarga de CPU en Kafka broker 3. ¿Podrán darle una mirada?',
    timestamp: now - 42 * 60 * 1000,
  },
  {
    id: 'msg_04',
    senderId: 'usr_admin_domingo',
    senderName: 'Domingo',
    senderRole: 'system_admin',
    channelId: 'general',
    content: 'Recibido Lucas, ya tomé el ticket con el Agente 1 y estoy rebalanceando particiones.',
    timestamp: now - 11 * 60 * 1000,
  },
  {
    id: 'msg_05',
    senderId: 'usr_admin_julio',
    senderName: 'Julio',
    senderRole: 'system_admin',
    channelId: 'incidentes',
    content: 'Canal de Incidentes Críticos activo. El incidente P0 de la pasarela de pagos quedó resuelto al 100%.',
    timestamp: now - 2.4 * ONE_HOUR,
  },
  {
    id: 'msg_06',
    senderId: 'usr_dev_05',
    senderName: 'Andrés Navarro',
    senderRole: 'requester',
    channelId: 'incidentes',
    content: 'Confirmado por aquí, el throughput de tarjetas de crédito se normalizó por completo. ¡Gracias Julio y Domingo!',
    timestamp: now - 2.3 * ONE_HOUR,
  },
];

/**
 * Notificaciones Iniciales para los Administradores (Julio y Domingo)
 */
export const HISTORICAL_ADMIN_NOTIFS_SEED: AdminNotification[] = [
  {
    id: 'notif_01',
    recipientUsername: 'domingo',
    type: 'CRITICAL_TICKET',
    title: 'Nuevo Incidente P0 Encolado',
    message: 'Sofía Herrera encoló: "Revisión de Fencing Tokens por sospecha de Split-Brain en Redis Sentinel".',
    timestamp: now - 18 * 60 * 1000,
    read: false,
    ticketId: '0192e4a1-0005-7000-8000-000000000005',
  },
  {
    id: 'notif_02',
    recipientUsername: 'domingo',
    type: 'CHAT_MENTION',
    title: 'Mención en Canal #general',
    message: 'Lucas Benítez te mencionó: "@domingo ¿podrán darle una mirada al lag de Kafka broker 3?".',
    timestamp: now - 35 * 60 * 1000,
    read: false,
    channelId: 'general',
  },
  {
    id: 'notif_03',
    recipientUsername: 'julio',
    type: 'RESOLUTION',
    title: 'Incidente P0 Validado con Éxito',
    message: 'Andrés Navarro confirmó resolución: El throughput del Gateway de Pagos está 100% normalizado.',
    timestamp: now - 2.5 * ONE_HOUR,
    read: false,
    ticketId: '0192e4a1-0001-7000-8000-000000000001',
  },
  {
    id: 'notif_04',
    recipientUsername: 'all_admins',
    type: 'DLQ_ALERT',
    title: 'Ticket enrutado a Dead Letter Queue (DLQ)',
    message: 'El ticket #0007 ("Fallo en Webhook de Facturación") superó los 3 reintentos y fue enrutado a DLQ.',
    timestamp: now - 1.8 * ONE_HOUR,
    read: false,
    ticketId: '0192e4a1-0007-7000-8000-000000000007',
  },
  {
    id: 'notif_05',
    recipientUsername: 'all_admins',
    type: 'SECURITY',
    title: 'Cupos del Sistema',
    message: '10 de 15 cupos corporativos en uso. Quedan 5 cupos disponibles en el sistema.',
    timestamp: now - 5 * ONE_HOUR,
    read: true,
  },
];

/**
 * Capa de Base de Datos y Persistencia Empresarial de AegisFlow
 */
export class DatabaseManager {
  private memoryTickets: Map<string, Ticket> = new Map();
  private memoryUsers: Map<string, UserAccount> = new Map();
  private memoryLoginAudit: LoginAuditRecord[] = [];
  private memoryChatMessages: ChatMessage[] = [];
  private memoryNotifications: AdminNotification[] = [];
  private isBrowser: boolean;

  constructor() {
    this.isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    this.initialize();
  }

  private initialize(): void {
    if (this.isBrowser) {
      try {
        // 1. Cargar Usuarios
        const storedUsers = localStorage.getItem(STORAGE_KEY_USERS);
        if (storedUsers) {
          const parsed: UserAccount[] = JSON.parse(storedUsers);
          for (const u of parsed) {
            this.memoryUsers.set(u.id, u);
          }
        }
        // Asegurar que Julio, Domingo y todos los usuarios pre-sembrados existan siempre
        for (const u of PRESEEDED_USERS) {
          if (!this.memoryUsers.has(u.id)) {
            this.memoryUsers.set(u.id, { ...u });
          }
        }
        this.persistUsers();

        // 2. Cargar Tickets e Histórico
        const storedTickets = localStorage.getItem(STORAGE_KEY_TICKETS);
        if (storedTickets) {
          const parsed: Ticket[] = JSON.parse(storedTickets);
          for (const t of parsed) {
            this.memoryTickets.set(t.id, t);
          }
        }
        // Si no hay tickets almacenados, sembrar el histórico predeterminado
        if (this.memoryTickets.size === 0) {
          for (const t of HISTORICAL_TICKETS_SEED) {
            this.memoryTickets.set(t.id, { ...t });
          }
          this.persistTickets();
        }

        // 3. Cargar Chat de Equipo
        const storedChat = localStorage.getItem(STORAGE_KEY_CHAT);
        if (storedChat) {
          this.memoryChatMessages = JSON.parse(storedChat);
        } else {
          this.memoryChatMessages = [...HISTORICAL_CHAT_MESSAGES_SEED];
          this.persistChat();
        }

        // 4. Cargar Notificaciones de Administradores
        const storedNotifs = localStorage.getItem(STORAGE_KEY_NOTIFS);
        if (storedNotifs) {
          this.memoryNotifications = JSON.parse(storedNotifs);
        } else {
          this.memoryNotifications = [...HISTORICAL_ADMIN_NOTIFS_SEED];
          this.persistNotifications();
        }

        // 5. Cargar Auditoría de Logins
        const storedAudit = localStorage.getItem(STORAGE_KEY_AUDIT);
        if (storedAudit) {
          this.memoryLoginAudit = JSON.parse(storedAudit);
        }
      } catch (err) {
        console.error('Error al inicializar la base de datos persistente:', err);
      }
    } else {
      // Entorno Node (Tests o CLI)
      for (const u of PRESEEDED_USERS) {
        this.memoryUsers.set(u.id, { ...u });
      }
      for (const t of HISTORICAL_TICKETS_SEED) {
        this.memoryTickets.set(t.id, { ...t });
      }
      this.memoryChatMessages = [...HISTORICAL_CHAT_MESSAGES_SEED];
      this.memoryNotifications = [...HISTORICAL_ADMIN_NOTIFS_SEED];
    }
  }

  // --- MÉTODOS DE TICKETS ---

  public getAllTickets(): Ticket[] {
    return Array.from(this.memoryTickets.values());
  }

  public getTicketById(id: string): Ticket | undefined {
    return this.memoryTickets.get(id);
  }

  public saveTicket(ticket: Ticket): void {
    this.memoryTickets.set(ticket.id, { ...ticket });
    this.persistTickets();
  }

  public saveTicketsBatch(tickets: Ticket[]): void {
    for (const t of tickets) {
      this.memoryTickets.set(t.id, { ...t });
    }
    this.persistTickets();
  }

  public addTicketComment(ticketId: string, comment: TicketComment): Ticket | null {
    const ticket = this.memoryTickets.get(ticketId);
    if (!ticket) return null;
    const comments = ticket.comments ? [...ticket.comments, comment] : [comment];
    const updated: Ticket = { ...ticket, comments };
    this.memoryTickets.set(ticketId, updated);
    this.persistTickets();
    return updated;
  }

  public deleteTicket(id: string): boolean {
    const deleted = this.memoryTickets.delete(id);
    if (deleted) this.persistTickets();
    return deleted;
  }

  public clearAllTickets(): void {
    this.memoryTickets.clear();
    this.persistTickets();
  }

  private persistTickets(): void {
    if (!this.isBrowser) return;
    try {
      const arr = Array.from(this.memoryTickets.values());
      localStorage.setItem(STORAGE_KEY_TICKETS, JSON.stringify(arr));
    } catch (err) {
      console.warn('Fallo al sincronizar tickets con la base de datos:', err);
    }
  }

  // --- MÉTODOS DE CHAT DE EQUIPO ---

  public getChatMessages(channelId = 'general'): ChatMessage[] {
    return this.memoryChatMessages.filter((m) => m.channelId === channelId);
  }

  public getAllChatMessages(): ChatMessage[] {
    return [...this.memoryChatMessages];
  }

  public saveChatMessage(msg: ChatMessage): void {
    this.memoryChatMessages.push(msg);
    this.persistChat();
  }

  private persistChat(): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify(this.memoryChatMessages));
    } catch (err) {
      console.warn('Fallo al sincronizar chat:', err);
    }
  }

  // --- MÉTODOS DE NOTIFICACIONES PARA ADMINISTRADORES ---

  public getAdminNotifications(username: string): AdminNotification[] {
    const clean = username.trim().toLowerCase();
    const isJulio = clean === 'julio' || clean === 'julio_admin';
    const isDomingo = clean === 'domingo' || clean === 'domingo_admin';

    return this.memoryNotifications
      .filter((n) => {
        if (n.recipientUsername === 'all_admins') return true;
        if (isJulio && n.recipientUsername === 'julio') return true;
        if (isDomingo && n.recipientUsername === 'domingo') return true;
        return n.recipientUsername === clean;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  public markNotificationAsRead(id: string): void {
    const notif = this.memoryNotifications.find((n) => n.id === id);
    if (notif) {
      notif.read = true;
      this.persistNotifications();
    }
  }

  public markAllNotificationsAsRead(username: string): void {
    const notifs = this.getAdminNotifications(username);
    for (const n of notifs) {
      n.read = true;
    }
    this.persistNotifications();
  }

  public addAdminNotification(notif: AdminNotification): void {
    this.memoryNotifications.unshift(notif);
    this.persistNotifications();
  }

  private persistNotifications(): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(STORAGE_KEY_NOTIFS, JSON.stringify(this.memoryNotifications));
    } catch (err) {
      console.warn('Fallo al sincronizar notificaciones:', err);
    }
  }

  // --- MÉTODOS DE USUARIOS ---

  public getAllUsers(): UserAccount[] {
    return Array.from(this.memoryUsers.values());
  }

  public getUserById(id: string): UserAccount | undefined {
    return this.memoryUsers.get(id);
  }

  public getUserByUsername(username: string): UserAccount | undefined {
    const clean = username.trim().toLowerCase();
    const found = Array.from(this.memoryUsers.values()).find(
      (u) => u.username.toLowerCase() === clean
    );
    if (found) return { ...found };
    if (clean === 'julio_admin') {
      return Array.from(this.memoryUsers.values()).find((u) => u.username === 'julio');
    }
    if (clean === 'domingo_admin') {
      return Array.from(this.memoryUsers.values()).find((u) => u.username === 'domingo');
    }
    return undefined;
  }

  public saveUser(user: UserAccount): void {
    this.memoryUsers.set(user.id, { ...user });
    this.persistUsers();
  }

  public resetUsersToSeed(): void {
    this.memoryUsers.clear();
    for (const u of PRESEEDED_USERS) {
      this.memoryUsers.set(u.id, { ...u });
    }
    this.persistUsers();
  }

  private persistUsers(): void {
    if (!this.isBrowser) return;
    try {
      const arr = Array.from(this.memoryUsers.values());
      localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(arr));
    } catch (err) {
      console.warn('Fallo al sincronizar usuarios con la base de datos:', err);
    }
  }

  // --- MÉTODOS DE SEGURIDAD Y LOGIN ---

  public recordLoginAttempt(username: string, success: boolean, reason?: string): void {
    const record: LoginAuditRecord = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      username: username.trim().toLowerCase(),
      timestamp: Date.now(),
      success,
      reason,
    };
    this.memoryLoginAudit.push(record);
    if (this.memoryLoginAudit.length > 500) {
      this.memoryLoginAudit = this.memoryLoginAudit.slice(-500);
    }

    if (this.isBrowser) {
      try {
        localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(this.memoryLoginAudit));
      } catch {
        // Ignore quota
      }
    }
  }

  public getLockoutStatus(username: string): { isLocked: boolean; remainingSeconds: number } {
    const clean = username.trim().toLowerCase();
    const nowTime = Date.now();
    const windowMs = 60_000;
    const lockoutDurationMs = 60_000;

    const recentAttempts = this.memoryLoginAudit.filter(
      (a) => a.username === clean && nowTime - a.timestamp <= windowMs + lockoutDurationMs
    );

    let consecutiveFails = 0;
    let lastFailTime = 0;

    for (let i = recentAttempts.length - 1; i >= 0; i--) {
      const att = recentAttempts[i];
      if (!att.success) {
        consecutiveFails++;
        if (lastFailTime === 0) lastFailTime = att.timestamp;
      } else {
        break;
      }
    }

    if (consecutiveFails >= 5 && nowTime - lastFailTime < lockoutDurationMs) {
      const remaining = Math.ceil((lockoutDurationMs - (nowTime - lastFailTime)) / 1000);
      return { isLocked: true, remainingSeconds: Math.max(1, remaining) };
    }

    return { isLocked: false, remainingSeconds: 0 };
  }

  // --- GESTIÓN DE SESIÓN ACTIVA ---

  public getSavedSession(): UserAccount | null {
    if (!this.isBrowser) return null;
    try {
      const str = sessionStorage.getItem(STORAGE_KEY_SESSION) || localStorage.getItem(STORAGE_KEY_SESSION);
      if (!str) return null;
      const parsed: UserAccount = JSON.parse(str);
      const exists = this.getUserById(parsed.id) || this.getUserByUsername(parsed.username);
      return exists ? { ...exists } : null;
    } catch {
      return null;
    }
  }

  public saveSession(user: UserAccount, rememberMe = true): void {
    if (!this.isBrowser) return;
    try {
      const serialized = JSON.stringify(user);
      sessionStorage.setItem(STORAGE_KEY_SESSION, serialized);
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY_SESSION, serialized);
      }
    } catch (err) {
      console.warn('Error al guardar sesión:', err);
    }
  }

  public clearSession(): void {
    if (!this.isBrowser) return;
    sessionStorage.removeItem(STORAGE_KEY_SESSION);
    localStorage.removeItem(STORAGE_KEY_SESSION);
  }

  public exportDatabase(): DatabaseSnapshot {
    return {
      version: 1,
      savedAt: Date.now(),
      users: this.getAllUsers(),
      tickets: this.getAllTickets(),
      loginAudit: this.memoryLoginAudit,
      chatMessages: this.getAllChatMessages(),
      notifications: [...this.memoryNotifications],
    };
  }
}

export const appDatabase = new DatabaseManager();
