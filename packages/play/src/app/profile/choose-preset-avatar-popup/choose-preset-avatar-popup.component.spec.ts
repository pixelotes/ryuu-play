import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef } from '@angular/material/legacy-dialog';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ChoosePresetAvatarPopupComponent } from './choose-preset-avatar-popup.component';
import { AlertModule } from '../../shared/alert/alert.module';
import { ApiModule } from '../../api/api.module';
import { AvatarService } from '../../api/services/avatar.service';
import { SessionService } from '../../shared/session/session.service';

describe('ChoosePresetAvatarPopupComponent', () => {
  let component: ChoosePresetAvatarPopupComponent;
  let fixture: ComponentFixture<ChoosePresetAvatarPopupComponent>;
  let avatarServiceSpy: jasmine.SpyObj<AvatarService>;
  let sessionService: SessionService;
  let dialogRef: jasmine.SpyObj<MatDialogRef<ChoosePresetAvatarPopupComponent>>;

  beforeEach(waitForAsync(() => {
    avatarServiceSpy = jasmine.createSpyObj('AvatarService', ['getPresets', 'addPreset']);
    avatarServiceSpy.getPresets.and.returnValue(of({
      ok: true,
      presets: [
        { folder: 'tux', fileName: 'tux01.png', path: 'tux/tux01.png' },
        { folder: 'tux', fileName: 'tux02.png', path: 'tux/tux02.png' },
        { folder: 'default', fileName: 'face01.png', path: 'default/face01.png' }
      ]
    } as any));
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    TestBed.configureTestingModule({
      imports: [
        ApiModule,
        AlertModule,
        TranslateModule.forRoot()
      ],
      declarations: [ ChoosePresetAvatarPopupComponent ],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: AvatarService, useValue: avatarServiceSpy }
      ],
      schemas: [ CUSTOM_ELEMENTS_SCHEMA ]
    })
    .compileComponents();

    sessionService = TestBed.inject(SessionService);
    sessionService.set({ config: { avatarsPresetUrl: '/avatars-preset/{name}' } as any });
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ChoosePresetAvatarPopupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('groups presets by folder', () => {
    expect(component.groups).toEqual([
      { folder: 'tux', presets: [
        { folder: 'tux', fileName: 'tux01.png', path: 'tux/tux01.png' },
        { folder: 'tux', fileName: 'tux02.png', path: 'tux/tux02.png' }
      ] },
      { folder: 'default', presets: [
        { folder: 'default', fileName: 'face01.png', path: 'default/face01.png' }
      ] }
    ]);
  });

  it('closes the dialog with the created avatar when a preset is picked', () => {
    const avatar = { id: 1, name: 'tux-tux01', fileName: '01234.png' };
    avatarServiceSpy.addPreset.and.returnValue(of({ ok: true, avatar } as any));

    component.selectPreset({ folder: 'tux', fileName: 'tux01.png', path: 'tux/tux01.png' });

    expect(avatarServiceSpy.addPreset).toHaveBeenCalledWith('tux-tux01', 'tux/tux01.png');
    expect(dialogRef.close).toHaveBeenCalledWith(avatar);
  });
});
