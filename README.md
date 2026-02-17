# Clara Automator - Agentic Workflow Engine

An autonomous agentic system inspired by Clara Labs, designed for robust, high-availability workflow automation.

## Features

*   **Agentic State Machine:** Autonomous task progression (Draft -> Sending -> Waiting -> Retrying -> Done).
*   **Resilient Retries:** Built-in exponential backoff and jitter for API failures.
*   **Pluggable Connectors:** Extensible interface for Email, Calendar, Git, and custom APIs.
*   **Typesafe:** Written in TypeScript for reliability.

## Quick Start

1.  **Clone:** `git clone ...`
2.  **Install:** `npm install`
3.  **Run:** `npm start`

## Architecture

The system operates on a **Task Queue** model:
1.  **Ingest:** New tasks enter the queue (e.g., "Schedule meeting with Bob").
2.  **Process:** The engine picks up tasks and executes the appropriate workflow.
3.  **Monitor:** Failed tasks are retried with exponential backoff.
4.  **Complete:** Successful tasks are archived.

## Usage

```typescript
import { Engine } from './src/engine';

const engine = new Engine();
engine.schedule('Meeting with Bob', { email: 'bob@example.com' });
engine.start();
```
