import { State, CardList, Card, deepClone } from '@ptcg/common';

export type RandomFn = () => number;

/**
 * Returns the card lists whose content/order is unknown to `playerId`,
 * grouped by the pool they are resampled within:
 *  - own pool: own deck + own face-down prizes (we know which cards they are
 *    as a whole, but not which is where),
 *  - opponent pool: opponent hand + deck + face-down prizes.
 * Mirrors the server's StateSanitizer notion of "secret" card lists.
 */
export function getHiddenPools(state: State, playerId: number): CardList[][] {
  const pools: CardList[][] = [];
  for (const player of state.players) {
    const lists: CardList[] = [];
    if (player.id === playerId) {
      if (player.deck.isSecret) {
        lists.push(player.deck);
      }
      player.prizes.forEach(prize => { if (prize.isSecret) { lists.push(prize); } });
    } else {
      if (!player.hand.isPublic) {
        lists.push(player.hand);
      }
      if (!player.deck.isPublic) {
        lists.push(player.deck);
      }
      player.prizes.forEach(prize => { if (!prize.isPublic) { lists.push(prize); } });
    }
    pools.push(lists);
  }
  return pools;
}

function shuffle<T>(items: T[], random: RandomFn): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

/**
 * Determinization, IN PLACE: shuffles the cards of each hidden pool and
 * redeals them into the same card lists, preserving every list's size.
 * Public cards (in play, discard, revealed/face-up lists) are untouched.
 *
 * Must only be called on a private copy of the state, never on the real one.
 *
 * Limitations (kept deliberately simple):
 *  - it does not remember cards revealed earlier (e.g. by a search effect or
 *    a "look at opponent's hand" trainer); those go back to the pool,
 *  - it does not infer anything from the opponent's play (uniform sampling).
 */
export function determinizeInPlace(state: State, playerId: number, random: RandomFn = Math.random): void {
  for (const lists of getHiddenPools(state, playerId)) {
    const pool: Card[] = [];
    lists.forEach(list => pool.push(...list.cards));
    shuffle(pool, random);
    let offset = 0;
    for (const list of lists) {
      const size = list.cards.length;
      list.cards = pool.slice(offset, offset + size);
      offset += size;
    }
  }
}

/** Pure variant: returns a determinized deep copy, the input is not modified. */
export function determinize(state: State, playerId: number, random: RandomFn = Math.random): State {
  const copy: State = deepClone(state, [ Card ]);
  determinizeInPlace(copy, playerId, random);
  return copy;
}
