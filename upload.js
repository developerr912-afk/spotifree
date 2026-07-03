 import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
        import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, where } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

        // Firebase config (unchanged)
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
        const songsCol = collection(db, "songs");

        // ========== CLOUDINARY CONFIGURATION ==========
        // REPLACE WITH YOUR ACTUAL CLOUDINARY DETAILS
        const CLOUDINARY_CLOUD_NAME = "du9nysbwl";  // Your cloud name
        // You MUST create an unsigned upload preset in Cloudinary dashboard:
        // Settings → Upload → Upload Presets → Add Upload Preset → Signing Mode: Unsigned
        const CLOUDINARY_UPLOAD_PRESET = "Spotifreebyadmin";  // <-- CHANGE THIS to your preset name
        // =============================================

        // Helper: Upload a file to Cloudinary
        async function uploadToCloudinary(file, resourceType = "auto") {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
            formData.append("folder", "spotifree_songs");  // optional folder

            const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`;

            const response = await fetch(url, {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Upload failed (${response.status})`);
            }

            const data = await response.json();
            return data.secure_url;  // CDN URL
        }

        // Session handling
        let sessionId = localStorage.getItem('user_session_id');
        if (!sessionId) {
            sessionId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
            localStorage.setItem('user_session_id', sessionId);
        }

        function showToast(msg, isError = false) {
            const existing = document.querySelector('.toast-msg');
            if(existing) existing.remove();
            const toast = document.createElement('div');
            toast.className = `toast-msg ${isError ? 'toast-error' : ''}`;
            toast.innerText = msg;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3500);
        }

        // 🔥 MODIFIED: Only show songs uploaded by this session (current user)
        const q = query(songsCol, where("sessionId", "==", sessionId), orderBy("createdAt", "desc"));
        onSnapshot(q, (snapshot) => {
            const container = document.getElementById('songsLibrary');
            if (snapshot.empty) {
                container.innerHTML = `<div class="text-center py-12 text-zinc-500 text-sm">✨ You haven't uploaded any songs yet. Be the first! ✨</div>`;
                return;
            }
            let html = '';
            snapshot.forEach(docSnap => {
                const s = docSnap.data();
                const docId = docSnap.id;
                // Since we filter by sessionId, all shown songs belong to current user
                html += `
                    <div class="song-card glass-card p-4 rounded-xl flex gap-3 items-center border border-white/5 hover:border-[#1DB954]/40 transition-all">
                        <img src="${s.image || 'https://placehold.co/100x100/1a1a1a/1DB954?text=🎵'}" class="w-12 h-12 rounded-lg object-cover shadow-md" onerror="this.src='https://placehold.co/100x100/1a1a1a/1DB954?text=🎵'">
                        <div class="flex-1 min-w-0">
                            <h4 class="font-bold text-sm truncate">${escapeHtml(s.title)}</h4>
                            ${s.keywords ? `<p class="text-[9px] text-zinc-500 truncate">#${escapeHtml(s.keywords)}</p>` : ''}
                            <audio controls class="w-32 md:w-44 h-6 mt-1" style="border-radius: 30px;">
                                <source src="${s.link}" type="audio/mpeg">
                            </audio>
                        </div>
                        <button onclick="deleteSong('${docId}')" class="delete-btn p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition">
                            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                    </div>
                `;
            });
            container.innerHTML = html;
        });

        function escapeHtml(str) { return String(str).replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]); }

        window.deleteSong = async (docId) => {
            if (confirm("⚠️ Delete this song permanently? It will be removed from the main app.")) {
                try {
                    await deleteDoc(doc(db, "songs", docId));
                    showToast("Song deleted from library");
                } catch (err) {
                    console.error(err);
                    showToast("Failed to delete", true);
                }
            }
        };

        // Preview handlers
        const audioInput = document.getElementById('audioFile');
        const coverInput = document.getElementById('coverImage');
        const audioPreviewName = document.getElementById('audioPreviewName');
        const audioPreviewContainer = document.getElementById('audioPreviewContainer');
        const coverPreviewName = document.getElementById('coverPreviewName');
        const coverPreviewContainer = document.getElementById('coverPreviewContainer');

        audioInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                audioPreviewName.innerText = `🎵 ${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`;
                const blobUrl = URL.createObjectURL(file);
                audioPreviewContainer.innerHTML = `<audio controls class="preview-audio"><source src="${blobUrl}" type="${file.type}"></audio>`;
                setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
            } else {
                audioPreviewName.innerText = '';
                audioPreviewContainer.innerHTML = '';
            }
        });

        coverInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                coverPreviewName.innerText = `🖼️ ${file.name}`;
                const blobUrl = URL.createObjectURL(file);
                coverPreviewContainer.innerHTML = `<img src="${blobUrl}" class="preview-img" alt="cover preview">`;
                setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
            } else {
                coverPreviewName.innerText = '';
                coverPreviewContainer.innerHTML = '';
            }
        });

        // Upload button with Cloudinary
        const uploadBtn = document.getElementById('uploadBtn');
        uploadBtn.addEventListener('click', async () => {
            const title = document.getElementById('songTitle').value.trim();
            const keywords = document.getElementById('keywords').value.trim();
            const audioFile = audioInput.files[0];
            const coverFile = coverInput.files[0];

            if (!title) return showToast('❌ Song Title required', true);
            if (!audioFile) return showToast('❌ Please select an audio file', true);

            // Disable button and show loader
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = '<div class="btn-loader"><span class="spinner"></span> Uploading to Spotifree...</div>';
            uploadBtn.classList.add('opacity-70', 'cursor-not-allowed');

            try {
                // 1. Upload audio to Cloudinary
                let audioUrl = await uploadToCloudinary(audioFile, "auto");
                
                // 2. Upload cover if present, else use default
                let coverUrl = null;
                if (coverFile) {
                    coverUrl = await uploadToCloudinary(coverFile, "image");
                }
                const finalCover = coverUrl || "https://placehold.co/400x400/1a1a1a/1DB954?text=🎵";
                
                // 3. Save to Firestore
                await addDoc(songsCol, {
                    title, 
                    keywords: keywords ? keywords.toLowerCase() : '',
                    image: finalCover,
                    link: audioUrl,
                    createdAt: Date.now(),
                    sessionId
                });
                
                // Reset form
                document.getElementById('songTitle').value = '';
                document.getElementById('keywords').value = '';
                audioInput.value = '';
                coverInput.value = '';
                audioPreviewName.innerText = '';
                audioPreviewContainer.innerHTML = '';
                coverPreviewName.innerText = '';
                coverPreviewContainer.innerHTML = '';
                
                showToast(`✅ "${title}" added to the global library!`);
            } catch (err) {
                console.error(err);
                showToast(`❌ Upload failed: ${err.message}`, true);
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = 'Add To Spotifree';
                uploadBtn.classList.remove('opacity-70', 'cursor-not-allowed');
            }
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