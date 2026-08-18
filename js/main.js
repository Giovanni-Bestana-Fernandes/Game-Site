import { Input } from './input.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { createLevel1, openGate, updateMemoryPuzzle, registerPuzzleHeadbump } from './level.js';
import { Projectile } from './entities.js';
import {
  drawBackground,
  drawLevel,
  drawEnergyCells,
  drawTerminals,
  drawGate,
  drawCow,
  drawExitHatch,
  drawInteractPrompt,
} from './render.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const energyCounterEl = document.getElementById('energy-counter');
const messageBoxEl = document.getElementById('message-box');
const choiceBoxEl = document.getElementById('choice-box');
const choiceTextEl = document.getElementById('choice-text');
const choiceHelpBtn = document.getElementById('choice-help');
const choiceRefuseBtn = document.getElementById('choice-refuse');
const endScreenEl = document.getElementById('end-screen');
const endTitleEl = document.getElementById('end-title');
const endStarsEl = document.getElementById('end-stars');
const endTextEl = document.getElementById('end-text');
const endRestartBtn = document.getElementById('end-restart');
const pauseOverlayEl = document.getElementById('pause-overlay');

const input = new Input();
const camera = new Camera(canvas.width, canvas.height);

const INTERACT_RANGE = 46;
const INTERACT_RELEASE_RANGE = 100;

// Critérios das 3 estrelas do resultado de fase (mock — ajuste como quiser):
// uma pela proporção de células de energia coletadas, uma pelo tempo, e uma fixa.
const POINTS_STAR_RATIO = 0.6;
const TIME_STAR_LIMIT_SECONDS = 45;

// Arma do jogador (mock): F atira, Q/W/E miram diagonal-cima-esquerda / reto-pra-cima /
// diagonal-cima-direita; sem nenhum desses, atira na horizontal (pro lado que o boneco
// está de frente). Mata robôs e alienígenas — ver killEnemy() e Robot/Alien.kill().
const BULLET_SPEED = 520;
const BULLET_COLOR = '#fff2a8';

// Sequência de captura do feixe: em vez de matar na hora, puxa o personagem (girando)
// até a origem do feixe (o pequeno emissor no topo) e só aí mostra a morte.
const CAPTURE_DURATION = 1.1;

// A vaca acompanha o jogador como um pet depois de ajudada, sempre a uma distância
// fixa atrás dele (na direção de onde ele veio) até a saída.
const COW_FOLLOW_SPEED = 190;
const COW_FOLLOW_OFFSET = 44;

let level;
let player;
let projectiles;
let playerBullets;
let energyCollected;
let elapsedTime;
let gameState;
let openMessage;
let flashTimeoutId;
let captureState;

function updateEnergyHUD() {
  energyCounterEl.textContent = `Células de energia: ${energyCollected}`;
}

function showMessage(text) {
  openMessage = { text };
  messageBoxEl.textContent = text;
  messageBoxEl.classList.remove('hidden');
}

function hideMessage() {
  openMessage = null;
  messageBoxEl.classList.add('hidden');
}

function flashMessage(text, durationMs) {
  clearTimeout(flashTimeoutId);
  messageBoxEl.textContent = text;
  messageBoxEl.classList.remove('hidden');
  flashTimeoutId = setTimeout(() => {
    messageBoxEl.classList.add('hidden');
  }, durationMs);
}

function totalEnergySources() {
  return level.energyCells.length + level.energyBlocks.length;
}

function computeStars() {
  const total = totalEnergySources();
  const ratio = total > 0 ? energyCollected / total : 1;
  return [ratio >= POINTS_STAR_RATIO, elapsedTime <= TIME_STAR_LIMIT_SECONDS, true];
}

function renderStars(stars) {
  endStarsEl.innerHTML = stars
    .map((earned) => `<span class="${earned ? 'star-filled' : 'star-empty'}">★</span>`)
    .join('');
  endStarsEl.classList.remove('hidden');
}

function showEndScreen(title, text, stars = null) {
  hideMessage();
  choiceBoxEl.classList.add('hidden');
  endTitleEl.textContent = title;
  endTextEl.textContent = text;
  if (stars) {
    renderStars(stars);
  } else {
    endStarsEl.classList.add('hidden');
    endStarsEl.innerHTML = '';
  }
  endScreenEl.classList.remove('hidden');
}

function playerCenter() {
  return { x: player.x + player.width / 2, y: player.y + player.height / 2 };
}

function distanceTo(px, py, x, y) {
  return Math.hypot(px - x, py - y);
}

function rectOverlap(a, b) {
  if (!a || !b) return false;
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function findNearbyTerminal() {
  const center = playerCenter();
  let closest = null;
  let closestDist = Infinity;
  for (const terminal of level.terminals) {
    const cx = terminal.x + terminal.width / 2;
    const cy = terminal.y + terminal.height / 2;
    const dist = distanceTo(center.x, center.y, cx, cy);
    if (dist < INTERACT_RANGE && dist < closestDist) {
      closest = terminal;
      closestDist = dist;
    }
  }
  return closest;
}

function isNearCow() {
  if (level.cow.helped !== null) return false;
  const center = playerCenter();
  const cx = level.cow.x + level.cow.width / 2;
  const cy = level.cow.y + level.cow.height / 2;
  return distanceTo(center.x, center.y, cx, cy) < INTERACT_RANGE;
}

function isNearHatch() {
  return rectOverlap(player.bounds, level.exitHatch);
}

function isNearButton() {
  if (level.button.pressed) return false;
  const center = playerCenter();
  const cx = level.button.x + level.button.width / 2;
  const cy = level.button.y + level.button.height / 2;
  return distanceTo(center.x, center.y, cx, cy) < INTERACT_RANGE;
}

function togglePause() {
  if (gameState === 'playing') {
    gameState = 'paused';
    pauseOverlayEl.classList.remove('hidden');
  } else if (gameState === 'paused') {
    gameState = 'playing';
    pauseOverlayEl.classList.add('hidden');
  }
}

function startCapture(beam) {
  if (gameState !== 'playing') return;
  gameState = 'captured';
  player.vx = 0;
  player.vy = 0;
  captureState = { beam, t: 0, startX: player.x, startY: player.y };
}

function updateCapture(dt) {
  captureState.t += dt;
  const progress = Math.min(1, captureState.t / CAPTURE_DURATION);
  const beam = captureState.beam;
  const targetX = beam.x - player.width / 2;
  const targetY = beam.topY - player.height / 2;

  player.x = captureState.startX + (targetX - captureState.startX) * progress;
  player.y = captureState.startY + (targetY - captureState.startY) * progress;
  player.rotation = progress * Math.PI * 6;

  if (progress >= 1) {
    captureState = null;
    killPlayer();
  }
}

function updateCowFollow(dt) {
  if (level.cow.helped !== true) return;
  const cow = level.cow;
  const targetX = player.x - player.facing * COW_FOLLOW_OFFSET;
  const step = COW_FOLLOW_SPEED * dt;
  const dx = targetX - cow.x;
  if (Math.abs(dx) <= step) cow.x = targetX;
  else cow.x += Math.sign(dx) * step;
}

function handleHeadBump(col, row) {
  const block = level.energyBlocks.find((b) => b.col === col && b.row === row);
  if (block) {
    // Não coleta na hora: revela a célula escondida, que sobe pra cima do bloco e
    // fica pegável normalmente (checkEnergyCellPickup cuida do resto).
    block.reveal();
    return;
  }

  const puzzleBlock = level.memoryPuzzle.blocks.find((b) => b.col === col && b.row === row);
  if (puzzleBlock) {
    registerPuzzleHeadbump(level, puzzleBlock.index);
  }
}

function shootBullet() {
  let vx = 0;
  let vy = 0;
  if (input.aimUpLeft) {
    vx = -BULLET_SPEED * Math.SQRT1_2;
    vy = -BULLET_SPEED * Math.SQRT1_2;
  } else if (input.aimUpRight) {
    vx = BULLET_SPEED * Math.SQRT1_2;
    vy = -BULLET_SPEED * Math.SQRT1_2;
  } else if (input.aimUp) {
    vy = -BULLET_SPEED;
  } else {
    vx = BULLET_SPEED * player.facing;
  }

  const originX = player.x + player.width / 2 + player.facing * (player.width / 2);
  const originY = player.y + player.height / 2 - 4;
  playerBullets.push(new Projectile(originX, originY, vx, vy, 4, BULLET_COLOR));
}

function checkPlayerBulletHits() {
  for (const bullet of playerBullets) {
    if (bullet.dead) continue;
    for (const robot of level.robots) {
      if (!robot.dead && rectOverlap(bullet.bounds, robot.bounds)) {
        robot.kill();
        bullet.dead = true;
        break;
      }
    }
  }
  for (const bullet of playerBullets) {
    if (bullet.dead) continue;
    for (const alien of level.aliens) {
      if (!alien.dead && rectOverlap(bullet.bounds, alien.bounds)) {
        alien.kill();
        bullet.dead = true;
        break;
      }
    }
  }
}

function openCowDialogue() {
  gameState = 'dialogue';
  choiceTextEl.textContent = level.cow.introText;
  choiceBoxEl.classList.remove('hidden');
}

function resolveCowChoice(helped) {
  level.cow.helped = helped;
  choiceBoxEl.classList.add('hidden');
  if (helped) {
    gameState = 'playing';
    flashMessage('A vaca e as amigas vão tentar seguir você até a saída!', 3200);
  } else {
    gameState = 'gameover';
    showEndScreen(
      'FIM DE JOGO',
      'Você decidiu seguir sozinho. Os alienígenas notaram a movimentação extra na baía de contenção e você foi recapturado antes de escapar.'
    );
  }
}

function triggerVictory() {
  gameState = 'victory';
  const text =
    level.cow.helped === true
      ? 'Você e as vacas escaparam desta ala da nave! A fuga completa ainda não terminou... continua na próxima fase (em breve).'
      : 'Você escapou sozinho desta ala da nave... mas aquele mugido ainda ecoa na sua cabeça. Continua na próxima fase (em breve).';
  showEndScreen('FASE 1 CONCLUÍDA!', text, computeStars());
}

function killPlayer() {
  if (gameState !== 'playing' && gameState !== 'captured') return;
  gameState = 'dead';
  showEndScreen('VOCÊ MORREU!', '', null);
}

function handleTerminalProximity(nearbyTerminal) {
  if (openMessage && openMessage.terminal) {
    const terminal = openMessage.terminal;
    const cx = terminal.x + terminal.width / 2;
    const cy = terminal.y + terminal.height / 2;
    const center = playerCenter();
    if (distanceTo(center.x, center.y, cx, cy) > INTERACT_RELEASE_RANGE) {
      hideMessage();
    }
  }

  if (!input.interactPressed) return;

  if (nearbyTerminal) {
    if (openMessage && openMessage.terminal === nearbyTerminal) {
      hideMessage();
    } else {
      openMessage = { text: nearbyTerminal.text, terminal: nearbyTerminal };
      messageBoxEl.textContent = nearbyTerminal.text;
      messageBoxEl.classList.remove('hidden');
    }
    return;
  }

  if (isNearCow()) {
    openCowDialogue();
    return;
  }

  if (isNearButton()) {
    openGate(level);
    flashMessage('Portão aberto!', 1500);
    return;
  }

  if (isNearHatch()) {
    triggerVictory();
  }
}

function checkHazards() {
  for (const robot of level.robots) {
    if (rectOverlap(player.bounds, robot.bounds)) return killPlayer();
  }
  for (const alien of level.aliens) {
    if (rectOverlap(player.bounds, alien.bounds)) return killPlayer();
  }
  for (const beam of level.tractorBeams) {
    if (rectOverlap(player.bounds, beam.bounds)) return startCapture(beam);
  }
  for (const projectile of projectiles) {
    if (!projectile.dead && rectOverlap(player.bounds, projectile.bounds)) {
      projectile.dead = true;
      return killPlayer();
    }
  }
}

function resetGame() {
  level = createLevel1();
  player = new Player(level.playerStart.x, level.playerStart.y);
  projectiles = [];
  playerBullets = [];
  energyCollected = 0;
  elapsedTime = 0;
  gameState = 'playing';
  openMessage = null;
  captureState = null;
  clearTimeout(flashTimeoutId);

  hideMessage();
  choiceBoxEl.classList.add('hidden');
  endScreenEl.classList.add('hidden');
  endStarsEl.classList.add('hidden');
  endStarsEl.innerHTML = '';
  pauseOverlayEl.classList.add('hidden');
  updateEnergyHUD();
  camera.follow(player, level);
}

choiceHelpBtn.addEventListener('click', () => resolveCowChoice(true));
choiceRefuseBtn.addEventListener('click', () => resolveCowChoice(false));
endRestartBtn.addEventListener('click', () => resetGame());

let lastTime = performance.now();

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;

  let nearbyTerminal = null;

  if (input.pausePressed) togglePause();

  if (gameState === 'captured') {
    updateCapture(dt);
    camera.follow(player, level);
  }

  if (gameState === 'playing') {
    elapsedTime += dt;

    player.update(dt, input, level, {
      onEnergyCellCollected: () => {
        energyCollected++;
        updateEnergyHUD();
      },
      onHeadBump: handleHeadBump,
    });

    for (const robot of level.robots) robot.update(dt);
    for (const alien of level.aliens) alien.update(dt, player, projectiles);
    for (const beam of level.tractorBeams) beam.update(dt);
    for (const block of level.energyBlocks) block.update(dt);
    for (const projectile of projectiles) projectile.update(dt, level);
    projectiles = projectiles.filter((p) => !p.dead);
    updateMemoryPuzzle(level, dt);
    updateCowFollow(dt);

    if (input.shootPressed) shootBullet();
    for (const bullet of playerBullets) bullet.update(dt, level);
    checkPlayerBulletHits();
    playerBullets = playerBullets.filter((b) => !b.dead);
    level.robots = level.robots.filter((r) => !r.shouldRemove);
    level.aliens = level.aliens.filter((a) => !a.shouldRemove);

    if (player.hasFallenOffLevel(level)) {
      killPlayer();
    } else {
      checkHazards();
    }

    camera.follow(player, level);

    if (gameState === 'playing') {
      nearbyTerminal = findNearbyTerminal();
      handleTerminalProximity(nearbyTerminal);
    }
  }

  input.clearFrame();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(ctx, canvas, level, camera);
  drawLevel(ctx, level, camera);
  drawEnergyCells(ctx, level, camera);
  drawTerminals(ctx, level, camera);
  drawGate(ctx, level.gate, camera);
  drawGate(ctx, level.memoryPuzzle.gate, camera);
  drawCow(ctx, level, camera);
  drawExitHatch(ctx, level, camera);

  for (const block of level.energyBlocks) block.draw(ctx, camera);
  for (const block of level.memoryPuzzle.blocks) block.draw(ctx, camera);
  level.button.draw(ctx, camera);

  for (const robot of level.robots) robot.draw(ctx, camera);
  for (const alien of level.aliens) alien.draw(ctx, camera);
  for (const beam of level.tractorBeams) beam.draw(ctx, camera);
  for (const projectile of projectiles) projectile.draw(ctx, camera);
  for (const bullet of playerBullets) bullet.draw(ctx, camera);

  player.draw(ctx, camera);

  if (gameState === 'playing' && !openMessage) {
    if (nearbyTerminal) {
      drawInteractPrompt(ctx, nearbyTerminal.x + nearbyTerminal.width / 2, nearbyTerminal.y - 12, camera);
    } else if (isNearCow()) {
      drawInteractPrompt(ctx, level.cow.x + level.cow.width / 2, level.cow.y - 12, camera);
    } else if (isNearButton()) {
      drawInteractPrompt(ctx, level.button.x + level.button.width / 2, level.button.y - 12, camera);
    } else if (isNearHatch()) {
      drawInteractPrompt(ctx, level.exitHatch.x + level.exitHatch.width / 2, level.exitHatch.y - 12, camera);
    }
  }

  requestAnimationFrame(loop);
}

resetGame();
requestAnimationFrame(loop);
