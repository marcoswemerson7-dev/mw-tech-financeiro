#!/usr/bin/env python3
import json, os, platform, shutil, socket, subprocess, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("MW_HEALTH_PORT", "9108"))
TOKEN = os.environ.get("MW_HEALTH_TOKEN", "")

def run(cmd):
    try:
        return subprocess.check_output(cmd, shell=True, text=True, stderr=subprocess.DEVNULL, timeout=3).strip()
    except Exception:
        return ""

def cpu_percent():
    def snap():
        p = open("/proc/stat").readline().split()[1:]
        v = list(map(int, p))
        idle = v[3] + (v[4] if len(v) > 4 else 0)
        return sum(v), idle
    a_total, a_idle = snap()
    time.sleep(0.15)
    b_total, b_idle = snap()
    dt = max(1, b_total - a_total)
    return round(100 * (1 - (b_idle - a_idle) / dt), 1)

def meminfo():
    data = {}
    for line in open("/proc/meminfo"):
        k, v = line.split(":", 1)
        data[k] = int(v.strip().split()[0]) * 1024
    total = data.get("MemTotal", 0)
    available = data.get("MemAvailable", 0)
    used = max(0, total - available)
    swap_total = data.get("SwapTotal", 0)
    swap_free = data.get("SwapFree", 0)
    swap_used = max(0, swap_total - swap_free)
    return {
        "memory": {"usedBytes": used, "totalBytes": total, "percent": round(used * 100 / total, 1) if total else 0},
        "swap": {"usedBytes": swap_used, "totalBytes": swap_total, "percent": round(swap_used * 100 / swap_total, 1) if swap_total else 0},
    }

def network():
    rx = tx = 0
    for line in open("/proc/net/dev").read().splitlines()[2:]:
        if ":" not in line: continue
        name, values = line.split(":", 1)
        if name.strip() == "lo": continue
        parts = values.split()
        rx += int(parts[0]); tx += int(parts[8])
    return {"rxBytes": rx, "txBytes": tx}

def state(command):
    out = run(command).lower()
    return "online" if out in ("active", "running", "healthy", "true") else ("offline" if out else "unknown")

def docker_stats():
    if not shutil.which("docker"):
        return {"running": 0, "total": 0}, "offline"
    total = run("docker ps -aq | wc -l")
    running = run("docker ps -q | wc -l")
    return {"running": int(running or 0), "total": int(total or 0)}, "online"

def docker_service_state(*needles):
    names = run("docker ps --format '{{.Names}}'").splitlines()
    lowered = [n.lower() for n in names]
    return "online" if any(any(needle in n for needle in needles) for n in lowered) else "offline"

def postgres_state():
    return docker_service_state("postgres", "supabase-db", "pooler")

def app_state():
    return docker_service_state("supabase-studio", "supabase-kong", "supabase-auth", "supabase-rest", "supabase-realtime")

def payload():
    mem = meminfo()
    du = shutil.disk_usage("/")
    loads = os.getloadavg()
    containers, docker = docker_stats()
    cpu_model = run("awk -F: '/model name/ {print $2; exit}' /proc/cpuinfo").strip()
    os_name = platform.platform()
    try:
        for line in open("/etc/os-release"):
            if line.startswith("PRETTY_NAME="):
                os_name = line.split("=", 1)[1].strip().strip('"')
                break
    except Exception:
        pass
    process_count = len([x for x in os.listdir("/proc") if x.isdigit()])
    caddy = docker_service_state("caddy")
    nginx = state("systemctl is-active nginx")
    return {
        "ok": True,
        "version": "1.0.0",
        "hostname": socket.gethostname(),
        "os": os_name,
        "kernel": platform.release(),
        "uptimeSeconds": float(open("/proc/uptime").read().split()[0]),
        "cpu": {"percent": cpu_percent(), "cores": os.cpu_count(), "model": cpu_model},
        **mem,
        "disk": {
            "usedBytes": du.used,
            "totalBytes": du.total,
            "freeBytes": du.free,
            "percent": round(du.used * 100 / du.total, 1) if du.total else 0,
        },
        "load": {"one": loads[0], "five": loads[1], "fifteen": loads[2]},
        "network": network(),
        "containers": containers,
        "processCount": process_count,
        "services": {
            "docker": docker,
            "caddy": caddy,
            "nginx": nginx,
            "postgres": postgres_state(),
            "app": app_state(),
        },
        "publicIp": os.environ.get("MW_PUBLIC_IP", ""),
        "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path not in ("/health", "/"):
            self.send_response(404); self.end_headers(); return
        if TOKEN and self.headers.get("Authorization", "") != f"Bearer {TOKEN}":
            self.send_response(401)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error":"unauthorized"}')
            return
        body = json.dumps(payload()).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *_):
        pass

if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
