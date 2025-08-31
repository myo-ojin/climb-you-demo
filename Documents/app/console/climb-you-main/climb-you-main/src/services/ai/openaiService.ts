interface OpenAIConfig {
  apiKey: string;
  baseURL: string;
}

interface ProfileQuestion {
  id: string;
  type: 'multiple_choice' | 'text' | 'scale' | 'boolean';
  question: string;
  category: 'goals' | 'preferences' | 'experience' | 'motivation';
  options?: string[];
  required: boolean;
}

interface QuestGeneration {
  title: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: number;
}

interface UserProfile {
  goals: string[];
  responses: Record<string, any>;
  preferences?: Record<string, any>;
  level?: number;
}

class OpenAIService {
  private config: OpenAIConfig | null = null;

  initialize(apiKey: string): void {
    this.config = {
      apiKey,
      baseURL: 'https://api.openai.com/v1',
    };
  }

  private async makeRequest(endpoint: string, data: any): Promise<any> {
    if (!this.config) {
      throw new Error('OpenAI service not initialized. Call initialize() first.');
    }

    try {
      const response = await fetch(`${this.config.baseURL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`);
      }

      return await response.json();
    } catch (error) {
      console.error('OpenAI API request failed:', error);
      throw error;
    }
  }

  async generateProfileQuestions(userGoals: string[], existingQuestions?: ProfileQuestion[]): Promise<ProfileQuestion[]> {
    const existingIds = existingQuestions?.map(q => q.id) || [];
    
    const prompt = `
あなたは専門的なライフコーチです。以下のユーザーの目標に基づいて、個人プロファイルを構築するための質問を5つ生成してください。

ユーザーの目標:
${userGoals.map(goal => `- ${goal}`).join('\n')}

${existingQuestions ? `
既存の質問ID（重複を避ける）:
${existingIds.join(', ')}
` : ''}

以下の条件に従ってください:
- 日本語で生成する
- 各質問は具体的で実用的である
- 目標達成に役立つ個人的な特性を理解できる
- 質問タイプは multiple_choice, text, scale, boolean から選択
- カテゴリは goals, preferences, experience, motivation から選択
- JSONフォーマットで回答する

回答例:
[
  {
    "id": "pq_001",
    "type": "multiple_choice",
    "question": "あなたの学習スタイルはどれですか？",
    "category": "preferences",
    "options": ["視覚的学習", "聴覚的学習", "体験的学習", "読み書き学習"],
    "required": true
  }
]
`;

    const response = await this.makeRequest('/chat/completions', {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'あなたは専門的なライフコーチです。ユーザーの目標達成を支援するための質問を生成してください。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    try {
      const content = response.choices[0].message.content;
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response format');
      }
    } catch (error) {
      console.error('Failed to parse profile questions:', error);
      throw new Error('Failed to generate profile questions');
    }
  }

  async generateQuests(userProfile: UserProfile, count: number = 5): Promise<QuestGeneration[]> {
    const prompt = `
あなたは専門的なライフコーチです。以下のユーザープロファイルに基づいて、個人的な成長クエスト（タスク）を${count}つ生成してください。

ユーザープロファイル:
目標: ${userProfile.goals.join(', ')}
回答データ: ${JSON.stringify(userProfile.responses, null, 2)}
${userProfile.preferences ? `設定: ${JSON.stringify(userProfile.preferences, null, 2)}` : ''}
${userProfile.level ? `現在のレベル: ${userProfile.level}` : ''}

以下の条件に従ってください:
- 日本語で生成する
- 具体的で実行可能なタスク
- 難易度は easy, medium, hard から選択
- 所要時間は分単位で現実的に設定
- カテゴリは学習、健康、キャリア、人間関係、趣味などから選択
- JSONフォーマットで回答する

回答例:
[
  {
    "title": "毎日15分の読書習慣",
    "description": "選択した書籍を毎日15分間読み、学んだことを3行でまとめる",
    "category": "学習",
    "difficulty": "easy",
    "estimatedTime": 15
  }
]
`;

    const response = await this.makeRequest('/chat/completions', {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'あなたは専門的なライフコーチです。ユーザーの個人的な成長を支援するクエストを生成してください。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 3000,
    });

    try {
      const content = response.choices[0].message.content;
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response format');
      }
    } catch (error) {
      console.error('Failed to parse quests:', error);
      throw new Error('Failed to generate quests');
    }
  }

  async analyzeUserProfile(responses: Record<string, any>): Promise<{
    insights: string[];
    recommendations: string[];
    personalityType: string;
    strengths: string[];
    areasForGrowth: string[];
  }> {
    const prompt = `
あなたは専門的な心理学者とライフコーチです。以下のユーザーの回答データを分析してください。

回答データ:
${JSON.stringify(responses, null, 2)}

以下の形式で分析結果をJSONで返してください:
- insights: ユーザーの特性に関する洞察（3-5個）
- recommendations: 成長のための推奨事項（3-5個）
- personalityType: 性格タイプの簡潔な説明
- strengths: 強み（3-4個）
- areasForGrowth: 成長可能な領域（2-3個）

すべて日本語で、建設的で励みになる内容にしてください。

回答例:
{
  "insights": ["あなたは体系的な学習を好む傾向があります", "挑戦を楽しむ性格です"],
  "recommendations": ["小さな目標から始めることをお勧めします"],
  "personalityType": "計画的で学習意欲の高いタイプ",
  "strengths": ["継続力", "好奇心"],
  "areasForGrowth": ["時間管理"]
}
`;

    const response = await this.makeRequest('/chat/completions', {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'あなたは専門的な心理学者とライフコーチです。ユーザーの回答を建設的に分析してください。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 2000,
    });

    try {
      const content = response.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response format');
      }
    } catch (error) {
      console.error('Failed to parse profile analysis:', error);
      throw new Error('Failed to analyze user profile');
    }
  }

  async improveQuestBasedOnFeedback(
    originalQuest: QuestGeneration,
    feedback: 'love' | 'like' | 'dislike',
    userPreferences?: Record<string, any>
  ): Promise<QuestGeneration> {
    const prompt = `
以下のクエストに対するユーザーのフィードバックに基づいて、改良されたクエストを生成してください。

元のクエスト:
${JSON.stringify(originalQuest, null, 2)}

フィードバック: ${feedback}
${userPreferences ? `ユーザー設定: ${JSON.stringify(userPreferences, null, 2)}` : ''}

フィードバックに基づく改良指針:
- love: 類似したスタイルで別の挑戦を作る
- like: 少し難易度や内容を調整して魅力を高める  
- dislike: 異なるアプローチやスタイルに変更する

日本語でJSONフォーマットで改良されたクエストを返してください。

回答例:
{
  "title": "改良されたタイトル",
  "description": "改良された説明",
  "category": "カテゴリ",
  "difficulty": "easy",
  "estimatedTime": 20
}
`;

    const response = await this.makeRequest('/chat/completions', {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'あなたは専門的なライフコーチです。ユーザーのフィードバックに基づいてクエストを改良してください。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    try {
      const content = response.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response format');
      }
    } catch (error) {
      console.error('Failed to parse improved quest:', error);
      throw new Error('Failed to improve quest');
    }
  }
}

export const openaiService = new OpenAIService();
export type { ProfileQuestion, QuestGeneration, UserProfile };