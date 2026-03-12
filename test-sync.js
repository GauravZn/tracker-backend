require('dotenv').config();
const axios = require('axios');

async function testFetch() {
  try {
    console.log("Fetching latest tests from Monkeytype...");
    
    // Fetching the user's results
    const response = await axios.get('https://api.monkeytype.com/results', {
      headers: { 'Authorization': `ApeKey ${process.env.MT_API_KEY}` }
    });

    const newTests = response.data.data;

    if (!newTests || newTests.length === 0) {
      console.log("No tests found or API key is invalid.");
      return;
    }

    console.log(`\nSuccessfully fetched ${newTests.length} tests!`);
    console.log("Here is what a single raw test object looks like:\n");
    console.log(newTests[0]);

    // Let's see how it maps to our MongoDB Schema
    const mappedTest = {
      _id: newTests[0]._id,
      wpm: newTests[0].wpm,
      acc: newTests[0].acc,
      timestamp: newTests[0].timestamp,
      mode: newTests[0].mode
    };

    console.log("\nHere is how it will be saved to your database:\n");
    console.log(mappedTest);

  } catch (error) {
    console.error("Error fetching from Monkeytype API:");
    console.error(error.response ? error.response.data : error.message);
  }
}

testFetch();