require('dotenv').config();
const { MongoClient } = require('mongodb');

async function cleanVault() {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    await client.connect();
    const collection = client.db('test').collection('results');

    console.log("Scanning the vault for duplicate timestamps...");
    
    const duplicates = await collection.aggregate([
      { $group: { _id: "$timestamp", count: { $sum: 1 }, docs: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    let deletedCount = 0;
    for (const doc of duplicates) {
      // Keep the first document, target the rest for deletion
      const docsToRemove = doc.docs.slice(1);
      const result = await collection.deleteMany({ _id: { $in: docsToRemove } });
      deletedCount += result.deletedCount;
    }

    console.log(`Cleanup complete! Purged ${deletedCount} duplicate entries.`);
  } catch (err) {
    console.error("Error during cleanup:", err);
  } finally {
    await client.close();
  }
}

cleanVault();