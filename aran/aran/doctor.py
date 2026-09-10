"""Hardware probe -> local model recommendation.

The whole 'powerful AI without a GPU' question comes down to one number:
how much RAM is free for a model, and whether that model is dense or MoE.

A Mixture-of-Experts model activates only a fraction of its parameters per
token. Qwen3-30B-A3B has 30B parameters but ~3B active, so it costs a 30B
model's *memory* and a 3B model's *compute*. On a CPU that is the difference
between unusable and usable, and it reasons far above any dense model that
fits the same RAM. That is the trick -- not the GPU.
"""
from __future__ import annotations

import platform
import shutil
import subprocess
import sys
from dataclasses import dataclass


@dataclass
class Machine:
    os: str
    cpu: str
    cores: int
    ram_gb: float
    gpu: str | None
    vram_gb: float
    ssd: bool | None


def _ram_gb() -> float:
    if sys.platform == "win32":
        try:
            out = subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory"],
                capture_output=True, text=True, timeout=20,
            ).stdout.strip()
            return round(int(out) / 1024**3, 1)
        except Exception:
            return 0.0
    try:
        with open("/proc/meminfo") as fh:
            for line in fh:
                if line.startswith("MemTotal:"):
                    return round(int(line.split()[1]) / 1024**2, 1)
    except OSError:
        pass
    return 0.0


def _gpu() -> tuple[str | None, float]:
    """Return (name, vram_gb). nvidia-smi is the only reliable cross-platform probe."""
    if shutil.which("nvidia-smi"):
        try:
            out = subprocess.run(
                ["nvidia-smi", "--query-gpu=name,memory.total",
                 "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=20,
            ).stdout.strip().splitlines()
            if out:
                name, mem = [p.strip() for p in out[0].split(",")]
                return name, round(int(mem) / 1024, 1)
        except Exception:
            pass
    if sys.platform == "win32":
        try:
            out = subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 "(Get-CimInstance Win32_VideoController).Name"],
                capture_output=True, text=True, timeout=20,
            ).stdout.strip().splitlines()
            if out:
                return out[0].strip(), 0.0
        except Exception:
            pass
    return None, 0.0


def _is_ssd() -> bool | None:
    if sys.platform == "win32":
        try:
            out = subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 "(Get-PhysicalDisk).MediaType"],
                capture_output=True, text=True, timeout=20,
            ).stdout.upper()
            if "SSD" in out:
                return True
            if "HDD" in out:
                return False
        except Exception:
            pass
        return None
    try:
        with open("/sys/block/sda/queue/rotational") as fh:
            return fh.read().strip() == "0"
    except OSError:
        return None


def probe() -> Machine:
    gpu, vram = _gpu()
    return Machine(
        os=f"{platform.system()} {platform.release()}",
        cpu=platform.processor() or platform.machine(),
        cores=__import__("os").cpu_count() or 1,
        ram_gb=_ram_gb(),
        gpu=gpu,
        vram_gb=vram,
        ssd=_is_ssd(),
    )


# (min_ram_gb, ollama tag, human label, what it is good for)
# Tags drift -- verify against `ollama list` / the Ollama library before pulling.
TIERS = [
    (24.0, "qwen3:30b-a3b", "Qwen3 30B-A3B (MoE, ~3B active)",
     "Real local reasoning. Handles confidential CATIA and process work on its own."),
    (16.0, "qwen3:14b", "Qwen3 14B (dense, Q4)",
     "Decent local reasoning, slower. Confidential work is workable but not fast."),
    (10.0, "qwen3:8b", "Qwen3 8B (dense, Q4)",
     "Routing, redaction, summarising. Not enough for hard confidential reasoning."),
    (6.0, "qwen3:4b", "Qwen3 4B (dense, Q4)",
     "Routing and redaction only. Everything that needs thought goes to the cloud."),
]


def recommend(m: Machine) -> tuple[str | None, str, list[str]]:
    """Return (ollama_tag, verdict, prioritised spend list)."""
    # Leave headroom for Windows, CATIA and the browser. Roughly 40% of total,
    # floored at 6 GB, is what is realistically free for a model.
    usable = max(0.0, m.ram_gb - max(6.0, m.ram_gb * 0.4))
    buys: list[str] = []

    tag = label = None
    for min_ram, t, lbl, _ in TIERS:
        if usable >= min_ram:
            tag, label = t, lbl
            break

    if tag is None:
        verdict = (
            f"{m.ram_gb:.0f} GB total leaves ~{usable:.0f} GB for a model -- not enough "
            "for a useful local model. Cloud-only until RAM goes up."
        )
    else:
        verdict = (
            f"{m.ram_gb:.0f} GB total, ~{usable:.0f} GB usable -> {label}."
        )

    # Spend priority, best return first.
    if usable < 24.0:
        need = 24.0 + max(6.0, m.ram_gb * 0.4)
        buys.append(
            f"RAM to {int(need)} GB (~Rs 4,000-5,000 for a DDR4 SODIMM). This is the "
            "single highest-return purchase: it unlocks the 30B MoE model, which is "
            "what makes confidential work possible without a GPU."
        )
    if m.ssd is False:
        buys.append(
            "NVMe or SATA SSD (~Rs 2,500). On an HDD the model reloads from disk on "
            "every cold start and the memory database crawls."
        )
    if m.vram_gb >= 6.0:
        buys.append(
            f"Nothing -- your {m.gpu} with {m.vram_gb:.0f} GB VRAM already offloads "
            "most layers. Spend the budget on RAM instead."
        )
    buys.append("USB microphone (~Rs 1,000) -- only once Phase 0 is running.")
    return tag, verdict, buys


def report() -> None:
    m = probe()
    tag, verdict, buys = recommend(m)
    w = 66
    print("=" * w)
    print("ARAN DOCTOR -- what this machine can actually run")
    print("=" * w)
    print(f"  OS       {m.os}")
    print(f"  CPU      {m.cpu}  ({m.cores} cores)")
    print(f"  RAM      {m.ram_gb:.0f} GB")
    print(f"  GPU      {m.gpu or 'none detected'}"
          + (f"  ({m.vram_gb:.0f} GB VRAM)" if m.vram_gb else ""))
    print(f"  Disk     {'SSD' if m.ssd else 'HDD' if m.ssd is False else 'unknown'}")
    print("-" * w)
    print(f"  {verdict}")
    if tag:
        print(f"\n  Pull it with:   ollama pull {tag}")
        print(f"  Then set:       local_model = \"{tag}\"   in ~/.aran/aran.toml")
    print("-" * w)
    print("  Spend priority (Rs 10,000 budget):")
    for i, b in enumerate(buys, 1):
        print(f"    {i}. {b}")
    print("=" * w)


if __name__ == "__main__":
    report()
