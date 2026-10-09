import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..', '..');
const skill = readFileSync(join(root, 'skills', 'second-opinion', 'SKILL.md'), 'utf8');

test('T-SKILL-1 the skill has valid front matter (name matches the folder, description says when to use it)', () => {
  const m = /^---\nname: ([a-z0-9-]+)\ndescription: (.+)\n---\n/.exec(skill);
  assert.ok(m, 'front matter');
  assert.equal(m![1], 'second-opinion');
  assert.ok(m![2]!.length > 80 && m![2]!.length <= 1024);
  assert.match(m![2]!, /Use whenever/);
});

test('T-SKILL-2 every tool the skill names exists on the server (the skill cannot drift from the tools)', () => {
  const dir = join(root, 'apps', 'mcp-server', 'src', 'tools');
  const real = new Set<string>();
  for (const f of readdirSync(dir)) for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/name: '([a-z_]+)',/g)) real.add(m[1]!);
  const named = new Set([...skill.matchAll(/`([a-z]+_[a-z_]+)`/g)].map((m) => m[1]!));
  const toolLike = [...named].filter((n) => /^(check|place|request|resolve|get|list)_/.test(n));
  assert.ok(toolLike.length >= 5);
  for (const n of toolLike) assert.ok(real.has(n), `${n} is not a server tool`);
});

test('T-SKILL-3 the skill never tells the agent to resolve approvals or run held actions', () => {
  assert.match(skill, /Never call `resolve_approval` yourself/);
  assert.match(skill, /fails? closed|Failing closed/i);
});
