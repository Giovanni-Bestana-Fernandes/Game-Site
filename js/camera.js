export class Camera {
  constructor(viewWidth, viewHeight) {
    this.x = 0;
    this.y = 0;
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.shakeTimer = 0;
    this.shakeMagnitude = 0;
  }

  // Tremor de tela (ex.: entrada do chefe, transição de estágio) — não afeta a posição
  // "de verdade" da câmera, só o desenho (ver follow abaixo).
  shake(duration, magnitude) {
    this.shakeTimer = Math.max(this.shakeTimer, duration);
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
  }

  follow(target, level, dt = 0) {
    const targetCenterX = target.x + target.width / 2;
    let baseX = targetCenterX - this.viewWidth / 2;

    const maxX = Math.max(0, level.pixelWidth - this.viewWidth);
    const maxY = Math.max(0, level.pixelHeight - this.viewHeight);

    baseX = Math.max(0, Math.min(baseX, maxX));
    const baseY = Math.max(0, Math.min(0, maxY));

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      const m = this.shakeMagnitude;
      this.x = baseX + (Math.random() * 2 - 1) * m;
      this.y = baseY + (Math.random() * 2 - 1) * m;
    } else {
      this.x = baseX;
      this.y = baseY;
    }
  }
}
