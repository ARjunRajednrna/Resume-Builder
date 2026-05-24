# Resume Builder

AI-powered resume tailoring for job descriptions. Upload a PDF resume, paste a job description, and get an optimized version with match-score feedback.

## Prerequisites

- Node.js 18+
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (`GEMINI_API_KEY`)

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` in the project root:

```env
GEMINI_API_KEY=your_key_here
```

3. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `npm run dev`  | Start dev server         |
| `npm run build`| Production build         |
| `npm run start`| Start production server  |
| `npm run lint` | Run ESLint               |

## Stack

- [Next.js](https://nextjs.org) 16 (App Router)
- React 19, TypeScript, Tailwind CSS 4
- Google Gemini (`@google/generative-ai`)
- PDF parsing (`pdf-parse`, `pdf-lib`)
