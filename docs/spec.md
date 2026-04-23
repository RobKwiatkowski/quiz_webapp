# Edu Quiz for Kids — Specification

## 1. Project overview
This project is about building a lightweight educational quiz application for children, hosted on a home webserver.

The application should help a child aged 10–12 prepare for school quizzes or short tests, for example in history.

The main interaction model contains:
- a simple single-choice quiz with four answers (ABCD)
- a simple multiple-choice quiz with four answers (ABCD)
- open questions
- optional images in question cards
- immediate feedback after each answer

This is not intended to be a full learning platform or a multiplayer classroom tool. It is a focused, small educational application designed for home use.

The service should be independent from the existing notes application and available under a separate URL.

Code repository:
https://github.com/RobKwiatkowski/Quiz_webapp

## 2. Main goal
The goal is to build a simple, clear, interactive quiz application that:
- is easy for a child to use
- supports learning before a school test
- is lightweight enough to run on Raspberry Pi 3
- is simple to maintain and extend
- avoids unnecessary technical complexity in MVP

## 3. Product vision
The product should feel like:
- a focused educational quiz
- calm and readable
- interactive but simple
- more like practice before a test than a game show

It is inspired by quiz-style tools, but it is not intended to replicate Kahoot or similar multiplayer platforms.

## 4. Target user
Primary user:
- a child aged 10–11

Expected use case:
- solving a short quiz before a school test
- mostly single-player
- at home
- on a local home server

## 5. MVP scope
Included in MVP:
- one independent quiz service
- separate URL from the notes app
- one category at the beginning, for example history
- structure prepared for many quizzes in the future
- one quiz = one chapter from a school book
- each chapter contains several topics
- each topic is stored in a separate JSON file
- questions are created manually by the author
- the app selects questions from topics according to chapter metadata
- target quiz size is configurable, for example 12, 20, or 26 questions
- the backend first iterates through topics in the order defined in `meta.json`
- the backend selects a base number of questions per topic using integer division:
  - `questions_per_topic = target_question_count // number_of_topics`
- if some questions are still missing, the backend fills the remaining slots by randomly selecting unused questions from all topics listed in `meta.json`
- if there are still not enough questions overall, the quiz uses as many questions as are available
- question order may be randomized after selection
- support for single-choice, multiple-choice, and short open-text questions
- optional images for some questions
- one question displayed at a time
- answer order randomized for closed questions
- immediate feedback after answering or checking
- final score shown at the end
- restart quiz after completion
- no login
- no user profiles
- no score persistence
- no admin panel
- local Docker Compose based development workflow

Explicitly out of scope for MVP:
- multiplayer mode
- live classroom sessions
- rankings
- timers
- saving attempts to database
- teacher dashboard
- content editor in UI
- image upload via UI
- repeating incorrect questions after the quiz
- advanced gamification

## 6. Functional assumptions

### Quiz flow
1. The user opens the application.
2. The user sees a list of quizzes, where each quiz represents one chapter.
3. The user starts a selected quiz.
4. The backend loads all topic files for that chapter.
5. The backend selects questions from topics according to the chapter metadata.
6. Questions are shown one by one.
7. For each question:
   - `single`: user clicks one answer and gets immediate feedback
   - `multiple`: user selects answers and clicks Check
   - `open`: user types a short answer and clicks Check
8. For open questions, answers are compared after:
   - trimming spaces
   - converting text to lowercase
   - removing trailing punctuation
   - ignoring Polish diacritics during comparison
9. The user moves to the next question.
10. After all questions, the final score is shown.
11. The user may restart the quiz.

### Feedback rules
- Correct answer: short confirmation only.
- Incorrect answer: short explanation and correct answer where relevant.
- Final result: summary score, for example `9/12`.

### Final score message
The final score message depends on the percentage result:
- `< 50%` → `Musisz jeszcze poćwiczyć`
- `>= 50% and < 75%` → `Nieźle ale może być lepiej`
- `>= 75% and < 90%` → `Dobrze`
- `>= 90% and < 100%` → `Bardzo dobrze`
- `== 100%` → `Perfekcyjnie!`

### Keyboard behavior
- Enter should trigger the same action as the currently visible main action button:
  - `Check`, if `Check` is visible
  - `Next`, if `Next` is visible
- This should work globally for the quiz screen, not only for open questions.

## 7. Content assumptions

### Questions
- prepared manually by the project owner
- designed for a child aged 10–11
- focused on school revision
- one quiz represents one chapter
- one topic inside a chapter is stored as one JSON file
- content should be easy to edit without changing application logic

### Images
- used only for selected questions
- stored as static files or referenced by remote URL
- referenced by path or URL in JSON
- local images may come from Wikimedia/Wikipedia and may require attribution support in the future

## 8. Technical assumptions

### General architecture
The application should be a separate service from the notes app.

Recommended structure:
- separate frontend
- separate backend
- separate deployment
- separate URL
- independent content files

### Hosting
- target platform: Raspberry Pi 3
- environment: home webserver / LAN use
- application should remain lightweight

### Frontend responsibilities
- loading ready quiz data from backend
- rendering one question at a time
- randomizing answer order for closed questions
- tracking current question
- calculating score
- rendering feedback and final result
- supporting keyboard interaction such as Enter for Check/Next
- supporting both local and remote images

### Backend responsibilities
- serving quiz metadata
- loading chapter metadata and topic JSON files
- selecting questions according to chapter selection rules
- returning one final quiz set to the frontend
- serving static assets if needed
- exposing simple API endpoints

### Data source
Initial source of truth:
- JSON files

Planned structure:
- one chapter folder per quiz
- one metadata file per chapter
- one JSON file per topic

This keeps content easier to maintain than one large file and matches the chapter/topic structure from the book.

## 9. UX assumptions
The interface should be:
- readable
- calm
- simple
- suitable for a 10–11 year old
- not overloaded with elements

Design principles:
- one main task on screen
- large clickable answer buttons
- clear progress information
- short feedback
- no unnecessary distractions

The product should not look overly childish, but should feel friendly and clear.

## 10. Non-functional assumptions
The MVP should be:
- simple to deploy
- easy to maintain
- lightweight on Raspberry Pi 3
- modular enough for future expansion
- separated from the notes application

The design should minimize technical debt by:
- separating content from logic
- using a dedicated quiz loader module
- keeping API contract independent from storage type
- structuring the app from the beginning for multiple quizzes

## 11. Future extension ideas
Possible future phases:
- more quiz categories
- multiple quizzes per category
- storing results
- child profiles
- admin panel
- question editor
- image upload
- timer mode
- repeat incorrect answers mode
- simple gamification
- database-backed quiz content
- teacher or parent dashboard
- image attribution support for locally stored Wikimedia/Wikipedia images

These are explicitly outside MVP.

## 12. Recommended repository / service strategy
This quiz application should be treated as a separate service from the notes application.

Reasoning:
- different purpose
- different UX
- different content structure
- different product flow
- cleaner architecture
- cleaner project context in future discussions

It may still be described as part of the broader home webserver ecosystem, but development should be handled independently.

## 13. Final MVP definition
The MVP is:

A lightweight single-player educational quiz application for a child aged 10–11, hosted on Raspberry Pi 3, available under a separate URL, where each quiz represents one chapter from a school book, each topic is stored in a separate JSON file, the backend assembles the final question set from those topics based on chapter metadata, and the frontend presents the questions one by one with simple feedback and a final score.
