// Kit genérico de construção de nível — nada aqui é específico da fase 1.
// Uma fase nova (js/levels/faseX.js) monta seu grid/objetos chamando essas funções;
// o "motor" do jogo (js/game.js) só sabe consumir o formato que elas produzem.
import { PuzzleBlock, Button } from './entities.js';
import { JUMP_VELOCITY, GRAVITY, STAND_HEIGHT, WALK_SPEED, MAX_JUMP_HEIGHT } from './physics.js';

export const TILE_SIZE = 32;
export const EMPTY = 0;
export const SOLID = 1;

// Margem de segurança: uma subida "reachable" deve custar bem menos que a altura
// máxima teórica do pulo, pra sobrar espaço pro tempo de deslocamento horizontal.
const SAFE_STEP_RISE = MAX_JUMP_HEIGHT - 20;

// Timings padrão do quebra-cabeça de memória (estilo Simon) — dá pra sobrescrever
// passando os campos correspondentes pra createMemoryPuzzle se uma fase quiser outro ritmo.
const PUZZLE_IDLE_DURATION = 1.2; // pausa antes de (re)começar a mostrar a sequência
const PUZZLE_SHOW_LIT_DURATION = 0.55; // quanto tempo cada bloco fica aceso
const PUZZLE_SHOW_GAP_DURATION = 0.25; // pausa apagada entre um bloco e outro
const PUZZLE_INPUT_TIMEOUT = 10; // se o jogador sumir no meio, reinicia a demonstração
const PUZZLE_FLASH_DURATION = 0.4; // duração do flash de acerto/erro

export function isSolidTile(level, col, row) {
  if (row < 0 || row >= level.heightInTiles || col < 0 || col >= level.widthInTiles) return false;
  return level.grid[row][col] === SOLID;
}

export function buildTileGrid(widthInTiles, heightInTiles) {
  const grid = [];
  for (let y = 0; y < heightInTiles; y++) {
    grid.push(new Array(widthInTiles).fill(EMPTY));
  }
  return grid;
}

export function fillGroundRow(grid, row, fromCol, toCol) {
  for (let x = fromCol; x <= toCol; x++) {
    grid[row][x] = SOLID;
  }
}

// `fromTopY` é a superfície (topo de tile) de onde o jogador está pulando — chão ou
// outra plataforma. A subida real é medida a partir da cabeça do personagem em pé
// (fromTopY - STAND_HEIGHT), não da superfície em si. Avisa no console se a plataforma
// ficar mais alta do que o pulo alcança.
export function addPlatform(grid, row, fromCol, toCol, fromTopY) {
  const topY = row * TILE_SIZE;
  const rise = fromTopY - STAND_HEIGHT - topY;
  if (rise > SAFE_STEP_RISE) {
    console.warn(
      `[levelKit] Plataforma em col ${fromCol}-${toCol} (linha ${row}) exige subida de ${rise}px, ` +
        `acima do limite seguro de ${SAFE_STEP_RISE.toFixed(0)}px (pulo máximo: ${MAX_JUMP_HEIGHT.toFixed(0)}px). Ela pode ficar inalcançável.`
    );
  }
  for (let x = fromCol; x <= toCol; x++) {
    grid[row][x] = SOLID;
  }
  return topY;
}

// Marca um único tile flutuante como sólido (bloco de energia, bloco de quebra-cabeça
// etc). Mesma lógica de altura de addPlatform, mas sem a margem extra de "aterrissar em
// cima" — pra dar uma cabeçada o jogador só precisa alcançar a altura do bloco.
export function markFloatingBlock(grid, col, row, fromTopY, label) {
  const topY = row * TILE_SIZE;
  const rise = fromTopY - STAND_HEIGHT - topY;
  if (rise > SAFE_STEP_RISE) {
    console.warn(
      `[levelKit] Bloco "${label}" na coluna ${col} (linha ${row}) exige subida de ${rise}px, ` +
        `acima do limite seguro de ${SAFE_STEP_RISE.toFixed(0)}px (pulo máximo: ${MAX_JUMP_HEIGHT.toFixed(0)}px).`
    );
  }
  grid[row][col] = SOLID;
  return topY;
}

// Gera uma fileira de células de energia seguindo a parábola real do pulo do jogador,
// espaçadas por DISTÂNCIA real ao longo da curva (não por tempo/x) — assim ficam
// exatamente no caminho de quem está atravessando o buraco, com espaçamento igual
// entre elas, e não flutuando fora de alcance ou espremidas de um lado.
export function buildPitCoinArc(fromCol, toCol, groundY, count = 4, crossSpeed = WALK_SPEED) {
  const takeoffX = fromCol * TILE_SIZE;
  const landingX = (toCol + 1) * TILE_SIZE;
  const maxAirTime = (2 * Math.abs(JUMP_VELOCITY)) / GRAVITY;
  const crossTime = Math.min((landingX - takeoffX) / crossSpeed, maxAirTime);
  const playerTopStart = groundY - STAND_HEIGHT;

  const pointAt = (t) => ({
    x: takeoffX + crossSpeed * t,
    y: playerTopStart + JUMP_VELOCITY * t + 0.5 * GRAVITY * t * t + STAND_HEIGHT / 2,
  });

  const SAMPLES = 200;
  const samples = [pointAt(0)];
  const cumulative = [0];
  for (let i = 1; i <= SAMPLES; i++) {
    const point = pointAt((crossTime * i) / SAMPLES);
    const prev = samples[i - 1];
    cumulative.push(cumulative[i - 1] + Math.hypot(point.x - prev.x, point.y - prev.y));
    samples.push(point);
  }
  const totalLength = cumulative[SAMPLES];

  const cells = [];
  for (let i = 1; i <= count; i++) {
    const targetLength = (totalLength * i) / (count + 1);
    let segment = SAMPLES - 1;
    for (let s = 0; s < SAMPLES; s++) {
      if (cumulative[s + 1] >= targetLength) {
        segment = s;
        break;
      }
    }
    const segStart = cumulative[segment];
    const segEnd = cumulative[segment + 1];
    const localT = segEnd > segStart ? (targetLength - segStart) / (segEnd - segStart) : 0;
    const a = samples[segment];
    const b = samples[segment + 1];
    cells.push({
      x: a.x + (b.x - a.x) * localT,
      y: a.y + (b.y - a.y) * localT,
      collected: false,
    });
  }
  return cells;
}

export function buildStarfield(pixelWidth, pixelHeight, count) {
  const stars = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * pixelWidth * 1.4,
      y: Math.random() * pixelHeight * 0.85,
      radius: Math.random() < 0.15 ? 2 : 1,
    });
  }
  return stars;
}

// Portão + botão: o portão é uma parede sólida comum (mais alta que o pulo alcança,
// então não dá pra pular por cima) que só abre quando alguém chama openGate — o motor
// do jogo faz isso quando o jogador interage com o botão associado.
export function createButtonGate({ grid, buttonX, buttonY, gateCol, gateRows }) {
  const gate = { col: gateCol, rows: gateRows, open: false };
  for (const row of gateRows) grid[row][gateCol] = SOLID;
  const button = new Button({ x: buttonX, y: buttonY });
  return { button, gate };
}

export function openGate(grid, gate) {
  if (gate.open) return;
  gate.open = true;
  for (const row of gate.rows) grid[row][gate.col] = EMPTY;
}

// Quebra-cabeça de memória (estilo Simon): `blockCols` vira um bloco cada, acendendo na
// ordem de `sequence` (índices em blockCols); o jogador repete de cabeçada. Resolver abre
// um portão (mesmo conceito do botão, mas sem botão — abre sozinho ao completar a sequência).
export function createMemoryPuzzle({
  grid,
  groundY,
  blockRow,
  blockCols,
  colors,
  sequence,
  gateCol,
  gateRows,
  label = 'quebra-cabeça',
}) {
  const blocks = blockCols.map((col, index) => {
    const y = markFloatingBlock(grid, col, blockRow, groundY, `${label} col ${col}`);
    return new PuzzleBlock({ x: col * TILE_SIZE, y, col, row: blockRow, index, color: colors[index] });
  });

  const gate = { col: gateCol, rows: gateRows, open: false };
  for (const row of gateRows) grid[row][gateCol] = SOLID;

  return {
    blocks,
    sequence,
    phase: 'idle',
    t: 0,
    showIndex: 0,
    progress: 0,
    solved: false,
    gate,
  };
}

export function updateMemoryPuzzle(puzzle, dt) {
  for (const block of puzzle.blocks) block.update(dt);
  if (puzzle.solved) return;

  puzzle.t += dt;

  if (puzzle.phase === 'idle') {
    if (puzzle.t >= PUZZLE_IDLE_DURATION) {
      puzzle.phase = 'showing';
      puzzle.t = 0;
      puzzle.showIndex = 0;
    }
    return;
  }

  if (puzzle.phase === 'showing') {
    const stepDuration = PUZZLE_SHOW_LIT_DURATION + PUZZLE_SHOW_GAP_DURATION;
    const stepIndex = Math.floor(puzzle.t / stepDuration);
    if (stepIndex >= puzzle.sequence.length) {
      for (const block of puzzle.blocks) block.lit = false;
      puzzle.phase = 'input';
      puzzle.t = 0;
      puzzle.progress = 0;
      return;
    }
    const withinStep = puzzle.t - stepIndex * stepDuration;
    const activeIndex = puzzle.sequence[stepIndex];
    for (const block of puzzle.blocks) {
      block.lit = block.index === activeIndex && withinStep < PUZZLE_SHOW_LIT_DURATION;
    }
    return;
  }

  if (puzzle.phase === 'input' && puzzle.t >= PUZZLE_INPUT_TIMEOUT) {
    puzzle.phase = 'idle';
    puzzle.t = 0;
    puzzle.progress = 0;
  }
}

export function registerPuzzleHeadbump(puzzle, grid, blockIndex) {
  if (puzzle.solved || puzzle.phase !== 'input') return;

  const block = puzzle.blocks[blockIndex];
  const expected = puzzle.sequence[puzzle.progress];

  if (blockIndex === expected) {
    block.flashState = 'correct';
    block.flashTimer = PUZZLE_FLASH_DURATION;
    puzzle.progress++;
    if (puzzle.progress >= puzzle.sequence.length) {
      puzzle.solved = true;
      for (const b of puzzle.blocks) b.solved = true;
      openGate(grid, puzzle.gate);
    }
  } else {
    block.flashState = 'wrong';
    block.flashTimer = PUZZLE_FLASH_DURATION;
    puzzle.progress = 0;
    puzzle.phase = 'idle';
    puzzle.t = 0;
  }
}
