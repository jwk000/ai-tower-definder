#!/usr/bin/env python3
"""将 .memory 下旧格式文件名（含冒号或空格）迁移为新格式（下划线分隔）。

旧格式示例: 棋盘分析_V1_2026.04.23 12:04:22.md
新格式示例: 棋盘分析_V1_2026.04.23_12.04.22.md

默认 dry-run，加 --apply 实际执行重命名。
"""
from __future__ import annotations

import argparse
import re
from pathlib import Path

SKIP_DIRS = {"_archive", ".sisyphus-archive"}
SKIP_FILES = {"_index.md", "_latest.md"}

OLD_SUFFIX_RE = re.compile(
    r"^(?P<desc>.+?)_V(?P<ver>\d+)_(?P<date>\d{4}\.\d{2}\.\d{2})"
    r"(?P<sep>[ _])"
    r"(?P<time>\d{2}[.:]\d{2}[.:]\d{2})$"
)


def needs_migration(stem: str) -> str | None:
    m = OLD_SUFFIX_RE.match(stem)
    if not m:
        return None

    sep = m.group("sep")
    time_part = m.group("time")
    has_colon = ":" in time_part
    has_space = sep == " "

    if not has_colon and not has_space:
        return None

    new_time = time_part.replace(":", ".")
    return f"{m.group('desc')}_V{m.group('ver')}_{m.group('date')}_{new_time}"


def walk(root: Path) -> list[Path]:
    result: list[Path] = []
    stack: list[Path] = [root]
    while stack:
        current = stack.pop()
        if current.name in SKIP_DIRS:
            continue
        result.append(current)
        children = sorted(
            (c for c in current.iterdir() if c.is_dir() and c.name not in SKIP_DIRS),
            key=lambda p: p.name,
            reverse=True,
        )
        stack.extend(children)
    return result


def migrate(root: Path, apply: bool) -> int:
    count = 0
    for directory in walk(root):
        for entry in sorted(directory.iterdir()):
            if not entry.is_file() or entry.suffix.lower() != ".md":
                continue
            if entry.name in SKIP_FILES:
                continue

            new_stem = needs_migration(entry.stem)
            if new_stem is None:
                continue

            new_name = f"{new_stem}{entry.suffix}"
            new_path = entry.parent / new_name

            if new_path.exists():
                print(f"[SKIP] 目标已存在: {entry.name} -> {new_name}")
                continue

            count += 1
            if apply:
                entry.rename(new_path)
                print(f"[RENAME] {entry.name} -> {new_name}")
            else:
                print(f"[DRY-RUN] {entry.name} -> {new_name}")

    mode = "APPLY" if apply else "DRY-RUN"
    print(f"\n[{mode}] 共 {count} 个文件需要迁移")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="迁移旧格式文件名（冒号/空格 → 下划线/点号）")
    default_root = Path(__file__).resolve().parent / "../.memory/"
    parser.add_argument("--root", type=Path, default=default_root, help="扫描根目录（默认: ../.memory/）")
    parser.add_argument("--apply", action="store_true", help="实际执行重命名（默认 dry-run）")
    args = parser.parse_args()

    root = args.root.resolve()
    if not root.exists() or not root.is_dir():
        raise SystemExit(f"根目录不存在: {root}")

    return migrate(root, apply=args.apply)


if __name__ == "__main__":
    raise SystemExit(main())
