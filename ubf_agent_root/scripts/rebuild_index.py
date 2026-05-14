#!/usr/bin/env python3
"""重建 .memory 目录索引。

支持两种模式：
  1. 单目录模式（默认）：重建 --root 指定目录下的所有 _index.md
  2. 全局模式（--all）：扫描仓库根目录，依次重建全局 .memory/ 和各项目 .memory/
"""
from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

AUTO_COMMENT = "<!-- 此文件由 rebuild_index.py 自动生成，请勿手动编辑 -->"
VERSION_DATE_SUFFIX_RE = re.compile(
    r"^(?P<desc>.+?)_V(?P<version>\d+)_(?P<date>\d{4}\.\d{2}\.\d{2}(?:_\d{2}\.\d{2}\.\d{2})?)$"
)

# --all 模式下跳过的顶层目录
SKIP_TOP_DIRS = {".git", "scripts", "ai_workspace"}


@dataclass(frozen=True)
class ParsedDoc:
    path: Path
    name: str
    desc: str
    version: int
    date_raw: str | None
    date_sort: datetime


def normalize_date_for_sort(date_raw: str | None) -> datetime:
    if not date_raw:
        return datetime.min

    # 新格式: YYYY.MM.DD 或 YYYY.MM.DD_HH.mm.ss
    if "_" in date_raw:
        date_part, time_part = date_raw.split("_", 1)
        time_part = time_part.replace(".", ":")
        candidate = f"{date_part} {time_part}"
        for fmt in ("%Y.%m.%d %H:%M:%S", "%Y.%m.%d %H:%M"):
            try:
                return datetime.strptime(candidate, fmt)
            except ValueError:
                continue
    else:
        try:
            return datetime.strptime(date_raw, "%Y.%m.%d")
        except ValueError:
            return datetime.min

    return datetime.min


def parse_doc(md_file: Path) -> ParsedDoc:
    stem = md_file.stem
    match = VERSION_DATE_SUFFIX_RE.match(stem)
    if match:
        desc = match.group("desc")
        version = int(match.group("version"))
        date_raw = match.group("date")
        date_sort = normalize_date_for_sort(date_raw)
        return ParsedDoc(
            path=md_file,
            name=md_file.name,
            desc=desc,
            version=version,
            date_raw=date_raw,
            date_sort=date_sort,
        )

    return ParsedDoc(
        path=md_file,
        name=md_file.name,
        desc=stem,
        version=0,
        date_raw=None,
        date_sort=datetime.min,
    )


def should_skip_dir(directory: Path) -> bool:
    name = directory.name
    return name == "_archive" or name == ".sisyphus-archive" or name == "archive"


def sort_all_docs(docs: list[ParsedDoc]) -> list[ParsedDoc]:
    """按 desc 分组，组内按版本降序排列，组间按 desc 字母序。"""
    grouped: dict[str, list[ParsedDoc]] = {}
    for doc in docs:
        grouped.setdefault(doc.desc, []).append(doc)

    sorted_docs: list[ParsedDoc] = []
    for desc in sorted(grouped):
        items = grouped[desc]
        items.sort(key=lambda d: (d.version, d.date_sort, d.name), reverse=True)
        sorted_docs.extend(items)

    return sorted_docs


def relative_path_str(current_dir: Path, target: Path) -> str:
    relative = target.relative_to(current_dir)
    return f"./{relative.as_posix()}"


def title_for_dir(directory: Path) -> str:
    return f"{directory.name}索引"


def build_rows(
    directory: Path, subdirs: list[Path], docs: list[ParsedDoc]
) -> list[str]:
    rows: list[str] = []

    for subdir in sorted(subdirs, key=lambda p: p.name):
        rows.append(
            f"| {subdir.name} | 子目录（有独立 _index.md） | - | - | `{relative_path_str(directory, subdir)}/` |"
        )

    for doc in docs:
        version_text = f"V{doc.version}"
        date_text = doc.date_raw or "-"
        rows.append(
            f"| {doc.name} | {doc.desc} | {version_text} | {date_text} | `{relative_path_str(directory, doc.path)}` |"
        )

    return rows


def collect_subdirs(directory: Path) -> list[Path]:
    result: list[Path] = []
    for entry in directory.iterdir():
        if entry.is_dir() and not should_skip_dir(entry):
            result.append(entry)
    return result


def collect_markdown_docs(directory: Path) -> list[ParsedDoc]:
    docs: list[ParsedDoc] = []
    for entry in directory.iterdir():
        if not entry.is_file() or entry.suffix.lower() != ".md":
            continue
        if entry.name in {"_index.md", "_latest.md"}:
            continue
        docs.append(parse_doc(entry))
    return sort_all_docs(docs)


def build_index_content(directory: Path) -> str:
    docs = collect_markdown_docs(directory)
    subdirs = collect_subdirs(directory)

    lines: list[str] = [
        AUTO_COMMENT,
        "",
        f"# {title_for_dir(directory)}",
        "",
    ]

    lines.extend(
        [
            "| 文档 | 说明 | 版本 | 更新日期 | 路径 |",
            "|------|------|------|----------|------|",
        ]
    )
    lines.extend(build_rows(directory, subdirs, docs))

    lines.append("")
    return "\n".join(lines)


def walk_dirs(root: Path) -> list[Path]:
    result: list[Path] = []
    stack: list[Path] = [root]
    while stack:
        current = stack.pop()
        if should_skip_dir(current):
            continue
        result.append(current)

        children = [
            child
            for child in current.iterdir()
            if child.is_dir() and not should_skip_dir(child)
        ]
        children.sort(key=lambda p: p.name, reverse=True)
        stack.extend(children)

    result.sort(key=lambda p: p.as_posix())
    return result


def rebuild_indices(root: Path) -> None:
    for directory in walk_dirs(root):
        index_path = directory / "_index.md"
        content = build_index_content(directory)
        index_path.write_text(content, encoding="utf-8")


def find_all_memory_roots(repo_root: Path) -> list[Path]:
    """扫描仓库根目录，找到全局 .memory/ 和各项目 .memory/ 目录。"""
    roots: list[Path] = []

    global_memory = repo_root / ".memory"
    if global_memory.is_dir():
        roots.append(global_memory)

    for entry in sorted(repo_root.iterdir(), key=lambda p: p.name):
        if not entry.is_dir():
            continue
        if entry.name.startswith(".") or entry.name in SKIP_TOP_DIRS:
            continue
        project_memory = entry / ".memory"
        if project_memory.is_dir():
            roots.append(project_memory)

    return roots


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="重建 .memory 目录索引")
    default_root = Path(__file__).resolve().parent / "../.memory/"
    parser.add_argument(
        "--root",
        type=Path,
        default=default_root,
        help="索引根目录（默认: ../.memory/）",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        dest="rebuild_all",
        help="扫描仓库根目录，批量重建全局和所有项目的 .memory/ 索引",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.rebuild_all:
        repo_root = Path(__file__).resolve().parent.parent
        memory_roots = find_all_memory_roots(repo_root)
        if not memory_roots:
            raise SystemExit(f"未找到任何 .memory/ 目录: {repo_root}")
        for root in memory_roots:
            rebuild_indices(root)
            print(f"索引重建完成: {root}")
        return 0

    root = args.root.resolve()
    if not root.exists() or not root.is_dir():
        raise SystemExit(f"root 目录不存在或不可用: {root}")

    rebuild_indices(root)
    print(f"索引重建完成: {root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
