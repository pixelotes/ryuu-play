import { State, Player, PokemonCard, CardList, Card } from '@ptcg/common';
import { determinize, determinizeInPlace } from './determinize';

class TestCard extends PokemonCard {
  public set = 'test';
  public name = '';
  public fullName = '';
  constructor(name: string) {
    super();
    this.name = name;
    this.fullName = name;
  }
}

function makeList(prefix: string, count: number, flags: Partial<CardList> = {}): CardList {
  const list = new CardList();
  for (let i = 0; i < count; i++) {
    list.cards.push(new TestCard(`${prefix}${i}`));
  }
  return Object.assign(list, flags);
}

function names(list: CardList): string[] {
  return list.cards.map(c => c.name);
}

describe('determinize', () => {
  let state: State;
  let me: Player;
  let opponent: Player;

  beforeEach(() => {
    me = new Player();
    me.id = 1;
    me.hand = makeList('myHand', 5);
    me.deck = makeList('myDeck', 30, { isSecret: true });
    me.discard = makeList('myDiscard', 3, { isPublic: true });
    me.prizes = [0, 1, 2, 3, 4, 5].map(i => makeList(`myPrize${i}-`, 1, { isSecret: true }));
    me.prizes[5].isSecret = false; // a face-up (known) prize

    opponent = new Player();
    opponent.id = 2;
    opponent.hand = makeList('opHand', 7);
    opponent.deck = makeList('opDeck', 30, { isSecret: true });
    opponent.discard = makeList('opDiscard', 4, { isPublic: true });
    opponent.active.pokemons = makeList('opActive', 1, { isPublic: true }) as any;
    opponent.prizes = [0, 1, 2, 3, 4, 5].map(i => makeList(`opPrize${i}-`, 1, { isSecret: true }));
    opponent.prizes[0].cards = []; // already taken
    opponent.prizes[5].isPublic = true; // revealed

    state = new State();
    state.players = [ me, opponent ];
  });

  it('Should preserve zone sizes and the set of cards in each pool', () => {
    const copy = determinize(state, me.id);
    const [cMe, cOp] = copy.players;

    expect(cMe.hand.cards.length).toBe(5);
    expect(cMe.deck.cards.length).toBe(30);
    expect(cMe.prizes.map(p => p.cards.length)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(cOp.hand.cards.length).toBe(7);
    expect(cOp.deck.cards.length).toBe(30);
    expect(cOp.prizes.map(p => p.cards.length)).toEqual([0, 1, 1, 1, 1, 1]);

    const opPool = (p: Player) => [...names(p.hand), ...names(p.deck),
      ...p.prizes.slice(0, 5).reduce((a: string[], l) => a.concat(names(l)), [])].sort();
    expect(opPool(cOp)).toEqual(opPool(opponent));

    const myPool = (p: Player) => [...names(p.deck),
      ...p.prizes.slice(0, 5).reduce((a: string[], l) => a.concat(names(l)), [])].sort();
    expect(myPool(cMe)).toEqual(myPool(me));
  });

  it('Should keep public cards and own hand untouched', () => {
    const copy = determinize(state, me.id);
    const [cMe, cOp] = copy.players;
    expect(names(cMe.hand)).toEqual(names(me.hand));
    expect(names(cMe.discard)).toEqual(names(me.discard));
    expect(names(cMe.prizes[5])).toEqual(names(me.prizes[5]));
    expect(names(cOp.discard)).toEqual(names(opponent.discard));
    expect(names(cOp.active.pokemons)).toEqual(names(opponent.active.pokemons));
    expect(names(cOp.prizes[5])).toEqual(names(opponent.prizes[5]));
  });

  it('Should change the hidden order and not modify the original state', () => {
    const before = [ names(me.deck), names(opponent.hand), names(opponent.deck) ];
    const copy = determinize(state, me.id);
    expect([ names(me.deck), names(opponent.hand), names(opponent.deck) ]).toEqual(before);

    expect(names(copy.players[0].deck)).not.toEqual(before[0]);
    expect(names(copy.players[1].deck)).not.toEqual(before[2]);
    // opponent hand is resampled from hand + deck + prizes
    expect(names(copy.players[1].hand)).not.toEqual(before[1]);
  });

  it('Should use the provided random source', () => {
    const a = determinize(state, me.id, () => 0.5);
    const b = determinize(state, me.id, () => 0.5);
    expect(names(a.players[1].hand)).toEqual(names(b.players[1].hand));
  });

  it('Should work in place', () => {
    const deck: Card[] = me.deck.cards.slice();
    determinizeInPlace(state, me.id);
    expect(me.deck.cards.length).toBe(deck.length);
    expect(names(me.deck)).not.toEqual(deck.map(c => c.name));
  });

});
