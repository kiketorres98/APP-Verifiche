import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import TeacherPanel from './pages/TeacherPanel'
import ResultsPage from './pages/ResultsPage'
import StudentQuiz from './pages/StudentQuiz'
import CompletedPage from './pages/CompletedPage'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/teacher" element={<TeacherPanel />} />
      <Route path="/teacher/results/:quizId/:teacherLinkId" element={<ResultsPage />} />
      <Route path="/quiz/:quizId" element={<StudentQuiz />} />
      <Route path="/quiz/:quizId/completed" element={<CompletedPage />} />
    </Routes>
  )
}

export default App
