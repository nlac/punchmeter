# Punchmeter

Heavy bag training assistant for mobile browser using HTML and TypeScript, without any framework or library.

## Features

- **Sensor Integration**: Reads acceleration sensor and microphone data to detect punches
- **Intelligent Detection**: Combines dual signals after voice-assisted calibration to identify punches and measure their relative strength
- **100% Browser-Based**: Runs entirely in the browser with no server dependency
- **Real-Time Statistics**: Displays live training metrics including:
  - Number of weak/strong/total punches
  - Average punch strength
  - Elapsed time
  - Strong punch percentage
- **Voice Assistance**: Audio feedback and guidance throughout calibration and training
- **Fallback Support**: Gracefully emulates sensor input for browsers without device motion support (testing/demo)

## How It Works

### Calibration
The app uses a two-phase calibration process to accurately detect punches:

1. **Sound Delay Calibration**: Records the time offset between audio and sensor signals by detecting a single punch after a beep
2. **Power Calibration**: Establishes the baseline for punch strength using 3 reference power punches

### Training
Once calibrated, the app monitors sensor data to:
- Detect punch events by analyzing acceleration patterns
- Calculate relative punch strength (normalized 0-1)
- Filter out noise below a configurable threshold
- Categorize punches as "weak" or "strong" based on strength threshold
- Provide real-time feedback every 25 strong punches

## Tech Stack

- **Language**: TypeScript
- **Build Tool**: Vite
- **Charting**: Chart.js with date adapter
- **Architecture**: No external UI framework, vanilla DOM manipulation with custom rule engine

## Development

### Setup
```
npm install
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
```

### Project Structure
- `src/main.ts` - Application entry point with rule engine setup
- `src/lib/` - Core functionality modules:
  - `rule-engine.ts` - Custom synchronous rule engine for state management
  - `emulate-sensor.ts` - Device motion sensor detection and fallback emulation
  - `chart-wrapper.ts` - Visualization layer
  - `sound.ts` - Text-to-speech and audio utilities
  - `ui.ts` - DOM element management
- `src/state/` - State management:
  - `calibrate.ts` - Calibration workflows
  - `train.ts` - Training session state and logic
  - `chart.ts` - Chart state management
  - `rules-ids.ts` - Rule trigger identifiers
- `src/config.json` - Configuration constants

## Configuration

The app includes configurable parameters in `src/config.json`:
- `weakLimitMap` - Strength thresholds for weak/strong punch classification
- `maxTime` - Window size for calibration analysis
- `emulatedTimerFreq` - Frequency of emulated sensor events

## Architecture Highlights

- **Custom Rule Engine**: Lightweight, synchronous pattern-matching system that decouples high-level application logic from DOM events
- **Modular State**: Clean separation between calibration, training, and chart states
- **Decorator-Based Triggers**: PropertyDecorator for reactive state updates using `@Trigger()`
- **Sensor Abstraction**: Unified interface for real device motion sensors and emulated fallback

<img src="./pm.jpg" alt="punchmeter screenshot" width="25%" />
