#!/usr/bin/env python3
"""Run checks against a new disposable PostgreSQL instance, never a configured database.

  python3 tooling/testDatabase.py                      run all Vitest suites serially
  python3 tooling/testDatabase.py shared/lib/db         run matching Vitest suites
  python3 tooling/testDatabase.py --command npm run dev migrate, then run a command

The cluster is created under /private/tmp (or the OS temporary directory elsewhere),
listens only on loopback, and is stopped and removed on exit. No .env file is read by
this launcher. The Vitest config also skips .env files in this isolated mode.
"""

import base64
import os
from pathlib import Path
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[1]
DATABASE = "bv_isolated_test"
ADMIN = "bv_test_admin"


def postgres_bin():
    configured = os.environ.get("POSTGRES_BIN")
    candidates = [Path(configured)] if configured else []
    candidates.append(Path("/Applications/Postgres.app/Contents/Versions/latest/bin"))
    on_path = shutil.which("initdb")
    if on_path:
        candidates.append(Path(on_path).parent)
    for candidate in candidates:
        if all((candidate / name).is_file() for name in ("initdb", "pg_ctl", "psql")):
            return candidate
    raise RuntimeError("PostgreSQL binaries are missing. Install Postgres.app or set POSTGRES_BIN.")


def main():
    args = sys.argv[1:]
    if args in (["--help"], ["-h"]):
        print(__doc__)
        return 0
    custom_command = bool(args and args[0] == "--command")
    if custom_command and len(args) == 1:
        raise RuntimeError("--command needs a command to run")

    pg_bin = postgres_bin()
    temporary_parent = "/private/tmp" if Path("/private/tmp").is_dir() else None
    temporary = Path(tempfile.mkdtemp(prefix="bv-tests-", dir=temporary_parent)).resolve()
    data = temporary / "data"
    sockets = temporary / "socket"
    sockets.mkdir(mode=0o700)
    passwords = {role: secrets.token_hex(24) for role in (ADMIN, "bv_owner", "bv_app")}
    password_file = temporary / "admin-password"
    password_file.write_text(passwords[ADMIN] + "\n")
    password_file.chmod(0o600)
    # Erase inherited libpq routing/authentication settings. Every connection below is explicit.
    env = {key: value for key, value in os.environ.items() if not key.startswith("PG")}
    started = False
    child = None

    def run_checked(command, *, input_text=None, process_env=None):
        result = subprocess.run(
            command, cwd=ROOT, env=process_env or env, input=input_text,
            capture_output=True, text=True,
        )
        if result.returncode:
            detail = (result.stderr or result.stdout).strip()
            for password in passwords.values():
                detail = detail.replace(password, "[ephemeral password]")
            raise RuntimeError(f"{Path(command[0]).name} failed: {detail}")
        return result.stdout.strip()

    def interrupted(signum, _frame):
        raise KeyboardInterrupt

    previous_handlers = {sig: signal.signal(sig, interrupted) for sig in (signal.SIGINT, signal.SIGTERM)}
    try:
        run_checked([
            str(pg_bin / "initdb"), "-D", str(data), "-U", ADMIN,
            "--auth-local=scram-sha-256", "--auth-host=scram-sha-256",
            f"--pwfile={password_file}", "--no-locale", "--encoding=UTF8", "--no-instructions",
        ])
        password_file.unlink()
        with socket.socket() as reservation:
            reservation.bind(("127.0.0.1", 0))
            port = reservation.getsockname()[1]
        # A competing bind makes pg_ctl fail; this runner never falls back to another server.
        with (data / "postgresql.conf").open("a") as config:
            config.write(
                f"\nlisten_addresses = '127.0.0.1'\nport = {port}\n"
                f"unix_socket_directories = '{sockets}'\n"
                "max_connections = 30\nshared_buffers = '32MB'\n"
            )
        run_checked([
            str(pg_bin / "pg_ctl"), "-D", str(data), "-l", str(temporary / "postgres.log"),
            "-w", "-t", "20", "start",
        ])
        started = True
        admin_env = {**env, "PGPASSWORD": passwords[ADMIN]}
        psql = [
            str(pg_bin / "psql"), "-X", "--no-password", "-v", "ON_ERROR_STOP=1",
            "-h", "127.0.0.1", "-p", str(port), "-U", ADMIN,
        ]
        # Prove the TCP endpoint is this newly created cluster before any database mutations.
        actual_data = run_checked(
            [*psql, "-d", "postgres", "-Atc", "show data_directory"], process_env=admin_env,
        )
        if Path(actual_data).resolve() != data.resolve():
            raise RuntimeError("Refusing to run: the connected database is not the disposable cluster")
        run_checked([*psql, "-d", "postgres"], process_env=admin_env, input_text=f"""
CREATE ROLE bv_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '{passwords['bv_owner']}';
CREATE ROLE bv_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '{passwords['bv_app']}';
CREATE DATABASE {DATABASE} OWNER bv_owner;
ALTER ROLE bv_app SET lock_timeout = '5s';
ALTER ROLE bv_app SET statement_timeout = '15s';
""")
        run_checked([*psql, "-d", DATABASE], process_env=admin_env, input_text="""
GRANT USAGE ON SCHEMA public TO bv_app;
GRANT CREATE ON SCHEMA public TO bv_owner;
""")
        url = lambda role: f"postgresql://{role}:{passwords[role]}@127.0.0.1:{port}/{DATABASE}"
        env.update({
            "BON_VOYAGE_ISOLATED_TESTS": "1",
            "TEST_DATABASE_URL": url("bv_app"),
            "TEST_DATABASE_OWNER_URL": url("bv_owner"),
            "DATABASE_URL": url("bv_app"),
            "DATABASE_OWNER_URL": url("bv_owner"),
            "DATA_KEY": base64.b64encode(secrets.token_bytes(32)).decode(),
            "DATA_KEY_VERSION": "1", "DATA_KEYS_OLD": "",
            "BETTER_AUTH_SECRET": secrets.token_hex(32),
            "BETTER_AUTH_URL": "http://localhost:3000",
            "DEV_MAGIC_LINK_CAPTURE_FILE": str(temporary / "sign-in-link.txt"),
            "AI_PROVIDER": "", "ANTHROPIC_API_KEY": "", "DUFFEL_ACCESS_TOKEN": "",
            "DUFFEL_LIVE_ENABLED": "false", "DUFFEL_BOOKING_ENABLED": "false", "DUFFEL_STAYS_ENABLED": "false",
            "RESEND_API_KEY": "", "RESEND_FROM": "", "AUDIT_ANCHOR_URL": "", "AUDIT_ANCHOR_TOKEN": "", "AUDIT_ALERT_EMAIL": "", "MOCK_FLIGHT_PRICE_FACTOR": "1", "CRON_SECRET": secrets.token_hex(32),
        })
        print(f"Disposable PostgreSQL: 127.0.0.1:{port}/{DATABASE} ({data})", flush=True)
        if custom_command:
            # Use the migration library directly: no config loader can read a development URL.
            run_checked(["node", "--input-type=module", "-e", """
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
const pool = new Pool({ connectionString: process.env.DATABASE_OWNER_URL });
try { await migrate(drizzle(pool), { migrationsFolder: 'shared/lib/db/migrations' }); }
finally { await pool.end(); }
"""])
            command = args[1:]
        else:
            command = ["npm", "test", "--", "--no-file-parallelism", *args]
        child = subprocess.Popen(command, cwd=ROOT, env=env, start_new_session=True)
        return child.wait()
    except KeyboardInterrupt:
        return 130
    finally:
        # A second Ctrl+C must not interrupt the cleanup and leave the private server running.
        for sig in previous_handlers:
            signal.signal(sig, signal.SIG_IGN)
        # Stop only the child process group and the cluster created by this invocation.
        if child is not None and child.poll() is None:
            os.killpg(child.pid, signal.SIGTERM)
            try:
                child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid, signal.SIGKILL)
                child.wait()
        stopped = True
        if started or (data / "postmaster.pid").exists():
            result = subprocess.run(
                [str(pg_bin / "pg_ctl"), "-D", str(data), "-m", "immediate", "-w", "-t", "10", "stop"],
                env=env, capture_output=True, text=True,
            )
            stopped = result.returncode == 0 or not (data / "postmaster.pid").exists()
        if stopped:
            shutil.rmtree(temporary)
            print("Disposable PostgreSQL stopped and removed.", flush=True)
        else:
            print(f"Could not stop disposable PostgreSQL; retained {temporary}", file=sys.stderr)
        for sig, previous in previous_handlers.items():
            signal.signal(sig, previous)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (RuntimeError, OSError) as error:
        print(f"Isolated database check failed: {error}", file=sys.stderr)
        sys.exit(1)
