// Conteúdo da FASE 2 (mock): a vaquinha ajudada na fase 1 já vem acompanhando desde o
// início. A meta é encontrar as amigas dela, escondidas num cercado perto do fim.
// Mesma ideia da fase 1: só dados, usando o kit genérico (levelKit.js) e as classes
// genéricas (entities.js) — nada aqui precisa mexer no motor (js/game.js).
import { Robot, Alien, TractorBeam, EnergyBlock, Companion } from '../entities.js';
import {
  TILE_SIZE,
  buildTileGrid,
  fillGroundRow,
  buildWall,
  markFloatingBlock,
  buildPitCoinArc,
  buildStarfield,
  createPressureGate,
  createShootableTrampoline,
  createCorral,
} from '../levelKit.js';

// Visual da vaca — cada fase é dona da aparência dos seus próprios companheiros/NPCs.
function drawCowShape(ctx, sx, sy, width, height) {
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(sx, sy, width, height);
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(sx + 4, sy + 4, 8, 8);
  ctx.fillRect(sx + 18, sy + 14, 10, 8);
  ctx.fillStyle = '#e79fb0';
  ctx.fillRect(sx + width - 8, sy + height - 4, 8, 6);
}

// Paleta "porão de carga / hangar" — diferente do corredor azul/ciano da fase 1.
const TILE_COLORS = { top: '#3a5c42', under: '#16241c', edge: '#8ee6a0', bottom: '#1c3324' };

export function createLevel2() {
  const widthInTiles = 74;
  const heightInTiles = 17;
  const groundRowTop = 14;
  const groundY = groundRowTop * TILE_SIZE;
  const grid = buildTileGrid(widthInTiles, heightInTiles);

  fillGroundRow(grid, groundRowTop, 0, widthInTiles - 1);
  fillGroundRow(grid, groundRowTop + 1, 0, widthInTiles - 1);
  fillGroundRow(grid, groundRowTop + 2, 0, widthInTiles - 1);

  const pits = [
    [18, 20],
    [53, 55],
  ];
  for (const [from, to] of pits) {
    for (let row = groundRowTop; row < heightInTiles; row++) {
      for (let x = from; x <= to; x++) grid[row][x] = 0;
    }
  }

  const energyCells = [...buildPitCoinArc(18, 20, groundY, 3), ...buildPitCoinArc(53, 55, groundY, 3)];

  const ENERGY_BLOCK_ROW = 10;
  const energyBlocks = [22, 63].map((col) => {
    const y = markFloatingBlock(grid, col, ENERGY_BLOCK_ROW, groundY, `energia col ${col}`);
    const block = new EnergyBlock({ x: col * TILE_SIZE, y, col, row: ENERGY_BLOCK_ROW });
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

  // Torre + trampolim: atirar no alvo (na face da torre) ativa o trampolim que fica
  // logo antes dela — o impulso é forte o bastante pra passar por CIMA da torre (mais
  // alta que qualquer pulo alcança) e aterrissar na plataforma elevada do outro lado.
  buildWall(grid, 30, 9, groundRowTop - 1);
  // Plataforma elevada: mesma altura do topo da própria torre (linha 9), formando uma
  // borda contínua — assim não importa se o quique faz o jogador aterrissar em cima da
  // torre ou um pouco além, é tudo a mesma superfície (sem depender de acertar um vão).
  fillGroundRow(grid, 9, 31, 42);
  const trampolines = [
    createShootableTrampoline({ targetX: 30 * TILE_SIZE + 5, targetY: 410, padX: 27 * TILE_SIZE, padY: groundY - 10 }),
  ];

  // Botão de pressão: só abre enquanto tiver peso em cima — dá pra estacionar um
  // companheiro ali (comando "esperar aqui", tecla C) pra segurar o portão aberto
  // enquanto o jogador vai sozinho buscar o bônus e volta. O portão só bloqueia as
  // linhas ACIMA da altura de chão (9-11, não 12-13, que é onde o corpo em pé fica) —
  // ou seja, andar por baixo dele nunca é afetado; ele só impede (ou libera) um PULO
  // pra cima até a célula de bônus flutuando logo acima. Isso evita depender de um
  // "vai e volta" preciso: o caminho principal nunca fica bloqueado por esse portão.
  const pressureGates = [
    createPressureGate({ grid, plateX: 44 * TILE_SIZE, plateY: groundY - 8, gateCol: 47, gateRows: [9, 10, 11] }),
  ];
  energyCells.push({
    x: 47 * TILE_SIZE + TILE_SIZE / 2,
    y: 10 * TILE_SIZE + TILE_SIZE / 2,
    collected: false,
    hidden: false,
    pickupRadius: 40,
  });

  // Cercado: as 3 amigas da vaquinha, liberadas de uma vez (E no gatilho) — a partir
  // daí entram na fila de seguimento (level.companions), atrás de quem já estiver nela.
  const corrals = [
    createCorral({
      triggerX: 60 * TILE_SIZE,
      triggerY: groundY - 30,
      companions: [
        new Companion({ x: 58 * TILE_SIZE, y: groundY - 30, draw: drawCowShape }),
        new Companion({ x: 59 * TILE_SIZE, y: groundY - 30, draw: drawCowShape }),
        new Companion({ x: 61 * TILE_SIZE, y: groundY - 30, draw: drawCowShape }),
      ],
    }),
  ];

  const terminals = [
    {
      x: 4 * TILE_SIZE,
      y: groundY - TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      text: 'LOG DO HANGAR: a vaquinha não para de mugir olhando pro fundo do corredor — suas amigas devem estar por aqui.',
    },
    {
      x: 25 * TILE_SIZE,
      y: groundY - TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      text: 'AVISO: torre de defesa à frente. Atire no alvo vermelho (F) pra ativar o trampolim e passar por cima.',
    },
    {
      x: 40 * TILE_SIZE,
      y: groundY - TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      text: 'DICA: pressione C pra deixar seus companheiros esperando parados — útil pra segurar um botão de pressão sozinhos.',
    },
    {
      x: 56 * TILE_SIZE,
      y: groundY - TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
      text: 'SENSOR: mugidos à frente. Muitos mugidos.',
    },
  ];

  const robots = [new Robot({ minX: 6 * TILE_SIZE, maxX: 16 * TILE_SIZE, y: groundY - 30 })];
  const aliens = [new Alien({ minX: 62 * TILE_SIZE, maxX: 70 * TILE_SIZE, baseY: 8 * TILE_SIZE, speed: 55 })];
  const tractorBeams = [new TractorBeam({ x: 65 * TILE_SIZE + 16, bottomY: groundY })];

  // A vaquinha da fase 1 já vem acompanhando desde o início — sem diálogo, ela já foi
  // "ajudada" na fase anterior. `level.npc` fica de fora (a fase não precisa de um).
  const companions = [new Companion({ x: playerStartX() - 44, y: groundY - 30, draw: drawCowShape })];

  function playerStartX() {
    return 2 * TILE_SIZE;
  }

  const exitHatch = {
    x: (widthInTiles - 4) * TILE_SIZE,
    y: groundY - TILE_SIZE * 4,
    width: TILE_SIZE,
    height: TILE_SIZE * 4,
  };

  const playerStart = { x: playerStartX(), y: groundY - 2 * TILE_SIZE };

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
    pressureGates,
    trampolines,
    corrals,
    puzzles: [],
    companions,
    exitHatch,
    playerStart,
    pixelWidth,
    pixelHeight,
    stars: buildStarfield(pixelWidth, pixelHeight, 140),
    victoryTitle: 'FASE 2 CONCLUÍDA!',
    getVictoryText: (lvl) =>
      `Reunidas! Você e ${lvl.companions.length} vaca(s) escaparam deste setor. A fuga continua na próxima fase (em breve).`,
  };
}
