// ──────────────────────────────────────────────
//  Spotifree – Authentication & Protection Logic
// ──────────────────────────────────────────────

// ─── toggle between login / signup ───
window.toggleAuth = (mode) => {
    const loginSection = document.getElementById('login-section');
    const signupSection = document.getElementById('signup-section');
    const subtitle = document.getElementById('auth-subtitle');

    if (mode === 'signup') {
        loginSection.classList.add('hidden');
        signupSection.classList.remove('hidden');
        subtitle.innerText = 'Sign up for free to start listening.';
    } else {
        loginSection.classList.remove('hidden');
        signupSection.classList.add('hidden');
        subtitle.innerText = 'Log in to start listening.';
    }
};

// ─── Firebase imports ───
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import {
    getFirestore,
    doc,
    setDoc
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

// ─── Firebase config ───
const firebaseConfig = {
    apiKey: 'AIzaSyAu9j3mz53BnTohcQTAOrOMOTFkFMeArYw',
    authDomain: 'spotify-74d5c.firebaseapp.com',
    databaseURL: 'https://spotify-74d5c-default-rtdb.firebaseio.com',
    projectId: 'spotify-74d5c',
    storageBucket: 'spotify-74d5c.firebasestorage.app',
    messagingSenderId: '686699469107',
    appId: '1:686699469107:web:cd00609b808f638d0f0646',
    measurementId: 'G-3PGWZRDDB5'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ─── SIGNUP handler ───
window.handleSignup = async () => {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const pass = document.getElementById('signup-pass').value;

    if (!name || !email || !pass) return alert('Please fill all fields!');
    if (pass.length < 6) return alert('Password must be at least 6 characters!');

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        const user = userCredential.user;

        await setDoc(doc(db, 'user_profile', user.uid), {
            name: name,
            email: email,
            followers: 0,
            following: 0,
            joinedAt: new Date().getTime()
        });

        alert('Welcome to Spotifree, ' + name + '!');
        window.location.href = 'index.html';
    } catch (err) {
        alert('Signup Error: ' + err.message);
    }
};

// ─── LOGIN handler ───
window.handleLogin = async () => {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;

    if (!email || !pass) return alert('Please fill details.');

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        alert('Login Successful!');
        window.location.href = 'index.html';
    } catch (err) {
        alert('Invalid credentials! ' + err.message);
    }
};

// ──────────────────────────────────────────────
//  PROTECTION – block right‑click & dev tools
// ──────────────────────────────────────────────

// Block right‑click
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
});

// Block F12, Ctrl+Shift+I/C/J, Ctrl+U, Ctrl+S, Cmd+Option+I, PrintScreen
document.addEventListener('keydown', (e) => {
    const key = e.keyCode || e.which;

    // F12
    if (key === 123) {
        e.preventDefault();
        return false;
    }
    // Ctrl+Shift+I (73), Ctrl+Shift+J (74), Ctrl+Shift+C (67)
    if (e.ctrlKey && e.shiftKey && (key === 73 || key === 74 || key === 67)) {
        e.preventDefault();
        return false;
    }
    // Ctrl+U (85), Ctrl+S (83)
    if (e.ctrlKey && (key === 85 || key === 83)) {
        e.preventDefault();
        return false;
    }
    // Cmd+Option+I (Mac)
    if (e.metaKey && e.altKey && key === 73) {
        e.preventDefault();
        return false;
    }
    // PrintScreen (44)
    if (key === 44) {
        e.preventDefault();
        return false;
    }
    return true;
});

// Disable text selection & drag (makes copying harder)
document.addEventListener('selectstart', (e) => e.preventDefault());
document.addEventListener('dragstart', (e) => e.preventDefault());