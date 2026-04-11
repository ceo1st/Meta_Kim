/**
 * Shared mock utilities for setup.mjs tests.
 * Provides filesystem, process, and readline mocks for isolated unit testing.
 */

// Mock utilities — no external dependencies needed

// ── Filesystem mock ───────────────────────────────────────────

/**
 * Create a virtual filesystem for testing.
 * @param {Record<string, 'dir' | 'file' | string>} entries
 *   Key = absolute path, Value = 'dir' | 'file' | file content string.
 *   Directories are inferred from parent paths.
 */
export function createVirtualFs(entries = {}) {
  // Ensure parent dirs exist for any file entry, and add file paths too
  const dirSet = new Set();
  for (const [path, val] of Object.entries(entries)) {
    const parts = path.replace(/\\/g, "/").split("/");
    for (let i = 1; i <= parts.length; i++) {
      dirSet.add(parts.slice(0, i).join("/"));
    }
    // If this is a file entry, also add the full path to dirSet so existsSync returns true for it
    if (val !== "dir") {
      dirSet.add(path.replace(/\\/g, "/"));
    }
  }

  const allDirs = new Set([...dirSet].map((p) => p.replace(/\/$/, "")));
  const allFiles = new Map(
    Object.entries(entries).map(([k, v]) => {
      if (v === "file") return [k, ""];
      if (v === "dir") return [k, null];
      return [k, v];
    }),
  );

  const existsSync = (path) => {
    const n = normalize(path);
    return allDirs.has(n) || allFiles.has(n);
  };

  const readdirSync = (path) => {
    if (!existsSync(path)) throw new Error(`ENOENT: ${path}`);
    const prefix = normalize(path) + "/";
    const names = new Set();
    for (const f of allFiles.keys()) {
      if (f.startsWith(prefix) && f !== normalize(path)) {
        const rest = f.slice(prefix.length);
        if (!rest.includes("/")) names.add(rest);
      }
    }
    for (const d of allDirs) {
      if (d.startsWith(prefix) && d !== normalize(path)) {
        const rest = d.slice(prefix.length);
        if (!rest.includes("/")) names.add(rest);
      }
    }
    return [...names];
  };

  const readFileSync = (path) => {
    const n = normalize(path);
    if (!allFiles.has(n)) throw new Error(`ENOENT: ${path}`);
    const val = allFiles.get(n);
    if (val === null) throw new Error(`EISDIR: ${path}`);
    return val;
  };

  const isDirectory = (path) => {
    const n = normalize(path);
    if (allFiles.has(n)) return false;
    return allDirs.has(n);
  };

  const isFile = (path) => {
    const n = normalize(path);
    if (!allFiles.has(n)) return false;
    return allFiles.get(n) !== null;
  };

  return {
    existsSync,
    readdirSync,
    readFileSync,
    isDirectory,
    isFile,
    allDirs,
    allFiles,
  };
}

function normalize(p) {
  // Normalize both forward and back slashes, strip trailing slashes
  return p.replace(/[\\/]/g, "/").replace(/\/$/, "");
}

// ── Process mock ─────────────────────────────────────────────

/**
 * Create a mocked process.env object that saves/restores original values.
 */
export function mockEnv(overrides = {}) {
  const original = { ...process.env };
  for (const [k, v] of Object.entries(overrides)) {
    process.env[k] = v;
  }
  return () => {
    for (const k of Object.keys(process.env)) {
      if (!(k in original)) delete process.env[k];
      else process.env[k] = original[k];
    }
  };
}

// ── Readline mock ─────────────────────────────────────────────

/**
 * Create a mock readline interface that resolves answers from a queue.
 */
export function createMockReadline(answers = []) {
  let idx = 0;
  return {
    createInterface: () => ({
      question: (q, cb) => {
        const answer = answers[idx++] ?? "";
        setImmediate(() => cb(answer));
      },
      close: () => {},
    }),
    setAnswers: (newAnswers) => {
      idx = 0;
      answers = newAnswers;
    },
  };
}

// ── Spawn mock ────────────────────────────────────────────────

/**
 * Create a mock spawnSync result.
 */
export function mockSpawnResult(status = 0, stdout = "", stderr = "") {
  return {
    status,
    stdout: Buffer.from(stdout),
    stderr: Buffer.from(stderr),
  };
}

// ── Module reimport helper ────────────────────────────────────

/**
 * Re-import a module fresh (busting Node.js module cache).
 * Use after patching globals (env, fs, etc.) to get a clean module.
 */
export async function reimport(modulePath) {
  const mod = await import(modulePath + "?t=" + Date.now());
  return mod;
}
