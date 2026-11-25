# Third-Party Notices

ApexTrace includes the following third-party assets and libraries. The same list is shown in the app under
**Settings > App info > Open-source licenses** (`src/utils/credits.ts`).

## Icons

### Game Icons — CC BY 3.0

Source: https://game-icons.net (repository: https://github.com/game-icons/icons)
License: Creative Commons Attribution 3.0 Unported — https://creativecommons.org/licenses/by/3.0/

Used through `react-icons/gi` (CombatLog, Sidebar) and as path data in `src/assets/playstyleIcons.ts`
(match playstyle card watermarks). **Modified:** the playstyle icons are recolored (white, reduced opacity),
resized and rotated.

| Author | Icons |
| --- | --- |
| Lorc | crown, crossed-swords, ankh, lightning-arc, trophy, broken-shield, broken-heart, crosshair-arrow, reaper-scythe, sword-clash, robot-golem, tombstone, spyglass, high-five, bullets, gunshot |
| Delapouite | crosshair, star-medal, wave-surfer, peace-dove, backpack, atlas, angry-eyes, broom, shaking-hands, military-fort, life-bar, flag-objective, sitting-dog, rat, delivery-drone, photo-camera |
| Sbed | falling, ammo-box |
| Carl Olsen | flame |
| Aussiesim | card-ace-spades |
| DarkZaitzev | hooded-assassin |
| John Colburn | pistol-gun |

Authors were matched against the repository folders by comparing path data (2026-11-25).

### Font Awesome Free 5 — CC BY 4.0

Icons by Fonticons, Inc. — https://fontawesome.com
License: Creative Commons Attribution 4.0 International — https://creativecommons.org/licenses/by/4.0/
Used through `react-icons/fa`.

### Bootstrap Icons — MIT

https://icons.getbootstrap.com — Copyright (c) 2019-2024 The Bootstrap Authors. Used through `react-icons/bs`.

### Circum Icons — MPL-2.0

https://github.com/Klarr-Agency/Circum-Icons — License: https://www.mozilla.org/en-US/MPL/2.0/
Used unmodified through `react-icons/ci` (weapons tab). Source code of the covered files is available at the repository above.

### css.gg — MIT

https://github.com/astrit/css.gg — Copyright (c) 2019 Astrit Malsija. Used through `react-icons/cg` (weapons tab).

## Libraries (MIT)

React, react-dom, react-icons, i18next, react-i18next, i18next-browser-languagedetector, @supabase/supabase-js,
Recharts, Driver.js, html2canvas.

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of
the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
IN THE SOFTWARE.
```

Each library's full copyright line is in its `LICENSE` file under `node_modules/<package>/`.
