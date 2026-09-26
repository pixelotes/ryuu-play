import { BotAiFactory, CardManager } from '@ptcg/common';
import { Client } from '../client/client.interface';
import { DeckAnalyser } from '@ptcg/common';
import { Game } from '../core/game';
import { GameError } from '@ptcg/common';
import { GameMessage } from '@ptcg/common';
import { User, Message, Deck } from '../../storage';
import { Core } from '../core/core';
import { State } from '@ptcg/common';
import { GameSettings } from '@ptcg/common';
import { BotGameHandler } from './bot-game-handler';

export class BotClient implements Client {

  public id: number = 0;
  public name: string;
  public user: User;
  public core: Core | undefined;
  public games: Game[] = [];
  private gameHandlers: BotGameHandler[] = [];

  constructor(private botAiFactory: BotAiFactory) {
    this.user = new User();
    this.user.name = botAiFactory.name;
    this.name = botAiFactory.name;
  }

  public onConnect(client: Client): void { }

  public onDisconnect(client: Client): void { }

  public onUsersUpdate(users: User[]): void {
    const me = users.find(u => u.id === this.user.id);
    if (me !== undefined) {
      this.user = me;
    }
  }

  public onMessage(from: Client, message: Message): void { }

  public onMessageRead(user: User): void { }

  public onGameJoin(game: Game, client: Client): void {
    if (client === this) {
      const state = game.state;
      this.addGameHandler(game);
      this.onStateChange(game, state);
    }
  }

  public onGameLeave(game: Game, client: Client): void {
    const gameHandler = this.gameHandlers.find(gh => gh.game === game);

    if (client === this && gameHandler !== undefined) {
      this.deleteGameHandler(gameHandler);
      return;
    }
  }

  public onGameAdd(game: Game): void { }

  public onGameDelete(game: Game): void { }

  public onStateChange(game: Game, state: State): void {
    const gameHandler = this.gameHandlers.find(handler => handler.game === game);
    if (gameHandler !== undefined) {
      gameHandler.onStateChange(state);
    }
  }

  protected addGameHandler(game: Game): BotGameHandler {
    const formatName = game.state.rules.formatName;
    const deckId = game.gameSettings.botDeckId;
    const gameHandler = new BotGameHandler(this, this.botAiFactory, game, this.loadDeck(formatName, deckId));
    this.gameHandlers.push(gameHandler);
    return gameHandler;
  }

  protected deleteGameHandler(gameHandler: BotGameHandler): void {
    const index = this.gameHandlers.indexOf(gameHandler);
    if (index !== -1) {
      this.gameHandlers.splice(index, 1);
    }
  }

  createGame(deck: string[], gameSettings?: GameSettings, invited?: Client): Game {
    if (this.core === undefined) {
      throw new GameError(GameMessage.ERROR_BOT_NOT_INITIALIZED);
    }
    const game = this.core.createGame(this, deck, gameSettings, invited);
    return game;
  }

  // Loads the deck chosen by the inviting player (deckId), falling back to a
  // random valid deck when it's missing, doesn't belong to this bot, or isn't
  // valid for the requested format.
  public async loadDeck(formatName: string = '', deckId?: number): Promise<string[]> {
    if (deckId !== undefined) {
      const chosen = await this.loadChosenDeck(deckId, formatName);
      if (chosen !== undefined) {
        return chosen;
      }
    }
    return this.loadRandomDeck(formatName);
  }

  private async loadChosenDeck(deckId: number, formatName: string): Promise<string[] | undefined> {
    const deck = await Deck.findOne({
      where: {
        id: deckId,
        user: { id: this.user.id },
        isValid: true
      }
    });

    if (deck === undefined || deck === null) {
      return undefined;
    }

    const cards = JSON.parse(deck.cards);
    return this.validateDeck(cards, formatName) ? cards : undefined;
  }

  private async loadRandomDeck(formatName: string): Promise<string[]> {
    const deckRows = await Deck.find({
      where: {
        user: { id: this.user.id },
        isValid: true
      }
    });

    const decks = deckRows
      .map(d => JSON.parse(d.cards))
      .filter((cards: string[]) => this.validateDeck(cards, formatName));

    if (decks.length === 0) {
      throw new GameError(GameMessage.ERROR_BOT_NO_DECK);
    }

    const num = Math.round(Math.random() * (decks.length - 1));
    return decks[num];
  }

  private validateDeck(cards: string[], formatName: string): boolean {
    const cardManager = CardManager.getInstance();
    if (cards.some(c => !cardManager.isCardDefined(c))) {
      return false;
    }

    const analyser = new DeckAnalyser(cards);
    if (!analyser.isValid()) {
      return false;
    }
    if (formatName && !analyser.getDeckFormats().some(f => f.name === formatName)) {
      return false;
    }
    return true;
  }

}
