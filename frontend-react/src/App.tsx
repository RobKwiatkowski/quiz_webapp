import { SubjectQuizList } from "./features/subjects/SubjectQuizList";
import { getSubjectFromPath, subjectConfigs } from "./features/subjects/subject-config";
import { QuizPage } from "./pages/QuizPage";

export function App() {
  if (window.location.pathname.toLowerCase().endsWith("quiz.html")) {
    return <QuizPage />;
  }

  const subjectId = getSubjectFromPath(window.location.pathname);

  if (subjectId) {
    const subject = subjectConfigs[subjectId];

    return (
      <main className="subject-shell">
        <nav aria-label="Nawigacja">
          <a className="back-link" href="index.html">← Menu główne</a>
        </nav>
        <header className="subject-hero">
          <p className="subject-kicker">EDU QUIZ</p>
          <h1>{subject.title}</h1>
          <p>{subject.description}</p>
        </header>
        <section aria-labelledby="quiz-list-title">
          <h2 id="quiz-list-title">Wybierz temat</h2>
          <SubjectQuizList subject={subject} />
        </section>
      </main>
    );
  }

  return (
    <main className="subject-shell">
      <p className="subject-kicker">EDU QUIZ</p>
      <h1>Wybierz dział nauki</h1>
      <div className="subject-links">
        {(Object.values(subjectConfigs)).map((subject) => (
          <a key={subject.id} className="subject-link" href={`${subject.id}.html`}>
            <span>{subject.title}</span>
            <span aria-hidden="true">→</span>
          </a>
        ))}
      </div>
    </main>
  );
}
