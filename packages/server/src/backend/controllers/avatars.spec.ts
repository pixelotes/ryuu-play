import { Application, Request, Response } from 'express';

import { Avatars } from './avatars';
import { Core } from '../../game/core/core';
import { Storage, User } from '../../storage';
import { generateToken } from '../services';
import { ApiErrorEnum, AvatarPresetInfo } from '@ptcg/common';
import * as avatarPresets from '../../utils/avatar-presets';

describe('Avatars', () => {
  let avatars: Avatars;
  let req: jasmine.SpyObj<Request>;
  let res: jasmine.SpyObj<Response>;
  let app: jasmine.SpyObj<Application>;
  let db: any;
  let core: jasmine.SpyObj<Core>;
  let manager: { save: jasmine.Spy, update: jasmine.Spy };
  let testUser: User;

  beforeEach(() => {
    req = jasmine.createSpyObj('Request', ['body', 'header', 'params']);
    res = jasmine.createSpyObj('Response', ['send', 'status']);
    app = jasmine.createSpyObj('Application', ['get', 'post']);
    core = jasmine.createSpyObj('Core', ['emit']);

    manager = {
      save: jasmine.createSpy('save').and.callFake(async (avatar: any) => {
        avatar.id = avatar.id || 1;
        return avatar;
      }),
      update: jasmine.createSpy('update').and.returnValue(Promise.resolve())
    };

    db = {
      manager: {
        transaction: (cb: (manager: any) => Promise<void>) => cb(manager)
      }
    };

    testUser = new User();
    testUser.id = 1;
    testUser.name = 'testuser';
    testUser.avatarFile = 'existing.png';

    req.header.and.returnValue(generateToken(testUser.id));

    avatars = new Avatars('/avatars', app, db as Storage, core);
  });

  describe('onPresets', () => {
    it('returns the presets reported by the avatar-presets util', async () => {
      const presets: AvatarPresetInfo[] = [
        { folder: 'tux', fileName: 'tux01.png', path: 'tux/tux01.png' }
      ];
      spyOn(avatarPresets, 'listAvatarPresets').and.returnValue(Promise.resolve(presets));

      await avatars.onPresets(req, res);

      expect(res.send).toHaveBeenCalledWith({ ok: true, presets });
    });
  });

  describe('onAddPreset', () => {
    beforeEach(() => {
      req.body = { userId: testUser.id, name: 'Gallery pick', path: 'tux/tux01.png' };
      spyOn(User, 'findOneById').and.returnValue(Promise.resolve(testUser));
    });

    it('creates an avatar from a valid preset path', async () => {
      spyOn(avatarPresets, 'createAvatarFileFromPreset').and.returnValue(Promise.resolve('01234.png'));

      await avatars.onAddPreset(req, res);

      expect(avatarPresets.createAvatarFileFromPreset).toHaveBeenCalledWith('tux/tux01.png');
      expect(manager.save).toHaveBeenCalled();
      expect(res.send).toHaveBeenCalledWith({
        ok: true,
        avatar: jasmine.objectContaining({ name: 'Gallery pick', fileName: '01234.png' })
      });
    });

    it('does not touch the user default avatar when one is already set', async () => {
      spyOn(avatarPresets, 'createAvatarFileFromPreset').and.returnValue(Promise.resolve('01234.png'));

      await avatars.onAddPreset(req, res);

      expect(manager.update).not.toHaveBeenCalled();
    });

    it('sets the preset as the default avatar when the user has none yet', async () => {
      testUser.avatarFile = '';
      spyOn(avatarPresets, 'createAvatarFileFromPreset').and.returnValue(Promise.resolve('01234.png'));

      await avatars.onAddPreset(req, res);

      expect(manager.update).toHaveBeenCalledWith(User, testUser.id, { avatarFile: '01234.png' });
    });

    it('rejects a path-traversal preset path instead of writing any file', async () => {
      req.body.path = '../../etc/passwd';
      spyOn(avatarPresets, 'createAvatarFileFromPreset')
        .and.returnValue(Promise.reject(new Error('Invalid preset path.')));

      await avatars.onAddPreset(req, res);

      expect(manager.save).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({
        error: ApiErrorEnum.VALIDATION_INVALID_PARAM,
        param: 'path',
        message: 'Invalid preset path.'
      });
    });

    it('returns PROFILE_INVALID when the user does not exist', async () => {
      (User.findOneById as jasmine.Spy).and.returnValue(Promise.resolve(null));

      await avatars.onAddPreset(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.send).toHaveBeenCalledWith({ error: ApiErrorEnum.PROFILE_INVALID });
    });
  });
});
