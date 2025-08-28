/**
 * Wikipedia MCP Browser Server
 * Real Wikipedia access via public API following the MCP protocol
 */

import { BaseMCPServer, MCPServerConfig } from './BaseMCPServer';
import { z } from 'zod';
import axios from 'axios';
import { logger } from '../utils/logger';

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
          const response = await axios.get(
            `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
            {
              headers: {
                'User-Agent': 'WikiMCPBrowser/1.0 (https://github.com/escrivivir-co/state-machine-mcp-driver)'
              }
            }
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
            const contentResponse = await axios.get(
              `https://${language}.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(title)}`,
              {
                headers: {
                  'User-Agent': 'WikiMCPBrowser/1.0 (https://github.com/escrivivir-co/state-machine-mcp-driver)'
                }
              }
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
          const searchResponse = await axios.get(
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
              },
              headers: {
                'User-Agent': 'WikiMCPBrowser/1.0 (https://github.com/escrivivir-co/state-machine-mcp-driver)'
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
