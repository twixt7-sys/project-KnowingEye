"""Backward-compatible entry point — delegates to adapter."""

from ai.adapter import analyze_frame_bgr as analyze_frame

__all__ = ["analyze_frame"]
