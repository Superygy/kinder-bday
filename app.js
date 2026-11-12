(() => {
  "use strict";
  const config = window.BIRTHDAY_CONFIG || {};
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const screens = {
    home: $("#homeScreen"), egg: $("#eggScreen"), food: $("#foodScreen"),
    event: $("#eventScreen"), birthday: $("#birthdayScreen"),
    edits: $("#editsScreen"), favouriteSong: $("#favouriteSongScreen"),
    vault: $("#vaultScreen"), finalLetter: $("#finalLetterScreen"), game: $("#gameScreen"), exit: $("#exitScreen")
  };
  const progress = { home: 0, egg: 12, food: 20, event: 20, birthday: 34, edits: 58, favouriteSong: 68, vault: 78, finalLetter: 88, game: 96, exit: 100 };
  let currentScreen = "home";
  let timerInterval = null;
  let counterInterval = null;
  let heartSpawnInterval = null;
  let gameTime = 5;
  let gameScore = 0;
  let bestScore = Number(localStorage.getItem("birthdayHeartHighScore") || 5);
  let noClicks = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragCurrentX = 0;
  let dragCurrentY = 0;
  let draggingTab = null;
  let isEggOpen = false;
  const peeledTabs = new Set();
  let candlesLit = new Set();
  let gameRunning = false;

  const bgMusic = $("#bgMusic");
  const finalLetterMusic = $("#finalLetterMusic");
  const musicToggle = $("#musicToggle");
  const musicLabel = $(".music-label", musicToggle);
  const favouriteSongAudio = $("#favouriteSongAudio");
  let activeBackgroundMusic = bgMusic;
  let finalLetterMusicStartRequested = false;
  let finalLetterMusicReady = false;
  let finalLetterMusicTransitionStarted = false;
  if (finalLetterMusic) finalLetterMusic.src = config.finalLetterMusic || "assets/audio/final-letter-music.mp3";

  function showScreen(name, options = {}) {
    if (!screens[name]) return;
    if (currentScreen === "edits" && name !== "edits") {
      editVideos.forEach((video) => { if (!video.paused) video.pause(); });
    }
    if (currentScreen === "favouriteSong" && name !== "favouriteSong" && favouriteSongAudio && !favouriteSongAudio.paused) {
      favouriteSongAudio.pause();
    }
    Object.entries(screens).forEach(([key, element]) => {
      const active = key === name;
      element.hidden = !active;
      element.classList.toggle("active", active);
      if (active) {
        element.classList.remove("zoom-out");
        if (options.animate !== false) {
          element.style.animation = "none";
          void element.offsetHeight;
          element.style.animation = "";
        }
      }
    });
    currentScreen = name;
    $("#siteProgress span").style.width = `${progress[name] || 0}%`;
    window.scrollTo({ top: 0, behavior: options.scroll === false ? "auto" : "smooth" });
    if (name === "game") updateHighScore();
    if (name === "birthday") startBalloons();
    if (name === "finalLetter") startFinalLetterMusicCrossfade();
  }

  function setImageOrPlaceholder(img, placeholder) {
    if (!img || !placeholder) return;
    img.addEventListener("load", () => { placeholder.hidden = true; });
    img.addEventListener("error", () => { img.hidden = true; placeholder.hidden = false; });
    if (img.complete && img.naturalWidth > 0) placeholder.hidden = true;
    else if (img.complete && img.naturalWidth === 0) { img.hidden = true; placeholder.hidden = false; }
  }

  // One shared foreground-media controller keeps the background track in sync
  // with every edit video and the featured favourite song.
  const editVideos = new Set();
  const foregroundMediaPlaying = new Set();
  let resumeBackgroundAfterForeground = false;
  let backgroundResumeTimer = null;

  function syncBackgroundMusicUI() {
    if (!activeBackgroundMusic || !musicToggle) return;
    const playing = !activeBackgroundMusic.paused && !activeBackgroundMusic.ended;
    musicToggle.classList.toggle("playing", playing);
    musicLabel.textContent = playing
      ? "Music on"
      : (resumeBackgroundAfterForeground ? "Music paused" : "Music off");
    musicToggle.setAttribute(
      "aria-label",
      playing ? "Turn background music off" : "Resume background music"
    );
  }

  function allForegroundMedia() {
    return [...editVideos, favouriteSongAudio].filter(Boolean);
  }

  function resumeBackgroundIfForegroundIsIdle() {
    window.clearTimeout(backgroundResumeTimer);
    backgroundResumeTimer = window.setTimeout(async () => {
      if (foregroundMediaPlaying.size > 0 || !resumeBackgroundAfterForeground) return;
      // Clear the flag before play() so a rejected play request cannot create a loop.
      resumeBackgroundAfterForeground = false;
      try {
        // Pausing an HTMLMediaElement preserves currentTime, so this continues
        // from the exact point at which the foreground media interrupted it.
        await activeBackgroundMusic.play();
      } catch (error) {
        console.info("Background music could not resume. Check assets/audio/background-music.mp3.", error);
      }
      syncBackgroundMusicUI();
    }, 100);
  }

  function activateForegroundMedia(media) {
    if (!media) return;
    window.clearTimeout(backgroundResumeTimer);

    const anotherForegroundItemWasPlaying = foregroundMediaPlaying.size > 0;
    if (!anotherForegroundItemWasPlaying) {
      // Preserve an already-paused background track during a quick hand-off
      // from one foreground item to the next (before its resume timer fires).
      // Otherwise, only resume later if the background was actually playing.
      if (!resumeBackgroundAfterForeground) {
        resumeBackgroundAfterForeground = !activeBackgroundMusic.paused && !activeBackgroundMusic.ended;
      }
      if (!activeBackgroundMusic.paused) activeBackgroundMusic.pause();
    }

    foregroundMediaPlaying.add(media);

    // Never let two edit videos or the favourite song overlap each other.
    allForegroundMedia().forEach((otherMedia) => {
      if (otherMedia !== media && !otherMedia.paused) otherMedia.pause();
    });
    syncBackgroundMusicUI();
  }

  function releaseForegroundMedia(media) {
    if (!media) return;
    foregroundMediaPlaying.delete(media);
    resumeBackgroundIfForegroundIsIdle();
    syncBackgroundMusicUI();
  }

  function registerForegroundMedia(media) {
    media.addEventListener("play", () => activateForegroundMedia(media));
    media.addEventListener("pause", () => releaseForegroundMedia(media));
    media.addEventListener("ended", () => releaseForegroundMedia(media));
  }

  function stopForegroundMediaAndCancelResume() {
    // A manual background-music start takes priority over any video/song.
    resumeBackgroundAfterForeground = false;
    window.clearTimeout(backgroundResumeTimer);
    foregroundMediaPlaying.clear();
    allForegroundMedia().forEach((media) => {
      if (!media.paused) media.pause();
    });
    syncBackgroundMusicUI();
  }

  // Smoothly adjusts an audio element's volume without changing its playback position.
  function fadeAudioVolume(audio, targetVolume, duration = 1800, onComplete) {
    if (!audio) return;
    const startVolume = audio.volume;
    const startTime = performance.now();
    const endVolume = Math.max(0, Math.min(1, targetVolume));

    function step(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      audio.volume = startVolume + (endVolume - startVolume) * progress;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else if (typeof onComplete === "function") {
        onComplete();
      }
    }

    window.requestAnimationFrame(step);
  }

  function startFinalLetterMusicCrossfade() {
    if (!finalLetterMusicReady || finalLetterMusicTransitionStarted) return;
    finalLetterMusicTransitionStarted = true;
    activeBackgroundMusic = finalLetterMusic;

    // Fade the original soundtrack out, then pause it so it cannot overlap
    // with the finale track after the crossfade has completed.
    fadeAudioVolume(bgMusic, 0, 2000, () => {
      bgMusic.pause();
      bgMusic.volume = 1;
    });
    if (!finalLetterMusic.paused) fadeAudioVolume(finalLetterMusic, 1, 2000);
    syncBackgroundMusicUI();
  }

  // Request playback during the successful vault-submit gesture. This avoids
  // autoplay blocking when the letter screen appears after its opening delay.
  function beginFinalLetterSoundtrack() {
    if (!finalLetterMusic || finalLetterMusicStartRequested) return;
    finalLetterMusicStartRequested = true;
    finalLetterMusic.volume = 0;

    let playRequest;
    try {
      playRequest = finalLetterMusic.play();
    } catch (error) {
      finalLetterMusicStartRequested = false;
      finalLetterMusic.volume = 1;
      console.info("Final-letter music could not start. Add assets/audio/final-letter-music.mp3.", error);
      return;
    }

    Promise.resolve(playRequest).then(() => {
      finalLetterMusicReady = true;
      activeBackgroundMusic = finalLetterMusic;
      syncBackgroundMusicUI();
      // If the audio takes longer to load than the vault animation, the
      // crossfade still begins as soon as the final-letter screen is visible.
      if (currentScreen === "finalLetter") startFinalLetterMusicCrossfade();
    }).catch((error) => {
      finalLetterMusicStartRequested = false;
      finalLetterMusic.volume = 1;
      console.info("Final-letter music could not be played. Add assets/audio/final-letter-music.mp3.", error);
      syncBackgroundMusicUI();
    });
  }

  // Background music: browsers require a user gesture before playback.
  async function startBackgroundMusic() {
    if (!activeBackgroundMusic) return;
    if (!activeBackgroundMusic.paused && !activeBackgroundMusic.ended) {
      syncBackgroundMusicUI();
      return;
    }

    stopForegroundMediaAndCancelResume();
    try {
      // The bouquet click starts the original soundtrack; after the final
      // letter, this same control resumes the dedicated finale soundtrack.
      await activeBackgroundMusic.play();
    } catch (error) {
      musicLabel.textContent = "Add music file";
      console.info("Background music could not be played. Check the configured audio file in assets/audio/.", error);
    }
    syncBackgroundMusicUI();
  }

  async function toggleMusic() {
    if (!activeBackgroundMusic) return;
    if (!activeBackgroundMusic.paused) {
      activeBackgroundMusic.pause();
      syncBackgroundMusicUI();
      return;
    }
    await startBackgroundMusic();
  }
  musicToggle.addEventListener("click", toggleMusic);
  bgMusic.addEventListener("play", syncBackgroundMusicUI);
  bgMusic.addEventListener("pause", syncBackgroundMusicUI);
  if (finalLetterMusic) {
    finalLetterMusic.addEventListener("play", syncBackgroundMusicUI);
    finalLetterMusic.addEventListener("pause", syncBackgroundMusicUI);
  }

  // Featured favourite-song player. Its play/pause/ended events are managed by
  // the same controller as the edit videos, so the background never overlaps.
  const songPlayButton = $("#songPlayButton");
  const songPlayIcon = $("#songPlayIcon");
  const songProgress = $("#songProgress");
  const songStatus = $("#songStatus");
  const songEqualizer = $("#songEqualizer");
  const songCurrentTime = $("#songCurrentTime");
  const songDuration = $("#songDuration");
  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }
  function syncFavouriteSongUI() {
    if (!favouriteSongAudio) return;
    const playing = !favouriteSongAudio.paused && !favouriteSongAudio.ended;
    songPlayIcon.textContent = playing ? "Ⅱ" : "▶";
    songPlayButton.setAttribute("aria-label", playing ? "Pause favourite song" : "Play favourite song");
    songPlayButton.classList.toggle("is-playing", playing);
    songEqualizer.classList.toggle("is-playing", playing);
    $(".song-player-card").classList.toggle("is-playing", playing);
  }
  function updateSongProgress() {
    if (!favouriteSongAudio) return;
    const duration = favouriteSongAudio.duration;
    songCurrentTime.textContent = formatTime(favouriteSongAudio.currentTime);
    songDuration.textContent = formatTime(duration);
    songProgress.value = Number.isFinite(duration) && duration > 0
      ? String((favouriteSongAudio.currentTime / duration) * 100) : "0";
  }
  function setupFavouriteSong() {
    const song = config.favouriteSong || {};
    $("#songTrackTitle").textContent = song.title || "Our favourite song";
    $("#songArtist").textContent = song.artist || "A song picked with love";
    $("#favouriteSongNote").textContent = song.note || "Some songs become little time capsules. This one's ours. ♡";
    const audioPath = song.audio || "assets/audio/favourite-song.mp3";
    favouriteSongAudio.src = audioPath;
    songStatus.textContent = `Add ${audioPath.split("/").pop()} to play this song`;
    favouriteSongAudio.addEventListener("loadedmetadata", () => {
      songProgress.disabled = false;
      songPlayButton.disabled = false;
      songStatus.textContent = "Ready when you are ♡";
      updateSongProgress();
    });
    favouriteSongAudio.addEventListener("canplay", () => {
      songPlayButton.disabled = false;
      songStatus.textContent = "Ready when you are ♡";
    });
    favouriteSongAudio.addEventListener("timeupdate", updateSongProgress);
    favouriteSongAudio.addEventListener("play", syncFavouriteSongUI);
    favouriteSongAudio.addEventListener("pause", syncFavouriteSongUI);
    favouriteSongAudio.addEventListener("ended", () => {
      syncFavouriteSongUI();
      favouriteSongAudio.currentTime = 0;
      updateSongProgress();
      songStatus.textContent = "That was lovely. Play it again? ♡";
    });
    favouriteSongAudio.addEventListener("error", () => {
      songPlayButton.disabled = true;
      songProgress.disabled = true;
      songStatus.textContent = `Add ${audioPath.split("/").pop()} to assets/audio`;
      syncFavouriteSongUI();
    });
    favouriteSongAudio.load();
  }
  registerForegroundMedia(favouriteSongAudio);
  songPlayButton.addEventListener("click", async () => {
    if (!favouriteSongAudio || songPlayButton.disabled) return;
    if (favouriteSongAudio.paused) {
      try {
        await favouriteSongAudio.play();
        songStatus.textContent = "Playing just for you ♡";
      } catch (error) {
        // A rejected play request never triggers the play event; if a browser
        // did partially start it, release it safely and restore the soundtrack.
        releaseForegroundMedia(favouriteSongAudio);
        songStatus.textContent = "This song could not be played. Check the audio file.";
      }
    } else {
      favouriteSongAudio.pause();
      songStatus.textContent = "Paused ♡";
    }
    syncFavouriteSongUI();
  });
  songProgress.addEventListener("input", () => {
    if (!Number.isFinite(favouriteSongAudio.duration) || !favouriteSongAudio.duration) return;
    favouriteSongAudio.currentTime = (Number(songProgress.value) / 100) * favouriteSongAudio.duration;
    updateSongProgress();
  });
  setupFavouriteSong();

  // Welcome bouquet -> start the soundtrack on the visitor's first gesture,
  // then reveal the sealed egg. The foreground-media controller will pause
  // and resume this same background track around edits and the favourite song.
  $("#bouquetButton").addEventListener("click", () => {
    startBackgroundMusic();
    showScreen("egg");
    resetEgg();
  });
  $("#eggBackHome").addEventListener("click", () => showScreen("home"));

  function resetEgg() {
    isEggOpen = false;
    peeledTabs.clear();
    draggingTab = null;
    const stage = $("#eggStage");
    stage.classList.remove("is-open", "left-peeled", "right-peeled");
    const packageArt = $("#closedEgg");
    packageArt.style.opacity = "1";
    packageArt.style.transform = "";
    packageArt.style.filter = "";
    [
      { tab: $("#pullTabLeft"), strip: $("#peelStripLeft") },
      { tab: $("#pullTabRight"), strip: $("#peelStripRight") }
    ].forEach(({ tab, strip }) => {
      tab.disabled = false;
      tab.classList.remove("peeled");
      tab.style.transition = "";
      tab.style.transform = "";
      strip.style.transition = "";
      strip.style.transform = "";
      strip.style.opacity = "1";
    });
    $("#dragHint").hidden = false;
    $("#dragHint").innerHTML = "<span>↙</span> peel each tab outward and down";
  }

  // Each foil tab is pulled diagonally outward + downward, matching the peel motion.
  // Both tabs must be peeled before the two package halves separate.
  const peelControls = [
    { side: "left", tab: $("#pullTabLeft"), strip: $("#peelStripLeft"), className: "left-peeled" },
    { side: "right", tab: $("#pullTabRight"), strip: $("#peelStripRight"), className: "right-peeled" }
  ];

  function pullProgress(control, dx, dy) {
    const outward = control.side === "left" ? -dx : dx;
    return { outward, downward: dy, amount: Math.min(1, Math.max(outward / 88, dy / 52)) };
  }

  function bindPeelControl(control) {
    const { tab, strip, side } = control;
    tab.addEventListener("pointerdown", (event) => {
      if (isEggOpen || peeledTabs.has(side) || draggingTab) return;
      draggingTab = control;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragCurrentX = 0;
      dragCurrentY = 0;
      tab.style.transition = "none";
      strip.style.transition = "none";
      tab.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    tab.addEventListener("pointermove", (event) => {
      if (draggingTab !== control) return;
      dragCurrentX = event.clientX - dragStartX;
      dragCurrentY = Math.max(-8, Math.min(100, event.clientY - dragStartY));
      const p = pullProgress(control, dragCurrentX, dragCurrentY);
      const outward = Math.max(0, p.outward);
      const amount = Math.max(0, Math.min(1, p.amount));
      const direction = side === "left" ? -1 : 1;
      tab.style.transform = `translate(${dragCurrentX}px, ${dragCurrentY}px) rotate(${direction * amount * 22}deg)`;
      strip.style.transform = `translate(${direction * outward * .58}px, ${Math.max(0, dragCurrentY) * .5}px) rotate(${direction * amount * 12}deg) scaleY(${1 - amount * .15})`;
      strip.style.opacity = String(1 - amount * .42);
      event.preventDefault();
    });

    function finishPull() {
      if (draggingTab !== control) return;
      const p = pullProgress(control, dragCurrentX, dragCurrentY);
      const accepted = p.outward >= 58 && p.downward >= 18;
      draggingTab = null;
      if (accepted) {
        peeledTabs.add(side);
        tab.classList.add("peeled");
        tab.disabled = true;
        tab.style.transition = "transform .48s cubic-bezier(.16,.8,.25,1), opacity .4s ease";
        strip.style.transition = "transform .6s cubic-bezier(.16,.8,.25,1), opacity .5s ease";
        const direction = side === "left" ? -1 : 1;
        tab.style.transform = `translate(${direction * 94}px, 58px) rotate(${direction * 34}deg)`;
        tab.style.opacity = ".08";
        strip.style.transform = `translate(${direction * 76}px, 45px) rotate(${direction * 18}deg) scaleY(.55)`;
        strip.style.opacity = "0";
        $("#eggStage").classList.add(control.className);
        const remaining = side === "left" ? "right" : "left";
        $("#dragHint").innerHTML = peeledTabs.size === 1
          ? `<span>↘</span> lovely! now peel the ${remaining} tab`
          : "<span>✦</span> opening your surprise…";
        if (peeledTabs.size === 2) window.setTimeout(openEgg, 360);
      } else {
        tab.style.transition = "transform .35s cubic-bezier(.2,.8,.2,1)";
        strip.style.transition = "transform .35s ease, opacity .35s ease";
        tab.style.transform = "";
        strip.style.transform = "";
        strip.style.opacity = "1";
        window.setTimeout(() => { tab.style.transition = ""; strip.style.transition = ""; }, 380);
      }
    }
    tab.addEventListener("pointerup", finishPull);
    tab.addEventListener("pointercancel", finishPull);
    tab.addEventListener("lostpointercapture", finishPull);
  }
  peelControls.forEach(bindPeelControl);

  function openEgg() {
    if (isEggOpen) return;
    isEggOpen = true;
    $("#eggStage").classList.add("is-open");
    $("#dragHint").hidden = true;
    $("#eggOpened").setAttribute("aria-hidden", "false");
  }

  // Egg halves open their own zoomed-in page.
  $("#foodHalf").addEventListener("click", () => {
    showScreen("food");
    setImageOrPlaceholder($("#favoriteFoodImage"), $("#favoriteFoodPlaceholder"));
    $("#favoriteFoodCaption").textContent = config.favoriteFoodCaption || "A little favourite, just for you. ♡";
  });
  $("#eventHalf").addEventListener("click", () => {
    noClicks = 0;
    $("#surpriseNo").hidden = false;
    $("#surpriseNo").classList.remove("no-dodge");
    $("#surpriseNo").style.cssText = "";
    $("#choiceNote").textContent = "Choose wisely, birthday star ✨";
    showScreen("event");
  });
  $$('[data-back="egg"]').forEach(button => button.addEventListener("click", () => {
    const current = screens[currentScreen];
    if (current) {
      current.classList.add("zoom-out");
      setTimeout(() => showScreen("egg"), 330);
    } else showScreen("egg");
  }));

  // Three playful attempts to dodge the "No" button, then it disappears.
  $("#surpriseNo").addEventListener("click", () => {
    noClicks += 1;
    const noButton = $("#surpriseNo");
    const note = $("#choiceNote");
    if (noClicks >= 4) {
      noButton.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(.05)", opacity: 0 }], { duration: 420, easing: "ease-in" });
      setTimeout(() => { noButton.hidden = true; }, 390);
      note.textContent = "Looks like it's a YES kind of day! ♡";
      return;
    }
    const positions = [
      { x: "64%", y: "-10px", scale: .88, rotate: "-8deg" },
      { x: "16%", y: "7px", scale: .76, rotate: "7deg" },
      { x: "52%", y: "15px", scale: .62, rotate: "-5deg" }
    ];
    const pos = positions[noClicks - 1];
    noButton.classList.add("no-dodge");
    noButton.style.setProperty("--dodge-x", pos.x);
    noButton.style.setProperty("--dodge-y", pos.y);
    noButton.style.setProperty("--dodge-scale", pos.scale);
    noButton.style.setProperty("--dodge-rotate", pos.rotate);
    note.textContent = noClicks === 1 ? "Oops, the button got a little shy!" : noClicks === 2 ? "It's getting smaller… just saying!" : "One last dodge… perhaps try YES?";
  });
  $("#surpriseYes").addEventListener("click", () => {
    showScreen("birthday");
    launchConfetti($("#birthdayConfetti"), 90);
    $("#birthdaySubheading").textContent = config.birthdaySubheading || "Make a wish, birthday star ✨";
  });

  function startBalloons() {
    const field = $("#balloonField");
    if (field.childElementCount) return;
    for (let i = 0; i < 12; i++) {
      const balloon = document.createElement("span");
      balloon.className = "balloon";
      balloon.style.left = `${4 + Math.random() * 92}%`;
      balloon.style.setProperty("--duration", `${10 + Math.random() * 9}s`);
      balloon.style.setProperty("--delay", `${-Math.random() * 14}s`);
      balloon.style.transform = `scale(${.72 + Math.random() * .48})`;
      field.appendChild(balloon);
    }
  }

  function launchConfetti(container, amount = 65) {
    if (!container) return;
    container.innerHTML = "";
    for (let i = 0; i < amount; i++) {
      const piece = document.createElement("i");
      piece.className = "confetti-piece";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.animationDelay = `${Math.random() * .9}s`;
      piece.style.setProperty("--fall", `${2.4 + Math.random() * 2.2}s`);
      piece.style.setProperty("--rotate", `${Math.random() * 180}deg`);
      piece.style.setProperty("--drift", `${-120 + Math.random() * 240}px`);
      container.appendChild(piece);
    }
    setTimeout(() => { container.innerHTML = ""; }, 6000);
  }

  // Candle lighting and blowing.
  $$(".candle").forEach(candle => {
    candle.addEventListener("click", () => {
      const index = Number(candle.dataset.candle);
      if (candlesLit.has(index)) {
        candlesLit.delete(index);
        candle.classList.remove("lit");
        candle.setAttribute("aria-label", `Light candle ${index + 1}`);
      } else {
        candlesLit.add(index);
        candle.classList.add("lit");
        candle.setAttribute("aria-label", `Extinguish candle ${index + 1}`);
      }
      const count = candlesLit.size;
      $("#candleInstruction").textContent = count === 5 ? "All five are glowing! Make your wish and blow them out." : `${count} of 5 candles lit. Tap the rest!`;
      $("#blowCandles").hidden = count !== 5;
    });
  });

  $("#blowCandles").addEventListener("click", () => {
    $$(".candle").forEach(candle => candle.classList.remove("lit"));
    candlesLit.clear();
    $("#blowCandles").hidden = true;
    $("#candleInstruction").textContent = "Wish made! Let the birthday magic begin. ♡";
    $("#cakeCandles").animate([{ opacity: 1, transform: "translateY(0)" }, { opacity: .25, transform: "translateY(-12px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 650, easing: "ease-out" });
    launchConfetti($("#birthdayConfetti"), 110);
    $("#birthdayLetterText").textContent = config.birthdayLetter || "Wishing you a day filled with laughter, little surprises, and everything that makes you happy. Happy birthday! ♡";
    $("#birthdaySignoff").textContent = config.birthdaySignoff || "With lots of warmth ♡";
    $("#birthdayLetter").hidden = false;
    $("#counterIntro").hidden = false;
    $("#counterIntro").scrollIntoView({ behavior: "smooth", block: "center" });
  });

  // Relationship counter.
  function updateCounter() {
    const start = new Date(config.relationshipStart || "2025-01-01T00:00:00");
    if (Number.isNaN(start.getTime())) return;
    let diff = Math.max(0, Date.now() - start.getTime());
    const days = Math.floor(diff / 86400000); diff %= 86400000;
    const hours = Math.floor(diff / 3600000); diff %= 3600000;
    const minutes = Math.floor(diff / 60000); diff %= 60000;
    const seconds = Math.floor(diff / 1000);
    $("#countDays").textContent = days.toLocaleString();
    $("#countHours").textContent = String(hours).padStart(2, "0");
    $("#countMinutes").textContent = String(minutes).padStart(2, "0");
    $("#countSeconds").textContent = String(seconds).padStart(2, "0");
  }
  $("#showCounter").addEventListener("click", () => {
    $("#timeCounter").hidden = false;
    updateCounter();
    clearInterval(counterInterval);
    counterInterval = setInterval(updateCounter, 1000);
    $("#timeCounter").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  // Four vertical edit-video slots. Each card keeps a designed placeholder until its MP4 is added.
  let editsBuilt = false;
  function buildEdits() {
    if (editsBuilt) return;
    editsBuilt = true;
    const grid = $("#editsGrid");
    const defaults = Array.from({ length: 4 }, (_, index) => ({
      video: `assets/videos/edit-${String(index + 1).padStart(2, "0")}.mp4`,
      caption: `A little moment, on repeat. ♡`
    }));
    const entries = Array.isArray(config.edits) && config.edits.length ? config.edits.slice(0, 4) : defaults;
    while (entries.length < 4) entries.push(defaults[entries.length]);
    entries.slice(0, 4).forEach((entry, index) => {
      const item = entry || defaults[index];
      const card = document.createElement("article");
      card.className = "edit-card";
      const frame = document.createElement("div");
      frame.className = "edit-video-frame";
      const video = document.createElement("video");
      video.className = "edit-video";
      video.playsInline = true;
      video.preload = "metadata";
      video.controls = false;
      video.setAttribute("aria-label", `Video edit ${index + 1}`);
      const placeholder = document.createElement("div");
      placeholder.className = "edit-video-placeholder";
      placeholder.innerHTML = `<span class="edit-index">EDIT ${String(index + 1).padStart(2, "0")}</span><span class="edit-play-mark">▶</span><b>Your video goes here</b><small></small>`;
      const placeholderFile = $("small", placeholder);
      const sourcePath = item.video || defaults[index].video;
      placeholderFile.textContent = sourcePath.split("/").pop();
      video.addEventListener("loadeddata", () => {
        placeholder.hidden = true;
        video.controls = true;
      });
      registerForegroundMedia(video);
      editVideos.add(video);
      video.addEventListener("error", () => {
        video.controls = false;
        placeholder.hidden = false;
      });
      video.src = sourcePath;
      frame.append(video, placeholder);
      const caption = document.createElement("p");
      caption.className = "edit-caption";
      caption.textContent = item.caption || "A favourite little edit. ♡";
      const label = document.createElement("span");
      label.className = "edit-card-label";
      label.textContent = `YOUR EDIT ${String(index + 1).padStart(2, "0")}`;
      card.append(label, frame, caption);
      grid.appendChild(card);
    });
  }

  $("#toEdits").addEventListener("click", () => {
    buildEdits();
    showScreen("edits");
  });
  $("#toFavouriteSong").addEventListener("click", () => showScreen("favouriteSong"));
  $("#toVault").addEventListener("click", () => showScreen("vault"));

  // Vault answer check. Answer is editable in config.js.
  $("#vaultQuestion").textContent = config.vaultQuestion || "What is the secret answer?";
  const answerInput = $("#vaultAnswer");
  const unlockButton = $("#vaultUnlock");
  function normalized(value) { return String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, " "); }
  function isCorrectAnswer() { return normalized(answerInput.value) === normalized(config.vaultAnswer || "sunshine"); }
  answerInput.addEventListener("input", () => {
    // Deliberately do not validate here. A typed answer only counts after submit/Enter.
    const feedback = $("#vaultFeedback");
    feedback.className = "vault-feedback";
    feedback.textContent = answerInput.value.trim()
      ? "Press Enter or tap 'Enter answer' to check it."
      : "Type your answer, then press Enter or tap the button.";
  });
  $("#vaultForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (unlockButton.disabled) return;
    if (!isCorrectAnswer()) {
      $("#vaultFeedback").className = "vault-feedback error";
      $("#vaultFeedback").textContent = "That's not quite right. Try again, love. ♡";
      const form = $("#vaultForm");
      form.classList.remove("answer-shake");
      void form.offsetWidth;
      form.classList.add("answer-shake");
      answerInput.focus();
      return;
    }
    $("#vaultFeedback").className = "vault-feedback success";
    $("#vaultFeedback").textContent = "Correct! The vault is opening…";
    answerInput.disabled = true;
    unlockButton.disabled = true;
    $("#vaultIllustration").classList.add("unlocked");
    // Start the dedicated finale track from this real user gesture. It is
    // held at zero volume until the letter appears, then crossfades smoothly.
    beginFinalLetterSoundtrack();
    setTimeout(() => {
      $("#finalLetterBody").textContent = config.finalLetter || "You are appreciated more than words can say. Keep smiling and keep being your wonderful self. ♡";
      $("#finalLetterSignoff").textContent = config.finalLetterSignoff || "Always cheering for you ♡";
      showScreen("finalLetter");
    }, 1250);
  });
  $("#toGame").addEventListener("click", () => showScreen("game"));
  $("#exitWebsite").addEventListener("click", () => showScreen("exit"));
  $("#closeExperience").addEventListener("click", () => {
    try { window.close(); } catch (error) { /* The browser may block closing a tab it did not open. */ }
    $("#exitFallback").hidden = false;
  });

  // Catch-the-hearts game: tap hearts, 30 seconds, persistent local high score.
  function updateHighScore() { $("#highScore").textContent = bestScore.toLocaleString(); }
  function updateGameStats() { $("#gameTimer").textContent = String(gameTime).padStart(2, "0"); $("#gameScore").textContent = gameScore; }
  function spawnHeart() {
    if (!gameRunning) return;
    const layer = $("#gameHeartLayer");
    const heart = document.createElement("button");
    heart.type = "button"; heart.className = "catch-heart"; heart.textContent = Math.random() > .18 ? "♥" : "♡";
    heart.setAttribute("aria-label", "Catch this heart");
    const x = 5 + Math.random() * 87; const y = 8 + Math.random() * 78;
    heart.style.left = `${x}%`; heart.style.top = `${y}%`;
    heart.style.color = ["#df7797", "#d990a8", "#e8a6b6", "#c97995"][Math.floor(Math.random() * 4)];
    const size = 34 + Math.random() * 19; heart.style.fontSize = `${size}px`;
    heart.addEventListener("click", () => {
      if (!gameRunning || heart.classList.contains("caught")) return;
      gameScore += 1; updateGameStats(); heart.classList.add("caught");
      setTimeout(() => heart.remove(), 240);
    });
    layer.appendChild(heart);
    setTimeout(() => { if (heart.isConnected && !heart.classList.contains("caught")) heart.remove(); }, 1650);
  }
  function startGame() {
    if (gameRunning) return;
    gameRunning = true; gameTime = 30; gameScore = 0;
    $("#gameHeartLayer").innerHTML = "";
    $("#gameEndOverlay").hidden = true;
    $("#gameBoard").classList.add("running");
    $("#gameBoardHint").hidden = false;
    $("#startGame").hidden = true;
    $("#playAgain").hidden = true;
    $("#gameFooter").textContent = "Tap every heart before it floats away!";
    updateGameStats();
    spawnHeart();
    clearInterval(timerInterval); clearInterval(heartSpawnInterval);
    timerInterval = setInterval(() => {
      gameTime -= 1; updateGameStats();
      if (gameTime <= 0) endGame();
    }, 1000);
    heartSpawnInterval = setInterval(spawnHeart, 570);
  }
  function endGame() {
    if (!gameRunning) return;
    gameRunning = false;
    $("#exitWebsite").hidden = false;
    clearInterval(timerInterval); clearInterval(heartSpawnInterval);
    $("#gameHeartLayer").innerHTML = "";
    $("#gameBoard").classList.remove("running");
    $("#gameEndOverlay").hidden = false;
    $("#finalScore").textContent = gameScore;
    if (gameScore > bestScore) {
      bestScore = gameScore;
      localStorage.setItem("birthdayHeartHighScore", String(bestScore));
      $("#gameFooter").textContent = "New high score! You caught the most hearts yet. ✨";
    } else {
      $("#gameFooter").textContent = "Lovely catching! Your best score is saved on this device.";
    }
    updateHighScore();
    $("#startGame").hidden = true;
    $("#playAgain").hidden = false;
  }
  $("#startGame").addEventListener("click", startGame);
  $("#playAgain").addEventListener("click", startGame);

  // Initialise personalisable text and photo fallback.
  const foodImage = $("#favoriteFoodImage");
  foodImage.src = "assets/photos/favorite-food.jpeg";
  setImageOrPlaceholder(foodImage, $("#favoriteFoodPlaceholder"));
  const name = String(config.birthdayName || "Birthday Star").trim();
  $("#birthdayTitle").textContent = ` Happy Birthday, ${name}!`;
  $("#birthdaySubheading").textContent = config.birthdaySubheading || "Make a wish, birthday star ✨";
  $("#birthdayLetterText").textContent = config.birthdayLetter || "Wishing you a day filled with laughter, little surprises, and everything that makes you happy. Happy birthday! ♡";
  $("#finalLetterBody").textContent = config.finalLetter || "You are appreciated more than words can say. Keep smiling and keep being your wonderful self. ♡";
  $("#finalLetterSignoff").textContent = config.finalLetterSignoff || "Always cheering for you ♡";
  $("#highScore").textContent = bestScore.toLocaleString();
  $("#favoriteFoodCaption").textContent = config.favoriteFoodCaption || "A delicious little favorite. ♡";
  $("#birthdaySignoff").textContent = config.birthdaySignoff || "With lots of warmth ♡";
})();