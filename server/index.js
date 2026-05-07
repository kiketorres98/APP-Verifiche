const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const multer = require('multer');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Multer config for Excel uploads
const upload = multer({
  dest: path.join(__dirname, 'uploads'),
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype) || /\.xlsx?$/i.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Solo file Excel (.xlsx / .xls) sono accettati'));
    }
  },
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------
const dbPath = path.join(__dirname, 'verifiche.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    time_limit_minutes INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    teacher_link_id TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('multiple_choice','true_false','fill_blank','open_answer','matching')),
    text TEXT NOT NULL,
    options TEXT,
    correct_answer TEXT,
    points REAL NOT NULL DEFAULT 1,
    order_num INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL,
    student_surname TEXT NOT NULL,
    started_at TEXT,
    submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
    score REAL,
    max_score REAL,
    percentage REAL
  );

  CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    student_answer TEXT,
    is_correct INTEGER,
    points_earned REAL
  );

  CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id);
  CREATE INDEX IF NOT EXISTS idx_submissions_quiz ON submissions(quiz_id);
  CREATE INDEX IF NOT EXISTS idx_answers_submission ON answers(submission_id);
`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map Italian tipo values from Excel to internal type enum */
function mapTipo(tipo) {
  const map = {
    scelta_multipla: 'multiple_choice',
    vero_falso: 'true_false',
    riempi: 'fill_blank',
    aperta: 'open_answer',
    abbinamento: 'matching',
  };
  const key = (tipo || '').trim().toLowerCase();
  return map[key] || null;
}

/**
 * Grade a single answer.
 * Returns { is_correct: boolean|null, points_earned: number }
 */
function gradeAnswer(question, studentAnswer) {
  const type = question.type;
  const correctRaw = question.correct_answer;

  // Open answers need manual grading
  if (type === 'open_answer') {
    return { is_correct: null, points_earned: 0 };
  }

  if (studentAnswer === null || studentAnswer === undefined || studentAnswer === '') {
    return { is_correct: false, points_earned: 0 };
  }

  let correct;
  try {
    correct = JSON.parse(correctRaw);
  } catch {
    correct = correctRaw;
  }

  let studentParsed;
  if (typeof studentAnswer === 'string') {
    try {
      studentParsed = JSON.parse(studentAnswer);
    } catch {
      studentParsed = studentAnswer;
    }
  } else {
    studentParsed = studentAnswer;
  }

  let isCorrect = false;

  switch (type) {
    case 'multiple_choice':
    case 'true_false': {
      const norm = (v) => String(v).trim().toLowerCase();
      isCorrect = norm(studentParsed) === norm(correct);
      break;
    }

    case 'fill_blank': {
      const studentNorm = String(studentParsed).trim().toLowerCase();
      if (typeof correct === 'string') {
        // Support comma-separated list of accepted answers
        const accepted = correct.split(',').map((s) => s.trim().toLowerCase());
        isCorrect = accepted.includes(studentNorm);
      } else if (Array.isArray(correct)) {
        isCorrect = correct.some((c) => String(c).trim().toLowerCase() === studentNorm);
      } else {
        isCorrect = studentNorm === String(correct).trim().toLowerCase();
      }
      break;
    }

    case 'matching': {
      // Both should be objects or arrays of pairs
      try {
        const sortObj = (o) => JSON.stringify(
          typeof o === 'object' && !Array.isArray(o)
            ? Object.keys(o).sort().reduce((acc, k) => { acc[k.trim().toLowerCase()] = String(o[k]).trim().toLowerCase(); return acc; }, {})
            : Array.isArray(o)
              ? o.map((p) => (Array.isArray(p) ? p.map((v) => String(v).trim().toLowerCase()) : String(p).trim().toLowerCase())).sort()
              : String(o).trim().toLowerCase()
        );
        isCorrect = sortObj(studentParsed) === sortObj(correct);
      } catch {
        isCorrect = false;
      }
      break;
    }

    default:
      isCorrect = false;
  }

  return {
    is_correct: isCorrect,
    points_earned: isCorrect ? question.points : 0,
  };
}

// ---------------------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------------------
const stmts = {
  insertQuiz: db.prepare(
    'INSERT INTO quizzes (id, title, description, time_limit_minutes, teacher_link_id) VALUES (?, ?, ?, ?, ?)'
  ),
  insertQuestion: db.prepare(
    'INSERT INTO questions (quiz_id, type, text, options, correct_answer, points, order_num) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ),
  getQuiz: db.prepare('SELECT * FROM quizzes WHERE id = ?'),
  getQuizByTeacher: db.prepare('SELECT * FROM quizzes WHERE id = ? AND teacher_link_id = ?'),
  getQuestions: db.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_num'),
  insertSubmission: db.prepare(
    'INSERT INTO submissions (quiz_id, student_name, student_surname, started_at, score, max_score, percentage) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ),
  insertAnswer: db.prepare(
    'INSERT INTO answers (submission_id, question_id, student_answer, is_correct, points_earned) VALUES (?, ?, ?, ?, ?)'
  ),
  getSubmissions: db.prepare('SELECT * FROM submissions WHERE quiz_id = ? ORDER BY submitted_at DESC'),
  getAnswersBySubmission: db.prepare('SELECT * FROM answers WHERE submission_id = ?'),
  getAnswer: db.prepare('SELECT * FROM answers WHERE id = ?'),
  updateAnswer: db.prepare('UPDATE answers SET is_correct = ?, points_earned = ? WHERE id = ?'),
  getSubmission: db.prepare('SELECT * FROM submissions WHERE id = ?'),
  updateSubmission: db.prepare('UPDATE submissions SET score = ?, percentage = ? WHERE id = ?'),
};

// ---------------------------------------------------------------------------
// Transaction helpers
// ---------------------------------------------------------------------------
const insertQuizTx = db.transaction((quizId, title, description, timeLimit, teacherLinkId, questions) => {
  stmts.insertQuiz.run(quizId, title, description, timeLimit, teacherLinkId);
  questions.forEach((q, idx) => {
    stmts.insertQuestion.run(
      quizId,
      q.type,
      q.text,
      typeof q.options === 'string' ? q.options : JSON.stringify(q.options || null),
      typeof q.correct_answer === 'string' ? q.correct_answer : JSON.stringify(q.correct_answer),
      q.points ?? 1,
      q.order_num ?? idx + 1
    );
  });
});

const submitAnswersTx = db.transaction((quizId, studentName, studentSurname, startedAt, answersArr, questions) => {
  let score = 0;
  let maxScore = 0;
  const gradedAnswers = [];

  questions.forEach((q) => {
    maxScore += q.points;
    const studentAns = answersArr.find((a) => a.question_id === q.id);
    const raw = studentAns ? studentAns.answer : null;
    const result = gradeAnswer(q, raw);
    score += result.points_earned;
    gradedAnswers.push({
      question_id: q.id,
      student_answer: typeof raw === 'string' ? raw : JSON.stringify(raw),
      is_correct: result.is_correct,
      points_earned: result.points_earned,
    });
  });

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 10000) / 100 : 0;

  const subInfo = stmts.insertSubmission.run(quizId, studentName, studentSurname, startedAt, score, maxScore, percentage);
  const submissionId = subInfo.lastInsertRowid;

  gradedAnswers.forEach((ga) => {
    stmts.insertAnswer.run(
      submissionId,
      ga.question_id,
      ga.student_answer,
      ga.is_correct === null ? null : ga.is_correct ? 1 : 0,
      ga.points_earned
    );
  });

  return { submissionId, score, maxScore, percentage };
});

// Serve template Excel
app.get('/api/template', (_req, res) => {
  const templatePath = path.join(__dirname, '..', 'templates', 'template_verifica.xlsx');
  if (!fs.existsSync(templatePath)) {
    return res.status(404).json({ error: 'Template non trovato' });
  }
  res.download(templatePath, 'template_verifica.xlsx');
});

// Serve frontend build in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// POST /api/quizzes — create quiz from JSON
app.post('/api/quizzes', (req, res) => {
  try {
    const { title, description, time_limit_minutes, questions } = req.body;

    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Titolo e domande sono obbligatori' });
    }

    const validTypes = ['multiple_choice', 'true_false', 'fill_blank', 'open_answer', 'matching'];
    for (const q of questions) {
      if (!validTypes.includes(q.type)) {
        return res.status(400).json({ error: `Tipo domanda non valido: ${q.type}` });
      }
      if (!q.text) {
        return res.status(400).json({ error: 'Ogni domanda deve avere un testo' });
      }
    }

    const quizId = uuidv4();
    const teacherLinkId = uuidv4();

    insertQuizTx(quizId, title, description || null, time_limit_minutes || null, teacherLinkId, questions);

    res.status(201).json({
      id: quizId,
      teacher_link_id: teacherLinkId,
      message: 'Quiz creato con successo',
    });
  } catch (err) {
    console.error('Errore creazione quiz:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// POST /api/quizzes/parse-excel — parse Excel file and return questions (no quiz created)
app.post('/api/quizzes/parse-excel', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!rows || rows.length === 0) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Il file Excel è vuoto' });
    }

    const questions = rows.map((row, idx) => {
      const tipo = mapTipo(row.tipo);
      if (!tipo) {
        throw new Error(`Riga ${idx + 2}: tipo non valido "${row.tipo}"`);
      }

      const text = row.domanda;
      if (!text) {
        throw new Error(`Riga ${idx + 2}: domanda mancante`);
      }

      const options = [];
      for (let i = 1; i <= 4; i++) {
        const val = row[`opzione${i}`];
        if (val !== undefined && val !== null && val !== '') {
          options.push(String(val));
        }
      }

      const correctAnswer = row.risposta_corretta !== undefined ? String(row.risposta_corretta) : '';
      const points = row.punti ? parseFloat(row.punti) : 1;

      return {
        type: tipo,
        text: String(text),
        options: options.length > 0 ? options : null,
        correct_answer: correctAnswer,
        points,
        order_num: idx + 1,
      };
    });

    fs.unlink(req.file.path, () => {});

    res.json({ questions });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('Errore parsing Excel:', err);
    res.status(400).json({ error: err.message || 'Errore durante la lettura del file' });
  }
});

// POST /api/quizzes/upload — create quiz from Excel file
app.post('/api/quizzes/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file caricato' });
    }

    const title = req.body.title || 'Quiz importato';
    const description = req.body.description || null;
    const timeLimit = req.body.time_limit_minutes ? parseInt(req.body.time_limit_minutes, 10) : null;

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'Il file Excel è vuoto' });
    }

    const questions = rows.map((row, idx) => {
      const tipo = mapTipo(row.tipo);
      if (!tipo) {
        throw new Error(`Riga ${idx + 2}: tipo non valido "${row.tipo}"`);
      }

      const text = row.domanda;
      if (!text) {
        throw new Error(`Riga ${idx + 2}: domanda mancante`);
      }

      // Build options array from opzione columns
      const options = [];
      for (let i = 1; i <= 4; i++) {
        const val = row[`opzione${i}`];
        if (val !== undefined && val !== null && val !== '') {
          options.push(String(val));
        }
      }

      const correctAnswer = row.risposta_corretta !== undefined ? String(row.risposta_corretta) : '';
      const points = row.punti ? parseFloat(row.punti) : 1;

      return {
        type: tipo,
        text: String(text),
        options: options.length > 0 ? JSON.stringify(options) : null,
        correct_answer: correctAnswer,
        points,
        order_num: idx + 1,
      };
    });

    const quizId = uuidv4();
    const teacherLinkId = uuidv4();

    insertQuizTx(quizId, title, description, timeLimit, teacherLinkId, questions);

    // Clean up uploaded file
    fs.unlink(req.file.path, () => {});

    res.status(201).json({
      id: quizId,
      teacher_link_id: teacherLinkId,
      questions_count: questions.length,
      message: 'Quiz importato da Excel con successo',
    });
  } catch (err) {
    // Clean up uploaded file on error
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('Errore importazione Excel:', err);
    res.status(400).json({ error: err.message || 'Errore durante importazione del file' });
  }
});

// GET /api/quizzes/:id — get quiz for students (no correct answers)
app.get('/api/quizzes/:id', (req, res) => {
  try {
    const quiz = stmts.getQuiz.get(req.params.id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz non trovato' });
    }

    const questions = stmts.getQuestions.all(req.params.id).map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      options: q.options ? JSON.parse(q.options) : null,
      points: q.points,
      order_num: q.order_num,
      // correct_answer deliberately omitted
    }));

    res.json({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      time_limit_minutes: quiz.time_limit_minutes,
      created_at: quiz.created_at,
      questions,
    });
  } catch (err) {
    console.error('Errore recupero quiz:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/quizzes/:id/teacher/:teacherLinkId — full quiz data + submissions (teacher view)
app.get('/api/quizzes/:id/teacher/:teacherLinkId', (req, res) => {
  try {
    const quiz = stmts.getQuizByTeacher.get(req.params.id, req.params.teacherLinkId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz non trovato o link insegnante non valido' });
    }

    const questions = stmts.getQuestions.all(quiz.id).map((q) => ({
      ...q,
      options: q.options ? JSON.parse(q.options) : null,
      correct_answer: (() => { try { return JSON.parse(q.correct_answer); } catch { return q.correct_answer; } })(),
    }));

    const submissions = stmts.getSubmissions.all(quiz.id).map((s) => {
      const answers = stmts.getAnswersBySubmission.all(s.id).map((a) => ({
        ...a,
        student_answer: (() => { try { return JSON.parse(a.student_answer); } catch { return a.student_answer; } })(),
        is_correct: a.is_correct === null ? null : !!a.is_correct,
      }));
      return { ...s, answers };
    });

    res.json({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      time_limit_minutes: quiz.time_limit_minutes,
      created_at: quiz.created_at,
      teacher_link_id: quiz.teacher_link_id,
      questions,
      submissions,
    });
  } catch (err) {
    console.error('Errore recupero dati insegnante:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// POST /api/quizzes/:id/submit — submit student answers
app.post('/api/quizzes/:id/submit', (req, res) => {
  try {
    const quiz = stmts.getQuiz.get(req.params.id);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz non trovato' });
    }

    const { student_name, student_surname, started_at, answers } = req.body;

    if (!student_name || !student_surname) {
      return res.status(400).json({ error: 'Nome e cognome dello studente sono obbligatori' });
    }
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'Le risposte sono obbligatorie' });
    }

    const questions = stmts.getQuestions.all(quiz.id);
    const result = submitAnswersTx(quiz.id, student_name, student_surname, started_at || null, answers, questions);

    const hasOpenAnswers = questions.some((q) => q.type === 'open_answer');

    res.status(201).json({
      submission_id: Number(result.submissionId),
      score: result.score,
      max_score: result.maxScore,
      percentage: result.percentage,
      has_open_answers: hasOpenAnswers,
      message: hasOpenAnswers
        ? 'Verifica inviata. Alcune domande aperte saranno corrette dall\'insegnante.'
        : 'Verifica inviata e corretta automaticamente.',
    });
  } catch (err) {
    console.error('Errore invio verifica:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/quizzes/:id/results/:teacherLinkId — all submissions with details
app.get('/api/quizzes/:id/results/:teacherLinkId', (req, res) => {
  try {
    const quiz = stmts.getQuizByTeacher.get(req.params.id, req.params.teacherLinkId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz non trovato o link insegnante non valido' });
    }

    const questions = stmts.getQuestions.all(quiz.id);
    const submissions = stmts.getSubmissions.all(quiz.id).map((s) => {
      const answers = stmts.getAnswersBySubmission.all(s.id).map((a) => {
        const question = questions.find((q) => q.id === a.question_id);
        return {
          ...a,
          student_answer: (() => { try { return JSON.parse(a.student_answer); } catch { return a.student_answer; } })(),
          is_correct: a.is_correct === null ? null : !!a.is_correct,
          question_text: question ? question.text : null,
          question_type: question ? question.type : null,
        };
      });
      return { ...s, answers };
    });

    res.json({
      quiz_id: quiz.id,
      quiz_title: quiz.title,
      total_submissions: submissions.length,
      submissions,
    });
  } catch (err) {
    console.error('Errore recupero risultati:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// GET /api/quizzes/:id/results/:teacherLinkId/export — export results as Excel
app.get('/api/quizzes/:id/results/:teacherLinkId/export', (req, res) => {
  try {
    const quiz = stmts.getQuizByTeacher.get(req.params.id, req.params.teacherLinkId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz non trovato o link insegnante non valido' });
    }

    const questions = stmts.getQuestions.all(quiz.id);
    const submissions = stmts.getSubmissions.all(quiz.id);

    // Build rows for export
    const rows = submissions.map((s) => {
      const answers = stmts.getAnswersBySubmission.all(s.id);
      const row = {
        Nome: s.student_name,
        Cognome: s.student_surname,
        'Data invio': s.submitted_at,
        Punteggio: s.score,
        'Punteggio massimo': s.max_score,
        'Percentuale (%)': s.percentage,
      };

      // Add a column per question
      questions.forEach((q, idx) => {
        const answer = answers.find((a) => a.question_id === q.id);
        const colName = `D${idx + 1}: ${q.text.substring(0, 50)}`;
        let answerText = '';
        if (answer) {
          try { answerText = JSON.parse(answer.student_answer); } catch { answerText = answer.student_answer; }
          if (typeof answerText === 'object') answerText = JSON.stringify(answerText);
        }
        row[colName] = answerText || '';

        const correctCol = `D${idx + 1} Corretto`;
        if (answer) {
          row[correctCol] = answer.is_correct === null ? 'Da correggere' : answer.is_correct ? 'Sì' : 'No';
        } else {
          row[correctCol] = 'Nessuna risposta';
        }

        row[`D${idx + 1} Punti`] = answer ? answer.points_earned : 0;
      });

      return row;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Risultati');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const safeTitle = quiz.title.replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="risultati_${safeTitle}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (err) {
    console.error('Errore esportazione risultati:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// PUT /api/answers/:answerId/grade — teacher manually grades an answer
app.put('/api/answers/:answerId/grade', (req, res) => {
  try {
    const answer = stmts.getAnswer.get(req.params.answerId);
    if (!answer) {
      return res.status(404).json({ error: 'Risposta non trovata' });
    }

    const { is_correct, points_earned } = req.body;
    if (typeof is_correct !== 'boolean' || typeof points_earned !== 'number') {
      return res.status(400).json({ error: 'is_correct (boolean) e points_earned (number) sono obbligatori' });
    }

    stmts.updateAnswer.run(is_correct ? 1 : 0, points_earned, answer.id);

    // Recalculate submission score
    const allAnswers = stmts.getAnswersBySubmission.all(answer.submission_id);
    const newScore = allAnswers.reduce((sum, a) => sum + (a.id === answer.id ? points_earned : (a.points_earned || 0)), 0);
    const submission = stmts.getSubmission.get(answer.submission_id);
    const newPercentage = submission.max_score > 0 ? Math.round((newScore / submission.max_score) * 10000) / 100 : 0;

    stmts.updateSubmission.run(newScore, newPercentage, submission.id);

    res.json({
      message: 'Risposta corretta con successo',
      answer_id: answer.id,
      is_correct,
      points_earned,
      new_submission_score: newScore,
      new_submission_percentage: newPercentage,
    });
  } catch (err) {
    console.error('Errore correzione risposta:', err);
    res.status(500).json({ error: 'Errore interno del server' });
  }
});

// SPA catch-all: serve index.html for client-side routes
if (fs.existsSync(clientDist)) {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server verifiche avviato su http://localhost:${PORT}`);
});
