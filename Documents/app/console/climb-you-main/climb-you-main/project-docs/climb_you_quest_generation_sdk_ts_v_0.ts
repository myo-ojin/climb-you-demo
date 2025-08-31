/**
 * Climb You – Quest Generation SDK (TypeScript) v0.1
 *
 * Purpose: Domain-agnostic quest generation pipeline using LLM prompts
 * (A) Goal→Skill Map, (B) Skill Map→Daily Quests, (C) Policy Check.
 *
 * Requires: zod (npm i zod)
 * Optional: Your LLM provider SDK (OpenAI, Anthropic, etc.)
 */

// -----------------------------
// 0) Imports & Utilities
// -----------------------------
import { z } from "zod";

/** Extract the first JSON object/array from a free-form LLM text reply. */
export function extractFirstJson<T = unknown>(text: string): T {
  // Try fenced blocks first
  const fence = /```(?:json)?\n([\s\S]*?)\n```/i.exec(text);
  const candidate = fence ? fence[1] : text;
  // Find first '{' or '[' and attempt to parse up to matching end
  const start = Math.min(
    ...[candidate.indexOf("{"), candidate.indexOf("[")].filter((i) => i >= 0)
  );
  if (start === Infinity) throw new Error("No JSON found in LLM response");
  // Heuristic: take from start to last '}' or ']'
  const lastBrace = candidate.lastIndexOf("}");
  const lastBracket = candidate.lastIndexOf("]");
  const end = Math.max(lastBrace, lastBracket) + 1;
  const jsonStr = candidate.slice(start, end).trim();
  return JSON.parse(jsonStr) as T;
}

// -----------------------------
// 1) Types & Schemas
// -----------------------------

// Profile/Derived/Checkins (aligns with Profile 設計 v1)
export const ProfileV1Schema = z.object({
  time_budget_min_per_day: z.number().int().min(15).max(240),
  peak_hours: z.array(z.number().int().min(0).max(23)).max(8),
  env_constraints: z.array(z.string()).max(10),
  hard_constraints: z.array(z.string()).max(10),
  motivation_style: z.enum(["push", "pull", "social"]),
  difficulty_tolerance: z.number().min(0).max(1),
  novelty_preference: z.number().min(0).max(1),
  pace_preference: z.enum(["sprint", "cadence"]),
  long_term_goal: z.string().min(4).max(240).optional(), // 入力はオンボ1画面で
  milestone_granularity: z.number().min(0).max(1).optional(),
  current_level_tags: z.array(z.string()).max(15).default([]),
  priority_areas: z.array(z.string()).max(5).default([]),
  heat_level: z.number().int().min(1).max(5).default(3),
  risk_factors: z.array(z.string()).max(10).default([]),
  preferred_session_length_min: z.number().int().min(10).max(60).default(20),
  modality_preference: z.array(z.enum(["read", "video", "audio", "dialog", "mimesis"]))
    .min(1)
    .max(5)
    .default(["read"]),
  deliverable_preferences: z
    .array(z.enum(["note", "flashcards", "snippet", "mini_task", "past_paper"]))
    .max(2)
    .default(["note"]),
  weekly_minimum_commitment_min: z.number().int().min(60).max(600).default(120),
  goal_motivation: z.enum(["low","mid","high"]).default("mid"),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});
export type ProfileV1 = z.infer<typeof ProfileV1Schema>;

export const DerivedSchema = z.object({
  daily_capacity_min: z.number().int().min(10).max(240),
  quest_count_hint: z.number().int().min(3).max(6),
  novelty_ratio: z.number().min(0).max(1).default(0.5),
  difficulty_rating: z.number().min(800).max(2000).default(1200),
  difficulty_hint: z.number().min(0).max(1).default(0.5),
});
export type Derived = z.infer<typeof DerivedSchema>;

export const DailyCheckinSchema = z.object({
  mood_energy: z.enum(["low", "mid", "high"]).default("mid"),
  available_time_today_delta_min: z.number().int().min(-60).max(60).default(0),
  focus_noise: z.enum(["low", "mid", "high"]).default("mid"),
});
export type DailyCheckins = z.infer<typeof DailyCheckinSchema>;

// Pattern types (domain-agnostic)
export const PatternEnum = z.enum([
  "read_note_q",
  "flashcards",
  "build_micro",
  "config_verify",
  "debug_explain",
  "feynman",
  "past_paper",
  "socratic",
  "shadowing",
  "retrospective",
]);
export type Pattern = z.infer<typeof PatternEnum>;

export const SkillAtomSchema = z.object({
  id: z.string().min(3),
  label: z.string().min(3),
  type: z.enum(["concept", "procedure", "habit"]),
  level: z.enum(["intro", "basic", "intermediate", "advanced"]),
  bloom: z.enum(["remember", "understand", "apply", "analyze", "evaluate", "create"]),
  prereq: z.array(z.string()).default([]),
  representative_tasks: z.array(z.string()).min(1).max(6),
  suggested_patterns: z.array(PatternEnum).default([]),
});
export type SkillAtom = z.infer<typeof SkillAtomSchema>;

export const QuestSchema = z.object({
  title: z.string().min(4),
  pattern: PatternEnum,
  minutes: z.number().int().min(10).max(90),
  difficulty: z.number().min(0).max(1).default(0.5),
  deliverable: z.string().min(2),
  steps: z.array(z.string()).min(1).max(3).optional(),
  criteria: z.array(z.string()).min(1),
  knowledge_check: z
    .array(z.object({ q: z.string(), a: z.string() }))
    .default([]),
  tags: z.array(z.string()).min(1),
});
export type Quest = z.infer<typeof QuestSchema>;

export const QuestListSchema = z.object({
  quests: z.array(QuestSchema).min(3).max(5),
  rationale: z.array(z.string()).optional(),
});
export type QuestList = z.infer<typeof QuestListSchema>;

// Constraints for the policy checker
export const ConstraintsSchema = z.object({
  total_minutes_max: z.number().int().min(10).max(300),
  preferred_session_length_min: z.number().int().min(10).max(60),
  novelty_ratio: z.number().min(0).max(1),
  env_constraints: z.array(z.string()),
  avoid_consecutive_same_pattern: z.boolean().default(true),
});
export type Constraints = z.infer<typeof ConstraintsSchema>;

// -----------------------------
// 2) Pattern definitions for prompts
// -----------------------------
export const PATTERN_DEFS: Record<Pattern, string> = {
  read_note_q:
    "読む→要点メモ→自作3問（学んだ概念を3問に落とし込む）。短い見出しと箇条書き。",
  flashcards:
    "フラッシュカード作成→10分後セルフチェック。用語/定義/例の3面で。",
  build_micro:
    "最小成果物を作る（小スクリプト/段落/図/1問演習）。完成条件を明確化。",
  config_verify:
    "設定・構成を作り、検証コマンドやテストで通す。手順と期待結果を明記。",
  debug_explain:
    "意図的に壊す/壊れている事象を説明→復旧。原因仮説と検証を言語化。",
  feynman:
    "2分で素人に説明→理解の穴を特定→穴を埋める行動。",
  past_paper:
    "代表/過去問を3題。各問で根拠と選択肢の消去理由を言語化。",
  socratic:
    "AIと対話で問い詰める。立場→反論→再反論で判断根拠を強化。",
  shadowing:
    "模写/追随（発話/コーディング）。環境制約に応じて発話→無音模写へ切替。",
  retrospective:
    "今日の学びの振り返り→明日の一手を箇条書きで決める。",
};

export function patternsForPrompt(): string {
  return Object.entries(PATTERN_DEFS)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
}

// -----------------------------
// 3) LLM Abstraction
// -----------------------------
export interface LLM {
  /** Return a text completion given system & user prompts. */
  complete(opts: { system?: string; prompt: string; temperature?: number }): Promise<string>;

  /** Convenience: complete and parse JSON with Zod validation. */
  completeJson<T>(opts: {
    system?: string;
    prompt: string;
    schema: z.ZodType<T>;
    temperature?: number;
  }): Promise<T>;
}

export class BasicLLM implements LLM {
  constructor(private caller: (opts: { system?: string; prompt: string; temperature?: number }) => Promise<string>) {}
  async complete(opts: { system?: string; prompt: string; temperature?: number }): Promise<string> {
    return this.caller(opts);
  }
  async completeJson<T>({ system, prompt, schema, temperature }: { system?: string; prompt: string; schema: z.ZodType<T>; temperature?: number }): Promise<T> {
    const txt = await this.complete({ system, prompt, temperature });
    const raw = extractFirstJson<T>(txt);
    const parsed = schema.parse(raw);
    return parsed;
  }
}

/**
 * Example adapter (OpenAI SDK) – pseudo-code
 *
 * const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 * const llm = new BasicLLM(async ({ system, prompt, temperature }) => {
 *   const messages = [ system && { role: 'system', content: system }, { role: 'user', content: prompt } ].filter(Boolean) as any[];
 *   const r = await openai.chat.completions.create({ model: 'gpt-4o', messages, temperature: temperature ?? 0.3 });
 *   return r.choices[0].message.content ?? '';
 * });
 */

// -----------------------------
// 4) Prompt Builders
// -----------------------------
export function buildSkillMapPrompt(args: {
  goalText: string;
  currentLevelTags?: string[];
  priorityAreas?: string[];
}): string {
  const { goalText, currentLevelTags = [], priorityAreas = [] } = args;
  return `あなたは専門分野を分解するカリキュラム設計者です。以下の目標テキストと現在地から、今後4週間の学習に使う Skill Map を JSON で返してください。\n\n出力フォーマット:\n{\n  "skill_atoms": [\n    {\n      "id": "domain.topic.subtopic",\n      "label": "わかりやすい短い名前",\n      "type": "concept|procedure|habit",\n      "level": "intro|basic|intermediate|advanced",\n      "bloom": "remember|understand|apply|analyze|evaluate|create",\n      "prereq": ["..."],\n      "representative_tasks": ["..."],\n      "suggested_patterns": ["read_note_q","build_micro","config_verify"]\n    }\n  ]\n}\n\n制約:\n- atom は 12–18 個。曖昧語を避け、汎用的で再利用可能な表現にする。\n- 各 atom に最低1つの representative_task を入れる（数値や条件を含め具体化）。\n- 法律名や固有名詞など確証が必要な場合は、"representative_tasks" に "一次情報を確認" ステップを含める。\n\n<GOAL_TEXT>\n${goalText}\n</GOAL_TEXT>\n<CURRENT_LEVEL_TAGS>${JSON.stringify(currentLevelTags)}</CURRENT_LEVEL_TAGS>\n<PRIORITY>${JSON.stringify(priorityAreas)}</PRIORITY>`;
}

export function buildDailyQuestsPrompt(args: {
  profile: ProfileV1;
  derived: Derived;
  skillAtoms: SkillAtom[];
  checkins: DailyCheckins;
}): string {
  const { profile, derived, skillAtoms, checkins } = args;
  const patternsDoc = patternsForPrompt();
  return `あなたは学習プランナーです。以下の profile/derived/skill_atoms/checkins から、本日のクエスト 3–5 件を JSON で返してください。\npattern は次の定義から選びます:\n${patternsDoc}\n\n制約:\n- 合計分数 ≤ daily_capacity_min + available_time_today_delta_min\n- minutes は preferred_session_length_min に近づける（±5分で丸め可）\n- novelty_ratio を尊重（新規:反復の配合）\n- 同種 pattern の連続は避ける\n- env_constraints と hard_constraints を尊重（例: 音声不可→発話型は模写に置換）\n- **クエストは提示のみ**（手取り足取りの解説や長い手順は不要）。steps は任意（入れる場合は要点のみ・最大3行）。
- 各クエストの difficulty は difficulty_hint（±0.1）に合わせる。\n\n<PROFILE_JSON>\n${JSON.stringify(profile)}\n</PROFILE_JSON>\n<DERIVED_JSON>\n${JSON.stringify(derived)}\n</DERIVED_JSON>\n<CHECKINS>\n${JSON.stringify(checkins)}\n</CHECKINS>\n<SKILL_MAP_JSON>\n${JSON.stringify({ skill_atoms: skillAtoms.slice(0, 24) })}\n</SKILL_MAP_JSON>`;
}

export function buildPolicyCheckPrompt(args: {
  questsCandidate: Quest[];
  constraints: Constraints;
}): string {
  const { questsCandidate, constraints } = args;
  return `次の quests[] を審査し、制約違反・重複・モード偏りを検出して修正案を出し、最終版を JSON で返してください。\n修正時は元の目的を保ちつつ pattern/minutes を微調整してください。\n\n入力:\n<QUESTS_CANDIDATE>${JSON.stringify({ quests: questsCandidate })}</QUESTS_CANDIDATE>\n<CONSTRAINTS>${JSON.stringify(constraints)}</CONSTRAINTS>\n\n出力フォーマット:\n{\n  "quests": [ /* 3–5件 */ ],\n  "rationale": ["修正理由を箇条書き"]\n}`;
}

// -----------------------------
// 5) Constraint helpers
// -----------------------------
export function difficultyHintFromMotivation(m: "low"|"mid"|"high"): number {
  return m === "low" ? 0.35 : m === "high" ? 0.65 : 0.5;
}

export function heatMultiplier(heatLevel: number): number {
  return { 1: 0.6, 2: 0.8, 3: 1.0, 4: 1.2, 5: 1.4 }[heatLevel as 1 | 2 | 3 | 4 | 5] ?? 1.0;
}

export function buildDerived(profile: ProfileV1): Derived {
  const daily = Math.floor(profile.time_budget_min_per_day * 0.8 * heatMultiplier(profile.heat_level ?? 3));
  const session = Math.max(10, Math.min(60, profile.preferred_session_length_min ?? 20));
  const countHint = Math.max(3, Math.min(6, Math.round(daily / session)));
  const novelty = profile.novelty_preference ?? 0.5;
  const difficulty_hint = difficultyHintFromMotivation((profile as any).goal_motivation ?? "mid");
  return { daily_capacity_min: daily, quest_count_hint: countHint, novelty_ratio: novelty, difficulty_rating: 1200, difficulty_hint };
}

export function buildConstraints(profile: ProfileV1, derived: Derived, checkins: DailyCheckins): Constraints {
  return ConstraintsSchema.parse({
    total_minutes_max: Math.max(10, derived.daily_capacity_min + (checkins.available_time_today_delta_min ?? 0)),
    preferred_session_length_min: profile.preferred_session_length_min ?? 20,
    novelty_ratio: derived.novelty_ratio,
    env_constraints: profile.env_constraints,
    avoid_consecutive_same_pattern: true,
  });
}

// -----------------------------
// 6) Main High-level API
// -----------------------------
export async function generateSkillMap(llm: LLM, args: {
  goalText: string;
  currentLevelTags?: string[];
  priorityAreas?: string[];
}): Promise<SkillAtom[]> {
  const prompt = buildSkillMapPrompt(args);
  const schema = z.object({ skill_atoms: z.array(SkillAtomSchema).min(10) });
  const { skill_atoms } = await llm.completeJson({ system: "You are a precise curriculum designer.", prompt, schema });
  return skill_atoms;
}

export async function generateDailyQuests(llm: LLM, args: {
  profile: ProfileV1;
  derived?: Derived;
  skillAtoms: SkillAtom[];
  checkins: DailyCheckins;
}): Promise<Quest[]> {
  const derived = args.derived ?? buildDerived(args.profile);
  const prompt = buildDailyQuestsPrompt({ profile: args.profile, derived, skillAtoms: args.skillAtoms, checkins: args.checkins });
  const { quests } = await llm.completeJson({ system: "You are a precise learning planner.", prompt, schema: QuestListSchema });
  // Post-process: clamp minutes to session length neighborhood
  const rounded = quests.map((q) => ({
    ...q,
    minutes: clampToSession(q.minutes, args.profile.preferred_session_length_min ?? 20),
  }));
  return rounded;
}

export async function policyCheck(llm: LLM, args: { quests: Quest[]; constraints: Constraints }): Promise<QuestList> {
  const prompt = buildPolicyCheckPrompt({ questsCandidate: args.quests, constraints: args.constraints });
  const result = await llm.completeJson({ system: "You are a careful policy checker.", prompt, schema: QuestListSchema });
  // Ensure constraints
  const total = result.quests.reduce((s, q) => s + q.minutes, 0);
  if (total > args.constraints.total_minutes_max) {
    // naive scale-down pass
    const scale = args.constraints.total_minutes_max / total;
    result.quests = result.quests.map((q) => ({ ...q, minutes: Math.max(10, Math.round(q.minutes * scale)) }));
  }
  result.quests = avoidConsecutiveSamePattern(result.quests);
  return result;
}

// -----------------------------
// 7) Post-processing helpers
// -----------------------------
export function clampToSession(minutes: number, session: number): number {
  const diff = minutes - session;
  if (Math.abs(diff) <= 5) return session; // snap
  return Math.max(10, Math.min(90, minutes));
}

export function avoidConsecutiveSamePattern(quests: Quest[]): Quest[] {
  const out: Quest[] = [];
  let last: Pattern | null = null;
  for (const q of quests) {
    if (last && q.pattern === last) {
      // try to swap with previous if possible
      const idx = out.findIndex((p) => p.pattern !== last);
      if (idx >= 0) {
        out.splice(idx, 0, q);
      } else {
        out.push(q); // give up, leave as-is
      }
    } else {
      out.push(q);
      last = q.pattern;
    }
  }
  return out;
}

// -----------------------------
// 8) Example wiring
// -----------------------------
/**
 * Example usage (pseudo):
 *
 * const profile: ProfileV1 = ProfileV1Schema.parse(loadedProfile);
 * const derived = buildDerived(profile);
 * const checkins: DailyCheckins = { mood_energy: 'mid', available_time_today_delta_min: 0, focus_noise: 'mid' };
 *
 * const skillAtoms = await generateSkillMap(llm, {
 *   goalText: 'AWS に強いインフラエンジニアになる',
 *   currentLevelTags: ['windows-server', 'basic-networking'],
 *   priorityAreas: ['AWS 基礎', 'ネットワーク', '監視']
 * });
 *
 * const questsCandidate = await generateDailyQuests(llm, {
 *   profile,
 *   derived,
 *   skillAtoms,
 *   checkins,
 * });
 *
 * const constraints = buildConstraints(profile, derived, checkins);
 * const { quests, rationale } = await policyCheck(llm, { quests: questsCandidate, constraints });
 *
 * // Save quests[] to Firestore and render in UI
 */

// -----------------------------
// 9) End
// -----------------------------


---

## （改訂）目標深掘りパート（4）
> 形式: **4択 + 自由記入（任意）**。言い回しをやわらかくし、ユーザーの頭の中の「目標の像」を具体化してクエスト設計に渡す。

9. **いま目指したいのは、どんな感じ？**  
   - 選択肢: ①まずは**知る・わかる**を増やしたい ②**できること**を増やしたい ③**結果（数字や順位）**を出したい ④**続ける習慣**をつくりたい  
   - 保存: `goal_focus = { choice: knowledge|skill|outcome|habit, note?: string }`
   - 自由記入（任意）: ひとことメモ（例: 「試験○月」「社内表彰」 等）

10. **どれくらいの期間で形にしたい？**  
    - 選択肢: ①**1か月**くらいで ②**3か月**を目安に ③**半年**かけて ④**1年〜**じっくり  
    - 保存: `goal_horizon = { choice: 1m|3m|6m|12m+, note?: string }`
    - 自由記入（任意）: もし日付が決まっていれば（例: 「12/31まで」）

11. **進め方の好みは？**  
    - 選択肢: ①**ていねい重視**（質を大切に） ②**スピード重視**（まず前へ） ③**ちょうど良く**（バランス） ④**試しながら**（実験して学ぶ）  
    - 保存: `goal_tradeoff = { choice: quality|speed|balance|experiment, note?: string }`

12. **「できた！」を何で確かめたい？**  
    - 選択肢: ①**テスト/スコア** ②**作ったもの**（デモ/ポートフォリオ） ③**実績**（成約・納品・本番運用） ④**発表/レビュー**  
    - 保存: `goal_evidence = { choice: credential_score|portfolio_demo|realworld_result|presentation_review, note?: string }`

**生成への影響**  
- `goal_focus` → クエストの重心（理解/実践/KPI/習慣）を切替  
- `goal_horizon` → 粒度と負荷カーブ（短期=即効課題↑、長期=基礎・積み上げ↑）  
- `goal_tradeoff` → 難易度/本数/新規:反復の配合  
- `goal_evidence` → `deliverable`/成功基準の型（スコア・成果物・実績・発表）

---

## （追記）やる気3段階と難易度の連動
- **オンボの長期目標入力時**に、やる気を3段階で取得: `goal_motivation = low | mid | high`
- 難易度ヒント（`difficulty_hint`）に写像してクエスト生成へ渡す：
  - `low` → 0.35（**やさしめ**。読む/FC/振り返り中心）
  - `mid` → 0.50（**ふつう**。読解＋小さな実践）
  - `high` → 0.65（**攻め**。小さな制作/設定検証/対話演習）
- 反映ポイント：
  1) 生成プロンプトに `difficulty_hint` を明示（各クエストの `difficulty` を±0.1 範囲で合わせる）
  2) パターン選択の優先度を調整（例: `low` なら `read_note_q`/`flashcards` を優先、`high` なら `build_micro`/`config_verify`/`socratic` を増やす）
  3) 分数は `daily_capacity_min / quest_count_hint` 近辺にスナップ（±5分）。


// ---------------------------------------------
// 10) Goal Deep-dive Questions – Prompt & Schemas
// ---------------------------------------------
import { z as _z } from "zod"; // alias just in case

export const GoalDeepDiveQuestionSchema = _z.object({
  id: _z.enum(["goal_focus","goal_horizon","goal_tradeoff","goal_evidence"]),
  title: _z.string(),
  help: _z.string().optional(),
  options: _z.array(
    _z.object({ label: _z.string(), value: _z.string() })
  ).length(4),
  memoEnabled: _z.boolean().default(true)
});
export type GoalDeepDiveQuestion = _z.infer<typeof GoalDeepDiveQuestionSchema>;

export const GoalDeepDiveQuestionsSchema = _z.object({
  questions: _z.array(GoalDeepDiveQuestionSchema).length(4)
});
export type GoalDeepDiveQuestions = _z.infer<typeof GoalDeepDiveQuestionsSchema>;

export const GoalDeepDiveAnswersSchema = _z.object({
  goal_focus: _z.object({ choice: _z.enum(["knowledge","skill","outcome","habit"]), note: _z.string().max(120).optional() }),
  goal_horizon: _z.object({ choice: _z.enum(["1m","3m","6m","12m+"]), note: _z.string().max(120).optional() }),
  goal_tradeoff: _z.object({ choice: _z.enum(["quality","speed","balance","experiment"]), note: _z.string().max(120).optional() }),
  goal_evidence: _z.object({ choice: _z.enum(["credential_score","portfolio_demo","realworld_result","presentation_review"]), note: _z.string().max(120).optional() })
});
export type GoalDeepDiveAnswers = _z.infer<typeof GoalDeepDiveAnswersSchema>;

/**
 * Build a prompt that returns the 4 gentle-worded questions in JSON.
 * You can call llm.completeJson({ schema: GoalDeepDiveQuestionsSchema, ... }).
 * Note: These questions are deterministic. You may also hard-code them.
 */
export function buildGoalDeepDiveQuestionsPrompt(args: { goalText?: string }) {
  const g = (args.goalText ?? "（ユーザーの目標テキスト）").slice(0, 240);
  return `あなたはプロダクトのオンボーディング設計者です。以下の目標テキストを踏まえ、
ユーザーの頭の中にある「目標の像」をやさしい言葉で深掘りする4問を JSON で返してください。
**出力は質問定義のみ**（解説や学習内容は不要）。

フォーマット:
{
  "questions": [
    {"id":"goal_focus","title":"いま目指したいのは、どんな感じ？",
     "options":[
       {"label":"まずは知る・わかるを増やしたい","value":"knowledge"},
       {"label":"できることを増やしたい","value":"skill"},
       {"label":"結果（数字や順位）を出したい","value":"outcome"},
       {"label":"続ける習慣をつくりたい","value":"habit"}
     ],"memoEnabled":true},
    {"id":"goal_horizon","title":"どれくらいの期間で形にしたい？",
     "options":[
       {"label":"1か月くらいで","value":"1m"},
       {"label":"3か月を目安に","value":"3m"},
       {"label":"半年かけて","value":"6m"},
       {"label":"1年〜じっくり","value":"12m+"}
     ],"memoEnabled":true},
    {"id":"goal_tradeoff","title":"進め方の好みは？",
     "options":[
       {"label":"ていねい重視（質を大切に）","value":"quality"},
       {"label":"スピード重視（まず前へ）","value":"speed"},
       {"label":"ちょうど良く（バランス）","value":"balance"},
       {"label":"試しながら（実験して学ぶ）","value":"experiment"}
     ],"memoEnabled":true},
    {"id":"goal_evidence","title":"『できた！』を何で確かめたい？",
     "options":[
       {"label":"テスト/スコア","value":"credential_score"},
       {"label":"作ったもの（デモ/ポートフォリオ）","value":"portfolio_demo"},
       {"label":"実績（成約・納品・本番運用）","value":"realworld_result"},
       {"label":"発表/レビュー","value":"presentation_review"}
     ],"memoEnabled":true}
  ]
}

<GOAL_TEXT>
${g}
</GOAL_TEXT>`;
}
