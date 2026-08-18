// Conteúdo da FASE 1 (mock): fuga pelo setor de contenção da nave-mãe alienígena.
// Tudo que é específico desta fase mora aqui — posições, textos, a vaca. A física, o
// motor do jogo (js/game.js) e o kit de construção (js/levelKit.js) são genéricos;
// uma fase nova é só um arquivo assim, chamando as mesmas funções com outros números.
import { Robot, Alien, TractorBeam, EnergyBlock, Npc } from '../entities.js';
import {
  TILE_SIZE,
  buildTileGrid,
  fillGroundRow,
  markFloatingBlock,
  buildPitCoinArc,
  buildStarfield,
  createButtonGate,
  createMemoryPuzzle,
} from '../levelKit.js';

// Desenho da vaca — só a fase 1 sabe como ela se parece; pro motor do jogo ela é só
// um Npc genérico (posição, textos da escolha, "segue como pet").
function drawCowShape(ctx, sx, sy, width, height) {
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(sx, sy, width, height);
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(sx + 4, sy + 4, 8, 8);
  ctx.fillRect(sx + 18, sy + 14, 10, 8);
  ctx.fillStyle = '#e79fb0';
  ctx.fillRect(sx + width - 8, sy + height - 4, 8, 6);
}

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
      for (let x = from; x <= to; x++) grid[row][x] = 0;
    }
  }

  const energyCells = [
    ...buildPitCoinArc(18, 20, groundY, 3),
    ...buildPitCoinArc(40, 42, groundY, 3),
    ...buildPitCoinArc(63, 65, groundY, 3),
  ];

  // Blocos de energia: flutuam sozinhos sobre o caminho (chão livre por baixo) e só
  // liberam a energia com uma cabeçada. Continuam sólidos depois de usados, só mudam
  // de aparência (não desaparecem). A célula em si começa escondida dentro do bloco
  // e só é revelada — subindo pra cima dele, visível e pegável — ao ser atingido.
  const ENERGY_BLOCK_ROW = 10;
  const energyBlocks = [30, 44, 75].map((col) => {
    const y = markFloatingBlock(grid, col, ENERGY_BLOCK_ROW, groundY, `energia col ${col}`);
    const block = new EnergyBlock({ x: col * TILE_SIZE, y, col, row: ENERGY_BLOCK_ROW });
    // pickupRadius maior que o padrão (18px): o bloco é sólido, então o jogador nunca
    // consegue ficar fisicamente ao lado da célula quando ela sobe acima dele — o raio
    // maior garante que ela dê pra pegar assim que revelada.
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

  // Portão + botão: parede sólida (mais alta que o pulo alcança) que só some quando o
  // botão é pressionado com E. O botão fica antes do portão no caminho, então sempre
  // dá pra voltar e resolvê-lo — não tem como travar o jogo aqui.
  const buttonGates = [
    createButtonGate({
      grid,
      buttonX: 22 * TILE_SIZE,
      buttonY: groundY - 24,
      gateCol: 24,
      gateRows: [9, 10, 11, 12, 13],
    }),
  ];

  // Quebra-cabeça de memória (estilo Simon): 3 blocos acendem numa sequência fixa, o
  // jogador repete de cabeçada. Igual ao portão do botão, o caminho é bloqueado por uma
  // parede sólida que só abre resolvendo — não dá pra pular por cima, é obrigatório.
  const puzzles = [
    createMemoryPuzzle({
      grid,
      groundY,
      blockRow: 10,
      blockCols: [45, 46, 47],
      colors: ['#ff5b5b', '#5bff7a', '#5b9bff'],
      sequence: [0, 2, 1],
      gateCol: 49,
      gateRows: [9, 10, 11, 12, 13],
    }),
  ];

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

  const npc = new Npc({
    x: 81 * TILE_SIZE,
    y: groundY - 30,
    width: 34,
    height: 30,
    introText:
      'MUUU! Psiu, humano! Eu e minhas amigas também fomos abduzidas para experimentos. Você pode nos ajudar a fugir?',
    helpLabel: '🐄 Ajudar as vacas',
    refuseLabel: 'Seguir sozinho',
    helpText: 'A vaca e as amigas vão tentar seguir você até a saída!',
    refuseTitle: 'FIM DE JOGO',
    refuseText:
      'Você decidiu seguir sozinho. Os alienígenas notaram a movimentação extra na baía de contenção e você foi recapturado antes de escapar.',
    draw: drawCowShape,
  });

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
    buttonGates,
    puzzles,
    npc,
    exitHatch,
    playerStart,
    pixelWidth,
    pixelHeight,
    stars: buildStarfield(pixelWidth, pixelHeight, 140),
    victoryTitle: 'FASE 1 CONCLUÍDA!',
    getVictoryText: (lvl) =>
      lvl.npc?.helped === true
        ? 'Você e as vacas escaparam desta ala da nave! A fuga completa ainda não terminou... continua na próxima fase (em breve).'
        : 'Você escapou sozinho desta ala da nave... mas aquele mugido ainda ecoa na sua cabeça. Continua na próxima fase (em breve).',
  };
}
