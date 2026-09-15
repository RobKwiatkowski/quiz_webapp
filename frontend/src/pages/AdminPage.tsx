import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { adminApi, type AdminChapter, type AdminQuestion, type AdminQuestionPayload, type AdminSubject, type AdminTopic, type ImageUpload } from "../api/admin-api";
import type { Answer, AnswerSlot, FillBlank, HotspotConfig, MapConfig, MatchingPair, OrderItem, SelectionType } from "../api/quiz-api";
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
};

const mapPresets: Record<string, Pick<MapConfig, "mode" | "background_source" | "interaction">> = {
  "/static/maps/ancient-civilizations-regions.geojson": { mode: "select", background_source: "/static/maps/ancient-civilizations-basemap.geojson", interaction: "region" },
  "/static/maps/poland-voivodeships.geojson": { mode: "select", background_source: "", interaction: "region" },
  "/static/maps/world-continents.geojson": { mode: "identify", background_source: "", interaction: "region" },
  "/static/maps/world-lines.geojson": { mode: "select", background_source: "", interaction: "line" },
};

const blankAnswer = (): Answer => ({ text: "", is_correct: false });
const blankOrderItem = (): OrderItem => ({ id: "", text: "", position: 0 });
const blankMatchingPair = (): MatchingPair => ({ id: "", left: "", right: "" });
const blankFillBlank = (): FillBlank => ({ id: "", accepted_answers: [""], options: ["", ""] });

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
  const [error, setError] = useState("");

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
  const addTopic = async () => { if (!chapter) return; const name = window.prompt("Podaj nazwę tematu:")?.trim(); if (!name) return; try { const created = await adminApi.createTopic(chapter.id, name); await loadTopics(chapter); await chooseTopic(created); setMessage("Dodano temat."); } catch (reason) { fail(reason); } };
  const deleteQuestion = async (question: AdminQuestion) => { if (!chapter || !topic || !window.confirm("Czy na pewno usunąć to pytanie?")) return; try { await adminApi.deleteQuestion(chapter.id, topic.id, question.id); await loadQuestions(chapter, topic); setMessage("Usunięto pytanie."); } catch (reason) { fail(reason); } };
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
    {!isQuestionEditorOpen && view === "topics" && chapter && <><div className="chapter-settings-grid"><ChapterNumberEditor chapter={chapter} onUpdated={(updated) => { setChapter(updated); setChapters((current) => current.map((item) => item.id === updated.id ? updated : item)); setMessage("Zapisano numer rozdziału."); }} /><TargetQuestionCountEditor chapter={chapter} onUpdated={(updated) => { setChapter(updated); setChapters((current) => current.map((item) => item.id === updated.id ? updated : item)); setMessage("Zapisano liczbę losowanych pytań."); }} /></div><section className="admin-panel"><div className="section-header"><h2>{chapter.title}</h2><button onClick={addTopic} type="button">+ Dodaj temat</button></div><ItemList empty="Ten rozdział nie ma jeszcze tematów. Dodaj pierwszy temat." items={topics} onSelect={chooseTopic} /></section></>}
    {!isQuestionEditorOpen && view === "questions" && <section className="admin-panel"><div className="section-header"><div><h2>{topic?.title ?? "Pytania"}</h2><p className="question-count">{formatQuestionCount(questions.length)}</p></div><button onClick={() => setEditorQuestion(null)} type="button">+ Dodaj pytanie</button></div>{questions.length === 0 ? <p className="empty-state">Ten temat nie ma jeszcze pytań. Dodaj pierwsze pytanie.</p> : <div className="question-list">{questions.map((item, index) => <div className="question-row" key={item.id}><span className="question-number">{index + 1}.</span><span className="question-text">{item.text}</span><span className="question-actions"><button className="secondary-button" onClick={() => setEditorQuestion(item)} type="button">Edytuj</button><button className="delete-button" onClick={() => deleteQuestion(item)} type="button">Usuń</button></span></div>)}</div>}</section>}
    {isQuestionEditorOpen && chapter && topic && <QuestionEditor question={editorQuestion} subject={subject} chapter={chapter} topic={topic} onCancel={() => setEditorQuestion(undefined)} onSave={async (payload) => { try { if (editorQuestion) await adminApi.updateQuestion(chapter.id, topic.id, editorQuestion.id, payload); else await adminApi.createQuestion(chapter.id, topic.id, payload); await loadQuestions(chapter, topic); setEditorQuestion(undefined); setMessage("Zapisano pytanie."); } catch (reason) { throw reason; } }} />}
  </main>;
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

function QuestionEditor({ question, subject, chapter, topic, onCancel, onSave }: { question: AdminQuestion | null; subject: AdminSubject | null; chapter: AdminChapter; topic: AdminTopic; onCancel: () => void; onSave: (payload: AdminQuestionPayload) => Promise<void> }) {
  const [draft, setDraft] = useState(() => createDraft(question ?? undefined));
  const [showContext, setShowContext] = useState(Boolean(question?.context?.text ?? question?.source_text));
  const [multiSlot, setMultiSlot] = useState(Boolean(question?.answer_slots?.length));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const type = draft.selection_type;
  const isChoice = type === "single" || type === "multiple" || (type === "map" && draft.map_config.mode === "identify");
  const supportsImage = type === "single" || type === "open";
  const isTextAnswer = type === "open" || type === "llm";
  const update = (values: Partial<Draft>) => setDraft((current) => ({ ...current, ...values }));
  const updateAnswer = (index: number, values: Partial<Answer>) => update({ answers: draft.answers.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item) });
  const fileSelected = async (file: File | undefined) => { if (!file) return; try { const content_base64 = await fileToDataUrl(file); update({ image: "", imageUpload: { filename: file.name, content_base64 } }); } catch { setError("Nie udało się odczytać pliku obrazka."); } };
  const submit = async (event: FormEvent) => { event.preventDefault(); const payload = toPayload(draft, multiSlot); const validation = validatePayload(payload); if (validation) { setError(validation); return; } setSaving(true); setError(""); try { await onSave(payload); } catch (reason) { setError(reason instanceof Error ? reason.message : "Nie udało się zapisać pytania."); } finally { setSaving(false); } };
  const chooseMapSource = (source: string) => { const preset = mapPresets[source]; update({ map_config: { ...draft.map_config, source, ...(preset ?? {}) } }); };

  return <section className="editor-panel"><div className="editor-heading"><div><h2>{question ? "Edytuj pytanie" : "Dodaj pytanie"}</h2><p>{question ? "Zaktualizuj pytanie w wybranym temacie" : "Utwórz nowe pytanie w wybranym temacie"}</p></div><button className="secondary-button" onClick={onCancel} type="button">← Wróć do listy pytań</button></div><div className="editor-context" aria-label="Miejsce dodawania pytania"><span>Dodajesz pytanie tutaj:</span><strong>{subject?.title ?? "Przedmiot"}</strong><span>/</span><strong>{chapter.title}</strong><span>/</span><strong>{topic.title}</strong></div><form id="question-form" onSubmit={submit}>
    <section className="editor-card"><h3>Dane pytania</h3><label className="form-field compact-field">Typ pytania<select value={type} onChange={(event) => update({ selection_type: event.target.value as SelectionType })}>{questionTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="form-field">Treść pytania<textarea rows={3} value={draft.text} onChange={(event) => update({ text: event.target.value })} /></label>{showContext ? <label className="form-field">Tekst źródłowy <textarea rows={4} value={draft.contextText} onChange={(event) => update({ contextText: event.target.value })} /></label> : <button className="link-button add-optional-button" onClick={() => setShowContext(true)} type="button">+ Dodaj tekst źródłowy</button>}</section>
    {supportsImage && <section className="editor-card"><h3>Materiały dodatkowe</h3>{draft.image || draft.imageUpload ? <div className="image-preview">{(draft.image || draft.imageUpload) && <img alt="Miniatura obrazka" src={draft.image || draft.imageUpload?.content_base64} />}<div><p>{draft.image || draft.imageUpload?.filename}</p><button className="secondary-button" onClick={() => update({ image: "", imageUpload: null })} type="button">Usuń obrazek</button></div></div> : <><label className="upload-dropzone">Wybierz obrazek<input accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => fileSelected(event.target.files?.[0])} type="file" /></label><label className="form-field">Link do obrazka<input placeholder="https://..." value={draft.image} onChange={(event) => update({ image: event.target.value, imageUpload: null })} /></label></>}</section>}
    {isChoice && <section className="editor-card"><div className="section-header"><h3>Odpowiedzi</h3><button className="secondary-button" onClick={() => update({ answers: [...draft.answers, blankAnswer()] })} type="button">+ Odpowiedź</button></div><div className="row-stack">{draft.answers.map((answer, index) => <div className="answer-row" key={index}><input placeholder="Odpowiedź" value={answer.text} onChange={(event) => updateAnswer(index, { text: event.target.value })} /><label className="inline-check"><input checked={answer.is_correct} name="correct-answer" onChange={(event) => { if (type === "multiple") updateAnswer(index, { is_correct: event.target.checked }); else update({ answers: draft.answers.map((item, itemIndex) => ({ ...item, is_correct: itemIndex === index && event.target.checked })) }); }} type={type === "multiple" ? "checkbox" : "radio"} />poprawna</label><button className="secondary-button" onClick={() => update({ answers: draft.answers.filter((_, itemIndex) => itemIndex !== index) })} type="button">Usuń</button></div>)}</div></section>}
    {isTextAnswer && <section className="editor-card">{type === "open" && <label className="inline-check"><input checked={multiSlot} onChange={(event) => setMultiSlot(event.target.checked)} type="checkbox" />Kilka pól odpowiedzi</label>}{multiSlot && type === "open" ? <ArrayEditor title="Pola odpowiedzi" addLabel="+ Pole" values={draft.answer_slots.map((slot) => slot.accepted_answers.join("; "))} onChange={(values) => update({ answer_slots: values.map((value) => ({ accepted_answers: value.split(";").map((item) => item.trim()).filter(Boolean) })) })} placeholder="Warianty po średniku" /> : <ArrayEditor title={type === "llm" ? "Odpowiedź wzorcowa dla AI" : "Poprawne odpowiedzi"} addLabel="+ Wariant" values={draft.accepted_answers} onChange={(accepted_answers) => update({ accepted_answers })} placeholder="Wariant odpowiedzi" />}</section>}
    {type === "fill" && <section className="editor-card"><h3>Luki w tekście</h3><p>W treści wpisz znaczniki luk, np. <code>{"{{kierunek}}"}</code>. Każdy znacznik musi wystąpić raz.</p><label className="form-field compact-field">Tryb odpowiedzi<select value={draft.fill_mode} onChange={(event) => update({ fill_mode: event.target.value as "select" | "open" })}><option value="select">Wybór z listy</option><option value="open">Wpisywanie odpowiedzi</option></select></label><div className="section-header"><h3>Definicje luk</h3><button className="secondary-button" onClick={() => update({ fill_blanks: [...draft.fill_blanks, blankFillBlank()] })} type="button">+ Luka</button></div><div className="row-stack">{draft.fill_blanks.map((blank, index) => <div className="fill-blank-row" key={index}><input placeholder="Id, np. kierunek" value={blank.id} onChange={(event) => update({ fill_blanks: draft.fill_blanks.map((item, itemIndex) => itemIndex === index ? { ...item, id: event.target.value } : item) })} /><input placeholder="Poprawne warianty po średniku" value={blank.accepted_answers.join("; ")} onChange={(event) => update({ fill_blanks: draft.fill_blanks.map((item, itemIndex) => itemIndex === index ? { ...item, accepted_answers: event.target.value.split(";").map((value) => value.trim()).filter(Boolean) } : item) })} />{draft.fill_mode === "select" && <input placeholder="Opcje po średniku" value={blank.options.join("; ")} onChange={(event) => update({ fill_blanks: draft.fill_blanks.map((item, itemIndex) => itemIndex === index ? { ...item, options: event.target.value.split(";").map((value) => value.trim()).filter(Boolean) } : item) })} />}<button className="secondary-button" onClick={() => update({ fill_blanks: draft.fill_blanks.filter((_, itemIndex) => itemIndex !== index) })} type="button">Usuń</button></div>)}</div></section>}
    {type === "order" && <section className="editor-card"><div className="section-header"><h3>Elementy w poprawnej kolejności</h3><button className="secondary-button" onClick={() => update({ order_items: [...draft.order_items, blankOrderItem()] })} type="button">+ Element</button></div><div className="row-stack">{draft.order_items.map((item, index) => <div className="order-item-row" key={index}><input placeholder="Element w kolejności" value={item.text} onChange={(event) => update({ order_items: draft.order_items.map((row, rowIndex) => rowIndex === index ? { ...row, text: event.target.value } : row) })} /><button className="secondary-button" disabled={index === 0} onClick={() => update({ order_items: moveItem(draft.order_items, index, -1) })} type="button">Wyżej</button><button className="secondary-button" disabled={index === draft.order_items.length - 1} onClick={() => update({ order_items: moveItem(draft.order_items, index, 1) })} type="button">Niżej</button><button className="secondary-button" onClick={() => update({ order_items: draft.order_items.filter((_, rowIndex) => rowIndex !== index) })} type="button">Usuń</button></div>)}</div></section>}
    {type === "matching" && <section className="editor-card"><div className="section-header"><h3>Pary do dopasowania</h3><button className="secondary-button" onClick={() => update({ matching_pairs: [...draft.matching_pairs, blankMatchingPair()] })} type="button">+ Para</button></div><div className="row-stack">{draft.matching_pairs.map((pair, index) => <div className="matching-pair-row" key={index}><input placeholder="Lewy element" value={pair.left} onChange={(event) => update({ matching_pairs: draft.matching_pairs.map((row, rowIndex) => rowIndex === index ? { ...row, left: event.target.value } : row) })} /><input placeholder="Dopasowanie" value={pair.right} onChange={(event) => update({ matching_pairs: draft.matching_pairs.map((row, rowIndex) => rowIndex === index ? { ...row, right: event.target.value } : row) })} /><button className="secondary-button" onClick={() => update({ matching_pairs: draft.matching_pairs.filter((_, rowIndex) => rowIndex !== index) })} type="button">Usuń</button></div>)}</div></section>}
    {type === "map" && <section className="editor-card"><h3>Konfiguracja mapy</h3><label className="form-field">Mapa<select value={draft.map_config.source} onChange={(event) => chooseMapSource(event.target.value)}><option value="/static/maps/ancient-civilizations-regions.geojson">Starożytne cywilizacje</option><option value="/static/maps/poland-voivodeships.geojson">Województwa Polski</option><option value="/static/maps/world-continents.geojson">Kontynenty świata</option><option value="/static/maps/world-lines.geojson">Linie geograficzne świata</option></select></label><label className="form-field">Tryb odpowiedzi<select value={draft.map_config.mode} onChange={(event) => update({ map_config: { ...draft.map_config, mode: event.target.value as MapConfig["mode"] } })}><option value="select">Wskazanie regionu</option><option value="identify">Rozpoznanie zaznaczonego regionu</option></select></label><label className="form-field">Interakcja<select value={draft.map_config.interaction ?? "region"} onChange={(event) => update({ map_config: { ...draft.map_config, interaction: event.target.value as MapConfig["interaction"] } })}><option value="region">Region</option><option value="line">Linia</option></select></label><label className="form-field">Identyfikator poprawnego regionu lub linii<input value={draft.map_config.target_feature_id} onChange={(event) => update({ map_config: { ...draft.map_config, target_feature_id: event.target.value } })} placeholder="np. ancient_egypt albo equator" /></label><label className="form-field">Podkład GeoJSON (opcjonalnie)<input value={draft.map_config.background_source ?? ""} onChange={(event) => update({ map_config: { ...draft.map_config, background_source: event.target.value } })} placeholder="/static/maps/..." /></label></section>}
    {type === "hotspot" && <section className="editor-card"><h3>Konfiguracja diagramu</h3><label className="form-field">Plik SVG<input value={draft.hotspot_config.source} onChange={(event) => update({ hotspot_config: { ...draft.hotspot_config, source: event.target.value } })} /></label><label className="form-field">Identyfikator poprawnego obszaru<input value={draft.hotspot_config.target_hotspot_id} onChange={(event) => update({ hotspot_config: { ...draft.hotspot_config, target_hotspot_id: event.target.value } })} placeholder="np. NW" /></label></section>}
    <section className="editor-card"><label className="form-field">{isChoice && type !== "map" ? "Wyjaśnienie (opcjonalne)" : "Wyjaśnienie"}<textarea rows={3} value={draft.explanation} onChange={(event) => update({ explanation: event.target.value })} /></label></section>
    {error && <p className="status error">{error}</p>}<div className="form-actions"><button className="secondary-button" onClick={onCancel} type="button">Anuluj</button><button disabled={saving} type="submit">{question ? "Zapisz zmiany" : "Dodaj pytanie"}</button></div>
  </form></section>;
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
  if (draft.selection_type === "single" || draft.selection_type === "multiple") payload.answers = draft.answers.filter((answer) => answer.text.trim()).map((answer) => ({ ...answer, text: answer.text.trim() }));
  if (draft.selection_type === "open") { if (multiSlot) payload.answer_slots = draft.answer_slots.filter((slot) => slot.accepted_answers.length); else payload.accepted_answers = draft.accepted_answers.map((value) => value.trim()).filter(Boolean); }
  if (draft.selection_type === "llm") payload.accepted_answers = draft.accepted_answers.map((value) => value.trim()).filter(Boolean);
  if (draft.selection_type === "fill") { payload.fill_mode = draft.fill_mode; payload.fill_blanks = draft.fill_blanks.map((blank) => ({ id: blank.id.trim(), accepted_answers: blank.accepted_answers.map((value) => value.trim()).filter(Boolean), options: draft.fill_mode === "select" ? blank.options.map((value) => value.trim()).filter(Boolean) : [] })); }
  if (draft.selection_type === "order") payload.order_items = draft.order_items.filter((item) => item.text.trim()).map((item) => ({ ...item, text: item.text.trim() }));
  if (draft.selection_type === "matching") payload.matching_pairs = draft.matching_pairs.filter((pair) => pair.left.trim() || pair.right.trim());
  if (draft.selection_type === "map") { payload.map_config = draft.map_config; if (draft.map_config.mode === "identify") payload.answers = draft.answers.filter((answer) => answer.text.trim()).map((answer) => ({ ...answer, text: answer.text.trim() })); }
  if (draft.selection_type === "hotspot") payload.hotspot_config = draft.hotspot_config;
  return payload;
}

function validatePayload(payload: AdminQuestionPayload): string {
  if (!payload.text) return "Wpisz treść pytania.";
  if (!["single", "multiple"].includes(payload.selection_type) && !payload.explanation) return "Wpisz wyjaśnienie.";
  if (payload.selection_type === "single" && ((payload.answers?.length ?? 0) < 2 || payload.answers?.filter((answer) => answer.is_correct).length !== 1)) return "Dodaj co najmniej dwie odpowiedzi i zaznacz dokładnie jedną poprawną.";
  if (payload.selection_type === "multiple" && ((payload.answers?.length ?? 0) < 2 || (payload.answers?.filter((answer) => answer.is_correct).length ?? 0) < 2)) return "Dodaj co najmniej dwie odpowiedzi i zaznacz co najmniej dwie poprawne.";
  if (["open", "llm"].includes(payload.selection_type) && !(payload.answer_slots?.length || payload.accepted_answers?.length)) return "Dodaj co najmniej jedną poprawną odpowiedź.";
  if (payload.selection_type === "fill") { if (!(payload.fill_blanks?.length)) return "Dodaj co najmniej jedną lukę."; if (!payload.fill_blanks.every((blank) => blank.id && blank.accepted_answers.length && (payload.fill_mode === "open" || blank.options.length >= 2))) return "Uzupełnij identyfikator, poprawną odpowiedź i co najmniej dwie opcje dla każdej luki."; }
  if (payload.selection_type === "order" && (payload.order_items?.length ?? 0) < 2) return "Dodaj co najmniej dwa elementy do ułożenia.";
  if (payload.selection_type === "matching" && ((payload.matching_pairs?.length ?? 0) < 2 || payload.matching_pairs?.some((pair) => !pair.left || !pair.right))) return "Dodaj co najmniej dwie pełne pary do dopasowania.";
  if (payload.selection_type === "map" && (!payload.map_config?.source || !payload.map_config.target_feature_id)) return "Wybierz mapę i wpisz identyfikator poprawnego regionu.";
  if (payload.selection_type === "hotspot" && (!payload.hotspot_config?.source || !payload.hotspot_config.target_hotspot_id)) return "Wpisz plik SVG i identyfikator poprawnego obszaru.";
  return "";
}

function moveItem<T>(items: T[], index: number, direction: number): T[] { const result = [...items]; const next = index + direction; if (next >= 0 && next < result.length) [result[index], result[next]] = [result[next], result[index]]; return result; }
function formatQuestionCount(count: number): string { if (count === 1) return "1 pytanie"; if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return `${count} pytania`; return `${count} pytań`; }
function fileToDataUrl(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
const questionTypes: Array<[SelectionType, string]> = [["single", "Jedna poprawna odpowiedź"], ["multiple", "Kilka poprawnych odpowiedzi"], ["open", "Odpowiedź pisemna"], ["fill", "Uzupełnianie tekstu"], ["order", "Układanie w kolejności"], ["matching", "Dopasowywanie par"], ["map", "Wskazanie na mapie"], ["hotspot", "Wskazanie na diagramie"], ["llm", "Odpowiedź pisemna oceniana przez AI"]];
