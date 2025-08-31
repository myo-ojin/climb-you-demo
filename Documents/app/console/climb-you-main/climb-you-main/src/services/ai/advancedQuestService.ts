/**
 * Advanced Quest Service - 設計書のプロンプト品質を活用
 * 
 * promptEngine.tsの高品質プロンプトとOpenAI APIを統合した
 * 次世代クエスト生成サービス
 */

import {
  BasicLLM,
  LLM,
  ProfileV1,
  Derived,
  DailyCheckins,
  SkillAtom,
  Quest,
  QuestList,
  Constraints,
  buildSkillMapPrompt,
  buildDailyQuestsPrompt,
  buildPolicyCheckPrompt,
  buildDerived,
  buildConstraints,
  clampToSession,
  avoidConsecutiveSamePattern,
  SkillAtomSchema,
  QuestListSchema,
  extractFirstJson,
} from './promptEngine';

import { z } from 'zod';
import { apiKeyManager } from '../../config/apiKeys';

class AdvancedQuestService {
  private llm: LLM | null = null;

  /**
   * 環境変数からOpenAI API キーを使用してサービスを自動初期化
   */
  initialize(): boolean {
    const config = apiKeyManager.getOpenAIConfig();
    
    if (!config.apiKey) {
      console.warn('⚠️  Advanced Quest Service initialization failed: OpenAI API key not available');
      return false;
    }

    // OpenAI統合（設計書のBasicLLMパターンを使用）
    this.llm = new BasicLLM(async ({ system, prompt, temperature }) => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            system ? { role: 'system', content: system } : null,
            { role: 'user', content: prompt }
          ].filter(Boolean),
          temperature: temperature ?? config.temperature,
          max_tokens: config.maxTokens,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return data.choices[0].message.content ?? '';
    });

    console.log('✅ Advanced Quest Service initialized with API key configuration');
    return true;
  }

  /**
   * 手動でAPIキーを指定してサービスを初期化（開発用）
   */
  initializeWithKey(apiKey: string): void {
    const config = apiKeyManager.getOpenAIConfig();
    
    // OpenAI統合（設計書のBasicLLMパターンを使用）
    this.llm = new BasicLLM(async ({ system, prompt, temperature }) => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            system ? { role: 'system', content: system } : null,
            { role: 'user', content: prompt }
          ].filter(Boolean),
          temperature: temperature ?? config.temperature,
          max_tokens: config.maxTokens,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return data.choices[0].message.content ?? '';
    });

    console.log('✅ Advanced Quest Service initialized with manual API key');
  }

  /**
   * サービスの初期化状態をチェック
   */
  isInitialized(): boolean {
    return this.llm !== null;
  }

  /**
   * API設定の診断情報を取得
   */
  getDiagnosticInfo(): {
    isInitialized: boolean;
    apiKeyAvailable: boolean;
    aiEnabled: boolean;
    configuration: any;
  } {
    const apiKeyAvailable = !!apiKeyManager.getOpenAIKey();
    const diagnosis = apiKeyManager.diagnoseConfiguration();
    
    return {
      isInitialized: this.isInitialized(),
      apiKeyAvailable,
      aiEnabled: apiKeyManager.isAIEnabled(),
      configuration: diagnosis
    };
  }

  /**
   * 設計書の高品質プロンプトを使ったスキルマップ生成
   */
  async generateSkillMap(args: {
    goalText: string;
    currentLevelTags?: string[];
    priorityAreas?: string[];
  }): Promise<SkillAtom[]> {
    if (!this.llm) {
      const diagnosis = this.getDiagnosticInfo();
      throw new Error(`AdvancedQuestService not initialized. API Key available: ${diagnosis.apiKeyAvailable}. Call initialize() first.`);
    }

    const prompt = buildSkillMapPrompt(args);
    const schema = z.object({ skill_atoms: z.array(SkillAtomSchema).min(10) });
    
    try {
      const { skill_atoms } = await this.llm.completeJson({ 
        system: "You are a precise curriculum designer.", 
        prompt, 
        schema 
      });
      return skill_atoms;
    } catch (error) {
      console.error('Skill map generation failed:', error);
      throw new Error('スキルマップの生成に失敗しました');
    }
  }

  /**
   * 設計書の制約を考慮した高度なクエスト生成
   */
  async generateDailyQuests(args: {
    profile: ProfileV1;
    skillAtoms: SkillAtom[];
    checkins?: DailyCheckins;
  }): Promise<Quest[]> {
    if (!this.llm) {
      const diagnosis = this.getDiagnosticInfo();
      throw new Error(`AdvancedQuestService not initialized. API Key available: ${diagnosis.apiKeyAvailable}. Call initialize() first.`);
    }

    const checkins = args.checkins ?? {
      mood_energy: "mid",
      available_time_today_delta_min: 0,
      focus_noise: "mid"
    };

    const derived = buildDerived(args.profile);
    const prompt = buildDailyQuestsPrompt({
      profile: args.profile,
      derived,
      skillAtoms: args.skillAtoms,
      checkins
    });

    try {
      const { quests } = await this.llm.completeJson({ 
        system: "You are a precise learning planner.", 
        prompt, 
        schema: QuestListSchema 
      });

      // 設計書の後処理を適用
      const rounded = quests.map((q) => ({
        ...q,
        minutes: clampToSession(q.minutes, args.profile.preferred_session_length_min ?? 20),
      }));

      return rounded;
    } catch (error) {
      console.error('Daily quest generation failed:', error);
      throw new Error('本日のクエスト生成に失敗しました');
    }
  }

  /**
   * 設計書のポリシーチェックによる品質保証
   */
  async policyCheck(args: { 
    quests: Quest[]; 
    profile: ProfileV1;
    checkins?: DailyCheckins;
  }): Promise<QuestList> {
    if (!this.llm) {
      const diagnosis = this.getDiagnosticInfo();
      throw new Error(`AdvancedQuestService not initialized. API Key available: ${diagnosis.apiKeyAvailable}. Call initialize() first.`);
    }

    const checkins = args.checkins ?? {
      mood_energy: "mid",
      available_time_today_delta_min: 0,
      focus_noise: "mid"
    };

    const derived = buildDerived(args.profile);
    const constraints = buildConstraints(args.profile, derived, checkins);
    const prompt = buildPolicyCheckPrompt({ 
      questsCandidate: args.quests, 
      constraints 
    });

    try {
      const result = await this.llm.completeJson({ 
        system: "You are a careful policy checker.", 
        prompt, 
        schema: QuestListSchema 
      });

      // 設計書の制約チェックを適用
      const total = result.quests.reduce((s, q) => s + q.minutes, 0);
      if (total > constraints.total_minutes_max) {
        // naive scale-down pass
        const scale = constraints.total_minutes_max / total;
        result.quests = result.quests.map((q) => ({ 
          ...q, 
          minutes: Math.max(10, Math.round(q.minutes * scale)) 
        }));
      }

      result.quests = avoidConsecutiveSamePattern(result.quests);
      return result;
    } catch (error) {
      console.error('Policy check failed:', error);
      throw new Error('クエストの品質チェックに失敗しました');
    }
  }

  /**
   * エンドツーエンドのクエスト生成パイプライン（設計書通り）
   */
  async generateOptimizedQuests(args: {
    goalText: string;
    profile: ProfileV1;
    currentLevelTags?: string[];
    priorityAreas?: string[];
    checkins?: DailyCheckins;
  }): Promise<{
    skillAtoms: SkillAtom[];
    questsCandidate: Quest[];
    finalQuests: QuestList;
  }> {
    console.log('🎯 Step 1: Generating skill map...');
    const skillAtoms = await this.generateSkillMap({
      goalText: args.goalText,
      currentLevelTags: args.currentLevelTags,
      priorityAreas: args.priorityAreas,
    });

    console.log('⚡ Step 2: Generating daily quests...');
    const questsCandidate = await this.generateDailyQuests({
      profile: args.profile,
      skillAtoms,
      checkins: args.checkins,
    });

    console.log('🔍 Step 3: Policy check and optimization...');
    const finalQuests = await this.policyCheck({
      quests: questsCandidate,
      profile: args.profile,
      checkins: args.checkins,
    });

    return {
      skillAtoms,
      questsCandidate,
      finalQuests,
    };
  }

  /**
   * 簡易プロファイル作成（テスト・デモ用）
   */
  createBasicProfile(args: {
    goalText: string;
    timeBudgetMin: number;
    motivation: "low" | "mid" | "high";
    sessionLength?: number;
  }): ProfileV1 {
    return {
      time_budget_min_per_day: args.timeBudgetMin,
      peak_hours: [9, 10, 11, 14, 15, 16],
      env_constraints: [],
      hard_constraints: [],
      motivation_style: "pull",
      difficulty_tolerance: 0.5,
      novelty_preference: 0.5,
      pace_preference: "cadence",
      long_term_goal: args.goalText,
      current_level_tags: [],
      priority_areas: [],
      heat_level: 3,
      risk_factors: [],
      preferred_session_length_min: args.sessionLength ?? 20,
      modality_preference: ["read", "video"],
      deliverable_preferences: ["note"],
      weekly_minimum_commitment_min: Math.floor(args.timeBudgetMin * 7 * 0.8),
      goal_motivation: args.motivation,
    };
  }
}

export const advancedQuestService = new AdvancedQuestService();

// 型エクスポート（設計書からの完全継承）
export type {
  ProfileV1,
  Derived,
  DailyCheckins,
  SkillAtom,
  Quest,
  QuestList,
  Constraints,
  Pattern
} from './promptEngine';