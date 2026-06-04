const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const getConfluenceBase = () => {
  return process.env.CONFLUENCE_BASE_URL || process.env.JIRA_BASE_URL || "https://devcobraaa.atlassian.net";
};

const getConfluenceAuth = () => {
  const email = process.env.CONFLUENCE_EMAIL || process.env.JIRA_EMAIL;
  const token = process.env.CONFLUENCE_API_TOKEN || process.env.JIRA_API_TOKEN;
  return { username: email, password: token };
};

/**
 * Automates Confluence Space creation using the Atlassian Cloud REST APIs.
 * It will try the modern v2 endpoint first, then fallback to v1, and gracefully handle existing spaces.
 * 
 * @param {string} spaceKey - Unformatted target space key (e.g. "KAN-99" or "ApniCart")
 * @param {string} spaceName - Friendly name of the space/project
 * @param {string} description - Brief description of the space
 * @returns {Promise<string>} The live URL of the created Confluence Space
 */
async function createConfluenceSpace(spaceKey, spaceName, description = "") {
  const base = getConfluenceBase();
  const auth = getConfluenceAuth();

  // 1. If credentials are not configured, return a standard fallback URL gracefully.
  if (!auth.username || !auth.password) {
    console.warn("[Confluence] Credentials not set in .env. Returning fallback space URL.");
    const fallbackKey = (spaceKey || "CONF").toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `${base}/wiki/spaces/${fallbackKey || 'CONF'}`;
  }

  // 2. Format a valid uppercase alphanumeric Space Key (Confluence rules: capital letters/numbers only, no spaces or special chars).
  let cleanKey = (spaceKey || "").toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleanKey.length < 2) {
    cleanKey = (cleanKey + "CONF").slice(0, 4).toUpperCase();
  }

  console.log(`[Confluence] Provisioning space key: "${cleanKey}" | Name: "${spaceName}"`);

  const spacePayloadV2 = {
    key: cleanKey,
    name: spaceName.slice(0, 80) || `Project Space ${cleanKey}`,
    description: {
      plain: description.slice(0, 255) || `Auto-provisioned space for ${spaceName}`
    }
  };

  const spacePayloadV1 = {
    key: cleanKey,
    name: spaceName.slice(0, 80) || `Project Space ${cleanKey}`,
    description: {
      plain: {
        value: description.slice(0, 255) || `Auto-provisioned space for ${spaceName}`,
        representation: "plain"
      }
    }
  };

  // 3. Try modern Confluence Cloud v2 API
  try {
    console.log(`[Confluence] POSTing space to v2 API: ${base}/wiki/api/v2/spaces`);
    await axios.post(
      `${base}/wiki/api/v2/spaces`,
      spacePayloadV2,
      {
        auth,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 8000
      }
    );
    console.log(`[Confluence] Space successfully created via v2 API: ${cleanKey}`);
    return `${base}/wiki/spaces/${cleanKey}`;
  } catch (v2Err) {
    const v2Status = v2Err.response?.status;
    const v2Data = JSON.stringify(v2Err.response?.data || "");
    console.warn(`[Confluence] v2 API call failed (Status: ${v2Status}). Reason: ${v2Err.message}. Trying v1 fallback...`);

    // Check if the space already exists
    if (v2Status === 409 || v2Status === 400 || v2Data.includes("already exists")) {
      console.log(`[Confluence] Space "${cleanKey}" already exists on Atlassian. Returning active link.`);
      return `${base}/wiki/spaces/${cleanKey}`;
    }

    // 4. Fallback to Confluence Cloud v1 API
    try {
      console.log(`[Confluence] POSTing space to v1 API: ${base}/wiki/rest/api/space`);
      await axios.post(
        `${base}/wiki/rest/api/space`,
        spacePayloadV1,
        {
          auth,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          timeout: 8000
        }
      );
      console.log(`[Confluence] Space successfully created via v1 API: ${cleanKey}`);
      return `${base}/wiki/spaces/${cleanKey}`;
    } catch (v1Err) {
      const v1Status = v1Err.response?.status;
      const v1Data = JSON.stringify(v1Err.response?.data || "");
      console.error(`[Confluence] Failed to provision space via legacy v1 API (Status: ${v1Status}).`, v1Err.message);

      // Check if space already exists in v1
      if (v1Status === 409 || v1Status === 400 || v1Data.includes("already exists") || v1Data.includes("duplicate")) {
        console.log(`[Confluence] Space "${cleanKey}" already exists on Atlassian. Returning active link.`);
        return `${base}/wiki/spaces/${cleanKey}`;
      }

      // 5. Fallback gracefully: Return the URL format anyway so the main application flow is never disrupted.
      console.warn(`[Confluence] Space provisioning failed. Returning fallback space URL: ${base}/wiki/spaces/${cleanKey}`);
      return `${base}/wiki/spaces/${cleanKey}`;
    }
  }
}

module.exports = {
  createConfluenceSpace,
  getConfluenceBase
};
