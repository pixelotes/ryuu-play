import { Component, ElementRef, HostListener, Input, OnDestroy } from '@angular/core';
import { Card } from '@ptcg/common';

import { CardsBaseService } from '../cards-base.service';
import { CardPreviewService } from '../card-preview/card-preview.service';

const HOVER_DELAY = 500;

@Component({
  selector: 'ptcg-card',
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.scss'],
  exportAs: 'ptcgCard'
})
export class CardComponent implements OnDestroy {

  public scanUrl: string;
  public data: Card;

  @Input() cardback = false;

  @Input() placeholder = false;

  @Input() set card(value: Card) {
    this.data = value;
    this.scanUrl = this.cardsBaseService.getScanUrl(this.data);
  }

  private hoverTimer: ReturnType<typeof setTimeout> | undefined;
  private previewVisible = false;
  private readonly onScrollCapture = () => this.onHidePreview();

  constructor(
    private cardsBaseService: CardsBaseService,
    private cardPreviewService: CardPreviewService,
    private elementRef: ElementRef<HTMLElement>,
  ) {
    // Scroll events don't bubble, so any scrollable ancestor needs a capturing listener.
    document.addEventListener('scroll', this.onScrollCapture, true);
  }

  ngOnDestroy(): void {
    this.clearHoverTimer();
    document.removeEventListener('scroll', this.onScrollCapture, true);
    if (this.previewVisible) {
      this.cardPreviewService.hide();
    }
  }

  @HostListener('mouseenter', ['$event'])
  public onMouseEnter(event: MouseEvent): void {
    this.clearHoverTimer();
    if (!this.canPreview()) {
      return;
    }
    const clientX = event.clientX;
    const clientY = event.clientY;
    this.hoverTimer = setTimeout(() => {
      this.previewVisible = true;
      this.cardPreviewService.show(this.scanUrl, clientX, clientY);
    }, HOVER_DELAY);
  }

  @HostListener('mousemove', ['$event'])
  public onMouseMove(event: MouseEvent): void {
    if (this.previewVisible) {
      this.cardPreviewService.move(event.clientX, event.clientY);
    }
  }

  @HostListener('mouseleave')
  @HostListener('mousedown')
  public onHidePreview(): void {
    this.clearHoverTimer();
    if (this.previewVisible) {
      this.previewVisible = false;
      this.cardPreviewService.hide();
    }
  }

  private canPreview(): boolean {
    if (!this.data || !this.scanUrl) {
      return false;
    }
    if (this.cardback || this.placeholder) {
      return false;
    }
    const classList = this.elementRef.nativeElement.classList;
    return !classList.contains('cardback') && !classList.contains('placeholder');
  }

  private clearHoverTimer(): void {
    if (this.hoverTimer) {
      clearTimeout(this.hoverTimer);
      this.hoverTimer = undefined;
    }
  }

}
