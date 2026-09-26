import { Action, BotAi, Card, deepClone, BotFlipMode, BotShuffleMode, GamePhase, GameWinner,
  PassTurnAction, Player, State, Simulator } from '@ptcg/common';
import { SimpleTactic, SimpleTacticsAi, StateScore } from '@ptcg/simple-bot';
import { McBotOptions } from './mc-bot-options';
import { determinize, determinizeInPlace } from './determinize';
import { withSeededRandom } from './seeded-random';

export interface CandidateStats {
  action: Action;
  total: number;
  playouts: number;
}

export interface McDecisionInfo {
  candidates: number;
  playouts: number;
  elapsedMs: number;
  /** Average score per candidate (NaN = not evaluated / illegal). */
  averages: number[];
  /** Index of the chosen candidate (0 = SimpleBot's own choice). */
  chosen: number;
}

/**
 * Flat Monte Carlo bot.
 *
 * On its turn it generates the same candidate actions SimpleBot considers
 * (the action proposed by every simple tactic, plus "pass turn"), then runs
 * playouts round-robin across candidates within a time budget. A playout
 * dispatches the candidate on a cloned Simulator (random coin flips and
 * shuffles) and lets SimpleTacticsAi drive both players until the horizon;
 * the final state is scored with simple-bot's StateScore from our side
 * (plus a big bonus/penalty for a win/loss). The best average wins.
 *
 * Prompts (choices in the middle of an action) are delegated to SimpleBot's
 * prompt resolvers. To extend MC to prompts, enumerate a few candidate
 * ResolvePromptActions (e.g. from the resolvers plus alternatives) and
 * evaluate them the same way; note that Simulator refuses states with
 * unresolved prompts, so the playout must start from the state *before* the
 * action that raised the prompt (or the Simulator must accept such states).
 *
 * Never throws: any internal error falls back to SimpleTacticsAi.
 */
export class MonteCarloAi implements BotAi {

  private tactics: SimpleTactic[];
  private fallback: SimpleTacticsAi;
  private stateScore: StateScore;
  private policies = new Map<number, SimpleTacticsAi>();

  /** Stats about the last turn decision (for evaluation/debugging). */
  public lastDecision: McDecisionInfo | undefined;

  constructor(
    private playerId: number,
    private options: McBotOptions,
    deck: string[] | null
  ) {
    const sbOptions = options.simpleBot;
    this.tactics = sbOptions.tactics.map(tactic => new tactic(sbOptions));
    this.fallback = new SimpleTacticsAi(playerId, sbOptions, deck);
    this.stateScore = new StateScore(sbOptions);
  }

  public decodeNextAction(state: State): Action | undefined {
    try {
      const player = state.players.find(p => p.id === this.playerId);
      if (player === undefined) {
        return undefined;
      }

      // Prompts (incl. the deck invite): delegated to SimpleBot on the real
      // state, because prompts hold references to the card lists involved.
      if (state.prompts.some(p => p.result === undefined)) {
        return this.fallback.decodeNextAction(state);
      }

      const activePlayer = state.players[state.activePlayer];
      if (state.phase !== GamePhase.PLAYER_TURN || activePlayer !== player) {
        return undefined;
      }

      return this.decideTurnAction(state);
    } catch (error) {
      return this.safeFallback(state);
    }
  }

  protected safeFallback(state: State): Action | undefined {
    try {
      const view = this.options.cheat ? state : determinize(state, this.playerId);
      return this.fallback.decodeNextAction(view);
    } catch (error) {
      const active = state.players[state.activePlayer];
      if (state.phase === GamePhase.PLAYER_TURN && active && active.id === this.playerId) {
        return new PassTurnAction(this.playerId);
      }
      return undefined;
    }
  }

  protected decideTurnAction(state: State): Action {
    const started = Date.now();
    const root = this.trimState(state);
    // Honest mode: candidates are generated on a determinized view, so the
    // tactics' internal simulations can't peek at hidden cards. Candidate
    // actions only reference our hand/board, which are identical in both.
    const view = this.options.cheat ? root : determinize(root, this.playerId);
    const candidates = this.generateCandidates(view);

    const stats: CandidateStats[] = candidates.map(action => ({ action, total: 0, playouts: 0 }));
    const valid = stats.map(() => true);
    const deadline = started + this.options.timeBudgetMs;
    // The first round may overrun the budget, but never past twice of it.
    const hardDeadline = started + 2 * this.options.timeBudgetMs;
    const maxPlayouts = this.options.maxPlayouts > 0 ? this.options.maxPlayouts : Infinity;

    let total = 0;
    let round = 0;
    const baseSeed = Math.floor(Math.random() * 0x7fffffff);
    if (candidates.length > 1) {
      while (total < maxPlayouts && (round === 0 || Date.now() < deadline)) {
        let any = false;
        for (let i = 0; i < stats.length && total < maxPlayouts; i++) {
          if (!valid[i]) {
            continue;
          }
          const now = Date.now();
          if ((round > 0 && now >= deadline) || (i > 0 && now >= hardDeadline)) {
            break;
          }
          // Common random numbers: same seed for every candidate of a round.
          const action = stats[i].action;
          const score = withSeededRandom(baseSeed + round, () => this.playout(root, action));
          total += 1;
          if (score === undefined) {
            valid[i] = false;
            continue;
          }
          stats[i].total += score;
          stats[i].playouts += 1;
          any = true;
        }
        round += 1;
        if (!any) {
          break;
        }
      }
    }

    const best = this.selectBest(stats, valid);
    this.lastDecision = {
      candidates: candidates.length,
      playouts: total,
      elapsedMs: Date.now() - started,
      averages: stats.map((s, i) => valid[i] && s.playouts > 0 ? s.total / s.playouts : NaN),
      chosen: candidates.indexOf(best)
    };
    return best;
  }

  /**
   * Private copy of the state for the search, without logs and (already
   * resolved) prompts: both only grow during a game and every clone made by
   * the Simulator/tactics would otherwise copy them again and again.
   */
  protected trimState(state: State): State {
    const shallow: State = Object.create(state);
    Object.assign(shallow, state);
    shallow.logs = [];
    shallow.prompts = [];
    return deepClone(shallow, [ Card ]);
  }

  /**
   * Picks the candidate with the highest adjusted average.
   *
   * simple-bot's StateScore is a greedy static evaluator (e.g. benching a
   * Pokemon without energy lowers it), which SimpleBot itself compensates
   * with tactic priorities and a pass-turn penalty. So, like SimpleBot:
   *  - "pass turn" gets scores.tactics.passTurn when there are alternatives,
   *  - candidate 0 (SimpleBot's own choice) is kept unless another candidate
   *    beats it by more than options.deviationMargin.
   * Ties keep SimpleBot's tactic order (pass is last).
   */
  protected selectBest(stats: CandidateStats[], valid: boolean[] = stats.map(() => true)): Action {
    const passPenalty = stats.length > 1 ? this.options.simpleBot.scores.tactics.passTurn : 0;
    const adjusted = stats.map((s, i) => {
      if (!valid[i] || s.playouts === 0) {
        return -Infinity;
      }
      const avg = s.total / s.playouts;
      return s.action instanceof PassTurnAction ? avg + passPenalty : avg;
    });

    let bestIndex = -1;
    adjusted.forEach((value, i) => {
      if (value > -Infinity && (bestIndex === -1 || value > adjusted[bestIndex])) {
        bestIndex = i;
      }
    });

    if (bestIndex === -1) {
      // Nothing evaluated (single candidate or all playouts failed).
      return stats.length > 0 ? stats[0].action : new PassTurnAction(this.playerId);
    }
    if (bestIndex !== 0 && adjusted[0] > -Infinity
      && adjusted[bestIndex] - adjusted[0] <= this.options.deviationMargin) {
      bestIndex = 0;
    }
    return stats[bestIndex].action;
  }

  /** Same candidates SimpleBot considers: one per tactic, plus pass turn. */
  protected generateCandidates(state: State): Action[] {
    const player = state.players.find(p => p.id === this.playerId) as Player;
    const result: Action[] = [];
    const keys = new Set<string>();

    for (const tactic of this.tactics) {
      try {
        const action = tactic.useTactic(state, player);
        if (action === undefined || !this.isValidAction(state, action)) {
          continue;
        }
        const key = this.actionKey(action);
        if (!keys.has(key)) {
          keys.add(key);
          result.push(action);
        }
      } catch (error) {
        // a failing tactic just doesn't contribute a candidate
      }
    }

    result.push(new PassTurnAction(this.playerId));
    return result;
  }

  private actionKey(action: Action): string {
    try {
      return action.constructor.name + JSON.stringify(action);
    } catch (error) {
      return String(Math.random());
    }
  }

  private isValidAction(state: State, action: Action): boolean {
    try {
      new Simulator(state).dispatch(action);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * One playout of `action` from `state`. Returns the score from our side,
   * or undefined when the action is not legal in this (determinized) world.
   */
  protected playout(state: State, action: Action): number | undefined {
    const simulator = new Simulator(state, {
      flipMode: BotFlipMode.RANDOM,
      shuffleMode: BotShuffleMode.RANDOM
    });
    if (!this.options.cheat) {
      determinizeInPlace(simulator.store.state, this.playerId);
    }

    try {
      simulator.dispatch(action);
    } catch (error) {
      return undefined;
    }

    const horizon = state.turn + this.options.horizonTurns;
    for (let step = 0; step < this.options.maxPlayoutSteps; step++) {
      const current = simulator.store.state;
      if (current.phase === GamePhase.FINISHED || current.turn >= horizon) {
        break;
      }
      const next = this.policyAction(current);
      if (next === undefined) {
        break;
      }
      try {
        simulator.dispatch(next);
      } catch (error) {
        // Policy proposed an illegal action; end the turn if we can.
        const active = current.players[current.activePlayer];
        const canPass = current.phase === GamePhase.PLAYER_TURN
          && !current.prompts.some(p => p.result === undefined);
        if (!canPass) {
          break;
        }
        try {
          simulator.dispatch(new PassTurnAction(active.id));
        } catch (passError) {
          break;
        }
      }
    }

    return this.evaluate(simulator.store.state);
  }

  private policyAction(state: State): Action | undefined {
    for (const player of state.players) {
      const action = this.getPolicy(player.id).decodeNextAction(state);
      if (action !== undefined) {
        return action;
      }
    }
    return undefined;
  }

  private getPolicy(playerId: number): SimpleTacticsAi {
    let policy = this.policies.get(playerId);
    if (policy === undefined) {
      policy = new SimpleTacticsAi(playerId, this.options.simpleBot, null);
      this.policies.set(playerId, policy);
    }
    return policy;
  }

  protected evaluate(state: State): number {
    let score = this.stateScore.getScore(state, this.playerId);
    if (state.phase === GamePhase.FINISHED
      && state.winner !== GameWinner.NONE && state.winner !== GameWinner.DRAW) {
      const myIndex = state.players.findIndex(p => p.id === this.playerId);
      const iWon = (state.winner === GameWinner.PLAYER_1 && myIndex === 0)
        || (state.winner === GameWinner.PLAYER_2 && myIndex === 1);
      score += iWon ? this.options.winBonus : -this.options.winBonus;
    }
    return score;
  }

}
