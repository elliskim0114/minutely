# make something

build your first app with ai. no coding experience needed. seriously.

## what is this?

this is the starter project for **make something** — a free, live tutorial where
you build a real app using an ai that writes code for you. you describe what you
want, the ai builds it, and you see it live in your browser.

## who this is for

- complete beginners — zero coding knowledge needed
- people with ideas who don't know where to start
- anyone curious about building with ai

## setup

### mac
1. **download the codex app** — [codex app for mac](https://openai.com/codex)
2. **download this project** — [download ZIP](https://github.com/filip-pilar/makesomething/archive/refs/heads/main.zip)
3. **unzip** the downloaded file
4. **open the folder in codex** — drag it in or use File > Open Folder
5. **type `$install-mac`** to set things up
6. **type `$start`** and start building

### windows
1. **download the codex app** — [codex app on microsoft store](https://apps.microsoft.com/)
2. **download this project** — [download ZIP](https://github.com/filip-pilar/makesomething/archive/refs/heads/main.zip)
3. **unzip** the downloaded file
4. **open the folder in codex** — drag it in or use File > Open Folder
5. **type `$install-windows`** to set things up
6. **type `$start`** and start building

## commands

| command | what it does |
|---------|-------------|
| `$install-mac` | set up your Mac to run the project |
| `$install-windows` | set up your Windows PC to run the project |
| `$start` | brainstorm an idea and start building |
| `$imlost` | get unstuck when you're confused |
| `$fixit` | fix problems automatically |
| `$deploy` | put your app on the internet with a shareable link |

## what's in the box

this project comes pre-loaded with everything you need to build a real app.
you don't need to know what any of it is — the ai handles it all.

## minutely mac release flow

for each new mac version:

1. run `npm run release:mac -- 0.1.1` (replace with your next version)
2. run the printed git commands in terminal
3. open the printed github release url
4. upload the generated zip from `dist-desktop/`

that gives you a clean public download page with version history + download counts.

### notarized mac build (no "cannot verify malware" popup)

before building, set these env vars in terminal:

1. `export APPLE_ID="your-apple-id@email.com"`
2. `export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"`
3. `export APPLE_TEAM_ID="YOURTEAMID"`

then run:

1. `npm run desktop:dist` (this now generates a notarized `.zip` when credentials are set)

if those vars are set, notarization runs automatically after signing.
