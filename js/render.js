import { TILE_SIZE } from './level.js';

export function drawBackground(ctx, canvas, level, camera) {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#04040c');
  gradient.addColorStop(1, '#12122a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const parallax = 0.3;
  ctx.fillStyle = '#cfd8ff';
  for (const star of level.stars) {
    const sx = (star.x - camera.x * parallax) % (canvas.width + 60);
    const sy = star.y - camera.y * parallax;
    ctx.globalAlpha = star.radius > 1 ? 0.9 : 0.5;
    ctx.fillRect(sx, sy, star.radius, star.radius);
  }
  ctx.globalAlpha = 1;
}

export function drawLevel(ctx, level, camera) {
  const firstCol = Math.floor(camera.x / TILE_SIZE);
  const lastCol = Math.ceil((camera.x + camera.viewWidth) / TILE_SIZE);
  const firstRow = Math.floor(camera.y / TILE_SIZE);
  const lastRow = Math.ceil((camera.y + camera.viewHeight) / TILE_SIZE);

  for (let row = Math.max(0, firstRow); row <= Math.min(level.heightInTiles - 1, lastRow); row++) {
    for (let col = Math.max(0, firstCol); col <= Math.min(level.widthInTiles - 1, lastCol); col++) {
      if (level.grid[row][col] !== 1) continue;
      const screenX = Math.round(col * TILE_SIZE - camera.x);
      const screenY = Math.round(row * TILE_SIZE - camera.y);
      const isTopTile = row === 0 || level.grid[row - 1][col] !== 1;

      ctx.fillStyle = isTopTile ? '#3d4a5c' : '#1c222c';
      ctx.fillRect(screenX, screenY, TILE_SIZE, TILE_SIZE);

      if (isTopTile) {
        ctx.fillStyle = '#7fd6e0';
        ctx.fillRect(screenX, screenY, TILE_SIZE, 3);
        ctx.fillStyle = '#252c38';
        ctx.fillRect(screenX, screenY + TILE_SIZE - 4, TILE_SIZE, 4);
      } else {
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.strokeRect(screenX + 0.5, screenY + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      }
    }
  }
}

export function drawEnergyCells(ctx, level, camera) {
  for (const cell of level.energyCells) {
    if (cell.collected || cell.hidden) continue;
    const screenX = cell.x - camera.x;
    const screenY = cell.y - camera.y;
    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#5be6ff';
    ctx.fillRect(-7, -7, 14, 14);
    ctx.strokeStyle = '#0b6b7a';
    ctx.lineWidth = 2;
    ctx.strokeRect(-7, -7, 14, 14);
    ctx.restore();
  }
}

export function drawTerminals(ctx, level, camera) {
  for (const terminal of level.terminals) {
    const screenX = terminal.x - camera.x;
    const screenY = terminal.y - camera.y;
    ctx.fillStyle = '#33261a';
    ctx.fillRect(screenX + terminal.width / 2 - 3, screenY + terminal.height / 2, 6, terminal.height / 2);

    ctx.fillStyle = '#232b36';
    ctx.fillRect(screenX + 2, screenY, terminal.width - 4, terminal.height / 2 + 4);
    ctx.strokeStyle = '#5be6ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX + 2, screenY, terminal.width - 4, terminal.height / 2 + 4);

    ctx.fillStyle = '#5be6ff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('!', screenX + terminal.width / 2, screenY + terminal.height / 2 - 2);
  }
}

export function drawCow(ctx, level, camera) {
  const cow = level.cow;
  const screenX = cow.x - camera.x;
  const screenY = cow.y - camera.y;

  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(screenX, screenY, cow.width, cow.height);
  ctx.fillStyle = '#2b2b2b';
  ctx.fillRect(screenX + 4, screenY + 4, 8, 8);
  ctx.fillRect(screenX + 18, screenY + 14, 10, 8);
  ctx.fillStyle = '#e79fb0';
  ctx.fillRect(screenX + cow.width - 8, screenY + cow.height - 4, 8, 6);
}

export function drawExitHatch(ctx, level, camera) {
  const hatch = level.exitHatch;
  const screenX = hatch.x - camera.x;
  const screenY = hatch.y - camera.y;

  ctx.fillStyle = '#37414f';
  ctx.fillRect(screenX, screenY, hatch.width, hatch.height);
  ctx.strokeStyle = '#5be6ff';
  ctx.lineWidth = 3;
  ctx.strokeRect(screenX + 3, screenY + 3, hatch.width - 6, hatch.height - 6);
  ctx.fillStyle = 'rgba(91, 230, 255, 0.35)';
  ctx.fillRect(screenX + 6, screenY + 6, hatch.width - 12, hatch.height - 12);
}

export function drawGate(ctx, gate, camera) {
  if (gate.open) return;

  const topRow = Math.min(...gate.rows);
  const bottomRow = Math.max(...gate.rows);
  const screenX = gate.col * TILE_SIZE - camera.x;
  const topY = topRow * TILE_SIZE - camera.y;
  const bottomY = (bottomRow + 1) * TILE_SIZE - camera.y;

  ctx.fillStyle = 'rgba(255, 140, 60, 0.18)';
  ctx.fillRect(screenX, topY, TILE_SIZE, bottomY - topY);
  ctx.strokeStyle = 'rgba(255, 140, 60, 0.9)';
  ctx.lineWidth = 3;
  ctx.strokeRect(screenX + 2, topY + 2, TILE_SIZE - 4, bottomY - topY - 4);
}

export function drawInteractPrompt(ctx, worldX, worldY, camera, label = 'E') {
  const screenX = worldX - camera.x;
  const screenY = worldY - camera.y;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath();
  ctx.arc(screenX, screenY, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, screenX, screenY + 1);
  ctx.textBaseline = 'alphabetic';
}
