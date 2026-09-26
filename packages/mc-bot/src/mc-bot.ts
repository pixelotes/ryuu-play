import { BotAi, BotAiFactory } from '@ptcg/common';
import { allSimpleTactics, allPromptResolvers, defaultStateScores,
  defaultArbiterOptions } from '@ptcg/simple-bot';
import { McBotOptions } from './mc-bot-options';
import { MonteCarloAi } from './monte-carlo-ai';

export const defaultMcBotOptions: McBotOptions = {
  cheat: false,
  timeBudgetMs: 300,
  maxPlayouts: 0,
  horizonTurns: 2,
  maxPlayoutSteps: 300,
  deviationMargin: 100,
  winBonus: 100000,
  simpleBot: {
    tactics: allSimpleTactics,
    promptResolvers: allPromptResolvers,
    scores: defaultStateScores,
    arbiter: defaultArbiterOptions
  }
};

export class McBot extends BotAiFactory {

  private options: McBotOptions;

  constructor(name: string, options: Partial<McBotOptions> = {}) {
    super(name);
    this.options = Object.assign({}, defaultMcBotOptions, options);
  }

  public createBotAi(playerId: number, deck: string[] | null): BotAi {
    return new MonteCarloAi(playerId, this.options, deck);
  }

}
