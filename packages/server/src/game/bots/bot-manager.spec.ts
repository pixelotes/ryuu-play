import * as fs from 'fs';

import { BotManager } from './bot-manager';
import { DeckAnalyser, Format } from '@ptcg/common';
import { Deck, User } from '../../storage';

describe('BotManager', () => {
  let botManager: BotManager;
  let testUser: User;

  beforeEach(() => {
    botManager = new BotManager();
    testUser = new User();
    testUser.id = 1;

    spyOn(fs, 'existsSync').and.returnValue(true);
    spyOn(fs, 'readdirSync').and.returnValue(['haymaker.txt'] as any);
    spyOn(fs, 'readFileSync').and.returnValue('Hitmonchan BS\nElectabuzz BS');

    spyOn(DeckAnalyser.prototype, 'isValid').and.returnValue(true);
    spyOn(DeckAnalyser.prototype, 'getDeckFormats').and.returnValue([{ name: 'Base Sets' } as Format]);
    spyOn(DeckAnalyser.prototype, 'getDeckType').and.returnValue([]);
  });

  describe('seedDecksFromDir', () => {
    it('does not call save when an identical deck already exists', async () => {
      const existing = new Deck();
      existing.user = testUser;
      existing.name = 'Haymaker';
      existing.cards = JSON.stringify(['Hitmonchan BS', 'Electabuzz BS']);
      existing.isValid = true;
      existing.formatNames = JSON.stringify(['Base Sets']);
      existing.cardTypes = JSON.stringify([]);

      spyOn(Deck, 'findOne').and.returnValue(Promise.resolve(existing));
      const saveSpy = spyOn(Deck.prototype, 'save');

      await (botManager as any).seedDecksFromDir(testUser, '/decks');

      expect(saveSpy).not.toHaveBeenCalled();
    });

    it('saves a new deck when none exists yet', async () => {
      spyOn(Deck, 'findOne').and.returnValue(Promise.resolve(null));
      const saveSpy = spyOn(Deck.prototype, 'save').and.callFake(function (this: Deck) {
        return Promise.resolve(this);
      });

      await (botManager as any).seedDecksFromDir(testUser, '/decks');

      expect(saveSpy).toHaveBeenCalled();
    });

    it('saves an updated deck when the existing one differs', async () => {
      const existing = new Deck();
      existing.user = testUser;
      existing.name = 'Haymaker';
      existing.cards = JSON.stringify(['Old Card']);
      existing.isValid = true;
      existing.formatNames = JSON.stringify(['Base Sets']);
      existing.cardTypes = JSON.stringify([]);

      spyOn(Deck, 'findOne').and.returnValue(Promise.resolve(existing));
      const saveSpy = spyOn(Deck.prototype, 'save').and.callFake(function (this: Deck) {
        return Promise.resolve(this);
      });

      await (botManager as any).seedDecksFromDir(testUser, '/decks');

      expect(saveSpy).toHaveBeenCalled();
    });

    it('does not throw and keeps going when saving a deck fails', async () => {
      spyOn(Deck, 'findOne').and.returnValue(Promise.resolve(null));
      spyOn(Deck.prototype, 'save').and.returnValue(Promise.reject(new Error('boom')));
      spyOn(console, 'warn');

      await expectAsync((botManager as any).seedDecksFromDir(testUser, '/decks')).toBeResolved();

      expect(console.warn).toHaveBeenCalled();
    });
  });
});
