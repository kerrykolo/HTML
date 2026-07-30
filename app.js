// \testing — sessionStorage stand-in for a real MSAL account object.
const MOCK_USER_KEY = 'mockUser';

const signInBtn = document.getElementById('sign-in-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const profileTrigger = document.getElementById('profile-trigger');
const profileDropdown = document.getElementById('profile-dropdown');
const avatarInitial = document.getElementById('avatar-initial');
const avatarInitialLg = document.getElementById('avatar-initial-lg');
const dropdownEmail = document.getElementById('dropdown-email');

function signIn() {
  //testing 
  sessionStorage.setItem(MOCK_USER_KEY, 'you@example.com');
  window.location.href = 'app.html';
}

function signOut() {
  //testing
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
