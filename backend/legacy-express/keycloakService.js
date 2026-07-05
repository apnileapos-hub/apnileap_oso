const axios = require('axios');
const qs = require('qs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const getKeycloakBaseUrl = () => process.env.KEYCLOAK_BASE_URL || "http://localhost:8081";
const getAdminUser = () => process.env.KEYCLOAK_ADMIN_USER || "admin";
const getAdminPassword = () => process.env.KEYCLOAK_ADMIN_PASSWORD || "admin";

const hasKeycloak = () => !!(process.env.KEYCLOAK_BASE_URL && process.env.KEYCLOAK_ADMIN_USER);

// Helper: Fetch Keycloak Master Realm Admin access token
async function getAdminToken() {
  const base = getKeycloakBaseUrl();
  const payload = {
    client_id: 'admin-cli',
    username: getAdminUser(),
    password: getAdminPassword(),
    grant_type: 'password'
  };

  try {
    const res = await axios.post(
      `${base}/realms/master/protocol/openid-connect/token`,
      qs.stringify(payload),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 5000
      }
    );
    return res.data.access_token;
  } catch (err) {
    console.error("[Keycloak] Failed to acquire admin access token:", err.response?.data || err.message);
    throw err;
  }
}

// Create new Keycloak Realm for Tenant
async function createKeycloakRealm(realmName, displayName) {
  if (!hasKeycloak()) {
    console.warn("[Keycloak] Admin settings not configured. Skipping realm creation.");
    return { success: true, mock: true };
  }

  const base = getKeycloakBaseUrl();
  const cleanRealmName = realmName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  try {
    const token = await getAdminToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const payload = {
      realm: cleanRealmName,
      displayName: displayName || `APNILEAP Realm ${realmName}`,
      enabled: true
    };

    console.log(`[Keycloak] Provisioning realm: "${cleanRealmName}"`);
    await axios.post(`${base}/admin/realms`, payload, { headers, timeout: 8000 });
    console.log(`[Keycloak] Realm "${cleanRealmName}" created successfully.`);
    return { success: true, realmName: cleanRealmName };
  } catch (err) {
    if (err.response?.status === 409) {
      console.log(`[Keycloak] Realm "${cleanRealmName}" already exists.`);
      return { success: true, realmName: cleanRealmName };
    }
    console.error(`[Keycloak] Realm "${cleanRealmName}" creation failed:`, err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

// Create Group in Realm
async function createKeycloakGroup(realmName, groupName) {
  if (!hasKeycloak()) return { success: true, mock: true };

  const base = getKeycloakBaseUrl();
  try {
    const token = await getAdminToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    console.log(`[Keycloak] Provisioning group: "${groupName}" in realm: "${realmName}"`);
    await axios.post(
      `${base}/admin/realms/${realmName}/groups`,
      { name: groupName },
      { headers, timeout: 8000 }
    );
    return { success: true };
  } catch (err) {
    if (err.response?.status === 409) {
      console.log(`[Keycloak] Group "${groupName}" already exists in realm "${realmName}".`);
      return { success: true };
    }
    console.error(`[Keycloak] Group creation failed in realm "${realmName}":`, err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

// Provision User in Keycloak Realm
async function createKeycloakUser(realmName, user) {
  if (!hasKeycloak()) return { success: true, mock: true };

  const base = getKeycloakBaseUrl();
  try {
    const token = await getAdminToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const names = (user.name || "").split(/\s+/);
    const firstName = names[0] || "";
    const lastName = names.slice(1).join(" ") || "";

    const payload = {
      username: user.email.toLowerCase().trim(),
      email: user.email.toLowerCase().trim(),
      firstName: firstName,
      lastName: lastName,
      enabled: true,
      credentials: [
        {
          type: "password",
          value: user.password || "Admin@123",
          temporary: false
        }
      ]
    };

    console.log(`[Keycloak] Provisioning user: "${payload.username}" in realm: "${realmName}"`);
    await axios.post(
      `${base}/admin/realms/${realmName}/users`,
      payload,
      { headers, timeout: 8000 }
    );
    return { success: true };
  } catch (err) {
    if (err.response?.status === 409) {
      console.log(`[Keycloak] User already exists in realm "${realmName}".`);
      return { success: true };
    }
    console.error(`[Keycloak] User provisioning failed in realm "${realmName}":`, err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  createKeycloakRealm,
  createKeycloakGroup,
  createKeycloakUser,
  getKeycloakBaseUrl
};
