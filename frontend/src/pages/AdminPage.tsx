import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { adminApi, type AdminChapter, type AdminImageLibrary, type AdminQuestion, type AdminQuestionPayload, type AdminSubject, type AdminTopic, type ImageUpload } from "../api/admin-api";
import type { Answer, AnswerSlot, FillBlank, HotspotConfig, MapConfig, MatchingPair, OperationOrderConfig, OrderItem, SelectionType, TimedDivisionConfig, TimedMultiplicationConfig, WrittenDivisionConfig, WrittenMultiplicationConfig } from "../api/quiz-api";
import "../admin.css";

type AuthState = "loading" | "anonymous" | "authenticated" | "error";

type Draft = {
  selection_type: SelectionType;
  text: string;
  explanation: string;
  contextText: string;
  image: string;
  imageUpload: ImageUpload | null;
  answers: Answer[];
  accepted_answers: string[];
  answer_slots: AnswerSlot[];
  fill_mode: "select" | "open";
  fill_blanks: FillBlank[];
  order_items: OrderItem[];
  matching_pairs: MatchingPair[];
  map_config: MapConfig;
  hotspot_config: HotspotConfig;
  written_multiplication_config: WrittenMultiplicationConfig;
  written_division_config: WrittenDivisionConfig;
  timed_multiplication_config: TimedMultiplicationConfig;
  timed_division_config: TimedDivisionConfig;
  operation_order_config: OperationOrderConfig;
};

const mapPresets: Record<string, Pick<MapConfig, "mode" | "background_source" | "interaction">> = {
  "/static/maps/ancient-civilizations-regions.geojson": { mode: "select", background_source: "/static/maps/ancient-civilizations-basemap.geojson", interaction: "region" },
  "/static/maps/poland-voivodeships.geojson": { mode: "select", background_source: "", interaction: "region" },
  "/static/maps/poland-neighbours.geojson": { mode: "select", background_source: "", interaction: "region" },
  "/static/maps/world-continents.geojson": { mode: "identify", background_source: "", interaction: "region" },
  "/static/maps/world-lines.geojson": { mode: "select", background_source: "", interaction: "line" },
};

const blankAnswer = (): Answer => ({ text: "", is_correct: false });
const blankOrderItem = (): OrderItem => ({ id: "", text: "", position: 0 });
const blankMatchingPair = (): MatchingPair => ({ id: "", left: "", right: "" });
const blankFillBlank = (id = "luka_1"): FillBlank => ({ id, accepted_answers: [], options: ["", ""] });

function createDraft(question?: AdminQuestion): Draft {
  return {
    selection_type: question?.selection_type ?? "single",
    text: question?.text ?? "",
    explanation: question?.explanation ?? "",
    contextText: question?.context?.text ?? question?.source_text ?? "",
    image: typeof question?.image === "string" ? question.image : "",
    imageUpload: null,
    answers: question?.answers?.length ? question.answers : Array.from({ length: 4 }, blankAnswer),
    accepted_answers: question?.accepted_answers?.length ? question.accepted_answers : [""],
    answer_slots: question?.answer_slots?.length ? question.answer_slots : [{ accepted_answers: [""] }, { accepted_answers: [""] }],
    fill_mode: question?.fill_mode ?? "select",
    fill_blanks: question?.fill_blanks?.length ? question.fill_blanks : [blankFillBlank()],
    order_items: question?.order_items?.length ? [...question.order_items].sort((a, b) => a.position - b.position) : [blankOrderItem(), blankOrderItem(), blankOrderItem()],
    matching_pairs: question?.matching_pairs?.length ? question.matching_pairs : [blankMatchingPair(), blankMatchingPair()],
    map_config: question?.map_config ?? { source: "/static/maps/ancient-civilizations-regions.geojson", mode: "select", target_feature_id: "", background_source: "/static/maps/ancient-civilizations-basemap.geojson", interaction: "region" },
    hotspot_config: question?.hotspot_config ?? { source: "/static/images/geography/compass-rose.svg", target_hotspot_id: "" },
    written_multiplication_config: question?.written_multiplication_config ?? { min_factor: 10, max_factor: 9999, max_total_digits: 6, easy_max_total_digits: 4, easy_max_partial_product: 100 },
    written_division_config: question?.written_division_config ?? { min_divisor: 2, max_divisor: 99, min_quotient: 10, max_quotient: 9999, max_dividend_digits: 6, easy_min_divisor: 3, easy_max_divisor: 10, medium_min_divisor: 8, medium_max_divisor: 15, easy_max_quotient: 999, easy_max_dividend_digits: 4, easy_max_intermediate_value: 100 },
    timed_multiplication_config: question?.timed_multiplication_config ?? { min_factor: 3, max_factor: 9, time_limit_seconds: 5 },
    timed_division_config: question?.timed_division_config ?? { min_divisor: 3, max_divisor: 9, min_quotient: 3, max_quotient: 9, time_limit_seconds: 10 },
    operation_order_config: question?.operation_order_config ?? { family: "precedence" },
  };
}

export function AdminPage() {
  const [auth, setAuth] = useState<AuthState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    adminApi.session().then((session) => setAuth(session.authenticated ? "authenticated" : "anonymous")).catch(() => setAuth("error"));
  }, []);

  if (auth === "loading") return <main className="admin-shell"><p className="status">Sprawdzanie sesji…</p></main>;
  if (auth === "error") return <main className="admin-shell"><p className="status error">Nie udało się sprawdzić sesji administratora.</p></main>;
  if (auth === "anonymous") return <AdminLogin onSuccess={() => setAuth("authenticated")} />;
  return <AdminEditor onLogout={() => window.location.assign("/")} message={message} setMessage={setMessage} />;
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true); setError("");
    try { await adminApi.login(username, password); onSuccess(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Nie udało się zalogować."); }
    finally { setSaving(false); }
  };

  return <main className="login-shell"><section className="admin-panel login-panel"><h1>Logowanie</h1><form onSubmit={submit}><label>Login<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label><label>Hasło<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>{error && <p className="status error">{error}</p>}<button disabled={saving} type="submit">Zaloguj</button></form></section></main>;
}

function AdminEditor({ onLogout, message, setMessage }: { onLogout: () => void; message: string; setMessage: (value: string) => void }) {
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [subject, setSubject] = useState<AdminSubject | null>(null);
  const [chapters, setChapters] = useState<AdminChapter[]>([]);
  const [chapter, setChapter] = useState<AdminChapter | null>(null);
  const [topics, setTopics] = useState<AdminTopic[]>([]);
  const [topic, setTopic] = useState<AdminTopic | null>(null);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [editorQuestion, setEditorQuestion] = useState<AdminQuestion | null | undefined>(undefined);
  const [questionToMove, setQuestionToMove] = useState<AdminQuestion | null>(null);
  const [topicToDelete, setTopicToDelete] = useState<AdminTopic | null>(null);
  const [error, setError] = useState("");
  const [isTopicDialogOpen, setIsTopicDialogOpen] = useState(false);

  const fail = (reason: unknown) => setError(reason instanceof Error ? reason.message : "Operacja nie powiodła się.");
  const loadChapters = async (nextSubject: AdminSubject) => { const values = await adminApi.chapters(nextSubject.id); setChapters(values); };
  const loadTopics = async (nextChapter: AdminChapter) => { const values = await adminApi.topics(nextChapter.id); setTopics(values); };
  const loadQuestions = async (nextChapter: AdminChapter, nextTopic: AdminTopic) => { const values = await adminApi.questions(nextChapter.id, nextTopic.id); setQuestions(values); };

  useEffect(() => { adminApi.subjects().then((values) => { setSubjects(values); setSubject(values.find((item) => item.id === "history") ?? values[0] ?? null); }).catch(fail); }, []);
  useEffect(() => {
    if (!subject) return;
    setChapter(null); setTopic(null); setTopics([]); setQuestions([]); setEditorQuestion(undefined);
    loadChapters(subject).catch(fail);
  }, [subject?.id]);

  const chooseChapter = async (nextChapter: AdminChapter) => { setError(""); setChapter(nextChapter); setTopic(null); setQuestions([]); setEditorQuestion(undefined); try { await loadTopics(nextChapter); } catch (reason) { fail(reason); } };
  const chooseTopic = async (nextTopic: AdminTopic) => { if (!chapter) return; setError(""); setTopic(nextTopic); setEditorQuestion(undefined); try { await loadQuestions(chapter, nextTopic); } catch (reason) { fail(reason); } };
  const addChapter = async () => { if (!subject) return; const name = window.prompt("Podaj nazwę rozdziału:")?.trim(); if (!name) return; try { const created = await adminApi.createChapter(name, subject.id); await loadChapters(subject); await chooseChapter(created); setMessage("Dodano rozdział."); } catch (reason) { fail(reason); } };
  const addTopic = async (name: string) => {
    if (!chapter) return;
    const created = await adminApi.createTopic(chapter.id, name);
    await loadTopics(chapter);
    await chooseTopic(created);
    setMessage("Dodano temat.");
    setIsTopicDialogOpen(false);
  };
  const toggleTopic = async (nextTopic: AdminTopic) => { if (!chapter) return; setError(""); try { const updated = await adminApi.updateTopicActive(chapter.id, nextTopic.id, !nextTopic.is_active); setTopics((current) => current.map((item) => item.id === updated.id ? updated : item)); setTopic((current) => current?.id === updated.id ? updated : current); setMessage(updated.is_active ? "Aktywowano temat." : "Wyłączono temat."); } catch (reason) { fail(reason); } };
  const toggleQuestion = async (question: AdminQuestion) => {
    if (!chapter || !topic) return;
    setError("");
    try {
      const updated = await adminApi.updateQuestionActive(
        chapter.id,
        topic.id,
        question.id,
        question.is_active === false,
      );
      setQuestions((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage(updated.is_active === false ? "Wyłączono pytanie." : "Aktywowano pytanie.");
    } catch (reason) {
      fail(reason);
    }
  };
  const deleteTopic = async () => { if (!chapter || !topicToDelete) return; await adminApi.deleteTopic(chapter.id, topicToDelete.id); if (topic?.id === topicToDelete.id) { setTopic(null); setQuestions([]); setEditorQuestion(undefined); } await loadTopics(chapter); setTopicToDelete(null); setMessage("Usunięto temat. Kopia danych została zachowana."); };
  const deleteQuestion = async (question: AdminQuestion) => { if (!chapter || !topic || !window.confirm("Czy na pewno usunąć to pytanie?")) return; try { await adminApi.deleteQuestion(chapter.id, topic.id, question.id); await loadQuestions(chapter, topic); setMessage("Usunięto pytanie."); } catch (reason) { fail(reason); } };
  const moveQuestionToTopic = async (targetTopicId: string) => { if (!chapter || !topic || !questionToMove) return; const targetTopic = topics.find((item) => item.id === targetTopicId); await adminApi.moveQuestion(chapter.id, topic.id, questionToMove.id, targetTopicId); await loadQuestions(chapter, topic); setQuestionToMove(null); setMessage(`Przeniesiono pytanie do tematu „${targetTopic?.title ?? targetTopicId}”.`); };
  const logout = async () => { try { await adminApi.logout(); } finally { onLogout(); } };

  const view = topic ? "questions" : chapter ? "topics" : "chapters";
  const isQuestionEditorOpen = editorQuestion !== undefined && Boolean(chapter && topic);

  useEffect(() => {
    if (isQuestionEditorOpen) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [isQuestionEditorOpen]);

  return <main className="admin-shell">
    <header className="admin-header"><div><h1>Panel admina</h1><p>Zarządzaj rozdziałami, tematami i pytaniami per przedmiot.</p></div><button className="secondary-button" onClick={logout} type="button">Wyloguj</button></header>
    <Breadcrumb subject={subject} chapter={chapter} topic={topic} onChapters={() => { setChapter(null); setTopic(null); setEditorQuestion(undefined); }} onTopics={() => { setTopic(null); setEditorQuestion(undefined); }} />
    {message && <p className="status">{message}</p>}{error && <p className="status error">{error}</p>}
    {!isQuestionEditorOpen && view === "chapters" && <section className="admin-panel"><div className="subject-tabs" aria-label="Przedmiot">{subjects.map((item) => <button aria-pressed={item.id === subject?.id} className="subject-tab" key={item.id} onClick={() => setSubject(item)} type="button">{item.title}</button>)}</div><div className="section-header"><h2>Rozdziały: {subject?.title ?? "Przedmiot"}</h2><button onClick={addChapter} type="button">+ Dodaj rozdział</button></div><ItemList empty="Brak rozdziałów. Dodaj pierwszy rozdział." items={chapters} onSelect={chooseChapter} /></section>}
    {!isQuestionEditorOpen && view === "topics" && chapter && <><div className="chapter-settings-grid"><ChapterNumberEditor chapter={chapter} onUpdated={(updated) => { setChapter(updated); setChapters((current) => current.map((item) => item.id === updated.id ? updated : item)); setMessage("Zapisano numer rozdziału."); }} /><TargetQuestionCountEditor chapter={chapter} onUpdated={(updated) => { setChapter(updated); setChapters((current) => current.map((item) => item.id === updated.id ? updated : item)); setMessage("Zapisano liczbę losowanych pytań."); }} /></div><section className="admin-panel"><div className="section-header"><div><h2>{chapter.title}</h2><p className="question-count">Do quizu trafiają tylko pytania z aktywnych tematów.</p></div><button onClick={() => { setError(""); setIsTopicDialogOpen(true); }} type="button">+ Dodaj temat</button></div><TopicList items={topics} onDelete={setTopicToDelete} onSelect={chooseTopic} onToggle={toggleTopic} /></section></>}
    {!isQuestionEditorOpen && view === "questions" && <section className="admin-panel"><div className="section-header"><div><h2>{topic?.title ?? "Pytania"}</h2><p className="question-count">{formatQuestionCount(questions.length)}</p></div><button onClick={() => setEditorQuestion(null)} type="button">+ Dodaj pytanie</button></div>{questions.length === 0 ? <p className="empty-state">Ten temat nie ma jeszcze pytań. Dodaj pierwsze pytanie.</p> : <div className="question-list">{questions.map((item, index) => {
      const isActive = item.is_active !== false;
      return <div className={`question-row${isActive ? "" : " question-row-inactive"}`} key={item.id}>
        <span className="question-number">{index + 1}.</span>
        <span className="question-content"><span className="question-text">{item.text}</span><span className={`topic-status ${isActive ? "topic-status-active" : "topic-status-inactive"}`}>{isActive ? "Aktywne" : "Nieaktywne"}</span></span>
        <span className="question-actions"><button className="secondary-button" onClick={() => setEditorQuestion(item)} type="button">Edytuj</button><button className={isActive ? "secondary-button" : "topic-activate-button"} onClick={() => toggleQuestion(item)} type="button">{isActive ? "Wyłącz" : "Aktywuj"}</button><button className="secondary-button" disabled={topics.length < 2} onClick={() => setQuestionToMove(item)} title={topics.length < 2 ? "Dodaj drugi temat, aby przenieść pytanie" : undefined} type="button">Przenieś</button><button className="delete-button" onClick={() => deleteQuestion(item)} type="button">Usuń</button></span>
      </div>;
    })}</div>}</section>}
    {isQuestionEditorOpen && chapter && topic && <QuestionEditor question={editorQuestion} subject={subject} chapter={chapter} topic={topic} onCancel={() => setEditorQuestion(undefined)} onSave={async (payload) => { try { if (editorQuestion) await adminApi.updateQuestion(chapter.id, topic.id, editorQuestion.id, payload); else await adminApi.createQuestion(chapter.id, topic.id, payload); await loadQuestions(chapter, topic); setEditorQuestion(undefined); setMessage("Zapisano pytanie."); } catch (reason) { throw reason; } }} />}
    {isTopicDialogOpen && chapter && (
      <CreateTopicDialog
        chapterTitle={chapter.title}
        onCancel={() => setIsTopicDialogOpen(false)}
        onCreate={addTopic}
      />
    )}
    {questionToMove && topic && <MoveQuestionDialog currentTopicId={topic.id} onCancel={() => setQuestionToMove(null)} onMove={moveQuestionToTopic} question={questionToMove} topics={topics} />}
    {topicToDelete && <DeleteTopicDialog onCancel={() => setTopicToDelete(null)} onDelete={deleteTopic} topic={topicToDelete} />}
  </main>;
}

function CreateTopicDialog({ chapterTitle, onCancel, onCreate }: { chapterTitle: string; onCancel: () => void; onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onCancel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel, saving]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Wpisz nazwę tematu.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onCreate(trimmedName);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Nie udało się dodać tematu.");
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onMouseDown={() => { if (!saving) onCancel(); }}>
      <section
        aria-describedby="create-topic-description"
        aria-labelledby="create-topic-title"
        aria-modal="true"
        className="admin-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="admin-modal-icon" aria-hidden="true">+</div>
        <div className="admin-modal-heading">
          <h2 id="create-topic-title">Dodaj nowy temat</h2>
          <p id="create-topic-description">Utwórz temat w rozdziale „{chapterTitle}”.</p>
        </div>
        <form onSubmit={submit}>
          <label className="form-field">
            Nazwa tematu
            <input
              autoFocus
              disabled={saving}
              maxLength={120}
              onChange={(event) => { setName(event.target.value); setError(""); }}
              placeholder="np. Konsekwencje położenia geograficznego"
              value={name}
            />
          </label>
          {error && <p className="admin-modal-error" role="alert">{error}</p>}
          <div className="admin-modal-actions">
            <button className="secondary-button" disabled={saving} onClick={onCancel} type="button">Anuluj</button>
            <button disabled={saving} type="submit">{saving ? "Dodawanie…" : "Dodaj temat"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function MoveQuestionDialog({ currentTopicId, question, topics, onCancel, onMove }: { currentTopicId: string; question: AdminQuestion; topics: AdminTopic[]; onCancel: () => void; onMove: (targetTopicId: string) => Promise<void> }) {
  const availableTopics = topics.filter((item) => item.id !== currentTopicId);
  const [targetTopicId, setTargetTopicId] = useState(availableTopics[0]?.id ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onCancel(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel, saving]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!targetTopicId) { setError("Wybierz temat docelowy."); return; }
    setSaving(true); setError("");
    try { await onMove(targetTopicId); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Nie udało się przenieść pytania."); setSaving(false); }
  };

  return <div className="admin-modal-backdrop" onMouseDown={() => { if (!saving) onCancel(); }}><section aria-labelledby="move-question-title" aria-modal="true" className="admin-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog"><div className="admin-modal-heading"><h2 id="move-question-title">Przenieś pytanie</h2><p className="move-question-preview">{question.text}</p></div><form onSubmit={submit}><label className="form-field">Temat docelowy<select autoFocus value={targetTopicId} onChange={(event) => setTargetTopicId(event.target.value)}>{availableTopics.map((item) => <option key={item.id} value={item.id}>{item.title}{item.is_active ? "" : " — nieaktywny"}</option>)}</select></label>{error && <p className="admin-modal-error" role="alert">{error}</p>}<div className="admin-modal-actions"><button className="secondary-button" disabled={saving} onClick={onCancel} type="button">Anuluj</button><button disabled={saving || !targetTopicId} type="submit">{saving ? "Przenoszenie…" : "Przenieś"}</button></div></form></section></div>;
}

function DeleteTopicDialog({ topic, onCancel, onDelete }: { topic: AdminTopic; onCancel: () => void; onDelete: () => Promise<void> }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) onCancel(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel, saving]);

  const remove = async () => {
    setSaving(true); setError("");
    try { await onDelete(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Nie udało się usunąć tematu."); setSaving(false); }
  };

  return <div className="admin-modal-backdrop" onMouseDown={() => { if (!saving) onCancel(); }}><section aria-describedby="delete-topic-description" aria-labelledby="delete-topic-title" aria-modal="true" className="admin-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog"><div className="admin-modal-icon delete-modal-icon" aria-hidden="true">!</div><div className="admin-modal-heading"><h2 id="delete-topic-title">Usunąć temat?</h2><p id="delete-topic-description">Temat „{topic.title}” zawiera {formatQuestionCount(topic.question_count)}. Zniknie z rozdziału razem ze swoimi pytaniami. Kopia danych zostanie zachowana na wypadek pomyłki.</p></div>{error && <p className="admin-modal-error" role="alert">{error}</p>}<div className="admin-modal-actions"><button className="secondary-button" disabled={saving} onClick={onCancel} type="button">Anuluj</button><button className="danger-button" disabled={saving} onClick={remove} type="button">{saving ? "Usuwanie…" : "Usuń temat"}</button></div></section></div>;
}

function Breadcrumb({ subject, chapter, topic, onChapters, onTopics }: { subject: AdminSubject | null; chapter: AdminChapter | null; topic: AdminTopic | null; onChapters: () => void; onTopics: () => void }) {
  return <nav className="breadcrumb" aria-label="Ścieżka">{chapter || topic ? <button className="link-button" onClick={onChapters} type="button">{subject?.title ?? "Przedmiot"}</button> : <span aria-current="page">{subject?.title ?? "Przedmiot"}</span>}{chapter && <><span className="breadcrumb-separator">/</span>{topic ? <button className="link-button" onClick={onTopics} type="button">{chapter.title}</button> : <span aria-current="page">{chapter.title}</span>}</>}{topic && <><span className="breadcrumb-separator">/</span><span aria-current="page">{topic.title}</span></>}</nav>;
}

function ChapterNumberEditor({ chapter, onUpdated }: { chapter: AdminChapter; onUpdated: (chapter: AdminChapter) => void }) {
  const [value, setValue] = useState(chapter.chapter_number?.toString() ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValue(chapter.chapter_number?.toString() ?? ""); setError(""); }, [chapter.id, chapter.chapter_number]);

  const save = async () => {
    const trimmed = value.trim();
    const chapterNumber = trimmed === "" ? null : Number(trimmed);
    if (chapterNumber !== null && (!Number.isInteger(chapterNumber) || chapterNumber < 1)) {
      setError("Wpisz dodatnią liczbę całkowitą albo pozostaw pole puste.");
      return;
    }

    setSaving(true); setError("");
    try { onUpdated(await adminApi.updateChapterNumber(chapter.id, chapterNumber)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Nie udało się zapisać numeru rozdziału."); }
    finally { setSaving(false); }
  };

  return <section className="admin-panel chapter-number-panel"><h2>Plakietka rozdziału</h2><p>Numer jest widoczny na karcie quizu jako „Rozdział X”. Puste pole ukrywa plakietkę.</p><label className="form-field compact-field">Numer rozdziału<input min="1" onChange={(event) => setValue(event.target.value)} type="number" value={value} /></label><button disabled={saving} onClick={save} type="button">Zapisz numer</button>{error && <p className="status error">{error}</p>}</section>;
}

function TargetQuestionCountEditor({ chapter, onUpdated }: { chapter: AdminChapter; onUpdated: (chapter: AdminChapter) => void }) {
  const [value, setValue] = useState(chapter.target_question_count.toString());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValue(chapter.target_question_count.toString()); setError(""); }, [chapter.id, chapter.target_question_count]);

  const save = async () => {
    const targetQuestionCount = Number(value.trim());
    if (!Number.isInteger(targetQuestionCount) || targetQuestionCount < 1) {
      setError("Wpisz dodatnią liczbę całkowitą.");
      return;
    }

    setSaving(true); setError("");
    try { onUpdated(await adminApi.updateTargetQuestionCount(chapter.id, targetQuestionCount)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Nie udało się zapisać liczby pytań."); }
    finally { setSaving(false); }
  };

  return <section className="admin-panel chapter-number-panel"><h2>Liczba losowanych pytań</h2><p>Quiz wylosuje tyle pytań ze wszystkich tematów tego rozdziału, o ile dostępnych jest ich wystarczająco dużo.</p><label className="form-field compact-field">Liczba pytań<input min="1" onChange={(event) => setValue(event.target.value)} type="number" value={value} /></label><button disabled={saving} onClick={save} type="button">Zapisz liczbę pytań</button>{error && <p className="status error">{error}</p>}</section>;
}

function ItemList<T extends { id: string; title: string }>({ empty, items, onSelect }: { empty: string; items: T[]; onSelect: (item: T) => void }) {
  if (!items.length) return <p className="empty-state">{empty}</p>;
  return <div className="item-list">{items.map((item) => <button className="item-button" key={item.id} onClick={() => onSelect(item)} type="button">{item.title}</button>)}</div>;
}

function TopicList({ items, onDelete, onSelect, onToggle }: { items: AdminTopic[]; onDelete: (item: AdminTopic) => void; onSelect: (item: AdminTopic) => void; onToggle: (item: AdminTopic) => void }) {
  if (!items.length) return <p className="empty-state">Ten rozdział nie ma jeszcze tematów. Dodaj pierwszy temat.</p>;
  return <div className="item-list">{items.map((item) => <div className="topic-item" key={item.id}><button className="item-button topic-select-button" onClick={() => onSelect(item)} type="button"><span>{item.title}</span><span className={`topic-status ${item.is_active ? "topic-status-active" : "topic-status-inactive"}`}>{item.is_active ? "Aktywny" : "Nieaktywny"}</span></button><span className="topic-actions"><button className={item.is_active ? "secondary-button" : "topic-activate-button"} onClick={() => onToggle(item)} type="button">{item.is_active ? "Wyłącz" : "Aktywuj"}</button><button className="delete-button" onClick={() => onDelete(item)} type="button">Usuń</button></span></div>)}</div>;
}

function QuestionEditor({ question, subject, chapter, topic, onCancel, onSave }: { question: AdminQuestion | null; subject: AdminSubject | null; chapter: AdminChapter; topic: AdminTopic; onCancel: () => void; onSave: (payload: AdminQuestionPayload) => Promise<void> }) {
  const [draft, setDraft] = useState(() => createDraft(question ?? undefined));
  const [showContext, setShowContext] = useState(Boolean(question?.context?.text ?? question?.source_text));
  const [multiSlot, setMultiSlot] = useState(Boolean(question?.answer_slots?.length));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageLibrary, setImageLibrary] = useState<AdminImageLibrary | null>(null);
  const [imageLibraryError, setImageLibraryError] = useState("");
  const [isImageLibraryOpen, setIsImageLibraryOpen] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const type = draft.selection_type;
  const isChoice = type === "single" || type === "multiple" || (type === "map" && draft.map_config.mode === "identify");
  const isTrueFalse = type === "true_false";
  const supportsImage = type === "single" || type === "open";
  const isTextAnswer = type === "open" || type === "llm";
  const availableQuestionTypes = questionTypes.filter(([value]) => subject?.id === "math" || !mathOnlyQuestionTypes.has(value));
  const update = (values: Partial<Draft>) => setDraft((current) => ({ ...current, ...values }));
  const updateAnswer = (index: number, values: Partial<Answer>) => update({ answers: draft.answers.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item) });
  const updateFillBlank = (index: number, blank: FillBlank) => update({ fill_blanks: draft.fill_blanks.map((item, itemIndex) => itemIndex === index ? blank : item) });
  const updateFillBlankId = (index: number, id: string) => setDraft((current) => {
    const previousId = current.fill_blanks[index].id;
    const previousToken = `{{${previousId}}}`;
    const nextToken = `{{${id}}}`;
    const text = previousId && id && current.text.includes(previousToken) ? current.text.replaceAll(previousToken, nextToken) : current.text;
    return { ...current, text, fill_blanks: current.fill_blanks.map((item, itemIndex) => itemIndex === index ? { ...item, id } : item) };
  });
  const addFillBlank = () => {
    const usedIds = new Set(draft.fill_blanks.map((blank) => blank.id));
    let number = draft.fill_blanks.length + 1;
    while (usedIds.has(`luka_${number}`)) number += 1;
    update({ fill_blanks: [...draft.fill_blanks, blankFillBlank(`luka_${number}`)] });
  };
  const changeFillMode = (fill_mode: "select" | "open") => update({ fill_mode, fill_blanks: fill_mode === "open" ? draft.fill_blanks.map((blank) => blank.accepted_answers.length ? blank : { ...blank, accepted_answers: [""] }) : draft.fill_blanks });
  const insertFillToken = (id: string) => { if (!id) return; const token = `{{${id}}}`; if (!draft.text.includes(token)) update({ text: draft.text ? `${draft.text.trimEnd()} ${token}` : token }); };
  const fileSelected = async (file: File | undefined) => { if (!file) return; if (file.size > 5 * 1024 * 1024) { setError("Plik obrazka jest zbyt duży. Maksymalny rozmiar to 5 MB."); return; } setIsImageUploading(true); setError(""); try { const content_base64 = await fileToDataUrl(file); const uploaded = await adminApi.uploadImage(chapter.id, { filename: file.name, content_base64 }); update({ image: uploaded.path, imageUpload: null }); setImageLibrary(null); } catch (reason) { setError(reason instanceof Error ? reason.message : "Nie udało się przesłać obrazka."); } finally { setIsImageUploading(false); } };
  const submit = async (event: FormEvent) => { event.preventDefault(); const payload = toPayload(draft, multiSlot); const validation = validatePayload(payload); if (validation) { setError(validation); return; } setSaving(true); setError(""); try { await onSave(payload); } catch (reason) { setError(reason instanceof Error ? reason.message : "Nie udało się zapisać pytania."); } finally { setSaving(false); } };
  const chooseMapSource = (source: string) => { const preset = mapPresets[source]; update({ map_config: { ...draft.map_config, source, ...(preset ?? {}) } }); };
  const openImageLibrary = async () => { setIsImageLibraryOpen(true); setImageLibraryError(""); if (imageLibrary) return; try { setImageLibrary(await adminApi.images(chapter.id)); } catch (reason) { setImageLibraryError(reason instanceof Error ? reason.message : "Nie udało się wczytać biblioteki obrazów."); } };

  return <section className="editor-panel"><div className="editor-heading"><div><h2>{question ? "Edytuj pytanie" : "Dodaj pytanie"}</h2><p>{question ? "Zaktualizuj pytanie w wybranym temacie" : "Utwórz nowe pytanie w wybranym temacie"}</p></div><button className="secondary-button" onClick={onCancel} type="button">← Wróć do listy pytań</button></div><div className="editor-context" aria-label="Miejsce dodawania pytania"><span>Dodajesz pytanie tutaj:</span><strong>{subject?.title ?? "Przedmiot"}</strong><span>/</span><strong>{chapter.title}</strong><span>/</span><strong>{topic.title}</strong></div><form id="question-form" onSubmit={submit}>
    <section className="editor-card"><h3>Dane pytania</h3><label className="form-field compact-field">Typ pytania<select value={type} onChange={(event) => update({ selection_type: event.target.value as SelectionType })}>{availableQuestionTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="form-field">Treść pytania<textarea rows={3} value={draft.text} onChange={(event) => update({ text: event.target.value })} /></label>{showContext ? <label className="form-field">Tekst źródłowy <textarea rows={4} value={draft.contextText} onChange={(event) => update({ contextText: event.target.value })} /></label> : <button className="link-button add-optional-button" onClick={() => setShowContext(true)} type="button">+ Dodaj tekst źródłowy</button>}</section>
    {supportsImage && <section className="editor-card"><h3>Materiały dodatkowe</h3>{draft.image || draft.imageUpload ? <div className="image-preview">{(draft.image || draft.imageUpload) && <img alt="Miniatura obrazka" src={draft.image || draft.imageUpload?.content_base64} />}<div><p>{draft.imageUpload?.filename ?? draft.image.split("/").pop()}</p><button className="secondary-button" onClick={() => update({ image: "", imageUpload: null })} type="button">Usuń obrazek</button></div></div> : <>{isImageUploading ? <p className="status">Przenoszenie obrazka do biblioteki…</p> : <><button className="image-library-button" onClick={openImageLibrary} type="button">Wybierz z biblioteki obrazów</button><label className="upload-dropzone">Albo wczytaj nowy obrazek z komputera<input accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => { void fileSelected(event.target.files?.[0]); event.currentTarget.value = ""; }} type="file" /></label><label className="form-field">Link do obrazka<input placeholder="https://..." value={draft.image} onChange={(event) => update({ image: event.target.value, imageUpload: null })} /></label></>}</>}</section>}
    {isChoice && <section className="editor-card"><div className="section-header"><h3>Odpowiedzi</h3><button className="secondary-button" onClick={() => update({ answers: [...draft.answers, blankAnswer()] })} type="button">+ Odpowiedź</button></div><div className="row-stack">{draft.answers.map((answer, index) => <div className="answer-row" key={index}><input placeholder="Odpowiedź" value={answer.text} onChange={(event) => updateAnswer(index, { text: event.target.value })} /><label className="inline-check"><input checked={answer.is_correct} name="correct-answer" onChange={(event) => { if (type === "multiple") updateAnswer(index, { is_correct: event.target.checked }); else update({ answers: draft.answers.map((item, itemIndex) => ({ ...item, is_correct: itemIndex === index && event.target.checked })) }); }} type={type === "multiple" ? "checkbox" : "radio"} />poprawna</label><button className="secondary-button" onClick={() => update({ answers: draft.answers.filter((_, itemIndex) => itemIndex !== index) })} type="button">Usuń</button></div>)}</div></section>}
    {isTrueFalse && <section className="editor-card"><div className="section-header"><h3>Zdania</h3><button className="secondary-button" onClick={() => update({ answers: [...draft.answers, blankAnswer()] })} type="button">+ Zdanie</button></div><p>Przy każdym zdaniu ustaw, czy jest prawdziwe, czy fałszywe.</p><div className="row-stack">{draft.answers.map((answer, index) => <div className="true-false-editor-row" key={index}><input placeholder="Treść zdania" value={answer.text} onChange={(event) => updateAnswer(index, { text: event.target.value })} /><select aria-label={`Prawdziwość zdania ${index + 1}`} onChange={(event) => updateAnswer(index, { is_correct: event.target.value === "true" })} value={String(answer.is_correct)}><option value="true">Prawda</option><option value="false">Fałsz</option></select><button className="secondary-button" onClick={() => update({ answers: draft.answers.filter((_, itemIndex) => itemIndex !== index) })} type="button">Usuń</button></div>)}</div></section>}
    {isTextAnswer && <section className="editor-card">{type === "open" && <label className="inline-check"><input checked={multiSlot} onChange={(event) => setMultiSlot(event.target.checked)} type="checkbox" />Uczeń ma wpisać kilka osobnych odpowiedzi</label>}{multiSlot && type === "open" ? <AnswerSlotsEditor slots={draft.answer_slots} onChange={(answer_slots) => update({ answer_slots })} /> : <ArrayEditor title={type === "llm" ? "Odpowiedź wzorcowa dla AI" : "Poprawne odpowiedzi"} addLabel="+ Wariant" values={draft.accepted_answers} onChange={(accepted_answers) => update({ accepted_answers })} placeholder="Wariant odpowiedzi" />}</section>}
    {type === "fill" && <section className="editor-card"><h3>Luki w tekście</h3><p>Każda luka ma swój znacznik, np. <code>{"{{luka_1}}"}</code>. Wstaw go dokładnie raz w treści pytania.</p><label className="form-field compact-field">Sposób udzielania odpowiedzi<select value={draft.fill_mode} onChange={(event) => changeFillMode(event.target.value as "select" | "open")}><option value="select">Uczeń wybiera odpowiedź z listy</option><option value="open">Uczeń sam wpisuje odpowiedź</option></select></label><div className="section-header"><h3>Definicje luk</h3><button className="secondary-button" onClick={addFillBlank} type="button">+ Dodaj lukę</button></div><div className="fill-blank-list">{draft.fill_blanks.map((blank, index) => { const token = `{{${blank.id}}}`; const markerCount = blank.id ? draft.text.split(token).length - 1 : 0; return <FillBlankEditor blank={blank} index={index} key={index} markerCount={markerCount} mode={draft.fill_mode} onChange={(nextBlank) => updateFillBlank(index, nextBlank)} onIdChange={(id) => updateFillBlankId(index, id)} onInsertToken={() => insertFillToken(blank.id)} onRemove={() => update({ fill_blanks: draft.fill_blanks.filter((_, itemIndex) => itemIndex !== index) })} />; })}</div></section>}
    {type === "order" && <section className="editor-card"><div className="section-header"><h3>Elementy w poprawnej kolejności</h3><button className="secondary-button" onClick={() => update({ order_items: [...draft.order_items, blankOrderItem()] })} type="button">+ Element</button></div><div className="row-stack">{draft.order_items.map((item, index) => <div className="order-item-row" key={index}><input placeholder="Element w kolejności" value={item.text} onChange={(event) => update({ order_items: draft.order_items.map((row, rowIndex) => rowIndex === index ? { ...row, text: event.target.value } : row) })} /><button className="secondary-button" disabled={index === 0} onClick={() => update({ order_items: moveItem(draft.order_items, index, -1) })} type="button">Wyżej</button><button className="secondary-button" disabled={index === draft.order_items.length - 1} onClick={() => update({ order_items: moveItem(draft.order_items, index, 1) })} type="button">Niżej</button><button className="secondary-button" onClick={() => update({ order_items: draft.order_items.filter((_, rowIndex) => rowIndex !== index) })} type="button">Usuń</button></div>)}</div></section>}
    {type === "matching" && <section className="editor-card"><div className="section-header"><h3>Pary do dopasowania</h3><button className="secondary-button" onClick={() => update({ matching_pairs: [...draft.matching_pairs, blankMatchingPair()] })} type="button">+ Para</button></div><p>Ta sama wartość może wystąpić w więcej niż jednej parze, np. jedna ideologia może mieć kilku myślicieli.</p><div className="row-stack">{draft.matching_pairs.map((pair, index) => <div className="matching-pair-row" key={index}><input placeholder="Lewy element" value={pair.left} onChange={(event) => update({ matching_pairs: draft.matching_pairs.map((row, rowIndex) => rowIndex === index ? { ...row, left: event.target.value } : row) })} /><input placeholder="Dopasowanie" value={pair.right} onChange={(event) => update({ matching_pairs: draft.matching_pairs.map((row, rowIndex) => rowIndex === index ? { ...row, right: event.target.value } : row) })} /><button className="secondary-button" onClick={() => update({ matching_pairs: draft.matching_pairs.filter((_, rowIndex) => rowIndex !== index) })} type="button">Usuń</button></div>)}</div></section>}
    {type === "map" && <section className="editor-card"><h3>Konfiguracja mapy</h3><label className="form-field">Mapa<select value={draft.map_config.source} onChange={(event) => chooseMapSource(event.target.value)}><option value="/static/maps/ancient-civilizations-regions.geojson">Starożytne cywilizacje</option><option value="/static/maps/poland-voivodeships.geojson">Województwa Polski</option><option value="/static/maps/poland-neighbours.geojson">Polska i państwa sąsiadujące</option><option value="/static/maps/world-continents.geojson">Kontynenty świata</option><option value="/static/maps/world-lines.geojson">Linie geograficzne świata</option></select></label><label className="form-field">Tryb odpowiedzi<select value={draft.map_config.mode} onChange={(event) => update({ map_config: { ...draft.map_config, mode: event.target.value as MapConfig["mode"] } })}><option value="select">Wskazanie regionu</option><option value="identify">Rozpoznanie zaznaczonego regionu</option></select></label><label className="form-field">Interakcja<select value={draft.map_config.interaction ?? "region"} onChange={(event) => update({ map_config: { ...draft.map_config, interaction: event.target.value as MapConfig["interaction"] } })}><option value="region">Region</option><option value="line">Linia</option></select></label><label className="form-field">Identyfikator poprawnego regionu lub linii<input value={draft.map_config.target_feature_id} onChange={(event) => update({ map_config: { ...draft.map_config, target_feature_id: event.target.value } })} placeholder="np. ancient_egypt albo equator" /></label><label className="form-field">Podkład GeoJSON (opcjonalnie)<input value={draft.map_config.background_source ?? ""} onChange={(event) => update({ map_config: { ...draft.map_config, background_source: event.target.value } })} placeholder="/static/maps/..." /></label></section>}
    {type === "hotspot" && <section className="editor-card"><h3>Konfiguracja diagramu</h3><label className="form-field">Plik SVG<input value={draft.hotspot_config.source} onChange={(event) => update({ hotspot_config: { ...draft.hotspot_config, source: event.target.value } })} /></label><label className="form-field">Identyfikator poprawnego obszaru<input value={draft.hotspot_config.target_hotspot_id} onChange={(event) => update({ hotspot_config: { ...draft.hotspot_config, target_hotspot_id: event.target.value } })} placeholder="np. NW" /></label></section>}
    {type === "written_multiplication" && <section className="editor-card"><h3>Zakres losowanych liczb</h3><p>Ustawienia podstawowe dotyczą trybu trudnego. Tryb łatwy dodatkowo ogranicza rozmiar działania i wyniki cząstkowe.</p><div className="compact-settings-grid"><label className="form-field">Najmniejsza liczba<input min={10} max={9999} type="number" value={draft.written_multiplication_config.min_factor} onChange={(event) => update({ written_multiplication_config: { ...draft.written_multiplication_config, min_factor: Number(event.target.value) } })} /></label><label className="form-field">Największa liczba<input min={10} max={9999} type="number" value={draft.written_multiplication_config.max_factor} onChange={(event) => update({ written_multiplication_config: { ...draft.written_multiplication_config, max_factor: Number(event.target.value) } })} /></label><label className="form-field">Maksymalna łączna liczba cyfr — trudny<input min={4} max={6} type="number" value={draft.written_multiplication_config.max_total_digits} onChange={(event) => update({ written_multiplication_config: { ...draft.written_multiplication_config, max_total_digits: Number(event.target.value) } })} /></label><label className="form-field">Maksymalna łączna liczba cyfr — łatwy<input min={4} max={6} type="number" value={draft.written_multiplication_config.easy_max_total_digits} onChange={(event) => update({ written_multiplication_config: { ...draft.written_multiplication_config, easy_max_total_digits: Number(event.target.value) } })} /></label><label className="form-field">Maksymalny wynik cząstkowy — łatwy<input min={10} max={9999} type="number" value={draft.written_multiplication_config.easy_max_partial_product} onChange={(event) => update({ written_multiplication_config: { ...draft.written_multiplication_config, easy_max_partial_product: Number(event.target.value) } })} /></label></div></section>}
    {type === "timed_multiplication" && <section className="editor-card"><h3>Tabliczka mnożenia na czas</h3><p>Czynniki 1, 2 i 10 są wykluczone. Działanie zostanie wylosowane z ustawionego zakresu.</p><div className="compact-settings-grid"><label className="form-field">Najmniejszy czynnik<input min={3} max={9} type="number" value={draft.timed_multiplication_config.min_factor} onChange={(event) => update({ timed_multiplication_config: { ...draft.timed_multiplication_config, min_factor: Number(event.target.value) } })} /></label><label className="form-field">Największy czynnik<input min={3} max={9} type="number" value={draft.timed_multiplication_config.max_factor} onChange={(event) => update({ timed_multiplication_config: { ...draft.timed_multiplication_config, max_factor: Number(event.target.value) } })} /></label><label className="form-field">Czas na odpowiedź (sekundy)<input min={1} max={60} type="number" value={draft.timed_multiplication_config.time_limit_seconds} onChange={(event) => update({ timed_multiplication_config: { ...draft.timed_multiplication_config, time_limit_seconds: Number(event.target.value) } })} /></label></div></section>}
    {type === "timed_division" && <section className="editor-card"><h3>Tabliczka dzielenia na czas</h3><p>Dzielna powstaje z iloczynu dzielnika i wyniku, dlatego każde działanie dzieli się bez reszty.</p><div className="compact-settings-grid"><label className="form-field">Najmniejszy dzielnik<input min={3} max={9} type="number" value={draft.timed_division_config.min_divisor} onChange={(event) => update({ timed_division_config: { ...draft.timed_division_config, min_divisor: Number(event.target.value) } })} /></label><label className="form-field">Największy dzielnik<input min={3} max={9} type="number" value={draft.timed_division_config.max_divisor} onChange={(event) => update({ timed_division_config: { ...draft.timed_division_config, max_divisor: Number(event.target.value) } })} /></label><label className="form-field">Najmniejszy wynik<input min={3} max={9} type="number" value={draft.timed_division_config.min_quotient} onChange={(event) => update({ timed_division_config: { ...draft.timed_division_config, min_quotient: Number(event.target.value) } })} /></label><label className="form-field">Największy wynik<input min={3} max={9} type="number" value={draft.timed_division_config.max_quotient} onChange={(event) => update({ timed_division_config: { ...draft.timed_division_config, max_quotient: Number(event.target.value) } })} /></label><label className="form-field">Czas na odpowiedź (sekundy)<input min={1} max={60} type="number" value={draft.timed_division_config.time_limit_seconds} onChange={(event) => update({ timed_division_config: { ...draft.timed_division_config, time_limit_seconds: Number(event.target.value) } })} /></label></div></section>}
    {type === "written_division" && <section className="editor-card"><h3>Zakres dzielenia pisemnego</h3><p>Dzielna powstaje przez pomnożenie dzielnika i ilorazu. Poziomy łatwy i średni zachowują małe wartości w kolejnych krokach, a Pro korzysta z pełnego zakresu.</p><div className="compact-settings-grid"><label className="form-field">Najmniejszy dzielnik — Pro<input min={2} max={9999} type="number" value={draft.written_division_config.min_divisor} onChange={(event) => update({ written_division_config: { ...draft.written_division_config, min_divisor: Number(event.target.value) } })} /></label><label className="form-field">Największy dzielnik — Pro<input min={2} max={9999} type="number" value={draft.written_division_config.max_divisor} onChange={(event) => update({ written_division_config: { ...draft.written_division_config, max_divisor: Number(event.target.value) } })} /></label><label className="form-field">Najmniejszy iloraz<input min={2} max={9999} type="number" value={draft.written_division_config.min_quotient} onChange={(event) => update({ written_division_config: { ...draft.written_division_config, min_quotient: Number(event.target.value) } })} /></label><label className="form-field">Największy iloraz — Pro<input min={2} max={9999} type="number" value={draft.written_division_config.max_quotient} onChange={(event) => update({ written_division_config: { ...draft.written_division_config, max_quotient: Number(event.target.value) } })} /></label><label className="form-field">Maksymalna liczba cyfr dzielnej — Pro<input min={2} max={6} type="number" value={draft.written_division_config.max_dividend_digits} onChange={(event) => update({ written_division_config: { ...draft.written_division_config, max_dividend_digits: Number(event.target.value) } })} /></label><label className="form-field">Najmniejszy dzielnik — łatwy<input min={2} max={99} type="number" value={draft.written_division_config.easy_min_divisor} onChange={(event) => update({ written_division_config: { ...draft.written_division_config, easy_min_divisor: Number(event.target.value) } })} /></label><label className="form-field">Największy dzielnik — łatwy<input min={2} max={99} type="number" value={draft.written_division_config.easy_max_divisor} onChange={(event) => update({ written_division_config: { ...draft.written_division_config, easy_max_divisor: Number(event.target.value) } })} /></label><label className="form-field">Najmniejszy dzielnik — średni<input min={2} max={99} type="number" value={draft.written_division_config.medium_min_divisor} onChange={(event) => update({ written_division_config: { ...draft.written_division_config, medium_min_divisor: Number(event.target.value) } })} /></label><label className="form-field">Największy dzielnik — średni<input min={2} max={99} type="number" value={draft.written_division_config.medium_max_divisor} onChange={(event) => update({ written_division_config: { ...draft.written_division_config, medium_max_divisor: Number(event.target.value) } })} /></label><label className="form-field">Największy iloraz — łatwy i średni<input min={2} max={9999} type="number" value={draft.written_division_config.easy_max_quotient} onChange={(event) => update({ written_division_config: { ...draft.written_division_config, easy_max_quotient: Number(event.target.value) } })} /></label><label className="form-field">Maksymalna liczba cyfr dzielnej — łatwy i średni<input min={2} max={6} type="number" value={draft.written_division_config.easy_max_dividend_digits} onChange={(event) => update({ written_division_config: { ...draft.written_division_config, easy_max_dividend_digits: Number(event.target.value) } })} /></label><label className="form-field">Maksymalna wartość pośrednia — łatwy i średni<input min={10} max={9999} type="number" value={draft.written_division_config.easy_max_intermediate_value} onChange={(event) => update({ written_division_config: { ...draft.written_division_config, easy_max_intermediate_value: Number(event.target.value) } })} /></label></div></section>}
    {type === "operation_order" && <section className="editor-card"><h3>Kolejność wykonywania działań</h3><p>Poziom trudności steruje liczbą kroków i zakresem liczb. Rodzina zapewnia równomierne ćwiczenie konkretnej zasady.</p><label className="form-field compact-field">Ćwiczona zasada<select value={draft.operation_order_config.family} onChange={(event) => update({ operation_order_config: { family: event.target.value as OperationOrderConfig["family"] } })}><option value="precedence">Mnożenie i dzielenie przed dodawaniem i odejmowaniem</option><option value="parentheses">Nawiasy</option><option value="powers">Potęgowanie</option><option value="left_to_right">Działania równorzędne od lewej do prawej</option></select></label></section>}
    <section className="editor-card"><label className="form-field">{isChoice && type !== "map" ? "Wyjaśnienie (opcjonalne)" : "Wyjaśnienie"}<textarea rows={3} value={draft.explanation} onChange={(event) => update({ explanation: event.target.value })} /></label></section>
    {error && <p className="status error">{error}</p>}<div className="form-actions"><button className="secondary-button" onClick={onCancel} type="button">Anuluj</button><button disabled={saving || isImageUploading} type="submit">{question ? "Zapisz zmiany" : "Dodaj pytanie"}</button></div>
    {isImageLibraryOpen && <ImageLibraryDialog library={imageLibrary} error={imageLibraryError} onCancel={() => setIsImageLibraryOpen(false)} onSelect={(path) => { update({ image: path, imageUpload: null }); setIsImageLibraryOpen(false); }} />}
  </form></section>;
}

function ImageLibraryDialog({ library, error, onCancel, onSelect }: { library: AdminImageLibrary | null; error: string; onCancel: () => void; onSelect: (path: string) => void }) {
  const [folder, setFolder] = useState("");

  useEffect(() => {
    if (library) setFolder(library.default_folder);
  }, [library]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

  const visibleImages = library?.images.filter((image) => image.folder === folder) ?? [];

  return <div className="admin-modal-backdrop" onMouseDown={onCancel}><section aria-labelledby="image-library-title" aria-modal="true" className="admin-modal image-library-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog"><div className="admin-modal-heading"><h2 id="image-library-title">Biblioteka obrazów</h2><p>Wybierz gotowy obraz z katalogu aplikacji.</p></div>{error ? <p className="admin-modal-error" role="alert">{error}</p> : !library ? <p className="image-library-loading">Wczytywanie obrazów…</p> : <><label className="form-field image-library-folder">Folder<select value={folder} onChange={(event) => setFolder(event.target.value)}>{library.folders.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>{visibleImages.length ? <div className="image-library-grid">{visibleImages.map((image) => <button className="image-library-item" key={image.path} onClick={() => onSelect(image.path)} type="button"><img alt="" src={image.path} /><span>{image.filename}</span></button>)}</div> : <p className="empty-state">Brak obrazów w tym folderze.</p>}</>}<div className="admin-modal-actions"><button className="secondary-button" onClick={onCancel} type="button">Anuluj</button></div></section></div>;
}

function FillBlankEditor({ blank, index, markerCount, mode, onChange, onIdChange, onInsertToken, onRemove }: { blank: FillBlank; index: number; markerCount: number; mode: "select" | "open"; onChange: (blank: FillBlank) => void; onIdChange: (id: string) => void; onInsertToken: () => void; onRemove: () => void }) {
  const updateOption = (optionIndex: number, value: string) => {
    const previousValue = blank.options[optionIndex];
    const options = blank.options.map((option, index) => index === optionIndex ? value : option);
    const accepted_answers = blank.accepted_answers.map((answer) => answer === previousValue ? value : answer).filter(Boolean);
    onChange({ ...blank, options, accepted_answers });
  };
  const toggleCorrectOption = (option: string, checked: boolean) => onChange({ ...blank, accepted_answers: checked ? [...new Set([...blank.accepted_answers, option])] : blank.accepted_answers.filter((answer) => answer !== option) });
  const removeOption = (optionIndex: number) => {
    const removedOption = blank.options[optionIndex];
    onChange({ ...blank, options: blank.options.filter((_, index) => index !== optionIndex), accepted_answers: blank.accepted_answers.filter((answer) => answer !== removedOption) });
  };
  const markerClass = markerCount === 1 ? "fill-marker-status valid" : "fill-marker-status invalid";
  const markerMessage = markerCount === 1 ? "Znacznik jest prawidłowo wstawiony w treści." : markerCount === 0 ? "Znacznika nie ma jeszcze w treści pytania." : "Znacznik występuje w treści więcej niż raz.";

  return <section className="fill-blank-card"><div className="section-header"><h4>Luka {index + 1}</h4><button className="secondary-button" onClick={onRemove} type="button">Usuń lukę</button></div><div className="fill-blank-identity"><label className="form-field">Nazwa luki <input aria-label={`Nazwa luki ${index + 1}`} placeholder="np. gospodarka" value={blank.id} onChange={(event) => onIdChange(event.target.value.toLowerCase().replace(/\s+/g, "_"))} /></label><div className="fill-token-panel"><span>Znacznik w treści</span><code>{blank.id ? `{{${blank.id}}}` : "{{...}}"}</code><button className="secondary-button" disabled={!blank.id || markerCount > 0} onClick={onInsertToken} type="button">Wstaw do treści</button></div></div><p className={markerClass}>{markerMessage}</p>{mode === "select" ? <div className="fill-options-editor"><div><h5>Odpowiedzi na liście</h5><p>Każdą odpowiedź wpisz osobno i zaznacz, która jest poprawna.</p></div>{blank.options.map((option, optionIndex) => <div className="fill-option-row" key={optionIndex}><input aria-label={`Odpowiedź ${optionIndex + 1} dla luki ${index + 1}`} placeholder={`Odpowiedź ${optionIndex + 1}`} value={option} onChange={(event) => updateOption(optionIndex, event.target.value)} /><label className="inline-check"><input checked={Boolean(option) && blank.accepted_answers.includes(option)} disabled={!option.trim()} onChange={(event) => toggleCorrectOption(option, event.target.checked)} type="checkbox" />Poprawna</label><button className="secondary-button" disabled={blank.options.length <= 2} onClick={() => removeOption(optionIndex)} type="button">Usuń</button></div>)}<button className="secondary-button fill-add-option" onClick={() => onChange({ ...blank, options: [...blank.options, ""] })} type="button">+ Dodaj odpowiedź</button></div> : <div className="fill-options-editor"><div><h5>Akceptowane odpowiedzi</h5><p>Dodaj osobno wszystkie warianty, które mają zostać uznane za poprawne.</p></div>{blank.accepted_answers.map((answer, answerIndex) => <div className="fill-open-answer-row" key={answerIndex}><input aria-label={`Poprawna odpowiedź ${answerIndex + 1} dla luki ${index + 1}`} placeholder={`Poprawna odpowiedź ${answerIndex + 1}`} value={answer} onChange={(event) => onChange({ ...blank, accepted_answers: blank.accepted_answers.map((item, itemIndex) => itemIndex === answerIndex ? event.target.value : item) })} /><button className="secondary-button" disabled={blank.accepted_answers.length <= 1} onClick={() => onChange({ ...blank, accepted_answers: blank.accepted_answers.filter((_, itemIndex) => itemIndex !== answerIndex) })} type="button">Usuń</button></div>)}<button className="secondary-button fill-add-option" onClick={() => onChange({ ...blank, accepted_answers: [...blank.accepted_answers, ""] })} type="button">+ Dodaj wariant</button></div>}</section>;
}

function AnswerSlotsEditor({ slots, onChange }: { slots: AnswerSlot[]; onChange: (slots: AnswerSlot[]) => void }) {
  const updateSlot = (slotIndex: number, slot: AnswerSlot) => onChange(slots.map((item, index) => index === slotIndex ? slot : item));

  return <div className="answer-slots-editor"><div className="section-header"><div><h3>Pola odpowiedzi</h3><p>Każde pole oznacza jedną wymaganą odpowiedź. Kolejność wpisania odpowiedzi przez ucznia nie ma znaczenia.</p></div><button className="secondary-button" onClick={() => onChange([...slots, { accepted_answers: [""] }])} type="button">+ Dodaj pole</button></div><div className="answer-slot-list">{slots.map((slot, slotIndex) => <section className="answer-slot-card" key={slotIndex}><div className="section-header"><h4>Pole odpowiedzi {slotIndex + 1}</h4><button className="secondary-button" disabled={slots.length <= 2} onClick={() => onChange(slots.filter((_, index) => index !== slotIndex))} type="button">Usuń pole</button></div><p>Wpisz osobno wszystkie formy, które mają zostać uznane za tę samą odpowiedź.</p><div className="answer-slot-variants">{slot.accepted_answers.map((answer, answerIndex) => <div className="answer-slot-variant-row" key={answerIndex}><input aria-label={`Wariant ${answerIndex + 1} pola odpowiedzi ${slotIndex + 1}`} placeholder={answerIndex === 0 ? "Główna odpowiedź" : `Wariant ${answerIndex + 1}`} value={answer} onChange={(event) => updateSlot(slotIndex, { accepted_answers: slot.accepted_answers.map((item, index) => index === answerIndex ? event.target.value : item) })} /><button className="secondary-button" disabled={slot.accepted_answers.length <= 1} onClick={() => updateSlot(slotIndex, { accepted_answers: slot.accepted_answers.filter((_, index) => index !== answerIndex) })} type="button">Usuń</button></div>)}</div><button className="secondary-button answer-slot-add-variant" onClick={() => updateSlot(slotIndex, { accepted_answers: [...slot.accepted_answers, ""] })} type="button">+ Dodaj wariant</button></section>)}</div></div>;
}

function ArrayEditor({ title, addLabel, values, onChange, placeholder }: { title: string; addLabel: string; values: string[]; onChange: (values: string[]) => void; placeholder: string }) {
  return <><div className="section-header"><h3>{title}</h3><button className="secondary-button" onClick={() => onChange([...values, ""])} type="button">{addLabel}</button></div><div className="row-stack">{values.map((value, index) => <div className="accepted-answer-row" key={index}><input placeholder={placeholder} value={value} onChange={(event) => onChange(values.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /><button className="secondary-button" onClick={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} type="button">Usuń</button></div>)}</div></>;
}

function toPayload(draft: Draft, multiSlot: boolean): AdminQuestionPayload {
  const payload: AdminQuestionPayload = { selection_type: draft.selection_type, text: draft.text.trim() };
  if (draft.explanation.trim()) payload.explanation = draft.explanation.trim();
  if (draft.contextText.trim()) payload.context = { text: draft.contextText.trim() };
  if (draft.image.trim()) payload.image = draft.image.trim();
  if (draft.imageUpload) payload.image_upload = draft.imageUpload;
  if (draft.selection_type === "single" || draft.selection_type === "multiple" || draft.selection_type === "true_false") payload.answers = draft.answers.filter((answer) => answer.text.trim()).map((answer) => ({ ...answer, text: answer.text.trim() }));
  if (draft.selection_type === "open") { if (multiSlot) payload.answer_slots = draft.answer_slots.map((slot) => ({ accepted_answers: slot.accepted_answers.map((value) => value.trim()).filter(Boolean) })).filter((slot) => slot.accepted_answers.length); else payload.accepted_answers = draft.accepted_answers.map((value) => value.trim()).filter(Boolean); }
  if (draft.selection_type === "llm") payload.accepted_answers = draft.accepted_answers.map((value) => value.trim()).filter(Boolean);
  if (draft.selection_type === "fill") { payload.fill_mode = draft.fill_mode; payload.fill_blanks = draft.fill_blanks.map((blank) => ({ id: blank.id.trim(), accepted_answers: blank.accepted_answers.map((value) => value.trim()).filter(Boolean), options: draft.fill_mode === "select" ? blank.options.map((value) => value.trim()).filter(Boolean) : [] })); }
  if (draft.selection_type === "order") payload.order_items = draft.order_items.filter((item) => item.text.trim()).map((item) => ({ ...item, text: item.text.trim() }));
  if (draft.selection_type === "matching") payload.matching_pairs = draft.matching_pairs.filter((pair) => pair.left.trim() || pair.right.trim());
  if (draft.selection_type === "map") { payload.map_config = draft.map_config; if (draft.map_config.mode === "identify") payload.answers = draft.answers.filter((answer) => answer.text.trim()).map((answer) => ({ ...answer, text: answer.text.trim() })); }
  if (draft.selection_type === "hotspot") payload.hotspot_config = draft.hotspot_config;
  if (draft.selection_type === "written_multiplication") payload.written_multiplication_config = draft.written_multiplication_config;
  if (draft.selection_type === "written_division") payload.written_division_config = draft.written_division_config;
  if (draft.selection_type === "timed_multiplication") payload.timed_multiplication_config = draft.timed_multiplication_config;
  if (draft.selection_type === "timed_division") payload.timed_division_config = draft.timed_division_config;
  if (draft.selection_type === "operation_order") payload.operation_order_config = draft.operation_order_config;
  return payload;
}

function validatePayload(payload: AdminQuestionPayload): string {
  if (!payload.text) return "Wpisz treść pytania.";
  if (!["single", "multiple"].includes(payload.selection_type) && !payload.explanation) return "Wpisz wyjaśnienie.";
  if (payload.selection_type === "single" && ((payload.answers?.length ?? 0) < 2 || payload.answers?.filter((answer) => answer.is_correct).length !== 1)) return "Dodaj co najmniej dwie odpowiedzi i zaznacz dokładnie jedną poprawną.";
  if (payload.selection_type === "multiple" && ((payload.answers?.length ?? 0) < 2 || (payload.answers?.filter((answer) => answer.is_correct).length ?? 0) < 2)) return "Dodaj co najmniej dwie odpowiedzi i zaznacz co najmniej dwie poprawne.";
  if (payload.selection_type === "true_false" && ((payload.answers?.length ?? 0) < 2 || !payload.answers?.some((answer) => answer.is_correct) || !payload.answers?.some((answer) => !answer.is_correct))) return "Dodaj co najmniej dwa zdania: przynajmniej jedno prawdziwe i jedno fałszywe.";
  if (["open", "llm"].includes(payload.selection_type) && !(payload.answer_slots?.length || payload.accepted_answers?.length)) return "Dodaj co najmniej jedną poprawną odpowiedź.";
  if (payload.selection_type === "open" && payload.answer_slots && payload.answer_slots.length < 2) return "Tryb wielu pól wymaga co najmniej dwóch pól odpowiedzi.";
  if (payload.selection_type === "fill") {
    const blanks = payload.fill_blanks ?? [];
    if (!blanks.length) return "Dodaj co najmniej jedną lukę.";
    if (blanks.some((blank) => !/^[a-z][a-z0-9_-]*$/.test(blank.id))) return "Nazwy luk muszą zaczynać się małą literą i mogą zawierać tylko małe litery, cyfry, _ lub -.";
    if (new Set(blanks.map((blank) => blank.id)).size !== blanks.length) return "Każda luka musi mieć inną nazwę.";
    if (blanks.some((blank) => !blank.accepted_answers.length)) return "Zaznacz co najmniej jedną poprawną odpowiedź dla każdej luki.";
    if (payload.fill_mode === "select" && blanks.some((blank) => blank.options.length < 2 || new Set(blank.options).size !== blank.options.length || blank.accepted_answers.some((answer) => !blank.options.includes(answer)))) return "Każda lista musi mieć co najmniej dwie różne opcje, a poprawna odpowiedź musi być jedną z nich.";
    const tokens = [...payload.text.matchAll(/\{\{([a-z][a-z0-9_-]*)\}\}/g)].map((match) => match[1]);
    if (tokens.length !== blanks.length || tokens.some((token, index) => token !== blanks[index].id)) return "Wstaw każdy znacznik luki dokładnie raz i w tej samej kolejności co definicje luk.";
  }
  if (payload.selection_type === "order" && (payload.order_items?.length ?? 0) < 2) return "Dodaj co najmniej dwa elementy do ułożenia.";
  if (payload.selection_type === "matching" && ((payload.matching_pairs?.length ?? 0) < 2 || payload.matching_pairs?.some((pair) => !pair.left || !pair.right))) return "Dodaj co najmniej dwie pełne pary do dopasowania.";
  if (payload.selection_type === "map" && (!payload.map_config?.source || !payload.map_config.target_feature_id)) return "Wybierz mapę i wpisz identyfikator poprawnego regionu.";
  if (payload.selection_type === "hotspot" && (!payload.hotspot_config?.source || !payload.hotspot_config.target_hotspot_id)) return "Wpisz plik SVG i identyfikator poprawnego obszaru.";
  if (payload.selection_type === "written_multiplication") { const config = payload.written_multiplication_config; if (!config || config.min_factor < 10 || config.max_factor > 9999 || config.min_factor > config.max_factor || config.max_total_digits < 4 || config.max_total_digits > 6 || String(config.min_factor).length * 2 > config.max_total_digits || config.easy_max_total_digits < 4 || config.easy_max_total_digits > config.max_total_digits || String(config.min_factor).length * 2 > config.easy_max_total_digits || config.easy_max_partial_product < 10 || config.easy_max_partial_product > 9999) return "Zakres mnożenia lub ustawienia trybu łatwego są nieprawidłowe."; }
  if (payload.selection_type === "written_division") { const config = payload.written_division_config; if (!config || config.min_divisor < 2 || config.max_divisor > 9999 || config.min_divisor > config.max_divisor || config.min_quotient < 2 || config.max_quotient > 9999 || config.min_quotient > config.max_quotient || config.max_dividend_digits < 2 || config.max_dividend_digits > 6 || String(config.min_divisor).length + String(config.min_quotient).length > config.max_dividend_digits || config.easy_min_divisor < config.min_divisor || config.easy_min_divisor > config.easy_max_divisor || config.easy_max_divisor > Math.min(config.max_divisor, 99) || config.medium_min_divisor < config.min_divisor || config.medium_min_divisor > config.medium_max_divisor || config.medium_max_divisor > Math.min(config.max_divisor, 99) || config.easy_max_quotient < config.min_quotient || config.easy_max_quotient > config.max_quotient || config.easy_max_dividend_digits < 2 || config.easy_max_dividend_digits > config.max_dividend_digits || String(config.min_divisor * config.min_quotient).length > config.easy_max_dividend_digits || config.easy_max_intermediate_value < 10 || config.easy_max_intermediate_value > 9999) return "Zakres dzielenia lub ustawienia poziomów trudności są nieprawidłowe."; }
  if (payload.selection_type === "timed_multiplication") { const config = payload.timed_multiplication_config; if (!config || config.min_factor < 3 || config.max_factor > 9 || config.min_factor > config.max_factor || config.time_limit_seconds < 1 || config.time_limit_seconds > 60) return "Czynniki muszą mieścić się w zakresie 3–9, a czas w zakresie 1–60 sekund."; }
  if (payload.selection_type === "timed_division") { const config = payload.timed_division_config; if (!config || config.min_divisor < 3 || config.max_divisor > 9 || config.min_divisor > config.max_divisor || config.min_quotient < 3 || config.max_quotient > 9 || config.min_quotient > config.max_quotient || config.time_limit_seconds < 1 || config.time_limit_seconds > 60) return "Dzielnik i wynik muszą mieścić się w zakresie 3–9, a czas w zakresie 1–60 sekund."; }
  if (payload.selection_type === "operation_order" && !payload.operation_order_config) return "Wybierz rodzinę działań.";
  return "";
}

function moveItem<T>(items: T[], index: number, direction: number): T[] { const result = [...items]; const next = index + direction; if (next >= 0 && next < result.length) [result[index], result[next]] = [result[next], result[index]]; return result; }
function formatQuestionCount(count: number): string { if (count === 1) return "1 pytanie"; if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return `${count} pytania`; return `${count} pytań`; }
function fileToDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
const questionTypes: Array<[SelectionType, string]> = [["single", "Jedna poprawna odpowiedź"], ["multiple", "Kilka poprawnych odpowiedzi"], ["true_false", "Prawda / Fałsz"], ["open", "Odpowiedź pisemna"], ["fill", "Uzupełnianie tekstu"], ["order", "Układanie w kolejności"], ["matching", "Dopasowywanie par"], ["map", "Wskazanie na mapie"], ["hotspot", "Wskazanie na diagramie"], ["operation_order", "Kolejność wykonywania działań"], ["timed_multiplication", "Tabliczka mnożenia na czas"], ["timed_division", "Tabliczka dzielenia na czas"], ["written_multiplication", "Mnożenie pod kreską"], ["written_division", "Dzielenie pod kreską"], ["llm", "Odpowiedź pisemna oceniana przez AI"]];
const mathOnlyQuestionTypes = new Set<SelectionType>(["operation_order", "timed_multiplication", "timed_division", "written_multiplication", "written_division"]);
