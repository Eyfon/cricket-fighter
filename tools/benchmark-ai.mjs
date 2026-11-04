import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { simulateAiMatch } from './ai-simulation.mjs';
import { roster } from '../js/roster.js';
import { AI_PROFILES } from '../js/ai-profiles.js';

const args = process.argv.slice(2);
const argument = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; };
const seeds = Number(argument('--seeds', 1000));
const baseSeed = Number(argument('--base-seed', 34829));
const prefix = argument('--output', 'artifacts/ai-benchmark');
if (!Number.isInteger(seeds) || seeds < 2 || !Number.isInteger(baseSeed)) throw new Error('Use --seeds >= 2 and an integer --base-seed');
const pairs = argument('--pair', '').length ? [argument('--pair', '').split(',')]
  : [['normal', 'easy'], ['hard', 'normal'], ['hard', 'easy'], ['easy', 'easy'], ['normal', 'normal'], ['hard', 'hard']];
if (pairs.some((pair) => pair.length !== 2 || pair.some((level) => !AI_PROFILES[level]))) throw new Error('Invalid difficulty pair');
const hash = createHash('sha256');
for (const file of ['js/ai.js', 'js/ai-profiles.js', 'js/combat.js', 'js/combat-world.js', 'js/battle-frame.js', 'js/roster.js', 'tools/ai-simulation.mjs']) hash.update(await readFile(file));
const revision = hash.digest('hex').slice(0, 16);
const report = { date: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date()),
  revision, seeds, baseSeed, seconds: 60, healthMultiplier: 1, pairings: [] };
const average = (array) => array.reduce((sum, value) => sum + value, 0) / array.length;
function interval(groups) {
  const mean = average(groups);
  const variance = groups.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (groups.length - 1);
  const margin = 1.96 * Math.sqrt(variance / groups.length);
  return [Math.max(0, mean - margin), Math.min(1, mean + margin)];
}
for (const [first, second] of pairs) {
  const row = { levels: [first, second], matches: 0, wins: 0, draws: 0, losses: 0, timeouts: 0,
    activeSeconds: 0, blocks: 0, pointsSpent: [0, 0], combos: [0, 0],
    damageDealt: [0, 0], fullMeterSeconds: [0, 0], directAttacks: [0, 0], directContacts: [0, 0],
    starts: [{}, {}], byCharacters: {}, groups: [], results: [] };
  for (let group = 0; group < seeds; group++) {
    const seed = (baseSeed + Math.imul(group, 0x9e3779b9)) >>> 0;
    const scores = [];
    for (let a = 0; a < roster.length; a++) for (let b = 0; b < roster.length; b++) for (const mirrored of [false, true]) {
      const characters = mirrored ? [b, a] : [a, b];
      const levels = mirrored ? [second, first] : [first, second];
      const match = simulateAiMatch({ seed, characters, levels, swapStreams: mirrored });
      const owner = mirrored ? 1 : 0;
      const score = match.winner === null ? 0.5 : match.winner === owner ? 1 : 0;
      scores.push(score); row.matches++;
      row[score === 1 ? 'wins' : score === 0.5 ? 'draws' : 'losses']++;
      row.timeouts += Number(match.timeout); row.activeSeconds += match.activeSeconds; row.blocks += match.blocks;
      const key = roster[a].name + ' vs ' + roster[b].name;
      const bin = row.byCharacters[key] ||= { matches: 0, score: 0 };
      bin.matches++; bin.score += score;
      for (let i = 0; i < 2; i++) {
        const stat = match.fighters[i === 0 ? owner : 1 - owner];
        for (const metric of ['pointsSpent', 'combos', 'damageDealt', 'fullMeterSeconds', 'directAttacks', 'directContacts']) row[metric][i] += stat[metric];
        for (const [move, count] of Object.entries(stat.starts)) row.starts[i][move] = (row.starts[i][move] || 0) + count;
      }
      row.results.push({ seed, characters, levels, winner: match.winner, hp: match.fighters.map((f) => f.hp), activeSeconds: match.activeSeconds });
    }
    row.groups.push(average(scores));
  }
  row.scoreRate = average(row.groups); row.interval95 = interval(row.groups);
  report.pairings.push(row);
  console.log(JSON.stringify({ levels: row.levels, matches: row.matches, scoreRate: row.scoreRate, interval95: row.interval95, timeoutRate: row.timeouts / row.matches, averageSeconds: row.activeSeconds / row.matches }));
}
await mkdir('artifacts', { recursive: true });
await writeFile(prefix + '.json', JSON.stringify(report, null, 2));
const pct = (n) => (n * 100).toFixed(1) + '%';
const title = (levels) => levels.map((level) => AI_PROFILES[level].name).join(' vs ');
let markdown = '# AI 难度实测对比\n\n';
markdown += '日期：' + report.date + '；实现指纹：`' + revision + '`。每组使用 ' + seeds + ' 个种子，默认生命 100、60 秒，覆盖双方所有角色组合与交换左右。每个配对共 ' + (seeds * roster.length ** 2 * 2) + ' 场。\n\n';
markdown += '表中得分率按前者计：胜 1、平 0.5、负 0。95% 区间按种子组均值计算，交换左右的对局不当作独立样本。使用实际战斗引擎、固定步长、角色分离、命中停顿和大招时停；不包含开场及 KO 演出。\n\n';
markdown += '| 对比 | 胜 / 平 / 负 | 得分率 | 95% 区间 | 超时率 | 平均战斗时间 |\n| --- | --- | --- | --- | --- | --- |\n';
for (const row of report.pairings) markdown += '| ' + title(row.levels) + ' | ' + [row.wins, row.draws, row.losses].join(' / ') + ' | ' + pct(row.scoreRate) + ' | ' + row.interval95.map(pct).join('–') + ' | ' + pct(row.timeouts / row.matches) + ' | ' + (row.activeSeconds / row.matches).toFixed(1) + '秒 |\n';
markdown += '\n## 按角色分组\n\n| 等级配对 | 前者角色 vs 后者角色 | 前者得分率 |\n| --- | --- | --- |\n';
for (const row of report.pairings) for (const [key, bin] of Object.entries(row.byCharacters)) markdown += '| ' + title(row.levels) + ' | ' + key + ' | ' + pct(bin.score / bin.matches) + ' |\n';
markdown += '\n## 行为指标\n\n每项按前者 / 后者列出。近战接触率排除投射物和范围爆发，是近战动作进入接触判定的比例，不等同于所有攻击的实际伤害命中率。\n\n| 对比 | 每场耗点 | 每场合法取消 | 近战接触率 | 每场满点闲置秒数 |\n| --- | --- | --- | --- | --- |\n';
for (const row of report.pairings) markdown += '| ' + title(row.levels) + ' | ' + row.pointsSpent.map((x) => (x / row.matches).toFixed(2)).join(' / ') + ' | ' + row.combos.map((x) => (x / row.matches).toFixed(2)).join(' / ') + ' | ' + row.directContacts.map((x, i) => pct(x / Math.max(1, row.directAttacks[i]))).join(' / ') + ' | ' + row.fullMeterSeconds.map((x) => (x / row.matches).toFixed(2)).join(' / ') + ' |\n';
markdown += '\n完整种子、每场结果与招式使用次数保存在本地 `' + prefix + '.json`。结果只反映本版本与当前角色，不保证未来新增角色具有相同难度差距。\n';
await writeFile(prefix + '.md', markdown);
if (args.includes('--publish-report')) await writeFile('docs/AI-COMPARISON.md', markdown);
console.log('Saved ' + prefix + '.json and .md');
