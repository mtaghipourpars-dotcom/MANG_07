"""Run localhost release acceptance against an isolated, freshly built bank."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[3]


def checked(condition, message):
    if not condition:
        raise RuntimeError(message)


def localhost_acceptance(output, npm):
    workspace = output / "localhost-workspace.sqlite"
    bank = output / "localhost-bank.sqlite"
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    origin = "http://127.0.0.1:" + str(port)
    env = dict(os.environ, PORT=str(port), PVPT_HOST="127.0.0.1", PYTHON=sys.executable,
               PVPT_DATABASE_PATH=str(workspace), PVPT_TOTAL_DEMO_DB=str(bank),
               PYTHONDONTWRITEBYTECODE="1")
    env.pop("DATABASE_URL", None)
    inputs = json.loads((ROOT / "scenario-lab" / "evidence" / "summary.json").read_text(encoding="utf-8"))
    case_url = origin + "/api/total-demo/cases/S000013"
    cookie = ""
    saved_revision = None

    for phase in ("cold", "warm"):
        with (output / ("localhost-" + phase + ".log")).open("w", encoding="utf-8") as log:
            process = subprocess.Popen([npm, "run", "localhost"], cwd=ROOT, env=env,
                                       stdout=log, stderr=subprocess.STDOUT,
                                       start_new_session=os.name != "nt")
            try:
                until = time.monotonic() + 60
                while True:
                    try:
                        with urlopen(origin + "/api/health", timeout=2) as health:
                            checked(health.status == 200, "Localhost health failed")
                        break
                    except URLError:
                        if process.poll() is not None or time.monotonic() >= until:
                            raise RuntimeError("Localhost launcher exited or did not become healthy")
                        time.sleep(0.2)

                for path in ("/", "/demo/total-system/"):
                    with urlopen(origin + path, timeout=5) as page:
                        checked(page.status == 200 and page.headers.get_content_type() == "text/html",
                                "Page unavailable: " + path)
                with urlopen(origin + "/api/total-demo/summary", timeout=5) as response:
                    summary = json.load(response)
                checked(summary["summary"]["scenarios"] == inputs["scenarios"], "Unexpected scenario count")

                with urlopen(Request(case_url, headers={"Cookie": cookie}), timeout=5) as response:
                    case = json.load(response)
                    if phase == "cold":
                        cookie = response.headers["Set-Cookie"].split(";", 1)[0]
                if phase == "cold":
                    checked(case["status"] == "DRAFT", "Expected fresh workspace case")
                    payload = {"action": "REPORT", "actor": "EXPERT", "revision": case["revision"],
                               "reason": "Isolated automated localhost validation"}
                    action = Request(case_url + "/actions", data=json.dumps(payload).encode(),
                                     headers={"Cookie": cookie, "Content-Type": "application/json"})
                    with urlopen(action, timeout=5) as response:
                        saved = json.load(response)
                    checked(saved["status"] == "REPORTED", "Expected persisted REPORT action")
                    saved_revision = saved["revision"]
                else:
                    checked(case["status"] == "REPORTED" and case["revision"] == saved_revision,
                            "Case not recovered after restarting the launcher")
            finally:
                if process.poll() is None:
                    if os.name == "nt":
                        subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
                    else:
                        os.killpg(process.pid, signal.SIGTERM)
                process.wait(timeout=10)
    return {"name": "localhost", "command": [npm, "run", "localhost"], "exitCode": 0,
            "scenarios": inputs["scenarios"], "restoredCaseRevision": saved_revision}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="New directory for reports and logs")
    args = parser.parse_args()
    if args.output:
        output = args.output.resolve()
        output.mkdir(parents=True, exist_ok=False)
    else:
        output = Path(tempfile.mkdtemp(prefix="pvpt-acceptance-"))
    bank = output / "reference.sqlite"
    env = dict(os.environ, PVPT_TOTAL_DEMO_DB=str(bank),
               PLAYWRIGHT_JSON_OUTPUT_NAME=str(output / "browser.json"),
               PYTHONDONTWRITEBYTECODE="1")
    digest = hashlib.sha256()
    for folder in ("server", "scenario-lab", "demo", "tests", "scripts", "unit", "data"):
        for path in sorted((ROOT / folder).rglob("*")):
            if path.is_file() and "__pycache__" not in path.parts:
                digest.update(path.relative_to(ROOT).as_posix().encode() + b"\0")
                digest.update(hashlib.sha256(path.read_bytes()).digest())
    for filename in ("server.js", "package.json", "playwright.config.js", "DEV/api-contract.json"):
        digest.update((ROOT / filename).read_bytes())
    evidence = {"baseCommit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT,
                                                        text=True).strip(),
                "runtimeSourceFingerprint": digest.hexdigest(), "checks": []}
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm") or "npm"
    commands = [
        ("contract", ["node", "DEV/validate-spec.mjs"]),
        ("localhost-contract", ["node", "scripts/validate-local-contract.mjs"]),
        ("python-unit", [sys.executable, "-m", "unittest", "discover", "-s", "scenario-lab", "-p", "test_*.py"]),
        ("node-unit", ["node", "--test", *[str(path.relative_to(ROOT)) for path in sorted((ROOT / "unit").glob("*.test.mjs"))]]),
        ("bank", [sys.executable, "scenario-lab/build_bank.py", "--db", str(bank)]),
        ("browser", [npm, "test", "--", "--workers=4", "--reporter=list,json", "--output=" + str(output / "artifacts")]),
    ]
    for name, command in commands:
        print(name, flush=True)
        with (output / (name + ".log")).open("w", encoding="utf-8") as log:
            result = subprocess.run(command, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
        evidence["checks"].append({"name": name, "command": command, "exitCode": result.returncode})
        (output / "acceptance.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
        if result.returncode:
            print(output, file=sys.stderr)
            return result.returncode
    print("localhost", flush=True)
    try:
        evidence["checks"].append(localhost_acceptance(output, npm))
    except (OSError, RuntimeError, subprocess.SubprocessError) as error:
        evidence["checks"].append({"name": "localhost", "exitCode": 1, "error": str(error)})
        print(error, file=sys.stderr)
    (output / "acceptance.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    print(output)
    return evidence["checks"][-1]["exitCode"]


if __name__ == "__main__":
    raise SystemExit(main())
