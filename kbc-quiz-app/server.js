// server.js - KBC-style quiz backend using Express + SQLite
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'kbc.db');

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// open/create DB
const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) return console.error('DB open error', err);
  console.log('Connected to SQLite DB:', DB_FILE);
});

// create tables and seed if needed
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      coins INTEGER DEFAULT 0,
      highscore INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY,
      question TEXT,
      options TEXT,
      correct INTEGER,
      difficulty TEXT,
      prize INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS daily_claims (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      date TEXT,
      UNIQUE(user_id, date)
    )
  `);

  // seed questions if empty
  db.get('SELECT COUNT(*) AS cnt FROM questions', (err, row) => {
    if (err) return console.error(err);
    if (row.cnt === 0) {
      console.log('Seeding questions...');
      const prizeLadder = [
        1000,2000,4000,8000,16000,32000,64000,125000,250000,500000,
        1000000,2500000,10000000,30000000,70000000
      ];
      const questions = [
        {q: "What is the capital of India?", opts:["Mumbai","New Delhi","Kolkata","Chennai"], c:1, diff:"easy"},
        {q: "Who wrote the play 'Hamlet'?", opts:["Charles Dickens","William Shakespeare","Leo Tolstoy","Mark Twain"], c:1, diff:"easy"},
        {q: "H2O is the chemical formula for what?", opts:["Salt","Carbon dioxide","Water","Oxygen"], c:2, diff:"easy"},
        {q: "Which planet is known as the Red Planet?", opts:["Earth","Venus","Mars","Jupiter"], c:2, diff:"easy"},
        {q: "Who was the first Prime Minister of India?", opts:["Mahatma Gandhi","Jawaharlal Nehru","Sardar Patel","Subhas Chandra Bose"], c:1, diff:"easy"},
        {q: "In computing, CPU stands for?", opts:["Central Processing Unit","Control Program Unit","Computer Processing Unit","Central Program Unit"], c:0, diff:"medium"},
        {q: "The river Ganga flows into which body of water?", opts:["Bay of Bengal","Arabian Sea","Indian Ocean","Yellow Sea"], c:0, diff:"medium"},
        {q: "Who discovered penicillin?", opts:["Marie Curie","Alexander Fleming","Louis Pasteur","Gregor Mendel"], c:1, diff:"medium"},
        {q: "Which country hosted the 2016 Summer Olympics?", opts:["China","Brazil","UK","Russia"], c:1, diff:"medium"},
        {q: "Who is the author of the autobiography 'Wings of Fire'?", opts:["A. P. J. Abdul Kalam","Vikram Sarabhai","C. V. Raman","S. Radhakrishnan"], c:0, diff:"medium"},
        {q: "Which artist painted the famous work 'Guernica'?", opts:["Pablo Picasso","Vincent van Gogh","Claude Monet","Leonardo da Vinci"], c:0, diff:"hard"},
        {q: "Which ancient philosopher wrote 'The Republic'?", opts:["Aristotle","Plato","Socrates","Epicurus"], c:1, diff:"hard"},
        {q: "What is the Big-O time complexity of binary search?", opts:["O(n)","O(log n)","O(n log n)","O(1)"], c:1, diff:"hard"},
        {q: "What is the highest mountain in the world (above sea level)?", opts:["K2","Mount Everest","Kangchenjunga","Lhotse"], c:1, diff:"hard"},
        {q: "Which treaty officially ended World War I?", opts:["Treaty of Paris","Treaty of Versailles","Treaty of Tordesillas","Treaty of Utrecht"], c:1, diff:"hard"}
      ];

      const insertStmt = db.prepare('INSERT INTO questions(id, question, options, correct, difficulty, prize) VALUES (?, ?, ?, ?, ?, ?)');
      questions.forEach((qq, idx) => {
        const id = idx + 1;
        insertStmt.run(id, qq.q, JSON.stringify(qq.opts), qq.c, qq.diff, prizeLadder[idx]);
      });
      insertStmt.finalize(() => console.log('Questions seeded.'));
    } else {
      console.log('Questions already present:', row.cnt);
    }
  });
});

// prize ladder & milestones
const PRIZE_LADDER = [
  1000,2000,4000,8000,16000,32000,64000,125000,250000,500000,
  1000000,2500000,10000000,30000000,70000000
];
const SAFE_MILESTONES = {5:16000, 10:500000};

// API routes

// Register / get user
app.post('/api/users/register', (req, res) => {
  const { username } = req.body;
  if (!username || username.trim().length < 2) {
    return res.status(400).json({ error: 'username required (min 2 chars)' });
  }
  const uname = username.trim();
  db.run('INSERT OR IGNORE INTO users(username) VALUES (?)', [uname], function(err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    db.get('SELECT * FROM users WHERE username = ?', [uname], (err, row) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ user: row });
    });
  });
});

// Prize ladder
app.get('/api/prize-ladder', (req, res) => {
  const ladder = PRIZE_LADDER.map((p, i) => ({level: i+1, prize: p}));
  res.json({ ladder, safeMilestones: SAFE_MILESTONES });
});

// Get question by index (1..15)
app.get('/api/questions', (req, res) => {
  const idx = parseInt(req.query.index || '1', 10);
  if (isNaN(idx) || idx < 1 || idx > PRIZE_LADDER.length) {
    return res.status(400).json({ error: 'index must be between 1 and 15' });
  }
  db.get('SELECT id, question, options, difficulty, prize FROM questions WHERE id = ?', [idx], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'question not found' });
    row.options = JSON.parse(row.options);
    res.json({ question: row });
  });
});

// Submit answer
app.post('/api/answer', (req, res) => {
  const { username, questionId, selected } = req.body;
  if (!username || !questionId || typeof selected !== 'number') {
    return res.status(400).json({ error: 'username, questionId and selected (index) required' });
  }
  db.get('SELECT * FROM questions WHERE id = ?', [questionId], (err, qrow) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!qrow) return res.status(404).json({ error: 'Question not found' });

    const correct = (selected === qrow.correct);
    const prize = qrow.prize;
    let response = { correct, prize, questionId };

    db.get('SELECT * FROM users WHERE username = ?', [username], (err, urow) => {
      if (err) return res.status(500).json({ error: 'DB error' });
      if (!urow) return res.status(404).json({ error: 'User not found; register first' });

      if (correct) {
        if (questionId === PRIZE_LADDER.length) {
          const finishedAmount = prize;
          const newHigh = Math.max(urow.highscore || 0, finishedAmount);
          db.run('UPDATE users SET highscore = ?, coins = coins + ? WHERE id = ?', [newHigh, Math.floor(prize/10000), urow.id], function(err) {
            if (err) console.error(err);
            response.nextQuestion = null;
            response.finished = true;
            response.message = `Congratulations! You won ₹${formatINR(prize)}.`;
            response.newHighscore = newHigh;
            return res.json(response);
          });
        } else {
          response.nextQuestion = questionId + 1;
          const tentativeHigh = Math.max(urow.highscore || 0, prize);
          db.run('UPDATE users SET highscore = ? WHERE id = ?', [tentativeHigh, urow.id], (err) => {
            if (err) console.error(err);
            response.message = `Correct! You have won ₹${formatINR(prize)}. Move to next question.`;
            return res.json(response);
          });
        }
      } else {
        let safe = 0;
        const qid = questionId;
        if (qid > 10) safe = SAFE_MILESTONES[10];
        else if (qid > 5) safe = SAFE_MILESTONES[5];
        else safe = 0;
        const newHigh = Math.max(urow.highscore || 0, safe);
        db.run('UPDATE users SET highscore = ? WHERE id = ?', [newHigh, urow.id], (err) => {
          if (err) console.error(err);
          response.finished = true;
          response.safeAmount = safe;
          response.message = `Wrong answer. You leave with ₹${formatINR(safe)}.`;
          response.newHighscore = newHigh;
          return res.json(response);
        });
      }
    });
  });
});

// Daily coin claim
app.post('/api/daily-claim', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username required' });
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, urow) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!urow) return res.status(404).json({ error: 'User not found' });
    const today = (new Date()).toISOString().slice(0,10);
    db.run('INSERT INTO daily_claims(user_id, date) VALUES(?, ?)', [urow.id, today], function(err) {
      if (err) {
        return res.status(400).json({ error: 'Already claimed today' });
      }
      const coinsGiven = 50;
      db.run('UPDATE users SET coins = coins + ? WHERE id = ?', [coinsGiven, urow.id], function(err) {
        if (err) return res.status(500).json({ error: 'DB error' });
        db.get('SELECT coins FROM users WHERE id = ?', [urow.id], (err, r) => {
          if (err) return res.status(500).json({ error: 'DB error' });
          res.json({ message: `Claimed ${coinsGiven} coins today`, coins: r.coins });
        });
      });
    });
  });
});

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
  db.all('SELECT username, highscore, coins FROM users ORDER BY highscore DESC LIMIT 10', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ leaderboard: rows });
  });
});

function formatINR(num) {
  if (typeof num !== 'number') num = Number(num) || 0;
  return new Intl.NumberFormat('en-IN').format(num);
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});