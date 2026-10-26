#!/usr/bin/env python3
"""Bon Voyage control panel: start, watch and stop everything the app needs.

  python3 tooling/launch.py           start the app, Postgres and Ollama, open the browser, show a live panel
  python3 tooling/launch.py status    show what is running and how much memory it uses
  python3 tooling/launch.py stop      stop everything

In the panel: 1/2/3 start or stop one service, a starts all, s stops all, o opens the browser,
q (or Ctrl+C, or closing the terminal window) stops everything and quits, d quits but leaves them running.
"""
import json
import os
import select
import signal
import subprocess
import sys
import time
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = "http://localhost:3000"
PG_BIN = Path("/Applications/Postgres.app/Contents/Versions/latest/bin")
PG_DATA = Path.home() / "Library/Application Support/Postgres/var-18"
OLLAMA_API = "http://localhost:11434"
APP_LOG = Path.home() / "Library/Logs/bon-voyage-dev.log"


def run(*cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def processes():
    """(pid, rss_kb, cpu_percent, command) for every process."""
    rows = []
    for line in run("ps", "-A", "-o", "pid=,rss=,%cpu=,command=").stdout.splitlines():
        parts = line.split(None, 3)
        if len(parts) == 4:
            rows.append((int(parts[0]), int(parts[1]), float(parts[2]), parts[3]))
    return rows


def get_json(url, timeout=1.0):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return json.load(r)
    except Exception:
        return None


def kill(pids, wait=5.0):
    """SIGTERM, then SIGKILL whatever is still alive after `wait` seconds. Never this process or its parent."""
    pids = [p for p in pids if p not in (os.getpid(), os.getppid())]
    for sig in (signal.SIGTERM, signal.SIGKILL):
        for pid in pids:
            try:
                os.kill(pid, sig)
            except ProcessLookupError:
                pass
        deadline = time.time() + wait
        while time.time() < deadline and any(alive(p) for p in pids):
            time.sleep(0.2)
        pids = [p for p in pids if alive(p)]
        if not pids:
            return


def alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def wait_for(check, seconds):
    deadline = time.time() + seconds
    while time.time() < deadline:
        if check():
            return True
        time.sleep(0.5)
    return False


class App:
    key, name = "1", "App (Next.js)"

    def owns(self, cmd):
        # Match by how the real processes start, so a shell or grep that merely mentions them is never killed.
        return cmd.startswith("next-server") or cmd.strip() == "npm run dev" or cmd.startswith(f"node {ROOT}/node_modules/.bin/next ")

    def running(self):
        return bool(run("lsof", "-ti", "tcp:3000", "-sTCP:LISTEN").stdout.strip())

    def start(self):
        if not (ROOT / "node_modules").is_dir():
            subprocess.run(["npm", "install"], cwd=ROOT, check=True)
        APP_LOG.parent.mkdir(parents=True, exist_ok=True)
        with open(APP_LOG, "a") as log:
            subprocess.Popen(["npm", "run", "dev"], cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        wait_for(self.running, 60)

    def stop(self):
        pids = [p for p, _, _, c in processes() if self.owns(c)]
        pids += [int(p) for p in run("lsof", "-ti", "tcp:3000", "-sTCP:LISTEN").stdout.split()]
        kill(sorted(set(pids)))

    def detail(self):
        return URL if self.running() else ""


class Postgres:
    key, name = "2", "Postgres 18"

    def owns(self, cmd):
        return cmd.startswith(("/Applications/Postgres.app/", "postgres:"))

    def running(self):
        return run(str(PG_BIN / "pg_ctl"), "-D", str(PG_DATA), "status").returncode == 0

    def start(self):
        run(str(PG_BIN / "pg_ctl"), "-D", str(PG_DATA), "-l", str(PG_DATA / "postgresql.log"), "-o", "-p 5432", "-w", "start")

    def stop(self):
        run(str(PG_BIN / "pg_ctl"), "-D", str(PG_DATA), "-m", "fast", "-w", "stop")

    def detail(self):
        return "localhost:5432" if self.running() else ""


class Ollama:
    key, name = "3", "Ollama (Qwen)"

    def owns(self, cmd):
        return cmd.startswith("/Applications/Ollama.app/")

    def running(self):
        return get_json(f"{OLLAMA_API}/api/version") is not None

    def start(self):
        run("open", "-g", "-j", "-a", "Ollama")  # in the background, no window
        wait_for(self.running, 20)

    def stop(self):
        run("osascript", "-e", 'tell application "Ollama" to quit')
        if not wait_for(lambda: not any(self.owns(c) for _, _, _, c in processes()), 3):
            kill([p for p, _, _, c in processes() if self.owns(c)])

    def detail(self):
        loaded = (get_json(f"{OLLAMA_API}/api/ps") or {}).get("models", [])
        if not loaded:
            return "no model in memory" if self.running() else ""
        return "in memory: " + ", ".join(f"{m['name']} ({m.get('size_vram', m.get('size', 0)) / 1e9:.1f} GB)" for m in loaded)


SERVICES = [App(), Postgres(), Ollama()]


def usage(service, rows):
    mine = [(rss, cpu) for _, rss, cpu, c in rows if service.owns(c)]
    return sum(r for r, _ in mine) / 1024, sum(c for _, c in mine), len(mine)


def fmt_mb(mb):
    return f"{mb / 1024:.1f} GB" if mb >= 1024 else f"{mb:.0f} MB"


def status_lines():
    rows = processes()
    lines = []
    total = 0.0
    for s in SERVICES:
        on = s.running()
        mb, cpu, n = usage(s, rows)
        total += mb
        state = "\033[32mrunning\033[0m" if on else "\033[90mstopped\033[0m"
        stats = f"{fmt_mb(mb):>8}  CPU {cpu:4.0f}%  {n:>2} proc" if n else " " * 25
        lines.append(f"  [{s.key}] {s.name:<15} {state}  {stats}  {s.detail()}")
    lines.append(f"\n  Total memory used by these: {fmt_mb(total)}")
    return lines


def start_all():
    for s in SERVICES[::-1]:  # Postgres and Ollama first, the app last
        if not s.running():
            print(f"Starting {s.name}…", flush=True)
            s.start()


def stop_all():
    for s in SERVICES:
        if s.running() or any(s.owns(c) for _, _, _, c in processes()):
            print(f"Stopping {s.name}…", flush=True)
            s.stop()


def panel():
    import termios
    import tty

    fd = sys.stdin.fileno()
    saved = termios.tcgetattr(fd)
    message = ""

    def shutdown(*_):
        termios.tcsetattr(fd, termios.TCSADRAIN, saved)
        print("\nStopping everything so your Mac isn't slowed down…")
        stop_all()
        print("All stopped.")
        sys.exit(0)

    signal.signal(signal.SIGHUP, shutdown)  # terminal window closed
    signal.signal(signal.SIGTERM, shutdown)
    try:
        tty.setcbreak(fd)
        while True:
            sys.stdout.write("\033[H\033[J")
            print(f"Bon Voyage services   {time.strftime('%H:%M:%S')}\n")
            print("\n".join(status_lines()))
            print("\n  1/2/3 start or stop one   a start all   s stop all   o open browser")
            print("  q stop everything and quit   d quit and leave running")
            if message:
                print(f"\n  {message}")
            sys.stdout.flush()
            ready, _, _ = select.select([sys.stdin], [], [], 2)
            if not ready:
                continue
            key = sys.stdin.read(1).lower()
            message = ""
            match = next((s for s in SERVICES if s.key == key), None)
            if match:
                print(f"\n  {'Stopping' if match.running() else 'Starting'} {match.name}…", flush=True)
                match.stop() if match.running() else match.start()
            elif key == "a":
                start_all()
            elif key == "s":
                stop_all()
            elif key == "o":
                webbrowser.open(URL)
            elif key == "q":
                shutdown()
            elif key == "d":
                termios.tcsetattr(fd, termios.TCSADRAIN, saved)
                print("\nLeft running. Stop later with: python3 tooling/launch.py stop")
                return
    except KeyboardInterrupt:
        shutdown()
    finally:
        termios.tcsetattr(fd, termios.TCSADRAIN, saved)


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else "start"
    if command == "status":
        print("\n".join(status_lines()))
    elif command == "stop":
        stop_all()
        print("\n".join(status_lines()))
    elif command == "start":
        start_all()
        webbrowser.open(URL)
        if sys.stdin.isatty():
            panel()
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
