# mdnotes
Local first notes app with rich text built using Wails v2, Svelte 5, TypeScript, Tailwind CSS v4, shadcn-svelte components (bits-ui), and Vite 8.

## Project Structure

```
├── frontend/          # Svelte frontend
│   ├── src/
│   └── package.json
├── app.go            # Backend logic
└── main.go           # Entry point
```

## Features

- Svelte 5 with TypeScript
- Tailwind CSS v4 for styling
- shadcn-svelte components (bits-ui)
- Vite 8 for frontend tooling
- Go backend with Wails v2

## Requirements

- Go 1.26+
- Node.js 20.19+ or 22.12+ (required by Vite 8)
- Wails CLI v2.11.0+

## Quick Start

```bash
# Create new project
git clone https://github.com/dduraipandian/mdnotes.git

# Install dependencies
cd mdnotes/frontend
npm install

# Start development
cd ..
wails dev
```

## Development

Add shadcn components:
```bash
npx shadcn-svelte@latest add [component-name]
```

## Building

Build production binary:
```bash
wails build
```

## License

Apache License 2.0