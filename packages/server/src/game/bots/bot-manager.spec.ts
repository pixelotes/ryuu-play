import * as fs from 'fs';

import { BotManager } from './bot-manager';
import { DeckAnalyser, Format } from '@ptcg/common';
import { Avatar, Deck, User } from '../../storage';
import * as avatarPresets from '../../utils/avatar-presets';

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

  describe('seedBotAvatar', () => {
    it('does nothing when no preset is configured for the bot', async () => {
      const findOneSpy = spyOn(Avatar, 'findOne');

      await (botManager as any).seedBotAvatar(testUser, undefined);

      expect(findOneSpy).not.toHaveBeenCalled();
    });

    it('creates the avatar and sets it as the user default when none exists yet', async () => {
      spyOn(Avatar, 'findOne').and.returnValue(Promise.resolve(null));
      spyOn(avatarPresets, 'createAvatarFileFromPreset').and.returnValue(Promise.resolve('01234.png'));
      const saveSpy = spyOn(Avatar.prototype, 'save').and.callFake(function (this: Avatar) {
        return Promise.resolve(this);
      });
      const updateSpy = spyOn(User, 'update').and.returnValue(Promise.resolve({} as any));

      await (botManager as any).seedBotAvatar(testUser, 'tux/tux01.png');

      expect(avatarPresets.createAvatarFileFromPreset).toHaveBeenCalledWith('tux/tux01.png');
      expect(saveSpy).toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith(testUser.id, { avatarFile: '01234.png' });
      expect(testUser.avatarFile).toBe('01234.png');
    });

    it('does not create a duplicate avatar row on a later restart', async () => {
      const existing = new Avatar();
      existing.id = 42;
      existing.user = testUser;
      existing.name = 'Preset';
      existing.fileName = '01234.png';
      testUser.avatarFile = '01234.png';

      spyOn(Avatar, 'findOne').and.returnValue(Promise.resolve(existing));
      const createSpy = spyOn(avatarPresets, 'createAvatarFileFromPreset');
      const updateSpy = spyOn(User, 'update');

      await (botManager as any).seedBotAvatar(testUser, 'tux/tux01.png');

      expect(createSpy).not.toHaveBeenCalled();
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('re-applies the seeded avatar if the user default drifted', async () => {
      const existing = new Avatar();
      existing.id = 42;
      existing.user = testUser;
      existing.name = 'Preset';
      existing.fileName = '01234.png';
      testUser.avatarFile = '';

      spyOn(Avatar, 'findOne').and.returnValue(Promise.resolve(existing));
      const createSpy = spyOn(avatarPresets, 'createAvatarFileFromPreset');
      const updateSpy = spyOn(User, 'update').and.returnValue(Promise.resolve({} as any));

      await (botManager as any).seedBotAvatar(testUser, 'tux/tux01.png');

      expect(createSpy).not.toHaveBeenCalled();
      expect(updateSpy).toHaveBeenCalledWith(testUser.id, { avatarFile: '01234.png' });
    });

    it('never throws and just warns when seeding the avatar fails', async () => {
      spyOn(Avatar, 'findOne').and.returnValue(Promise.resolve(null));
      spyOn(avatarPresets, 'createAvatarFileFromPreset').and.returnValue(Promise.reject(new Error('boom')));
      spyOn(console, 'warn');

      await expectAsync((botManager as any).seedBotAvatar(testUser, 'tux/tux01.png')).toBeResolved();

      expect(console.warn).toHaveBeenCalled();
    });
  });
});
