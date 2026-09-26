export interface AvatarInfo {
  id: number;
  name: string;
  fileName: string;
}

export interface AvatarAddRequest {
  name: string;
  imageBase64: string;
}

export interface AvatarPresetInfo {
  folder: string;
  fileName: string;
  path: string;
}

export interface AvatarAddPresetRequest {
  name: string;
  path: string;
}
