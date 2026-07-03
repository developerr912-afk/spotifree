// ─── Firebase Imports ───
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    onSnapshot,
    deleteDoc,
    doc,
    updateDoc,
    query,
    orderBy,
    getDocs,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// ─── Firebase Config ───
const firebaseConfig = {
    apiKey: "AIzaSyAu9j3mz53BnTohcQTAOrOMOTFkFMeArYw",
    authDomain: "spotify-74d5c.firebaseapp.com",
    projectId: "spotify-74d5c",
    storageBucket: "spotify-74d5c.firebasestorage.app",
    messagingSenderId: "686699469107",
    appId: "1:686699469107:web:cd00609b808f638d0f0646"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const songsCol = collection(db, "songs");
const artistProfilesCol = collection(db, "artist_profiles");
const usersProfilesCol = collection(db, "user_profile");
const playlistsCol = collection(db, "admin_playlists");

// ─── Cloudinary Upload ───
const CLOUDINARY_CLOUD_NAME = "du9nysbwl";
const CLOUDINARY_UPLOAD_PRESET = "Spotifreebyadmin";
async function uploadToCloudinary(file, resourceType = "auto") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", "spotifree");
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, { method: "POST", body: formData });
    if (!response.ok) throw new Error("Cloudinary upload failed");
    return (await response.json()).secure_url;
}

// ─── Helper ───
function escapeHtml(str) { return String(str).replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m]); }

// ─── Songs Management ───
const audioFileInput = document.getElementById('audioFileInput');
const imageFileInput = document.getElementById('imageFileInput');
const audioPreviewContainer = document.getElementById('audioPreviewContainer');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const audioFileNamePreview = document.getElementById('audioFileNamePreview');
const imageFileNamePreview = document.getElementById('imageFileNamePreview');

audioFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        audioFileNamePreview.innerHTML = `🎵 ${file.name} (ready)`;
        const blobUrl = URL.createObjectURL(file);
        audioPreviewContainer.innerHTML = `<audio controls class="preview-audio"><source src="${blobUrl}" type="${file.type}"></audio>`;
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } else { audioFileNamePreview.innerHTML = ''; audioPreviewContainer.innerHTML = ''; }
});
imageFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        imageFileNamePreview.innerHTML = `🖼️ ${file.name} (ready)`;
        const blobUrl = URL.createObjectURL(file);
        imagePreviewContainer.innerHTML = `<img src="${blobUrl}" class="preview-img" alt="preview">`;
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } else { imageFileNamePreview.innerHTML = ''; imagePreviewContainer.innerHTML = ''; }
});

const addBtn = document.getElementById('add-song-btn');
addBtn.onclick = async () => {
    const title = document.getElementById('song-title').value.trim();
    const artist = document.getElementById('song-artist').value.trim();
    const keywords = document.getElementById('song-keywords').value.trim();
    const manualAudio = document.getElementById('song-link').value.trim();
    const manualImage = document.getElementById('song-image').value.trim();
    const audioFile = audioFileInput.files[0];
    const imageFile = imageFileInput.files[0];
    if (!title || !artist) return alert("Title & Artist required");
    if (!audioFile && !manualAudio) return alert("Audio file or URL required");
    addBtn.disabled = true; addBtn.innerHTML = '⏳ Uploading...';
    try {
        let finalAudio = manualAudio, finalImage = manualImage;
        if (audioFile) finalAudio = await uploadToCloudinary(audioFile, "auto");
        if (imageFile) finalImage = await uploadToCloudinary(imageFile, "image");
        if (!finalImage) finalImage = "https://placehold.co/400x400/111111/1DB954?text=SPOTIFREE";
        await addDoc(songsCol, { title, artist, keywords: keywords.toLowerCase(), image: finalImage, link: finalAudio, createdAt: Date.now() });
        alert("Song added!");
        document.getElementById('song-title').value = ''; document.getElementById('song-artist').value = ''; document.getElementById('song-keywords').value = ''; document.getElementById('song-link').value = ''; document.getElementById('song-image').value = ''; audioFileInput.value = ''; imageFileInput.value = ''; audioFileNamePreview.innerHTML = ''; imageFileNamePreview.innerHTML = ''; audioPreviewContainer.innerHTML = ''; imagePreviewContainer.innerHTML = '';
        refreshArtistsList(); renderPlaylistsList();
    } catch(e) { alert("Error: " + e.message); } finally { addBtn.disabled = false; addBtn.innerHTML = '⬆️ Upload to Cloudinary'; }
};

window.openEditModal = (id, title, artist, keywords, image, link) => {
    document.getElementById('edit-song-id').value = id;
    document.getElementById('edit-song-title').value = title;
    document.getElementById('edit-song-artist').value = artist;
    document.getElementById('edit-song-keywords').value = keywords || '';
    document.getElementById('edit-song-image').value = image;
    document.getElementById('edit-song-link').value = link;
    document.getElementById('edit-modal').classList.remove('hidden');
};
window.closeEditModal = () => document.getElementById('edit-modal').classList.add('hidden');
window.saveEditedSong = async () => {
    const id = document.getElementById('edit-song-id').value;
    const data = {
        title: document.getElementById('edit-song-title').value,
        artist: document.getElementById('edit-song-artist').value,
        keywords: document.getElementById('edit-song-keywords').value.toLowerCase(),
        image: document.getElementById('edit-song-image').value,
        link: document.getElementById('edit-song-link').value
    };
    await updateDoc(doc(db, "songs", id), data);
    closeEditModal(); alert("Updated"); refreshArtistsList(); renderPlaylistsList();
};
window.delSong = async (id) => { if(confirm("Delete song?")) { await deleteDoc(doc(db, "songs", id)); refreshArtistsList(); renderPlaylistsList(); } };

// ─── Artists Management ───
async function refreshArtistsList() {
    const songsSnapshot = await getDocs(songsCol);
    const artistsMap = new Map();
    songsSnapshot.forEach(d => { const artist = d.data().artist; if(artist) artistsMap.set(artist, (artistsMap.get(artist)||0)+1); });
    const artistNames = Array.from(artistsMap.keys()).sort();
    if(!artistNames.length) { document.getElementById('artists-list').innerHTML = '<div class="col-span-full text-center py-20 opacity-50">No artists</div>'; return; }
    const profileSnap = await getDocs(artistProfilesCol);
    const profileMap = new Map(); profileSnap.forEach(d => profileMap.set(d.id, d.data().photoURL));
    const container = document.getElementById('artists-list'); container.innerHTML = '';
    for(let artist of artistNames) {
        const photoURL = profileMap.get(artist) || '';
        const safeId = artist.replace(/[^a-zA-Z0-9]/g, '_');
        container.innerHTML += `<div class="glass-card p-5 flex flex-col items-center text-center gap-3 relative"><button onclick="deleteArtistProfile('${artist.replace(/'/g, "\\'")}')" class="absolute top-3 right-3 text-red-500 bg-black/40 rounded-full p-1.5">🗑️</button><div class="artist-avatar" id="avatar-${safeId}">${photoURL ? `<img src="${photoURL}" class="w-full h-full rounded-full object-cover">` : `<span>${artist.charAt(0).toUpperCase()}</span>`}</div><h3 class="font-black text-lg">${escapeHtml(artist)}</h3><p class="text-[10px] text-zinc-500">${artistsMap.get(artist)} tracks</p><label class="upload-artist-img-btn w-full justify-center">Upload Image<input type="file" accept="image/*" style="display:none" onchange="window.uploadArtistPhotoFile('${artist.replace(/'/g, "\\'")}', this)"></label><div class="w-full mt-1"><input type="text" id="url-input-${safeId}" class="url-input-small" placeholder="Image URL" value="${photoURL}"><button onclick="window.setArtistPhotoFromUrl('${artist.replace(/'/g, "\\'")}', document.getElementById('url-input-${safeId}').value)" class="text-[10px] bg-white/10 px-3 py-1 rounded-full mt-2 w-full">Set URL</button></div></div>`;
        if(photoURL) document.getElementById(`avatar-${safeId}`).innerHTML = `<img src="${photoURL}" class="w-full h-full rounded-full object-cover">`;
    }
}
window.deleteArtistProfile = async (artistName) => { if(confirm(`Delete profile for ${artistName}?`)) await deleteDoc(doc(db, "artist_profiles", artistName)); refreshArtistsList(); };
window.uploadArtistPhotoFile = async (artistName, input) => { const file = input.files[0]; if(!file) return; try { const url = await uploadToCloudinary(file, "image"); await setDoc(doc(db, "artist_profiles", artistName), { photoURL: url, updatedAt: Date.now() }, { merge: true }); refreshArtistsList(); } catch(e){ alert("Upload failed"); } finally { input.value = ''; } };
window.setArtistPhotoFromUrl = async (artistName, url) => { if(!url) return; await setDoc(doc(db, "artist_profiles", artistName), { photoURL: url, updatedAt: Date.now() }, { merge: true }); refreshArtistsList(); };

// ─── App Updates ───
document.getElementById('post-update-btn').onclick = async () => { const msg = document.getElementById('update-msg').value; if(msg) { await addDoc(collection(db, "app_updates"), { message: msg, timestamp: Date.now() }); alert("Broadcasted"); document.getElementById('update-msg').value = ''; } };
onSnapshot(query(collection(db, "app_updates"), orderBy("timestamp", "desc")), snap => { const hist = document.getElementById('updates-history'); hist.innerHTML = ''; snap.forEach(d => { hist.innerHTML += `<div class="p-3 bg-white/5 rounded-xl text-xs flex justify-between"><span>${d.data().message}</span><button onclick="window.delUpdate('${d.id}')" class="text-red-500">X</button></div>`; }); });
window.delUpdate = async (id) => { await deleteDoc(doc(db, "app_updates", id)); };

// ─── Users Logs ───
onSnapshot(usersProfilesCol, (snapshot) => {
    const tbody = document.getElementById('users-table-body');
    if (snapshot.empty) { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-10">No users found</td></tr>'; return; }
    let html = '';
    snapshot.forEach(docSnap => {
        const user = docSnap.data();
        const uid = docSnap.id;
        const name = user.name || 'Anonymous';
        const email = user.email || 'No email';
        let joinDate = user.joinedAt ? new Date(user.joinedAt).toLocaleString() : 'Unknown';
        html += `<tr><td class="font-mono text-[11px]">${uid.substring(0,8)}...</td><td class="font-bold">${escapeHtml(name)}</td><td>${escapeHtml(email)}</td><td><span class="badge-date">${joinDate}</span></td><td><button onclick="alert('UID: ${uid}')" class="text-[11px] bg-[#1DB954]/20 px-3 py-1 rounded-full">View</button></td></tr>`;
    });
    tbody.innerHTML = html;
});

// ─── Playlist Feature ───
const allLanguages = ["Hindi","English","Chhattisgarhiya","Marwari","Rajasthani","Gujarati","Bengali","Marathi","Punjabi","Haryanvi"];
let allSongsCache = [];

async function refreshSongsCache() {
    const snap = await getDocs(songsCol);
    allSongsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function renderLanguageCheckboxes(selectedLangs = []) {
    const container = document.getElementById('playlist-languages-group');
    container.innerHTML = '';
    allLanguages.forEach(lang => {
        container.innerHTML += `<label><input type="checkbox" value="${lang}" class="playlist-lang-cb" ${selectedLangs.includes(lang) ? 'checked' : ''}> ${lang}</label>`;
    });
}

function renderSongSelector(selectedSongIds = []) {
    const container = document.getElementById('playlist-songs-selector');
    if (!allSongsCache.length) { container.innerHTML = '<div class="text-center py-4">Loading songs...</div>'; return; }
    container.innerHTML = '';
    allSongsCache.forEach(song => {
        const isSelected = selectedSongIds.includes(song.id);
        const div = document.createElement('div');
        div.className = `playlist-song-item ${isSelected ? 'selected' : ''}`;
        div.innerHTML = `<img src="${song.image}" class="w-10 h-10 rounded-md object-cover"><div class="flex-grow"><div class="font-bold text-sm">${escapeHtml(song.title)}</div><div class="text-[10px] text-zinc-400">${song.artist}</div></div>`;
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'song-select-cb ml-2 accent-[#1DB954]';
        cb.checked = isSelected;
        cb.onclick = (e) => e.stopPropagation();
        div.appendChild(cb);
        div.onclick = () => { cb.checked = !cb.checked; div.classList.toggle('selected'); };
        container.appendChild(div);
    });
}

window.openPlaylistModal = async (playlistId = null) => {
    await refreshSongsCache();
    document.getElementById('playlist-modal').classList.remove('hidden');
    document.getElementById('edit-playlist-id').value = '';
    document.getElementById('playlist-name').value = '';
    document.getElementById('playlist-keywords').value = '';
    renderLanguageCheckboxes([]);
    renderSongSelector([]);
    document.getElementById('playlist-modal-title').innerText = 'Create Playlist';
    if (playlistId) {
        const docSnap = await getDoc(doc(db, "admin_playlists", playlistId));
        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('edit-playlist-id').value = playlistId;
            document.getElementById('playlist-name').value = data.name || '';
            document.getElementById('playlist-keywords').value = (data.keywords || []).join(', ');
            renderLanguageCheckboxes(data.languages || []);
            renderSongSelector(data.songIds || []);
            document.getElementById('playlist-modal-title').innerText = 'Edit Playlist';
        }
    }
};
window.closePlaylistModal = () => document.getElementById('playlist-modal').classList.add('hidden');

document.getElementById('save-playlist-btn').onclick = async () => {
    const playlistId = document.getElementById('edit-playlist-id').value;
    const name = document.getElementById('playlist-name').value.trim();
    if (!name) return alert("Playlist name required");
    const keywordsRaw = document.getElementById('playlist-keywords').value;
    const keywords = keywordsRaw.split(',').map(k=>k.trim().toLowerCase()).filter(k=>k);
    const selectedLangs = Array.from(document.querySelectorAll('#playlist-languages-group input:checked')).map(cb=>cb.value);
    const selectedIds = [];
    document.querySelectorAll('#playlist-songs-selector .song-select-cb:checked').forEach(cb => {
        const item = cb.closest('.playlist-song-item');
        const idx = Array.from(item.parentNode.children).indexOf(item);
        if (allSongsCache[idx]) selectedIds.push(allSongsCache[idx].id);
    });
    const data = { name, keywords, languages: selectedLangs, songIds: selectedIds, updatedAt: Date.now() };
    if (playlistId) await updateDoc(doc(db, "admin_playlists", playlistId), data);
    else await addDoc(playlistsCol, { ...data, createdAt: Date.now() });
    closePlaylistModal();
    renderPlaylistsList();
};

async function renderPlaylistsList() {
    const snap = await getDocs(playlistsCol);
    const container = document.getElementById('playlists-list');
    if (snap.empty) { container.innerHTML = '<div class="col-span-full text-center py-20 opacity-50 font-bold">No playlists yet. Create one.</div>'; return; }
    container.innerHTML = '';
    snap.forEach(docSnap => {
        const p = docSnap.data();
        container.innerHTML += `
            <div class="glass-card p-5 hover:border-[#1DB954]/30 transition-all">
                <div class="flex justify-between items-start"><h3 class="font-black text-lg">${escapeHtml(p.name)}</h3><div class="flex gap-2"><button onclick="openPlaylistModal('${docSnap.id}')" class="p-2 bg-white/10 rounded-full">✏️</button><button onclick="deletePlaylist('${docSnap.id}')" class="p-2 bg-red-500/10 rounded-full text-red-500">🗑️</button></div></div>
                <div class="mt-2 flex flex-wrap gap-1"><span class="text-[10px] bg-white/10 px-2 py-0.5 rounded-full">🎯 ${(p.keywords || []).join(', ') || 'any'}</span><span class="text-[10px] bg-white/10 px-2 py-0.5 rounded-full">🌐 ${(p.languages || []).join(', ') || 'all'}</span></div>
                <p class="text-xs text-zinc-400 mt-3">📀 ${p.songIds?.length || 0} tracks</p>
            </div>`;
    });
}
window.deletePlaylist = async (id) => { if(confirm("Delete this playlist?")) { await deleteDoc(doc(db, "admin_playlists", id)); renderPlaylistsList(); } };

// ─── Real‑time listener for songs ───
onSnapshot(songsCol, (snapshot) => {
    const list = document.getElementById('admin-songs-list');
    list.innerHTML = '';
    if(snapshot.empty){ list.innerHTML = '<div class="py-20 text-center opacity-30">No tracks</div>'; return; }
    snapshot.forEach(docSnap => { const s = docSnap.data(); list.innerHTML += `<div class="glass-card p-4 flex items-center gap-4"><img src="${s.image}" class="w-14 h-14 rounded-xl object-cover"><div class="flex-grow"><div class="font-bold text-sm">${escapeHtml(s.title)}</div><div class="text-[10px] text-[#1DB954]">${escapeHtml(s.artist)}</div></div><div class="flex gap-2"><button onclick="window.openEditModal('${docSnap.id}','${escapeHtml(s.title)}','${escapeHtml(s.artist)}','${s.keywords||''}','${s.image}','${s.link}')" class="p-2.5 bg-white/5 rounded-xl">✏️</button><button onclick="window.delSong('${docSnap.id}')" class="p-2.5 bg-red-500/10 text-red-500 rounded-xl">🗑️</button></div></div>`; });
    refreshArtistsList(); renderPlaylistsList();
});

// ─── Tab Switching ───
window.showTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.add('hidden'));
    document.getElementById('tab-'+tabId).classList.remove('hidden');
    document.querySelectorAll('.sidebar-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('d-btn-'+tabId).classList.add('active');
    document.querySelectorAll('.mobile-nav-item').forEach(i=>i.classList.remove('active'));
    document.getElementById('m-btn-'+tabId).classList.add('active');
    if(tabId === 'artists') refreshArtistsList();
    if(tabId === 'playlists') renderPlaylistsList();
};
window.refreshArtistsList = refreshArtistsList;
showTab('songs');

// ─── PROTECTION (right‑click, dev tools, selection) ───
document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
});
document.addEventListener('keydown', function(e) {
    const key = e.keyCode || e.which;
    if (key === 123) { e.preventDefault(); return false; }
    if (e.ctrlKey && e.shiftKey && (key === 73 || key === 74 || key === 67)) { e.preventDefault(); return false; }
    if (e.ctrlKey && (key === 85 || key === 83)) { e.preventDefault(); return false; }
    if (e.metaKey && e.altKey && key === 73) { e.preventDefault(); return false; }
    if (key === 44) { e.preventDefault(); return false; }
    return true;
});
document.addEventListener('selectstart', function(e) { e.preventDefault(); return false; });
document.addEventListener('dragstart', function(e) { e.preventDefault(); return false; });