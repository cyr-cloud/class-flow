"""Private, loopback-only PPTX converter. Put an authenticated HTTPS gateway in front.

Limits are service-wide, persisted in SQLite, and are NOT an AWS billing cap.
"""
import datetime
import http.server
import json
import os
from pathlib import Path
import signal
import sqlite3
import subprocess
import tempfile
import threading
import time
import zipfile

ROOT = Path(os.environ.get("CONVERT_DATA", "/var/lib/classflow-convert"))
MAX_INPUT = 200 * 1024 * 1024
MAX_OUTPUT = 60 * 1024 * 1024
MAX_DAILY = 20
MAX_MONTHLY_OUTPUT = 5 * 1024 * 1024 * 1024
LOCK = threading.Lock()


def reserve():
    """Reserve worst-case output before work; conservative after failure/restart."""
    now = datetime.datetime.now(datetime.timezone.utc)
    day, month = now.strftime("%Y-%m-%d"), now.strftime("%Y-%m")
    with sqlite3.connect(ROOT / "usage.sqlite") as db:
        db.execute("CREATE TABLE IF NOT EXISTS usage (key TEXT PRIMARY KEY, value INTEGER NOT NULL)")
        db.execute("BEGIN IMMEDIATE")
        def count(key):
            row = db.execute("SELECT value FROM usage WHERE key=?", (key,)).fetchone()
            return row[0] if row else 0
        if count(day) >= MAX_DAILY or count(month) + MAX_OUTPUT > MAX_MONTHLY_OUTPUT:
            return False
        for key, amount in [(day, 1), (month, MAX_OUTPUT)]:
            db.execute("INSERT INTO usage VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=value+excluded.value", (key, amount))
    return True


def validate_pptx(file):
    with zipfile.ZipFile(file) as archive:
        entries = archive.infolist()
        if len(entries) > 10000 or sum(e.file_size for e in entries) > 512 * 1024 * 1024:
            raise ValueError("PPTX expanded size exceeds limit")
        if "ppt/presentation.xml" not in archive.namelist():
            raise ValueError("Not a PPTX presentation")
        if any(e.flag_bits & 1 for e in entries):
            raise ValueError("Encrypted PPTX is not supported")


class Handler(http.server.BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.connection.settimeout(60)

    def reply(self, code, message):
        data = json.dumps({"error": message}).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(data)
        self.close_connection = True

    def do_GET(self):
        if self.path != "/health":
            return self.reply(404, "Not found")
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'{"ok":true,"scope":"loopback-only"}')

    def do_POST(self):
        if self.path != "/convert":
            return self.reply(404, "Not found")
        if self.headers.get("Transfer-Encoding"):
            return self.reply(400, "Content-Length required")
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self.reply(400, "Invalid length")
        if length <= 0 or length > MAX_INPUT:
            return self.reply(413, "PPTX must be between 1 byte and 200 MiB")
        if not LOCK.acquire(False):
            return self.reply(429, "Conversion busy; retry later")
        try:
            if not reserve():
                return self.reply(429, "Daily or monthly service limit reached")
            with tempfile.TemporaryDirectory(prefix="job-", dir=ROOT) as folder:
                work = Path(folder)
                file = work / "deck.pptx"
                with file.open("wb") as target:
                    remaining = length
                    while remaining:
                        chunk = self.rfile.read(min(1024 * 1024, remaining))
                        if not chunk:
                            raise ValueError("Incomplete upload")
                        target.write(chunk)
                        remaining -= len(chunk)
                validate_pptx(file)
                started = time.monotonic()
                with (work / "conversion.log").open("wb") as log:
                    process = subprocess.Popen([
                        "soffice", f"-env:UserInstallation={(work / 'profile').as_uri()}",
                        "--headless", "--norestore", "--convert-to", "pdf",
                        "--outdir", str(work), str(file),
                    ], stdout=log, stderr=log, start_new_session=True)
                    try:
                        process.wait(timeout=180)
                    except subprocess.TimeoutExpired:
                        os.killpg(process.pid, signal.SIGKILL)
                        process.wait()
                        return self.reply(504, "Conversion timed out")
                pdf = work / "deck.pdf"
                if process.returncode != 0 or not pdf.exists():
                    return self.reply(422, "Conversion failed")
                if pdf.stat().st_size > MAX_OUTPUT:
                    return self.reply(413, "Converted PDF exceeds 60 MiB")
                with pdf.open("rb") as source:
                    if source.read(5) != b"%PDF-":
                        return self.reply(422, "Invalid conversion output")
                    source.seek(0)
                    self.send_response(200)
                    self.send_header("Content-Type", "application/pdf")
                    self.send_header("Content-Length", str(pdf.stat().st_size))
                    self.send_header("X-Conversion-Seconds", f"{time.monotonic() - started:.2f}")
                    self.send_header("Cache-Control", "no-store")
                    self.end_headers()
                    while chunk := source.read(1024 * 1024):
                        self.wfile.write(chunk)
        except (ValueError, zipfile.BadZipFile):
            self.reply(400, "Invalid PPTX upload")
        except (TimeoutError, BrokenPipeError, ConnectionResetError):
            pass
        except Exception as error:
            print(type(error).__name__, flush=True)
            self.reply(500, "Conversion service error")
        finally:
            LOCK.release()


if __name__ == "__main__":
    ROOT.mkdir(parents=True, exist_ok=True)
    http.server.ThreadingHTTPServer(("127.0.0.1", 8090), Handler).serve_forever()
