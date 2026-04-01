const axios = require('axios');

async function fetchSentiment() {
  let fgValue = '50';
  let fgLabel = 'Neutral';
  let newsHeadlines = 'No significant news.';

  try {
    // 1. Fetch Fear & Greed Index
    const fgRes = await axios.get('https://api.alternative.me/fng/');
    if (fgRes.data && fgRes.data.data && fgRes.data.data.length > 0) {
      fgValue = fgRes.data.data[0].value;
      fgLabel = fgRes.data.data[0].value_classification;
    }

    // 2. Fetch Crypto News (CryptoCompare optional)
    // Using min-api.cryptocompare.com free tier (no API key strictly required for basic news but helps)
    const apiKeyStr = process.env.CRYPTOCOMPARE_API_KEY ? `&api_key=${process.env.CRYPTOCOMPARE_API_KEY}` : '';
    const newsRes = await axios.get(`https://min-api.cryptocompare.com/data/v2/news/?lang=EN${apiKeyStr}`);
    
    if (newsRes.data && newsRes.data.Data && newsRes.data.Data.length > 0) {
      // Get top 3 headlines
      const topNews = newsRes.data.Data.slice(0, 3).map(n => n.title);
      newsHeadlines = topNews.join(' | ');
    }

  } catch (error) {
    console.error('Error fetching sentiment data:', error.message);
    // Continue smoothly on error
  }

  return {
    fearAndGreedValue: fgValue,
    fearAndGreedLabel: fgLabel,
    newsHeadlines
  };
}

module.exports = { fetchSentiment };
