// News Service for Market News
// Fetches financial news from Finnhub API and Yahoo Finance

// Helper function to get API keys from localStorage
const getApiKeys = () => {
  try {
    const saved = localStorage.getItem('apiKeys');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading API keys from localStorage:', error);
  }
  // Default fallback keys
  return {
    finnhub: 'demo',
  };
};

// Finnhub News API - Primary source
// Free tier: 60 calls/minute
// Endpoint: /company-news or /news
const getFinnhubNewsUrl = (category = 'general', symbol = null) => {
  const apiKeys = getApiKeys();
  const apiKey = apiKeys.finnhub || 'demo';
  
  // If symbol is provided, get company-specific news
  if (symbol) {
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setDate(fromDate.getDate() - 7); // Last 7 days
    
    const from = fromDate.toISOString().split('T')[0];
    const to = today.toISOString().split('T')[0];
    
    return `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${apiKey}`;
  }
  
  // General market news
  return `https://finnhub.io/api/v1/news?category=${category}&token=${apiKey}`;
};

// Fetch news from Finnhub
export const fetchFinnhubNews = async (category = 'general', symbol = null) => {
  try {
    const url = getFinnhubNewsUrl(category, symbol);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to fetch news: ${response.status} ${response.statusText}. ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data || (Array.isArray(data) && data.length === 0)) {
      return [];
    }
    
    // Normalize Finnhub news format
    if (Array.isArray(data)) {
      return data.map(item => ({
        id: item.id || `${item.headline}-${item.datetime}`,
        title: item.headline || item.title || 'No title',
        summary: item.summary || item.description || '',
        source: item.source || 'Unknown',
        url: item.url || item.link || '#',
        image: item.image || null,
        datetime: item.datetime * 1000 || Date.now(), // Convert Unix timestamp to milliseconds
        category: item.category || category,
        symbol: item.related || symbol || null,
        sentiment: item.sentiment || null,
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching news from Finnhub:', error);
    throw error;
  }
};

// Yahoo Finance News - Using RSS feed approach
// Since Yahoo Finance doesn't have an official API, we'll use their RSS feeds
const getYahooFinanceNewsUrl = (category = 'general') => {
  const categoryMap = {
    general: 'https://feeds.finance.yahoo.com/rss/2.0/headline',
    market: 'https://feeds.finance.yahoo.com/rss/2.0/headline',
    stocks: 'https://feeds.finance.yahoo.com/rss/2.0/headline',
    crypto: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=YF',
    economy: 'https://feeds.finance.yahoo.com/rss/2.0/headline',
  };
  
  return categoryMap[category] || categoryMap.general;
};

// Fetch news from Yahoo Finance RSS
export const fetchYahooFinanceNews = async (category = 'general') => {
  try {
    // Use CORS proxy for RSS feed
    const rssUrl = getYahooFinanceNewsUrl(category);
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Yahoo Finance request timeout')), 10000)
    );
    
    const fetchPromise = fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch Yahoo Finance news: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.contents) {
      console.warn('Yahoo Finance: No contents in response');
      return [];
    }
    
    // Parse RSS XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data.contents, 'text/xml');
    
    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.error('Yahoo Finance RSS parsing error:', parseError.textContent);
      return [];
    }
    
    const items = xmlDoc.querySelectorAll('item');
    
    if (!items || items.length === 0) {
      console.warn('Yahoo Finance: No items found in RSS feed');
      return [];
    }
    
    const news = [];
    items.forEach((item, index) => {
      try {
        const title = item.querySelector('title')?.textContent || 'No title';
        const description = item.querySelector('description')?.textContent || '';
        const link = item.querySelector('link')?.textContent || '#';
        const pubDate = item.querySelector('pubDate')?.textContent || new Date().toISOString();
        
        // Extract image from description if available
        const imgMatch = description.match(/<img[^>]+src="([^"]+)"/i);
        const image = imgMatch ? imgMatch[1] : null;
        
        // Clean description
        const cleanDescription = description
          .replace(/<[^>]*>/g, '') // Remove HTML tags
          .replace(/&nbsp;/g, ' ') // Replace &nbsp;
          .replace(/&amp;/g, '&') // Replace &amp;
          .replace(/&lt;/g, '<') // Replace &lt;
          .replace(/&gt;/g, '>') // Replace &gt;
          .trim()
          .substring(0, 300); // Limit length
        
        news.push({
          id: `yahoo-${index}-${Date.now()}`,
          title: title.trim(),
          summary: cleanDescription || 'No description available',
          source: 'Yahoo Finance',
          url: link.trim(),
          image: image,
          datetime: new Date(pubDate).getTime() || Date.now(),
          category: category,
          symbol: null,
          sentiment: null,
        });
      } catch (itemError) {
        console.warn('Error parsing Yahoo Finance news item:', itemError);
      }
    });
    
    if (news.length === 0) {
      console.warn('Yahoo Finance: No valid news items parsed');
      return [];
    }
    
    return news.slice(0, 50); // Limit to 50 items
  } catch (error) {
    console.error('Error fetching news from Yahoo Finance:', error);
    // Don't throw - return empty array so other sources can still work
    return [];
  }
};

// Helper function to remove duplicate news articles
const removeDuplicates = (newsArray) => {
  const seen = new Set();
  const unique = [];
  
  for (const item of newsArray) {
    // Create a unique key from title (normalized) and URL
    const titleKey = item.title.toLowerCase().trim().substring(0, 50);
    const urlKey = item.url || '';
    const key = `${titleKey}-${urlKey}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  
  return unique;
};

// Unified fetch function that fetches from both sources simultaneously
export const fetchMarketNews = async (category = 'general', symbol = null) => {
  const sources = [];
  const errors = [];
  
  try {
    // Fetch from both sources in parallel
    const promises = [];
    
    // Always try Finnhub
    promises.push(
      fetchFinnhubNews(category, symbol)
        .then(news => {
          if (news && news.length > 0) {
            sources.push('finnhub');
            return news.map(item => ({ ...item, apiSource: 'finnhub' }));
          }
          return [];
        })
        .catch(error => {
          console.error('Finnhub fetch error:', error);
          errors.push({ source: 'finnhub', error: error.message });
          return [];
        })
    );
    
    // Try Yahoo Finance if no symbol (Yahoo Finance doesn't support symbol-specific news easily)
    if (!symbol) {
      promises.push(
        fetchYahooFinanceNews(category)
          .then(news => {
            if (news && news.length > 0) {
              sources.push('yahoo');
              return news.map(item => ({ ...item, apiSource: 'yahoo' }));
            }
            return [];
          })
          .catch(error => {
            console.error('Yahoo Finance fetch error:', error);
            errors.push({ source: 'yahoo', error: error.message });
            return [];
          })
      );
    }
    
    // Wait for all promises to resolve
    const results = await Promise.all(promises);
    
    // Combine all news from all sources
    const allNews = results.flat();
    
    // Remove duplicates
    const uniqueNews = removeDuplicates(allNews);
    
    // Sort by date (newest first)
    uniqueNews.sort((a, b) => (b.datetime || 0) - (a.datetime || 0));
    
    // Determine source status
    const sourceStatus = sources.length > 0 ? sources.join('+') : 'none';
    
    return {
      news: uniqueNews,
      source: sourceStatus,
      sources: sources,
      errors: errors.length > 0 ? errors : null,
    };
  } catch (error) {
    console.error('Error fetching market news:', error);
    
    // Return whatever we have, even if there were errors
    return {
      news: [],
      source: 'none',
      sources: [],
      errors: [{ source: 'unknown', error: error.message }],
    };
  }
};

// Get news by category
export const getNewsByCategory = async (category = 'general') => {
  const categoryMap = {
    all: 'general',
    market: 'general',
    stocks: 'general',
    crypto: 'crypto',
    economy: 'general',
  };
  
  const mappedCategory = categoryMap[category] || 'general';
  return fetchMarketNews(mappedCategory);
};

// Get company-specific news
export const getCompanyNews = async (symbol) => {
  if (!symbol || !symbol.trim()) {
    return { news: [], source: 'none' };
  }
  
  return fetchMarketNews('general', symbol.toUpperCase().trim());
};

// Search news by keyword (using both sources and filtering)
// If keyword looks like a stock symbol (1-5 uppercase letters), try company news first
export const searchNews = async (keyword) => {
  try {
    if (!keyword || !keyword.trim()) {
      return { news: [], source: 'none', sources: [] };
    }
    
    const trimmedKeyword = keyword.trim().toUpperCase();
    
    // Check if keyword looks like a stock symbol (1-5 uppercase letters/numbers)
    const symbolPattern = /^[A-Z0-9]{1,5}$/;
    const isLikelySymbol = symbolPattern.test(trimmedKeyword);
    
    let result;
    
    // If it looks like a symbol, try company-specific news first (Finnhub only for company news)
    if (isLikelySymbol) {
      try {
        // For company news, we can only use Finnhub (Yahoo Finance doesn't support symbol-specific easily)
        const finnhubNews = await fetchFinnhubNews('general', trimmedKeyword)
          .then(news => {
            if (news && news.length > 0) {
              return news.map(item => ({ ...item, apiSource: 'finnhub' }));
            }
            return [];
          })
          .catch(() => []);
        
        // Also get general news from both sources and filter
        const generalResult = await fetchMarketNews('general');
        const allNews = [...finnhubNews, ...(generalResult.news || [])];
        
        // Remove duplicates
        const uniqueNews = removeDuplicates(allNews);
        
        // Filter by keyword
        const keywordLower = keyword.toLowerCase();
        const filtered = uniqueNews.filter(item => 
          item.title.toLowerCase().includes(keywordLower) ||
          item.summary.toLowerCase().includes(keywordLower) ||
          (item.symbol && item.symbol.toUpperCase().includes(trimmedKeyword))
        );
        
        // Sort by date
        filtered.sort((a, b) => (b.datetime || 0) - (a.datetime || 0));
        
        const sources = finnhubNews.length > 0 ? ['finnhub'] : generalResult.sources || [];
        if (generalResult.sources && generalResult.sources.length > 0) {
          sources.push(...generalResult.sources.filter(s => !sources.includes(s)));
        }
        
        return {
          news: filtered,
          source: sources.length > 0 ? sources.join('+') : 'none',
          sources: sources,
          errors: generalResult.errors,
        };
      } catch (error) {
        console.log('Company news search failed, falling back to general search:', error);
      }
    }
    
    // General keyword search - fetch from both sources
    result = await fetchMarketNews('general');
    if (!result.news || result.news.length === 0) {
      return { news: [], source: 'none', sources: [] };
    }
    
    // Filter by keyword
    const keywordLower = keyword.toLowerCase();
    const filtered = result.news.filter(item => 
      item.title.toLowerCase().includes(keywordLower) ||
      item.summary.toLowerCase().includes(keywordLower) ||
      (item.symbol && item.symbol.toUpperCase().includes(trimmedKeyword))
    );
    
    // Sort by date
    filtered.sort((a, b) => (b.datetime || 0) - (a.datetime || 0));
    
    return {
      news: filtered,
      source: result.source,
      sources: result.sources || [],
      errors: result.errors,
    };
  } catch (error) {
    console.error('Error searching news:', error);
    return { news: [], source: 'none', sources: [], errors: [{ source: 'unknown', error: error.message }] };
  }
};

