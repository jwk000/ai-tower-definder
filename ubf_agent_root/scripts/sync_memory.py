#!/usr/bin/env python3

from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path


SOURCE_SUBDIRS = ("notepads", "plans", "drafts")
EXCLUDED_NAMES = {"boulder.json", ".DS_Store"}
EXCLUDED_DIRS = {"evidence"}
EXCLUDED_NOTEPAD_DIRS = {"sim-scripts"}


def is_excluded_path(relative_path: Path) -> bool:
    if relative_path.name in EXCLUDED_NAMES:
        return True

    return any(part in EXCLUDED_DIRS for part in relative_path.parts)


def should_copy(src_file: Path, dst_file: Path) -> str:
    if not dst_file.exists():
        return "new"

    src_mtime = src_file.stat().st_mtime
    dst_mtime = dst_file.stat().st_mtime
    if src_mtime > dst_mtime:
        return "update"

    return "skip"


def sync_directory(
    src_root: Path, dst_root: Path, dry_run: bool, counters: dict[str, int]
) -> None:
    if not src_root.exists() or not src_root.is_dir():
        print(f"[WARN] 源目录不存在，跳过: {src_root}")
        return

    for root, dirs, files in os.walk(src_root):
        current_root = Path(root)
        relative_root = current_root.relative_to(src_root)

        kept_dirs = []
        for dir_name in dirs:
            dir_relative_path = relative_root / dir_name
            if not is_excluded_path(dir_relative_path):
                if (
                    src_root.name == "notepads"
                    and relative_root == Path(".")
                    and dir_name in EXCLUDED_NOTEPAD_DIRS
                ):
                    continue
                kept_dirs.append(dir_name)
        dirs[:] = kept_dirs

        for file_name in sorted(files):
            relative_file_path = relative_root / file_name
            if is_excluded_path(relative_file_path):
                continue

            src_file = current_root / file_name
            dst_file = dst_root / relative_file_path
            action = should_copy(src_file, dst_file)

            if action == "skip":
                counters["skip"] += 1
                continue

            counters[action] += 1
            if dry_run:
                print(f"[DRY-RUN] {action.upper()}: {src_file} -> {dst_file}")
                continue

            dst_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_file, dst_file)
            print(f"[{action.upper()}] {src_file} -> {dst_file}")


def run_sync(project: Path, dry_run: bool) -> int:
    source_root = project / ".sisyphus"
    archive_root = project / "ubf_agent_root" / ".sisyphus-archive"

    counters: dict[str, int] = {"new": 0, "update": 0, "skip": 0}

    for subdir in SOURCE_SUBDIRS:
        sync_directory(source_root / subdir, archive_root / subdir, dry_run, counters)

    mode = "DRY-RUN" if dry_run else "SYNC"
    print(f"\n[{mode}] 摘要")
    print(f"新增: {counters['new']}")
    print(f"更新: {counters['update']}")
    print(f"跳过: {counters['skip']}")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="同步 .sisyphus 归档到 ubf_agent_root/.sisyphus-archive"
    )
    parser.add_argument("--project", type=Path, required=True, help="项目根目录（包含 .sisyphus/ 和 ubf_agent_root/ 的目录）")
    parser.add_argument("--dry-run", action="store_true", help="仅输出计划，不执行写入")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    project = args.project.resolve()
    if not project.is_dir():
        raise SystemExit(f"项目目录不存在: {project}")
    return run_sync(project=project, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
