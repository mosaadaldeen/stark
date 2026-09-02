// Stark Learn — tiny client-side engine. No backend, no build step.
// State lives entirely in localStorage, scoped to this browser.

const STORAGE_KEY = "stark_learn_state_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { completed: {}, streak: 0, lastCompletionDate: null };
    return JSON.parse(raw);
  } catch (e) {
    return { completed: {}, streak: 0, lastCompletionDate: null };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const d1 = new Date(a + "T00:00:00");
  const d2 = new Date(b + "T00:00:00");
  return Math.round((d2 - d1) / 86400000);
}

function lessonKey(trackId, index) {
  return trackId + ":" + index;
}

function isComplete(trackId, index) {
  return !!state.completed[lessonKey(trackId, index)];
}

function markComplete(trackId, index) {
  const key = lessonKey(trackId, index);
  if (state.completed[key]) return;
  state.completed[key] = { date: todayStr() };

  const today = todayStr();
  if (state.lastCompletionDate === today) {
    // already advanced streak today, no change
  } else if (state.lastCompletionDate && daysBetween(state.lastCompletionDate, today) === 1) {
    state.streak += 1;
    state.lastCompletionDate = today;
  } else {
    state.streak = 1;
    state.lastCompletionDate = today;
  }
  saveState(state);
}

function trackProgress(track) {
  const done = track.lessons.filter((_, i) => isComplete(track.id, i)).length;
  return { done, total: track.lessons.length };
}

function flatLessons() {
  const out = [];
  TRACKS.forEach((track) => {
    track.lessons.forEach((lesson, i) => {
      out.push({ track, index: i, lesson });
    });
  });
  return out;
}

function todaysPick() {
  const flat = flatLessons();
  const incomplete = flat.filter((f) => !isComplete(f.track.id, f.index));
  if (incomplete.length === 0) return null;
  // Round-robin-ish: pick the lowest-index incomplete lesson from the track with fewest completions so far.
  incomplete.sort((a, b) => {
    const pa = trackProgress(a.track).done;
    const pb = trackProgress(b.track).done;
    if (pa !== pb) return pa - pb;
    return a.index - b.index;
  });
  return incomplete[0];
}

function updateStreakPill() {
  document.getElementById("streak-pill").textContent = `🔥 ${state.streak} day streak`;
}

function totalStats() {
  const flat = flatLessons();
  const done = flat.filter((f) => isComplete(f.track.id, f.index)).length;
  return { done, total: flat.length };
}

// ---------- Routing ----------

function navigate(hash) {
  window.location.hash = hash;
}

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", render);

function render() {
  updateStreakPill();
  const hash = window.location.hash.replace(/^#\/?/, "");
  const parts = hash.split("/").filter(Boolean);

  if (parts[0] === "track" && parts[1]) {
    renderTrackView(parts[1]);
  } else if (parts[0] === "lesson" && parts[1] && parts[2] !== undefined) {
    renderLessonView(parts[1], parseInt(parts[2], 10));
  } else {
    renderDashboard();
  }
  window.scrollTo(0, 0);
}

// ---------- Views ----------

function renderDashboard() {
  const app = document.getElementById("app");
  const stats = totalStats();
  const pick = todaysPick();

  let heroHtml;
  if (!pick) {
    heroHtml = `
      <div class="today-card done">
        <div>
          <div class="label">All caught up</div>
          <div class="title">You've finished every lesson. Come back tomorrow, or revisit any track below.</div>
        </div>
      </div>`;
  } else {
    heroHtml = `
      <div class="today-card">
        <div>
          <div class="label">Today's 15 minutes</div>
          <div class="title">${escapeHtml(pick.lesson.title)}</div>
        </div>
        <button onclick="navigate('lesson/${pick.track.id}/${pick.index}')">Start lesson</button>
      </div>`;
  }

  const tracksHtml = TRACKS.map((track) => {
    const p = trackProgress(track);
    const pct = Math.round((p.done / p.total) * 100);
    return `
      <button class="track-card" onclick="navigate('track/${track.id}')">
        <div class="icon">${track.icon}</div>
        <div class="name">${escapeHtml(track.name)}</div>
        <div class="blurb">${escapeHtml(track.blurb)}</div>
        <div class="prog-bar"><div class="prog-fill" style="width:${pct}%"></div></div>
        <div class="prog-text">${p.done} / ${p.total} lessons</div>
      </button>`;
  }).join("");

  app.innerHTML = `
    <div class="dash-hero">
      <h1>Your daily lesson</h1>
      <p>One idea a day, in 15 minutes, drawn from real books and named research, not the whole internet blended into mush.</p>
      ${heroHtml}
      <div class="stats-row">
        <div class="stat"><div class="n">${stats.done}/${stats.total}</div><div class="l">Lessons completed</div></div>
        <div class="stat"><div class="n">${state.streak}</div><div class="l">Day streak</div></div>
        <div class="stat"><div class="n">${TRACKS.length}</div><div class="l">Tracks</div></div>
      </div>
    </div>
    <h2 class="section-title">Browse tracks</h2>
    <div class="track-grid">${tracksHtml}</div>
  `;
}

function renderTrackView(trackId) {
  const track = TRACKS.find((t) => t.id === trackId);
  const app = document.getElementById("app");
  if (!track) {
    app.innerHTML = `<button class="back-link" onclick="navigate('')">&larr; Back</button><p>Track not found.</p>`;
    return;
  }

  const rows = track.lessons.map((lesson, i) => {
    const done = isComplete(track.id, i);
    return `
      <div class="lesson-row ${done ? "complete" : ""}" onclick="navigate('lesson/${track.id}/${i}')">
        <div>
          <div class="li-title">${i + 1}. ${escapeHtml(lesson.title)}</div>
          <div class="li-source">${escapeHtml(lesson.source)}</div>
        </div>
        <div class="badge">${done ? "✓ Done" : "Start"}</div>
      </div>`;
  }).join("");

  app.innerHTML = `
    <button class="back-link" onclick="navigate('')">&larr; All tracks</button>
    <h1 style="margin-bottom:4px;">${track.icon} ${escapeHtml(track.name)}</h1>
    <p class="empty-note" style="margin-bottom:20px;">${escapeHtml(track.blurb)}</p>
    <div class="lesson-list">${rows}</div>
  `;
}

function renderLessonView(trackId, index) {
  const track = TRACKS.find((t) => t.id === trackId);
  const app = document.getElementById("app");
  if (!track || !track.lessons[index]) {
    app.innerHTML = `<button class="back-link" onclick="navigate('')">&larr; Back</button><p>Lesson not found.</p>`;
    return;
  }
  const lesson = track.lessons[index];
  const done = isComplete(trackId, index);

  const bodyHtml = lesson.body.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  const optionsHtml = lesson.quiz.options.map((opt, i) =>
    `<button class="quiz-opt" data-i="${i}" onclick="answerQuiz(this, ${lesson.quiz.correct})">${escapeHtml(opt)}</button>`
  ).join("");

  const nextInfo = nextLessonPointer(track, index);
  const nextBtnHtml = done ? renderNextButton(nextInfo) : "";

  app.innerHTML = `
    <button class="back-link" onclick="navigate('track/${track.id}')">&larr; ${escapeHtml(track.name)}</button>
    <div class="lesson-card">
      <div class="source-tag">📖 ${escapeHtml(lesson.source)}</div>
      <h1>${escapeHtml(lesson.title)}</h1>
      ${bodyHtml}
      <div class="callout">
        <div class="k">Real example</div>
        <div>${escapeHtml(lesson.example)}</div>
      </div>
      <div class="callout action">
        <div class="k">Try this today</div>
        <div>${escapeHtml(lesson.action)}</div>
      </div>
      <div class="quiz-box" id="quiz-box">
        <h3>${done ? "✓ Quiz completed" : "Quick check — answer to mark this lesson complete"}</h3>
        <div id="quiz-options">${optionsHtml}</div>
        <div id="quiz-feedback" class="quiz-feedback"></div>
        <div id="next-slot">${nextBtnHtml}</div>
      </div>
    </div>
  `;

  if (done) {
    document.getElementById("quiz-box").querySelector("h3").textContent = "✓ Quiz completed";
    document.querySelectorAll(".quiz-opt").forEach((b) => (b.disabled = true));
  }

  // stash context for answerQuiz
  window.__currentLesson = { trackId, index, track };
}

function nextLessonPointer(track, index) {
  if (index + 1 < track.lessons.length) {
    return { trackId: track.id, index: index + 1, label: "Next lesson in " + track.name };
  }
  const pick = todaysPick();
  if (pick) {
    return { trackId: pick.track.id, index: pick.index, label: "Continue: " + pick.track.name };
  }
  return null;
}

function renderNextButton(nextInfo) {
  if (!nextInfo) {
    return `<p class="empty-note">That's every lesson. Come back tomorrow for something new.</p>`;
  }
  return `<button class="next-btn" onclick="navigate('lesson/${nextInfo.trackId}/${nextInfo.index}')">${escapeHtml(nextInfo.label)} &rarr;</button>`;
}

function answerQuiz(btn, correctIndex) {
  const chosen = parseInt(btn.dataset.i, 10);
  const opts = document.querySelectorAll(".quiz-opt");
  opts.forEach((b) => (b.disabled = true));

  const feedback = document.getElementById("quiz-feedback");
  if (chosen === correctIndex) {
    btn.classList.add("correct");
    feedback.textContent = "Correct. Lesson marked complete.";
    feedback.className = "quiz-feedback good";
  } else {
    btn.classList.add("wrong");
    opts[correctIndex].classList.add("correct");
    feedback.textContent = "Not quite, the correct answer is highlighted. Still marked complete, review beats a perfect streak.";
    feedback.className = "quiz-feedback bad";
  }

  const { trackId, index, track } = window.__currentLesson;
  markComplete(trackId, index);
  updateStreakPill();

  const nextInfo = nextLessonPointer(track, index);
  document.getElementById("next-slot").innerHTML = renderNextButton(nextInfo);
  document.querySelector(".lesson-row"); // no-op, keeps linter-style consistency
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
