 import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
        import { getFirestore, collection, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

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
        const updatesCol = collection(db, "app_updates");

        // Real-time Fetching Updates
        const q = query(updatesCol, orderBy("timestamp", "desc"));

        onSnapshot(q, (snapshot) => {
            const container = document.getElementById('updates-container');
            container.innerHTML = '';

            if (snapshot.empty) {
                container.innerHTML = `<div class="text-center py-20 opacity-30 font-bold uppercase tracking-widest text-xs">No updates yet</div>`;
                return;
            }

            snapshot.forEach((doc) => {
                const data = doc.data();
                const timeStr = new Date(data.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

                container.innerHTML += `
                    <div class="update-card p-6 rounded-[2rem] relative overflow-hidden">
                        <div class="flex items-center gap-2 mb-3">
                            <div class="glow-dot"></div>
                            <span class="text-[10px] font-black uppercase tracking-widest text-[#1DB954]">Official Update</span>
                        </div>
                        <p class="text-base font-bold leading-relaxed text-zinc-100">${data.message}</p>
                        <div class="mt-4 flex justify-between items-center">
                            <span class="text-[10px] font-bold text-zinc-500 uppercase">${timeStr}</span>
                            <div class="w-6 h-6 bg-white/5 rounded-full flex items-center justify-center">
                                <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
                            </div>
                        </div>
                    </div>
                `;
            });
        });
    
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