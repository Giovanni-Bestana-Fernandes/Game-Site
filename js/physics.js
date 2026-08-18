export const WALK_SPEED = 170;
export const RUN_SPEED = 300;
export const ACCEL_GROUND = 1400;
export const ACCEL_AIR = 900;
export const FRICTION = 1600;
export const GRAVITY = 1450;
export const MAX_FALL_SPEED = 900;
export const JUMP_VELOCITY = -600;
export const COYOTE_TIME = 0.12;
export const JUMP_BUFFER = 0.12;
export const STAND_HEIGHT = 40;
export const CROUCH_HEIGHT = 26;
export const PLAYER_WIDTH = 22;

// Altura e tempo máximos de um pulo a partir do chão (v0^2 / 2g e 2*v0/g).
// Use como referência ao desenhar plataformas/buracos: nada pode exigir mais que isso.
export const MAX_JUMP_HEIGHT = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
export const MAX_JUMP_AIR_TIME = (2 * Math.abs(JUMP_VELOCITY)) / GRAVITY;
