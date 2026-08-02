import { Injectable, Logger } from '@nestjs/common';

export interface FxRates {
  khrPerUsd: number;
  fetchedAt: string; // ISO
  source: string;
}

/**
 * Supplies the USD→KHR exchange rate for the app's currency display.
 *
 * Fetches a free, no-key public provider and caches the result in memory for
 * [_ttlMs]; on any failure it serves the last good value, and if it has never
 * succeeded it falls back to [_fallbackRate]. The mobile client caches its own
 * last-good copy too, so display never breaks offline.
 */
@Injectable()
export class FxService {
  private readonly logger = new Logger(FxService.name);

  /** Cambodia's riel is a de-facto USD peg (~4100), a safe offline default. */
  private static readonly _fallbackRate = 4100;
  private static readonly _ttlMs = 6 * 60 * 60 * 1000; // 6 hours
  private static readonly _endpoint = 'https://open.er-api.com/v6/latest/USD';

  private cache: FxRates | null = null;

  async getRates(): Promise<FxRates> {
    if (this.cache && !this.isStale(this.cache)) return this.cache;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(FxService._endpoint, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const body = (await res.json()) as {
        result?: string;
        rates?: Record<string, number>;
      };
      const khr = body?.rates?.KHR;
      if (body?.result === 'success' && typeof khr === 'number' && khr > 0) {
        this.cache = {
          khrPerUsd: khr,
          fetchedAt: new Date().toISOString(),
          source: 'open.er-api.com',
        };
        return this.cache;
      }
      this.logger.warn('FX provider returned no KHR rate; using fallback');
    } catch (err) {
      this.logger.warn(`FX fetch failed (${(err as Error).message})`);
    }

    // Serve stale cache if we have one, else the pegged fallback.
    return (
      this.cache ?? {
        khrPerUsd: FxService._fallbackRate,
        fetchedAt: new Date(0).toISOString(),
        source: 'fallback',
      }
    );
  }

  private isStale(rate: FxRates): boolean {
    const age = Date.now() - new Date(rate.fetchedAt).getTime();
    return age > FxService._ttlMs;
  }
}
