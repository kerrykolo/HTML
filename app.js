// testing
const MOCK_USER_KEY = 'mockUser';

const signInBtn = document.getElementById('sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const emailInput = document.getElementById('email-input');
const profileTrigger = document.getElementById('profile-trigger');
const profileDropdown = document.getElementById('profile-dropdown');
const avatarInitial = document.getElementById('avatar-initial');
const avatarInitialLg = document.getElementById('avatar-initial-lg');
const dropdownEmail = document.getElementById('dropdown-email');

function signIn() {
  // MSAL.js
  // The temporary mock sign-in page.
  if (!emailInput) {
    window.location.href = 'mock-signin.html';
    return;
  }

  // testing
  const email = emailInput.value.trim();
  if (!email) {
    alert('Enter an email to continue.');
    return;
  }
  sessionStorage.setItem(MOCK_USER_KEY, email);
  window.location.href = 'app.html';
}

function signOut() {
  //testing — replace with msalInstance.logoutPopup()/logoutRedirect() in Step 2.
  sessionStorage.removeItem(MOCK_USER_KEY);
  window.location.href = 'index.html';
}

if (signInBtn) {
  signInBtn.addEventListener('click', signIn);
}

if (signOutBtn) {
  signOutBtn.addEventListener('click', signOut);
}


if (profileDropdown) {
  const email = sessionStorage.getItem(MOCK_USER_KEY);//testing 
  if (!email) {
    window.location.href = 'index.html';
  } else {
    const initial = email.charAt(0).toUpperCase();
    avatarInitial.textContent = initial;
    avatarInitialLg.textContent = initial;
    dropdownEmail.textContent = email;

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
}
