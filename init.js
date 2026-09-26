const { BotManager, config } = require('@ptcg/server');
const { SimpleBot } =  require('@ptcg/simple-bot');
const { McBot } = require('@ptcg/mc-bot');
const { CardManager } = require('@ptcg/common');

// Backend config
config.backend.address = 'localhost';
config.backend.port = 12021;
config.backend.avatarsDir = __dirname + '/avatars';
config.backend.avatarsPresetDir = __dirname + '/avatars-preset';
config.backend.webUiDir = __dirname + '/packages/play/dist/ptcg-play';

// Storage config
config.storage.type = 'sqlite';
config.storage.database = __dirname + '/database.sq3';

// Bots config
config.bots.defaultPassword = 'bot';
// Pause between bot actions, long enough to follow what the bot does.
config.bots.actionDelay = 700;
config.bots.decksDir = __dirname + '/decks';
// Fixed avatar seeded for each bot at startup (relative to avatarsPresetDir).
config.bots.avatarPresets = {
  SimpleBot: 'tux/tux01.png',
  MonteCarloEasy: 'default/face01.png',
  MonteCarloHard: 'legend/avatar01.png'
};

// Sets/scans config
config.sets.scansDir = __dirname + '/scans';
config.sets.scansDownloadUrl = 'https://ptcg.ryuu.eu/scans'; // Server to download missing scans

// Define available sets
const { baseSets, exSets, standardSets } = require('@ptcg/sets');

const cardManager = CardManager.getInstance();

cardManager.defineFormat('Standard', [
  standardSets.setDiamondAndPearl,
  standardSets.setOp9,
  standardSets.setHgss,
  standardSets.setBlackAndWhite,
  standardSets.setBlackAndWhite2,
  standardSets.setBlackAndWhite3,
  standardSets.setBlackAndWhite4,
  standardSets.setSwordAndShield
]);

cardManager.defineFormat('EX Sets', [
  exSets.setRubyAndSapphire,
  exSets.setSandstorm,
  exSets.setFireredAndLeafgreen
]);

cardManager.defineFormat('Base Sets', [
  baseSets.setBase,
  baseSets.setJungle,
  baseSets.setFossil,
  baseSets.setTeamRocket
]);

// Define bots
const botManager = BotManager.getInstance();
// Bot names must match the server's user name pattern: /^[a-zA-Z0-9]{3,32}$/
// (no spaces). The former 'bot' user stays in the database, unused.
botManager.registerBot(new SimpleBot('SimpleBot'));
// Flat Monte Carlo bots: Hard sees the real (hidden) cards, Easy plays honest
// and resamples everything it can't see before each playout.
botManager.registerBot(new McBot('MonteCarloHard', { cheat: true, timeBudgetMs: 300 }));
botManager.registerBot(new McBot('MonteCarloEasy', { cheat: false, timeBudgetMs: 300 }));
