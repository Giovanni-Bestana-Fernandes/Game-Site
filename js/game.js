// Motor genérico do jogo — nada aqui é específico da fase 1. Uma fase é só um objeto
// de nível (ver js/levels/phase1.js e o contrato descrito no README) produzido por uma
// função `createLevel`; `startGame(createLevel)` cuida de tudo mais: loop, câmera,
// input, arma, pausa, HUD, diálogo/escolha do NPC, portões/botões, quebra-cabeças,
// perigos, morte, vitória. Trocar ou encadear fases é só trocar/chamar `createLevel`.
import { Input } from './input.js';
import { Player } from './player.js';
import { Camera } from './camera.js';
import { Projectile, updateCompanionFollow } from './entities.js';
import { openGate, setGateOpen, updateMemoryPuzzle, registerPuzzleHeadbump } from './levelKit.js';
import {
  drawBackground,
  drawLevel,
  drawEnergyCells,
  drawTerminals,
  drawGate,
  drawExitHatch,
  drawCorral,
  drawInteractPrompt,
} from './render.js';

const INTERACT_RANGE = 46;
const INTERACT_RELEASE_RANGE = 100;

// Critérios das 3 estrelas do resultado de fase (mock — uma fase pode sobrescrever
// `level.pointsStarRatio` / `level.timeStarLimitSeconds` se quiser outro ritmo).
const DEFAULT_POINTS_STAR_RATIO = 0.6;
const DEFAULT_TIME_STAR_LIMIT_SECONDS = 45;

// Arma do jogador: F atira, Q/W/E miram diagonal-cima-esquerda / reto-pra-cima /
// diagonal-cima-direita; sem nenhum desses, atira na horizontal (pro lado que o boneco
// está de frente). Mata robôs e alienígenas (ver Robot/Alien.kill() em entities.js).
const BULLET_SPEED = 520;
const BULLET_COLOR = '#fff2a8';

// Sequência de captura do feixe: em vez de matar na hora, puxa o personagem (girando)
// até a origem do feixe (o pequeno emissor no topo) e só aí mostra a morte.
const CAPTURE_DURATION = 1.1;

// Impulso do trampolim — bem mais forte que o pulo normal (ver player.js JUMP_VELOCITY).
const TRAMPOLINE_BOUNCE_VELOCITY = -820;
const TRAMPOLINE_BOUNCE_SQUASH = 0.3;

// Dano de cada bala do jogador contra um chefe (ver Boss.takeDamage em entities.js).
const BOSS_BULLET_DAMAGE = 12;
const BOSS_INTRO_TRANSLATE_DELAY_MS = 2200;

export function startGame(createLevel) {
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
  const bossHealthEl = document.getElementById('boss-health');
  const bossNameEl = document.getElementById('boss-name');
  const bossHealthFillEl = document.getElementById('boss-health-fill');
  const bossIntroEl = document.getElementById('boss-intro');
  const bossIntroTextEl = document.getElementById('boss-intro-text');
  const bossIntroContinueBtn = document.getElementById('boss-intro-continue');

  const input = new Input();
  const camera = new Camera(canvas.width, canvas.height);

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
    const label = level.currencyLabel ?? 'Células de energia';
    energyCounterEl.textContent = `${label}: ${energyCollected}`;
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
    const pointsStarRatio = level.pointsStarRatio ?? DEFAULT_POINTS_STAR_RATIO;
    const timeStarLimitSeconds = level.timeStarLimitSeconds ?? DEFAULT_TIME_STAR_LIMIT_SECONDS;
    return [ratio >= pointsStarRatio, elapsedTime <= timeStarLimitSeconds, true];
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

  function findNearbyButtonGate() {
    const center = playerCenter();
    for (const bg of level.buttonGates) {
      if (bg.button.pressed) continue;
      const cx = bg.button.x + bg.button.width / 2;
      const cy = bg.button.y + bg.button.height / 2;
      if (distanceTo(center.x, center.y, cx, cy) < INTERACT_RANGE) return bg;
    }
    return null;
  }

  function isNearNpc() {
    const npc = level.npc;
    if (!npc || npc.helped !== null) return false;
    const center = playerCenter();
    const cx = npc.x + npc.width / 2;
    const cy = npc.y + npc.height / 2;
    return distanceTo(center.x, center.y, cx, cy) < INTERACT_RANGE;
  }

  function isNearHatch() {
    return rectOverlap(player.bounds, level.exitHatch);
  }

  function findNearbyCorral() {
    const center = playerCenter();
    for (const corral of level.corrals) {
      if (corral.released) continue;
      const t = corral.trigger;
      const cx = t.x + t.width / 2;
      const cy = t.y + t.height / 2;
      if (distanceTo(center.x, center.y, cx, cy) < INTERACT_RANGE) return corral;
    }
    return null;
  }

  // Alterna todos os companheiros ativos entre "esperar aqui" (staying) e "seguir de
  // novo" — usado, por exemplo, pra deixar um companheiro parado em cima de um botão
  // de pressão enquanto o jogador segue sozinho (ver updatePressureGates).
  function toggleCompanionsStay() {
    if (level.companions.length === 0) return;
    const shouldStay = !level.companions[0].staying;
    for (const companion of level.companions) companion.staying = shouldStay;
    flashMessage(shouldStay ? 'Os companheiros vão esperar aqui.' : 'Os companheiros vão te seguir de novo.', 1600);
  }

  function updateCompanions(dt) {
    let leader = player;
    for (const companion of level.companions) {
      updateCompanionFollow(companion, leader, dt);
      leader = companion;
    }
  }

  function updatePressureGates() {
    for (const pg of level.pressureGates) {
      const weightPresent =
        rectOverlap(player.bounds, pg.plate.bounds) || level.companions.some((c) => rectOverlap(c.bounds, pg.plate.bounds));
      pg.plate.pressed = weightPresent;
      setGateOpen(level.grid, pg.gate, weightPresent);
    }
  }

  function checkTrampolines() {
    for (const tr of level.trampolines) {
      if (!tr.pad.active) continue;
      if (player.vy >= 0 && rectOverlap(player.bounds, tr.pad.bounds)) {
        player.vy = TRAMPOLINE_BOUNCE_VELOCITY;
        player.grounded = false;
        tr.pad.bounceTimer = TRAMPOLINE_BOUNCE_SQUASH;
      }
    }
  }

  // Onda de minions: abre o portão sozinho assim que todo mundo da leva estiver morto.
  function checkMinionWaves() {
    for (const wave of level.minionWaves) {
      if (wave.cleared) continue;
      if (wave.minions.every((m) => m.dead)) {
        wave.cleared = true;
        openGate(level.grid, wave.gate);
      }
    }
  }

  function findBossTrigger() {
    if (!level.boss || level.boss.introDone || level.boss.defeatHandled) return null;
    if (!level.bossTrigger) return null;
    return rectOverlap(player.bounds, level.bossTrigger) ? level.bossTrigger : null;
  }

  // Diálogo do chefe: mostra o texto alienígena (ilegível de propósito) e troca sozinho
  // pra tradução depois de um tempo — sem escolha, só uma pausa dramática antes da luta.
  // As vacas que estavam seguindo são "capturadas" (somem de level.companions) pra não
  // atrapalhar o combate; voltam quando o chefe é derrotado (ver handleBossDefeated).
  function startBossIntro() {
    const boss = level.boss;
    gameState = 'bossintro';
    camera.shake(0.9, 16);
    level.capturedCompanions = level.companions;
    level.companions = [];
    bossNameEl.textContent = boss.name;
    bossIntroTextEl.textContent = boss.alienText;
    bossIntroEl.classList.remove('hidden');
    setTimeout(() => {
      if (gameState === 'bossintro') bossIntroTextEl.textContent = boss.translatedText;
    }, BOSS_INTRO_TRANSLATE_DELAY_MS);
  }

  function closeBossIntro() {
    if (gameState !== 'bossintro') return;
    bossIntroEl.classList.add('hidden');
    gameState = 'playing';
    level.boss.introDone = true;
  }

  function handleBossDefeated() {
    const boss = level.boss;
    if (boss.defeatHandled) return;
    boss.defeatHandled = true;
    level.companions = level.capturedCompanions ?? [];
    level.capturedCompanions = [];
    level.tractorBeams = []; // feixes de abdução do estágio 3 não devem sobreviver ao chefe
    projectiles = []; // criaturas/socos/bolas de energia já disparados também não
    if (level.bossExitGate) openGate(level.grid, level.bossExitGate);
    flashMessage('As vacas foram libertadas! Leve-as até a nave.', 3200);
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

  function handleHeadBump(col, row) {
    const block = level.energyBlocks.find((b) => b.col === col && b.row === row);
    if (block) {
      // Não coleta na hora: revela a célula escondida, que sobe pra cima do bloco e
      // fica pegável normalmente (checkEnergyCellPickup cuida do resto).
      block.reveal();
      return;
    }

    for (const puzzle of level.puzzles) {
      const puzzleBlock = puzzle.blocks.find((b) => b.col === col && b.row === row);
      if (puzzleBlock) {
        registerPuzzleHeadbump(puzzle, level.grid, puzzleBlock.index);
        return;
      }
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
    for (const bullet of playerBullets) {
      if (bullet.dead) continue;
      for (const tr of level.trampolines) {
        if (!tr.target.hit && rectOverlap(bullet.bounds, tr.target.bounds)) {
          tr.target.hit = true;
          tr.pad.active = true;
          bullet.dead = true;
          flashMessage('Trampolim ativado!', 1500);
          break;
        }
      }
    }
    if (level.boss && !level.boss.dead && level.boss.bounds) {
      for (const bullet of playerBullets) {
        if (bullet.dead) continue;
        if (rectOverlap(bullet.bounds, level.boss.bounds)) {
          level.boss.takeDamage(BOSS_BULLET_DAMAGE);
          bullet.dead = true;
          if (level.boss.dead) handleBossDefeated();
        }
      }
    }
  }

  function openNpcDialogue() {
    gameState = 'dialogue';
    const npc = level.npc;
    choiceTextEl.textContent = npc.introText;
    choiceHelpBtn.textContent = npc.helpLabel;
    choiceRefuseBtn.textContent = npc.refuseLabel;
    choiceBoxEl.classList.remove('hidden');
  }

  function resolveNpcChoice(helped) {
    const npc = level.npc;
    npc.helped = helped;
    choiceBoxEl.classList.add('hidden');
    if (helped) {
      gameState = 'playing';
      level.companions.push(npc);
      flashMessage(npc.helpText, 3200);
    } else {
      gameState = 'gameover';
      showEndScreen(npc.refuseTitle, npc.refuseText);
    }
  }

  function triggerVictory() {
    gameState = 'victory';
    const text = level.getVictoryText ? level.getVictoryText(level) : 'Você concluiu a fase!';
    showEndScreen(level.victoryTitle ?? 'FASE CONCLUÍDA!', text, computeStars());
  }

  function killPlayer() {
    if (gameState !== 'playing' && gameState !== 'captured') return;
    gameState = 'dead';
    showEndScreen('VOCÊ MORREU!', '', null);
  }

  function handleInteract(nearbyTerminal, nearbyButtonGate, nearbyCorral) {
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

    if (isNearNpc()) {
      openNpcDialogue();
      return;
    }

    if (nearbyCorral) {
      nearbyCorral.released = true;
      level.companions.push(...nearbyCorral.companions);
      flashMessage('Companheiros libertos! Eles vão te seguir.', 2000);
      return;
    }

    if (nearbyButtonGate) {
      openGate(level.grid, nearbyButtonGate.gate);
      nearbyButtonGate.button.pressed = true;
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
    if (level.boss && level.boss.bounds && rectOverlap(player.bounds, level.boss.bounds)) return killPlayer();
    for (const projectile of projectiles) {
      if (!projectile.dead && rectOverlap(player.bounds, projectile.bounds)) {
        projectile.dead = true;
        return killPlayer();
      }
    }
  }

  function resetGame() {
    level = createLevel();
    // Padrão seguro caso uma fase não defina algum desses (todos opcionais no contrato).
    level.companions ??= [];
    level.corrals ??= [];
    level.pressureGates ??= [];
    level.trampolines ??= [];
    level.minionWaves ??= [];
    level.boss ??= null;
    level.bossTrigger ??= null;
    level.bossExitGate ??= null;
    level.capturedCompanions ??= [];
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
    bossHealthEl.classList.add('hidden');
    bossIntroEl.classList.add('hidden');
    updateEnergyHUD();
    camera.follow(player, level);
  }

  choiceHelpBtn.addEventListener('click', () => resolveNpcChoice(true));
  choiceRefuseBtn.addEventListener('click', () => resolveNpcChoice(false));
  bossIntroContinueBtn.addEventListener('click', () => closeBossIntro());
  endRestartBtn.addEventListener('click', () => resetGame());

  let lastTime = performance.now();

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;

    let nearbyTerminal = null;
    let nearbyButtonGate = null;
    let nearbyCorral = null;

    if (input.pausePressed) togglePause();

    if (gameState === 'captured') {
      updateCapture(dt);
      camera.follow(player, level, dt);
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
      if (level.boss) level.boss.update(dt, player, projectiles, level);
      for (const projectile of projectiles) projectile.update(dt, level);
      projectiles = projectiles.filter((p) => !p.dead);
      for (const puzzle of level.puzzles) updateMemoryPuzzle(puzzle, dt);
      for (const tr of level.trampolines) tr.pad.update(dt);
      updateCompanions(dt);
      updatePressureGates();
      checkMinionWaves();

      if (input.shootPressed) shootBullet();
      if (input.commandPressed) toggleCompanionsStay();
      for (const bullet of playerBullets) bullet.update(dt, level);
      checkPlayerBulletHits();
      playerBullets = playerBullets.filter((b) => !b.dead);
      level.robots = level.robots.filter((r) => !r.shouldRemove);
      level.aliens = level.aliens.filter((a) => !a.shouldRemove);

      if (player.hasFallenOffLevel(level)) {
        killPlayer();
      } else {
        checkHazards();
        checkTrampolines();
      }

      camera.follow(player, level, dt);

      if (gameState === 'playing') {
        const bossTrigger = findBossTrigger();
        if (bossTrigger) startBossIntro();
        nearbyTerminal = findNearbyTerminal();
        nearbyButtonGate = findNearbyButtonGate();
        nearbyCorral = findNearbyCorral();
        handleInteract(nearbyTerminal, nearbyButtonGate, nearbyCorral);
      }
    }

    input.clearFrame();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground(ctx, canvas, level, camera);
    drawLevel(ctx, level, camera);
    drawEnergyCells(ctx, level, camera);
    drawTerminals(ctx, level, camera);
    for (const bg of level.buttonGates) drawGate(ctx, bg.gate, camera);
    for (const puzzle of level.puzzles) drawGate(ctx, puzzle.gate, camera);
    for (const pg of level.pressureGates) drawGate(ctx, pg.gate, camera);
    for (const wave of level.minionWaves) drawGate(ctx, wave.gate, camera);
    if (level.bossExitGate) drawGate(ctx, level.bossExitGate, camera);
    for (const corral of level.corrals) drawCorral(ctx, corral, camera);
    if (level.npc && level.npc.helped === null) level.npc.draw(ctx, camera);
    drawExitHatch(ctx, level, camera);

    for (const block of level.energyBlocks) block.draw(ctx, camera);
    for (const puzzle of level.puzzles) for (const block of puzzle.blocks) block.draw(ctx, camera);
    for (const bg of level.buttonGates) bg.button.draw(ctx, camera);
    for (const pg of level.pressureGates) pg.plate.draw(ctx, camera);
    for (const tr of level.trampolines) {
      tr.target.draw(ctx, camera);
      tr.pad.draw(ctx, camera);
    }
    for (const corral of level.corrals) {
      if (!corral.released) for (const companion of corral.companions) companion.draw(ctx, camera);
    }

    for (const robot of level.robots) robot.draw(ctx, camera);
    for (const alien of level.aliens) alien.draw(ctx, camera);
    for (const beam of level.tractorBeams) beam.draw(ctx, camera);
    if (level.boss) level.boss.draw(ctx, camera);
    for (const projectile of projectiles) projectile.draw(ctx, camera);
    for (const bullet of playerBullets) bullet.draw(ctx, camera);
    for (const companion of level.companions) companion.draw(ctx, camera);

    player.draw(ctx, camera);

    if (level.boss && level.boss.introDone && !level.boss.dead) {
      bossHealthEl.classList.remove('hidden');
      bossHealthFillEl.style.width = `${Math.max(0, (level.boss.hp / level.boss.maxHp) * 100)}%`;
    } else {
      bossHealthEl.classList.add('hidden');
    }

    if (gameState === 'playing' && !openMessage) {
      if (nearbyTerminal) {
        drawInteractPrompt(ctx, nearbyTerminal.x + nearbyTerminal.width / 2, nearbyTerminal.y - 12, camera);
      } else if (isNearNpc()) {
        drawInteractPrompt(ctx, level.npc.x + level.npc.width / 2, level.npc.y - 12, camera);
      } else if (nearbyCorral) {
        const t = nearbyCorral.trigger;
        drawInteractPrompt(ctx, t.x + t.width / 2, t.y - 12, camera);
      } else if (nearbyButtonGate) {
        const btn = nearbyButtonGate.button;
        drawInteractPrompt(ctx, btn.x + btn.width / 2, btn.y - 12, camera);
      } else if (isNearHatch()) {
        drawInteractPrompt(ctx, level.exitHatch.x + level.exitHatch.width / 2, level.exitHatch.y - 12, camera);
      }
    }

    requestAnimationFrame(loop);
  }

  resetGame();
  requestAnimationFrame(loop);
}
