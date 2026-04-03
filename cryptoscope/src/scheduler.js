require('dotenv').config();
const cron = require('node-cron');
const { aggregateData } = require('./aggregator');
const { generateBrief } = require('./aiEngine');
const { saveBrief } = require('./data/database');
const { sendToTelegram } = require('./delivery/telegram');
const { startServer } = require('./delivery/webApi');

const INTERVAL = process.env.INTERVAL_MINUTES || 5;
const ASSET = process.env.ASSET || 'BTC/USDT';

async function runPipeline(asset) {
  console.log(`\n--- [Pipeline Start: ${new Date().toISOString()}] Asset: ${asset} ---`);
  
  try {
    // 1. Gather Data
    const payload = await aggregateData(asset);
    
    // 2. AI Prompt Engine
    const briefText = await generateBrief(payload);
    
    // 3. Save to DB (async now)
    await saveBrief(asset, briefText);
    
    // 4. Delivery
    if (process.env.ENABLE_TELEGRAM === 'true') {
      await sendToTelegram(asset, briefText);
    }
    
    console.log(`--- [Pipeline Complete] ---\n`);
  } catch (error) {
    console.error(`[Pipeline Error]`, error.message);
  }
}

if (require.main === module) {
  // Start API Server (also initialises DB)
  startServer();

  // Initialize Scheduler
  const cronExpr = `*/${INTERVAL} * * * *`;
  console.log(`[Scheduler] Initializing. Asset: ${ASSET} | Interval: every ${INTERVAL} minutes.`);
  cron.schedule(cronExpr, async () => {
    await runPipeline(ASSET);
  });
}

module.exports = { runPipeline };
