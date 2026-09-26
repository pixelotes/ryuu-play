import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { AvatarInfo, AvatarPresetInfo } from '@ptcg/common';
import { TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';

import { ApiService } from '../../api/api.service';
import { AlertService } from '../../shared/alert/alert.service';
import { ApiError } from '../../api/api.error';
import { AvatarService } from '../../api/services/avatar.service';
import { SessionService } from '../../shared/session/session.service';
import { ApiErrorEnum } from '@ptcg/common';

interface PresetGroup {
  folder: string;
  presets: AvatarPresetInfo[];
}

@Component({
  selector: 'ptcg-choose-preset-avatar-popup',
  templateUrl: './choose-preset-avatar-popup.component.html',
  styleUrls: ['./choose-preset-avatar-popup.component.scss']
})
export class ChoosePresetAvatarPopupComponent implements OnInit {

  public loading = false;
  public groups: PresetGroup[] = [];
  private destroyRef = inject(DestroyRef);

  constructor(
    private alertService: AlertService,
    private apiService: ApiService,
    private avatarService: AvatarService,
    private dialogRef: MatDialogRef<ChoosePresetAvatarPopupComponent>,
    private sessionService: SessionService,
    private translate: TranslateService
  ) { }

  ngOnInit() {
    this.loading = true;
    this.avatarService.getPresets()
      .pipe(
        finalize(() => { this.loading = false; }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: response => {
          this.groups = this.groupByFolder(response.presets);
        },
        error: (error: ApiError) => {
          if (!error.handled) {
            this.alertService.toast(this.translate.instant('ERROR_UNKNOWN'));
          }
        }
      });
  }

  public getImageUrl(preset: AvatarPresetInfo): string {
    const config = this.sessionService.session.config;
    const avatarsPresetUrl = config && config.avatarsPresetUrl || '';
    return this.apiService.getApiUrl() + avatarsPresetUrl.replace('{name}', preset.path);
  }

  public selectPreset(preset: AvatarPresetInfo): void {
    if (this.loading) {
      return;
    }

    const name = this.buildAvatarName(preset);
    this.loading = true;
    this.avatarService.addPreset(name, preset.path)
      .pipe(
        finalize(() => { this.loading = false; }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: response => {
          this.dialogRef.close(response.avatar);
        },
        error: (error: ApiError) => {
          switch (error.code) {
            case ApiErrorEnum.NAME_DUPLICATE:
              this.alertService.toast(this.translate.instant('ERROR_NAME_IN_USE'));
              break;
            default:
              if (!error.handled) {
                this.alertService.toast(this.translate.instant('ERROR_UNKNOWN'));
              }
              break;
          }
        }
      });
  }

  private buildAvatarName(preset: AvatarPresetInfo): string {
    const stem = preset.fileName.replace(/\.[^.]+$/, '');
    const name: AvatarInfo['name'] = `${preset.folder}-${stem}`;
    return name.slice(0, 32);
  }

  private groupByFolder(presets: AvatarPresetInfo[]): PresetGroup[] {
    const byFolder = new Map<string, AvatarPresetInfo[]>();
    for (const preset of presets) {
      const list = byFolder.get(preset.folder) || [];
      list.push(preset);
      byFolder.set(preset.folder, list);
    }
    return Array.from(byFolder.entries())
      .map(([ folder, folderPresets ]) => ({ folder, presets: folderPresets }));
  }

}
