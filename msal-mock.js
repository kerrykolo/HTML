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
// To test different roles: open devtools console and run
//   localStorage.setItem('mockTestEmail', 'manager@example.com')
// once, then click Sign In as usual — it'll keep using that email until
// you change or clear it. Defaults to you@example.com if never set.
// (Uses localStorage, not a URL query param, because some static file
// servers — including local `serve` — redirect *.html URLs to a clean
// path and drop query strings in the process.)

(function () {
  const CACHE_KEY = 'mockMsalAccount';
  const PENDING_KEY = 'mockMsalPendingLogin';

  function makeAccount(email) {
    const localId = '00000000-0000-0000-0000-000000000000';
    return {
      homeAccountId: `${localId}.mock-tenant`,
      environment: 'login.windows.net',
      tenantId: 'mock-tenant',
      username: email,
      localAccountId: localId,
      name: email.split('@')[0],
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
      idTokenClaims: {
        preferred_username: account.username,
        name: account.name,
        tid: account.tenantId,
      },
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
      window.location.href = 'app.html';
    }

    async handleRedirectPromise() {
      const pendingEmail = sessionStorage.getItem(PENDING_KEY);
      if (!pendingEmail) return null;
      sessionStorage.removeItem(PENDING_KEY);
      const account = makeAccount(pendingEmail);
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(account));
      return makeAuthResult(account);
    }

    getAllAccounts() {
      const stored = sessionStorage.getItem(CACHE_KEY);
      return stored ? [JSON.parse(stored)] : [];
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
