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
    
    if (!config.apiKey && !config.useMock) {
      console.warn('⚠️  Advanced Quest Service initialization failed: OpenAI API key not available and mock mode disabled');
      return false;
    }

    // モック機能またはOpenAI統合
    this.llm = new BasicLLM(async ({ system, prompt, temperature }) => {
      if (config.useMock) {
        console.log('🎭 Using Mock AI Response');
        return this.generateMockResponse(prompt);
      }

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

    console.log(`✅ Advanced Quest Service initialized with ${config.useMock ? 'Mock' : 'API'} configuration`);
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
   * モックAI応答の生成
   */
  private generateMockResponse(prompt: string): string {
    console.log('🎭 Mock prompt received:', prompt.substring(0, 200));
    console.log('🎭 Prompt includes skill_map?', prompt.includes('skill_map'));
    console.log('🎭 Prompt includes スキルマップ?', prompt.includes('スキルマップ'));
    console.log('🎭 Prompt includes Skill Map?', prompt.includes('Skill Map'));
    
    // クエスト生成プロンプトをまず最初にチェック
    console.log('🎭 Checking quest conditions...');
    console.log('🎭 Includes 本日のクエスト?', prompt.includes('本日のクエスト'));
    console.log('🎭 Includes daily_quests?', prompt.includes('daily_quests'));
    console.log('🎭 Includes クエスト?', prompt.includes('クエスト'));
    console.log('🎭 Includes 学習プランナー?', prompt.includes('学習プランナー'));
    
    if (prompt.includes('本日のクエスト') || 
        prompt.includes('daily_quests') || 
        prompt.includes('クエスト') ||
        prompt.includes('学習プランナー')) {
      console.log('🎭 Detected QUEST generation prompt');
      // 日次クエストのモック応答（QuestSchemaに準拠）
      const mockResponse = JSON.stringify({
        quests: [
          {
            title: "React Nativeコンポーネント基礎学習",
            pattern: "read_note_q",
            minutes: 25,
            difficulty: 0.3,
            deliverable: "コンポーネント作成サンプルとメモ",
            steps: [
              "公式ドキュメントでViewとTextコンポーネントを読む",
              "要点をメモにまとめる",
              "理解度確認の3問を自作して解く"
            ],
            criteria: [
              "ViewとTextコンポーネントの基本的な使い方を説明できる",
              "propsの概念を理解してコードで実装できる"
            ],
            tags: ["React Native", "基礎", "コンポーネント"]
          },
          {
            title: "状態管理の実践演習",
            pattern: "build_micro",
            minutes: 30,
            difficulty: 0.5,
            deliverable: "動作するカウンターアプリ",
            steps: [
              "useStateフックを使ったカウンター機能を実装",
              "ボタンでカウントの増減を制御",
              "動作確認とコード見直し"
            ],
            criteria: [
              "useStateフックを正しく使用できる",
              "状態の更新が画面に反映される",
              "コンポーネントが期待通りに動作する"
            ],
            tags: ["React Native", "状態管理", "フック"]
          },
          {
            title: "スタイリング基礎演習",
            pattern: "flashcards",
            minutes: 20,
            difficulty: 0.4,
            deliverable: "Flexboxレイアウト例とフラッシュカード",
            steps: [
              "Flexboxの主要プロパティをフラッシュカードに整理",
              "簡単なレイアウト例を3パターン作成"
            ],
            criteria: [
              "flexDirection、justifyContent、alignItemsを使い分けられる",
              "StyleSheetの基本的な書き方を理解している"
            ],
            tags: ["React Native", "スタイリング", "Flexbox"]
          }
        ],
        rationale: ["基礎から応用へ段階的に学習", "理論と実践のバランスを重視", "短時間で達成感を得られる構成"]
      });
      console.log('🎭 Quest response generated, length:', mockResponse.length);
      return mockResponse;
      
    } else if (prompt.includes('審査し') || 
               prompt.includes('制約違反') ||
               prompt.includes('QUESTS_CANDIDATE') ||
               prompt.includes('修正案') ||
               prompt.includes('policy') ||
               prompt.includes('ポリシー')) {
      console.log('🎭 Detected POLICY CHECK prompt');
      // ポリシーチェックのモック応答（入力クエストをそのまま返す）
      const mockResponse = JSON.stringify({
        quests: [
          {
            title: "React Nativeコンポーネント基礎学習",
            pattern: "read_note_q",
            minutes: 25,
            difficulty: 0.3,
            deliverable: "コンポーネント作成サンプルとメモ",
            steps: [
              "公式ドキュメントでViewとTextコンポーネントを読む",
              "要点をメモにまとめる",
              "理解度確認の3問を自作して解く"
            ],
            criteria: [
              "ViewとTextコンポーネントの基本的な使い方を説明できる",
              "propsの概念を理解してコードで実装できる"
            ],
            tags: ["React Native", "基礎", "コンポーネント"]
          },
          {
            title: "状態管理の実践演習",
            pattern: "build_micro",
            minutes: 30,
            difficulty: 0.5,
            deliverable: "動作するカウンターアプリ",
            steps: [
              "useStateフックを使ったカウンター機能を実装",
              "ボタンでカウントの増減を制御",
              "動作確認とコード見直し"
            ],
            criteria: [
              "useStateフックを正しく使用できる",
              "状態の更新が画面に反映される",
              "コンポーネントが期待通りに動作する"
            ],
            tags: ["React Native", "状態管理", "フック"]
          },
          {
            title: "スタイリング基礎演習（最適化後）",
            pattern: "flashcards",
            minutes: 20,
            difficulty: 0.4,
            deliverable: "Flexboxレイアウト例とフラッシュカード",
            steps: [
              "Flexboxの主要プロパティをフラッシュカードに整理",
              "簡単なレイアウト例を3パターン作成"
            ],
            criteria: [
              "flexDirection、justifyContent、alignItemsを使い分けられる",
              "StyleSheetの基本的な書き方を理解している"
            ],
            tags: ["React Native", "スタイリング", "Flexbox"]
          }
        ],
        rationale: ["制約チェック完了", "パターン重複なし", "時間配分最適化済み"]
      });
      console.log('🎭 Policy check response generated, length:', mockResponse.length);
      return mockResponse;
      
    } else if (prompt.includes('skill_map') || 
               prompt.includes('スキルマップ') || 
               prompt.includes('Skill Map') ||
               prompt.includes('カリキュラム設計者')) {
      console.log('🎭 Detected SKILL MAP generation prompt');
      // スキルマップのモック応答（SkillAtomSchemaに準拠）
      const mockResponse = JSON.stringify({
        skill_atoms: [
          {
            id: "react-native-basics",
            label: "React Native基礎",
            type: "concept",
            level: "intro",
            bloom: "understand",
            prereq: [],
            representative_tasks: [
              "JSXの基本文法を理解する",
              "コンポーネントとPropsの概念を説明する",
              "基本的なViewとTextを使ったUIを作成する"
            ],
            suggested_patterns: ["read_note_q", "flashcards"]
          },
          {
            id: "component-design",
            label: "コンポーネント設計",
            type: "procedure",
            level: "basic",
            bloom: "apply",
            prereq: ["react-native-basics"],
            representative_tasks: [
              "再利用可能なボタンコンポーネントを作成する",
              "Props設計でコンポーネントをカスタマイズする",
              "StyleSheetを使った適切なスタイリングを行う"
            ],
            suggested_patterns: ["build_micro", "config_verify"]
          },
          {
            id: "state-management",
            label: "状態管理",
            type: "concept",
            level: "intermediate",
            bloom: "analyze",
            prereq: ["react-native-basics"],
            representative_tasks: [
              "useStateフックで状態を管理する",
              "Context APIを使ったグローバル状態管理を実装する",
              "状態更新のパフォーマンスを最適化する"
            ],
            suggested_patterns: ["build_micro", "debug_explain"]
          },
          {
            id: "navigation-system",
            label: "ナビゲーションシステム",
            type: "procedure",
            level: "basic",
            bloom: "apply",
            prereq: ["component-design"],
            representative_tasks: [
              "Stack Navigatorで画面遷移を実装する",
              "Tab Navigatorでタブベースのナビゲーションを作成する",
              "パラメータを使った画面間のデータ受け渡しを行う"
            ],
            suggested_patterns: ["config_verify", "build_micro"]
          },
          {
            id: "api-integration",
            label: "API統合",
            type: "procedure",
            level: "intermediate",
            bloom: "create",
            prereq: ["state-management"],
            representative_tasks: [
              "fetchを使ったREST API呼び出しを実装する",
              "非同期データフェッチのローディング状態を管理する",
              "APIエラーハンドリングとユーザーフィードバックを実装する"
            ],
            suggested_patterns: ["debug_explain", "feynman"]
          },
          {
            id: "testing-basics",
            label: "テスト基礎",
            type: "procedure",
            level: "intermediate",
            bloom: "apply",
            prereq: ["component-design"],
            representative_tasks: [
              "Jest/React Native Testing Libraryの基本を学ぶ",
              "単体テストとスナップショットテストを作成する",
              "コンポーネントテストを実装する"
            ],
            suggested_patterns: ["read_note_q", "config_verify"]
          },
          {
            id: "performance-optimization",
            label: "パフォーマンス最適化",
            type: "concept",
            level: "advanced",
            bloom: "evaluate",
            prereq: ["state-management", "api-integration"],
            representative_tasks: [
              "React.memoとuseMemoでレンダリング最適化を行う",
              "FlatListの最適化テクニックを実装する",
              "メモリリーク対策と監視を行う"
            ],
            suggested_patterns: ["debug_explain", "past_paper"]
          },
          {
            id: "deployment",
            label: "デプロイメント",
            type: "procedure",
            level: "advanced",
            bloom: "create",
            prereq: ["testing-basics"],
            representative_tasks: [
              "Expo EASでビルドとデプロイを行う",
              "App StoreとGoogle Play Storeにアプリを公開する",
              "CI/CDパイプラインを構築する"
            ],
            suggested_patterns: ["config_verify", "build_micro"]
          },
          {
            id: "advanced-patterns",
            label: "上級パターン",
            type: "concept",
            level: "advanced",
            bloom: "create",
            prereq: ["performance-optimization"],
            representative_tasks: [
              "カスタムフックとHOCパターンを実装する",
              "Context APIとReducerの組み合わせを活用する",
              "ファイル構造とアーキテクチャパターンを設計する"
            ],
            suggested_patterns: ["feynman", "socratic"]
          },
          {
            id: "native-integration",
            label: "ネイティブ統合",
            type: "procedure",
            level: "advanced",
            bloom: "create",
            prereq: ["deployment"],
            representative_tasks: [
              "ネイティブモジュールとカスタムコンポーネントを作成する",
              "プラットフォーム固有の機能を実装する",
              "サードパーティライブラリの統合を行う"
            ],
            suggested_patterns: ["build_micro", "retrospective"]
          }
        ]
      });
      console.log('🎭 Mock skill_atoms response length:', mockResponse.length);
      console.log('🎭 Mock skill_atoms response start:', mockResponse.substring(0, 100));
      console.log('🎭 Mock skill_atoms response end:', mockResponse.substring(mockResponse.length - 100));
      
      // JSONパース確認
      try {
        const parsed = JSON.parse(mockResponse);
        console.log('🎭 Parsed skill_atoms count:', parsed.skill_atoms?.length);
      } catch (parseError) {
        console.error('🎭 JSON Parse Error:', parseError);
      }
      
      return mockResponse;
    }
    
    // デフォルトのモック応答
    return JSON.stringify({
      quests: [
        {
          title: "モック学習クエスト",
          pattern: "read_note_q",
          minutes: 20,
          difficulty: 0.5,
          deliverable: "学習ノート",
          criteria: ["基本概念を理解できる"],
          tags: ["テスト", "モック"]
        }
      ]
    });
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