export type Point = {
  r: number;
  c: number;
};

export type Room = {
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
};

export type Maze = {
  rows: number;
  cols: number;
  rooms: Room[][];
  start: Point;
  exit: Point;
};

const STEP: Record<"up" | "down" | "left" | "right", Point> = {
  up: { r: -1, c: 0 },
  down: { r: 1, c: 0 },
  left: { r: 0, c: -1 },
  right: { r: 0, c: 1 },
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function openWall(a: Room, b: Room, dir: keyof typeof STEP): void {
  if (dir === "up") {
    a.n = false;
    b.s = false;
  } else if (dir === "down") {
    a.s = false;
    b.n = false;
  } else if (dir === "left") {
    a.w = false;
    b.e = false;
  } else {
    a.e = false;
    b.w = false;
  }
}

function neighbors(rows: number, cols: number, p: Point) {
  return (["up", "down", "left", "right"] as const)
    .map((dir) => {
      const d = STEP[dir];
      return { dir, r: p.r + d.r, c: p.c + d.c };
    })
    .filter((n) => n.r >= 0 && n.c >= 0 && n.r < rows && n.c < cols);
}

function farthestFrom(maze: Maze, origin: Point): Point {
  const dist = Array.from({ length: maze.rows }, () =>
    Array.from({ length: maze.cols }, () => -1),
  );
  const queue: Point[] = [origin];
  dist[origin.r][origin.c] = 0;
  let farthest = origin;

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (dist[cur.r][cur.c] > dist[farthest.r][farthest.c]) farthest = cur;
    for (const dir of ["up", "down", "left", "right"] as const) {
      const next = { r: cur.r + STEP[dir].r, c: cur.c + STEP[dir].c };
      if (!canWalk(maze, cur, dir) || dist[next.r][next.c] !== -1) continue;
      dist[next.r][next.c] = dist[cur.r][cur.c] + 1;
      queue.push(next);
    }
  }
  return farthest;
}

export function generateMaze(rows: number, cols: number): Maze {
  const rooms: Room[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      n: true,
      e: true,
      s: true,
      w: true,
    })),
  );
  const seen = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => false),
  );
  const start: Point = { r: 0, c: 0 };
  const stack: Point[] = [start];
  seen[0][0] = true;

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    const nexts = shuffle(neighbors(rows, cols, current)).filter(
      (n) => !seen[n.r][n.c],
    );
    if (nexts.length === 0) {
      stack.pop();
      continue;
    }
    const pick = nexts[0];
    openWall(rooms[current.r][current.c], rooms[pick.r][pick.c], pick.dir);
    seen[pick.r][pick.c] = true;
    stack.push({ r: pick.r, c: pick.c });
  }

  // Abre alguns atalhos para ficar mais fácil.
  const extra = Math.floor(rows * cols * 0.12);
  for (let i = 0; i < extra; i++) {
    const r = Math.floor(Math.random() * rows);
    const c = Math.floor(Math.random() * cols);
    const options = neighbors(rows, cols, { r, c }).filter((n) => {
      const room = rooms[r][c];
      return room[n.dir === "up" ? "n" : n.dir === "down" ? "s" : n.dir === "left" ? "w" : "e"];
    });
    if (options.length === 0) continue;
    const pick = options[0];
    openWall(rooms[r][c], rooms[pick.r][pick.c], pick.dir);
  }

  const maze: Maze = {
    rows,
    cols,
    rooms,
    start,
    exit: start,
  };
  maze.exit = farthestFrom(maze, start);
  return maze;
}

export function canWalk(
  maze: Maze,
  from: Point,
  dir: keyof typeof STEP,
): boolean {
  const room = maze.rooms[from.r][from.c];
  const blocked =
    dir === "up" ? room.n : dir === "down" ? room.s : dir === "left" ? room.w : room.e;
  if (blocked) return false;
  const next = { r: from.r + STEP[dir].r, c: from.c + STEP[dir].c };
  return (
    next.r >= 0 &&
    next.c >= 0 &&
    next.r < maze.rows &&
    next.c < maze.cols
  );
}

export function keyOf(p: Point): string {
  return `${p.r},${p.c}`;
}
