const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const getBookStackBaseUrl = () => process.env.BOOKSTACK_BASE_URL || "http://localhost:8082";
const getBookStackTokenId = () => process.env.BOOKSTACK_TOKEN_ID || "";
const getBookStackTokenSecret = () => process.env.BOOKSTACK_TOKEN_SECRET || "";

const getHeaders = () => {
  const tokenId = getBookStackTokenId();
  const tokenSecret = getBookStackTokenSecret();
  return {
    'Authorization': `Token ${tokenId}:${tokenSecret}`,
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  };
};

const hasBookStack = () => !!(getBookStackTokenId() && getBookStackTokenSecret());

/**
 * Creates a BookStack Book to serve as the project's documentation workspace.
 * 
 * @param {string} key - Project or workspace identifier key
 * @param {string} name - Friendly name of the documentation book
 * @param {string} description - Brief description of the documentation workspace
 * @returns {Promise<string>} The URL of the created BookStack Book
 */
async function createBookStackWorkspace(key, name, description = "") {
  const base = getBookStackBaseUrl();
  const slug = (key || "").toLowerCase().replace(/[^a-z0-9]/g, '');

  if (!hasBookStack()) {
    console.warn("[BookStack] Token credentials not set. Returning mock workspace URL.");
    return `${base}/books/${slug || 'project-docs'}`;
  }

  const payload = {
    name: name || `Project documentation ${key}`,
    description: description.slice(0, 255) || `Auto-provisioned documentation workspace for project ${name}`
  };

  try {
    console.log(`[BookStack] Provisioning workspace book: "${payload.name}"`);
    const res = await axios.post(`${base}/api/books`, payload, { headers: getHeaders(), timeout: 8000 });
    if (res.data && res.data.slug) {
      console.log(`[BookStack] Workspace Book successfully created: ${res.data.slug}`);
      // BookStack returns item URL as 'url' or can construct it as /books/slug
      return res.data.url || `${base}/books/${res.data.slug}`;
    }
    return `${base}/books/${slug}`;
  } catch (err) {
    console.error(`[BookStack] Failed to create workspace (Status: ${err.response?.status}).`, err.response?.data || err.message);
    // Return standard fallback URL so flow remains uninterrupted
    return `${base}/books/${slug}`;
  }
}

module.exports = {
  createBookStackWorkspace,
  getBookStackBaseUrl
};
