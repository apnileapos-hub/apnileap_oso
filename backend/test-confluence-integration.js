const { createConfluenceSpace } = require('./confluenceService');

async function verifyConfluenceIntegration() {
  console.log("=== VERIFYING CONFLUENCE SERVICE INTEGRATION ===");

  const testKey = "TEST" + Math.floor(100 + Math.random() * 900);
  const testName = "Verify Confluence Integration " + testKey;
  const testDesc = "Automated integration testing for space provisioning.";

  console.log(`Generating valid space key: ${testKey}`);
  console.log(`Invoking createConfluenceSpace...`);

  try {
    const spaceUrl = await createConfluenceSpace(testKey, testName, testDesc);
    console.log("\n>>> SUCCESS! Service call completed.");
    console.log("Returned Confluence Space URL:", spaceUrl);
    console.log("=================================================");
  } catch (err) {
    console.error("\n>>> ERROR: Service call failed unexpectedly!", err.message);
    process.exit(1);
  }
}

verifyConfluenceIntegration();
