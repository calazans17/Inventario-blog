// Ícones em pixel da identidade visual (grade 9x9) e o "I" da marca, montado
// com esses mesmos ícones. Tudo vira SVG com retângulos, então escala sem perder nitidez.

export const icons = {
  beleza: [
    "....##...",
    "...###...",
    "...###...",
    "...###...",
    "..#####..",
    "..#...#..",
    "..#####..",
    "..#####..",
    "..#####..",
  ],
  musica: [
    "...######",
    "...######",
    "...#....#",
    "...#....#",
    "...#....#",
    ".###..###",
    "####.####",
    "####.####",
    ".##...##.",
  ],
  games: [
    ".........",
    ".##...##.",
    "#########",
    "##.####.#",
    "#...##.##",
    "##.####.#",
    "#########",
    "###...###",
    "##.....##",
  ],
  pokemon: [
    "..#####..",
    ".#######.",
    "#########",
    "###...###",
    "....#....",
    "#.......#",
    "#.......#",
    ".#.....#.",
    "..#####..",
  ],
  achadinhos: [
    ".....####",
    "....#####",
    "...####.#",
    "..#######",
    ".#######.",
    "#######..",
    ".#####...",
    "..###....",
    "...#.....",
  ],
  coracao: [
    ".........",
    ".##...##.",
    "####.####",
    "#########",
    "#########",
    ".#######.",
    "..#####..",
    "...###...",
    "....#....",
  ],
  mais: [
    ".........",
    "...###...",
    "...###...",
    ".#######.",
    ".#######.",
    ".#######.",
    "...###...",
    "...###...",
    ".........",
  ],
};

export const ICON_SIZE = 9;

// Converte uma grade em um único path, juntando pixels vizinhos da mesma linha.
export function gridToPath(grid, offsetX = 0, offsetY = 0) {
  let d = "";
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== "#") { x += 1; continue; }
      let run = 1;
      while (row[x + run] === "#") run += 1;
      d += `M${offsetX + x} ${offsetY + y}h${run}v1h-${run}z`;
      x += run;
    }
  });
  return d;
}

// Silhueta do "I" com serifa, em células de ícone.
const I_SHAPE = [
  "#########",
  ".#######.",
  "..#####..",
  "..#####..",
  "..#####..",
  "..#####..",
  "..#####..",
  "..#####..",
  "..#####..",
  "..#####..",
  ".#######.",
  "#########",
];

const CELL = ICON_SIZE + 2;
const MARK_SEQUENCE = ["games", "mais", "beleza", "musica", "pokemon", "coracao", "achadinhos", "mais", "musica", "games", "beleza", "pokemon", "coracao", "achadinhos"];

export const markViewBox = `0 0 ${I_SHAPE[0].length * CELL - 2} ${I_SHAPE.length * CELL - 2}`;

export function markPath() {
  let d = "";
  let index = 0;
  I_SHAPE.forEach((row, cy) => {
    [...row].forEach((cell, cx) => {
      if (cell !== "#") return;
      const name = MARK_SEQUENCE[(index * 5 + cy) % MARK_SEQUENCE.length];
      index += 1;
      d += gridToPath(icons[name], cx * CELL, cy * CELL);
    });
  });
  return d;
}

export function markSvg(color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${markViewBox}" shape-rendering="crispEdges"><path fill="${color}" d="${markPath()}"/></svg>`;
}

// Ladrilho do fundo das páginas de leitura: os ícones espalhados, cada um levemente
// girado, como o "I" da tela de login. Repete sem emenda (nenhum ícone cruza a borda).
const PATTERN_SEQUENCE = ["games", "coracao", "beleza", "mais", "achadinhos", "pokemon", "musica", "beleza", "pokemon", "games", "musica", "coracao", "mais", "achadinhos", "coracao", "musica"];
const PATTERN_COLUMNS = 4;
const PATTERN_CELL = 28;
export const patternSize = PATTERN_COLUMNS * PATTERN_CELL;

export function patternSvg(color) {
  let shapes = "";
  PATTERN_SEQUENCE.forEach((name, index) => {
    const col = index % PATTERN_COLUMNS;
    const row = Math.floor(index / PATTERN_COLUMNS);
    const x = col * PATTERN_CELL + (row % 2 ? 15 : 4);
    const y = row * PATTERN_CELL + 9;
    const angle = [-6, 4, -2, 7, -4, 2][index % 6];
    shapes += `<path transform="rotate(${angle} ${x + ICON_SIZE / 2} ${y + ICON_SIZE / 2})" d="${gridToPath(icons[name], x, y)}"/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${patternSize} ${patternSize}" width="${patternSize}" height="${patternSize}"><g fill="${color}">${shapes}</g></svg>`;
}
