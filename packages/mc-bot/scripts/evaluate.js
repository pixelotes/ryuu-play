/* eslint-disable */
// Headless evaluation: Monte Carlo bot (hard/easy) vs SimpleBot.
//
// Usage (after `npm run compile` in common, simple-bot, mc-bot):
//   node packages/mc-bot/scripts/evaluate.js [gamesPerMatchup=10] [budgetMs=300] [modes=hard,easy[,baseline]]
//
// Games alternate the MC bot's deck (haymaker / raindance) and seat
// (creator / invited). Coin flips and shuffles are random.

const fs = require('fs');
const path = require('path');
const {
  Simulator, State, AddPlayerAction, InvitePlayerAction, ResolvePromptAction,
  InvitePlayerPrompt, GamePhase, GameWinner, CardManager, BotFlipMode, BotShuffleMode
} = require('@ptcg/common');
const { baseSets } = require('@ptcg/sets');
const { SimpleBot } = require('@ptcg/simple-bot');
const { McBot } = require('@ptcg/mc-bot');

const root = path.resolve(__dirname, '../../..');
const games = parseInt(process.argv[2] || '10', 10);
const budgetMs = parseInt(process.argv[3] || '300', 10);
const modes = (process.argv[4] || 'hard,easy').split(',');

CardManager.getInstance().defineFormat('Base Sets', [
  baseSets.setBase, baseSets.setJungle, baseSets.setFossil, baseSets.setTeamRocket
]);

function loadDeck(name) {
  return fs.readFileSync(path.join(root, 'decks', name), 'utf8')
    .split(/\r?\n/).map(l => l.trim()).filter(Boolean);
}
const decks = { haymaker: loadDeck('haymaker.txt'), raindance: loadDeck('raindance.txt') };

function playGame(mode, index) {
  const mcDeckName = index % 2 === 0 ? 'haymaker' : 'raindance';
  const sbDeckName = mcDeckName === 'haymaker' ? 'raindance' : 'haymaker';
  const mcSeat = Math.floor(index / 2) % 2; // 0 = creator (id 1), 1 = invited (id 2)
  const mcId = mcSeat === 0 ? 1 : 2;
  const sbId = mcSeat === 0 ? 2 : 1;
  const deckById = { [mcId]: decks[mcDeckName], [sbId]: decks[sbDeckName] };

  const sim = new Simulator(new State(), { flipMode: BotFlipMode.RANDOM, shuffleMode: BotShuffleMode.RANDOM });
  sim.dispatch(new AddPlayerAction(1, 'P1', deckById[1]));
  sim.dispatch(new InvitePlayerAction(2, 'P2'));
  const invite = sim.store.state.prompts.find(p => p instanceof InvitePlayerPrompt && p.result === undefined);
  sim.dispatch(new ResolvePromptAction(invite.id, deckById[2]));

  // mode 'baseline': SimpleBot in the MC seat (measures deck/seat balance).
  const mc = mode === 'baseline'
    ? new SimpleBot('base').createBotAi(mcId, deckById[mcId])
    : new McBot('mc', { cheat: mode === 'hard', timeBudgetMs: budgetMs }).createBotAi(mcId, deckById[mcId]);
  const sb = new SimpleBot('sb').createBotAi(sbId, deckById[sbId]);

  let decisions = 0, decisionMs = 0, playouts = 0, steps = 0, firstPlayer;
  while (sim.store.state.phase !== GamePhase.FINISHED && steps < 5000) {
    const state = sim.store.state;
    if (firstPlayer === undefined && state.phase === GamePhase.PLAYER_TURN) {
      firstPlayer = state.players[state.activePlayer].id === mcId ? 'mc' : 'sb';
    }
    const before = mc.lastDecision;
    const t0 = Date.now();
    let action = mc.decodeNextAction(state);
    const dt = Date.now() - t0;
    if (mc.lastDecision !== before) {
      decisions++; decisionMs += dt; playouts += mc.lastDecision.playouts;
      if (process.env.MC_DEBUG) {
        const d = mc.lastDecision;
        console.log(`  t${state.turn} chosen=${d.chosen} ${action && action.constructor.name} avgs=[${d.averages.map(a => a.toFixed(0)).join(', ')}] po=${d.playouts}`);
      }
    }
    if (action === undefined) action = sb.decodeNextAction(state);
    if (action === undefined) break;
    try { sim.dispatch(action); } catch (e) { console.warn('illegal action', e.message); break; }
    steps++;
  }

  const s = sim.store.state;
  const mcIndex = s.players.findIndex(p => p.id === mcId);
  let result = 'unfinished';
  if (s.phase === GamePhase.FINISHED) {
    if (s.winner === GameWinner.DRAW) result = 'draw';
    else if (s.winner === mcIndex) result = 'win';
    else if (s.winner !== GameWinner.NONE) result = 'loss';
  }
  return { result, mcDeckName, firstPlayer, turns: s.turn, decisions, decisionMs, playouts };
}

for (const mode of modes) {
  const t0 = Date.now();
  const results = [];
  for (let i = 0; i < games; i++) {
    const r = playGame(mode, i);
    results.push(r);
    console.log(`[${mode}] game ${i + 1}: ${r.result} (mc deck=${r.mcDeckName}, first=${r.firstPlayer}, turns=${r.turns}, ` +
      `ms/decision=${(r.decisionMs / Math.max(1, r.decisions)).toFixed(0)}, playouts/decision=${(r.playouts / Math.max(1, r.decisions)).toFixed(1)})`);
  }
  const wins = results.filter(r => r.result === 'win').length;
  const losses = results.filter(r => r.result === 'loss').length;
  const dec = results.reduce((a, r) => a + r.decisions, 0);
  const ms = results.reduce((a, r) => a + r.decisionMs, 0);
  const po = results.reduce((a, r) => a + r.playouts, 0);
  console.log(`== MC-${mode} vs SimpleBot: ${wins}W ${losses}L ${games - wins - losses}other ` +
    `(win rate ${(100 * wins / games).toFixed(0)}%), avg ${(ms / Math.max(1, dec)).toFixed(0)} ms/decision, ` +
    `${(po / Math.max(1, dec)).toFixed(1)} playouts/decision, total ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
