# OpenClaw Admin Dashboard

A modern web-based administration panel for [OpenClaw](https://github.com/openclaw/openclaw) — the open-source AI agent framework.

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **🔧 Configuration Manager** — Edit your OpenClaw config (agents, bindings, channels, models, providers) through a visual UI instead of raw JSON
- **📊 Monitoring Dashboard** — Real-time view of session activity, token usage, costs, and model distribution
- **⏰ Cron Manager** — Create, edit, enable/disable, and manually trigger cron jobs with full run history
- **🤖 Agent Management** — Configure agents, their models, workspaces, and Telegram/WhatsApp bindings
- **📱 Telegram Integration** — Manage multiple Telegram bot accounts, DM policies, allowlists, and stream modes
- **💬 WhatsApp Support** — Configure WhatsApp gateway connections
- **🔑 Provider Config** — Set up API keys and base URLs for model providers (Anthropic, OpenAI, etc.)
- **🏥 Health Checks** — Monitor Telegram bot connectivity and SSH tunnel status
- **🎨 Dark Theme** — Clean, responsive dark UI built with Tailwind CSS

## Architecture

```
Browser → Next.js App (port 3000) → SSH Tunnel → OpenClaw Gateway (port 18789)
```

The admin panel connects to your OpenClaw instance via SSH, reading and writing the configuration file directly. No additional API server is needed — it uses the same machine's filesystem through SSH.

### Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **SSH:** ssh2 (Node.js SSH client)
- **Runtime:** Node.js 22+

## Getting Started

### Prerequisites

- Node.js 22+
- SSH access to the machine running OpenClaw
- OpenClaw installed and configured

### Installation

```bash
git clone https://github.com/gangachanga/openclaw-admin.git
cd openclaw-admin
npm install
```

### Configuration

Create a `.env.local` file:

```env
SSH_HOST=localhost       # or your remote host
SSH_PORT=22
SSH_USER=your-user
SSH_KEY_PATH=~/.ssh/id_rsa
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
# For memory-constrained environments (e.g., Raspberry Pi)
NODE_OPTIONS="--max-old-space-size=512" npm run build
npm start
```

## Project Structure

```
src/
├── app/
│   ├── config/          # Configuration editor page
│   ├── monitoring/      # Session & cost monitoring
│   ├── cron/            # Cron job management
│   ├── api/
│   │   ├── config/      # Config read/write API
│   │   ├── cron/        # Cron CRUD API
│   │   ├── ssh/         # SSH tunnel & health
│   │   └── avatars/     # Bot avatar proxy
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Home / dashboard
├── components/
│   └── ui/              # Reusable UI components
└── lib/
    ├── ssh-client.ts    # SSH connection manager
    ├── types.ts         # TypeScript type definitions
    └── utils.ts         # Utility functions
```

## Security

- **No credentials in code** — All sensitive data (SSH keys, tokens) is loaded from environment variables or the OpenClaw config file at runtime
- **SSH-based access** — Communication with the gateway uses SSH tunneling
- **Allowlist support** — Telegram bots can be restricted to specific user IDs
- **`.env` files are gitignored** — No risk of committing secrets

## Deployment

### Systemd Service (Linux)

```bash
[Unit]
Description=OpenClaw Admin Dashboard
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/openclaw-admin
ExecStart=/usr/bin/node node_modules/.bin/next start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Resource-Constrained Environments

For Raspberry Pi or similar:

```bash
# Build with limited memory
NODE_OPTIONS="--max-old-space-size=512" npm run build

# Run with limited memory
NODE_OPTIONS="--max-old-space-size=256" npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

## License

MIT

## Links

- [OpenClaw](https://github.com/openclaw/openclaw) — The AI agent framework
- [OpenClaw Docs](https://docs.openclaw.ai) — Documentation
- [Discord](https://discord.com/invite/clawd) — Community
