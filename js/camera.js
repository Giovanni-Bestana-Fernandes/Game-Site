export class Camera {
  constructor(viewWidth, viewHeight) {
    this.x = 0;
    this.y = 0;
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
  }

  follow(target, level) {
    const targetCenterX = target.x + target.width / 2;
    this.x = targetCenterX - this.viewWidth / 2;

    const maxX = Math.max(0, level.pixelWidth - this.viewWidth);
    const maxY = Math.max(0, level.pixelHeight - this.viewHeight);

    this.x = Math.max(0, Math.min(this.x, maxX));
    this.y = Math.max(0, Math.min(this.y, maxY));
  }
}
