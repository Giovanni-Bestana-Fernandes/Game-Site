// Conteúdo da FASE 3 (mock): tirar as vacas resgatadas da nave-mãe, enfrentando o chefe
// que guarda o hangar de embarque. Mesma ideia das fases anteriores: só dados, usando o
// kit genérico (levelKit.js) e as classes genéricas (entities.js) — o chefe de 3
// estágios, a onda de minions e o tremor de câmera são peças novas do MOTOR (ver
// entities.js/game.js/camera.js), não desta fase; aqui só é escolhido onde/quando usá-las.
import { Robot, Alien, Boss, Companion, EnergyBlock } from '../entities.js';
import {
  TILE_SIZE,
  buildTileGrid,
  fillGroundRow,
  buildWall,
  markFloatingBlock,
  buildPitCoinArc,
  buildStarfield,
  createMinionWave,
  createShootableTrampoline,
  createGate,
} from '../levelKit.js';

function drawCowShape(ctx, sx, sy, width, height) {
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(sx, sy, width, height);
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(sx + 4, sy + 4, 8, 8);
  ctx.fillRect(sx + 18, sy + 14, 10, 8);
  ctx.fillStyle = '#e79fb0';
  ctx.fillRect(sx + width - 8, sy + height - 4, 8, 6);
}

// Paleta "hangar de embarque" — vermelho/cinza de alerta, diferente das duas fases anteriores.
const TILE_COLORS = { top: '#5c3a3a', under: '#241616', edge: '#ff8a8a', bottom: '#331c1c' };

export function createLevel3() {
  const widthInTiles = 92;
  const heightInTiles = 17;
  const groundRowTop = 14;
  const groundY = groundRowTop * TILE_SIZE;
  const grid = buildTileGrid(widthInTiles, heightInTiles);

  fillGroundRow(grid, groundRowTop, 0, widthInTiles - 1);
  fillGroundRow(grid, groundRowTop + 1, 0, widthInTiles - 1);
  fillGroundRow(grid, groundRowTop + 2, 0, widthInTiles - 1);

  const pits = [[30, 32]];
  for (const [from, to] of pits) {
    for (let row = groundRowTop; row < heightInTiles; row++) {
      for (let x = from; x <= to; x++) grid[row][x] = 0;
    }
  }
  const energyCells = [...buildPitCoinArc(30, 32, groundY, 3)];

  const ENERGY_BLOCK_ROW = 10;
  const energyBlocks = [37].map((col) => {
    const y = markFloatingBlock(grid, col, ENERGY_BLOCK_ROW, groundY, `energia col ${col}`);
    const block = new EnergyBlock({ x: col * TILE_SIZE, y, col, row: ENERGY_BLOCK_ROW });
    const cell = { x: block.x + block.width / 2, y: block.y + block.height / 2, collected: false, hidden: true, pickupRadius: 65 };
    block.cell = cell;
    energyCells.push(cell);
    return block;
  });

  // Onda de minions: monstros de baixo nível (Robot/Alien reaproveitados) numa posição
  // um pouco aleatória cada partida — o portão em col22 só abre quando TODOS morrerem
  // (ver checkMinionWaves em game.js). Não dá pra pular por cima nem contornar.
  const minionSlots = [7, 10, 13, 16, 19];
  const minions = minionSlots.map((col, i) => {
    const jitter = Math.floor(Math.random() * 2) * TILE_SIZE;
    const cx = col * TILE_SIZE + jitter;
    if (i % 2 === 0) {
      return new Robot({ minX: cx - 24, maxX: cx + 24, y: groundY - 30, speed: 45 + Math.random() * 20 });
    }
    // fireCooldown alto: são só "monstros de baixo nível" pra abrir caminho, não pra
    // atirar de volta — a ameaça real é o chefe logo depois.
    return new Alien({
      minX: cx - 24,
      maxX: cx + 24,
      baseY: (7 + (i % 3)) * TILE_SIZE,
      speed: 45 + Math.random() * 20,
      fireCooldown: 30,
    });
  });
  const minionWaves = [createMinionWave({ grid, gateCol: 22, gateRows: [9, 10, 11, 12, 13], minions })];
  // Os minions também precisam estar em level.robots/level.aliens — é ali que o motor
  // atualiza/desenha/testa colisão de bala; minionWaves[].minions guarda as MESMAS
  // referências só pra saber quando "todo mundo morreu" (ver checkMinionWaves em game.js).
  const minionRobots = minions.filter((m) => m instanceof Robot);
  const minionAliens = minions.filter((m) => m instanceof Alien);

  const terminals = [
    {
      x: 4 * TILE_SIZE,
      y: groundY - TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      text: 'LOG DE EMBARQUE: suas vacas resgatadas estão logo atrás de você. Falta só chegar até a nave de fuga, no hangar principal.',
    },
    {
      x: 24 * TILE_SIZE,
      y: groundY - TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      text: 'AVISO: sensores detectam uma entidade de grande porte guardando o hangar. Recomenda-se cautela extrema.',
    },
    {
      x: 42 * TILE_SIZE,
      y: groundY - TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      text: 'AVISO: leituras de energia hostis logo à frente. Prepare sua arma.',
    },
    {
      x: 56 * TILE_SIZE,
      y: groundY - TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      text: 'DICA: dentro do hangar tem um trampolim — pode ajudar a escapar de ataques rasteiros durante a luta.',
    },
  ];

  // Arena do chefe: um trampolim (mesma mecânica da fase 2 — atirar no alvo ativa o
  // pad) leva a uma plataforma elevada, útil pra escapar de ataques do chão durante a
  // luta — exatamente a ideia de reaproveitar o que já foi ensinado nas fases anteriores.
  buildWall(grid, 65, 9, groundRowTop - 1);
  fillGroundRow(grid, 9, 66, 74);
  const trampolines = [
    createShootableTrampoline({ targetX: 65 * TILE_SIZE + 5, targetY: 410, padX: 62 * TILE_SIZE, padY: groundY - 10 }),
  ];

  // O chefe só flutua a partir daqui pra frente (col68) — deixa a torre do trampolim
  // (cols65-74) como um "cantinho seguro" fora do vaivém dele, pra fazer sentido usar
  // o pulo no trampolim como fuga durante a luta, sem ele atravessando por cima visualmente.
  const ARENA_MIN_X = 68 * TILE_SIZE;
  const ARENA_MAX_X = 85 * TILE_SIZE;
  const bossTrigger = { x: 57 * TILE_SIZE, y: groundY - TILE_SIZE * 2, width: TILE_SIZE, height: TILE_SIZE * 2 };
  const boss = new Boss({
    x: 76 * TILE_SIZE,
    y: groundY - 116,
    arenaMinX: ARENA_MIN_X,
    arenaMaxX: ARENA_MAX_X,
    groundY,
    name: 'COMANDANTE VORTHAX',
    alienText: "Xar'gûl ne fessk — nhu-mannos! Zoth krann ilvë ssaka droom!",
    translatedText: '"Vocês não vão tirar essas criaturas do MEU setor. Destruam os intrusos!"',
  });

  // Portão que só abre quando o chefe morre — sem ele, dava pra correr direto pra nave
  // e pular a luta inteira.
  const bossExitGate = createGate(grid, 87, [9, 10, 11, 12, 13]);

  const robots = minionRobots;
  const aliens = minionAliens;
  const tractorBeams = [];

  // As 4 vacas resgatadas na fase 2 já vêm acompanhando desde o início — capturadas
  // pelo chefe assim que a luta começa (ver startBossIntro em game.js) e libertas de
  // volta pra fila de seguimento quando ele morre (ver handleBossDefeated).
  const companions = [0, 1, 2, 3].map(
    (i) => new Companion({ x: 2 * TILE_SIZE - 44 * (i + 1), y: groundY - 30, draw: drawCowShape })
  );

  const exitHatch = { x: 88 * TILE_SIZE, y: groundY - TILE_SIZE * 4, width: TILE_SIZE, height: TILE_SIZE * 4 };
  const playerStart = { x: 2 * TILE_SIZE, y: groundY - 2 * TILE_SIZE };

  const pixelWidth = widthInTiles * TILE_SIZE;
  const pixelHeight = heightInTiles * TILE_SIZE;

  return {
    tileSize: TILE_SIZE,
    widthInTiles,
    heightInTiles,
    groundY,
    grid,
    tileColors: TILE_COLORS,
    energyCells,
    energyBlocks,
    terminals,
    robots,
    aliens,
    tractorBeams,
    buttonGates: [],
    pressureGates: [],
    trampolines,
    corrals: [],
    puzzles: [],
    minionWaves,
    boss,
    bossTrigger,
    bossExitGate,
    companions,
    exitHatch,
    playerStart,
    pixelWidth,
    pixelHeight,
    stars: buildStarfield(pixelWidth, pixelHeight, 140),
    victoryTitle: 'FASE 3 CONCLUÍDA!',
    getVictoryText: (lvl) =>
      `Vitória! ${lvl.companions.length} vaca(s) embarcaram na nave de fuga. A saga continua na próxima fase (em breve).`,
  };
}
