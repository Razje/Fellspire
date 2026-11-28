// Challenge levels (DESIGN.md "The world", step 11.3): a rule shown on entering. Keep
// it to the end of the last wave and the chest is gold; break it and the chest falls
// back to wood. A new rule is a new entry here, plus a line in room/challenge.ts if it
// watches something the room does not report yet.

export type ChallengeId = 'swift' | 'unscathed' | 'steadfast';

export interface ChallengeDef {
  id: ChallengeId;
  name: string; // "Swift"
  rule: (limit: number) => string; // the banner's line on entering
  // the tracker's line under the objective, while the rule still stands
  track: (s: ChallengeState) => string;
}

// What the room keeps while a challenge runs.
export interface ChallengeState {
  def: ChallengeDef;
  limit: number; // seconds for Swift, hits allowed for Unscathed, unused otherwise
  time: number; // seconds since the first wave came
  hits: number; // hits the party has taken (blocked ones do not count)
  dodges: number;
  failed: boolean;
  met: boolean;
}

// Tuning: Swift gives this many seconds, plus this many per foe in the room.
export const SWIFT = { base: 15, perFoe: 4 };
// Unscathed allows this many hits: alone, and for the whole party in co-op.
export const UNSCATHED = { solo: 3, coop: 5 };

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'swift', name: 'Swift',
    rule: (limit) => `Lay the dead to rest within ${clock(limit)}`,
    track: (s) => `- Swift: ${clock(Math.max(0, s.limit - s.time))} left`,
  },
  {
    id: 'unscathed', name: 'Unscathed',
    rule: (limit) => `Take no more than ${limit} hits`,
    track: (s) => `- Unscathed: ${s.hits}/${s.limit} hits taken`,
  },
  {
    id: 'steadfast', name: 'Steadfast',
    rule: () => 'Clear the room without dodging',
    track: () => '- Steadfast: no dodging',
  },
];

export function challenge(id: string): ChallengeDef | undefined {
  return CHALLENGES.find((c) => c.id === id);
}

// A challenge for a room with this many foes and heroes; id picks one (tests, ?challenge=).
export function newChallenge(foes: number, heroes: number, id?: string, rand: () => number = Math.random): ChallengeState {
  const def = (id && challenge(id)) || CHALLENGES[Math.floor(rand() * CHALLENGES.length)];
  const limit = def.id === 'swift' ? SWIFT.base + SWIFT.perFoe * foes
    : def.id === 'unscathed' ? (heroes > 1 ? UNSCATHED.coop : UNSCATHED.solo) : 0;
  return { def, limit, time: 0, hits: 0, dodges: 0, failed: false, met: false };
}
