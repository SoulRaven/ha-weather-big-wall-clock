# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### [1.0.7] 2026-03-27
- add new images and video for "light intensity shower rain"

### [1.0.6] 2026-03-27

- add new images and video for heavy rain

### [1.0.5] - 2026-03-27

- Fixed the missing alert icon for rain.
- small fixed on the css alignment of the alerts

## [1.0.4] - 2026-03-11

### Fixed

- `IconManager`: Fixed day/night icon switching logic so weather icons correctly
  transition between day and night variants when the `hass:is_night` state
  changes.
- Current weather block: Fixed styling of the `.current-weather` section (layout
  and visual presentation of the right-panel weather display).
- Added the missing CHANGELOG.md file with the latest changes.

### Changed

- `_backgroundVideo.scss`: Refactored media layer styles — added `will-change:
  visibility`, hardware-accelerated transforms (`translate3d`,
  `backface-visibility`,
  `perspective`), and explicit `.active` / `.inactive` opacity states for
  smoother
  video/image transitions.
- `mediaManager`: Adjusted minimum transition run counter (`minRuns`) for media
  playback cycling.

### Build

- `webpack.config.js`: Removed `./media/video/` from `CopyPlugin` patterns;
  video
  files are now served exclusively from `dist/`.
- `webpack.config.js`: Fixed production-mode settings so the `ZipPlugin`
  correctly
  generates `ha-weather-big-wall-clock.zip` only during production builds.

### CI

- `hacs-validate.yml`: Fixed workflow trigger configuration — now correctly
  fires on
  pushes to `main`, `releases/**` branches, and `v*` tags.

### Documentation

- Fixed incorrect HACS repository installation link in README.md.
- Added night-mode card screenshot to README.md.
- Resized card screenshots for better readability.
- Added GitHub Stars, Watchers, and Forks badges.
- Improved overall README.md structure and prose.

## [1.0.1] - 2026-02-27

### Added

- Webpack production build now automatically generates a distributable ZIP
  archive
  (`ha-weather-big-wall-clock.zip`) via `zip-webpack-plugin`.
- Added `brand/` folder containing `logo.png` and `icon.png` for HACS branding.
- Added GitHub Actions status and release badges to README.md.

### Documentation

- Improved and expanded README.md with full configuration examples, feature
  list,
  and known issues section.
- Added card screenshot (day mode) to README.md.
- Fixed YAML configuration example formatting.

## [1.0.0] - 2026-02-27

### Added

- Initial release of the **ha-weather-big-wall-clock** Home Assistant Lovelace
  card.
- Animated video and static image backgrounds that change with current weather
  conditions (60+ condition folders).
- Current weather display: condition icon, temperature, description, and metrics
  panel (humidity, wind, pressure, etc.).
- 5-day weather forecast panel.
- Day/night mode switching driven by a configurable Home Assistant binary sensor
  entity.
- Multiple weather icon sets: OWM (OpenWeatherMap), amCharts, Basmilius, MET.no,
  and makinThings.
- Weather alert icons (NRK.no palette) with awareness level and type mapping.
- Configurable clock with hours, minutes, seconds, and AM/PM support.
- Configurable date display.
- Locale support for English (`en`) and Romanian (`ro`).
- Local sensor slots for displaying arbitrary HA sensor values.
- Kiosk mode support (hides HA sidebar and header).
- Time synchronisation via a `SharedWorker` (`time.worker.js`).
- HACS compatibility: `plugin` category, minimum Home Assistant `2026.2.3`.
- Pre-compiled `dist/` bundle included for users who install without building.
- GitHub Actions workflow for HACS validation (`hacs-validate.yml`).
- GitHub Actions workflow for showcase README validation (`showcase.yml`).

### Fixed

- `hacs.json` corrected to pass HACS integration validation checks.

[Unreleased]: https://github.com/SoulRaven/ha-weather-big-wall-clock/compare/v1.0.4...HEAD

[1.0.4]: https://github.com/SoulRaven/ha-weather-big-wall-clock/compare/v1.0.1...v1.0.4

[1.0.1]: https://github.com/SoulRaven/ha-weather-big-wall-clock/compare/v1.0.0...v1.0.1

[1.0.0]: https://github.com/SoulRaven/ha-weather-big-wall-clock/releases/tag/v1.0.0
