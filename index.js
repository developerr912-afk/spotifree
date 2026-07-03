// ─── Firebase Imports ───
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
    getFirestore,
    collection,
    onSnapshot,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-storage.js";

// ─── Firebase Config ───
const firebaseConfig = {
    apiKey: "AIzaSyAu9j3mz53BnTohcQTAOrOMOTFkFMeArYw",
    authDomain: "spotify-74d5c.firebaseapp.com",
    databaseURL: "https://spotify-74d5c-default-rtdb.firebaseio.com",
    projectId: "spotify-74d5c",
    storageBucket: "spotify-74d5c.firebasestorage.app",
    messagingSenderId: "686699469107",
    appId: "1:686699469107:web:cd00609b808f638d0f0646"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const songsCol = collection(db, "songs");

// ─── Global State ───
window.allSongs = [];
window.likedIds = JSON.parse(localStorage.getItem('likedSongs')) || [];
window.userPlaylists = JSON.parse(localStorage.getItem('userPlaylists')) || {};
window.currentIndex = -1;
window.currentFilter = 'all';
window.loopMode = 0;
window.isShuffle = false;
window.currentPlaylistViewName = "";
window.usingPlaylistQueue = false;
window.playlistQueue = [];
window.playlistQueueIndex = 0;
window.originalAllSongs = [];
window.originalPlaylistQueue = [];
let currentUserId = null;
window.userLanguagePrefs = [];

// ─── Helper functions ───
function getLanguagePrefKey() { return `user_languages_${currentUserId}`; }
function loadLanguagePrefs() { if(!currentUserId) return []; const raw = localStorage.getItem(getLanguagePrefKey()); return raw ? JSON.parse(raw) : []; }
function saveLanguagePrefs(langs) { if(currentUserId) localStorage.setItem(getLanguagePrefKey(), JSON.stringify(langs)); window.userLanguagePrefs = langs; window.renderMain(); window.refreshMixesNow(); }
function filterSongsByLanguage(songs) { if(!window.userLanguagePrefs.length) return songs; return songs.filter(s => s.language && window.userLanguagePrefs.includes(s.language)); }

function getKeywordStorageKey() { return `user_keyword_freq_${currentUserId}`; }
function loadKeywordFreq() { if(!currentUserId) return {}; const raw = localStorage.getItem(getKeywordStorageKey()); return raw ? JSON.parse(raw) : {}; }
function saveKeywordFreq() { if(currentUserId) localStorage.setItem(getKeywordStorageKey(), JSON.stringify(window.keywordFreq)); }
window.keywordFreq = loadKeywordFreq();

function getPersonalizedSongs() { 
    let base = window.allSongs;
    base = filterSongsByLanguage(base);
    if(!base.length) return [];
    const total = Object.values(window.keywordFreq || {}).reduce((a,b)=>a+b,0); 
    if(total === 0) return [...base]; 
    const scored = base.map(song => { 
        let score = 0; 
        (song.keywords?.split(',').map(k=>k.trim().toLowerCase()) || []).forEach(kw => { score += (window.keywordFreq[kw] || 0); }); 
        if(window.likedIds.includes(song.id)) score += 5; 
        return { song, score }; 
    }); 
    scored.sort((a,b)=>b.score - a.score); 
    return scored.map(item=>item.song); 
}

// ─── Dynamic Mixes ───
function getTopKeywords(limit=3) {
    return Object.entries(window.keywordFreq).sort((a,b)=>b[1]-a[1]).slice(0,limit).map(([kw])=>kw);
}

function getSongsForMix(keywords, maxSongs=20) {
    if(!window.allSongs.length) return [];
    let filtered = filterSongsByLanguage(window.allSongs);
    let scored = filtered.map(song => {
        let score = 0;
        let kwList = (song.keywords?.toLowerCase() || '').split(',').map(k=>k.trim());
        for(let kw of keywords) {
            if(kwList.includes(kw)) score += 10;
        }
        if(window.likedIds.includes(song.id)) score += 3;
        return { song, score };
    });
    scored = scored.filter(item => item.score > 0);
    if(scored.length === 0 && keywords.length) scored = filtered.map(s=> ({song:s, score:1}));
    scored.sort((a,b)=>b.score - a.score);
    let unique = [];
    let ids = new Set();
    for(let item of scored) {
        if(!ids.has(item.song.id)) {
            ids.add(item.song.id);
            unique.push(item.song);
        }
        if(unique.length >= maxSongs) break;
    }
    return unique.map(s => s.id);
}

function savePlaylistsToLocal() { localStorage.setItem('userPlaylists', JSON.stringify(window.userPlaylists)); }

function generateDailyMix() {
    if(!window.allSongs.length) return;
    const topKeys = getTopKeywords(2);
    const songIds = getSongsForMix(topKeys.length ? topKeys : ['happy', 'chill'], 20);
    window.userPlaylists['_daily_mix'] = songIds;
    localStorage.setItem('last_daily_update', new Date().toDateString());
    savePlaylistsToLocal();
    console.log('Daily mix updated based on:', topKeys);
}

function generateWeeklyMix() {
    if(!window.allSongs.length) return;
    const topKeys = getTopKeywords(3);
    const songIds = getSongsForMix(topKeys.length ? topKeys : ['happy','romantic','energetic'], 25);
    window.userPlaylists['_weekly_mix'] = songIds;
    localStorage.setItem('last_weekly_update', getWeekKey());
    savePlaylistsToLocal();
    console.log('Weekly mix updated');
}

function getWeekKey() { const now = new Date(); const start = new Date(now.getFullYear(), 0, 1); const days = Math.floor((now - start) / (24*60*60*1000)); return `${now.getFullYear()}-W${Math.ceil(days/7)}`; }

function shouldUpdateDaily() {
    const last = localStorage.getItem('last_daily_update');
    return !last || last !== new Date().toDateString();
}
function shouldUpdateWeekly() {
    const last = localStorage.getItem('last_weekly_update');
    return !last || last !== getWeekKey();
}

window.refreshMixesNow = function() {
    generateDailyMix();
    generateWeeklyMix();
    if(window.currentFilter === 'playlists') window.renderMain();
}

function checkAndUpdateMixes() {
    if(!window.allSongs.length) return;
    let updated = false;
    if(shouldUpdateDaily()) { generateDailyMix(); updated = true; }
    if(shouldUpdateWeekly()) { generateWeeklyMix(); updated = true; }
    if(updated && window.currentFilter === 'playlists') window.renderMain();
}

window.updateKeywordWeights = (keywords) => {
    if(!keywords) return;
    for(let kw of keywords) if(kw) window.keywordFreq[kw] = (window.keywordFreq[kw]||0)+0.8;
    saveKeywordFreq();
};
window.trackPlay = (song) => { if(song) window.updateKeywordWeights(song.keywords?.split(',') || []); };

// ─── Shuffle helpers ───
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function applyShuffleToQueue() {
    if (!window.isShuffle) return;
    if (window.usingPlaylistQueue && window.playlistQueue.length) {
        if (!window.originalPlaylistQueue.length && window.playlistQueue.length) {
            window.originalPlaylistQueue = [...window.playlistQueue];
        }
        const currentSong = window.playlistQueue[window.playlistQueueIndex];
        const shuffled = shuffleArray([...window.playlistQueue]);
        const newIndex = shuffled.findIndex(s => s.id === currentSong.id);
        window.playlistQueue = shuffled;
        window.playlistQueueIndex = newIndex !== -1 ? newIndex : 0;
    } else if (!window.usingPlaylistQueue && window.allSongs.length) {
        if (!window.originalAllSongs.length && window.allSongs.length) {
            window.originalAllSongs = [...window.allSongs];
        }
        const currentSong = window.allSongs[window.currentIndex];
        const shuffled = shuffleArray([...window.allSongs]);
        const newIndex = shuffled.findIndex(s => s.id === currentSong.id);
        window.allSongs = shuffled;
        window.currentIndex = newIndex !== -1 ? newIndex : 0;
    }
}

function restoreOriginalOrder() {
    if (!window.usingPlaylistQueue && window.originalAllSongs.length) {
        const currentSong = window.allSongs[window.currentIndex];
        window.allSongs = [...window.originalAllSongs];
        const newIndex = window.allSongs.findIndex(s => s.id === currentSong.id);
        window.currentIndex = newIndex !== -1 ? newIndex : 0;
        window.originalAllSongs = [];
    } else if (window.usingPlaylistQueue && window.originalPlaylistQueue.length) {
        const currentSong = window.playlistQueue[window.playlistQueueIndex];
        window.playlistQueue = [...window.originalPlaylistQueue];
        const newIndex = window.playlistQueue.findIndex(s => s.id === currentSong.id);
        window.playlistQueueIndex = newIndex !== -1 ? newIndex : 0;
        window.originalPlaylistQueue = [];
    }
}

// ─── Loop & Shuffle UI ───
function updateLoopUI() {
    const loopBtn = document.getElementById('loop-btn');
    const loopOneLabel = document.getElementById('loop-one-label');
    const loopDot = document.getElementById('loop-dot');
    
    if (window.loopMode === 0) {
        loopBtn.classList.remove('loop-active');
        if (loopOneLabel) loopOneLabel.classList.add('hidden');
        if (loopDot) loopDot.classList.add('opacity-0');
        loopBtn.classList.remove('loop-playlist-active');
        loopBtn.classList.remove('loop-one-active');
    } else if (window.loopMode === 1) {
        loopBtn.classList.add('loop-active');
        if (loopOneLabel) loopOneLabel.classList.add('hidden');
        if (loopDot) loopDot.classList.remove('opacity-0');
        loopBtn.classList.add('loop-playlist-active');
        loopBtn.classList.remove('loop-one-active');
    } else if (window.loopMode === 2) {
        loopBtn.classList.add('loop-active');
        if (loopOneLabel) loopOneLabel.classList.remove('hidden');
        if (loopDot) loopDot.classList.add('opacity-0');
        loopBtn.classList.add('loop-one-active');
        loopBtn.classList.remove('loop-playlist-active');
    }
}

function updateShuffleUI() {
    const shuffleBtn = document.getElementById('shuffle-btn');
    if (window.isShuffle) shuffleBtn.classList.add('shuffle-active');
    else shuffleBtn.classList.remove('shuffle-active');
}

// ─── Core Playback with Loop/Shuffle ───
function getNextIndex(currentIdx, total) {
    if (total === 0) return -1;
    let next = currentIdx + 1;
    if (next >= total) {
        if (window.loopMode === 1) next = 0;
        else return -1;
    }
    return next;
}

function getPrevIndex(currentIdx, total) {
    if (total === 0) return -1;
    let prev = currentIdx - 1;
    if (prev < 0) {
        if (window.loopMode === 1) prev = total - 1;
        else return -1;
    }
    return prev;
}

window.nextSong = () => {
    if (window.loopMode === 2) {
        const audio = document.getElementById('audio-engine');
        audio.currentTime = 0;
        audio.play();
        return;
    }
    if (window.usingPlaylistQueue && window.playlistQueue.length) {
        let nextIdx = getNextIndex(window.playlistQueueIndex, window.playlistQueue.length);
        if (nextIdx !== -1) {
            window.playlistQueueIndex = nextIdx;
            const song = window.playlistQueue[window.playlistQueueIndex];
            const idx = window.allSongs.indexOf(song);
            if (idx !== -1) window.playByIndex(idx);
        }
    } else if (window.allSongs.length) {
        let nextIdx = getNextIndex(window.currentIndex, window.allSongs.length);
        if (nextIdx !== -1) window.playByIndex(nextIdx);
    }
};

window.prevSong = () => {
    if (window.loopMode === 2) {
        const audio = document.getElementById('audio-engine');
        audio.currentTime = 0;
        audio.play();
        return;
    }
    if (window.usingPlaylistQueue && window.playlistQueue.length) {
        let prevIdx = getPrevIndex(window.playlistQueueIndex, window.playlistQueue.length);
        if (prevIdx !== -1) {
            window.playlistQueueIndex = prevIdx;
            const song = window.playlistQueue[window.playlistQueueIndex];
            const idx = window.allSongs.indexOf(song);
            if (idx !== -1) window.playByIndex(idx);
        }
    } else if (window.allSongs.length) {
        let prevIdx = getPrevIndex(window.currentIndex, window.allSongs.length);
        if (prevIdx !== -1) window.playByIndex(prevIdx);
    }
};

window.toggleShuffle = () => {
    window.isShuffle = !window.isShuffle;
    if (window.isShuffle) {
        applyShuffleToQueue();
    } else {
        restoreOriginalOrder();
    }
    updateShuffleUI();
};

window.toggleLoop = () => {
    window.loopMode = (window.loopMode + 1) % 3;
    const audio = document.getElementById('audio-engine');
    audio.loop = (window.loopMode === 2);
    updateLoopUI();
};

// ─── Override playCurrentPlaylist ───
const originalPlayCurrent = window.playCurrentPlaylist;
window.playCurrentPlaylist = () => {
    if (window.userPlaylists[window.currentPlaylistViewName]) {
        const playlist = window.userPlaylists[window.currentPlaylistViewName];
        const ids = Array.isArray(playlist) ? playlist : (playlist.songs || []);
        const queue = ids.map(id => window.allSongs.find(s => s.id === id)).filter(Boolean);
        if (queue.length) {
            window.usingPlaylistQueue = true;
            window.playlistQueue = [...queue];
            window.originalPlaylistQueue = [];
            if (window.isShuffle) {
                window.playlistQueue = shuffleArray([...window.playlistQueue]);
                window.playlistQueueIndex = 0;
            } else {
                window.playlistQueueIndex = 0;
            }
            window.playByIndex(window.allSongs.indexOf(window.playlistQueue[0]));
        }
    }
};

// ─── Override playByIndex ───
const originalPlayByIndex = window.playByIndex;
window.playByIndex = (idx) => {
    if (idx === -1) return;
    if (!window.usingPlaylistQueue && window.allSongs[idx]) {
        if (!window.isShuffle && window.originalAllSongs.length) {
            window.allSongs = [...window.originalAllSongs];
            window.originalAllSongs = [];
            const newIdx = window.allSongs.findIndex(s => s.id === window.allSongs[idx]?.id);
            idx = newIdx !== -1 ? newIdx : idx;
        }
        window.currentIndex = idx;
    } else if (window.usingPlaylistQueue && window.playlistQueue[idx]) {
        if (!window.isShuffle && window.originalPlaylistQueue.length) {
            window.playlistQueue = [...window.originalPlaylistQueue];
            window.originalPlaylistQueue = [];
            const newIdx = window.playlistQueue.findIndex(s => s.id === window.playlistQueue[window.playlistQueueIndex]?.id);
            if (newIdx !== -1) window.playlistQueueIndex = newIdx;
        }
    }
    originalPlayByIndex(idx);
};

// ─── Share / Download / Add to Playlist ───
window.shareCurrentSong = async () => {
    const song = window.getCurrentSong();
    if (!song) return alert("No song playing");
    const shareData = { title: song.title, text: `Check out "${song.title}" by ${song.artist} on Spotifree!`, url: window.location.href };
    if (navigator.share) { try { await navigator.share(shareData); } catch(e) {} }
    else { alert(`🎵 Share: "${song.title}" by ${song.artist}\nCopy link: ${window.location.href}`); }
};

window.sharePlaylist = async () => {
    const playlistName = document.getElementById('view-playlist-name').innerText;
    const trackCount = document.getElementById('view-playlist-meta').innerText;
    const shareData = { title: `Spotifree Playlist: ${playlistName}`, text: `Check out "${playlistName}" on Spotifree! ${trackCount}`, url: window.location.href };
    if (navigator.share) { try { await navigator.share(shareData); } catch(e) {} }
    else { alert(`🎵 Share playlist: "${playlistName}"\n${trackCount}`); }
};

window.downloadCurrentSong = async () => {
    const song = window.getCurrentSong();
    if (!song || !song.link) {
        alert("No audio available for download.");
        return;
    }
    try {
        const btn = document.querySelector('.download-btn');
        const originalHtml = btn?.innerHTML;
        if (btn) btn.innerHTML = '⏳';
        
        const response = await fetch(song.link);
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${song.title.replace(/[^a-z0-9]/gi, '_')}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        if (btn) btn.innerHTML = originalHtml;
        setTimeout(() => alert(`✅ "${song.title}" downloaded successfully!`), 500);
    } catch (err) {
        console.error(err);
        alert("Download failed. The file might be protected or the link is invalid.");
        const btn = document.querySelector('.download-btn');
        if (btn) btn.innerHTML = '<svg width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>';
    }
};

window.showAddToPlaylistPicker = (event) => {
    if (event) event.stopPropagation();
    const song = window.getCurrentSong();
    if (!song) return alert("No song playing");
    const pickerModal = document.getElementById('playlist-picker');
    const pickerList = document.getElementById('picker-list');
    const userPlaylistKeys = Object.keys(window.userPlaylists).filter(name => !name.startsWith('_') && typeof window.userPlaylists[name] === 'object' && !Array.isArray(window.userPlaylists[name]));
    if (userPlaylistKeys.length === 0) {
        pickerList.innerHTML = '<div class="p-4 text-center text-zinc-500">No playlists found. Create one first.</div>';
    } else {
        pickerList.innerHTML = '';
        userPlaylistKeys.forEach(playlistName => {
            const div = document.createElement('div');
            div.className = 'playlist-picker-item';
            div.innerText = playlistName;
            div.onclick = () => {
                const playlist = window.userPlaylists[playlistName];
                if (playlist.songs) {
                    if (!playlist.songs.includes(song.id)) {
                        playlist.songs.push(song.id);
                        localStorage.setItem('userPlaylists', JSON.stringify(window.userPlaylists));
                        alert(`✅ "${song.title}" added to "${playlistName}"`);
                    } else {
                        alert(`⚠️ "${song.title}" already exists in "${playlistName}"`);
                    }
                } else if (Array.isArray(playlist)) {
                    if (!playlist.includes(song.id)) {
                        playlist.push(song.id);
                        localStorage.setItem('userPlaylists', JSON.stringify(window.userPlaylists));
                        alert(`✅ "${song.title}" added to "${playlistName}"`);
                    } else {
                        alert(`⚠️ Already in "${playlistName}"`);
                    }
                }
                pickerModal.classList.add('hidden');
                window.renderMain();
            };
            pickerList.appendChild(div);
        });
    }
    pickerModal.classList.remove('hidden');
};
window.hidePlaylistPicker = () => {
    document.getElementById('playlist-picker').classList.add('hidden');
};

// ─── Render Main ───
window.renderMain = function() { 
    const grid = document.getElementById('main-grid'); 
    grid.innerHTML = ''; 
    if(window.currentFilter === 'playlists') { 
        checkAndUpdateMixes();
        document.getElementById('section-title').innerHTML = "Your Playlists 🔥 Daily/Weekly Smart Mixes"; 
        const pKeys = Object.keys(window.userPlaylists); 
        if(pKeys.length === 0) grid.innerHTML = `<div class="col-span-2 py-10 text-center font-bold text-zinc-500">No playlists yet. Create one.</div>`; 
        pKeys.forEach(name => { 
            const playlist = window.userPlaylists[name];
            const songCount = Array.isArray(playlist) ? playlist.length : (playlist.songs ? playlist.songs.length : 0);
            let displayName = name;
            let emoji = '🎵';
            if(name === '_daily_mix') { displayName = '🔥 Daily Mix'; emoji = '🌞'; }
            else if(name === '_weekly_mix') { displayName = '🎧 Weekly Mix'; emoji = '📅'; }
            const deleteBtn = (!name.startsWith('_')) ? `<button onclick="event.stopPropagation(); window.deletePlaylist('${name.replace(/'/g, "\\'")}')" class="delete-playlist-btn">🗑️</button>` : ''; 
            grid.innerHTML += `<div class="playlist-card p-4 cursor-pointer relative" onclick="window.openPlaylistView('${name.replace(/'/g, "\\'")}')"><div class="flex justify-between items-start"><span class="text-2xl">${emoji}</span>${deleteBtn}</div><h3 class="font-black text-base mt-3 truncate">${displayName}</h3><p class="text-[11px] text-[#1DB954] mt-1 font-bold">${songCount} tracks</p></div>`; 
        }); 
        return; 
    } else if(window.currentFilter === 'liked') { 
        document.getElementById('section-title').innerText = "Liked Songs"; 
        let filtered = window.allSongs.filter(s => window.likedIds.includes(s.id)); 
        filtered = filterSongsByLanguage(filtered);
        filtered.forEach(s => { const idx = window.allSongs.indexOf(s); grid.innerHTML += `<div onclick="window.playByIndex(${idx})" class="bg-[#181818] p-3 rounded-xl hover:bg-[#252525] transition cursor-pointer"><img src="${s.image}" class="w-full aspect-square object-cover rounded-lg mb-2 shadow-md"><h4 class="text-xs font-bold truncate">${s.title}</h4><p class="text-[10px] text-zinc-500 font-bold truncate">${s.artist}</p></div>`; }); 
    } else { 
        document.getElementById('section-title').innerHTML = `🎧 Your Library · Based on your habits`; 
        const personalized = getPersonalizedSongs(); 
        personalized.forEach(s => { const idx = window.allSongs.indexOf(s); if(idx !== -1) grid.innerHTML += `<div onclick="window.playByIndex(${idx})" class="bg-[#181818] p-3 rounded-xl hover:bg-[#252525] transition cursor-pointer"><img src="${s.image}" class="w-full aspect-square object-cover rounded-lg mb-2 shadow-md"><h4 class="text-xs font-bold truncate">${s.title}</h4><p class="text-[10px] text-zinc-500 font-bold truncate">${s.artist}</p></div>`; }); 
    } 
};

// ─── Playlist Detail View ───
window.openPlaylistView = (name) => { 
    window.currentPlaylistViewName=name; 
    const playlist=window.userPlaylists[name]; 
    const ids=Array.isArray(playlist)?playlist:(playlist.songs||[]); 
    const songsList=ids.map(id=>window.allSongs.find(s=>s.id===id)).filter(Boolean); 
    let displayTitle = name;
    if(name === '_daily_mix') displayTitle = '🔥 Daily Mix';
    if(name === '_weekly_mix') displayTitle = '🎧 Weekly Mix';
    document.getElementById('view-playlist-name').innerText = displayTitle; 
    document.getElementById('view-playlist-meta').innerHTML = `${songsList.length} tracks • Smart Selection`; 
    document.getElementById('playlist-cover-emoji').innerText = name === '_daily_mix' ? '🌞' : (name === '_weekly_mix' ? '📅' : '🎵');
    const container=document.getElementById('playlist-songs-list'); 
    container.innerHTML=songsList.map(s=>`<div onclick="window.playByIndex(${window.allSongs.indexOf(s)})" class="flex items-center gap-4 hover:bg-white/5 p-4 rounded-2xl cursor-pointer"><img src="${s.image}" class="w-12 h-12 rounded-lg object-cover"><div><div class="font-black text-sm">${s.title}</div><div class="text-[10px] text-zinc-400">${s.artist}</div></div></div>`).join(''); 
    document.getElementById('playlist-detail-view').classList.add('show-view'); 
    document.getElementById('delete-playlist-detail-btn').classList.toggle('hidden', name.startsWith('_')); 
};

window.deletePlaylist = (name) => { if(confirm(`Delete ${name}?`)){ delete window.userPlaylists[name]; localStorage.setItem('userPlaylists',JSON.stringify(window.userPlaylists)); window.renderMain(); if(window.currentPlaylistViewName===name) window.closePlaylistView(); } };
window.deleteCurrentPlaylistFromDetail = () => { if(window.currentPlaylistViewName && !window.currentPlaylistViewName.startsWith('_')) window.deletePlaylist(window.currentPlaylistViewName); };

// ─── Playback control functions ───
window.playByIndex = (idx) => { 
    if(idx===-1) return; 
    window.usingPlaylistQueue=false; 
    window.currentIndex=idx; 
    const song=window.allSongs[idx]; 
    if(song){ 
        const audio=document.getElementById('audio-engine'); 
        audio.src=song.link; 
        audio.currentTime=0; 
        document.getElementById('p-title').innerText=song.title; 
        document.getElementById('p-artist').innerText=song.artist; 
        document.getElementById('p-img').src=song.image; 
        document.getElementById('full-p-img').src=song.image; 
        document.getElementById('full-p-title').innerText=song.title; 
        document.getElementById('full-p-artist').innerText=song.artist; 
        document.getElementById('player-bar').style.transform="translateY(0)"; 
        audio.play().catch(()=>window.nextSong()); 
        window.updateIcons(true); 
        window.updateLikeUI(song.id); 
        window.trackPlay(song); 
    } 
};

window.filterMain = (t) => { window.currentFilter = t; document.querySelectorAll('.filter-btn').forEach(btn=>btn.classList.remove('active-filter')); document.getElementById('f-'+t).classList.add('active-filter'); window.renderMain(); };
window.openSearch = () => { document.getElementById('search-overlay').classList.add('show-view'); document.getElementById('full-search-input').focus(); };
window.closeSearch = () => document.getElementById('search-overlay').classList.remove('show-view');
window.toggleMenu = (show) => { document.getElementById('side-menu').classList.toggle('show-menu', show); document.getElementById('menu-overlay').style.display = show ? 'block' : 'none'; };
window.openFullPlayer = () => { document.getElementById('player-bar').style.display = 'none'; document.getElementById('full-player').classList.add('show-view'); };
window.closeFullPlayer = () => { document.getElementById('full-player').classList.remove('show-view'); document.getElementById('player-bar').style.display = ''; };
window.togglePlay = (e) => { const a = document.getElementById('audio-engine'); if(a.paused) a.play(); else a.pause(); window.updateIcons(!a.paused); };
window.updateIcons = (p) => { const play = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'; const pause = '<path d="M8 5v14l11-7z"/>'; document.getElementById('play-icon').innerHTML = p ? play : pause; document.getElementById('full-play-icon').innerHTML = p ? play : pause; };
window.updateLikeUI = (id) => { const btn = document.getElementById('full-like-btn'); if(btn) btn.classList.toggle('is-liked', window.likedIds.includes(id)); };
window.toggleLike = (e) => { e.stopPropagation(); const s = window.getCurrentSong(); if(!s) return; if(window.likedIds.includes(s.id)) window.likedIds = window.likedIds.filter(i=>i!==s.id); else window.likedIds.push(s.id); localStorage.setItem('likedSongs',JSON.stringify(window.likedIds)); window.updateLikeUI(s.id); window.renderMain(); };
window.getCurrentSong = () => { if(window.usingPlaylistQueue && window.playlistQueue.length) return window.playlistQueue[window.playlistQueueIndex]; else if(window.currentIndex>=0) return window.allSongs[window.currentIndex]; return null; };
window.seek = (e) => { const audio=document.getElementById('audio-engine'); audio.currentTime=(e.target.value/100)*audio.duration; };
window.formatTime = (s) => Math.floor(s/60)+':'+Math.floor(s%60).toString().padStart(2,'0');
window.showPlaylistModal = () => document.getElementById('playlist-modal').classList.remove('hidden');
window.hidePlaylistModal = () => document.getElementById('playlist-modal').classList.add('hidden');
window.createPlaylist = () => { const name=document.getElementById('new-playlist-name').value.trim(); if(name){ window.userPlaylists[name]={songs:[],owner:currentUserId,collaborative:document.getElementById('collab-checkbox').checked,collaborators:[]}; localStorage.setItem('userPlaylists',JSON.stringify(window.userPlaylists)); document.getElementById('new-playlist-name').value=''; document.getElementById('collab-checkbox').checked=false; window.hidePlaylistModal(); window.filterMain('playlists'); } };
window.closePlaylistView = () => document.getElementById('playlist-detail-view').classList.remove('show-view');

// ─── Onboarding ───
function showOnboardingModal() { 
    const modal = document.getElementById('onboarding-modal'); 
    const moodContainer = document.getElementById('onboarding-moods'); 
    moodContainer.innerHTML = ''; 
    const moods = ["sad","romantic","happy","energetic","chill","party","study","workout"];
    moods.forEach(m => { const btn = document.createElement('div'); btn.className = 'onboarding-option'; btn.textContent = m; btn.dataset.keyword = m; btn.onclick = () => btn.classList.toggle('selected'); moodContainer.appendChild(btn); }); 
    const langContainer = document.getElementById('onboarding-languages'); 
    langContainer.innerHTML = ''; 
    ["Hindi","English","Chhattisgarhiya","Marwari","Rajasthani","Gujarati","Bengali","Marathi","Punjabi","Haryanvi"].forEach(lang => { const chip = document.createElement('div'); chip.className = 'lang-chip'; chip.textContent = lang; chip.dataset.lang = lang; chip.onclick = () => chip.classList.toggle('selected'); langContainer.appendChild(chip); }); 
    modal.classList.remove('hidden'); 
}
function submitOnboarding() { 
    const selectedMoods = Array.from(document.querySelectorAll('#onboarding-moods .onboarding-option.selected')).map(el=>el.dataset.keyword); 
    const selectedLangs = Array.from(document.querySelectorAll('#onboarding-languages .lang-chip.selected')).map(el=>el.dataset.lang); 
    if(selectedMoods.length===0) { alert("Select at least one mood"); return; }
    if(selectedLangs.length===0) { alert("Select at least one language"); return; }
    for(const mood of selectedMoods) window.keywordFreq[mood] = (window.keywordFreq[mood]||0)+15; 
    saveLanguagePrefs(selectedLangs);
    saveKeywordFreq(); 
    localStorage.setItem('onboarding_completed_'+currentUserId,'true'); 
    document.getElementById('onboarding-modal').classList.add('hidden'); 
    window.refreshMixesNow();
    if(window.currentFilter==='all') window.renderMain(); 
}
document.getElementById('skip-onboarding').onclick = () => { localStorage.setItem('onboarding_completed_'+currentUserId,'skipped'); document.getElementById('onboarding-modal').classList.add('hidden'); window.renderMain(); };
document.getElementById('submit-onboarding').onclick = submitOnboarding;

// ─── Auth State ───
onAuthStateChanged(auth, async(user)=>{ 
    if(user){ 
        currentUserId=user.uid; 
        window.keywordFreq=loadKeywordFreq(); 
        window.userLanguagePrefs=loadLanguagePrefs();
        const userDoc=await getDoc(doc(db,"user_profile",user.uid)); 
        let name=userDoc.exists()?userDoc.data().name:"User"; 
        document.getElementById('side-user-name').innerText=name; 
        document.getElementById('side-user-avatar').innerText=name.charAt(0).toUpperCase(); 
        document.getElementById('user-initial-circle').innerText=name.charAt(0).toUpperCase(); 
        const total=Object.values(window.keywordFreq).reduce((a,b)=>a+b,0); 
        if(total===0 && !localStorage.getItem('onboarding_completed_'+currentUserId)){ 
            if(window.allSongs.length) showOnboardingModal(); 
            else{ const unsub=onSnapshot(songsCol,()=>{ if(window.allSongs.length){ unsub(); showOnboardingModal(); } }); } 
        } else { window.refreshMixesNow(); window.renderMain(); }
    } else window.location.href="addaccount.html"; 
});

// ─── Songs listener ───
onSnapshot(songsCol, snap=>{ window.allSongs=snap.docs.map(d=>({id:d.id,...d.data(), language: d.data().language || "English"})); window.renderMain(); });

// ─── Audio events ───
const audioEl=document.getElementById('audio-engine');
audioEl.ontimeupdate=()=>{ const p=(audioEl.currentTime/audioEl.duration)*100||0; document.getElementById('mini-progress').style.width=p+'%'; document.getElementById('full-seek-bar').value=p; document.getElementById('c-time').innerText=window.formatTime(audioEl.currentTime); if(!isNaN(audioEl.duration)) document.getElementById('d-time').innerText=window.formatTime(audioEl.duration); };
audioEl.onended=()=>{ if(window.loopMode===2) audioEl.play(); else window.nextSong(); };

// ─── Search input ───
document.getElementById('full-search-input')?.addEventListener('input',e=>{ const q=e.target.value; if(!window.allSongs.length) return; const resultsDiv=document.getElementById('search-results'); if(!q){ resultsDiv.innerHTML=''; return; } const match = window.allSongs.filter(s=>s.title.toLowerCase().includes(q)||s.artist.toLowerCase().includes(q)).slice(0,12); resultsDiv.innerHTML=match.map(s=>`<div onclick="window.playByIndex(${window.allSongs.indexOf(s)})" class="song-result-item"><img src="${s.image}" class="song-result-img"><div><div>${s.title}</div><div class="text-xs">${s.artist}</div></div></div>`).join(''); });

// ─── Initialize UI ───
updateLoopUI();
updateShuffleUI();
window.renderMain();

// ─── PROTECTION (right-click, dev tools, selection, drag) ───
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