require('dotenv').config();
const { runPipeline } = require('./scheduler');

console.log('--- Testing CryptoScope Pipeline ---');
const asset = process.env.ASSET || 'BTC/USDT';

runPipeline(asset)
  .then(() => {
    console.log('Test execution complete. Exiting in 3s...');
    setTimeout(() => process.exit(0), 3000);
  })
  .catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
