import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  createAvatarFileFromPreset,
  listAvatarPresets,
  resolveAvatarPresetPath
} from './avatar-presets';
import { config } from '../config';

describe('avatar-presets', () => {
  let presetsDir: string;
  let avatarsDir: string;
  let originalPresetsDir: string;
  let originalAvatarsDir: string;

  beforeEach(() => {
    originalPresetsDir = config.backend.avatarsPresetDir;
    originalAvatarsDir = config.backend.avatarsDir;

    presetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avatar-presets-'));
    avatarsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'avatars-'));

    fs.mkdirSync(path.join(presetsDir, 'tux'));
    fs.mkdirSync(path.join(presetsDir, 'default'));

    // 1x1 transparent PNG, small enough to embed directly.
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    fs.writeFileSync(path.join(presetsDir, 'tux', 'tux01.png'), pngBuffer);
    fs.writeFileSync(path.join(presetsDir, 'tux', 'tux02.png'), pngBuffer);
    fs.writeFileSync(path.join(presetsDir, 'tux', 'notes.txt'), 'not an image');
    fs.writeFileSync(path.join(presetsDir, 'default', 'face01.png'), pngBuffer);

    config.backend.avatarsPresetDir = presetsDir;
    config.backend.avatarsDir = avatarsDir;
  });

  afterEach(() => {
    config.backend.avatarsPresetDir = originalPresetsDir;
    config.backend.avatarsDir = originalAvatarsDir;

    fs.rmSync(presetsDir, { recursive: true, force: true });
    fs.rmSync(avatarsDir, { recursive: true, force: true });
  });

  describe('listAvatarPresets', () => {
    it('returns an empty list when presets are not configured', async () => {
      config.backend.avatarsPresetDir = '';
      const presets = await listAvatarPresets();
      expect(presets).toEqual([]);
    });

    it('lists images grouped by subfolder, skipping non-image files', async () => {
      const presets = await listAvatarPresets();

      expect(presets).toEqual([
        { folder: 'default', fileName: 'face01.png', path: 'default/face01.png' },
        { folder: 'tux', fileName: 'tux01.png', path: 'tux/tux01.png' },
        { folder: 'tux', fileName: 'tux02.png', path: 'tux/tux02.png' }
      ]);
    });
  });

  describe('resolveAvatarPresetPath', () => {
    it('resolves a valid relative path', () => {
      const resolved = resolveAvatarPresetPath('tux/tux01.png');
      expect(resolved).toBe(path.join(presetsDir, 'tux', 'tux01.png'));
    });

    it('rejects path traversal attempts', () => {
      expect(() => resolveAvatarPresetPath('../../etc/passwd')).toThrowError();
      expect(() => resolveAvatarPresetPath('tux/../../../etc/passwd')).toThrowError();
      expect(() => resolveAvatarPresetPath('/etc/passwd')).toThrowError();
    });

    it('rejects non-image paths', () => {
      expect(() => resolveAvatarPresetPath('tux/notes.txt')).toThrowError();
    });

    it('rejects empty or missing paths', () => {
      expect(() => resolveAvatarPresetPath('')).toThrowError();
      expect(() => resolveAvatarPresetPath(undefined as any)).toThrowError();
    });
  });

  describe('createAvatarFileFromPreset', () => {
    it('copies the preset into avatarsDir under a new file name', async () => {
      const fileName = await createAvatarFileFromPreset('tux/tux01.png');

      expect(fileName).toMatch(/^\d{5}\.png$/);
      expect(fs.existsSync(path.join(avatarsDir, fileName))).toBe(true);
    });

    it('throws for a path that escapes the presets directory', async () => {
      await expectAsync(createAvatarFileFromPreset('../../etc/passwd')).toBeRejected();
    });

    it('throws for a preset file that does not exist', async () => {
      await expectAsync(createAvatarFileFromPreset('tux/missing.png')).toBeRejected();
    });
  });
});
