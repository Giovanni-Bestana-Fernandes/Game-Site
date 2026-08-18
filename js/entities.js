const DEATH_DURATION = 5;
const DEATH_FADE_START = 0.6;

export class Robot {
  constructor({ minX, maxX, y, width = 26, height = 30, speed = 55 }) {
    this.x = minX;
    this.minX = minX;
    this.maxX = maxX;
    this.y = y;
    this.width = width;
    this.height = height;
    this.speed = speed;
    this.direction = 1;
    this.blinkTimer = Math.random() * 10;
    this.dead = false;
    this.deathTimer = 0;
  }

  get bounds() {
    if (this.dead) return null; // morto = intangível, não conta mais como perigo
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  get shouldRemove() {
    return this.dead && this.deathTimer <= 0;
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    this.deathTimer = DEATH_DURATION;
  }

  update(dt) {
    if (this.dead) {
      this.deathTimer = Math.max(0, this.deathTimer - dt);
      return;
    }
    this.x += this.speed * this.direction * dt;
    if (this.x <= this.minX) {
      this.x = this.minX;
      this.direction = 1;
    } else if (this.x + this.width >= this.maxX) {
      this.x = this.maxX - this.width;
      this.direction = -1;
    }
    this.blinkTimer += dt;
  }

  draw(ctx, camera) {
    const sx = Math.round(this.x - camera.x);
    const sy = Math.round(this.y - camera.y);

    if (this.dead) {
      ctx.globalAlpha = this.deathTimer < DEATH_FADE_START ? this.deathTimer / DEATH_FADE_START : 1;
      const squashY = sy + this.height * 0.45;
      ctx.fillStyle = '#4a4f58';
      ctx.fillRect(sx, squashY, this.width, this.height * 0.55);
      ctx.strokeStyle = '#8a2020';
      ctx.lineWidth = 2;
      const cx = sx + this.width / 2;
      const cy = squashY + this.height * 0.27;
      ctx.beginPath();
      ctx.moveTo(cx - 5, cy - 5);
      ctx.lineTo(cx + 5, cy + 5);
      ctx.moveTo(cx + 5, cy - 5);
      ctx.lineTo(cx - 5, cy + 5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    ctx.fillStyle = '#8a97a8';
    ctx.fillRect(sx, sy, this.width, this.height);
    ctx.fillStyle = '#5c6675';
    ctx.fillRect(sx, sy, this.width, 6);
    ctx.fillRect(sx, sy + this.height - 6, this.width, 6);

    const blink = Math.sin(this.blinkTimer * 6) > 0;
    ctx.fillStyle = blink ? '#ff3b3b' : '#701818';
    ctx.fillRect(sx + this.width / 2 - 4, sy + 11, 8, 6);

    ctx.strokeStyle = '#5c6675';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + this.width / 2, sy);
    ctx.lineTo(sx + this.width / 2, sy - 6);
    ctx.stroke();
  }
}

export class Alien {
  constructor({ minX, maxX, baseY, width = 32, height = 22, amplitude = 10, speed = 45, fireRange = 260, fireCooldown = 2.6 }) {
    this.x = minX;
    this.minX = minX;
    this.maxX = maxX;
    this.baseY = baseY;
    this.width = width;
    this.height = height;
    this.amplitude = amplitude;
    this.speed = speed;
    this.direction = 1;
    this.t = Math.random() * 10;
    this.fireRange = fireRange;
    this.fireCooldown = fireCooldown;
    this.fireTimer = fireCooldown * Math.random();
    this.dead = false;
    this.deathTimer = 0;
  }

  get y() {
    return this.baseY + Math.sin(this.t * 2) * this.amplitude;
  }

  get bounds() {
    if (this.dead) return null; // morto = intangível, não conta mais como perigo
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  get shouldRemove() {
    return this.dead && this.deathTimer <= 0;
  }

  kill() {
    if (this.dead) return;
    this.dead = true;
    this.deathTimer = DEATH_DURATION;
  }

  update(dt, player, projectiles) {
    if (this.dead) {
      this.deathTimer = Math.max(0, this.deathTimer - dt);
      return;
    }

    this.t += dt;
    this.x += this.speed * this.direction * dt;
    if (this.x <= this.minX) {
      this.x = this.minX;
      this.direction = 1;
    } else if (this.x + this.width >= this.maxX) {
      this.x = this.maxX - this.width;
      this.direction = -1;
    }

    this.fireTimer -= dt;
    const dx = Math.abs(player.x + player.width / 2 - (this.x + this.width / 2));
    if (this.fireTimer <= 0 && dx < this.fireRange) {
      this.fireTimer = this.fireCooldown;
      projectiles.push(new Projectile(this.x + this.width / 2, this.y + this.height, 0, 230));
    }
  }

  draw(ctx, camera) {
    const sx = Math.round(this.x - camera.x);
    const sy = Math.round(this.y - camera.y);

    if (this.dead) {
      ctx.globalAlpha = this.deathTimer < DEATH_FADE_START ? this.deathTimer / DEATH_FADE_START : 1;
      ctx.fillStyle = '#5a6b62';
      ctx.beginPath();
      ctx.ellipse(sx + this.width / 2, sy + this.height * 0.7, this.width / 2, this.height * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#1c3d2c';
      ctx.lineWidth = 2;
      const cy = sy + this.height * 0.65;
      ctx.beginPath();
      ctx.moveTo(sx + this.width / 2 - 9, cy - 4);
      ctx.lineTo(sx + this.width / 2 - 3, cy + 4);
      ctx.moveTo(sx + this.width / 2 - 3, cy - 4);
      ctx.lineTo(sx + this.width / 2 - 9, cy + 4);
      ctx.moveTo(sx + this.width / 2 + 3, cy - 4);
      ctx.lineTo(sx + this.width / 2 + 9, cy + 4);
      ctx.moveTo(sx + this.width / 2 + 9, cy - 4);
      ctx.lineTo(sx + this.width / 2 + 3, cy + 4);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }

    ctx.fillStyle = '#5ee6a0';
    ctx.beginPath();
    ctx.ellipse(sx + this.width / 2, sy + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1c3d2c';
    ctx.beginPath();
    ctx.arc(sx + this.width / 2 - 6, sy + this.height / 2 - 2, 4, 0, Math.PI * 2);
    ctx.arc(sx + this.width / 2 + 6, sy + this.height / 2 - 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export class Projectile {
  constructor(x, y, vx, vy, radius = 5, color = '#7cff6b') {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = radius;
    this.color = color;
    this.dead = false;
  }

  get bounds() {
    return { x: this.x - this.radius, y: this.y - this.radius, width: this.radius * 2, height: this.radius * 2 };
  }

  update(dt, level) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y - this.radius > level.pixelHeight || this.x < -50 || this.x > level.pixelWidth + 50) {
      this.dead = true;
    }
  }

  draw(ctx, camera) {
    const sx = this.x - camera.x;
    const sy = this.y - camera.y;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(sx, sy, this.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

const IDLE_DURATION = 1.4;
const WARNING_DURATION = 0.6;
const ACTIVE_DURATION = 0.9;

export class TractorBeam {
  constructor({ x, width = 48, topY = 0, bottomY }) {
    this.x = x;
    this.width = width;
    this.topY = topY;
    this.bottomY = bottomY;
    this.t = Math.random() * IDLE_DURATION;
    this.state = 'idle';
  }

  update(dt) {
    this.t += dt;
    if (this.state === 'idle' && this.t >= IDLE_DURATION) {
      this.state = 'warning';
      this.t = 0;
    } else if (this.state === 'warning' && this.t >= WARNING_DURATION) {
      this.state = 'active';
      this.t = 0;
    } else if (this.state === 'active' && this.t >= ACTIVE_DURATION) {
      this.state = 'idle';
      this.t = 0;
    }
  }

  get bounds() {
    if (this.state !== 'active') return null;
    return { x: this.x - this.width / 2, y: this.topY, width: this.width, height: this.bottomY - this.topY };
  }

  draw(ctx, camera) {
    const sx = this.x - camera.x;
    const top = this.topY - camera.y;
    const bottom = this.bottomY - camera.y;

    ctx.fillStyle = '#2b2f3a';
    ctx.fillRect(sx - 14, top - 10, 28, 10);

    if (this.state === 'idle') return;

    if (this.state === 'warning') {
      const alpha = 0.25 + 0.2 * Math.sin(this.t * 20);
      ctx.fillStyle = `rgba(255, 210, 60, ${alpha})`;
    } else {
      ctx.fillStyle = 'rgba(130, 240, 255, 0.55)';
    }
    ctx.fillRect(sx - this.width / 2, top, this.width, bottom - top);
  }
}

const ENERGY_BLOCK_POP_DURATION = 0.35;
const ENERGY_BLOCK_POP_RISE = 22; // px que a célula sobe até ficar parada acima do bloco

// Bloco sólido que solta energia quando o jogador dá uma cabeçada por baixo dele
// (ver Player.moveAxis + main.js handleHeadBump). Continua sólido depois de usado,
// só muda de aparência — igual aos blocos de item do Mario. A energia em si é a
// `cell` associada (um objeto igual aos de level.energyCells): ela começa
// `hidden` e some/oculta dentro do bloco; ao dar a cabeçada ela é revelada e sobe
// pra cima do bloco, ficando visível e pegável pelo jogador como qualquer outra
// célula (ver checkEnergyCellPickup em player.js).
export class EnergyBlock {
  constructor({ x, y, col, row, width = 32, height = 32 }) {
    this.x = x;
    this.y = y;
    this.col = col;
    this.row = row;
    this.width = width;
    this.height = height;
    this.used = false;
    this.popTimer = 0;
    this.cell = null;
  }

  get bounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  reveal() {
    if (this.used) return;
    this.used = true;
    this.popTimer = ENERGY_BLOCK_POP_DURATION;
    if (this.cell) {
      this.cell.hidden = false;
      this.cell.y = this.y + this.height / 2;
    }
  }

  update(dt) {
    if (this.popTimer > 0) {
      this.popTimer = Math.max(0, this.popTimer - dt);
      if (this.cell) {
        const progress = 1 - this.popTimer / ENERGY_BLOCK_POP_DURATION;
        this.cell.y = this.y + this.height / 2 - ENERGY_BLOCK_POP_RISE * progress;
      }
    }
  }

  draw(ctx, camera) {
    const sx = Math.round(this.x - camera.x);
    const sy = Math.round(this.y - camera.y);
    const squash = (this.popTimer / ENERGY_BLOCK_POP_DURATION) * 4;

    ctx.fillStyle = this.used ? '#2a3038' : '#0b6b7a';
    ctx.fillRect(sx, sy + squash, this.width, this.height - squash);
    ctx.strokeStyle = this.used ? '#454c56' : '#5be6ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, sy + squash, this.width - 2, this.height - squash - 1);

    ctx.beginPath();
    ctx.arc(sx + this.width / 2, sy + this.height / 2, 7, 0, Math.PI * 2);
    if (this.used) {
      ctx.strokeStyle = '#454c56';
      ctx.stroke();
    } else {
      ctx.fillStyle = '#5be6ff';
      ctx.fill();
    }
  }
}

// Um bloco do quebra-cabeça de memória (estilo Simon). `index` é a posição dele
// dentro de `puzzle.blocks`/`puzzle.sequence`; a lógica do jogo (acender em sequência,
// checar acerto/erro) vive em levelKit.js (createMemoryPuzzle/updateMemoryPuzzle/
// registerPuzzleHeadbump) — este bloco só guarda seu próprio estado visual (aceso,
// flash de acerto/erro, resolvido).
export class PuzzleBlock {
  constructor({ x, y, col, row, index, color, width = 32, height = 32 }) {
    this.x = x;
    this.y = y;
    this.col = col;
    this.row = row;
    this.index = index;
    this.color = color;
    this.width = width;
    this.height = height;
    this.lit = false;
    this.flashState = null;
    this.flashTimer = 0;
    this.solved = false;
  }

  get bounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  update(dt) {
    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - dt);
      if (this.flashTimer === 0) this.flashState = null;
    }
  }

  draw(ctx, camera) {
    const sx = Math.round(this.x - camera.x);
    const sy = Math.round(this.y - camera.y);

    let fill = this.color;
    let alpha = 1;
    if (this.solved) fill = '#ffd93d';
    else if (this.flashState === 'correct') fill = '#ffffff';
    else if (this.flashState === 'wrong') fill = '#ff3b3b';
    else if (!this.lit) alpha = 0.35;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.fillRect(sx, sy, this.width, this.height);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#0b0f16';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 1, sy + 1, this.width - 2, this.height - 2);
  }
}

// Botão/interruptor ativado com E (não por cabeçada) — associado a um portão criado
// com `createButtonGate` (levelKit.js), que abre com `openGate` quando o jogador interage.
export class Button {
  constructor({ x, y, width = 28, height = 22 }) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.pressed = false;
  }

  get bounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  draw(ctx, camera) {
    const sx = Math.round(this.x - camera.x);
    const sy = Math.round(this.y - camera.y);

    ctx.fillStyle = '#2b2f3a';
    ctx.fillRect(sx, sy, this.width, this.height);
    ctx.strokeStyle = '#5be6ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, sy, this.width, this.height);

    const leverHeight = 10;
    const leverY = this.pressed ? sy + this.height - leverHeight - 2 : sy + 2;
    ctx.fillStyle = this.pressed ? '#3fae55' : '#c94b4b';
    ctx.fillRect(sx + this.width / 2 - 4, leverY, 8, leverHeight);
  }
}

// NPC genérico de "diálogo com escolha" (a vaca da fase 1 é só um caso deste padrão).
// O visual é 100% injetado via `draw(ctx, sx, sy, width, height)` — quem cria o NPC decide
// a aparência; este objeto só cuida de posição, estado da escolha e textos.
// `helped` começa `null` (ainda não decidido); vira `true`/`false` conforme a escolha.
export class Npc {
  constructor({
    x,
    y,
    width = 32,
    height = 32,
    introText,
    helpLabel = 'Ajudar',
    refuseLabel = 'Recusar',
    helpText = '',
    refuseTitle = 'FIM DE JOGO',
    refuseText = '',
    followOffset = 44,
    followSpeed = 190,
    draw,
  }) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.introText = introText;
    this.helpLabel = helpLabel;
    this.refuseLabel = refuseLabel;
    this.helpText = helpText;
    this.refuseTitle = refuseTitle;
    this.refuseText = refuseText;
    this.followOffset = followOffset;
    this.followSpeed = followSpeed;
    this.helped = null;
    this.staying = false;
    this.facing = 1;
    this.customDraw = draw;
  }

  get bounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  draw(ctx, camera) {
    const sx = Math.round(this.x - camera.x);
    const sy = Math.round(this.y - camera.y);
    this.customDraw(ctx, sx, sy, this.width, this.height);
  }
}

// Companheiro "puro" — igual ao Npc, mas sem diálogo/escolha: já nasce pronto pra seguir
// (`helped = true`). É o que uma vaca liberada de um cercado (ver createCorral em
// levelKit.js) ou um companheiro presente desde o início da fase deve usar.
export class Companion {
  constructor({ x, y, width = 32, height = 30, followOffset = 44, followSpeed = 190, draw }) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.followOffset = followOffset;
    this.followSpeed = followSpeed;
    this.helped = true;
    this.staying = false;
    this.facing = 1;
    this.customDraw = draw;
  }

  get bounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  draw(ctx, camera) {
    const sx = Math.round(this.x - camera.x);
    const sy = Math.round(this.y - camera.y);
    this.customDraw(ctx, sx, sy, this.width, this.height);
  }
}

// Faz um companheiro (Npc já ajudado, ou Companion) seguir um "líder" — o jogador, ou o
// companheiro da frente dele na fila (assim dá pra formar uma fileira/comitiva: motor
// chama isso encadeado, cada um seguindo o de trás do anterior). Fica parado no lugar
// enquanto `staying` for true (ver comando de "esperar aqui" em js/game.js).
export function updateCompanionFollow(companion, leader, dt) {
  if (!companion || companion.helped !== true) return;
  if (companion.staying) return;
  const leaderFacing = leader.facing ?? 1;
  const targetX = leader.x - leaderFacing * companion.followOffset;
  const step = companion.followSpeed * dt;
  const dx = targetX - companion.x;
  if (Math.abs(dx) <= step) companion.x = targetX;
  else companion.x += Math.sign(dx) * step;
  if (Math.abs(dx) > 1) companion.facing = dx >= 0 ? 1 : -1;
}

// Alvo atirável (não por cabeçada — por bala, ver checkPlayerBulletHits em game.js).
// Uma vez atingido fica intangível (bounds null) pra não poder ser "readisparado"; quem
// cuida do que acontece ao ser atingido é o motor (ex.: ativar um TrampolinePad).
export class Target {
  constructor({ x, y, width = 22, height = 22 }) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.hit = false;
  }

  get bounds() {
    if (this.hit) return null;
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  draw(ctx, camera) {
    const sx = Math.round(this.x - camera.x);
    const sy = Math.round(this.y - camera.y);
    const cx = sx + this.width / 2;
    const cy = sy + this.height / 2;
    const r = this.width / 2;

    ctx.fillStyle = this.hit ? '#3a3f4a' : '#241014';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.hit ? '#5c6675' : '#ff5b6b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = this.hit ? '#5c6675' : '#ff5b6b';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Trampolim: só quica de verdade depois de `active` virar true (ver Target acima — o
// motor liga os dois). `bounceTimer` é só o squash visual de "acabou de quicar".
export class TrampolinePad {
  constructor({ x, y, width = 36, height = 10 }) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.active = false;
    this.bounceTimer = 0;
  }

  get bounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  update(dt) {
    if (this.bounceTimer > 0) this.bounceTimer = Math.max(0, this.bounceTimer - dt);
  }

  draw(ctx, camera) {
    const sx = Math.round(this.x - camera.x);
    const sy = Math.round(this.y - camera.y);
    const squash = (this.bounceTimer / 0.3) * 5;

    ctx.fillStyle = '#2b2f3a';
    ctx.fillRect(sx - 4, sy + this.height - 4, this.width + 8, 8);
    ctx.fillStyle = this.active ? '#ffb238' : '#4a4f58';
    ctx.fillRect(sx, sy + squash, this.width, this.height - squash);
    ctx.strokeStyle = this.active ? '#ffe0a0' : '#5c6675';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy + squash, this.width, this.height - squash);
  }
}

// Chefe de fase: 3 estágios (dentro do robô solta criaturas → armadura exposta soca/
// atira bola de energia → ejetado, dispara feixes de abdução em posições aleatórias).
// Fica intangível (bounds null) até `introDone` virar true (ver o diálogo alienígena em
// game.js) e some de vez (ainda intangível) depois de morto. Dano/gatilho de troca de
// estágio ficam aqui (`takeDamage`); o "o que fazer quando morre" (soltar as vacas
// capturadas, etc.) é responsabilidade do motor.
const BOSS_STAGE_THRESHOLDS = [0.66, 0.33]; // fração de vida restante que troca de estágio
const BOSS_STAGE_ATTACK_COOLDOWN = [2.2, 1.8, 1.4];
const BOSS_HOVER_SPEED = 40;

export class Boss {
  constructor({
    x,
    y,
    width = 120,
    height = 100,
    maxHp = 180,
    arenaMinX,
    arenaMaxX,
    groundY,
    name = 'CHEFE',
    alienText,
    translatedText,
  }) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.stage = 0;
    this.arenaMinX = arenaMinX;
    this.arenaMaxX = arenaMaxX;
    this.groundY = groundY;
    this.name = name;
    this.alienText = alienText;
    this.translatedText = translatedText;
    this.introDone = false;
    this.dead = false;
    this.defeatHandled = false;
    this.deathTimer = 0;
    this.direction = 1;
    this.hoverT = Math.random() * 10;
    this.attackTimer = 1.6;
    this.stageFlashTimer = 0;
  }

  get bounds() {
    if (this.dead || !this.introDone) return null; // intangível antes da intro e depois de morto
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  takeDamage(amount) {
    if (this.dead || !this.introDone) return;
    this.hp = Math.max(0, this.hp - amount);
    const remaining = this.hp / this.maxHp;
    if (this.stage === 0 && remaining <= BOSS_STAGE_THRESHOLDS[0]) {
      this.stage = 1;
      this.stageFlashTimer = 1;
    } else if (this.stage === 1 && remaining <= BOSS_STAGE_THRESHOLDS[1]) {
      this.stage = 2;
      this.stageFlashTimer = 1;
    }
    if (this.hp <= 0) {
      this.dead = true;
      this.deathTimer = 1.4;
    }
  }

  update(dt, player, projectiles, level) {
    if (this.stageFlashTimer > 0) this.stageFlashTimer = Math.max(0, this.stageFlashTimer - dt);

    if (this.dead) {
      this.deathTimer = Math.max(0, this.deathTimer - dt);
      return;
    }
    if (!this.introDone) return;

    this.hoverT += dt;
    this.y = this.groundY - this.height - 16 + Math.sin(this.hoverT) * 8;

    this.x += BOSS_HOVER_SPEED * this.direction * dt;
    if (this.x <= this.arenaMinX) {
      this.x = this.arenaMinX;
      this.direction = 1;
    } else if (this.x + this.width >= this.arenaMaxX) {
      this.x = this.arenaMaxX - this.width;
      this.direction = -1;
    }

    this.attackTimer -= dt;
    if (this.attackTimer <= 0) {
      this.performAttack(player, projectiles, level);
      this.attackTimer = BOSS_STAGE_ATTACK_COOLDOWN[this.stage];
    }
  }

  performAttack(player, projectiles, level) {
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;
    const dir = Math.sign(player.x + player.width / 2 - cx) || 1;

    if (this.stage === 0) {
      // Estágio 1 (dentro do robô): solta uma criatura mirada na posição atual do jogador.
      const originY = this.y + this.height * 0.75;
      const dx = player.x + player.width / 2 - cx;
      const dy = player.y + player.height / 2 - originY;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 210;
      projectiles.push(new Projectile(cx, originY, (dx / dist) * speed, (dy / dist) * speed, 9, '#8a5cff'));
    } else if (this.stage === 1) {
      // Estágio 2 (armadura exposta): soco (rápido, curto alcance) ou bola de energia.
      if (Math.random() < 0.5) {
        projectiles.push(new Projectile(cx, cy, dir * 300, 0, 10, '#ff9d3d'));
      } else {
        projectiles.push(new Projectile(cx, this.y + this.height * 0.8, dir * 460, 0, 14, '#ff5b5b'));
      }
    } else {
      // Estágio 3 (ejetado, nave alienígena): feixe de abdução numa posição aleatória
      // da arena — reaproveita TractorBeam, que o motor já trata como perigo genérico.
      level.tractorBeams = level.tractorBeams.filter((b) => b.state !== 'idle' || Math.random() > 0.4);
      const margin = 40;
      const beamX = this.arenaMinX + margin + Math.random() * Math.max(0, this.arenaMaxX - this.arenaMinX - margin * 2);
      level.tractorBeams.push(new TractorBeam({ x: beamX, bottomY: this.groundY }));
    }
  }

  draw(ctx, camera) {
    if (!this.introDone) return;
    const sx = Math.round(this.x - camera.x);
    const sy = Math.round(this.y - camera.y);

    if (this.dead) {
      ctx.globalAlpha = Math.min(1, this.deathTimer / 1.4);
      ctx.fillStyle = '#3a3f4a';
      ctx.fillRect(sx, sy + this.height * 0.4, this.width, this.height * 0.6);
      ctx.globalAlpha = 1;
      return;
    }

    const flash = this.stageFlashTimer > 0 && Math.floor(this.stageFlashTimer * 16) % 2 === 0;
    if (this.stage === 0) {
      ctx.fillStyle = flash ? '#ffffff' : '#5c4a8a';
      ctx.fillRect(sx, sy, this.width, this.height);
      ctx.fillStyle = '#241a3d';
      ctx.fillRect(sx + 10, sy + 14, this.width - 20, 22);
    } else if (this.stage === 1) {
      ctx.fillStyle = flash ? '#ffffff' : '#8a97a8';
      ctx.fillRect(sx, sy, this.width, this.height);
      ctx.fillStyle = '#ff9d3d';
      ctx.fillRect(sx + this.width / 2 - 10, sy + 18, 20, 16);
    } else {
      ctx.fillStyle = flash ? '#ffffff' : '#2e7d5a';
      ctx.beginPath();
      ctx.ellipse(sx + this.width / 2, sy + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ff3b3b';
    ctx.beginPath();
    ctx.arc(sx + this.width / 2 - 18, sy + this.height * 0.3, 6, 0, Math.PI * 2);
    ctx.arc(sx + this.width / 2 + 18, sy + this.height * 0.3, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Botão de pressão: fica `pressed` enquanto algo (jogador ou companheiro) estiver em
// cima dele — quem faz essa checagem a cada frame é o motor (updatePressureGates em
// game.js), que também abre/fecha o portão associado (ver createPressureGate).
export class PressurePlate {
  constructor({ x, y, width = 32, height = 8 }) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.pressed = false;
  }

  get bounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  draw(ctx, camera) {
    const sx = Math.round(this.x - camera.x);
    const sy = Math.round(this.y - camera.y);
    ctx.fillStyle = this.pressed ? '#3fae55' : '#8a97a8';
    ctx.fillRect(sx, sy + (this.pressed ? 3 : 0), this.width, this.height - (this.pressed ? 3 : 0));
    ctx.strokeStyle = '#2b2f3a';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, sy, this.width, this.height);
  }
}
