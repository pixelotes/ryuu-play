import { Response } from './response.interface';
import { AvatarInfo, AvatarPresetInfo } from '@ptcg/common';

export interface AvatarResponse extends Response {
  avatar: AvatarInfo;
}

export interface AvatarListResponse extends Response {
  avatars: AvatarInfo[];
}

export interface AvatarPresetListResponse extends Response {
  presets: AvatarPresetInfo[];
}
