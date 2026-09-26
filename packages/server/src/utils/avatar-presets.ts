import { promises as fs } from 'fs';
import { join, normalize, resolve, sep } from 'path';
import { read } from 'jimp';

import { AvatarPresetInfo } from '@ptcg/common';
import { config } from '../config';

const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|gif)$/i;

// Lists every preset avatar found under config.backend.avatarsPresetDir,
// one subfolder per "theme" (e.g. tux/, default/, legend/...). Returns an
// empty list when the feature isn't configured, or a folder can't be read.
export async function listAvatarPresets(): Promise<AvatarPresetInfo[]> {
  const dir = config.backend.avatarsPresetDir;
  if (!dir) {
    return [];
  }

  let entries: string[];
  try {
    const dirents = await fs.readdir(dir, { withFileTypes: true });
    entries = dirents.filter(dirent => dirent.isDirectory()).map(dirent => dirent.name).sort();
  } catch {
    return [];
  }

  const presets: AvatarPresetInfo[] = [];
  for (const folder of entries) {
    try {
      const files = (await fs.readdir(join(dir, folder)))
        .filter(fileName => IMAGE_EXTENSION_PATTERN.test(fileName))
        .sort();
      for (const fileName of files) {
        presets.push({ folder, fileName, path: `${folder}/${fileName}` });
      }
    } catch {
      // Skip unreadable subfolders instead of failing the whole listing.
    }
  }

  return presets;
}

// Resolves a "folder/file.png"-style relative path against
// config.backend.avatarsPresetDir, rejecting anything (e.g. '../..') that
// would escape that directory.
export function resolveAvatarPresetPath(relativePath: string): string {
  const dir = config.backend.avatarsPresetDir;
  if (!dir) {
    throw new Error('Avatar presets are not configured.');
  }
  if (typeof relativePath !== 'string' || relativePath.trim().length === 0) {
    throw new Error('Invalid preset path.');
  }

  const normalized = normalize(relativePath).replace(/^[/\\]+/, '');
  const baseDir = resolve(dir) + sep;
  const fullPath = resolve(dir, normalized);

  if (fullPath !== baseDir.slice(0, -1) && !fullPath.startsWith(baseDir)) {
    throw new Error('Invalid preset path.');
  }
  if (!IMAGE_EXTENSION_PATTERN.test(fullPath)) {
    throw new Error('Invalid preset path.');
  }

  return fullPath;
}

// Generates a fresh, unused file name (e.g. "01234.png") inside
// config.backend.avatarsDir for the given extension.
export async function generateAvatarFileName(extension: string): Promise<string> {
  const files = await fs.readdir(config.backend.avatarsDir);
  let num = Math.round(10000 * Math.random());
  let fileName: string;
  let maxRetries = 1000;
  do {
    num++;
    if (num >= 10000) {
      num = 0;
    }
    maxRetries--;
    if (maxRetries === 0) {
      throw new Error('Could not generate a file name.');
    }
    fileName = String(num).padStart(5, '0') + '.' + extension;
  } while (files.includes(fileName));
  return fileName;
}

// Copies a preset image into config.backend.avatarsDir under a fresh unique
// file name and returns that file name. Throws if the path is invalid,
// missing, or the image can't be decoded.
export async function createAvatarFileFromPreset(relativePath: string): Promise<string> {
  const sourcePath = resolveAvatarPresetPath(relativePath);
  const buf = await fs.readFile(sourcePath);

  const image = await read(buf);
  if (!image || !image.bitmap) {
    throw new Error('Could not decode image.');
  }

  const extension = image.getExtension();
  const fileName = await generateAvatarFileName(extension);
  await image.writeAsync(join(config.backend.avatarsDir, fileName));
  return fileName;
}
