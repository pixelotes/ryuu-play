import { BotAiFactory, GameMessage } from '@ptcg/common';
import { BotClient } from './bot-client';
import { Deck, User } from '../../storage';

describe('BotClient', () => {
  let bot: BotClient;
  let testUser: User;
  let botAiFactory: BotAiFactory;

  beforeEach(() => {
    botAiFactory = { name: 'test-bot' } as BotAiFactory;
    bot = new BotClient(botAiFactory);

    testUser = new User();
    testUser.id = 1;
    testUser.name = 'test-bot';
    bot.user = testUser;
  });

  describe('loadDeck', () => {
    it('uses the chosen deck when it belongs to the bot and is valid for the format', async () => {
      const chosenDeck = { id: 10, cards: JSON.stringify(['Card A', 'Card B']) } as Deck;
      spyOn(Deck, 'findOne').and.returnValue(Promise.resolve(chosenDeck));
      spyOn(Deck, 'find');
      spyOn(bot as any, 'validateDeck').and.returnValue(true);

      const cards = await bot.loadDeck('Base Sets', 10);

      expect(Deck.findOne).toHaveBeenCalledWith({
        where: { id: 10, user: { id: testUser.id }, isValid: true }
      });
      expect(Deck.find).not.toHaveBeenCalled();
      expect(cards).toEqual(['Card A', 'Card B']);
    });

    it('falls back to a random valid deck when the chosen deck does not exist', async () => {
      spyOn(Deck, 'findOne').and.returnValue(Promise.resolve(null));
      const randomDeck = { id: 20, cards: JSON.stringify(['Card C']) } as Deck;
      spyOn(Deck, 'find').and.returnValue(Promise.resolve([randomDeck]));
      spyOn(bot as any, 'validateDeck').and.returnValue(true);

      const cards = await bot.loadDeck('Base Sets', 999);

      expect(Deck.findOne).toHaveBeenCalled();
      expect(Deck.find).toHaveBeenCalledWith({
        where: { user: { id: testUser.id }, isValid: true }
      });
      expect(cards).toEqual(['Card C']);
    });

    it('falls back to a random valid deck when the chosen deck is not valid for the format', async () => {
      const chosenDeck = { id: 10, cards: JSON.stringify(['Card A']) } as Deck;
      spyOn(Deck, 'findOne').and.returnValue(Promise.resolve(chosenDeck));
      const randomDeck = { id: 20, cards: JSON.stringify(['Card C']) } as Deck;
      spyOn(Deck, 'find').and.returnValue(Promise.resolve([randomDeck]));

      const validateDeckSpy = spyOn(bot as any, 'validateDeck');
      validateDeckSpy.withArgs(['Card A'], 'Base Sets').and.returnValue(false);
      validateDeckSpy.withArgs(['Card C'], 'Base Sets').and.returnValue(true);

      const cards = await bot.loadDeck('Base Sets', 10);

      expect(Deck.find).toHaveBeenCalled();
      expect(cards).toEqual(['Card C']);
    });

    it('picks a random valid deck when no deck id is given', async () => {
      spyOn(Deck, 'findOne');
      const randomDeck = { id: 20, cards: JSON.stringify(['Card C']) } as Deck;
      spyOn(Deck, 'find').and.returnValue(Promise.resolve([randomDeck]));
      spyOn(bot as any, 'validateDeck').and.returnValue(true);

      const cards = await bot.loadDeck('Base Sets');

      expect(Deck.findOne).not.toHaveBeenCalled();
      expect(cards).toEqual(['Card C']);
    });

    it('throws when there is no valid deck at all', async () => {
      spyOn(Deck, 'findOne').and.returnValue(Promise.resolve(null));
      spyOn(Deck, 'find').and.returnValue(Promise.resolve([]));

      await expectAsync(bot.loadDeck('Base Sets', 10)).toBeRejectedWith(
        jasmine.objectContaining({ message: GameMessage.ERROR_BOT_NO_DECK })
      );
    });
  });
});
