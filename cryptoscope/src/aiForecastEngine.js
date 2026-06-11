const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');

async function generateAiForecast(dataPayload) {
  if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') {
    throw new Error('DeepSeek API Key not configured.');
  }

  const model = new ChatOpenAI({
    modelName: process.env.AI_MODEL || 'deepseek-chat',
    temperature: 0.1, // Low temperature for consistent JSON output
    maxRetries: 2,
    configuration: {
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY
    }
  });

  const outputParser = new StringOutputParser();

  try {
    const promptTemplateStr = `You are an expert quantitative crypto analyst.
You are provided with real-time market data and the results of a K-Nearest Neighbors (KNN) historical pattern matching algorithm.
Your job is to synthesize this data and produce a final predicted price path and market sentiment score.

CURRENT ASSET: {asset}
CURRENT TIMEFRAME: {timeframe}

RECENT CANDLES (last 10 shown for context):
{recentCandles}

KNN HISTORICAL MATCHES (Top 5 matches):
{knnMatches}

Based on the recent price action and how the historical patterns played out, synthesize a forecast for the next {forward} candles.

You MUST respond strictly in valid JSON format, with no markdown wrappers, backticks, or extra text.

Required JSON Structure:
{{
  "sentimentScore": <number between 0 and 100, where 0 is extreme bearish, 50 is neutral, 100 is extreme bullish>,
  "projectedPath": [<number>, <number>, ... exactly {forward} + 1 future price points starting from current close price],
  "reasoning": "<string: brief 2-3 sentence explanation of your reasoning based on the KNN matches>"
}}
`;

    const prompt = PromptTemplate.fromTemplate(promptTemplateStr);
    const chain = prompt.pipe(model).pipe(outputParser);

    // Format the incoming payload
    const recentCandlesStr = dataPayload.recentCandles.map(c => `Time: ${c.time}, O: ${c.open}, H: ${c.high}, L: ${c.low}, C: ${c.close}`).join('\n');
    
    // Format the KNN matches
    let knnMatchesStr = '';
    if (dataPayload.knnMatches && dataPayload.knnMatches.length > 0) {
      dataPayload.knnMatches.forEach((m, i) => {
        knnMatchesStr += `Match ${i + 1} (Distance: ${m.distance.toFixed(4)}):\n`;
        knnMatchesStr += ` Historical context period end: ${m.historicalIndex}\n`;
        knnMatchesStr += ` Subsequent price path (next ${dataPayload.forward} periods): [${m.subsequentPath.join(', ')}]\n\n`;
      });
    } else {
      knnMatchesStr = "No valid historical matches found.";
    }

    const responseText = await chain.invoke({
      asset: dataPayload.asset || 'Unknown',
      timeframe: dataPayload.timeframe || 'Unknown',
      recentCandles: recentCandlesStr,
      knnMatches: knnMatchesStr,
      forward: dataPayload.forward || 10
    });

    // Attempt to parse JSON. DeepSeek sometimes wraps in ```json ... ```
    let cleanJsonStr = responseText.trim();
    if (cleanJsonStr.startsWith('```json')) {
      cleanJsonStr = cleanJsonStr.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanJsonStr.startsWith('```')) {
      cleanJsonStr = cleanJsonStr.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const parsedJson = JSON.parse(cleanJsonStr);

    // Validate the response
    if (typeof parsedJson.sentimentScore !== 'number' || !Array.isArray(parsedJson.projectedPath)) {
      throw new Error('LLM returned invalid JSON structure.');
    }

    return parsedJson;

  } catch (error) {
    console.error('[aiForecastEngine] Error generating AI forecast:', error.message);
    throw error;
  }
}

module.exports = { generateAiForecast };
