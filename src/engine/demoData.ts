/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EnqueueTicketInput } from './types.ts';

/**
 * Dataset inicial vacío. El sistema inicia en estado limpio con 0 tickets
 * para que los operadores y desarrolladores creen sus propios tickets en vivo.
 */
export const INITIAL_SEED_TICKETS: EnqueueTicketInput[] = [];
