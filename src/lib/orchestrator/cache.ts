/**
 * Intelligent caching system for tool results
 * Provides TTL-based caching with LRU eviction and cache warming
 */

import { CacheEntry } from './types';
import { logger } from './logger';

export interface CacheConfig {
  readonly maxSize: number;
  readonly defaultTtlMs: number;
  readonly enableMetrics: boolean;
}

export interface CacheMetrics {
  readonly hits: number;
  readonly misses: number;
  readonly size: number;
  readonly hitRate: number;
  readonly evictions: number;
}

export class IntelligentCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;
  private metrics = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  constructor(private config: CacheConfig) {}

  public async get(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.metrics.misses++;
      logger.debug('Cache miss', { key, cacheSize: this.cache.size });
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    const age = now - entry.timestamp.getTime();
    
    if (age > entry.ttlMs) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.metrics.misses++;
      logger.debug('Cache entry expired', { key, ageMs: age, ttlMs: entry.ttlMs });
      return null;
    }

    // Update access order for LRU
    this.accessOrder.set(key, ++this.accessCounter);
    
    // Update hit count
    const updatedEntry: CacheEntry<T> = {
      ...entry,
      hits: entry.hits + 1,
    };
    this.cache.set(key, updatedEntry);
    
    this.metrics.hits++;
    logger.debug('Cache hit', { 
      key, 
      hits: updatedEntry.hits, 
      ageMs: age,
      cacheSize: this.cache.size 
    });
    
    return entry.data;
  }

  public async set(key: string, data: T, ttlMs?: number): Promise<void> {
    const effectiveTtl = ttlMs ?? this.config.defaultTtlMs;
    
    // Evict if cache is full
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: new Date(),
      ttlMs: effectiveTtl,
      hits: 0,
    };

    this.cache.set(key, entry);
    this.accessOrder.set(key, ++this.accessCounter);

    logger.debug('Cache entry set', { 
      key, 
      ttlMs: effectiveTtl,
      cacheSize: this.cache.size 
    });
  }

  public async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    this.accessOrder.delete(key);
    
    if (deleted) {
      logger.debug('Cache entry deleted', { key, cacheSize: this.cache.size });
    }
    
    return deleted;
  }

  public async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
    
    logger.info('Cache cleared', { previousSize: size });
  }

  public getMetrics(): CacheMetrics {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      hits: this.metrics.hits,
      misses: this.metrics.misses,
      size: this.cache.size,
      hitRate: total > 0 ? this.metrics.hits / total : 0,
      evictions: this.metrics.evictions,
    };
  }

  public generateCacheKey(toolName: string, input: Record<string, any>): string {
    // Create deterministic cache key from tool name and input
    const inputStr = JSON.stringify(input, Object.keys(input).sort());
    return `${toolName}:${this.hashString(inputStr)}`;
  }

  private evictLeastRecentlyUsed(): void {
    let lruKey: string | null = null;
    let lruAccess = Infinity;

    for (const [key, accessTime] of this.accessOrder) {
      if (accessTime < lruAccess) {
        lruAccess = accessTime;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.accessOrder.delete(lruKey);
      this.metrics.evictions++;
      
      logger.debug('LRU eviction', { 
        evictedKey: lruKey,
        accessTime: lruAccess,
        cacheSize: this.cache.size 
      });
    }
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Cache warming for predictive loading
  public async warmCache(entries: Array<{ key: string; data: T; ttlMs?: number }>): Promise<void> {
    logger.info('Starting cache warming', { entryCount: entries.length });
    
    for (const entry of entries) {
      await this.set(entry.key, entry.data, entry.ttlMs);
    }
    
    logger.info('Cache warming completed', { 
      entryCount: entries.length,
      cacheSize: this.cache.size 
    });
  }

  // Cleanup expired entries
  public async cleanup(): Promise<number> {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      const age = now - entry.timestamp.getTime();
      if (age > entry.ttlMs) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cache cleanup completed', { 
        entriesRemoved: cleaned,
        cacheSize: this.cache.size 
      });
    }

    return cleaned;
  }
}
