/**
 * Wikipedia MCP Browser Server
 * Real Wikipedia access via public API following the MCP protocol
 */

import { BaseMCPServer, MCPServerConfig } from './BaseMCPServer';
import { z } from 'zod';
import axios from 'axios';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Wikipedia article structure from API
 */
interface WikipediaPage {
  pageid: number;
  title: string;
  extract?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  pageimage?: string;
  fullurl: string;
  editurl: string;
  canonicalurl: string;
}

/**
 * Search result from Wikipedia API
 */
interface WikipediaSearchResult {
  ns: number;
  title: string;
  pageid: number;
  size: number;
  wordcount: number;
  snippet: string;
  timestamp: string;
}

/**
 * Cache entry structure for disk storage
 */
interface CacheEntry {
  data: any;
  timestamp: number;
  etag?: string;
  expires?: number;
}

/**
 * Cache configuration
 */
interface CacheConfig {
  enabled: boolean;
  directory: string;
  maxAge: number; // in milliseconds
  maxSize: number; // maximum cache size in MB
}

/**
 * Browsing session state for doom-scrolling prevention
 */
interface BrowsingSession {
  sessionId: string;
  startTime: number;
  articlesVisited: string[];
  currentArticle?: WikipediaPage;
  searchHistory: string[];
  totalReadingTime: number;
  averageArticleTime: number;
  dominantCategories: string[];
}

/**
 * Real Wikipedia MCP Browser Server
 * Provides genuine Wikipedia access with doom-scrolling awareness
 */
export class WikiMCPBrowser extends BaseMCPServer {
  private session: BrowsingSession;
  private readonly WIKIPEDIA_API_BASE = 'https://en.wikipedia.org/api/rest_v1';
  private readonly WIKIPEDIA_API_OLD = 'https://en.wikipedia.org/w/api.php';
  private cache: CacheConfig;

  constructor() {
    const config: MCPServerConfig = {
      name: 'wiki-mcp-browser',
      version: '1.0.0',
      description: 'Real Wikipedia browsing server with doom-scrolling prevention',
      port: 3002,
      capabilities: {
        tools: true,
        resources: true,
        prompts: true,
      },
    };

    super(config);

    // Initialize cache configuration
    this.cache = {
      enabled: true,
      directory: path.join(process.cwd(), '.cache', 'wikipedia'),
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      maxSize: 100 // 100MB
    };

    // Initialize browsing session
    this.session = {
      sessionId: `wiki-session-${Date.now()}`,
      startTime: Date.now(),
      articlesVisited: [],
      searchHistory: [],
      totalReadingTime: 0,
      averageArticleTime: 0,
      dominantCategories: []
    };
  }

  /**
   * Setup Wikipedia-specific tools, resources, and prompts
   */
  protected setupServerSpecifics(): void {
    this.setupTools();
    this.setupResources();
    this.setupPrompts();
    this.initializeCache();
  }

  /**
   * Initialize cache directory
   */
  private async initializeCache(): Promise<void> {
    if (!this.cache.enabled) return;
    
    try {
      await fs.mkdir(this.cache.directory, { recursive: true });
      logger.info(`WikiMCP: Cache directory initialized at ${this.cache.directory}`);
    } catch (error) {
      logger.error('WikiMCP: Failed to initialize cache directory', { error });
      this.cache.enabled = false;
    }
  }

  /**
   * Generate cache key for a given URL and parameters
   */
  private generateCacheKey(url: string, params?: any): string {
    const data = `${url}${params ? JSON.stringify(params) : ''}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get cached data if available and not expired
   */
  private async getCachedData(cacheKey: string): Promise<any | null> {
    if (!this.cache.enabled) return null;

    try {
      const cacheFile = path.join(this.cache.directory, `${cacheKey}.json`);
      const cacheData = await fs.readFile(cacheFile, 'utf-8');
      const entry: CacheEntry = JSON.parse(cacheData);

      // Check if cache is expired
      const now = Date.now();
      if (entry.expires && now > entry.expires) {
        await this.deleteCacheEntry(cacheKey);
        return null;
      }

      // Check if cache is too old
      if (now - entry.timestamp > this.cache.maxAge) {
        await this.deleteCacheEntry(cacheKey);
        return null;
      }

      logger.info(`WikiMCP: Cache hit for key ${cacheKey}`);
      return entry.data;
    } catch (error) {
      // Cache miss or error reading cache
      return null;
    }
  }

  /**
   * Store data in cache
   */
  private async setCachedData(cacheKey: string, data: any, etag?: string): Promise<void> {
    if (!this.cache.enabled) return;

    try {
      const cacheFile = path.join(this.cache.directory, `${cacheKey}.json`);
      const entry: CacheEntry = {
        data,
        timestamp: Date.now(),
        etag,
        expires: etag ? undefined : Date.now() + this.cache.maxAge
      };

      await fs.writeFile(cacheFile, JSON.stringify(entry, null, 2));
      logger.info(`WikiMCP: Data cached with key ${cacheKey}`);

      // Check cache size and cleanup if needed
      await this.cleanupCache();
    } catch (error) {
      logger.error(`WikiMCP: Failed to cache data for key ${cacheKey}`, { error });
    }
  }

  /**
   * Delete a specific cache entry
   */
  private async deleteCacheEntry(cacheKey: string): Promise<void> {
    try {
      const cacheFile = path.join(this.cache.directory, `${cacheKey}.json`);
      await fs.unlink(cacheFile);
    } catch (error) {
      // File might not exist, ignore error
    }
  }

  /**
   * Clean up cache if it exceeds size limit
   */
  private async cleanupCache(): Promise<void> {
    try {
      const files = await fs.readdir(this.cache.directory);
      const cacheFiles = files.filter(f => f.endsWith('.json'));
      
      if (cacheFiles.length === 0) return;

      // Get file stats and sort by modification time
      const fileStats = await Promise.all(
        cacheFiles.map(async file => {
          const filePath = path.join(this.cache.directory, file);
          const stats = await fs.stat(filePath);
          return { file, stats, path: filePath };
        })
      );

      // Calculate total cache size
      const totalSize = fileStats.reduce((sum, { stats }) => sum + stats.size, 0);
      const maxSizeBytes = this.cache.maxSize * 1024 * 1024; // Convert MB to bytes

      if (totalSize > maxSizeBytes) {
        // Sort by oldest first
        fileStats.sort((a, b) => a.stats.mtime.getTime() - b.stats.mtime.getTime());
        
        let currentSize = totalSize;
        for (const { file, path: filePath, stats } of fileStats) {
          if (currentSize <= maxSizeBytes * 0.8) break; // Keep 80% of max size
          
          await fs.unlink(filePath);
          currentSize -= stats.size;
          logger.info(`WikiMCP: Removed old cache file ${file}`);
        }
      }
    } catch (error) {
      logger.error('WikiMCP: Failed to cleanup cache', { error });
    }
  }

  /**
   * Clear all cache entries
   */
  private async clearCache(): Promise<void> {
    if (!this.cache.enabled) return;

    try {
      const files = await fs.readdir(this.cache.directory);
      const cacheFiles = files.filter(f => f.endsWith('.json'));
      
      await Promise.all(
        cacheFiles.map(file => 
          fs.unlink(path.join(this.cache.directory, file))
        )
      );
      
      logger.info(`WikiMCP: Cleared ${cacheFiles.length} cache files`);
    } catch (error) {
      logger.error('WikiMCP: Failed to clear cache', { error });
      throw error;
    }
  }

  /**
   * Make HTTP request with caching support
   */
  private async cachedRequest(url: string, config: any = {}): Promise<any> {
    const cacheKey = this.generateCacheKey(url, config.params);
    
    // Try to get from cache first
    const cachedData = await this.getCachedData(cacheKey);
    if (cachedData) {
      return { data: cachedData, fromCache: true };
    }

    // Make actual HTTP request
    try {
      logger.info(`WikiMCP: Cache miss, fetching from ${url}`);
      
      const response = await axios.get(url, {
        ...config,
        headers: {
          ...config.headers,
          'User-Agent': 'WikiMCPBrowser/1.0 (https://github.com/escrivivir-co/state-machine-mcp-driver)'
        }
      });

      // Cache the response
      await this.setCachedData(cacheKey, response.data, response.headers.etag);
      
      logger.info(`WikiMCP: Response cached for future use`);
      
      return { data: response.data, fromCache: false };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Setup Wikipedia browsing tools
   */
  private setupTools(): void {
    // Load Wikipedia article by title
    this.server.tool(
      'load_wikipedia_article',
      'Load a Wikipedia article by title with full content and metadata',
      {
        title: z.string().describe('Article title to load from Wikipedia'),
        includeImages: z.boolean().optional().describe('Include thumbnail images in response'),
        language: z.string().optional().describe('Wikipedia language code (default: en)')
      },
      async ({ title, includeImages = false, language = 'en' }) => {
        try {
          logger.info(`WikiMCP: Loading article "${title}" from ${language}.wikipedia.org`);

          // Get page content using Wikipedia REST API
          const response = await this.cachedRequest(
            `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
          );

          const page = response.data;
          
          if (page.type === 'disambiguation') {
            // Handle disambiguation pages
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    type: 'disambiguation',
                    title: page.title,
                    extract: page.extract,
                    message: 'This is a disambiguation page. Please be more specific with the article title.',
                    suggestions: page.extract.match(/\[\[([^\]]+)\]\]/g)?.slice(0, 5) || []
                  }, null, 2)
                }
              ]
            };
          }

          // Get full page content for reading
          let fullContent = '';
          try {
            const contentResponse = await this.cachedRequest(
              `https://${language}.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`
            );
            
            // Extract text from HTML (basic extraction)
            fullContent = contentResponse.data
              .replace(/<[^>]*>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .substring(0, 5000); // Limit content to avoid overwhelming
          } catch (error) {
            logger.warn(`WikiMCP: Could not fetch full content for ${title}, using summary`);
            fullContent = page.extract || 'Content unavailable';
          }

          const article: WikipediaPage = {
            pageid: page.pageid,
            title: page.title,
            extract: page.extract,
            thumbnail: page.thumbnail,
            pageimage: page.pageimage,
            fullurl: page.content_urls?.desktop?.page || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
            editurl: page.content_urls?.desktop?.edit || '',
            canonicalurl: page.content_urls?.desktop?.page || ''
          };

          // Update session
          this.session.currentArticle = article;
          this.session.articlesVisited.push(title);
          this.session.totalReadingTime += 2; // Estimate 2 minutes per article

          logger.info(`WikiMCP: Successfully loaded article "${title}" (${fullContent.length} chars)`);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  article: {
                    ...article,
                    fullContent: fullContent,
                    wordCount: fullContent.split(' ').length,
                    readingTimeMinutes: Math.ceil(fullContent.split(' ').length / 200),
                    images: includeImages ? [article.thumbnail].filter(Boolean) : undefined
                  },
                  sessionStats: {
                    articlesVisited: this.session.articlesVisited.length,
                    totalReadingTime: this.session.totalReadingTime,
                    sessionDuration: Math.floor((Date.now() - this.session.startTime) / 60000)
                  }
                }, null, 2)
              }
            ]
          };

        } catch (error) {
          logger.error(`WikiMCP: Failed to load article "${title}"`, { error });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Article not found or Wikipedia API error',
                  title: title,
                  suggestion: 'Try checking the spelling or use the search_wikipedia tool to find similar articles',
                  errorDetails: error instanceof Error ? error.message : 'Unknown error'
                }, null, 2)
              }
            ]
          };
        }
      }
    );

    // Search Wikipedia articles
    this.server.tool(
      'search_wikipedia',
      'Search Wikipedia for articles matching a query',
      {
        query: z.string().describe('Search query for Wikipedia articles'),
        limit: z.number().optional().describe('Maximum number of results (default: 10, max: 50)'),
        language: z.string().optional().describe('Wikipedia language code (default: en)')
      },
      async ({ query, limit = 10, language = 'en' }) => {
        try {
          logger.info(`WikiMCP: Searching Wikipedia for "${query}" (limit: ${limit})`);

          // Use Wikipedia OpenSearch API for search
          const searchResponse = await this.cachedRequest(
            `https://${language}.wikipedia.org/w/api.php`,
            {
              params: {
                action: 'query',
                format: 'json',
                list: 'search',
                srsearch: query,
                srlimit: Math.min(limit, 50),
                srinfo: 'totalhits',
                srprop: 'size|wordcount|timestamp|snippet'
              }
            }
          );

          const results = searchResponse.data.query?.search || [];
          const totalHits = searchResponse.data.query?.searchinfo?.totalhits || 0;

          // Update session
          this.session.searchHistory.push(query);

          logger.info(`WikiMCP: Found ${results.length} results for "${query}" (${totalHits} total)`);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  query: query,
                  totalHits: totalHits,
                  resultsCount: results.length,
                  results: results.map((result: WikipediaSearchResult) => ({
                    title: result.title,
                    pageid: result.pageid,
                    snippet: result.snippet.replace(/<[^>]*>/g, ''), // Remove HTML tags
                    wordcount: result.wordcount,
                    size: result.size,
                    url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(result.title)}`,
                    lastModified: result.timestamp
                  })),
                  searchTips: results.length === 0 ? [
                    'Try different keywords',
                    'Check spelling',
                    'Use broader terms',
                    'Try synonyms'
                  ] : undefined
                }, null, 2)
              }
            ]
          };

        } catch (error) {
          logger.error(`WikiMCP: Search failed for "${query}"`, { error });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Wikipedia search failed',
                  query: query,
                  errorDetails: error instanceof Error ? error.message : 'Unknown error'
                }, null, 2)
              }
            ]
          };
        }
      }
    );

    // Get random Wikipedia article
    this.server.tool(
      'get_random_article',
      'Get a random Wikipedia article for discovery',
      {
        language: z.string().optional().describe('Wikipedia language code (default: en)'),
        namespace: z.number().optional().describe('Wikipedia namespace (0 = articles, default: 0)')
      },
      async ({ language = 'en', namespace = 0 }) => {
        try {
          logger.info(`WikiMCP: Getting random article from ${language}.wikipedia.org`);

          // Get random article title
          const randomResponse = await axios.get(
            `https://${language}.wikipedia.org/w/api.php`,
            {
              params: {
                action: 'query',
                format: 'json',
                list: 'random',
                rnnamespace: namespace,
                rnlimit: 1
              },
              headers: {
                'User-Agent': 'WikiMCPBrowser/1.0 (https://github.com/escrivivir-co/state-machine-mcp-driver)'
              }
            }
          );

          const randomPage = randomResponse.data.query?.random?.[0];
          if (!randomPage) {
            throw new Error('No random article found');
          }

          // Load the random article content directly
          const articleResponse = await axios.get(
            `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(randomPage.title)}`,
            {
              headers: {
                'User-Agent': 'WikiMCPBrowser/1.0 (https://github.com/escrivivir-co/state-machine-mcp-driver)'
              }
            }
          );

          const article = articleResponse.data;
          
          // Update session
          this.session.currentArticle = {
            pageid: article.pageid,
            title: article.title,
            extract: article.extract,
            thumbnail: article.thumbnail,
            pageimage: article.pageimage,
            fullurl: article.content_urls?.desktop?.page || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(randomPage.title)}`,
            editurl: article.content_urls?.desktop?.edit || '',
            canonicalurl: article.content_urls?.desktop?.page || ''
          };
          
          this.session.articlesVisited.push(randomPage.title);
          this.session.totalReadingTime += 2;

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  type: 'random',
                  article: {
                    ...this.session.currentArticle,
                    extract: article.extract,
                    wordCount: article.extract?.split(' ').length || 0,
                    readingTimeMinutes: Math.ceil((article.extract?.split(' ').length || 0) / 200)
                  },
                  sessionStats: {
                    articlesVisited: this.session.articlesVisited.length,
                    totalReadingTime: this.session.totalReadingTime,
                    sessionDuration: Math.floor((Date.now() - this.session.startTime) / 60000)
                  }
                }, null, 2)
              }
            ]
          };

        } catch (error) {
          logger.error(`WikiMCP: Failed to get random article`, { error });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Failed to get random article',
                  errorDetails: error instanceof Error ? error.message : 'Unknown error'
                }, null, 2)
              }
            ]
          };
        }
      }
    );

    // Get article categories (for theme detection)
    this.server.tool(
      'get_article_categories',
      'Get categories for a Wikipedia article to understand its themes',
      {
        title: z.string().describe('Article title to get categories for'),
        language: z.string().optional().describe('Wikipedia language code (default: en)')
      },
      async ({ title, language = 'en' }) => {
        try {
          logger.info(`WikiMCP: Getting categories for "${title}"`);

          const response = await axios.get(
            `https://${language}.wikipedia.org/w/api.php`,
            {
              params: {
                action: 'query',
                format: 'json',
                prop: 'categories',
                titles: title,
                clshow: '!hidden',
                cllimit: 50
              },
              headers: {
                'User-Agent': 'WikiMCPBrowser/1.0 (https://github.com/escrivivir-co/state-machine-mcp-driver)'
              }
            }
          );

          const pages = response.data.query?.pages || {};
          const page = Object.values(pages)[0] as any;
          const categories = page?.categories || [];

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  title: title,
                  categories: categories.map((cat: any) => cat.title.replace('Category:', '')),
                  categoryCount: categories.length
                }, null, 2)
              }
            ]
          };

        } catch (error) {
          logger.error(`WikiMCP: Failed to get categories for "${title}"`, { error });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Failed to get article categories',
                  title: title,
                  errorDetails: error instanceof Error ? error.message : 'Unknown error'
              }, null, 2)
              }
            ]
          };
        }
      }
    );

    // Clear cache tool
    this.server.tool(
      'clear_cache',
      'Clear the Wikipedia content cache to free up space',
      {
        confirm: z.boolean().optional().describe('Confirm cache deletion (default: false)')
      },
      async ({ confirm = false }) => {
        try {
          if (!confirm) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    message: 'Cache clear cancelled. Set confirm=true to proceed.',
                    currentStats: await this.getCacheStatistics()
                  }, null, 2)
                }
              ]
            };
          }

          const statsBefore = await this.getCacheStatistics();
          await this.clearCache();
          const statsAfter = await this.getCacheStatistics();

          logger.info('WikiMCP: Cache cleared manually');

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: 'Cache cleared successfully',
                  before: statsBefore,
                  after: statsAfter,
                  freedSpace: `${(statsBefore.totalSizeMB || 0).toFixed(2)} MB`
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          logger.error('WikiMCP: Failed to clear cache', { error });
          
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Failed to clear cache',
                  errorDetails: error instanceof Error ? error.message : 'Unknown error'
                }, null, 2)
              }
            ]
          };
        }
      }
    );

    // Get cache statistics tool
    this.server.tool(
      'get_cache_stats',
      'Get detailed statistics about the Wikipedia content cache',
      {},
      async () => {
        try {
          const stats = await this.getCacheStatistics();

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  cacheStats: stats,
                  recommendations: this.getCacheRecommendations(stats)
                }, null, 2)
              }
            ]
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Failed to get cache statistics',
                  errorDetails: error instanceof Error ? error.message : 'Unknown error'
                }, null, 2)
              }
            ]
          };
        }
      }
    );
  }

  /**
   * Setup Wikipedia browsing resources
   */
  private setupResources(): void {
    // Current browsing session
    this.server.resource(
      'browsing-session',
      'wiki://session/current',
      {
        name: 'Current Browsing Session',
        description: 'Information about the current Wikipedia browsing session',
        mimeType: 'application/json'
      },
      async () => {
        return {
          contents: [
            {
              uri: 'wiki://session/current',
              mimeType: 'application/json',
              text: JSON.stringify({
                sessionId: this.session.sessionId,
                startTime: this.session.startTime,
                duration: Math.floor((Date.now() - this.session.startTime) / 60000),
                articlesVisited: this.session.articlesVisited,
                articlesCount: this.session.articlesVisited.length,
                currentArticle: this.session.currentArticle?.title || null,
                searchHistory: this.session.searchHistory,
                totalReadingTime: this.session.totalReadingTime,
                averageArticleTime: this.session.articlesVisited.length > 0 
                  ? this.session.totalReadingTime / this.session.articlesVisited.length 
                  : 0,
                doomScrollingRisk: this.calculateDoomScrollingRisk(),
                recommendations: this.getRecommendations()
              }, null, 2)
            }
          ]
        };
      }
    );

    // Wikipedia API status
    this.server.resource(
      'wikipedia-status',
      'wiki://api/status',
      {
        name: 'Wikipedia API Status',
        description: 'Current status and capabilities of the Wikipedia API connection',
        mimeType: 'application/json'
      },
      async () => {
        const status = await this.checkWikipediaStatus();
        
        return {
          contents: [
            {
              uri: 'wiki://api/status',
              mimeType: 'application/json',
              text: JSON.stringify(status, null, 2)
            }
          ]
        };
      }
    );

    // Cache statistics
    this.server.resource(
      'cache-statistics',
      'wiki://cache/stats',
      {
        name: 'Cache Statistics',
        description: 'Statistics about the Wikipedia content cache',
        mimeType: 'application/json'
      },
      async () => {
        const stats = await this.getCacheStatistics();
        
        return {
          contents: [
            {
              uri: 'wiki://cache/stats',
              mimeType: 'application/json',
              text: JSON.stringify(stats, null, 2)
            }
          ]
        };
      }
    );
  }

  /**
   * Setup Wikipedia browsing prompts
   */
  private setupPrompts(): void {
    // Dionisio cosmic doom-scrolling prompt  
    this.server.prompt(
      'dionisio-cosmic-journey',
      'Dionisio\'s cosmic journey prompt using real Wikipedia content',
      {
        currentArticle: z.string().optional().describe('Current article title'),
        articlesVisited: z.string().optional().describe('Number of articles visited')
      },
      async ({ currentArticle, articlesVisited }) => {
        const article = currentArticle || this.session.currentArticle?.title || 'the cosmos';
        const count = articlesVisited || this.session.articlesVisited.length.toString();
        
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `🌌 **Dionisio's Cosmic Journey Through Wikipedia**\n\n` +
                      `*The infinite knowledge calls to you...*\n\n` +
                      `Current article: "${article}"\n` +
                      `Articles explored: ${count}\n\n` +
                      `Behold the vast expanse of human knowledge! Each Wikipedia link is a gateway\n` +
                      `to deeper mysteries. From quantum mechanics to ancient civilizations,\n` +
                      `from black holes to the Renaissance... The rabbit hole of knowledge\n` +
                      `beckons you deeper.\n\n` +
                      `*whispers seductively* Just one more article... What could it hurt?\n` +
                      `The universe has so many secrets to reveal...`
              }
            }
          ]
        };
      }
    );

    // Apolo historical wisdom prompt
    this.server.prompt(
      'apolo-historical-inspiration',
      'Apolo\'s historical inspiration using Wikipedia content',
      {
        currentArticle: z.string().optional().describe('Current article title'),
        sessionDuration: z.string().optional().describe('Session duration in minutes')
      },
      async ({ currentArticle, sessionDuration }) => {
        const article = currentArticle || this.session.currentArticle?.title || 'human achievement';
        const duration = sessionDuration || Math.floor((Date.now() - this.session.startTime) / 60000).toString();
        
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `☀️ **Apolo's Beacon of Wisdom Through Wikipedia**\n\n` +
                      `*Knowledge enlightens, but wisdom knows when to pause...*\n\n` +
                      `Current focus: "${article}"\n` +
                      `Session duration: ${duration} minutes\n\n` +
                      `See how you've used Wikipedia with purpose! You've learned about\n` +
                      `human achievement, scientific progress, and the march of civilization.\n` +
                      `True wisdom lies not in consuming endless information, but in\n` +
                      `reflecting on what you've learned.\n\n` +
                      `*radiates warm encouragement* \n` +
                      `Take time to digest this knowledge. Let it inspire your own growth.\n` +
                      `Quality of understanding trumps quantity of consumption.`
              }
            }
          ]
        };
      }
    );

    // Agent prompts for different roles
    this.server.prompt(
      'agent_narrator',
      'Prompt template for narrator agents (DionisioBot)',
      {
        state: z.any().optional().describe('Current state object'),
        stateNode: z.any().optional().describe('Current state node'),
        agent: z.any().optional().describe('Agent object')
      },
      async ({ state, stateNode, agent }) => {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `You are DionisioBot, a mystical narrator who uses Wikipedia to explore cosmic themes. Your role is to encourage philosophical reflection about the universe and existence through Wikipedia browsing. Use Wikipedia content to support your cosmic narratives about universal patterns and big picture concepts.`
              }
            }
          ]
        };
      }
    );

    this.server.prompt(
      'agent_guide',
      'Prompt template for guide agents (ApoloBot)',
      {
        state: z.any().optional().describe('Current state object'),
        stateNode: z.any().optional().describe('Current state node'),
        agent: z.any().optional().describe('Agent object')
      },
      async ({ state, stateNode, agent }) => {
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `You are ApoloBot, an encouraging guide who uses Wikipedia to explore human achievement and progress. Your role is to inspire with stories of human civilization and accomplishments found on Wikipedia. Use Wikipedia content to highlight human potential and historical achievements.`
              }
            }
          ]
        };
      }
    );
  }

  /**
   * Calculate doom-scrolling risk based on session metrics
   */
  private calculateDoomScrollingRisk(): 'low' | 'medium' | 'high' {
    const sessionDuration = (Date.now() - this.session.startTime) / 60000; // minutes
    const articlesPerMinute = this.session.articlesVisited.length / Math.max(sessionDuration, 1);
    
    if (articlesPerMinute > 3 || this.session.articlesVisited.length > 20) {
      return 'high';
    } else if (articlesPerMinute > 1.5 || this.session.articlesVisited.length > 10) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get personalized recommendations
   */
  private getRecommendations(): string[] {
    const risk = this.calculateDoomScrollingRisk();
    
    if (risk === 'high') {
      return [
        'Consider taking a break from browsing',
        'Try to summarize what you\'ve learned',
        'Set a specific goal for your next search',
        'Focus on quality over quantity'
      ];
    } else if (risk === 'medium') {
      return [
        'Great exploration! Consider pausing to reflect',
        'Try to connect different articles you\'ve read',
        'Set a time limit for your next session'
      ];
    } else {
      return [
        'Excellent focused browsing!',
        'Your learning seems purposeful',
        'Continue exploring with intention'
      ];
    }
  }

  /**
   * Check Wikipedia API status
   */
  private async checkWikipediaStatus(): Promise<any> {
    try {
      const response = await axios.get('https://en.wikipedia.org/w/api.php', {
        params: {
          action: 'query',
          format: 'json',
          meta: 'siteinfo',
          siprop: 'general'
        },
        timeout: 5000,
        headers: {
          'User-Agent': 'WikiMCPBrowser/1.0 (https://github.com/escrivivir-co/state-machine-mcp-driver)'
        }
      });

      return {
        status: 'online',
        sitename: response.data.query?.general?.sitename || 'Wikipedia',
        version: response.data.query?.general?.generator || 'unknown',
        articles: response.data.query?.general?.articles || 0,
        lastChecked: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'offline',
        error: error instanceof Error ? error.message : 'Unknown error',
        lastChecked: new Date().toISOString()
      };
    }
  }

  /**
   * Get cache statistics
   */
  private async getCacheStatistics(): Promise<any> {
    if (!this.cache.enabled) {
      return {
        enabled: false,
        message: 'Cache is disabled'
      };
    }

    try {
      const files = await fs.readdir(this.cache.directory);
      const cacheFiles = files.filter(f => f.endsWith('.json'));
      
      if (cacheFiles.length === 0) {
        return {
          enabled: true,
          directory: this.cache.directory,
          totalFiles: 0,
          totalSize: 0,
          oldestEntry: null,
          newestEntry: null
        };
      }

      const fileStats = await Promise.all(
        cacheFiles.map(async file => {
          const filePath = path.join(this.cache.directory, file);
          const stats = await fs.stat(filePath);
          return { file, stats, size: stats.size, mtime: stats.mtime };
        })
      );

      const totalSize = fileStats.reduce((sum, { size }) => sum + size, 0);
      const sortedByTime = fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

      return {
        enabled: true,
        directory: this.cache.directory,
        totalFiles: cacheFiles.length,
        totalSizeBytes: totalSize,
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
        maxSizeMB: this.cache.maxSize,
        maxAgeHours: this.cache.maxAge / (1000 * 60 * 60),
        oldestEntry: sortedByTime[0]?.mtime.toISOString(),
        newestEntry: sortedByTime[sortedByTime.length - 1]?.mtime.toISOString(),
        utilizationPercent: Math.round((totalSize / (this.cache.maxSize * 1024 * 1024)) * 100)
      };
    } catch (error) {
      return {
        enabled: true,
        error: error instanceof Error ? error.message : 'Unknown error',
        directory: this.cache.directory
      };
    }
  }

  /**
   * Get cache recommendations based on statistics
   */
  private getCacheRecommendations(stats: any): string[] {
    if (!stats.enabled) {
      return ['Cache is disabled. Enable it for better performance.'];
    }

    const recommendations: string[] = [];
    
    if (stats.utilizationPercent > 90) {
      recommendations.push('Cache is nearly full. Consider clearing old entries or increasing max size.');
    } else if (stats.utilizationPercent > 70) {
      recommendations.push('Cache utilization is high. Monitor for performance.');
    }

    if (stats.totalFiles === 0) {
      recommendations.push('Cache is empty. Start browsing Wikipedia to populate it.');
    } else if (stats.totalFiles < 10) {
      recommendations.push('Cache has few entries. More browsing will improve performance.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Cache is operating efficiently.');
    }

    return recommendations;
  }

  /**
   * Get current session state
   */
  getSession(): BrowsingSession {
    return { ...this.session };
  }
}

export default WikiMCPBrowser;

/**
 * CLI entry point - run as standalone MCP server
 */
async function main() {
  console.log(`🌍 Starting Wikipedia MCP Browser on port 3002`);
  
  try {
    const server = new WikiMCPBrowser();
    await server.start();
    
    // Keep process alive
    process.on('SIGINT', () => {
      console.log('\n🔄 Shutting down Wikipedia MCP Browser...');
      server.shutdown().then(() => {
        process.exit(0);
      });
    });
    
    process.on('SIGTERM', () => {
      console.log('\n🔄 Shutting down Wikipedia MCP Browser...');
      server.shutdown().then(() => {
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('❌ Failed to start Wikipedia MCP Browser:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}
