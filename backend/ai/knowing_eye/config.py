"""Load production pipeline configuration from YAML."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

_AI_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_CONFIG = _AI_ROOT / "config" / "pipeline.yaml"


def load_config(path: str | Path | None = None) -> dict[str, Any]:
    config_path = Path(path) if path else _DEFAULT_CONFIG
    if not config_path.exists():
        raise FileNotFoundError(f"Config not found: {config_path}")
    with config_path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def resolve_path(config: dict[str, Any], key: str, base: Path | None = None) -> Path:
    base = base or _AI_ROOT
    rel = config["paths"][key]
    p = Path(rel)
    return p if p.is_absolute() else base / p
