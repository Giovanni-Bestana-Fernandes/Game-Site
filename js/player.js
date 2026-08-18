import { TILE_SIZE, isSolidTile } from './levelKit.js';
import {
  WALK_SPEED,
  RUN_SPEED,
  ACCEL_GROUND,
  ACCEL_AIR,
  FRICTION,
  GRAVITY,
  MAX_FALL_SPEED,
  JUMP_VELOCITY,
  COYOTE_TIME,
  JUMP_BUFFER,
  STAND_HEIGHT,
  CROUCH_HEIGHT,
  PLAYER_WIDTH as WIDTH,
} from './physics.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = WIDTH;
    this.height = STAND_HEIGHT;
    this.vx = 0;
    this.vy = 0;
    this.grounded = false;
    this.facing = 1;
    this.crouching = false;
    this.isRunning = false;
    this.alive = true;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.rotation = 0; // usado na animação de captura do feixe (main.js updateCapture)
  }

  get bounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  get feetY() {
    return this.y + this.height;
  }

  update(dt, input, level, callbacks = {}) {
    this.updateJumpTimers(dt, input);
    this.handleCrouch(input, level);
    this.handleHorizontalMovement(dt, input);
    this.handleJump();

    this.vy += GRAVITY * dt;
    if (this.vy > MAX_FALL_SPEED) this.vy = MAX_FALL_SPEED;

    this.moveAxis(dt, 'x', level);
    this.grounded = false;
    this.moveAxis(dt, 'y', level, callbacks.onHeadBump);

    this.checkEnergyCellPickup(level, callbacks.onEnergyCellCollected);
  }

  hasFallenOffLevel(level) {
    return this.y > level.pixelHeight + 200;
  }

  handleCrouch(input, level) {
    const wantsCrouch = input.crouch && this.grounded;
    if (wantsCrouch === this.crouching) return;

    const previousHeight = this.height;
    const newHeight = wantsCrouch ? CROUCH_HEIGHT : STAND_HEIGHT;

    if (!wantsCrouch) {
      const testY = this.y - (newHeight - previousHeight);
      if (this.rectCollidesLevel(this.x, testY, this.width, newHeight, level)) {
        return;
      }
    }

    this.y -= newHeight - previousHeight;
    this.height = newHeight;
    this.crouching = wantsCrouch;
  }

  handleHorizontalMovement(dt, input) {
    this.isRunning = input.running && !this.crouching;
    const maxSpeed = this.crouching ? WALK_SPEED * 0.5 : this.isRunning ? RUN_SPEED : WALK_SPEED;
    const accel = this.grounded ? ACCEL_GROUND : ACCEL_AIR;

    let dir = 0;
    if (input.moveLeft) dir -= 1;
    if (input.moveRight) dir += 1;

    if (dir !== 0) {
      this.facing = dir;
      this.vx += dir * accel * dt;
      const clamped = Math.max(-maxSpeed, Math.min(maxSpeed, this.vx));
      this.vx = clamped;
    } else {
      const friction = FRICTION * dt;
      if (Math.abs(this.vx) <= friction) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * friction;
    }
  }

  updateJumpTimers(dt, input) {
    this.coyoteTimer = this.grounded ? COYOTE_TIME : Math.max(0, this.coyoteTimer - dt);
    this.jumpBufferTimer = input.jumpPressed ? JUMP_BUFFER : Math.max(0, this.jumpBufferTimer - dt);
  }

  handleJump() {
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.vy = JUMP_VELOCITY;
      this.grounded = false;
      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
    }
  }

  moveAxis(dt, axis, level, onHeadBump) {
    const delta = (axis === 'x' ? this.vx : this.vy) * dt;
    if (delta === 0) return;

    if (axis === 'x') {
      this.x += delta;
    } else {
      this.y += delta;
    }

    const collision = this.findCollision(level);
    if (!collision) return;

    if (axis === 'x') {
      if (delta > 0) this.x = collision.col * TILE_SIZE - this.width;
      else this.x = (collision.col + 1) * TILE_SIZE;
      this.vx = 0;
    } else {
      if (delta > 0) {
        this.y = collision.row * TILE_SIZE - this.height;
        this.grounded = true;
      } else {
        this.y = (collision.row + 1) * TILE_SIZE;
        if (onHeadBump) onHeadBump(collision.col, collision.row);
      }
      this.vy = 0;
    }
  }

  findCollision(level) {
    const minCol = Math.floor(this.x / TILE_SIZE);
    const maxCol = Math.floor((this.x + this.width - 1) / TILE_SIZE);
    const minRow = Math.floor(this.y / TILE_SIZE);
    const maxRow = Math.floor((this.y + this.height - 1) / TILE_SIZE);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (isSolidTile(level, col, row)) {
          return { col, row };
        }
      }
    }
    return null;
  }

  rectCollidesLevel(x, y, width, height, level) {
    const minCol = Math.floor(x / TILE_SIZE);
    const maxCol = Math.floor((x + width - 1) / TILE_SIZE);
    const minRow = Math.floor(y / TILE_SIZE);
    const maxRow = Math.floor((y + height - 1) / TILE_SIZE);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (isSolidTile(level, col, row)) return true;
      }
    }
    return false;
  }

  checkEnergyCellPickup(level, onEnergyCellCollected) {
    for (const cell of level.energyCells) {
      if (cell.collected || cell.hidden) continue;
      const dx = cell.x - (this.x + this.width / 2);
      const dy = cell.y - (this.y + this.height / 2);
      if (Math.hypot(dx, dy) < (cell.pickupRadius ?? 18)) {
        cell.collected = true;
        onEnergyCellCollected();
      }
    }
  }

  draw(ctx, camera) {
    const screenX = Math.round(this.x - camera.x);
    const screenY = Math.round(this.y - camera.y);

    ctx.save();
    if (this.rotation) {
      const cx = screenX + this.width / 2;
      const cy = screenY + this.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate(this.rotation);
      ctx.translate(-cx, -cy);
    }

    ctx.fillStyle = '#e63946';
    ctx.fillRect(screenX, screenY, this.width, this.height);

    ctx.fillStyle = '#ffffff';
    const eyeSize = 4;
    const eyeY = screenY + 8;
    const eyeX = this.facing === 1 ? screenX + this.width - eyeSize - 3 : screenX + 3;
    ctx.fillRect(eyeX, eyeY, eyeSize, eyeSize);
    ctx.restore();
  }
}
