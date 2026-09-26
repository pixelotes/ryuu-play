import { Injectable } from '@angular/core';

const PREVIEW_WIDTH = 320;
const CARD_ASPECT_RATIO = 1.37; // height / width, matches $card-aspect-ratio
const CURSOR_OFFSET = 16;

@Injectable({
  providedIn: 'root'
})
export class CardPreviewService {

  private img: HTMLImageElement;

  public show(url: string, clientX: number, clientY: number): void {
    if (!url) {
      return;
    }
    this.getImg().src = url;
    this.getImg().style.display = 'block';
    this.move(clientX, clientY);
  }

  public move(clientX: number, clientY: number): void {
    const img = this.img;
    if (!img || img.style.display === 'none') {
      return;
    }

    const width = PREVIEW_WIDTH;
    const height = PREVIEW_WIDTH * CARD_ASPECT_RATIO;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = clientX + CURSOR_OFFSET;
    if (left + width > viewportWidth) {
      left = clientX - CURSOR_OFFSET - width;
    }
    left = Math.max(0, Math.min(left, viewportWidth - width));

    let top = clientY + CURSOR_OFFSET;
    if (top + height > viewportHeight) {
      top = clientY - CURSOR_OFFSET - height;
    }
    top = Math.max(0, Math.min(top, viewportHeight - height));

    img.style.left = `${left}px`;
    img.style.top = `${top}px`;
  }

  public hide(): void {
    if (this.img) {
      this.img.style.display = 'none';
    }
  }

  private getImg(): HTMLImageElement {
    if (!this.img) {
      const img = document.createElement('img');
      img.className = 'ptcg-card-hover-preview';
      img.style.position = 'fixed';
      img.style.zIndex = '10000';
      img.style.width = `${PREVIEW_WIDTH}px`;
      img.style.pointerEvents = 'none';
      img.style.display = 'none';
      img.style.borderRadius = '4%';
      img.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.5)';
      document.body.appendChild(img);
      this.img = img;
    }
    return this.img;
  }

}
