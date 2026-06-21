"""Shared DTO utilities."""

from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import Any


class BaseDTO:
    """Base DTO with consistent serialization helpers."""

    def to_dict(self) -> dict[str, Any]:
        if is_dataclass(self):
            return asdict(self)
        return dict(self.__dict__)

    @classmethod
    def from_dict(cls, payload: dict[str, Any]):
        return cls(**payload)
