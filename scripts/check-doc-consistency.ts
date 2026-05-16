/**
 * check-doc-consistency.ts
 *
 * 检查代码与 design/60-tech/60-architecture.md 中「权威列表」的一致性。
 *
 * 扫描范围：
 *   - ECS 组件：src/core/components.ts 中所有 `export const X = defineComponent(...)` 的 X
 *   - ECS 系统：src/systems/*.ts 中所有 `name: 'XxxSystem'` 字段值
 *   - RuleHandler：src/**\/*.ts 中所有 `registerHandler('name', ...)` 的 name 字符串
 *
 * 运行方式：
 *   npx tsx scripts/check-doc-consistency.ts          # 检查模式（有差异则 exit 1）
 *   npx tsx scripts/check-doc-consistency.ts --fix    # 修复模式（自动把代码列表写回文档）
 *
 * architecture.md 中的权威列表块格式（由脚本维护，禁止手工编辑）：
 *   <!-- CODEGEN:components:START -->
 *   - ComponentName
 *   <!-- CODEGEN:components:END -->
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { readdirSync } from 'fs';

const ROOT = resolve(import.meta.dirname, '..');
const FIX_MODE = process.argv.includes('--fix');

const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

function scanComponents(): string[] {
  const src = readFileSync(join(ROOT, 'src/core/components.ts'), 'utf-8');
  const matches = [...src.matchAll(/^export const (\w+)\s*=\s*defineComponent/gm)];
  return matches.map((m) => m[1]!).sort();
}

function scanSystems(): { name: string; phase: string; file: string }[] {
  const systemsDir = join(ROOT, 'src/systems');
  const results: { name: string; phase: string; file: string }[] = [];

  const files = readdirSync(systemsDir).filter(
    (f) => f.endsWith('.ts') && !f.includes('__tests__'),
  );

  for (const file of files) {
    const src = readFileSync(join(systemsDir, file), 'utf-8');
    const nameMatch = src.match(/name:\s*['"](\w+)['"]/);
    const phaseMatch = src.match(/phase:\s*['"](\w+)['"]/);
    if (nameMatch) {
      results.push({
        name: nameMatch[1]!,
        phase: phaseMatch?.[1] ?? 'unknown',
        file,
      });
    }
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

function scanRuleHandlers(): string[] {
  const names = new Set<string>();

  function walkDir(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        walkDir(full);
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.includes('.test.')) {
        const src = readFileSync(full, 'utf-8');
        for (const m of src.matchAll(/registerHandler\(\s*['"]([^'"]+)['"]/g)) {
          names.add(m[1]!);
        }
      }
    }
  }

  walkDir(join(ROOT, 'src'));
  return [...names].sort();
}

const ARCH_DOC = join(ROOT, 'design/60-tech/60-architecture.md');

function readBlock(content: string, key: string): string[] {
  const startTag = `<!-- CODEGEN:${key}:START -->`;
  const endTag = `<!-- CODEGEN:${key}:END -->`;
  const start = content.indexOf(startTag);
  const end = content.indexOf(endTag);
  if (start === -1 || end === -1) return [];
  const block = content.slice(start + startTag.length, end).trim();
  return block
    .split('\n')
    .map((l) => l.replace(/^-\s*/, '').trim())
    .filter(Boolean);
}

function writeBlock(content: string, key: string, lines: string[]): string {
  const startTag = `<!-- CODEGEN:${key}:START -->`;
  const endTag = `<!-- CODEGEN:${key}:END -->`;
  const newBlock = `${startTag}\n${lines.map((l) => `- ${l}`).join('\n')}\n${endTag}`;
  const start = content.indexOf(startTag);
  const end = content.indexOf(endTag);
  if (start === -1 || end === -1) {
    return content.trimEnd() + '\n\n' + newBlock + '\n';
  }
  return content.slice(0, start) + newBlock + content.slice(end + endTag.length);
}

interface DiffResult {
  key: string;
  label: string;
  codeItems: string[];
  docItems: string[];
  addedInCode: string[];
  removedInCode: string[];
}

function diff(key: string, label: string, codeItems: string[], docItems: string[]): DiffResult {
  const codeSet = new Set(codeItems);
  const docSet = new Set(docItems);
  return {
    key,
    label,
    codeItems,
    docItems,
    addedInCode: codeItems.filter((c) => !docSet.has(c)),
    removedInCode: docItems.filter((d) => !codeSet.has(d)),
  };
}

function main() {
  console.log(bold('\n=== check-doc-consistency ===\n'));

  const components = scanComponents();
  const systems = scanSystems();
  const handlers = scanRuleHandlers();

  const systemNames = systems.map((s) => `${s.name} [${s.phase}]`);
  const handlerNames = handlers;

  console.log(`代码扫描结果:`);
  console.log(`  ECS 组件: ${components.length} 个`);
  console.log(`  ECS 系统: ${systems.length} 个`);
  console.log(`  RuleHandler: ${handlers.length} 个\n`);

  let archContent = readFileSync(ARCH_DOC, 'utf-8');
  const docComponents = readBlock(archContent, 'components');
  const docSystems = readBlock(archContent, 'systems');
  const docHandlers = readBlock(archContent, 'handlers');

  const diffs: DiffResult[] = [
    diff('components', 'ECS 组件', components, docComponents),
    diff('systems', 'ECS 系统', systemNames, docSystems),
    diff('handlers', 'RuleHandler', handlerNames, docHandlers),
  ];

  let hasError = false;

  for (const d of diffs) {
    const hasIssue = d.addedInCode.length > 0 || d.removedInCode.length > 0;

    if (!hasIssue) {
      console.log(green(`✓ ${d.label} — 文档与代码一致 (${d.codeItems.length} 项)`));
      continue;
    }

    hasError = true;
    console.log(red(`✗ ${d.label} — 发现不一致:`));
    if (d.addedInCode.length > 0) {
      console.log(yellow(`  代码新增（文档未记录）:`));
      d.addedInCode.forEach((item) => console.log(`    + ${item}`));
    }
    if (d.removedInCode.length > 0) {
      console.log(yellow(`  文档多余（代码已不存在）:`));
      d.removedInCode.forEach((item) => console.log(`    - ${item}`));
    }
  }

  const isFirstRun = docComponents.length === 0 && docSystems.length === 0 && docHandlers.length === 0;

  if (FIX_MODE || isFirstRun) {
    if (isFirstRun) {
      console.log(yellow('\n首次运行：architecture.md 中尚无权威列表块，自动初始化...\n'));
    } else {
      console.log(yellow('\n--fix 模式：将代码列表同步到 architecture.md...\n'));
    }

    archContent = writeBlock(archContent, 'components', components);
    archContent = writeBlock(archContent, 'systems', systemNames);
    archContent = writeBlock(archContent, 'handlers', handlerNames.length > 0 ? handlerNames : ['(暂无注册的 RuleHandler)']);
    writeFileSync(ARCH_DOC, archContent, 'utf-8');
    console.log(green(`✓ architecture.md 已更新`));
    console.log(`  写入 ECS 组件: ${components.length} 项`);
    console.log(`  写入 ECS 系统: ${systems.length} 项`);
    console.log(`  写入 RuleHandler: ${handlerNames.length} 项\n`);
    process.exit(0);
  }

  if (hasError) {
    console.log(red('\n❌ 文档与代码不一致。'));
    console.log('   修复方法：运行 `npm run check:doc -- --fix` 自动同步文档。\n');
    process.exit(1);
  } else {
    console.log(green('\n✅ 文档与代码完全一致。\n'));
    process.exit(0);
  }
}

main();
