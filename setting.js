        import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
        import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

        const firebaseConfig = {
            apiKey: "AIzaSyAu9j3mz53BnTohcQTAOrOMOTFkFMeArYw",
            authDomain: "spotify-74d5c.firebaseapp.com",
            databaseURL: "https://spotify-74d5c-default-rtdb.firebaseio.com",
            projectId: "spotify-74d5c",
            storageBucket: "spotify-74d5c.firebasestorage.app",
            messagingSenderId: "686699469107",
            appId: "1:686699469107:web:cd00609b808f638d0f0646",
            measurementId: "G-3PGWZRDDB5"
        };

        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const auth = getAuth(app);

        // 1. Monitor Auth State
        onAuthStateChanged(auth, (user) => {
            if (user) {
                document.getElementById('user-email').innerText = user.email;
                syncPrivacySettings(user.uid);
            } else {
                document.getElementById('user-email').innerText = "Not logged in";
            }
        });

        // 2. Sync Privacy Status from Firestore
        function syncPrivacySettings(uid) {
            const prefRef = doc(db, "user_preferences", uid);
            onSnapshot(prefRef, (docSnap) => {
                if(docSnap.exists()) {
                    document.getElementById('privacy-toggle').checked = docSnap.data().isPrivate || false;
                }
            });
        }

        // 3. Update Privacy Logic
        window.updatePrivacy = async (val) => {
            const user = auth.currentUser;
            if(!user) return alert("Login required!");
            
            try {
                await setDoc(doc(db, "user_preferences", user.uid), {
                    isPrivate: val
                }, { merge: true });
                console.log("Settings saved!");
            } catch (e) {
                alert("Error: " + e.message);
            }
        };

        // 4. Logout Function
        window.handleLogout = () => {
            if(confirm("Are you sure you want to log out?")) {
                signOut(auth).then(() => {
                    window.location.href = "addaccount.html";
                });
            }
        };
  

    

        // Block right-click completely
        document.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            return false;
        });

        // Block F12, Ctrl+Shift+I, Ctrl+Shift+C, Ctrl+U, Ctrl+S, Ctrl+Shift+J, Cmd+Option+I (Mac)
        document.addEventListener('keydown', function(e) {
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
            // Cmd+Option+I on Mac (key 73)
            if (e.metaKey && e.altKey && key === 73) {
                e.preventDefault();
                return false;
            }
            // Disable PrintScreen (optional)
            if (key === 44) {
                e.preventDefault();
                return false;
            }
            return true;
        });

        // Optional: disable text selection (helps against copying)
        document.addEventListener('selectstart', function(e) {
            e.preventDefault();
            return false;
        });
        // Disable drag and drop of images (optional)
        document.addEventListener('dragstart', function(e) {
            e.preventDefault();
            return false;
        });
