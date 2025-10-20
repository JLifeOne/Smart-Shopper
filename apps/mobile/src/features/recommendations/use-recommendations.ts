import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseEnv, featureFlags } from '@/src/lib/env';

export type RecommendationRequest = {
  query: string;
  locale?: string;
  contextItems?: Array<{ label: string; quantity?: number; unit?: string }>;
};

export type Recommendation = {
  label: string;
  type: 'product' | 'brand' | 'category';
  confidence: number;
  metadata?: Record<string, unknown>;
};

type RecommendationResponse = {
  suggestions: Recommendation[];
  latencyMs: number;
  modelVersion?: string;
};

type RecommendationsState = {
  data: Recommendation[];
  loading: boolean;
  error?: string;
};

const INITIAL_STATE: RecommendationsState = {
  data: [],
  loading: false
};

export function useRecommendations(request: RecommendationRequest | null, opts?: { enabled?: boolean }) {
  const [state, setState] = useState<RecommendationsState>(INITIAL_STATE);
  const enabled = (opts?.enabled ?? true) && featureFlags.aiSuggestions;
  const serviceUrl = supabaseEnv.recoServiceUrl;

  const payload = useMemo(() => {
    if (!request) {
      return null;
    }
    return {
      query: request.query.trim(),
      locale: request.locale,
      context_items: request.contextItems
    };
  }, [request]);

  useEffect(() => {
    let isMounted = true;

    if (!enabled || !payload || !serviceUrl) {
      setState((prev) => ({
        ...prev,
        data: [],
        loading: false,
        error: !serviceUrl && enabled ? 'Recommendation service unavailable.' : undefined
      }));
      return;
    }

    async function fetchRecommendations() {
      setState((prev) => ({ ...prev, loading: true, error: undefined }));
      try {
        const response = await fetch(`${serviceUrl.replace(/\/$/, '')}/suggest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Service responded with ${response.status}`);
        }

        const json = (await response.json()) as RecommendationResponse;
        if (!isMounted) {
          return;
        }
        setState({
          data: json.suggestions ?? [],
          loading: false,
          error: undefined
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setState({
          data: [],
          loading: false,
          error: error instanceof Error ? error.message : 'Unable to fetch recommendations.'
        });
      }
    }

    void fetchRecommendations();

    return () => {
      isMounted = false;
    };
  }, [enabled, payload, serviceUrl]);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    reset
  };
}
