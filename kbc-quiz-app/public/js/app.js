const API = '/api';
let username = localStorage.getItem('kbc_username') || '';
let currentIndex = 1;
let currentCoins = 0;

document.addEventListener('DOMContentLoaded', () => {
  const usernameInput = document.getElementById('username');
  const btnRegister = document.getElementById('btnRegister');
  const registerMsg = document.getElementById('registerMsg');
  const userInfo = document.getElementById('userInfo');
  const btnDaily = document.getElementById('btnDaily');
  const btnLeaderboard = document.getElementById('btnLeaderboard');
  const ladderList = document.getElementById('ladderList');

  const quizArea = document.getElementById('quizArea');
  const qIndexEl = document.getElementById('qIndex');
  const qPrizeEl = document.getElementById('qPrize');
  const questionText = document.getElementById('questionText');
  const optionsEl = document.getElementById('options');
  const msgEl = document.getElementById('msg');
  const btnQuit = document.getElementById('btnQuit');
  const coinsInfo = document.getElementById('coins');

  const leaderboardArea = document.getElementById('leaderboardArea');
  const leaderboardList = document.getElementById('leaderboardList');

  if (username) {
    usernameInput.value = username;
    showUserInfo();
  }

  fetch(`${API}/prize-ladder`)
    .then(r => r.json())
    .then(data => {
      ladderList.innerHTML = '';
      data.ladder.slice().reverse().forEach(item => {
        const li = document.createElement('li');
        li.className = `level-${item.level}`;
        li.innerHTML = `<span>Q${item.level}</span><strong>₹${new Intl.NumberFormat('en-IN').format(item.prize)}</strong>`;
        ladderList.appendChild(li);
      });
    });

  btnRegister.addEventListener('click', () => {
    const name = (usernameInput.value || '').trim();
    if (!name || name.length < 2) {
      registerMsg.textContent = 'Please enter a username (min 2 chars).';
      return;
    }
    fetch(`${API}/users/register`, {
      method: 'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username: name })
    }).then(r => r.json())
      .then(res => {
        if (res.error) {
          registerMsg.textContent = res.error;
          return;
        }
        username = name;
        localStorage.setItem('kbc_username', username);
        registerMsg.textContent = `Registered as ${username}. Click Start to play.`;
        showUserInfo();
        startQuiz();
      });
  });

  function showUserInfo(){
    userInfo.textContent = username ? `Signed in as: ${username}` : 'Not signed in';
  }

  function startQuiz(){
    if (!username) {
      registerMsg.textContent = 'Register first.';
      return;
    }
    currentIndex = 1;
    loadQuestion(currentIndex);
    document.getElementById('intro').classList.add('hidden');
    document.getElementById('quizArea').classList.remove('hidden');
    document.getElementById('leaderboardArea').classList.add('hidden');
    msgEl.textContent = '';
  }

  function loadQuestion(idx){
    fetch(`${API}/questions?index=${idx}`).then(r => r.json()).then(data => {
      const q = data.question;
      qIndexEl.textContent = q.id;
      qPrizeEl.textContent = `₹${new Intl.NumberFormat('en-IN').format(q.prize)}`;
      questionText.textContent = q.question;
      optionsEl.innerHTML = '';
      q.options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'optionBtn';
        btn.textContent = opt;
        btn.addEventListener('click', () => selectOption(q.id, i, btn));
        optionsEl.appendChild(btn);
      });
    }).catch(err => {
      questionText.textContent = 'Error loading question.';
      console.error(err);
    });
  }

  function selectOption(questionId, selectedIdx, btnEl){
    Array.from(optionsEl.children).forEach(b => b.disabled = true);
    fetch(`${API}/answer`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, questionId, selected: selectedIdx })
    }).then(r => r.json()).then(res => {
      if (res.error) {
        msgEl.textContent = res.error;
        Array.from(optionsEl.children).forEach(b => b.disabled = false);
        return;
      }
      if (res.correct) {
        btnEl.classList.add('correct');
        msgEl.textContent = res.message || 'Correct!';
        setTimeout(() => {
          if (res.finished) {
            msgEl.textContent = res.message + ' Your result is saved.';
            document.getElementById('quizArea').classList.add('hidden');
            document.getElementById('intro').classList.remove('hidden');
            loadLeaderboard();
          } else {
            currentIndex = res.nextQuestion;
            loadQuestion(currentIndex);
          }
        }, 900);
      } else {
        btnEl.classList.add('wrong');
        msgEl.textContent = res.message || 'Wrong answer.';
        setTimeout(() => {
          document.getElementById('quizArea').classList.add('hidden');
          document.getElementById('intro').classList.remove('hidden');
          loadLeaderboard();
        }, 1200);
      }
    }).catch(err => {
      console.error(err);
      msgEl.textContent = 'Server error';
    });
  }

  btnQuit.addEventListener('click', () => {
    if (!confirm('Quit and take current safe cash?')) return;
    document.getElementById('quizArea').classList.add('hidden');
    document.getElementById('intro').classList.remove('hidden');
    loadLeaderboard();
  });

  btnDaily.addEventListener('click', () => {
    if (!username) { registerMsg.textContent = 'Register first to claim daily coins.'; return; }
    fetch(`${API}/daily-claim`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username })})
      .then(r => r.json()).then(res => {
        if (res.error) registerMsg.textContent = res.error;
        else {
          currentCoins = res.coins;
          coinsInfo.textContent = currentCoins;
          registerMsg.textContent = res.message;
        }
      });
  });

  btnLeaderboard.addEventListener('click', () => {
    document.getElementById('leaderboardArea').classList.toggle('hidden');
    if (!document.getElementById('leaderboardArea').classList.contains('hidden')) loadLeaderboard();
  });

  function loadLeaderboard(){
    fetch(`${API}/leaderboard`).then(r => r.json()).then(res => {
      leaderboardList.innerHTML = '';
      res.leaderboard.forEach(row => {
        const li = document.createElement('li');
        li.textContent = `${row.username} — ₹${new Intl.NumberFormat('en-IN').format(row.highscore || 0)} (Coins: ${row.coins || 0})`;
        leaderboardList.appendChild(li);
      });
      document.getElementById('leaderboardArea').classList.remove('hidden');
    });
  }
});