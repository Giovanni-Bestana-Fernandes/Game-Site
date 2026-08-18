export class Input {
  constructor() {
    this.keys = new Set();
    this.justPressed = new Set();

    window.addEventListener('keydown', (e) => {
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  isDown(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.justPressed.has(code);
  }

  clearFrame() {
    this.justPressed.clear();
  }

  get moveLeft() {
    return this.isDown('KeyA');
  }

  get moveRight() {
    return this.isDown('KeyD');
  }

  get crouch() {
    return this.isDown('KeyS');
  }

  get jumpPressed() {
    return this.wasPressed('Space') || this.wasPressed('KeyW');
  }

  get running() {
    return this.isDown('ShiftLeft') || this.isDown('ShiftRight');
  }

  // F virou o gatilho da arma (ver shootPressed) — E sozinho cuida de interagir agora.
  get interactPressed() {
    return this.wasPressed('KeyE');
  }

  get shootPressed() {
    return this.wasPressed('KeyF');
  }

  // Direção da mira ao atirar: Q = diagonal cima-esquerda, E = diagonal cima-direita,
  // W = reto pra cima. Sem nenhum desses segurado, mira na horizontal (facing do boneco).
  get aimUpLeft() {
    return this.isDown('KeyQ');
  }

  get aimUpRight() {
    return this.isDown('KeyE');
  }

  get aimUp() {
    return this.isDown('KeyW');
  }

  get pausePressed() {
    return this.wasPressed('Escape');
  }
}
