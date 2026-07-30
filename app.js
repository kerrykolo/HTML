// ============================================================
// AZURE AD B2C / MSAL.JS CONFIGURATION
// ============================================================
const MSAL_CONFIG = {
  auth: {
    clientId: 'YOUR_CLIENT_ID_HERE', // <-- REPLACE YOUR_CLIENT_ID_HERE with "Application (client) ID"
    authority: 'https://login.microsoftonline.com/YOUR_TENANT_ID_HERE', // <-- REPLACE YOUR_TENANT_ID_HERE with "Directory (tenant) ID"
    redirectUri: 'https://kerrykolo.github.io/HTML/app.html', // <-- REPLACE YOUR_REDIRECT_URI_HERE with the same value as in Azure Portal > Authentication > Redirect URIs
    postLogoutRedirectUri: 'https://kerrykolo.github.io/HTML/index.html', // <-- REPLACE YOUR_POST_LOGOUT_REDIRECT_URI_HERE with the same value as redirectUri
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

// ============================================================
// ROLE MAPPING — placeholder emails, edit freely.
// Add real users' emails here and assign them a role; anyone signed in
// who isn't listed falls back to DEFAULT_ROLE.
// ============================================================
const ROLE_MAP = {
  'manager@example.com': 'manager',
  'operator@example.com': 'operator',
  'basic@example.com': 'basic',
};
const DEFAULT_ROLE = 'basic';

function resolveRole(email) {
  return ROLE_MAP[(email || '').toLowerCase()] || DEFAULT_ROLE;
}

const msalInstance = new msal.PublicClientApplication(MSAL_CONFIG);

const signInBtn = document.getElementById('sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const profileTrigger = document.getElementById('profile-trigger');
const profileDropdown = document.getElementById('profile-dropdown');
const avatarInitial = document.getElementById('avatar-initial');
const avatarInitialLg = document.getElementById('avatar-initial-lg');
const dropdownEmail = document.getElementById('dropdown-email');
const dropdownRole = document.getElementById('dropdown-role');

function signIn() {
  // Full-page redirect to login.microsoftonline.com — nothing after this
  // call runs; the browser navigates away and comes back to redirectUri
  // once sign-in completes.
  msalInstance.loginRedirect(LOGIN_REQUEST);
}

function signOut() {
  const account = msalInstance.getActiveAccount();
  msalInstance.logoutRedirect({ account });
}

function renderSignedInUI(account) {
  // account.username is the account's UPN/email for work & school accounts.
  const email = account.username;
  const role = resolveRole(email);
  const initial = (email.charAt(0) || '?').toUpperCase();

  avatarInitial.textContent = initial;
  avatarInitialLg.textContent = initial;
  dropdownEmail.textContent = email;
  dropdownRole.textContent = role;

  profileTrigger.addEventListener('click', (event) => {
    event.stopPropagation();
    profileDropdown.classList.toggle('hidden');
  });

  document.addEventListener('click', (event) => {
    if (!profileDropdown.contains(event.target)) {
      profileDropdown.classList.add('hidden');
    }
  });
}

async function initAuth() {
  await msalInstance.initialize();

  // Completes the sign-in if we just got redirected back from Microsoft;
  // resolves to null on a normal page load with no pending redirect.
  const redirectResult = await msalInstance.handleRedirectPromise();
  const account = redirectResult ? redirectResult.account : msalInstance.getAllAccounts()[0];

  if (account) {
    msalInstance.setActiveAccount(account);
  }

  if (signInBtn) {
    signInBtn.addEventListener('click', signIn);
  }

  if (signOutBtn) {
    signOutBtn.addEventListener('click', signOut);
  }

  // app.html only: show the signed-in user's info, or bounce back to the
  // landing page if nobody's signed in.
  if (profileDropdown) {
    if (!account) {
      window.location.href = 'index.html';
      return;
    }
    renderSignedInUI(account);
  }
}

initAuth();
