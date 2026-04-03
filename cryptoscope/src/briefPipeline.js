const { aggregateData } = require('./aggregator');
const { generateBrief } = require('./aiEngine');
const { saveBrief } = require('./data/database');
const { sendToTelegram } = require('./delivery/telegram');

async function runPipeline(asset) {
  console.log(`\n--- [Pipeline Start: ${new Date().toISOString()}] Asset: ${asset} ---`);

  try {
    const payload = await aggregateData(asset);
    const briefText = await generateBrief(payload);
    await saveBrief(asset, briefText);

    if (process.env.ENABLE_TELEGRAM === 'true') {
      await sendToTelegram(asset, briefText);
    }

    console.log(`--- [Pipeline Complete] ---\n`);
    return { asset, content: briefText };
  } catch (error) {
    console.error('[Pipeline Error]', error.message);
    throw error;
  }
}

module.exports = { runPipeline };
