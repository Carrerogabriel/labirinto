import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import davissAudio from "./assets/daviss.mp3";
import exitPhoto from "./assets/exit.jpg";
import heroPhoto from "./assets/hero.jpg";
import { canWalk, generateMaze, keyOf, type Maze, type Point } from "./maze";

const TOTAL_LEVELS = 10;

const ROUND_PHRASES = [
  "Bora que tu consegue",
  "se tiver borocoxó não vai ganhar.",
  "a montanha só parece insubivel porque é vista de longe.",
  "se demorar muito ta me devendo um subway.",
  "Se perder a macumbeira volta.",
  "ta quase ein cuca",
  "esse leão foi no soco",
  "mais um pouco e eu jogo uma pedra no carro da tua chefa.",
  "Depois da tempestade vem a bonanza",
];

function mazeSize(level: number): { rows: number; cols: number } {
  const bump = Math.floor((level - 1) / 3);
  return { rows: 8 + bump, cols: 10 + bump };
}

type Facing = "up" | "down" | "left" | "right";

const KEY_DIR: Record<string, Facing> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  a: "left",
  s: "down",
  d: "right",
  W: "up",
  A: "left",
  S: "down",
  D: "right",
};

const BALLOON_COLORS = [
  "#ff6b9d",
  "#ff8fab",
  "#f06292",
  "#ec407a",
  "#ffb3c7",
  "#e91e63",
  "#ff5c8a",
  "#f48fb1",
];

type Balloon = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  sway: number;
};

function makeBalloons(count: number): Balloon[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: Math.random() * 100,
    delay: Math.random() * 3,
    duration: 5 + Math.random() * 6,
    size: 26 + Math.random() * 32,
    color: BALLOON_COLORS[id % BALLOON_COLORS.length],
    sway: 18 + Math.random() * 28,
  }));
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function newRun(level = 1, steps = 0): {
  maze: Maze;
  player: Point;
  visited: Set<string>;
  steps: number;
  facing: Facing;
} {
  const { rows, cols } = mazeSize(level);
  const maze = generateMaze(rows, cols);
  return {
    maze,
    player: { ...maze.start },
    visited: new Set([keyOf(maze.start)]),
    steps,
    facing: "right",
  };
}

export default function App() {
  const [level, setLevel] = useState(1);
  const [run, setRun] = useState(() => newRun(1));
  const [seconds, setSeconds] = useState(0);
  const [won, setWon] = useState(false);
  const [roundClear, setRoundClear] = useState<number | null>(null);
  const wonRef = useRef(false);
  const pausedRef = useRef(false);
  const levelRef = useRef(1);
  const boardRef = useRef<HTMLDivElement>(null);
  const runRef = useRef(run);
  const winSoundRef = useRef<HTMLAudioElement | null>(null);
  runRef.current = run;
  levelRef.current = level;

  const { maze, player, visited, steps, facing } = run;
  const balloons = useMemo(() => (won ? makeBalloons(36) : []), [won]);

  useEffect(() => {
    const audio = new Audio(davissAudio);
    audio.preload = "auto";
    winSoundRef.current = audio;
    return () => {
      audio.pause();
      winSoundRef.current = null;
    };
  }, []);

  const stopWinSound = () => {
    const audio = winSoundRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  };

  const playWinSound = () => {
    const audio = winSoundRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play();
  };

  useEffect(() => {
    if (won || roundClear !== null) return;
    const id = window.setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [won, roundClear]);

  const restart = useCallback(() => {
    stopWinSound();
    wonRef.current = false;
    pausedRef.current = false;
    levelRef.current = 1;
    setWon(false);
    setRoundClear(null);
    setLevel(1);
    setSeconds(0);
    setRun(newRun(1));
    boardRef.current?.focus();
  }, []);

  const continueRound = useCallback(() => {
    pausedRef.current = false;
    setRoundClear(null);
    boardRef.current?.focus();
  }, []);

  useEffect(() => {
    if (roundClear === null || won) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      continueRound();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [roundClear, won, continueRound]);

  const tryMove = useCallback((dir: Facing) => {
    if (wonRef.current || pausedRef.current) return;
    const current = runRef.current;
    if (!canWalk(current.maze, current.player, dir)) {
      runRef.current = { ...current, facing: dir };
      setRun(runRef.current);
      return;
    }
    const delta =
      dir === "up"
        ? { r: -1, c: 0 }
        : dir === "down"
          ? { r: 1, c: 0 }
          : dir === "left"
            ? { r: 0, c: -1 }
            : { r: 0, c: 1 };
    const next = {
      r: current.player.r + delta.r,
      c: current.player.c + delta.c,
    };
    const nextVisited = new Set(current.visited);
    nextVisited.add(keyOf(next));
    const reachedExit =
      next.r === current.maze.exit.r && next.c === current.maze.exit.c;
    runRef.current = {
      ...current,
      player: next,
      visited: nextVisited,
      steps: current.steps + 1,
      facing: dir,
    };
    setRun(runRef.current);
    if (!reachedExit) return;
    if (levelRef.current < TOTAL_LEVELS) {
      const cleared = levelRef.current;
      const nextLevel = cleared + 1;
      levelRef.current = nextLevel;
      pausedRef.current = true;
      setLevel(nextLevel);
      setRoundClear(cleared);
      const nextRun = newRun(nextLevel, runRef.current.steps);
      runRef.current = nextRun;
      setRun(nextRun);
      return;
    }
    wonRef.current = true;
    setWon(true);
    playWinSound();
  }, []);

  useEffect(() => {
    const held = new Set<Facing>();
    let tick: number | undefined;

    const step = () => {
      held.forEach((dir) => tryMove(dir));
    };

    const onDown = (event: KeyboardEvent) => {
      const dir = KEY_DIR[event.key];
      if (!dir) return;
      event.preventDefault();
      if (event.repeat) return;
      held.add(dir);
      tryMove(dir);
      if (tick === undefined) tick = window.setInterval(step, 160);
    };

    const onUp = (event: KeyboardEvent) => {
      const dir = KEY_DIR[event.key];
      if (!dir) return;
      held.delete(dir);
      if (held.size === 0 && tick !== undefined) {
        window.clearInterval(tick);
        tick = undefined;
      }
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      if (tick !== undefined) window.clearInterval(tick);
    };
  }, [tryMove]);

  const holdDir = (dir: Facing) => {
    tryMove(dir);
    const id = window.setInterval(() => tryMove(dir), 160);
    const stop = () => {
      window.clearInterval(id);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };

  const rooms = [];
  for (let r = 0; r < maze.rows; r++) {
    for (let c = 0; c < maze.cols; c++) {
      const room = maze.rooms[r][c];
      const here = player.r === r && player.c === c;
      const isExit = maze.exit.r === r && maze.exit.c === c;
      const isStart = maze.start.r === r && maze.start.c === c;
      const walked = visited.has(`${r},${c}`);
      rooms.push(
        <div
          key={`${r}-${c}`}
          className={[
            "room",
            walked ? "walked" : "",
            isStart ? "start" : "",
            isExit ? "exit" : "",
            here ? "current" : "",
          ].join(" ")}
          style={{
            borderTopWidth: room.n ? 6 : 1,
            borderRightWidth: room.e ? 6 : 1,
            borderBottomWidth: room.s ? 6 : 1,
            borderLeftWidth: room.w ? 6 : 1,
          }}
        >
          {isExit && (
            <img src={exitPhoto} alt="Saída" className="exit-photo" />
          )}
          {isStart && !here && !isExit && <span className="door">início</span>}
          {here && (
            <div className={`hero facing-${facing}`} title="Personagem">
              <img src={heroPhoto} alt="" className="hero-photo" />
            </div>
          )}
        </div>,
      );
    }
  }

  return (
    <div className="app">
      <header className="hud">
        <div>
          <p className="kicker">
            Nível {level} de {TOTAL_LEVELS}
          </p>
          <h1>Labirinto</h1>
        </div>
        <ul className="stats">
          <li>
            <span>Nível</span>
            <strong>
              {level}/{TOTAL_LEVELS}
            </strong>
          </li>
          <li>
            <span>Tempo</span>
            <strong>{formatTime(seconds)}</strong>
          </li>
          <li>
            <span>Passos</span>
            <strong>{steps}</strong>
          </li>
        </ul>
        <button type="button" onClick={restart}>
          Recomeçar
        </button>
      </header>

      <main>
        <div className="stage">
          <div
            ref={boardRef}
            className="board"
            tabIndex={0}
            role="application"
            aria-label={`Labirinto nível ${level} de ${TOTAL_LEVELS}. Ande pelos cômodos até a saída.`}
            style={{
              gridTemplateColumns: `repeat(${maze.cols}, 64px)`,
              gridTemplateRows: `repeat(${maze.rows}, 64px)`,
            }}
          >
            {rooms}
          </div>

          <div className="pad" aria-label="Controles">
            {(["up", "left", "down", "right"] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                className={`pad-btn ${dir}`}
                onPointerDown={(event) => {
                  event.preventDefault();
                  holdDir(dir);
                }}
              >
                {dir === "up" ? "↑" : dir === "down" ? "↓" : dir === "left" ? "←" : "→"}
              </button>
            ))}
          </div>
        </div>

        <aside className="help">
          <p>
            Cada quadrado é um caminho. As <strong>linhas grossas</strong> são
            paredes; as finas são aberturas por onde o personagem passa.
          </p>
          <p>
            Leve a personagem até a clínica <strong>Select Odonto</strong> em
            cada fase. São {TOTAL_LEVELS} níveis: só avança quem chega na
            saída. A festa espera no último.
          </p>
          <p className="keys">
            Mover: <kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd> ou{" "}
            <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>
          </p>
        </aside>
      </main>

      {roundClear !== null && !won && (
        <div className="overlay toast-overlay" role="dialog" aria-modal="true">
          <div className="modal toast-modal">
            <p className="kicker">
              Fase {roundClear} concluída
            </p>
            <h2>{ROUND_PHRASES[roundClear - 1]}</h2>
            <p>
              Nível {level} de {TOTAL_LEVELS} te espera.
            </p>
            <button type="button" onClick={continueRound}>
              Continuar
            </button>
          </div>
        </div>
      )}

      {won && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="balloons" aria-hidden>
            {balloons.map((balloon) => (
              <div
                key={balloon.id}
                className="balloon"
                style={{
                  left: `${balloon.left}%`,
                  animationDelay: `${balloon.delay}s`,
                  animationDuration: `${balloon.duration}s`,
                  ["--size" as string]: `${balloon.size}px`,
                  ["--color" as string]: balloon.color,
                  ["--sway" as string]: `${balloon.sway}px`,
                }}
              >
                <span className="balloon-body" />
                <span className="balloon-string" />
              </div>
            ))}
          </div>
          <div className="modal">
            <img src={exitPhoto} alt="" className="modal-exit" />
            <p className="kicker">Escapou</p>
            <h2>Ainda vou te incomodar um monte, tu que lute. e eu que lute pelos meus pontos. junto os leões no soco</h2>
            <p>
              Tempo {formatTime(seconds)} · {steps} passos
            </p>
            <button type="button" onClick={restart}>
              Jogar de novo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
