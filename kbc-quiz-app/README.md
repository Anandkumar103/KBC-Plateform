
# KBC-style Quiz App (Demo)

## What is inside
This is a simple KBC (Kaun Banega Crorepati) style quiz demo built with:
- Node.js + Express backend
- SQLite database (file `kbc.db` will be created automatically)
- Frontend: HTML, CSS, Vanilla JS

## How to run (Windows / Linux / Mac)
1. Unzip the downloaded archive.
2. Open the project folder in VS Code.
3. Open a terminal in the project root.
4. Install dependencies:
   ```bash
   npm install
   ```
5. Start the server:
   ```bash
   npm start
   ```
   or for development (auto-restart):
   ```bash
   npm run dev
   ```
6. Visit `http://localhost:3000` in your browser.

## Notes
- If you get a Node experimental warning, it's safe to ignore.
- If port 3000 is busy, set environment variable `PORT` before running:
  ```bash
  PORT=4000 npm start
  ```
  (Windows PowerShell: ` $env:PORT=4000; npm start`)

## Project structure
```
kbc-quiz-app/
├─ package.json
├─ server.js
├─ public/
│  ├─ index.html
│  ├─ css/style.css
│  └─ js/app.js
└─ kbc.db (created automatically)
```
