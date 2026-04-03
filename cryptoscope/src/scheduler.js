require('dotenv').config();
const { startServer } = require('./delivery/webApi');
const { runPipeline } = require('./briefPipeline');

if (require.main === module) {
  startServer();
  console.log('[Scheduler] Auto market brief generation is disabled. Use the web dashboard or API to generate briefs on demand.');
}

module.exports = { runPipeline };
