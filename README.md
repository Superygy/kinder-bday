# A Little Birthday Surprise — website starter

A responsive, no-build birthday website. It uses plain HTML, CSS, and JavaScript, so you can open it locally or deploy it to GitHub Pages, Netlify, or Vercel as a static site.

## Run it

1. Extract the project folder.
2. Open `index.html` in a browser, or run a local static server from this folder (for example, VS Code Live Server).
3. Tap the bouquet on the homepage. The background track starts immediately from that click, then the egg-opening experience begins. The top-right music control can still pause or resume it manually.

## Personalise it before delivering to your client

Open `config.js`. This is the main editing file:

- `birthdayName` — birthday person's name.
- `relationshipStart` — date/time for the days-hours-minutes-seconds counter. Format: `YYYY-MM-DDTHH:mm:ss` using the intended local time.
- `vaultQuestion` and `vaultAnswer` — the secret vault prompt and accepted answer.
- `birthdayLetter`, `birthdaySignoff`, `finalLetter`, `finalLetterSignoff` — the birthday note and secret letter.
- `favoriteFoodCaption` — caption below the favorite-food photo.
- `edits` — four short video paths and captions for the **Her little edits** section.
- `favouriteSong` — featured song title, artist, note, and audio path for the new song section.

## Add the photos

Put the files in `assets/photos/` using these default names, or change the paths in `config.js`:

- `favorite-food.jpg`

The page displays a graceful designed placeholder until a photo is added. Use JPG, PNG, or WebP and keep the file names consistent with the config.

## Add background music and the favourite song

- Copy the optional site-wide background track to `assets/audio/background-music.mp3`. It starts as soon as the visitor clicks the homepage bouquet (the first intentional interaction). The music button is included on every screen and can still pause/resume the track manually.
- Copy a separate finale track to `assets/audio/final-letter-music.mp3` (or change `finalLetterMusic` in `config.js`). When the correct vault answer is submitted, the finale track is prepared silently; as the final letter opens, it crossfades in while the original background track fades out. The finale track then continues through the remaining game and closing screens.
- Copy the client's featured favourite song to `assets/audio/favourite-song.mp3`, or change `favouriteSong.audio` in `config.js`.
- Update `favouriteSong.title`, `favouriteSong.artist`, and `favouriteSong.note` in `config.js`.

The featured song has its own play/pause control and seek bar. The site-wide background track pauses whenever a video edit or the featured song starts. It automatically resumes from the exact saved position when the foreground media is paused or finishes. If the visitor had left the background track off, it stays off. Only one edit/song plays at a time, and leaving the edits or favourite-song screen pauses its media. Starting the background track manually pauses any foreground video/song. Browsers block autoplay, so the visitor must tap a play control.

## Add the four video edits

Copy four MP4 videos into `assets/videos/` using these default names:

- `edit-01.mp4`
- `edit-02.mp4`
- `edit-03.mp4`
- `edit-04.mp4`

The **Her little edits** section appears immediately after the birthday counter. It shows four vertical video cards with captions and designed placeholders until each video is added. You can change video paths and captions through the `edits` array in `config.js`. When any edit starts, the background track pauses; it resumes from its saved timestamp when the edit is paused or reaches the end. Starting another edit pauses the previous edit without accidentally restarting background music. MP4 (H.264 video with AAC audio) is recommended for broad browser compatibility. Videos play only when the visitor presses the native video controls.

## Main interactions

1. Tap the bouquet.
2. Pull each metallic PEEL tab diagonally outward and downward. Both tabs must be peeled before the package separates into two side-by-side halves.
3. Tap `Favorite food` to open the photo detail, or `Main event` to continue.
4. The `No` button dodges twice, then disappears after the third press.
5. Tap all five candles to toggle them on/off. The blow button appears only when all five are lit.
6. Blowing the candles reveals the birthday letter, then the time counter.
7. Tap **Let's see your little edits** to go directly to the four-video **Her little edits** section.
8. The **Our favourite song** screen follows the edits. It includes a custom play/pause control and seek bar for the featured song.
9. The vault checks the answer only after the visitor presses Enter or clicks **Enter answer**. A wrong answer keeps the letter locked. This is a playful front-end gate, not secure access control.
10. The heart-catching game runs for 30 seconds. The high score is saved in the visitor's browser using local storage. After the first completed round, an **Exit the website** button appears and opens a closing screen. Browsers generally block a page from closing a tab that the visitor opened manually, so the final screen explains that the visitor can close the tab.

## Customisation notes

- The egg uses a custom scalable SVG illustration inspired by the supplied Kinder Joy reference, with a white upper shell, red lower shell, blue rim and two separate foil pull tabs. It is a custom fan-made visual, not official manufacturer artwork. This keeps the page lightweight and avoids relying on a copyrighted packaging image.
- The site uses Baloo 2 and Nunito from Google Fonts, with rounded system-font fallbacks if the visitor is offline.
- No framework, package install, or build command is required.


## Audio hand-off behaviour (V4)

- If background music is playing, starting any edit video or the favourite song pauses it without resetting its playback position.
- Pausing or finishing the foreground video/song resumes background music from that exact position.
- If background music was off before foreground playback, it remains off afterwards.
- The favourite song and edit videos do not play over one another; starting one pauses the others.
- Navigating away from the edits or favourite-song section pauses its media and restores background music when appropriate.
- The fixed music button can manually take control: starting background music pauses any currently playing foreground media.


## Background music start behaviour (V5)

- The background music begins immediately when the visitor clicks the homepage bouquet. This click is used as the browser-approved user gesture for audio playback; no sound is forced before interaction.
- The bouquet click starts the soundtrack and then opens the Kinder Joy-inspired egg.
- The V4 foreground-media hand-off remains unchanged: edit videos and the favourite song pause the background track and it resumes from its saved position when foreground playback is paused or finishes.


## Final-letter soundtrack transition

- The successful vault submission starts the dedicated `finalLetterMusic` track from the visitor's click, avoiding a delayed autoplay request when the letter screen appears.
- As the final letter opens, the original background soundtrack fades down while the finale track fades up over approximately two seconds.
- The finale track loops continuously through the heart-catching game and closing screen. The fixed music button controls the active soundtrack after the transition.
- Add `assets/audio/final-letter-music.mp3` to enable this feature. If that file is missing or cannot be played, the original soundtrack remains available as a fallback.
