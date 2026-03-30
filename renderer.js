const fs = require('fs');
const path = require('path');

let songs = [];
let currentIndex = 0;
let sound = null;

let loopA = null;
let loopB = null;
let currentTitle = "";

let repeatMode = "all"; 

const lyricsFile = path.join(__dirname, "lyrics.json");


// LOAD SONGS
let libraryTree = {};

function buildTree(folder) {
  function scan(dir) {
    const name = path.basename(dir);
    const node = { name, type: "folder", children: [] };

    const files = fs.readdirSync(dir);

    files.forEach(file => {
      const full = path.join(dir, file);
      const stat = fs.statSync(full);

      if (stat.isDirectory()) {
        node.children.push(scan(full));
      } else if (/\.(mp3|wav|m4a|flac)$/i.test(file)) {
        node.children.push({
          name: file,
          path: full,
          type: "file"
        });
      }
    });

    return node;
  }

  libraryTree = scan(folder);
  renderTree(libraryTree);
}


// PLAY
function playSong(i) {
  currentIndex = i;

  if(sound) sound.stop();

  sound = new Howl({
    src:[songs[i].path],
    html5:true
  });

  sound.play();

  document.getElementById("nowPlaying").innerText = songs[i].name;

  loadLyrics();

  startSeek();
}

// CONTROLS
function play(){ if(sound) sound.play(); }
function pause(){ if(sound) sound.pause(); }
function stop(){
  if(sound){
    sound.stop();
    updatePlayButton(false);
  }
}

function next(){
  playNextFromTree();
}

function prev() {
  const items = document.querySelectorAll(".song-item");

  for (let i = 0; i < items.length; i++) {
    if (items[i] === currentElement) {
      if (i > 0) {
        items[i - 1].click();
      } else {
        items[items.length - 1].click();
      }
      return;
    }
  }
}

// SEEK BAR
function startSeek() {
  const bar = document.getElementById("seekBar");

  if (window.seekInterval) clearInterval(window.seekInterval);
  window.seekInterval = setInterval(()=>{
    if(sound && sound.playing()){
      let current = sound.seek();
let duration = sound.duration();

if (!duration) return;

let progress = (current / duration) * 100;
bar.value = progress;

// ⏱ UPDATE TIMER
document.getElementById("timeDisplay").innerText =
  formatTime(current) + " / " + formatTime(duration);

      // LOOP
      if(loopA !== null && loopB !== null){
        if(sound.seek() >= loopB){
          sound.seek(loopA);
        }
      }
    }
  },500);
}

// USER SEEK
document.getElementById("seekBar").addEventListener("input", function(){
  if(sound){
    let seekTo = (this.value/100)*sound.duration();
    sound.seek(seekTo);
  }
});

// A-B LOOP
function setA() {
  if (!sound) return;

  // If loop already complete → reset
  if (loopA !== null && loopB !== null) {
    clearLoop();
    return;
  }

  loopA = sound.seek();
  updateNowPlaying();
}

function setB() {
  if (!sound || loopA === null) return;

  loopB = sound.seek();

  // safety
  if (loopB <= loopA) {
    loopB = loopA + 1;
  }

  updateNowPlaying();
}

function clearLoop() {
  loopA = null;
  loopB = null;

  updateNowPlaying();
}

// THEME
function changeTheme(color){
  document.body.style.background = color;
}

// LYRICS
function loadLyrics(){
  try{
    const data = JSON.parse(fs.readFileSync(lyricsFile));
    document.getElementById("lyricsPanel").value =
      data[songs[currentIndex].path] || "";
  }catch{
    document.getElementById("lyricsPanel").value = "";
  }
}

function saveLyrics(){
  let data = {};
  try{
    data = JSON.parse(fs.readFileSync(lyricsFile));
  }catch{}

  data[songs[currentIndex].path] =
    document.getElementById("lyricsPanel").value;

  fs.writeFileSync(lyricsFile, JSON.stringify(data, null, 2));
  alert("Saved ✅");
}

// AUTO LOAD
window.onload = () => {
  buildTree("D:\\\\Music");
};

let currentElement = null;

function renderTree(node, parent = null) {
  const container = parent || document.getElementById("songList");

  if (!parent) container.innerHTML = "";

  const li = document.createElement("li");
  li.textContent = node.name.replace(/\.[^/.]+$/, "");

  if (node.type === "folder") {
    li.style.fontWeight = "500";

    const ul = document.createElement("ul");
    ul.style.marginLeft = "10px";
    ul.style.display = "none";

    li.onclick = () => {
      ul.style.display = ul.style.display === "none" ? "block" : "none";
    };

    container.appendChild(li);
    container.appendChild(ul);

    node.children.forEach(child => renderTree(child, ul));

  } else {
    li.classList.add("song-item");
	li.onclick = (e) => {
	  e.stopPropagation(); // 🔥 prevents folder toggle
	  playSongFromTree(node, li);
    };
    container.appendChild(li);
  }
}

function playSongFromTree(song, element) {

  // ⛔ Stop previous sound
  if (sound) sound.stop();

  // 🎵 Create new sound with repeat logic
  sound = new Howl({
  src: [song.path],
  html5: true,

  onplay: () => updatePlayButton(true),
  onpause: () => updatePlayButton(false),
  onstop: () => updatePlayButton(false),
  onend: () => {
    if (repeatMode === "one") {
      sound.play();
      return;
    }

    if (repeatMode === "all") {
      playNextFromTree();
      return;
    }

    if (repeatMode === "none") {
      updatePlayButton(false);
    }
  }
});

  // ▶️ Play
  sound.play();
  updatePlayButton(true);

  // 🧼 Clean title (remove extension)
  const cleanName = song.name.replace(/\.[^/.]+$/, "");
  currentTitle = cleanName;

  loopA = null;
  loopB = null;

  updateNowPlaying();

  // 🎧 Highlight current song
  if (currentElement) {
    currentElement.style.color = "white";
    currentElement.style.fontWeight = "normal";
  }

  element.style.color = "#8a6cff";
  element.style.fontWeight = "bold";
  currentElement = element;

  // 📜 Load lyrics
  loadLyricsByPath(song.path);

  // 🎚 Reset seek bar
  const bar = document.getElementById("seekBar");
  bar.value = 0;

  // ⏱ Start seek updater (safe reset)
  if (window.seekInterval) clearInterval(window.seekInterval);
  startSeek();
  bar.max = 100;
}

function loadLyricsByPath(songPath){
  try{
    const data = JSON.parse(fs.readFileSync(lyricsFile));
    document.getElementById("lyricsPanel").value =
      data[songPath] || "";
  }catch{
    document.getElementById("lyricsPanel").value = "";
  }
}

function formatTime(sec){
  if(!sec) return "0:00";
  let m = Math.floor(sec / 60);
  let s = Math.floor(sec % 60);
  return m + ":" + (s < 10 ? "0"+s : s);
}

document.addEventListener("keydown", (e) => {

  if(e.target.tagName === "TEXTAREA") return; // don't block typing

  switch(e.code){

    case "Space":
      e.preventDefault();
      if(sound && sound.playing()) pause();
      else play();
      break;

	case "ArrowRight":
	  if (e.ctrlKey) {
		next();
	  } else if (sound) {
		sound.seek(sound.seek() + 5);
	  }
	  break;

	case "ArrowLeft":
	  if (e.ctrlKey) {
		prev();
	  } else if (sound) {
		sound.seek(sound.seek() - 5);
	  }
	  break;

    case "ArrowUp":
      next();
      break;

    case "ArrowDown":
      prev();
      break;

    case "KeyS":
      stop();
      break;

    case "KeyA":
      setA();
      break;

    case "KeyB":
      setB();
      break;
  }
});

function playNextFromTree() {
  const items = document.querySelectorAll(".song-item");

  for (let i = 0; i < items.length; i++) {
    if (items[i] === currentElement) {
      if (i < items.length - 1) {
        items[i + 1].click();
      } else {
        items[0].click();
      }
      return;
    }
  }
}

function toggleRepeat(){
  if(repeatMode === "all"){
    repeatMode = "one";
    document.getElementById("repeatBtn").innerText = "🔂 One";
  }
  else if(repeatMode === "one"){
    repeatMode = "none";
    document.getElementById("repeatBtn").innerText = "🚫 None";
  }
  else{
    repeatMode = "all";
    document.getElementById("repeatBtn").innerText = "🔁 All";
  }
}

function updatePlayButton(isPlaying) {
  const btn = document.getElementById("playPauseBtn");
  btn.innerText = isPlaying ? "⏸" : "▶";
}

function togglePlay() {
  if (!sound) return;

  if (sound.playing()) {
    sound.pause();
    updatePlayButton(false);
  } else {
    sound.play();
    updatePlayButton(true);
  }
}

function updateNowPlaying() {
  let text = currentTitle || "No song";

  if (loopA !== null) text += ` [A: ${formatTime(loopA)}]`;
  if (loopB !== null) text += ` [B: ${formatTime(loopB)}]`;

  document.getElementById("nowPlaying").innerText = text;
}

window.prev = prev;
window.next = next;
window.stop = stop;
window.setA = setA;
window.setB = setB;
window.toggleRepeat = toggleRepeat;
window.togglePlay = togglePlay;
