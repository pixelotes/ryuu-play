import * as fs from 'fs';
import * as path from 'path';
import { State, Player, GamePhase, PassTurnAction, Action, Simulator,
  AddPlayerAction, InvitePlayerAction, InvitePlayerPrompt, ResolvePromptAction,
  CardManager, BotFlipMode, BotShuffleMode, AttackAction } from '@ptcg/common';
import { baseSets } from '@ptcg/sets';
import { MonteCarloAi } from './monte-carlo-ai';
import { defaultMcBotOptions } from './mc-bot';
import { McBotOptions } from './mc-bot-options';

function turnState(): State {
  const me = new Player();
  me.id = 1;
  const opponent = new Player();
  opponent.id = 2;
  const state = new State();
  state.players = [ me, opponent ];
  state.phase = GamePhase.PLAYER_TURN;
  state.activePlayer = 0;
  return state;
}

function options(overrides: Partial<McBotOptions> = {}): McBotOptions {
  return Object.assign({}, defaultMcBotOptions, overrides);
}

describe('MonteCarloAi', () => {

  it('Should fall back to SimpleTacticsAi when the search throws', () => {
    const ai = new MonteCarloAi(1, options({ cheat: true }), null);
    const sentinel = new PassTurnAction(1);
    spyOn(ai as any, 'generateCandidates').and.throwError('boom');
    const fallback = spyOn((ai as any).fallback, 'decodeNextAction').and.returnValue(sentinel);

    const action = ai.decodeNextAction(turnState());

    expect(fallback).toHaveBeenCalled();
    expect(action).toBe(sentinel);
  });

  it('Should pass the turn when even the fallback throws', () => {
    const ai = new MonteCarloAi(1, options({ cheat: false }), null);
    spyOn(ai as any, 'generateCandidates').and.throwError('boom');
    spyOn((ai as any).fallback, 'decodeNextAction').and.throwError('boom2');

    const action = ai.decodeNextAction(turnState());

    expect(action instanceof PassTurnAction).toBeTrue();
  });

  it('Should do nothing when it is not its turn', () => {
    const ai = new MonteCarloAi(2, options(), null);
    expect(ai.decodeNextAction(turnState())).toBeUndefined();
  });

  it('Should pick the candidate with the best average, spreading playouts round-robin', () => {
    const ai = new MonteCarloAi(1, options({ cheat: true, maxPlayouts: 30, timeBudgetMs: 10000 }), null);
    const weak = new AttackAction(1, 'weak');
    const strong = new AttackAction(1, 'strong');
    const pass = new PassTurnAction(1);
    spyOn(ai as any, 'generateCandidates').and.returnValue([ weak, strong, pass ]);
    const calls = new Map<Action, number>();
    let n = 0;
    spyOn(ai as any, 'playout').and.callFake((_: State, action: Action) => {
      calls.set(action, (calls.get(action) || 0) + 1);
      n++;
      const noise = (n % 3) * 10;
      return (action === strong ? 1000 : action === weak ? 500 : 0) + noise;
    });

    const action = ai.decodeNextAction(turnState());

    expect(action).toBe(strong);
    expect(calls.get(weak)).toBe(10);
    expect(calls.get(strong)).toBe(10);
    expect(calls.get(pass)).toBe(10);
    expect(ai.lastDecision && ai.lastDecision.playouts).toBe(30);
  });

  it('Should keep SimpleBot\'s choice when the alternative is within the margin, and penalize pass', () => {
    const ai = new MonteCarloAi(1, options({ cheat: true, maxPlayouts: 9, timeBudgetMs: 10000, deviationMargin: 100 }), null);
    const first = new AttackAction(1, 'first');
    const slightlyBetter = new AttackAction(1, 'slightly-better');
    const pass = new PassTurnAction(1);
    spyOn(ai as any, 'generateCandidates').and.returnValue([ first, slightlyBetter, pass ]);
    spyOn(ai as any, 'playout').and.callFake((_: State, action: Action) =>
      action === first ? 0 : action === slightlyBetter ? 50 : 500);

    expect(ai.decodeNextAction(turnState())).toBe(first);
  });

  it('Should use common random numbers across candidates of a round', () => {
    const ai = new MonteCarloAi(1, options({ cheat: true, maxPlayouts: 6, timeBudgetMs: 10000 }), null);
    const a = new AttackAction(1, 'a');
    const b = new AttackAction(1, 'b');
    spyOn(ai as any, 'generateCandidates').and.returnValue([ a, b ]);
    const draws: number[][] = [ [], [] ];
    spyOn(ai as any, 'playout').and.callFake((_: State, action: Action) => {
      draws[action === a ? 0 : 1].push(Math.random());
      return 0;
    });

    ai.decodeNextAction(turnState());

    expect(draws[0].length).toBe(3);
    expect(draws[0]).toEqual(draws[1]);
  });

  it('Should ignore candidates that are illegal in the sampled world', () => {
    const ai = new MonteCarloAi(1, options({ cheat: true, maxPlayouts: 6, timeBudgetMs: 10000 }), null);
    const illegal = new AttackAction(1, 'illegal');
    const pass = new PassTurnAction(1);
    spyOn(ai as any, 'generateCandidates').and.returnValue([ illegal, pass ]);
    spyOn(ai as any, 'playout').and.callFake((_: State, action: Action) => action === illegal ? undefined : -5);

    expect(ai.decodeNextAction(turnState())).toBe(pass);
  });

  describe('in a real game', () => {
    const root = path.resolve(__dirname, '../../..');
    const loadDeck = (name: string) => fs.readFileSync(path.join(root, 'decks', name), 'utf8')
      .split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);

    beforeAll(() => {
      const cm = CardManager.getInstance();
      if (!cm.isCardDefined('Hitmonchan BS')) {
        cm.defineFormat('Base Sets', [ baseSets.setBase, baseSets.setJungle, baseSets.setFossil, baseSets.setTeamRocket ]);
      }
    });

    [ true, false ].forEach(cheat => {
      it(`Should return a legal action on its turn (cheat=${cheat})`, () => {
        const deckA = loadDeck('haymaker.txt');
        const deckB = loadDeck('raindance.txt');
        const sim = new Simulator(new State(), { flipMode: BotFlipMode.RANDOM, shuffleMode: BotShuffleMode.RANDOM });
        sim.dispatch(new AddPlayerAction(1, 'P1', deckA));
        sim.dispatch(new InvitePlayerAction(2, 'P2'));
        const invite = sim.store.state.prompts.find(p => p instanceof InvitePlayerPrompt && p.result === undefined);
        sim.dispatch(new ResolvePromptAction((invite as InvitePlayerPrompt).id, deckB));

        const bots = [
          new MonteCarloAi(1, options({ cheat, maxPlayouts: 4, timeBudgetMs: 2000 }), deckA),
          new MonteCarloAi(2, options({ cheat, maxPlayouts: 4, timeBudgetMs: 2000 }), deckB)
        ];

        let turnDecisions = 0;
        for (let step = 0; step < 25 && sim.store.state.phase !== GamePhase.FINISHED; step++) {
          const state = sim.store.state;
          const isTurn = state.phase === GamePhase.PLAYER_TURN && !state.prompts.some(p => p.result === undefined);
          const action = bots[0].decodeNextAction(state) || bots[1].decodeNextAction(state);
          expect(action).toBeDefined();
          if (action === undefined) {
            break;
          }
          if (isTurn) {
            turnDecisions++;
          }
          expect(() => sim.dispatch(action)).not.toThrow();
        }
        expect(turnDecisions).toBeGreaterThan(0);
      });
    });
  });

});
