const client = require('discord-rich-presence')('861702238472241162');
const { app, BrowserWindow } = require('electron');
require("dotenv").config();

const iTunes = require("./bridge/iTunesBridge.js");
const iTunesApp = new iTunes();

let RPCInterval = 0;
let state = "Not Opened";
let currentSong = {};
let startDate = new Date();
let lastSong = "";

function createWindow() {
  const win = new BrowserWindow({
    width: 0,
    height: 0,
    webPreferences: {
      nodeIntegration: true
    }
  });
  win.loadFile('index.html');
}

function setTime(sec) {
  var t = new Date();
  t.setSeconds(t.getSeconds() - sec);
  return t.getTime()
}

const puppeteer = require('puppeteer');

async function getAlbumArt(albumArt) {
  const searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent( albumArt + " album cover")}`;
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(searchUrl, { waitUntil: 'networkidle2' });

  const imageUrl = await page.evaluate(() => {
    const imgElement = document.querySelector('img');
    return imgElement ? imgElement.src : null;
  });

  await browser.close();
  return imageUrl;
}

app.whenReady().then(createWindow);

async function update() {
  currentSong = await iTunesApp.getCurrentSong();
  if (currentSong) state = await iTunesApp.getState()

  if (currentSong.name && currentSong.name.includes(" - ")) {
    const split = currentSong.name.split(/\s*\-\s*/);
    const artist = split.length > 1 ? split[0] : null
    const songname = split.length > 1 ? split[1] : currentSong.name;
    currentSong.artist = artist;
    currentSong.name = songname;
  }

  let fullTitle = currentSong ? `${currentSong.name} - ${currentSong.artist || "Unknown Artist"}` : "No Song";

  if (state == "Playing" && (fullTitle !== lastSong || !lastSong)) {
    startDate = new Date();
    lastSong = `${currentSong.artist || "Unknown Artist"} - ${currentSong.name}`;
    startDate.setSeconds(new Date().getSeconds() - parseInt(currentSong.elapsed) - 1);
  }

  startDate = new Date();
  startDate.setSeconds(new Date().getSeconds() - parseInt(currentSong.elapsed));

  // Get the album cover image
  let albumArt = await getAlbumArt(currentSong.album || "Unknown Album");
  if (!albumArt) albumArt = "applemusic"; // Fallback image

  client.updatePresence({
    state: (state == "Playing") ? `on ${currentSong.album || "Unknown"}` : state,
    details: `${currentSong.name || "Unknown"} - ${currentSong.artist || "Unknown"}`,
    startTimestamp: (state == "Playing") ? startDate.getTime() : Date.now(),
    largeImageKey: albumArt,
    smallImageKey: (state == "Playing") ? "pause" : "play",
    smallImageText: state,
    largeImageText: (state == "Playing") ? `${fullTitle}` : "Idling",
    buttons: [
      { label: "Search on Apple Music", url: `https://music.apple.com/us/search?term=${encodeURIComponent(currentSong.artist ? fullTitle : currentSong.name)}`},
      { label: "Search on Spotify", url: `https://open.spotify.com/search/${encodeURIComponent(currentSong.artist ? fullTitle : currentSong.name)}`}
    ],
    instance: true,
  });
}

RPCInterval = setInterval(update, 10000);