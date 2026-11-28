# Third party audio assets

The following files were added to the game on November 28, 2026. Their source pages identify them as CC0. Credit is optional; it is recorded here so future replacements can be reviewed.

| Game files | Source and author | License |
| --- | --- | --- |
| `src/assets/music/battle/jrpg-battle-hydrogene.mp3` | [JRPG Epic Rock Battle Theme #1](https://opengameart.org/content/jrpg-epic-rock-battle-theme-1) by HydroGene; original `jrpg_battle_loop.mp3` | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) |
| `src/assets/music/battle/hope-mintodog.ogg` | [Hope (Orchestral battle music)](https://opengameart.org/content/hopeorchestral-battle-music) by MintoDog; original `hope_orchestral_battle_music_bpm165.ogg` | CC0 |
| `public/assets/audio/effects/card-draw.wav`, `card-play.wav`, `card-shuffle.wav` | [Card Game sounds](https://opengameart.org/content/card-game-sounds) by HaelDB; `draw.wav`, `playcard.wav`, `shuffle.wav` from `Cardsounds.zip` | CC0 |
| `public/assets/audio/effects/bow-release.wav`, `weapon-swish.wav` | [Battle Sound Effects](https://opengameart.org/content/battle-sound-effects) by artisticdude; `Bow.wav` and `swish_2.wav` | CC0 among the offered licenses |

Battle tracks live in `src/assets/music/battle/`. Add MP3, OGG, WAV, M4A, or FLAC files there and rebuild the site to include them. The player shuffles the built-in battle theme together with every track in that folder, plays each once per cycle, and avoids repeating a track across cycle boundaries.

The existing audio files in `public/assets/audio/` predate this inventory. Their origins should be recorded before redistribution or replacement. The [Sonniss GDC archive](https://sonniss.com/gameaudiogdc/) offers professionally recorded effects under its [game audio bundle license](https://sonniss.com/gdc-bundle-license/), but its multi-gigabyte bundles were not added to this repository.
