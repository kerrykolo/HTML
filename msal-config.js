// ============================================================
// AZURE / ENTRA ID APP REGISTRATION — this is the ONLY file that needs
// editing once real values arrive from Dinesh's team. Nothing in app.js,
// dashboard.js, or anywhere else needs to change.
//
// Where to find each value: Azure Portal > Microsoft Entra ID >
// App registrations > (your app) > Overview / Authentication.
// ============================================================
const MSAL_CONFIG = {
  auth: {
    clientId: 'YOUR_CLIENT_ID_HERE', // <-- REPLACE: "Application (client) ID" on the Overview page
    authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID_HERE', // <-- REPLACE YOUR_TENANT_ID_HERE with "Directory (tenant) ID"
    redirectUri: 'YOUR_REDIRECT_URI_HERE', // <-- REPLACE e.g. 'https://<your-site>.azurestaticapps.net/app.html' — must exactly match a Redirect URI registered under Authentication (Platform type: Single-page application)
    postLogoutRedirectUri: 'YOUR_POST_LOGOUT_REDIRECT_URI_HERE', // <-- REPLACE e.g. 'https://<your-site>.azurestaticapps.net/index.html'
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

// Scopes requested at sign-in. User.Read is the standard Microsoft Graph
// "read my own basic profile" permission — add more scopes here later if
// a future step needs to call other Graph APIs.
const LOGIN_REQUEST = { scopes: ['User.Read'] };
