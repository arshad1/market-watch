const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

async function generateBrief(dataPayload) {
  if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') {
    return '⚠️ DeepSeek API Key not configured. AI generated brief is unavailable.';
  }

  const client = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY
  });

  try {
    const templatePath = path.join(__dirname, '..', 'prompts', 'scalping_brief.txt');
    let template = fs.readFileSync(templatePath, 'utf8');

    // Inject live data into template
    const prompt = template
      .replace('{{TIMESTAMP}}', dataPayload.timestamp)
      .replace('{{SESSION}}', dataPayload.session)
      .replace('{{ASSET}}', dataPayload.asset)
      .replace('{{PRICE}}', dataPayload.price)
      .replace('{{OPEN}}', dataPayload.open)
      .replace('{{HIGH}}', dataPayload.high)
      .replace('{{LOW}}', dataPayload.low)
      .replace('{{CHANGE_PCT}}', dataPayload.changePct)
      .replace('{{VOLUME}}', dataPayload.volume)
      .replace('{{RSI}}', dataPayload.rsi)
      .replace('{{MACD_VAL}}', dataPayload.macd)
      .replace('{{MACD_SIGNAL}}', dataPayload.macdSignal)
      .replace('{{FG_VALUE}}', dataPayload.fgValue)
      .replace('{{FG_LABEL}}', dataPayload.fgLabel)
      .replace('{{NEWS_HEADLINES}}', dataPayload.newsHeadlines);

    const useModel = process.env.AI_MODEL || 'deepseek-chat';

    console.log(`[aiEngine] Calling DeepSeek API (${useModel})...`);
    const response = await client.chat.completions.create({
      model: useModel,
      max_tokens: 1200,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    });

    console.log(`[aiEngine] Brief generated successfully.`, response.choices[0].message.content);
    return response.choices[0].message.content;
  } catch (error) {
    console.error('[aiEngine] Error generating AI brief:', error.message);
    throw error;
  }
}

module.exports = { generateBrief };
