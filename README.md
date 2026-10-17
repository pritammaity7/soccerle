# Soccerle

A football guessing game built with Next.js, TypeScript and Tailwind CSS. Guess the daily footballer by nationality, club, position, age and more — or play a custom game with your own answers.

## Tech Stack

- **Next.js 16** (App Router) + **TypeScript 5**
- **Tailwind CSS 4**
- **shadcn/ui** primitives (toast)

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command         | Description                                  |
| --------------- | -------------------------------------------- |
| `npm run dev`   | Start the dev server on port 3000            |
| `npm run build` | Production build (standalone output)         |
| `npm start`     | Run the production server                    |
| `npm run lint`  | Run ESLint                                   |

## Project Structure

```
src/
├── app/
│   ├── page.tsx          # Game UI
│   ├── layout.tsx        # Root layout
│   └── api/
│       ├── daily/        # Daily puzzle (answer + guess)
│       ├── custom/       # Custom game mode
│       └── footballers/  # Footballer data
├── components/ui/        # shadcn/ui toast components
├── hooks/                # use-toast
└── lib/
    ├── game/             # Game data & crypto (daily answer seed)
    └── utils.ts          # cn() helper
```

## Game Rules

- One footballer per day, identical for every player.
- Each guess shows how close you are on nationality, club, position, age and more.
- Unlimited guesses until you get it right, then share your score grid.
