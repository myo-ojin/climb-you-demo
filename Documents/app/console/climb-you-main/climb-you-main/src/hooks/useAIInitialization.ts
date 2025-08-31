/**
 * useAIInitialization Hook - アプリ起動時のAI自動初期化
 * 
 * アプリ起動時に自動でAIサービスを初期化し、
 * 初期化状態を管理するReactフック
 */

import { useState, useEffect } from 'react';
import { aiInitializationService, AIInitializationResult } from '../services/ai/aiInitializationService';

interface UseAIInitializationReturn {
  isInitializing: boolean;
  initializationResult: AIInitializationResult | null;
  error: string | null;
  retry: () => Promise<void>;
}

export const useAIInitialization = (autoInitialize: boolean = true): UseAIInitializationReturn => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [initializationResult, setInitializationResult] = useState<AIInitializationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const initializeServices = async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      console.log('🚀 Starting automatic AI services initialization...');
      
      const result = await aiInitializationService.initializeAllServices();
      setInitializationResult(result);
      
      if (result.success) {
        console.log(`✅ AI initialization completed successfully: ${result.initialized.length} services`);
      } else {
        console.warn(`⚠️  AI initialization completed with issues: ${result.failed.length} failed`);
      }
      
    } catch (initError) {
      const errorMessage = initError.message || 'AI initialization failed';
      setError(errorMessage);
      console.error('❌ AI initialization error:', initError);
    } finally {
      setIsInitializing(false);
    }
  };

  const retry = async () => {
    await initializeServices();
  };

  useEffect(() => {
    if (autoInitialize) {
      initializeServices();
    }
  }, [autoInitialize]);

  return {
    isInitializing,
    initializationResult,
    error,
    retry,
  };
};

export default useAIInitialization;