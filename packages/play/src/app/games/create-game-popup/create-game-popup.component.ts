import { Component, Inject } from '@angular/core';
import { MatLegacyDialogRef as MatDialogRef, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { Format, GameSettings, Rules } from '@ptcg/common';
import { SelectPopupOption } from '../../shared/alert/select-popup/select-popup.component';
import { BotDeckListEntry, DeckListEntry } from '../../api/interfaces/deck.interface';
import { CardsBaseService } from '../../shared/cards/cards-base.service';
import { DeckService } from '../../api/services/deck.service';

export interface CreateGamePopupData {
  decks: DeckListEntry[];
  invitedBotUserId?: number;
}

export interface CreateGamePopupResult {
  deckId: number;
  gameSettings: GameSettings;
}

@Component({
  selector: 'ptcg-create-game-popup',
  templateUrl: './create-game-popup.component.html',
  styleUrls: ['./create-game-popup.component.scss']
})
export class CreateGamePopupComponent {

  public decks: DeckListEntry[];
  public deck: DeckListEntry;
  public formats: Format[];
  public format: Format;
  public settings = new GameSettings();
  public botDecks: BotDeckListEntry[] = [];
  private allDecks: DeckListEntry[];
  private allBotDecks: BotDeckListEntry[] = [];

  public timeLimits: SelectPopupOption<number>[] = [
    { value: 0, viewValue: 'GAMES_LIMIT_NO_LIMIT' },
    { value: 600, viewValue: 'GAMES_LIMIT_10_MIN' },
    { value: 1200, viewValue: 'GAMES_LIMIT_20_MIN' },
    { value: 1800, viewValue: 'GAMES_LIMIT_30_MIN' }
  ];

  constructor(
    cardsBaseService: CardsBaseService,
    private deckService: DeckService,
    private dialogRef: MatDialogRef<CreateGamePopupComponent>,
    @Inject(MAT_DIALOG_DATA) data: CreateGamePopupData,
  ) {
    this.allDecks = data.decks;

    // Don't show formats without any deck
    this.formats = cardsBaseService.getAllFormats().filter(format =>
      this.allDecks.some(deck => deck.formatNames.includes(format.name)));

    // All cards format
    this.formats.push({
      name: '',
      cards: [],
      rules: new Rules(),
      ranges: []
    });

    this.onFormatChange(this.formats[0]);

    if (data.invitedBotUserId !== undefined) {
      this.deckService.getBotDecks(data.invitedBotUserId).subscribe({
        next: response => {
          if (response.ok) {
            this.allBotDecks = response.decks;
            this.updateBotDecks();
          }
        }
      });
    }
  }

  public confirm() {
    this.dialogRef.close({
      formatName: this.format.name,
      deckId: this.deck.id,
      gameSettings: this.settings
    });
  }

  public cancel() {
    this.dialogRef.close();
  }

  public onFormatChange(format: Format) {
    this.format = format;
    this.deck = this.getDeckFromFormat(format);
    this.settings.rules = new Rules({ ...format.rules, formatName: format.name });
    this.decks = format.name
      ? this.allDecks.filter(deck => deck.formatNames.includes(format.name))
      : this.allDecks;
    this.updateBotDecks();
  }

  private getDeckFromFormat(format: Format): DeckListEntry {
    if (!format.name) {
      return this.deck || this.allDecks[0];
    }
    if (!this.deck || !this.deck.formatNames.includes(format.name)) {
      return this.allDecks.find(deck => deck.formatNames.includes(this.format.name));
    }
    return this.deck;
  }

  private updateBotDecks() {
    this.botDecks = this.format && this.format.name
      ? this.allBotDecks.filter(deck => deck.formatNames.includes(this.format.name))
      : this.allBotDecks;

    // Reset to "Random" if the previously selected bot deck is no longer valid for this format
    if (this.settings.botDeckId !== undefined && !this.botDecks.some(deck => deck.id === this.settings.botDeckId)) {
      this.settings.botDeckId = undefined;
    }
  }

}
