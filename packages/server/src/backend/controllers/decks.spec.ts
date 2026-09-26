import { Application, Request, Response } from 'express';
import { Decks } from './decks';
import { BotClient } from '../../game/bots/bot-client';
import { Core } from '../../game/core/core';
import { Storage } from '../../storage';
import { Deck, User } from '../../storage/model/index';
import { generateToken } from '../services';
import { ApiErrorEnum } from '@ptcg/common';

describe('Decks', () => {
  let decks: Decks;
  let req: jasmine.SpyObj<Request>;
  let res: jasmine.SpyObj<Response>;
  let app: jasmine.SpyObj<Application>;
  let db: jasmine.SpyObj<Storage>;
  let core: jasmine.SpyObj<Core>;
  let testUser: User;

  beforeEach(() => {
    req = jasmine.createSpyObj('Request', ['body', 'header', 'params']);
    res = jasmine.createSpyObj('Response', ['send', 'status']);
    app = jasmine.createSpyObj('Application', ['get', 'post']);
    db = jasmine.createSpyObj('Storage', ['findOne', 'save']);
    core = jasmine.createSpyObj('Core', ['connect', 'disconnect', 'clients']);
    (core as any).clients = [];

    testUser = new User();
    testUser.id = 1;

    req.header.and.returnValue(generateToken(testUser.id));
    req.body = { userId: testUser.id };

    decks = new Decks('/decks', app, db, core);
  });

  describe('onBotList', () => {
    it('returns the decks of a registered bot user', async () => {
      req.params = { userId: '5' };

      const bot = Object.create(BotClient.prototype);
      bot.user = { id: 5 };
      (core as any).clients = [bot];

      const deckRow = new Deck();
      deckRow.id = 100;
      deckRow.name = 'GB: Zapping Selfdestruct';
      deckRow.formatNames = JSON.stringify(['Base Sets']);
      spyOn(Deck, 'find').and.returnValue(Promise.resolve([deckRow]));

      await decks.onBotList(req, res);

      expect(Deck.find).toHaveBeenCalledWith({ where: { user: { id: 5 }, isValid: true } });
      expect(res.send).toHaveBeenCalledWith({
        ok: true,
        decks: [{ id: 100, name: 'GB: Zapping Selfdestruct', formatNames: ['Base Sets'] }]
      });
    });

    it('returns an error when the user id does not belong to a bot', async () => {
      req.params = { userId: '999' };
      (core as any).clients = [];

      await decks.onBotList(req, res);

      expect(res.send).toHaveBeenCalledWith({ error: ApiErrorEnum.PROFILE_INVALID });
    });
  });
});
