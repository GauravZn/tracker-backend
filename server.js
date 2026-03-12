require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const axios = require('axios');

const app = express();

app.use(cors({
  origin: [
    'https://tracker-frontend-git-main-gaurav-jains-projects-c0e63fad.vercel.app', // Your specific Vercel URL
    'http://localhost:5173' // Keep this for local testing
  ],
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// Mongoose Schema for Monkeytype Data
const resultSchema = new mongoose.Schema({
  _id: String, // We'll use Monkeytype's native ID here
}, { strict: false });
const Result = mongoose.model('Result', resultSchema);

async function syncFromMonkeytype() {
  if (!process.env.MT_API_KEY) {
    throw new Error('MT_API_KEY is missing in .env');
  }

  const response = await axios.get('https://api.monkeytype.com/results', {
    headers: { Authorization: `ApeKey ${process.env.MT_API_KEY}` },
  });

  const tests = response?.data?.data || [];
  if (!Array.isArray(tests) || tests.length === 0) {
    return { fetched: 0, upserted: 0 };
  }

  const operations = tests.map((test) => ({
    updateOne: {
      filter: { _id: test._id },
      update: { $set: test },
      upsert: true,
    },
  }));

  const writeResult = await Result.bulkWrite(operations, { ordered: false });
  const upserted = (writeResult.upsertedCount || 0) + (writeResult.modifiedCount || 0);

  return { fetched: tests.length, upserted };
}

app.get('/', (req, res) => res.send('hello world'))

// Route: Get Aggregated Stats
app.get('/api/stats', async (req, res) => {
  try {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const stats = await Result.aggregate([
      {
        $facet: {
          lastDay: [
            { $match: { timestamp: { $gte: dayAgo } } },
            { $group: { _id: null, avgWpm: { $avg: "$wpm" }, avgAcc: { $avg: "$acc" } } }
          ],
          lastWeek: [
            { $match: { timestamp: { $gte: weekAgo } } },
            { $group: { _id: null, avgWpm: { $avg: "$wpm" }, avgAcc: { $avg: "$acc" } } }
          ],
          lastMonth: [
            { $match: { timestamp: { $gte: monthAgo } } },
            { $group: { _id: null, avgWpm: { $avg: "$wpm" }, avgAcc: { $avg: "$acc" } } }
          ]
        }
      }
    ]);
    res.json(stats[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Route: Get Historical Data for Charts
// Route: Get Historical Data for Charts with Time Filtering
app.get('/api/history', async (req, res) => {
  try {
    const { days } = req.query;
    let filter = {};

    // If a specific timeframe is requested, calculate the cutoff timestamp
    if (days && days !== 'all') {
      const cutoff = Date.now() - (parseInt(days) * 24 * 60 * 60 * 1000);
      filter = { timestamp: { $gte: cutoff } };
    }

    // Fetch and sort chronologically
    const history = await Result.find(filter).sort({ timestamp: 1 });
    res.json(history);
  } catch (error) {
    console.error("Fetch error:", error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/sync', async (req, res) => {
  try {
    const result = await syncFromMonkeytype();
    res.json({ message: 'Sync completed', ...result });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Sync failed' });
  }
});

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    try {
      const result = await syncFromMonkeytype();
      console.log(`Initial sync completed: fetched ${result.fetched}, upserted ${result.upserted}`);
    } catch (error) {
      console.error('Initial sync failed:', error.message);
    }

    app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));
  })
  .catch(err => console.error(err));
