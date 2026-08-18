import { Robot, Alien, TractorBeam, EnergyBlock, PuzzleBlock, Button } from './entities.js';
import { JUMP_VELOCITY, GRAVITY, STAND_HEIGHT, WALK_SPEED, MAX_JUMP_HEIGHT } from './physics.js';

export const TILE_SIZE = 32;

const EMPTY = 0;
const SOLID = 1;

// Margem de segurança: uma subida "reachable" deve custar bem menos que a altura
// máxima teórica do pulo, pra sobrar espaço pro tempo de deslocamento horizontal.
const SAFE_STEP_RISE = MAX_JUMP_HEIGHT - 20;

// Timings do quebra-cabeça de memória (estilo Simon) — mock, ajuste à vontade.
const PUZZLE_IDLE_DURATION = 1.2; // pausa antes de (re)começar a mostrar a sequência
const PUZZLE_SHOW_LIT_DURATION = 0.55; // quanto tempo cada bloco fica aceso
const PUZZLE_SHOW_GAP_DURATION = 0.25; // pausa apagada entre um bloco e outro
const PUZZLE_INPUT_TIMEOUT = 10; // se o jogador sumir no meio, reinicia a demonstração
const PUZZLE_FLASH_DURATION = 0.4; // duração do flash de acerto/erro

function buildTileGrid(widthInTiles, heightInTiles) {
  const grid = [];
  for (let y = 0; y < heightInTiles; y++) {
    grid.push(new Array(widthInTiles).fill(EMPTY));
  }
  return grid;
}

function fillGroundRow(grid, row, fromCol, toCol) {
  for (let x = fromCol; x <= toCol; x++) {
    grid[row][x] = SOLID;
  }
}

// `fromTopY` é a superfície (topo de tile) de onde o jogador está pulando — chão ou
// outra plataforma. A subida real é medida a partir da cabeça do personagem em pé
// (fromTopY - STAND_HEIGHT), não da superfície em si.
function addPlatform(grid, row, fromCol, toCol, fromTopY) {
  const topY = row * TILE_SIZE;
  const rise = fromTopY - STAND_HEIGHT - topY;
  if (rise > SAFE_STEP_RISE) {
    console.warn(
      `[level] Plataforma em col ${fromCol}-${toCol} (linha ${row}) exige subida de ${rise}px, ` +
        `acima do limite seguro de ${SAFE_STEP_RISE.toFixed(0)}px (pulo máximo: ${MAX_JUMP_HEIGHT.toFixed(0)}px). Ela pode ficar inalcançável.`
    );
  }
  for (let x = fromCol; x <= toCol; x++) {
    grid[row][x] = SOLID;
  }
  return topY;
}

// Marca um único tile flutuante como sólido (bloco de energia ou de quebra-cabeça).
// A subida é medida do chão até a cabeça do jogador (mesma lógica de addPlatform),
// mas aqui não existe a margem extra de "aterrissar em cima" — pra dar uma cabeçada
// o jogador só precisa alcançar a altura do bloco, não passar por cima dele.
function markFloatingBlock(grid, col, row, fromTopY, label) {
  const topY = row * TILE_SIZE;
  const rise = fromTopY - STAND_HEIGHT - topY;
  if (rise > SAFE_STEP_RISE) {
    console.warn(
      `[level] Bloco "${label}" na coluna ${col} (linha ${row}) exige subida de ${rise}px, ` +
        `acima do limite seguro de ${SAFE_STEP_RISE.toFixed(0)}px (pulo máximo: ${MAX_JUMP_HEIGHT.toFixed(0)}px).`
    );
  }
  grid[row][col] = SOLID;
  return topY;
}

// Gera uma fileira de células de energia seguindo a parábola real do pulo do jogador,
// para que fiquem exatamente no caminho de quem está atravessando o buraco (e não flutuando
// fora de alcance). `crossSpeed` usa a velocidade de caminhada (o caso mais lento/exigente).
// Os pontos são espaçados por DISTÂNCIA real ao longo da curva (não por tempo/x), ou seja,
// a distância entre uma célula e a próxima é igual pra todas — senão elas ficariam mais
// espremidas nas pontas e mais afastadas no meio, onde o pulo sobe/desce mais devagar.
function buildPitCoinArc(fromCol, toCol, groundY, count = 4, crossSpeed = WALK_SPEED) {
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

function buildStarfield(pixelWidth, pixelHeight, count) {
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

// Nível 1 (mock): fuga pelo setor de contenção da nave-mãe alienígena.
// Todo o conteúdo aqui (posições, textos, inimigos) é só um exemplo — ajuste à vontade.
// Ao adicionar plataformas novas, use addPlatform(...) com o topo da plataforma anterior:
// ele avisa no console se a subida ficar maior que o pulo consegue alcançar.
export function createLevel1() {
  const widthInTiles = 90;
  const heightInTiles = 17;
  const groundRowTop = 14;
  const groundY = groundRowTop * TILE_SIZE;
  const grid = buildTileGrid(widthInTiles, heightInTiles);

  fillGroundRow(grid, groundRowTop, 0, widthInTiles - 1);
  fillGroundRow(grid, groundRowTop + 1, 0, widthInTiles - 1);
  fillGroundRow(grid, groundRowTop + 2, 0, widthInTiles - 1);

  // 3 blocos (96px) de largura: dá margem confortável pro pulo cruzar mesmo andando
  // (sem correr) e mesmo que o jogador aperte o pulo um pouco cedo ou um pouco tarde.
  const pits = [
    [18, 20],
    [40, 42],
    [63, 65],
  ];
  for (const [from, to] of pits) {
    for (let row = groundRowTop; row < heightInTiles; row++) {
      for (let x = from; x <= to; x++) grid[row][x] = EMPTY;
    }
  }

  const energyCells = [
    ...buildPitCoinArc(18, 20, groundY, 3),
    ...buildPitCoinArc(40, 42, groundY, 3),
    ...buildPitCoinArc(63, 65, groundY, 3),
  ];

  // Blocos de energia: flutuam sozinhos sobre o caminho (chão livre por baixo) e só
  // liberam a energia com uma cabeçada — ver Player.moveAxis + main.js handleHeadBump.
  // Continuam sólidos depois de usados, só mudam de aparência (não desaparecem). A
  // célula de energia começa escondida dentro do bloco (`hidden: true`, não desenha
  // nem pode ser pega) e só é revelada — subindo pra cima do bloco, visível e pegável
  // como qualquer outra célula — quando o bloco recebe a cabeçada (block.reveal()).
  const ENERGY_BLOCK_ROW = 10;
  const energyBlocks = [30, 44, 75].map((col) => {
    const y = markFloatingBlock(grid, col, ENERGY_BLOCK_ROW, groundY, `energia col ${col}`);
    const block = new EnergyBlock({ x: col * TILE_SIZE, y, col, row: ENERGY_BLOCK_ROW });
    // pickupRadius maior que o padrão (18px): o bloco é sólido, então o jogador nunca
    // consegue ficar fisicamente ao lado da célula quando ela sobe acima dele — o raio
    // maior garante que ela dê pra pegar assim que revelada, sem exigir uma manobra
    // impossível de "aterrissar em cima" de um bloco de 1 tile atingido por baixo.
    const cell = {
      x: block.x + block.width / 2,
      y: block.y + block.height / 2,
      collected: false,
      hidden: true,
      pickupRadius: 65,
    };
    block.cell = cell;
    energyCells.push(cell);
    return block;
  });

  // Portão + botão: o portão é uma parede sólida comum (mais alta que o pulo alcança,
  // então não dá pra pular por cima) que só some do grid quando o botão é pressionado
  // com E. O botão fica antes do portão no caminho, então é sempre possível voltar
  // e resolvê-lo — não tem como travar o jogo aqui.
  const gate = { col: 24, rows: [9, 10, 11, 12, 13], open: false };
  for (const row of gate.rows) grid[row][gate.col] = SOLID;
  const button = new Button({ x: 22 * TILE_SIZE, y: groundY - 24 });

  // Quebra-cabeça de memória (estilo Simon): os 3 blocos acendem numa sequência fixa,
  // o jogador repete a ordem de cabeçada. Igual ao portão do botão, o caminho à frente
  // é bloqueado por uma parede sólida (mais alta que o pulo alcança) que só abre quando
  // a sequência é resolvida — não dá pra pular por cima nem contornar, é obrigatório.
  const PUZZLE_BLOCK_ROW = 10;
  const puzzleColors = ['#ff5b5b', '#5bff7a', '#5b9bff'];
  const puzzleBlocks = [45, 46, 47].map((col, index) => {
    const y = markFloatingBlock(grid, col, PUZZLE_BLOCK_ROW, groundY, `quebra-cabeça col ${col}`);
    return new PuzzleBlock({ x: col * TILE_SIZE, y, col, row: PUZZLE_BLOCK_ROW, index, color: puzzleColors[index] });
  });

  const puzzleGate = { col: 49, rows: [9, 10, 11, 12, 13], open: false };
  for (const row of puzzleGate.rows) grid[row][puzzleGate.col] = SOLID;

  const memoryPuzzle = {
    blocks: puzzleBlocks,
    sequence: [0, 2, 1],
    phase: 'idle',
    t: 0,
    showIndex: 0,
    progress: 0,
    solved: false,
    gate: puzzleGate,
  };

  const terminals = [
    {
      x: 4 * TILE_SIZE,
      y: groundY - TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      text: 'LOG DA NAVE #221: "Espécime bovino não localizado na baía de contenção. Erro no feixe de captura: humano abduzido por engano."',
    },
    {
      x: 30 * TILE_SIZE,
      y: groundY - TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      text: 'AVISO: Robôs de segurança e feixes de captura patrulham este setor. Use SHIFT para correr e ESPAÇO ou W para desviar.',
    },
    {
      x: 68 * TILE_SIZE,
      y: groundY - TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      text: 'SENSOR: Sinal de vida não identificado detectado logo à frente...',
    },
  ];

  const robots = [
    new Robot({ minX: 6 * TILE_SIZE, maxX: 14 * TILE_SIZE, y: groundY - 30 }),
    new Robot({ minX: 36 * TILE_SIZE, maxX: 39 * TILE_SIZE, y: groundY - 30 }),
    new Robot({ minX: 54 * TILE_SIZE, maxX: 60 * TILE_SIZE, y: groundY - 30, speed: 70 }),
  ];

  const aliens = [
    new Alien({ minX: 26 * TILE_SIZE, maxX: 33 * TILE_SIZE, baseY: 9 * TILE_SIZE }),
    new Alien({ minX: 68 * TILE_SIZE, maxX: 78 * TILE_SIZE, baseY: 7 * TILE_SIZE, speed: 55 }),
  ];

  const tractorBeams = [
    new TractorBeam({ x: 12 * TILE_SIZE + 16, bottomY: groundY }),
    new TractorBeam({ x: 58 * TILE_SIZE + 16, bottomY: groundY }),
  ];

  const cow = {
    x: 81 * TILE_SIZE,
    y: groundY - 30,
    width: 34,
    height: 30,
    talked: false,
    helped: null,
    introText:
      'MUUU! Psiu, humano! Eu e minhas amigas também fomos abduzidas para experimentos. Você pode nos ajudar a fugir?',
  };

  const exitHatch = {
    x: (widthInTiles - 4) * TILE_SIZE,
    y: groundY - TILE_SIZE * 4,
    width: TILE_SIZE,
    height: TILE_SIZE * 4,
  };

  const playerStart = { x: 2 * TILE_SIZE, y: groundY - 2 * TILE_SIZE };

  const pixelWidth = widthInTiles * TILE_SIZE;
  const pixelHeight = heightInTiles * TILE_SIZE;

  return {
    tileSize: TILE_SIZE,
    widthInTiles,
    heightInTiles,
    groundY,
    grid,
    energyCells,
    energyBlocks,
    terminals,
    robots,
    aliens,
    tractorBeams,
    gate,
    button,
    memoryPuzzle,
    cow,
    exitHatch,
    playerStart,
    pixelWidth,
    pixelHeight,
    stars: buildStarfield(pixelWidth, pixelHeight, 140),
  };
}

export function isSolidTile(level, col, row) {
  if (row < 0 || row >= level.heightInTiles || col < 0 || col >= level.widthInTiles) return false;
  return level.grid[row][col] === SOLID;
}

export function openGate(level) {
  if (level.gate.open) return;
  level.gate.open = true;
  level.button.pressed = true;
  for (const row of level.gate.rows) level.grid[row][level.gate.col] = EMPTY;
}

export function updateMemoryPuzzle(level, dt) {
  const puzzle = level.memoryPuzzle;
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

export function registerPuzzleHeadbump(level, blockIndex) {
  const puzzle = level.memoryPuzzle;
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
      puzzle.gate.open = true;
      for (const row of puzzle.gate.rows) level.grid[row][puzzle.gate.col] = EMPTY;
    }
  } else {
    block.flashState = 'wrong';
    block.flashTimer = PUZZLE_FLASH_DURATION;
    puzzle.progress = 0;
    puzzle.phase = 'idle';
    puzzle.t = 0;
  }
}
