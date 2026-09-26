import * as fs from 'fs';
import * as path from 'path';

import { BotClient } from './bot-client';
import { Core } from '../core/core';
import { BotAiFactory, DeckAnalyser, GameError } from '@ptcg/common';
import { GameMessage } from '@ptcg/common';
import { User, Deck } from '../../storage';
import { config } from '../../config';
import { Md5 } from '../../utils/md5';
import { BotGamesTask } from './bot-games-task';

export class BotManager {

  private static instance: BotManager;

  private bots: BotClient[] = [];
  private botGameArranger = new BotGamesTask(this.bots);

  public static getInstance(): BotManager {
    if (!BotManager.instance) {
      BotManager.instance = new BotManager();
    }

    return BotManager.instance;
  }

  public registerBot(botAiFactory: BotAiFactory): void {
    this.bots.push(new BotClient(botAiFactory));
  }

  public async initBots(core: Core) {
    const registered = Date.now();
    for (let i = 0; i < this.bots.length; i++) {
      const bot = this.bots[i];
      const user = await this.findOrCreateUser(bot.name, registered);
      bot.user = user;
      await this.seedDecksFromDir(user, config.bots.decksDir);
      core.connect(bot);
    }

    this.botGameArranger.startBotGames();
  }

  public getBot(botName: string): BotClient {
    const bot = this.bots.find(bot => bot.user.name === botName);
    if (bot === undefined) {
      throw new GameError(GameMessage.ERROR_BOT_NOT_FOUND);
    }
    return bot;
  }

  // Upserts one Deck row per decks/*.txt file for the given bot user.
  // Existing bot decks with other names are left untouched. Invalid decks
  // (wrong card count, unknown cards, etc.) are skipped with a warning.
  private async seedDecksFromDir(user: User, dir: string): Promise<void> {
    if (!dir || !fs.existsSync(dir)) {
      return;
    }

    const files = fs.readdirSync(dir).filter(file => file.endsWith('.txt'));

    for (const file of files) {
      try {
        await this.seedDeckFromFile(user, dir, file);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`BotManager: failed to seed bot deck from "${file}": ${message}`);
      }
    }
  }

  private async seedDeckFromFile(user: User, dir: string, file: string): Promise<void> {
    const baseName = file.slice(0, -'.txt'.length);
    const name = this.deckNameFromFileName(baseName);
    const cards = fs.readFileSync(path.join(dir, file), 'utf8')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    const analyser = new DeckAnalyser(cards);
    if (!analyser.isValid()) {
      console.warn(`BotManager: skipping invalid bot deck "${name}" (${file})`);
      return;
    }

    let deck = await Deck.findOne({ where: { user: { id: user.id }, name } });
    const isNew = deck === null;
    if (deck === null) {
      deck = new Deck();
      deck.user = user;
    }

    const newCards = JSON.stringify(cards);
    const newFormatNames = JSON.stringify(analyser.getDeckFormats().map(f => f.name));
    const newCardTypes = JSON.stringify(analyser.getDeckType());

    const unchanged = !isNew
      && deck.name === name
      && deck.cards === newCards
      && deck.isValid === true
      && deck.formatNames === newFormatNames
      && deck.cardTypes === newCardTypes;

    if (unchanged) {
      return;
    }

    deck.name = name;
    deck.cards = newCards;
    deck.isValid = true;
    deck.formatNames = newFormatNames;
    deck.cardTypes = newCardTypes;

    await deck.save();
  }

  // e.g. "gb-zapping-selfdestruct" -> "GB: Zapping Selfdestruct", "haymaker" -> "Haymaker"
  private deckNameFromFileName(baseName: string): string {
    const parts = baseName.split('-');
    let prefix = '';
    if (parts[0] === 'gb') {
      prefix = 'GB: ';
      parts.shift();
    }
    const title = parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
    return prefix + title;
  }

  private async findOrCreateUser(name: string, registered: number): Promise<User> {
    let user = await User.findOne({ where: { name } });
    if (user === null) {
      user = new User();
      user.name = name;
      user.registered = registered;

      if (config.bots.defaultPassword) {
        user.password = Md5.init(config.bots.defaultPassword);
      }

      await User.insert(user);
    }
    return user;
  }

}
