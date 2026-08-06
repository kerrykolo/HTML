// \testing — MOCK MSAL.js. Implements the same interface app.js calls
// (PublicClientApplication with initialize/loginRedirect/logoutRedirect/
// handleRedirectPromise/getAllAccounts/getActiveAccount/setActiveAccount)
// so the exact same app.js code runs against this locally, with zero
// changes needed, and then against the real @azure/msal-browser once you
// have real Azure values.
//
// TO GO LIVE: in index.html and app.html, delete the <script src="msal-mock.js">
// line and uncomment the real MSAL CDN <script> line above it. Nothing in
// app.js needs to change.
//
// To test different roles via app.js's ROLE_MAP fallback: open devtools
// console and run
//   localStorage.setItem('mockTestEmail', 'manager@example.com')
// once, then click Sign In as usual — it'll keep using that email until
// you change or clear it. Defaults to you@example.com if never set.
//
// To test the real-Entra-App-Roles path instead (bypassing ROLE_MAP
// entirely, same as resolveRole() will do once Dinesh's team configures
// real App Roles), run
//   localStorage.setItem('mockRoles', 'manager')
// (comma-separate for multiple roles). Clear it with
// localStorage.removeItem('mockRoles') to fall back to ROLE_MAP again.
//
// (Uses localStorage, not a URL query param, because some static file
// servers — including local `serve` — redirect *.html URLs to a clean
// path and drop query strings in the process.)

(function () {
  const CACHE_KEY = 'mockMsalAccount';
  const PENDING_KEY = 'mockMsalPendingLogin';

  function mockRolesFromStorage() {
    const raw = localStorage.getItem('mockRoles');
    if (!raw) return undefined;
    return raw.split(',').map((r) => r.trim()).filter(Boolean);
  }

  function makeAccount(email, roles) {
    const localId = '00000000-0000-0000-0000-000000000000';
    return {
      homeAccountId: `${localId}.mock-tenant`,
      environment: 'login.windows.net',
      tenantId: 'mock-tenant',
      username: email,
      localAccountId: localId,
      name: email.split('@')[0],
      // Mirrors the real AccountInfo shape — resolveRole() in app.js
      // reads idTokenClaims.roles here, same as it would from a real
      // Entra App Roles-enabled token.
      idTokenClaims: {
        preferred_username: email,
        name: email.split('@')[0],
        tid: 'mock-tenant',
        ...(roles ? { roles } : {}),
      },
    };
  }

  function makeAuthResult(account) {
    return {
      accessToken: 'mock-access-token',
      idToken: 'mock-id-token',
      authority: 'https://login.microsoftonline.com/mock-tenant/',
      tenantId: account.tenantId,
      uniqueId: account.localAccountId,
      scopes: ['User.Read'],
      correlationId: 'mock-correlation-id',
      expiresOn: new Date(Date.now() + 3600 * 1000),
      fromCache: false,
      tokenType: 'Bearer',
      idTokenClaims: account.idTokenClaims,
      account,
    };
  }

  class MockPublicClientApplication {
    constructor(config) {
      this.config = config;
      this._activeAccount = null;
    }

    async initialize() {
      return Promise.resolve();
    }

    async loginRedirect() {
      // Always stays on the current site/origin for local testing —
      // deliberately ignores config.auth.redirectUri (which points at
      // wherever this is actually deployed) so testing never leaves
      // localhost, no matter what production value is configured there.
      const email = localStorage.getItem('mockTestEmail') || 'you@example.com';
      sessionStorage.setItem(PENDING_KEY, email);
      sessionStorage.setItem(CACHE_KEY, email);
      window.location.href = 'app.html';
    }

    async handleRedirectPromise() {
      const pendingEmail = sessionStorage.getItem(PENDING_KEY);
      if (!pendingEmail) return null;
      sessionStorage.removeItem(PENDING_KEY);
      const account = makeAccount(pendingEmail, mockRolesFromStorage());
      return makeAuthResult(account);
    }

    getAllAccounts() {
      // Rebuilds the account (with fresh roles) on every call, so changing
      // localStorage.mockRoles + reloading reflects immediately — no need
      // to sign out/in again to test a different role.
      const email = sessionStorage.getItem(CACHE_KEY);
      return email ? [makeAccount(email, mockRolesFromStorage())] : [];
    }

    getActiveAccount() {
      return this._activeAccount || this.getAllAccounts()[0] || null;
    }

    setActiveAccount(account) {
      this._activeAccount = account;
    }

    logoutRedirect() {
      // Same reasoning as loginRedirect() above — always local, ignores
      // any configured postLogoutRedirectUri.
      sessionStorage.removeItem(CACHE_KEY);
      sessionStorage.removeItem(PENDING_KEY);
      this._activeAccount = null;
      window.location.href = 'index.html';
    }
  }

  window.msal = { PublicClientApplication: MockPublicClientApplication };
})();
