import { Injectable } from '@angular/core';
import { MatLegacyDialog as MatDialog, MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { AvatarInfo } from '@ptcg/common';

import { ChoosePresetAvatarPopupComponent } from './choose-preset-avatar-popup.component';

@Injectable({
  providedIn: 'root'
})
export class ChoosePresetAvatarPopupService {

  constructor(public dialog: MatDialog) { }

  public openDialog(): MatDialogRef<ChoosePresetAvatarPopupComponent, AvatarInfo | undefined> {
    const dialogRef = this.dialog.open(ChoosePresetAvatarPopupComponent, {
      maxWidth: '100%',
      width: '450px'
    });

    return dialogRef;
  }
}
