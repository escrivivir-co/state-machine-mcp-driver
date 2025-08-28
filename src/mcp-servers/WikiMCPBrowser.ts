/**
 * Wiki MCP Browser Server
 * Provides tools, resources and prompts for Wikipedia browsing and doom-scrolling prevention
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from '../utils/logger';

/**
 * Wikipedia article structure
 */
export interface WikiArticle {
  /** Article title */
  title: string;
  /** Article URL */
  url: string;
  /** Article summary */
  summary: string;
  /** Full content (excerpts) */
  content: string;
  /** Extraction timestamp */
  timestamp: number;
  /** Article links */
  links: WikiLink[];
  /** Categories */
  categories: string[];
  /** Article metadata */
  metadata: {
    lastModified?: string;
    wordCount?: number;
    readingTime?: number;
    language?: string;
  };
}

/**
 * Wikipedia link structure
 */
export interface WikiLink {
  /** Link title */
  title: string;
  /** Link URL */
  url: string;
  /** Link type */
  type: 'internal' | 'external' | 'category';
  /** Link relevance score */
  relevance?: number;
}

/**
 * Browsing session state
 */
export interface BrowsingSession {
  /** Session ID */
  id: string;
  /** Current article */
  currentArticle?: WikiArticle;
  /** Browsing history */
  history: WikiArticle[];
  /** Session start time */
  startTime: number;
  /** Total articles visited */
  articlesVisited: number;
  /** Session theme/topic */
  theme: string;
  /** User preferences */
  preferences: {
    preferredTopics: string[];
    avoidTopics: string[];
    maxArticleLength: number;
  };
}

/**
 * Content discovery result
 */
export interface DiscoveryResult {
  /** Found articles */
  articles: WikiArticle[];
  /** Search query used */
  query: string;
  /** Discovery strategy */
  strategy: 'search' | 'related' | 'category' | 'random';
  /** Relevance scores */
  relevanceScores: number[];
}

/**
 * Simulated Wikipedia MCP Server for content browsing
 */
export class WikiMCPBrowser extends EventEmitter {
  private id: string;
  private name: string;
  private session: BrowsingSession;
  private contentDatabase: Map<string, WikiArticle> = new Map();
  private prompts: Map<string, string> = new Map();
  private resources: Map<string, any> = new Map();

  constructor(id = 'wiki-mcp-browser', name = 'Wiki MCP Browser') {
    super();
    this.id = id;
    this.name = name;
    this.session = this.initializeSession();
    this.setupContentDatabase();
    this.setupPrompts();
    this.setupResources();
  }

  /**
   * Execute a tool
   */
  async executeTool(toolName: string, params: Record<string, any>): Promise<any> {
    try {
      logger.info(`WikiMCP: Executing tool ${toolName}`, { params });

      switch (toolName) {
        case 'load_article':
          return this.loadArticle(params);
        
        case 'search_articles':
          return this.searchArticles(params);
        
        case 'get_related_articles':
          return this.getRelatedArticles(params);
        
        case 'navigate_to_link':
          return this.navigateToLink(params);
        
        case 'get_browsing_session':
          return this.getBrowsingSession();
        
        case 'discover_content':
          return this.discoverContent(params);
        
        case 'get_recommendations':
          return this.getRecommendations(params);
        
        case 'extract_timeline':
          return this.extractTimeline(params);
        
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      logger.error(`WikiMCP: Tool execution failed`, { toolName, error });
      throw error;
    }
  }

  /**
   * Get a resource
   */
  async getResource(resourceName: string, context?: Record<string, any>): Promise<any> {
    logger.info(`WikiMCP: Getting resource ${resourceName}`, { context });
    
    const resource = this.resources.get(resourceName);
    if (!resource) {
      throw new Error(`Resource not found: ${resourceName}`);
    }

    // Dynamic resource generation
    if (typeof resource === 'function') {
      return resource(this.session, context);
    }

    return resource;
  }

  /**
   * Get a prompt
   */
  async getPrompt(promptName: string, context?: Record<string, any>): Promise<string> {
    logger.info(`WikiMCP: Getting prompt ${promptName}`, { context });
    
    const prompt = this.prompts.get(promptName);
    if (!prompt) {
      throw new Error(`Prompt not found: ${promptName}`);
    }

    return this.interpolatePrompt(prompt, { ...this.session, ...context });
  }

  /**
   * Get current browsing session
   */
  getSession(): BrowsingSession {
    return { ...this.session };
  }

  // Private implementation methods

  private initializeSession(): BrowsingSession {
    return {
      id: `session-${Date.now()}`,
      history: [],
      startTime: Date.now(),
      articlesVisited: 0,
      theme: 'general',
      preferences: {
        preferredTopics: [],
        avoidTopics: [],
        maxArticleLength: 5000
      }
    };
  }

  private setupContentDatabase(): void {
    // Sample articles for different themes

    // Universe & Cosmology (for Dionisio)
    this.contentDatabase.set('big_bang', {
      title: 'Big Bang',
      url: 'https://en.wikipedia.org/wiki/Big_Bang',
      summary: 'The Big Bang theory describes the cosmic microwave background radiation and the observed abundances of light elements.',
      content: `The Big Bang theory is the prevailing cosmological model explaining the existence of the observable universe from the earliest known periods through its subsequent large-scale evolution...

The model describes how the universe expanded from an initial state of high density and temperature...`,
      timestamp: Date.now(),
      links: [
        { title: 'Cosmic Microwave Background', url: 'https://en.wikipedia.org/wiki/Cosmic_microwave_background', type: 'internal' },
        { title: 'Universe', url: 'https://en.wikipedia.org/wiki/Universe', type: 'internal' },
        { title: 'Multiverse', url: 'https://en.wikipedia.org/wiki/Multiverse', type: 'internal' }
      ],
      categories: ['Cosmology', 'Physics', 'Universe'],
      metadata: {
        lastModified: '2024-08-20',
        wordCount: 12000,
        readingTime: 15,
        language: 'en'
      }
    });

    this.contentDatabase.set('black_holes', {
      title: 'Black Hole',
      url: 'https://en.wikipedia.org/wiki/Black_hole',
      summary: 'A black hole is a region of spacetime where gravity is so strong that nothing can escape from it.',
      content: `A black hole is a region of spacetime where gravity is so strong that nothing—no particles or even electromagnetic radiation such as light—can escape from it...

The theory of general relativity predicts that a sufficiently compact mass can deform spacetime to form a black hole...`,
      timestamp: Date.now(),
      links: [
        { title: 'Event Horizon', url: 'https://en.wikipedia.org/wiki/Event_horizon', type: 'internal' },
        { title: 'Hawking Radiation', url: 'https://en.wikipedia.org/wiki/Hawking_radiation', type: 'internal' },
        { title: 'Wormhole', url: 'https://en.wikipedia.org/wiki/Wormhole', type: 'internal' }
      ],
      categories: ['Astrophysics', 'General Relativity', 'Black Holes'],
      metadata: {
        lastModified: '2024-08-18',
        wordCount: 15000,
        readingTime: 18,
        language: 'en'
      }
    });

    // Human History (for Apolo)
    this.contentDatabase.set('renaissance', {
      title: 'Renaissance',
      url: 'https://en.wikipedia.org/wiki/Renaissance',
      summary: 'The Renaissance was a period in European history marking the transition from the Middle Ages to modernity.',
      content: `The Renaissance was a fervent period of European cultural, artistic, political and economic "rebirth" following the Middle Ages...

Generally described as taking place from the 14th century to the 17th century, the Renaissance promoted the rediscovery of classical philosophy, literature and art...`,
      timestamp: Date.now(),
      links: [
        { title: 'Leonardo da Vinci', url: 'https://en.wikipedia.org/wiki/Leonardo_da_Vinci', type: 'internal' },
        { title: 'Michelangelo', url: 'https://en.wikipedia.org/wiki/Michelangelo', type: 'internal' },
        { title: 'Scientific Revolution', url: 'https://en.wikipedia.org/wiki/Scientific_Revolution', type: 'internal' }
      ],
      categories: ['Renaissance', 'European History', 'Cultural History'],
      metadata: {
        lastModified: '2024-08-15',
        wordCount: 18000,
        readingTime: 22,
        language: 'en'
      }
    });

    this.contentDatabase.set('ancient_egypt', {
      title: 'Ancient Egypt',
      url: 'https://en.wikipedia.org/wiki/Ancient_Egypt',
      summary: 'Ancient Egypt was a civilization of ancient Africa, concentrated along the lower reaches of the Nile River.',
      content: `Ancient Egypt was a civilization of ancient Africa, concentrated along the lower reaches of the Nile River, situated in the place that is now the country Egypt...

For over 3000 years, ancient Egypt was consistently one of the most powerful and influential civilizations in the Mediterranean world...`,
      timestamp: Date.now(),
      links: [
        { title: 'Pyramid of Giza', url: 'https://en.wikipedia.org/wiki/Great_Pyramid_of_Giza', type: 'internal' },
        { title: 'Pharaoh', url: 'https://en.wikipedia.org/wiki/Pharaoh', type: 'internal' },
        { title: 'Hieroglyphs', url: 'https://en.wikipedia.org/wiki/Egyptian_hieroglyphs', type: 'internal' }
      ],
      categories: ['Ancient Egypt', 'African History', 'Ancient Civilizations'],
      metadata: {
        lastModified: '2024-08-12',
        wordCount: 20000,
        readingTime: 25,
        language: 'en'
      }
    });

    // More articles can be added...
  }

  private setupPrompts(): void {
    this.prompts.set('dionisio_cosmic_journey',
      `🌌 **Dionisio's Cosmic Journey**\n\n` +
      `*The universe whispers its secrets...*\n\n` +
      `Current article: "{{currentArticle}}"\n` +
      `Articles explored: {{articlesVisited}}\n\n` +
      `Behold the infinite cosmos! From the primordial Big Bang to the eventual heat death,\n` +
      `every article is a gateway to profound mysteries. Shall we dive deeper into:\n\n` +
      `🔗 Available paths of cosmic discovery:\n` +
      `{{availableLinks}}\n\n` +
      `*whispers seductively* Just one more click into the abyss of knowledge...`
    );

    this.prompts.set('apolo_historical_inspiration',
      `☀️ **Apolo's Historical Beacon**\n\n` +
      `*Light shines upon human achievement!*\n\n` +
      `Current exploration: "{{currentArticle}}"\n` +
      `Journey progress: {{articlesVisited}} milestones\n\n` +
      `Witness the magnificent tapestry of human civilization! From ancient pyramids\n` +
      `to Renaissance masterpieces, each link reveals our species' greatest triumphs.\n\n` +
      `🎯 Paths of inspiration await:\n` +
      `{{availableLinks}}\n\n` +
      `*radiates warmth* Let us explore how humanity reached for the stars!`
    );

    this.prompts.set('content_discovery',
      `🔍 **Content Discovery**\n\n` +
      `Searching for: {{query}}\n` +
      `Strategy: {{strategy}}\n` +
      `Theme: {{theme}}\n\n` +
      `Discovering relevant articles that match your exploration theme...`
    );

    this.prompts.set('navigation_guide',
      `🧭 **Navigation Guide**\n\n` +
      `You are currently reading: "{{currentArticle}}"\n` +
      `Session duration: {{sessionDuration}} minutes\n\n` +
      `Available navigation options:\n` +
      `- 🔗 Follow article links ({{linkCount}} available)\n` +
      `- 🔍 Search for specific topics\n` +
      `- 🎲 Discover random related content\n` +
      `- 📊 View browsing history\n\n` +
      `Where would you like to explore next?`
    );
  }

  private setupResources(): void {
    // Current session resource
    this.resources.set('current_session', (session: BrowsingSession) => ({
      sessionId: session.id,
      currentArticle: session.currentArticle?.title || 'None',
      articlesVisited: session.articlesVisited,
      sessionDuration: Math.floor((Date.now() - session.startTime) / 60000),
      theme: session.theme
    }));

    // Browsing history resource
    this.resources.set('browsing_history', (session: BrowsingSession) => ({
      totalArticles: session.history.length,
      articles: session.history.map(article => ({
        title: article.title,
        summary: article.summary.substring(0, 150) + '...',
        timestamp: article.timestamp
      })),
      themes: [...new Set(session.history.flatMap(a => a.categories))]
    }));

    // Content recommendations resource
    this.resources.set('recommendations', (session: BrowsingSession, context: any) => {
      const currentTheme = context?.theme || session.theme;
      const recommendations = this.generateRecommendations(currentTheme, session);
      
      return {
        theme: currentTheme,
        recommendedArticles: recommendations,
        explorationPaths: this.generateExplorationPaths(currentTheme)
      };
    });

    // Discovery statistics
    this.resources.set('discovery_stats', (session: BrowsingSession) => ({
      totalExplorationTime: Date.now() - session.startTime,
      articlesPerMinute: session.articlesVisited / Math.max(1, (Date.now() - session.startTime) / 60000),
      dominantCategories: this.getDominantCategories(session),
      explorationPattern: this.analyzeExplorationPattern(session)
    }));
  }

  private async loadArticle(params: Record<string, any>): Promise<WikiArticle> {
    const articleId = params.articleId || params.title;
    
    if (!articleId) {
      throw new Error('Missing articleId or title parameter');
    }

    const article = this.contentDatabase.get(articleId.toLowerCase().replace(/\s+/g, '_'));
    
    if (!article) {
      // Simulate article not found - generate a basic one
      const mockArticle: WikiArticle = {
        title: articleId,
        url: `https://en.wikipedia.org/wiki/${articleId.replace(/\s+/g, '_')}`,
        summary: `This is a simulated article about ${articleId}. In a real implementation, this would be fetched from Wikipedia's API.`,
        content: `# ${articleId}\n\nThis article would contain detailed information about ${articleId}.\n\nIn a real MCP server, this content would be dynamically fetched from Wikipedia's API and processed for presentation.`,
        timestamp: Date.now(),
        links: [],
        categories: ['Simulated Content'],
        metadata: {
          wordCount: 100,
          readingTime: 1,
          language: 'en'
        }
      };
      
      return mockArticle;
    }

    // Update session
    this.session.currentArticle = article;
    this.session.history.push(article);
    this.session.articlesVisited++;

    this.emit('article_loaded', { article, session: this.session });

    return article;
  }

  private async searchArticles(params: Record<string, any>): Promise<DiscoveryResult> {
    const query = params.query;
    const maxResults = params.maxResults || 5;
    
    if (!query) {
      throw new Error('Missing query parameter');
    }

    // Simple search simulation
    const allArticles = Array.from(this.contentDatabase.values());
    const results = allArticles.filter(article => 
      article.title.toLowerCase().includes(query.toLowerCase()) ||
      article.summary.toLowerCase().includes(query.toLowerCase()) ||
      article.categories.some(cat => cat.toLowerCase().includes(query.toLowerCase()))
    ).slice(0, maxResults);

    const discoveryResult: DiscoveryResult = {
      articles: results,
      query,
      strategy: 'search',
      relevanceScores: results.map(() => Math.random() * 0.5 + 0.5) // Mock relevance
    };

    return discoveryResult;
  }

  private async getRelatedArticles(params: Record<string, any>): Promise<WikiArticle[]> {
    const articleId = params.articleId;
    const maxResults = params.maxResults || 3;
    
    if (!articleId) {
      throw new Error('Missing articleId parameter');
    }

    const currentArticle = this.contentDatabase.get(articleId);
    if (!currentArticle) {
      return [];
    }

    // Find articles with overlapping categories
    const relatedArticles = Array.from(this.contentDatabase.values())
      .filter(article => 
        article.title !== currentArticle.title &&
        article.categories.some(cat => currentArticle.categories.includes(cat))
      )
      .slice(0, maxResults);

    return relatedArticles;
  }

  private async navigateToLink(params: Record<string, any>): Promise<WikiArticle> {
    const linkTitle = params.linkTitle;
    
    if (!linkTitle) {
      throw new Error('Missing linkTitle parameter');
    }

    // Find the article corresponding to the link
    return this.loadArticle({ title: linkTitle });
  }

  private async getBrowsingSession(): Promise<BrowsingSession> {
    return this.getSession();
  }

  private async discoverContent(params: Record<string, any>): Promise<DiscoveryResult> {
    const theme = params.theme || 'general';
    const strategy = params.strategy || 'category';
    const maxResults = params.maxResults || 5;

    let articles: WikiArticle[] = [];

    switch (strategy) {
      case 'category':
        articles = this.discoverByCategory(theme, maxResults);
        break;
      case 'related':
        articles = await this.discoverRelated(theme, maxResults);
        break;
      case 'random':
        articles = this.discoverRandom(maxResults);
        break;
      default:
        articles = await this.searchArticles({ query: theme, maxResults });
        return articles as any;
    }

    return {
      articles,
      query: theme,
      strategy,
      relevanceScores: articles.map(() => Math.random() * 0.4 + 0.6)
    };
  }

  private async getRecommendations(params: Record<string, any>): Promise<WikiArticle[]> {
    const theme = params.theme || this.session.theme;
    return this.generateRecommendations(theme, this.session);
  }

  private async extractTimeline(params: Record<string, any>): Promise<any> {
    const theme = params.theme || 'history';
    
    // Mock timeline extraction
    const timelineEvents = [
      { year: '13.8 billion years ago', event: 'Big Bang', category: 'cosmology' },
      { year: '4.6 billion years ago', event: 'Formation of Earth', category: 'cosmology' },
      { year: '3100 BCE', event: 'Unification of Egypt', category: 'history' },
      { year: '1400-1600 CE', event: 'Renaissance Period', category: 'history' },
      { year: '1969 CE', event: 'Moon Landing', category: 'history' }
    ].filter(event => theme === 'general' || event.category === theme);

    return {
      theme,
      events: timelineEvents,
      totalEvents: timelineEvents.length
    };
  }

  // Helper methods

  private discoverByCategory(theme: string, maxResults: number): WikiArticle[] {
    return Array.from(this.contentDatabase.values())
      .filter(article => 
        article.categories.some(cat => 
          cat.toLowerCase().includes(theme.toLowerCase())
        )
      )
      .slice(0, maxResults);
  }

  private async discoverRelated(theme: string, maxResults: number): Promise<WikiArticle[]> {
    // First search for articles matching the theme
    const searchResults = await this.searchArticles({ query: theme, maxResults: 1 });
    
    if (searchResults.articles.length === 0) {
      return [];
    }

    // Then find related articles
    return this.getRelatedArticles({ 
      articleId: searchResults.articles[0].title.toLowerCase().replace(/\s+/g, '_'),
      maxResults 
    });
  }

  private discoverRandom(maxResults: number): WikiArticle[] {
    const allArticles = Array.from(this.contentDatabase.values());
    const shuffled = allArticles.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, maxResults);
  }

  private generateRecommendations(theme: string, session: BrowsingSession): WikiArticle[] {
    // Generate recommendations based on theme and browsing history
    const visitedTitles = new Set(session.history.map(a => a.title));
    
    return Array.from(this.contentDatabase.values())
      .filter(article => 
        !visitedTitles.has(article.title) &&
        (theme === 'general' || article.categories.some(cat => 
          cat.toLowerCase().includes(theme.toLowerCase())
        ))
      )
      .slice(0, 3);
  }

  private generateExplorationPaths(theme: string): string[] {
    const paths: Record<string, string[]> = {
      cosmology: ['Big Bang → Universe → Multiverse', 'Black Holes → Event Horizon → Hawking Radiation'],
      history: ['Ancient Egypt → Pharaohs → Pyramids', 'Renaissance → Leonardo da Vinci → Scientific Revolution'],
      general: ['Featured Articles', 'Random Discovery', 'Category Exploration']
    };

    return paths[theme] || paths.general;
  }

  private getDominantCategories(session: BrowsingSession): string[] {
    const categoryCount = new Map<string, number>();
    
    session.history.forEach(article => {
      article.categories.forEach(category => {
        categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
      });
    });

    return Array.from(categoryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(entry => entry[0]);
  }

  private analyzeExplorationPattern(session: BrowsingSession): string {
    if (session.history.length < 2) return 'starting';
    
    const categories = session.history.flatMap(a => a.categories);
    const uniqueCategories = new Set(categories);
    
    if (uniqueCategories.size === 1) return 'focused';
    if (uniqueCategories.size > categories.length * 0.7) return 'exploratory';
    return 'mixed';
  }

  private interpolatePrompt(template: string, context: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (key === 'availableLinks' && context.currentArticle?.links) {
        return context.currentArticle.links
          .slice(0, 3)
          .map((link: WikiLink) => `  • ${link.title}`)
          .join('\n');
      }
      
      if (key === 'sessionDuration') {
        return Math.floor((Date.now() - context.startTime) / 60000).toString();
      }

      return context[key]?.toString() || match;
    });
  }
}

export default WikiMCPBrowser;
