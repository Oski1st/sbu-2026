import type { Leg } from '../../types/transit';

/** Describe connected LIRR legs without asserting fare rules or a verified ticket. */
export function lirrThroughTicketNote(legs: Leg[], index: number): string | undefined {
  if (legs[index]?.agency !== 'LIRR') return undefined;
  let first = index;
  let last = index;
  while (first > 0 && legs[first - 1].agency === 'LIRR' && legs[first - 1].to === legs[first].from) first--;
  while (last + 1 < legs.length && legs[last + 1].agency === 'LIRR' && legs[last].to === legs[last + 1].from) last++;
  if (first === last) return undefined;
  return `Your connected LIRR legs from ${legs[first].from} to ${legs[last].to} may share one through ticket. A train change does not mean you must buy twice. Confirm coverage with MTA before buying another ticket.`;
}
