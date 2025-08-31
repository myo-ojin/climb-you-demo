/**
 * Climb You – Prompt Engine (設計書完全移植版)
 * 
 * 設計書のプロンプト品質を100%保持した実装
 * project-docs/climb_you_quest_generation_sdk_ts_v_0.ts からの移植
 */

import { z } from "zod";

// -----------------------------
// 1) 設計書のスキーマを完全移植
// -----------------------------

export const ProfileV1Schema = z.object({
  time_budget_min_per_day: z.number().int().min(15).max(240),
  peak_hours: z.array(z.number().int().min(0).max(23)).max(8),
  env_constraints: z.array(z.string()).max(10),
  hard_constraints: z.array(z.string()).max(10),
  motivation_style: z.enum(["push", "pull", "social"]),
  difficulty_tolerance: z.number().min(0).max(1),
  novelty_preference: z.number().min(0).max(1),
  pace_preference: z.enum(["sprint", "cadence"]),
  long_term_goal: z.string().min(4).max(240).optional(),
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

export const ConstraintsSchema = z.object({
  total_minutes_max: z.number().int().min(10).max(300),
  preferred_session_length_min: z.number().int().min(10).max(60),
  novelty_ratio: z.number().min(0).max(1),
  env_constraints: z.array(z.string()),
  avoid_consecutive_same_pattern: z.boolean().default(true),
});

export type Constraints = z.infer<typeof ConstraintsSchema>;

// -----------------------------
// 2) 設計書のパターン定義を完全移植
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
// 3) 設計書のLLM抽象化を完全移植
// -----------------------------

/** 設計書のJSON抽出ユーティリティ */
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
  
  async completeJson<T>({ system, prompt, schema, temperature }: { 
    system?: string; 
    prompt: string; 
    schema: z.ZodType<T>; 
    temperature?: number 
  }): Promise<T> {
    const txt = await this.complete({ system, prompt, temperature });
    const raw = extractFirstJson<T>(txt);
    const parsed = schema.parse(raw);
    return parsed;
  }
}

// -----------------------------
// 4) 設計書のプロンプトビルダーを完全移植
// -----------------------------

export function buildSkillMapPrompt(args: {
  goalText: string;
  currentLevelTags?: string[];
  priorityAreas?: string[];
}): string {
  const { goalText, currentLevelTags = [], priorityAreas = [] } = args;
  return `あなたは専門分野を分解するカリキュラム設計者です。以下の目標テキストと現在地から、今後4週間の学習に使う Skill Map を JSON で返してください。

出力フォーマット:
{
  "skill_atoms": [
    {
      "id": "domain.topic.subtopic",
      "label": "わかりやすい短い名前",
      "type": "concept|procedure|habit",
      "level": "intro|basic|intermediate|advanced",
      "bloom": "remember|understand|apply|analyze|evaluate|create",
      "prereq": ["..."],
      "representative_tasks": ["..."],
      "suggested_patterns": ["read_note_q","build_micro","config_verify"]
    }
  ]
}

制約:
- atom は 12–18 個。曖昧語を避け、汎用的で再利用可能な表現にする。
- 各 atom に最低1つの representative_task を入れる（数値や条件を含め具体化）。
- 法律名や固有名詞など確証が必要な場合は、"representative_tasks" に "一次情報を確認" ステップを含める。

<GOAL_TEXT>
${goalText}
</GOAL_TEXT>
<CURRENT_LEVEL_TAGS>${JSON.stringify(currentLevelTags)}</CURRENT_LEVEL_TAGS>
<PRIORITY>${JSON.stringify(priorityAreas)}</PRIORITY>`;
}

export function buildDailyQuestsPrompt(args: {
  profile: ProfileV1;
  derived: Derived;
  skillAtoms: SkillAtom[];
  checkins: DailyCheckins;
}): string {
  const { profile, derived, skillAtoms, checkins } = args;
  const patternsDoc = patternsForPrompt();
  return `あなたは学習プランナーです。以下の profile/derived/skill_atoms/checkins から、本日のクエスト 3–5 件を JSON で返してください。
pattern は次の定義から選びます:
${patternsDoc}

制約:
- 合計分数 ≤ daily_capacity_min + available_time_today_delta_min
- minutes は preferred_session_length_min に近づける（±5分で丸め可）
- novelty_ratio を尊重（新規:反復の配合）
- 同種 pattern の連続は避ける
- env_constraints と hard_constraints を尊重（例: 音声不可→発話型は模写に置換）
- **クエストは提示のみ**（手取り足取りの解説や長い手順は不要）。steps は任意（入れる場合は要点のみ・最大3行）。
- 各クエストの difficulty は difficulty_hint（±0.1）に合わせる。

<PROFILE_JSON>
${JSON.stringify(profile)}
</PROFILE_JSON>
<DERIVED_JSON>
${JSON.stringify(derived)}
</DERIVED_JSON>
<CHECKINS>
${JSON.stringify(checkins)}
</CHECKINS>
<SKILL_MAP_JSON>
${JSON.stringify({ skill_atoms: skillAtoms.slice(0, 24) })}
</SKILL_MAP_JSON>`;
}

export function buildPolicyCheckPrompt(args: {
  questsCandidate: Quest[];
  constraints: Constraints;
}): string {
  const { questsCandidate, constraints } = args;
  return `次の quests[] を審査し、制約違反・重複・モード偏りを検出して修正案を出し、最終版を JSON で返してください。
修正時は元の目的を保ちつつ pattern/minutes を微調整してください。

入力:
<QUESTS_CANDIDATE>${JSON.stringify({ quests: questsCandidate })}</QUESTS_CANDIDATE>
<CONSTRAINTS>${JSON.stringify(constraints)}</CONSTRAINTS>

出力フォーマット:
{
  "quests": [ /* 3–5件 */ ],
  "rationale": ["修正理由を箇条書き"]
}`;
}

// -----------------------------
// 5) 設計書のヘルパー関数を完全移植
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
  const difficulty_hint = difficultyHintFromMotivation(profile.goal_motivation ?? "mid");
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
// 6) 後処理ヘルパー（設計書完全移植）
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