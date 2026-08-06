// MSAL_CONFIG and LOGIN_REQUEST now live in msal-config.js — that's the
// only file that needs editing once real Azure values arrive.

// ============================================================
// ROLE MAPPING — placeholder emails, edit freely.
// Add real users' emails here and assign them a role; anyone signed in
// who isn't listed falls back to DEFAULT_ROLE.
//
// This is a stand-in, already prepared to retire itself: resolveRole()
// checks for real Entra ID App Roles first (idTokenClaims.roles) and
// only falls back to this manual table when no App Roles claim exists.
// Once Dinesh's team configures App Roles in Azure Portal > Entra ID >
// App registrations > (your app) > App roles, and assigns users to them,
// this table stops being consulted automatically — no code change needed.
// ============================================================
const ROLE_MAP = {
  'manager@example.com': 'manager',
  'operator@example.com': 'operator',
  'basic@example.com': 'basic',
};
const DEFAULT_ROLE = 'basic';

function resolveRole(account) {
  const claims = account.idTokenClaims || {};
  if (Array.isArray(claims.roles) && claims.roles.length > 0) {
    return claims.roles[0]; // Real Entra App Roles — takes priority once configured.
  }
  const email = account.username;
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
  const role = resolveRole(account);
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
