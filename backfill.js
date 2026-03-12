require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const { MongoClient } = require('mongodb');

async function runBackfill() {
  const results = [];
  
  console.log("Reading CSV file...");

  fs.createReadStream('monkeytype_export.csv')
    .pipe(csv())
    .on('data', (row) => {
      // Monkeytype CSVs store everything as strings. 
      // We MUST convert these to numbers so your Recharts can plot them.
      const formattedTest = {
        ...row,
        wpm: parseFloat(row.wpm) || 0,
        acc: parseFloat(row.acc) || 0,
        consistency: parseFloat(row.consistency) || 0,
        timestamp: parseInt(row.timestamp) || 0,
      };
      
      // We use the timestamp or the CSV's built-in id as the unique identifier
      formattedTest._id = row._id || row.timestamp.toString();
      
      results.push(formattedTest);
    })
    .on('end', async () => {
      console.log(`Successfully parsed ${results.length} historical tests.`);
      console.log("Connecting to MongoDB and pushing payload...");

      const client = new MongoClient(process.env.MONGO_URI);
      
      try {
        await client.connect();
        // Make sure 'test' matches whatever database name you are using in MongoDB Atlas
        const collection = client.db('test').collection('results');

        // We use bulkWrite with upsert so it never creates duplicates, 
        // even if you run this script twice.
        const ops = results.map(test => ({
          updateOne: {
            filter: { _id: test._id },
            update: { $set: test },
            upsert: true
          }
        }));

        if (ops.length > 0) {
          const dbResult = await collection.bulkWrite(ops);
          console.log(`🔥 Vault Updated!`);
          console.log(`Matched existing: ${dbResult.matchedCount}`);
          console.log(`Newly inserted: ${dbResult.upsertedCount}`);
        } else {
          console.log("No data found to insert.");
        }

      } catch (error) {
        console.error("Database Error:", error);
      } finally {
        await client.close();
        console.log("Process complete.");
      }
    });
}

runBackfill();