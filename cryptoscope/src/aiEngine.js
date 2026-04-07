const fs = require('fs');
const path = require('path');
const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { StringOutputParser } = require('@langchain/core/output_parsers');

async function generateBrief(dataPayload) {
  if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'your_deepseek_api_key_here') {
    return '⚠️ DeepSeek API Key not configured. AI generated brief is unavailable.';
  }

  const model = new ChatOpenAI({
    modelName: process.env.AI_MODEL || 'deepseek-chat',
    temperature: 0.3,
    maxRetries: 2,
    configuration: {
      baseURL: 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY
    }
  });

  const outputParser = new StringOutputParser();

  try {
    // Shared Data Map for template injection
    const dataMap = {
      TIMESTAMP: dataPayload.timestamp || '',
      SESSION: dataPayload.session || '',
      ASSET: dataPayload.asset || '',
      PRICE: dataPayload.price || '',
      OPEN: dataPayload.open || '',
      HIGH: dataPayload.high || '',
      LOW: dataPayload.low || '',
      CHANGE_PCT: dataPayload.changePct || '',
      VOLUME: dataPayload.volume || '',
      RSI: dataPayload.rsi || '',
      MACD_VAL: dataPayload.macd || '',
      MACD_SIGNAL: dataPayload.macdSignal || '',
      CVD: dataPayload.cvd || '',
      IMBALANCE: dataPayload.imbalance || '',
      LIQ_LONG: dataPayload.liquidationsLong || '',
      LIQ_SHORT: dataPayload.liquidationsShort || '',
      FG_VALUE: dataPayload.fgValue || '',
      FG_LABEL: dataPayload.fgLabel || '',
      NEWS_HEADLINES: dataPayload.newsHeadlines || ''
    };

    // 1. Quant Analyst Agent
    console.log(`[aiEngine] Calling DeepSeek API via LangChain (Quant Agent)...`);
    const quantPath = path.join(__dirname, '..', 'prompts', 'agent_quant.txt');
    const quantTemplateStr = fs.readFileSync(quantPath, 'utf8');
    const quantPrompt = PromptTemplate.fromTemplate(quantTemplateStr);
    
    const quantChain = quantPrompt.pipe(model).pipe(outputParser);
    const quantAnalysis = await quantChain.invoke(dataMap);
    
    // 2. Risk Manager Agent
    console.log(`[aiEngine] Calling DeepSeek API via LangChain (Risk Agent)...`);
    const riskPath = path.join(__dirname, '..', 'prompts', 'agent_risk.txt');
    const riskTemplateStr = fs.readFileSync(riskPath, 'utf8');
    const riskPrompt = PromptTemplate.fromTemplate(riskTemplateStr);
    
    const riskChain = riskPrompt.pipe(model).pipe(outputParser);
    const riskAnalysis = await riskChain.invoke({
      ...dataMap,
      QUANT_ANALYSIS: quantAnalysis
    });

    // 3. Editor Agent
    console.log(`[aiEngine] Calling DeepSeek API via LangChain (Editor Agent)...`);
    const editorPath = path.join(__dirname, '..', 'prompts', 'agent_editor.txt');
    const editorTemplateStr = fs.readFileSync(editorPath, 'utf8');
    const editorPrompt = PromptTemplate.fromTemplate(editorTemplateStr);
    
    const editorChain = editorPrompt.pipe(model).pipe(outputParser);
    const finalBrief = await editorChain.invoke({
      ...dataMap,
      QUANT_ANALYSIS: quantAnalysis,
      RISK_ANALYSIS: riskAnalysis
    });

    console.log(`[aiEngine] Multi-Agent Pipeline Completed successfully.`);
    return finalBrief;

  } catch (error) {
    console.error('[aiEngine] Error generating AI brief:', error.message);
    throw error;
  }
}

module.exports = { generateBrief };
