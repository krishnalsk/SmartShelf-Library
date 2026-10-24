/* =====================================================================
   SmartShelf Library – Library Management System (frontend demo)
   Data lives in the browser's localStorage. NOT secure – demo use only.
   ===================================================================== */
'use strict';

/* ---------- 1. Small helpers ---------- */
const KEYS = {
  books: 'lib_books', users: 'lib_users', materials: 'lib_materials',
  records: 'lib_records', messages: 'lib_messages', settings: 'lib_settings', session: 'lib_session',
  catalogVersion: 'lib_catalog_version'
};
const LOAN_DAYS = 14;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Escape text before inserting into HTML (prevents HTML/script injection)
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function save(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { toast('Could not save data (storage unavailable).', 'error'); }
}
function uid(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ----- date helpers (dates are stored as "YYYY-MM-DD") ----- */
function toISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function todayISO() { return toISO(new Date()); }
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return toISO(new Date(y, m - 1, d + n));
}
function daysBetween(a, b) { // whole days from a to b
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
  return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
}
function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function money(n) { return '₹' + Number(n || 0).toFixed(0); }

function isEmail(s) {
  if (typeof s !== 'string' || s.length > 254) return false;
  const parts = s.split('@');
  if (parts.length !== 2 || parts[0].length > 64 || !parts[0] || !parts[1]) return false;
  const local = parts[0], domain = parts[1];
  if (!/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  const labels = domain.split('.');
  return domain.length <= 253 && labels.length > 1 && labels.every((label, i) =>
    label.length >= 1 && label.length <= 63 && /^[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?$/i.test(label) &&
    (i !== labels.length - 1 || label.length >= 2));
}
function isValidIsbn(isbn) {
  if (/^\d{13}$/.test(isbn)) {
    if (!/^97[89]/.test(isbn)) return false;
    const sum = Array.from(isbn.slice(0, 12), (digit, i) => Number(digit) * (i % 2 ? 3 : 1)).reduce((a, b) => a + b, 0);
    return (10 - sum % 10) % 10 === Number(isbn[12]);
  }
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = Array.from(isbn.slice(0, 9), (digit, i) => Number(digit) * (10 - i)).reduce((a, b) => a + b, 0);
    const check = isbn[9] === 'X' ? 10 : Number(isbn[9]);
    return (sum + check) % 11 === 0;
  }
  return false;
}
function isUrl(s) {
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; }
  catch (e) { return false; }
}

/* ---------- 2. Sample data & state ---------- */
function seedData() {
  const t = todayISO();
  const books = [
    { id: 'b1', title: 'Introduction to Algorithms', author: 'Cormen, Leiserson, Rivest, Stein', category: 'Computer Science', isbn: '9780262033848', description: 'Comprehensive guide to algorithms and data structures.', total: 4 },
    { id: 'b2', title: 'Clean Code', author: 'Robert C. Martin', category: 'Computer Science', isbn: '9780132350884', description: 'A handbook of agile software craftsmanship.', total: 3 },
    { id: 'b3', title: 'Database System Concepts', author: 'Silberschatz, Korth, Sudarshan', category: 'Computer Science', isbn: '9780078022159', description: 'Fundamentals of database design and SQL.', total: 3 },
    { id: 'b4', title: 'Operating System Concepts', author: 'Silberschatz, Galvin, Gagne', category: 'Computer Science', isbn: '9781119800361', description: 'Processes, memory, file systems and security.', total: 1 },
    { id: 'b5', title: 'Advanced Engineering Mathematics', author: 'Erwin Kreyszig', category: 'Mathematics', isbn: '9780470458365', description: 'Calculus, linear algebra and differential equations for engineers.', total: 5 },
    { id: 'b6', title: 'Numerical Methods for Engineers', author: 'Chapra, Canale', category: 'Mathematics', isbn: '9780073401065', description: 'Root finding, interpolation and numerical integration.', total: 2 },
    { id: 'b7', title: 'Concepts of Physics', author: 'H. C. Verma', category: 'Physics', isbn: '9788177091878', description: 'Clear explanations with plenty of solved problems.', total: 4 },
    { id: 'b8', title: 'Digital Design', author: 'M. Morris Mano', category: 'Electronics', isbn: '9780134549897', description: 'Logic gates, combinational and sequential circuits.', total: 3 },
    { id: 'b9', title: 'Wings of Fire', author: 'A. P. J. Abdul Kalam', category: 'Biography', isbn: '9788173711466', description: 'Autobiography of the Missile Man of India.', total: 2 },
    { id: 'b10', title: 'The Pragmatic Programmer', author: 'David Thomas, Andrew Hunt', category: 'Computer Science', isbn: '9780135957059', description: 'Practical techniques for building adaptable software.', total: 3 },
    { id: 'b11', title: 'Computer Networking: A Top-Down Approach', author: 'James Kurose, Keith Ross', category: 'Computer Science', isbn: '9780136681557', description: 'An application-focused introduction to computer networking.', total: 2 },
    { id: 'b12', title: 'Artificial Intelligence: A Modern Approach', author: 'Stuart Russell, Peter Norvig', category: 'Computer Science', isbn: '9780134610993', description: 'A broad introduction to the principles and practice of AI.', total: 2 },
    { id: 'b13', title: 'The C Programming Language', author: 'Brian W. Kernighan, Dennis M. Ritchie', category: 'Computer Science', isbn: '9780131103627', description: 'A classic guide to the C language and its core concepts.', total: 2 },
    { id: 'b14', title: 'Discrete Mathematics and Its Applications', author: 'Kenneth H. Rosen', category: 'Mathematics', isbn: '9780073383095', description: 'Logic, proofs, sets, graph theory and combinatorics.', total: 3 },
    { id: 'b15', title: 'Linear Algebra and Its Applications', author: 'David C. Lay', category: 'Mathematics', isbn: '9780321982384', description: 'A practical introduction to linear algebra and its applications.', total: 2 },
    { id: 'b16', title: 'University Physics', author: 'Hugh D. Young, Roger A. Freedman', category: 'Physics', isbn: '9780135159552', description: 'A calculus-based introduction to classical and modern physics.', total: 2 },
    { id: 'b17', title: 'The Selfish Gene', author: 'Richard Dawkins', category: 'Biology', isbn: '9780198788607', description: 'An influential perspective on evolution and natural selection.', total: 2 },
    { id: 'b18', title: 'The Diary of a Young Girl', author: 'Anne Frank', category: 'Biography', isbn: '9780553296983', description: 'The wartime diary of Anne Frank, published after her death.', total: 2 },
    { id: 'b19', title: 'Calculus: Early Transcendentals', author: 'James Stewart', category: 'Mathematics', isbn: '9781285741550', description: 'A clear, comprehensive introduction to single and multivariable calculus.', total: 2 },
    { id: 'b20', title: 'Fundamentals of Physics', author: 'David Halliday, Robert Resnick, Jearl Walker', category: 'Physics', isbn: '9781119320111', description: 'A broad introduction to mechanics, waves, thermodynamics and modern physics.', total: 2 },
    { id: 'b21', title: 'Introduction to Electrodynamics', author: 'David J. Griffiths', category: 'Physics', isbn: '9781108420419', description: 'An accessible treatment of electric and magnetic fields.', total: 2 },
    { id: 'b22', title: 'Six Easy Pieces', author: 'Richard P. Feynman', category: 'Physics', isbn: '9780465025275', description: 'Six introductory lessons on the foundations of physics.', total: 2 },
    { id: 'b23', title: 'The Art of Electronics', author: 'Paul Horowitz, Winfield Hill', category: 'Electronics', isbn: '9780521809269', description: 'A practical guide to designing and understanding electronic circuits.', total: 2 },
    { id: 'b24', title: 'Microelectronic Circuits', author: 'Adel S. Sedra, Kenneth C. Smith', category: 'Electronics', isbn: '9780190853464', description: 'Core principles and applications of analog and digital circuits.', total: 2 },
    { id: 'b25', title: 'Electronic Devices and Circuit Theory', author: 'Robert L. Boylestad, Louis Nashelsky', category: 'Electronics', isbn: '9780132622264', description: 'An introduction to electronic devices, circuits and their analysis.', total: 2 },
    { id: 'b26', title: 'Digital Fundamentals', author: 'Thomas L. Floyd', category: 'Electronics', isbn: '9780132737968', description: 'Foundations of digital logic, circuits and computer systems.', total: 2 },
    { id: 'b27', title: 'Steve Jobs', author: 'Walter Isaacson', category: 'Biography', isbn: '9781451648539', description: 'A biography of the Apple co-founder based on extensive interviews.', total: 2 },
    { id: 'b28', title: 'Long Walk to Freedom', author: 'Nelson Mandela', category: 'Biography', isbn: '9780316548182', description: 'Nelson Mandela’s account of his life and the struggle against apartheid.', total: 2 },
    { id: 'b29', title: 'The Story of My Experiments with Truth', author: 'M. K. Gandhi', category: 'Biography', isbn: '9780143330097', description: 'Mahatma Gandhi’s autobiography and reflections on his life.', total: 2 },
    { id: 'b30', title: 'Campbell Biology', author: 'Lisa A. Urry et al.', category: 'Biology', isbn: '9780134093413', description: 'A comprehensive introduction to biology, from cells to ecosystems.', total: 2 },
    { id: 'b31', title: 'Molecular Biology of the Cell', author: 'Bruce Alberts et al.', category: 'Biology', isbn: '9780815344322', description: 'A detailed introduction to cell structure and molecular processes.', total: 2 },
    { id: 'b32', title: 'The Origin of Species', author: 'Charles Darwin', category: 'Biology', isbn: '9780451529060', description: 'Charles Darwin’s foundational work on evolution by natural selection.', total: 2 },
    { id: 'b33', title: 'Biology: How Life Works', author: 'James Morris et al.', category: 'Biology', isbn: '9781319017637', description: 'An introduction to how biological systems work across scales.', total: 2 },
    { id: 'b34', title: 'Learning Web Design', author: 'Jennifer Robbins', category: 'Web Development', isbn: '9781491960202', description: 'A beginner-friendly guide to HTML, CSS, JavaScript and web graphics.', total: 3 },
    { id: 'b35', title: 'HTML and CSS: Design and Build Websites', author: 'Jon Duckett', category: 'Web Development', isbn: '9781118008188', description: 'A visual introduction to building and styling web pages.', total: 3 },
    { id: 'b36', title: 'JavaScript and jQuery', author: 'Jon Duckett', category: 'Web Development', isbn: '9781118531648', description: 'Practical lessons for adding interactivity to websites.', total: 2 },
    { id: 'b37', title: 'Eloquent JavaScript', author: 'Marijn Haverbeke', category: 'Web Development', isbn: '9781593279509', description: 'A modern introduction to JavaScript, programming and the web.', total: 3 },
    { id: 'b38', title: 'Web Development and Design Foundations with HTML5', author: 'Terry Felke-Morris', category: 'Web Development', isbn: '9780135225486', description: 'A project-based introduction to accessible, standards-based web design.', total: 2 },
    { id: 'b39', title: 'PHP and MySQL Web Development', author: 'Luke Welling, Laura Thomson', category: 'Web Development', isbn: '9780321833891', description: 'A practical guide to building dynamic websites with PHP and MySQL.', total: 2 },
    { id: 'b40', title: 'RESTful Web APIs', author: 'Leonard Richardson, Mike Amundsen, Sam Ruby', category: 'Web Development', isbn: '9781449358068', description: 'Designing and building web APIs around REST principles.', total: 2 },
    { id: 'b41', title: 'Node.js Design Patterns', author: 'Mario Casciaro, Luciano Mammino', category: 'Web Development', isbn: '9781839214110', description: 'Patterns and techniques for building scalable Node.js applications.', total: 2 }
  ];
  const users = [
    { name: 'Library Admin', email: 'admin@library.com', password: 'admin123', role: 'admin', joined: t },
    { name: 'Demo Student', email: 'student@library.com', password: 'student123', role: 'student', joined: t }
  ];
  const materials = [
    { id: 'm1', title: 'Data Structures Lecture Notes', subject: 'Computer Science', year: 2, semester: 3, url: 'https://nptel.ac.in/' },
    { id: 'm2', title: 'Database Management Systems', subject: 'Computer Science', year: 2, semester: 4, url: 'https://ocw.mit.edu/' },
    { id: 'm3', title: 'Engineering Mathematics II', subject: 'Mathematics', year: 1, semester: 2, url: 'https://nptel.ac.in/' },
    { id: 'm4', title: 'Operating Systems Slides', subject: 'Computer Science', year: 2, semester: 4, url: 'https://ocw.mit.edu/' },
    { id: 'm5', title: 'Digital Electronics Basics', subject: 'Electronics', year: 2, semester: 3, url: 'https://nptel.ac.in/' },
    { id: 'm6', title: 'Numerical Methods Handbook', subject: 'Mathematics', year: 2, semester: 3, url: 'https://nptel.ac.in/' },
    { id: 'm7', title: 'Engineering Physics Notes', subject: 'Physics', year: 1, semester: 1, url: 'https://ocw.mit.edu/' },
    { id: 'm8', title: 'Machine Learning Basics', subject: 'Computer Science', year: 3, semester: 5, url: 'https://ocw.mit.edu/' },
    { id: 'm9', title: 'Algorithms and Data Structures', subject: 'Computer Science', year: 2, semester: 3, url: 'https://ocw.mit.edu/' },
    { id: 'm10', title: 'Calculus and Linear Algebra', subject: 'Mathematics', year: 1, semester: 1, url: 'https://nptel.ac.in/' },
    { id: 'm11', title: 'Probability and Statistics', subject: 'Mathematics', year: 2, semester: 3, url: 'https://ocw.mit.edu/' },
    { id: 'm12', title: 'Differential Equations', subject: 'Mathematics', year: 1, semester: 2, url: 'https://nptel.ac.in/' },
    { id: 'm13', title: 'Analog Electronics and Circuits', subject: 'Electronics', year: 2, semester: 3, url: 'https://nptel.ac.in/' },
    { id: 'm14', title: 'Digital Logic Design', subject: 'Electronics', year: 2, semester: 4, url: 'https://ocw.mit.edu/' },
    { id: 'm15', title: 'Semiconductor Devices', subject: 'Electronics', year: 3, semester: 5, url: 'https://nptel.ac.in/' },
    { id: 'm16', title: 'Signals and Systems', subject: 'Electronics', year: 2, semester: 4, url: 'https://ocw.mit.edu/' },
    { id: 'm17', title: 'Classical Mechanics', subject: 'Physics', year: 1, semester: 1, url: 'https://ocw.mit.edu/' },
    { id: 'm18', title: 'Electricity and Magnetism', subject: 'Physics', year: 2, semester: 3, url: 'https://nptel.ac.in/' },
    { id: 'm19', title: 'Waves and Optics', subject: 'Physics', year: 2, semester: 4, url: 'https://ocw.mit.edu/' },
    { id: 'm20', title: 'Thermodynamics', subject: 'Physics', year: 2, semester: 3, url: 'https://nptel.ac.in/' }
  ];
  const semesterTopics = {
    1: [
      ['Programming Fundamentals', 'Computer Science'], ['Calculus I', 'Mathematics'], ['Mechanics and Motion', 'Physics'],
      ['Introduction to Circuits', 'Electronics'], ['Cell Biology', 'Biology'], ['Problem Solving with C', 'Computer Science'],
      ['Differential Calculus', 'Mathematics'], ['Waves and Oscillations', 'Physics']
    ],
    2: [
      ['Object-Oriented Programming', 'Computer Science'], ['Integral Calculus', 'Mathematics'], ['Electricity and Magnetism I', 'Physics'],
      ['Electronic Components', 'Electronics'], ['Genetics Fundamentals', 'Biology'], ['Computer Organization', 'Computer Science'],
      ['Linear Algebra', 'Mathematics'], ['Geometrical Optics', 'Physics']
    ],
    3: [
      ['Database Design and SQL', 'Computer Science'], ['Discrete Mathematics', 'Mathematics'], ['Modern Physics', 'Physics'],
      ['Digital Logic', 'Electronics'], ['Molecular Biology', 'Biology'], ['Data Structures Practice', 'Computer Science'],
      ['Probability and Statistics', 'Mathematics'], ['Semiconductor Fundamentals', 'Electronics']
    ],
    4: [
      ['Operating Systems', 'Computer Science'], ['Numerical Analysis', 'Mathematics'], ['Electromagnetic Waves', 'Physics'],
      ['Analog Circuit Design', 'Electronics'], ['Ecology and Ecosystems', 'Biology'], ['Computer Networks', 'Computer Science'],
      ['Differential Equations', 'Mathematics'], ['Optical Instruments', 'Physics']
    ],
    5: [
      ['Software Engineering', 'Computer Science'], ['Complex Variables', 'Mathematics'], ['Quantum Physics', 'Physics'],
      ['Microprocessors', 'Electronics'], ['Evolution and Biodiversity', 'Biology'], ['Machine Learning', 'Computer Science'],
      ['Engineering Statistics', 'Mathematics'], ['Control Systems', 'Electronics']
    ],
    6: [
      ['Artificial Intelligence', 'Computer Science'], ['Optimization Methods', 'Mathematics'], ['Nuclear Physics', 'Physics'],
      ['Communication Systems', 'Electronics'], ['Biotechnology', 'Biology'], ['Compiler Design', 'Computer Science'],
      ['Graph Theory', 'Mathematics'], ['Power Electronics', 'Electronics']
    ],
    7: [
      ['Distributed Systems', 'Computer Science'], ['Numerical Linear Algebra', 'Mathematics'], ['Solid State Physics', 'Physics'],
      ['Embedded Systems', 'Electronics'], ['Immunology', 'Biology'], ['Information Security', 'Computer Science'],
      ['Mathematical Modeling', 'Mathematics'], ['VLSI Design', 'Electronics']
    ],
    8: [
      ['Cloud Computing', 'Computer Science'], ['Operations Research', 'Mathematics'], ['Astrophysics', 'Physics'],
      ['Digital Signal Processing', 'Electronics'], ['Bioinformatics', 'Biology'], ['Project on Data Science', 'Computer Science'],
      ['Applied Statistics', 'Mathematics'], ['Renewable Energy Systems', 'Electronics']
    ]
  };
  for (let year = 1; year <= 4; year++) {
    for (let semester = 1; semester <= 8; semester++) {
      const currentCount = materials.filter(material => material.year === year && material.semester === semester).length;
      semesterTopics[semester].slice(0, Math.max(0, 6 - currentCount)).forEach(([title, subject], index) => {
        const slot = currentCount + index + 1;
        materials.push({
          id: 'm-y' + year + 's' + semester + '-' + slot,
          title: title + ' — Year ' + year + ', Semester ' + semester + ' Study Guide',
          subject, year, semester, url: index % 2 ? 'https://ocw.mit.edu/' : 'https://nptel.ac.in/'
        });
      });
    }
  }
  // One overdue active loan and one late-returned loan so fines are visible in the demo
  const records = [
    { id: 'r1', bookId: 'b4', bookTitle: 'Operating System Concepts', userEmail: 'student@library.com', issueDate: addDays(t, -20), dueDate: addDays(t, -6), returnDate: null, fineRate: null, fineAmount: null, finePaid: false },
    { id: 'r2', bookId: 'b6', bookTitle: 'Numerical Methods for Engineers', userEmail: 'student@library.com', issueDate: addDays(t, -30), dueDate: addDays(t, -16), returnDate: addDays(t, -10), fineRate: 5, fineAmount: 30, finePaid: false }
  ];
  return { books, users, materials, records, messages: [], settings: { fineRate: 5 } };
}

let db = {};
function loadDB() {
  let seeded = true;
  try { seeded = localStorage.getItem(KEYS.books) === null; } catch (e) { seeded = true; }
  const seed = seeded ? seedData() : null;
  db.books = load(KEYS.books, seed ? seed.books : []);
  db.users = load(KEYS.users, seed ? seed.users : []);
  db.materials = load(KEYS.materials, seed ? seed.materials : []);
  db.records = load(KEYS.records, seed ? seed.records : []);
  db.messages = load(KEYS.messages, []);
  db.settings = load(KEYS.settings, { fineRate: 5 });
  // Add expanded sample books and study materials once to existing demo data.
  let catalogVersion = 0;
  try { catalogVersion = Number(localStorage.getItem(KEYS.catalogVersion) || 0); } catch (e) { /* ignore */ }
  if (catalogVersion < 7) {
    const seeded = seedData();
    const seededBooks = seeded.books;
    const existingBookIds = new Set(db.books.map(book => book.id));
    const additions = seededBooks.filter(book => Number(book.id.slice(1)) >= 19 && !existingBookIds.has(book.id));
    if (additions.length) {
      db.books.push(...additions);
      save(KEYS.books, db.books);
    }
    const existingMaterials = new Set(db.materials.map(material => material.id));
    const newMaterials = seeded.materials.filter(material =>
      (Number(material.id.slice(1)) >= 9 || material.id.startsWith('m-y')) && !existingMaterials.has(material.id));
    if (newMaterials.length) {
      db.materials.push(...newMaterials);
      save(KEYS.materials, db.materials);
    }
    try { localStorage.setItem(KEYS.catalogVersion, '7'); } catch (e) { /* ignore */ }
  }
  if (seeded) saveAll();
}
function saveAll() {
  save(KEYS.books, db.books); save(KEYS.users, db.users); save(KEYS.materials, db.materials);
  save(KEYS.records, db.records); save(KEYS.messages, db.messages); save(KEYS.settings, db.settings);
}

/* ---------- 3. Session ---------- */
function currentUser() {
  const email = load(KEYS.session, null);
  return email ? db.users.find(u => u.email === email) || null : null;
}
function isAdmin() { const u = currentUser(); return !!u && u.role === 'admin'; }

/* ---------- 4. Toasts & validation helpers ---------- */
function toast(message, type = 'info') {
  const box = $('#toastBox');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}
// Mark an input invalid, show an error toast and return false
function fail(input, message) {
  if (input) { input.classList.add('invalid'); input.focus(); }
  toast(message, 'error');
  return false;
}
document.addEventListener('input', e => e.target.classList && e.target.classList.remove('invalid'));

/* ---------- 5. Business logic: availability, loans, fines ---------- */
function activeLoansOf(bookId) { return db.records.filter(r => r.bookId === bookId && !r.returnDate).length; }
function availableOf(book) { return Math.max(0, book.total - activeLoansOf(book.id)); }

function overdueDays(rec) {
  const end = rec.returnDate || todayISO();
  return Math.max(0, daysBetween(rec.dueDate, end));
}
// Fine: fixed at return time for returned books, live for books still issued
function fineFor(rec) {
  if (rec.returnDate && rec.fineAmount != null) return rec.fineAmount;
  return overdueDays(rec) * db.settings.fineRate;
}
function fineRateFor(rec) { return rec.returnDate && rec.fineRate != null ? rec.fineRate : db.settings.fineRate; }
function fineExplain(rec) {
  const days = overdueDays(rec);
  if (days === 0) return rec.returnDate ? 'Returned on time – no fine' : 'Not overdue – no fine';
  return days + ' day(s) overdue × ' + money(fineRateFor(rec)) + '/day = ' + money(fineFor(rec));
}
function statusOf(rec) {
  if (rec.returnDate) return { label: 'Returned', cls: 'info' };
  if (overdueDays(rec) > 0) return { label: 'Overdue', cls: 'bad' };
  return { label: 'Issued', cls: 'warn' };
}
function unpaidFine(rec) { return rec.finePaid ? 0 : fineFor(rec); }

// Create a loan. Used by both the student "Borrow" button and the admin "Issue" form.
function createIssue(bookId, email) {
  const book = db.books.find(b => b.id === bookId);
  if (!book) return { ok: false, msg: 'Book not found.' };
  const student = db.users.find(u => u.email === email && u.role === 'student');
  if (!student) return { ok: false, msg: 'No registered student with that email.' };
  if (availableOf(book) <= 0) return { ok: false, msg: '"' + book.title + '" has no available copies.' };
  if (db.records.some(r => r.bookId === bookId && r.userEmail === email && !r.returnDate)) {
    return { ok: false, msg: 'This student already has an active copy of that title.' };
  }
  const issue = todayISO();
  db.records.push({
    id: uid('r'), bookId, bookTitle: book.title, userEmail: email,
    issueDate: issue, dueDate: addDays(issue, LOAN_DAYS), returnDate: null,
    fineRate: null, fineAmount: null, finePaid: false
  });
  save(KEYS.records, db.records);
  return { ok: true, msg: 'Issued "' + book.title + '". Due on ' + fmtDate(addDays(issue, LOAN_DAYS)) + '.' };
}

// Mark a loan as returned and freeze the fine
function returnBook(recordId) {
  const rec = db.records.find(r => r.id === recordId);
  if (!rec || rec.returnDate) return { ok: false, msg: 'Record not found or already returned.' };
  rec.returnDate = todayISO();
  rec.fineRate = db.settings.fineRate;
  rec.fineAmount = overdueDays(rec) * rec.fineRate;
  save(KEYS.records, db.records);
  return { ok: true, msg: 'Book returned.' + (rec.fineAmount > 0 ? ' Fine recorded: ' + money(rec.fineAmount) + '.' : '') };
}

/* ---------- 6. Navigation ---------- */
// Copy each column heading onto its cells so phones can show stacked "cards"
function labelTables() {
  $$('table').forEach(t => {
    const heads = $$('thead th', t).map(h => h.textContent);
    $$('tbody tr', t).forEach(tr => $$('td', tr).forEach((td, i) => {
      if (!td.classList.contains('empty')) td.setAttribute('data-label', heads[i] || '');
    }));
  });
}

// Light / dark theme (saved in this browser only)
function applyTheme(mode) {
  if (mode === 'light' || mode === 'dark') document.documentElement.setAttribute('data-theme', mode);
}
function toggleTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  const isDark = attr ? attr === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  const next = isDark ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem('lib_theme', next); } catch (e) { /* ignore */ }
}

let currentPage = 'home';

function navigate(page) {
  const user = currentUser();
  if ((page === 'history' || page === 'profile') && !user) {
    toast('Please log in to continue.', 'error'); page = 'auth';
  }
  if (page === 'history' && user && user.role === 'admin') page = 'admin';
  if (page === 'admin' && !isAdmin()) {
    toast('Admin access only.', 'error'); page = user ? 'home' : 'auth';
  }
  currentPage = page;
  $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
  $$('.main-nav a').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  $('#mainNav').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderPage(page);
}

function renderPage(page) {
  switch (page) {
    case 'home': renderHome(); break;
    case 'catalog': renderCatalog(); break;
    case 'materials': renderMaterials(); break;
    case 'history': renderHistory(); break;
    case 'profile': renderProfile(); break;
    case 'admin': renderAdmin(); break;
    case 'contact': prefillContact(); break;
  }
}

// Show/hide nav items depending on login state and role
function updateNav() {
  const u = currentUser();
  $('#navLogin').hidden = !!u;
  $('#logoutBtn').hidden = !u;
  $('#navProfile').hidden = !u;
  $('#navHistory').hidden = !u || u.role === 'admin';
  $('#navAdmin').hidden = !(u && u.role === 'admin');
  $('#navUserName').textContent = u ? u.name.split(' ')[0] : '';
}

/* ---------- 7. Home ---------- */
function statCard(num, label, extra) {
  return '<div class="stat ' + (extra || '') + '"><div class="num">' + esc(num) + '</div><div class="lbl">' + esc(label) + '</div></div>';
}
function renderHome() {
  const copies = db.books.reduce((s, b) => s + b.total, 0);
  const available = db.books.reduce((s, b) => s + availableOf(b), 0);
  $('#homeStats').innerHTML =
    statCard(db.books.length, 'Book titles') + statCard(available + ' / ' + copies, 'Copies available') +
    statCard(db.materials.length, 'Study materials') + statCard(db.users.filter(u => u.role === 'student').length, 'Students');
}

/* ---------- 8. Book catalog ---------- */
// Pick a colour pair for a cover, always the same for the same text
const COVER_COLORS = [['#5b4bd0', '#8b7cf6'], ['#1f3366', '#4a63c8'], ['#0f766e', '#2fb59e'], ['#b4455f', '#e07a8f'], ['#9a5b13', '#d9983a'], ['#4338ca', '#7c8cf8']];
function coverStyle(text) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) % 997;
  const c = COVER_COLORS[h % COVER_COLORS.length];
  return '--c1:' + c[0] + ';--c2:' + c[1];
}
function categories() { return Array.from(new Set(db.books.map(b => b.category))).sort(); }

function renderCatalog() {
  const sel = $('#bookCategory');
  const keep = sel.value;
  sel.innerHTML = '<option value="">All categories</option>' +
    categories().map(c => '<option value="' + esc(c) + '">' + esc(c) + '</option>').join('');
  sel.value = categories().includes(keep) ? keep : '';

  const q = $('#bookSearch').value.trim().toLowerCase();
  const cat = sel.value;
  const list = db.books.filter(b => {
    const hay = (b.title + ' ' + b.author + ' ' + b.category + ' ' + b.isbn).toLowerCase();
    return (!q || hay.includes(q)) && (!cat || b.category === cat);
  });

  const user = currentUser();
  const grid = $('#bookGrid');
  if (!list.length) { grid.innerHTML = '<div class="card empty-card">No books match your search. Try a different word or category.</div>'; return; }
  grid.innerHTML = list.map((b, i) => {
    const avail = availableOf(b);
    const has = user && db.records.some(r => r.bookId === b.id && r.userEmail === user.email && !r.returnDate);
    let btn;
    if (user && user.role === 'admin') btn = '';
    else if (has) btn = '<button class="btn btn-secondary btn-sm" disabled>Already borrowed</button>';
    else btn = '<button class="btn btn-primary btn-sm" data-action="borrow" data-id="' + esc(b.id) + '"' + (avail ? '' : ' disabled') + '>Borrow</button>';
    return '<article class="card book-card" style="--i:' + Math.min(i, 12) + '">' +
      '<div class="cover" style="' + coverStyle(b.category) + '"><span class="cover-letter">' + esc(b.title.charAt(0).toUpperCase()) + '</span><span class="cover-cat">' + esc(b.category) + '</span></div>' +
      '<div class="card-body">' +
      '<h3>' + esc(b.title) + '</h3>' +
      '<div class="meta">by ' + esc(b.author) + '<br>ISBN: ' + esc(b.isbn) + '</div>' +
      '<p class="desc">' + esc(b.description) + '</p>' +
      '<div class="foot"><span class="badge ' + (avail ? 'ok' : 'bad') + '">' +
      (avail ? 'Available (' + avail + '/' + b.total + ')' : 'Unavailable') + '</span>' + btn + '</div></div></article>';
  }).join('');
}

function borrowBook(bookId) {
  const user = currentUser();
  if (!user) { toast('Please log in to borrow books.', 'error'); navigate('auth'); return; }
  if (user.role !== 'student') { toast('Admins issue books from the Admin Dashboard.', 'info'); return; }
  const res = createIssue(bookId, user.email);
  toast(res.msg, res.ok ? 'success' : 'error');
  renderCatalog();
}

/* ---------- 9. Study materials ---------- */
function renderMaterials() {
  const q = $('#matSearch').value.trim().toLowerCase();
  const y = $('#matYear').value, s = $('#matSem').value;
  const list = db.materials.filter(m =>
    (!q || (m.title + ' ' + m.subject).toLowerCase().includes(q)) &&
    (!y || String(m.year) === y) && (!s || String(m.semester) === s));
  const grid = $('#materialGrid');
  if (!list.length) { grid.innerHTML = '<div class="card empty-card">No study materials found. Try clearing the filters.</div>'; return; }
  grid.innerHTML = list.map((m, i) =>
    '<article class="card book-card" style="--i:' + Math.min(i, 12) + '">' +
    '<div class="cover sm" style="' + coverStyle(m.subject) + '"><span class="cover-letter">' + esc(m.subject.charAt(0).toUpperCase()) + '</span><span class="cover-cat">Year ' + esc(m.year) + ' · Sem ' + esc(m.semester) + '</span></div>' +
    '<div class="card-body">' +
    '<span class="tag">' + esc(m.subject) + '</span>' +
    '<h3>' + esc(m.title) + '</h3>' +
    '<div class="foot"><span class="meta">Year ' + esc(m.year) + ' • Semester ' + esc(m.semester) + '</span>' +
    (isUrl(m.url) ? '<a class="btn btn-primary btn-sm" href="' + esc(m.url) + '" target="_blank" rel="noopener noreferrer">Open / Download</a>' : '<span class="badge bad">Invalid link</span>') +
    '</div></div></article>').join('');
}

/* ---------- 10. Student: history & profile ---------- */
function renderHistory() {
  const user = currentUser(); if (!user) return;
  const recs = db.records.filter(r => r.userEmail === user.email).slice().reverse();
  const active = recs.filter(r => !r.returnDate).length;
  const outstanding = recs.reduce((s, r) => s + unpaidFine(r), 0);
  $('#historyStats').innerHTML = statCard(recs.length, 'Total borrowed') + statCard(active, 'Currently issued') +
    statCard(money(outstanding), 'Outstanding fines', outstanding > 0 ? 'warn' : '');
  $('#historyBody').innerHTML = recs.length ? recs.map(r => {
    const st = statusOf(r), fine = fineFor(r);
    return '<tr><td>' + esc(r.bookTitle) + '</td><td>' + fmtDate(r.issueDate) + '</td><td>' + fmtDate(r.dueDate) + '</td>' +
      '<td>' + fmtDate(r.returnDate) + '</td><td><span class="badge ' + st.cls + '">' + st.label + '</span></td>' +
      '<td>' + (fine > 0 ? '<strong>' + money(fine) + '</strong>' + (r.finePaid ? ' <span class="badge ok">Paid</span>' : '') : '₹0') +
      '<br><small>' + esc(fineExplain(r)) + '</small></td></tr>';
  }).join('') : '<tr><td colspan="6" class="empty">You have not borrowed any books yet.</td></tr>';
  $('#fineRuleNote').innerHTML = '<strong>How fines work:</strong> books are due ' + LOAN_DAYS + ' days after issue. ' +
    'Each day late costs ' + money(db.settings.fineRate) + '. Books still issued show a live fine; returned books show the final fine.';
  labelTables();
}

function renderProfile() {
  const u = currentUser(); if (!u) return;
  $('#profName').value = u.name;
  $('#profEmail').value = u.email;
  $('#profRole').value = u.role === 'admin' ? 'Librarian / Admin' : 'Student';
  $('#profileAvatar').textContent = u.name.charAt(0).toUpperCase();
}

/* ---------- 11. Admin dashboard ---------- */
function renderAdmin() {
  if (!isAdmin()) return;
  renderAdminOverview(); renderAdminBooks(); renderAdminIssue();
  renderAdminFines(); renderAdminMaterials(); renderAdminUsers(); renderAdminMessages();
  labelTables();
}

function renderAdminOverview() {
  const copies = db.books.reduce((s, b) => s + b.total, 0);
  const issued = db.records.filter(r => !r.returnDate).length;
  const outstanding = db.records.reduce((s, r) => s + unpaidFine(r), 0);
  $('#adminStats').innerHTML =
    statCard(copies, 'Total book copies') + statCard(Math.max(0, copies - issued), 'Available copies') +
    statCard(issued, 'Currently issued') + statCard(db.users.length, 'Registered users') +
    statCard(db.materials.length, 'Study materials') + statCard(money(outstanding), 'Outstanding fines', outstanding > 0 ? 'warn' : '');
  const recent = db.records.slice().reverse().slice(0, 8);
  $('#recentActivity').innerHTML = recent.length ? recent.map(r => {
    const u = db.users.find(x => x.email === r.userEmail);
    const who = esc(u ? u.name : r.userEmail);
    return '<li>' + (r.returnDate
      ? '<span class="act-dot back"></span><span><strong>' + who + '</strong> returned “' + esc(r.bookTitle) + '” on ' + fmtDate(r.returnDate) + '</span>'
      : '<span class="act-dot out"></span><span><strong>' + who + '</strong> borrowed “' + esc(r.bookTitle) + '” on ' + fmtDate(r.issueDate) + '</span>') + '</li>';
  }).join('') : '<li class="muted">No borrowing activity yet.</li>';
}

function renderAdminBooks() {
  $('#adminBooksBody').innerHTML = db.books.length ? db.books.map(b => {
    const issued = activeLoansOf(b.id);
    return '<tr><td><strong>' + esc(b.title) + '</strong><br><small>' + esc(b.author) + '</small></td>' +
      '<td>' + esc(b.category) + '</td><td>' + esc(b.isbn) + '</td><td>' + b.total + '</td><td>' + issued + '</td>' +
      '<td>' + Math.max(0, b.total - issued) + '</td>' +
      '<td><button class="btn btn-secondary btn-sm" data-action="edit-book" data-id="' + esc(b.id) + '">Edit</button>' +
      '<button class="btn btn-danger btn-sm" data-action="delete-book" data-id="' + esc(b.id) + '">Delete</button></td></tr>';
  }).join('') : '<tr><td colspan="7" class="empty">No books in the inventory.</td></tr>';
  $('#categoryList').innerHTML = categories().map(c => '<option value="' + esc(c) + '"></option>').join('');
}

function renderAdminIssue() {
  const avail = db.books.filter(b => availableOf(b) > 0);
  const sel = $('#issueBook');
  sel.innerHTML = avail.length
    ? avail.map(b => '<option value="' + esc(b.id) + '">' + esc(b.title) + ' (' + availableOf(b) + ' available)</option>').join('')
    : '<option value="">No books available</option>';
  const recs = db.records.slice().reverse();
  $('#adminRecordsBody').innerHTML = recs.length ? recs.map(r => {
    const u = db.users.find(x => x.email === r.userEmail), st = statusOf(r);
    return '<tr><td>' + esc(u ? u.name : r.userEmail) + '<br><small>' + esc(r.userEmail) + '</small></td>' +
      '<td>' + esc(r.bookTitle) + '</td><td>' + fmtDate(r.issueDate) + '</td><td>' + fmtDate(r.dueDate) + '</td>' +
      '<td>' + fmtDate(r.returnDate) + '</td><td><span class="badge ' + st.cls + '">' + st.label + '</span></td>' +
      '<td>' + (r.returnDate ? '—' : '<button class="btn btn-primary btn-sm" data-action="return" data-id="' + esc(r.id) + '">Mark Returned</button>') + '</td></tr>';
  }).join('') : '<tr><td colspan="7" class="empty">No borrowing records yet.</td></tr>';
}

function renderAdminFines() {
  $('#fineRate').value = db.settings.fineRate;
  const total = db.records.reduce((s, r) => s + fineFor(r), 0);
  const outstanding = db.records.reduce((s, r) => s + unpaidFine(r), 0);
  $('#fineStats').innerHTML = statCard(money(total), 'Total fines recorded') +
    statCard(money(total - outstanding), 'Fines paid') + statCard(money(outstanding), 'Outstanding', outstanding > 0 ? 'warn' : '');
  const recs = db.records.slice().reverse();
  $('#adminFinesBody').innerHTML = recs.length ? recs.map(r => {
    const u = db.users.find(x => x.email === r.userEmail), st = statusOf(r), fine = fineFor(r);
    let pay = '—';
    if (fine > 0) pay = r.finePaid ? '<span class="badge ok">Paid</span>'
      : (r.returnDate ? '<button class="btn btn-secondary btn-sm" data-action="pay" data-id="' + esc(r.id) + '">Mark Paid</button>' : '<small>Payable after return</small>');
    return '<tr><td>' + esc(u ? u.name : r.userEmail) + '</td><td>' + esc(r.bookTitle) + '</td>' +
      '<td><span class="badge ' + st.cls + '">' + st.label + '</span></td><td><small>' + esc(fineExplain(r)) + '</small></td>' +
      '<td><strong>' + money(fine) + '</strong></td><td>' + pay + '</td></tr>';
  }).join('') : '<tr><td colspan="6" class="empty">No records.</td></tr>';
}

function renderAdminMaterials() {
  $('#adminMaterialsBody').innerHTML = db.materials.length ? db.materials.map(m =>
    '<tr><td>' + esc(m.title) + '</td><td>' + esc(m.subject) + '</td><td>' + esc(m.year) + '</td><td>' + esc(m.semester) + '</td>' +
    '<td><small>' + esc(m.url) + '</small></td>' +
    '<td><button class="btn btn-secondary btn-sm" data-action="edit-material" data-id="' + esc(m.id) + '">Edit</button>' +
    '<button class="btn btn-danger btn-sm" data-action="delete-material" data-id="' + esc(m.id) + '">Delete</button></td></tr>'
  ).join('') : '<tr><td colspan="6" class="empty">No study materials.</td></tr>';
}

function renderAdminUsers() {
  $('#adminUsersBody').innerHTML = db.users.map(u =>
    '<tr><td>' + esc(u.name) + '</td><td>' + esc(u.email) + '</td>' +
    '<td><span class="badge ' + (u.role === 'admin' ? 'info' : 'ok') + '">' + esc(u.role) + '</span></td>' +
    '<td>' + db.records.filter(r => r.userEmail === u.email && !r.returnDate).length + '</td></tr>').join('');
}

function renderAdminMessages() {
  const box = $('#adminMessages');
  box.innerHTML = db.messages.length ? db.messages.slice().reverse().map(m =>
    '<div class="card msg"><div class="msg-head"><strong>' + esc(m.subject) + '</strong><small class="muted">' + esc(new Date(m.date).toLocaleString('en-IN')) + '</small></div>' +
    '<div class="muted small">' + esc(m.name) + ' &lt;' + esc(m.email) + '&gt;</div><p>' + esc(m.message) + '</p>' +
    '<button class="btn btn-danger btn-sm" data-action="delete-message" data-id="' + esc(m.id) + '">Delete</button></div>'
  ).join('') : '<div class="card pad muted">No messages yet.</div>';
}

/* ---------- 12. Modals ---------- */
// In-page confirmation (window.confirm is unavailable in some viewers)
let confirmAction = null;
function askConfirm(message, onYes) {
  $('#confirmText').textContent = message;
  confirmAction = onYes;
  openModal('confirmModal');
}

function openModal(id) { $('#' + id).hidden = false; }
function closeModal(id) { $('#' + id).hidden = true; }

function openBookModal(id) {
  const b = id ? db.books.find(x => x.id === id) : null;
  $('#bookModalTitle').textContent = b ? 'Edit Book' : 'Add Book';
  $('#bookId').value = b ? b.id : '';
  $('#bTitle').value = b ? b.title : '';
  $('#bAuthor').value = b ? b.author : '';
  $('#bCategory').value = b ? b.category : '';
  $('#bIsbn').value = b ? b.isbn : '';
  $('#bDesc').value = b ? b.description : '';
  $('#bTotal').value = b ? b.total : 1;
  $$('#bookForm .invalid').forEach(i => i.classList.remove('invalid'));
  openModal('bookModal');
}

function openMaterialModal(id) {
  const m = id ? db.materials.find(x => x.id === id) : null;
  $('#materialModalTitle').textContent = m ? 'Edit Study Material' : 'Add Study Material';
  $('#mId').value = m ? m.id : '';
  $('#mTitle').value = m ? m.title : '';
  $('#mSubject').value = m ? m.subject : '';
  $('#mYear').value = m ? m.year : '1';
  $('#mSem').value = m ? m.semester : '1';
  $('#mUrl').value = m ? m.url : '';
  $$('#materialForm .invalid').forEach(i => i.classList.remove('invalid'));
  openModal('materialModal');
}

/* ---------- 13. Form handlers ---------- */
function handleRegister(e) {
  e.preventDefault();
  const name = $('#regName').value.trim(), email = $('#regEmail').value.trim().toLowerCase(), pw = $('#regPassword').value;
  if (name.length < 2) return fail($('#regName'), 'Please enter your full name.');
  if (!isEmail(email)) return fail($('#regEmail'), 'Please enter a valid email address.');
  if (db.users.some(u => u.email === email)) return fail($('#regEmail'), 'That email is already registered.');
  if (pw.length < 6) return fail($('#regPassword'), 'Password must be at least 6 characters.');
  db.users.push({ name, email, password: pw, role: 'student', joined: todayISO() }); // demo only: plain-text password
  save(KEYS.users, db.users);
  save(KEYS.session, email);
  e.target.reset();
  toast('Welcome, ' + name + '! Account created.', 'success');
  updateNav(); navigate('catalog');
}

function handleLogin(e) {
  e.preventDefault();
  const email = $('#loginEmail').value.trim().toLowerCase(), pw = $('#loginPassword').value;
  if (!isEmail(email)) return fail($('#loginEmail'), 'Please enter a valid email address.');
  if (!pw) return fail($('#loginPassword'), 'Please enter your password.');
  const user = db.users.find(u => u.email === email && u.password === pw);
  if (!user) return fail($('#loginPassword'), 'Incorrect email or password.');
  save(KEYS.session, user.email);
  e.target.reset();
  toast('Logged in as ' + user.name + '.', 'success');
  updateNav(); navigate(user.role === 'admin' ? 'admin' : 'home');
}

function logout() {
  try { localStorage.removeItem(KEYS.session); } catch (e) { /* ignore */ }
  updateNav(); toast('You have been logged out.', 'info'); navigate('home');
}

function handleProfile(e) {
  e.preventDefault();
  const u = currentUser(); if (!u) return;
  const name = $('#profName').value.trim();
  if (name.length < 2) return fail($('#profName'), 'Name must be at least 2 characters.');
  u.name = name; save(KEYS.users, db.users);
  updateNav(); renderProfile(); toast('Name updated.', 'success');
}

function handleBookForm(e) {
  e.preventDefault();
  const id = $('#bookId').value;
  const existingBook = id ? db.books.find(x => x.id === id) : null;
  if (id && !existingBook) return fail($('#bTitle'), 'This book no longer exists. Refresh the inventory and try again.');
  const title = $('#bTitle').value.trim(), author = $('#bAuthor').value.trim(), category = $('#bCategory').value.trim();
  const isbn = $('#bIsbn').value.trim().replace(/[-\s]/g, '').toUpperCase(), desc = $('#bDesc').value.trim();
  const totalRaw = $('#bTotal').value, total = Number(totalRaw);
  if (!title) return fail($('#bTitle'), 'Title is required.');
  if (!author) return fail($('#bAuthor'), 'Author is required.');
  if (!category) return fail($('#bCategory'), 'Category is required.');
  if (!isValidIsbn(isbn) && (!existingBook || existingBook.isbn !== isbn)) return fail($('#bIsbn'), 'Enter a valid ISBN-10 or ISBN-13, including its check digit.');
  if (db.books.some(b => b.isbn === isbn && b.id !== id)) return fail($('#bIsbn'), 'Another book already uses this ISBN.');
  if (!desc) return fail($('#bDesc'), 'Description is required.');
  if (totalRaw === '' || !Number.isSafeInteger(total) || total < 1) return fail($('#bTotal'), 'Total copies must be a whole number of 1 or more.');
  if (id) {
    const b = existingBook;
    const issued = activeLoansOf(id);
    if (total < issued) return fail($('#bTotal'), 'Total copies cannot be lower than the ' + issued + ' copies currently issued.');
    Object.assign(b, { title, author, category, isbn, description: desc, total });
    toast('Book updated.', 'success');
  } else {
    db.books.push({ id: uid('b'), title, author, category, isbn, description: desc, total });
    toast('Book added.', 'success');
  }
  save(KEYS.books, db.books);
  closeModal('bookModal'); renderAdmin();
}

function deleteBook(id) {
  const b = db.books.find(x => x.id === id); if (!b) return;
  if (activeLoansOf(id) > 0) return toast('Cannot delete: this book has active borrowing records.', 'error');
  askConfirm('Delete "' + b.title + '"? Past borrowing history will keep the title.', () => {
    db.books = db.books.filter(x => x.id !== id);
    save(KEYS.books, db.books); renderAdmin(); toast('Book deleted.', 'success');
  });
}

function handleIssueForm(e) {
  e.preventDefault();
  const email = $('#issueEmail').value.trim().toLowerCase(), bookId = $('#issueBook').value;
  if (!isEmail(email)) return fail($('#issueEmail'), 'Enter a valid student email.');
  if (!bookId) return fail($('#issueBook'), 'No book selected.');
  const res = createIssue(bookId, email);
  toast(res.msg, res.ok ? 'success' : 'error');
  if (res.ok) { $('#issueEmail').value = ''; renderAdmin(); }
}

function handleRateForm(e) {
  e.preventDefault();
  const v = Number($('#fineRate').value);
  if ($('#fineRate').value === '' || !Number.isSafeInteger(v) || v < 0) return fail($('#fineRate'), 'Enter a whole-number fine rate of 0 or more.');
  db.settings.fineRate = v; save(KEYS.settings, db.settings);
  renderAdmin(); toast('Fine rate set to ' + money(v) + ' per day.', 'success');
}

function handleMaterialForm(e) {
  e.preventDefault();
  const id = $('#mId').value;
  const title = $('#mTitle').value.trim(), subject = $('#mSubject').value.trim(), url = $('#mUrl').value.trim();
  const year = Number($('#mYear').value), semester = Number($('#mSem').value);
  if (!title) return fail($('#mTitle'), 'Title is required.');
  if (!subject) return fail($('#mSubject'), 'Subject is required.');
  if (!Number.isInteger(year) || year < 1 || year > 4) return fail($('#mYear'), 'Select an academic year from 1 to 4.');
  if (!Number.isInteger(semester) || semester < 1 || semester > 8) return fail($('#mSem'), 'Select a semester from 1 to 8.');
  if (!isUrl(url)) return fail($('#mUrl'), 'Enter a valid URL starting with http:// or https://');
  if (id) {
    const material = db.materials.find(m => m.id === id);
    if (!material) return fail($('#mTitle'), 'This study material no longer exists. Refresh the inventory and try again.');
    Object.assign(material, { title, subject, year, semester, url });
    toast('Material updated.', 'success');
  } else {
    db.materials.push({ id: uid('m'), title, subject, year, semester, url });
    toast('Material added.', 'success');
  }
  save(KEYS.materials, db.materials);
  closeModal('materialModal'); renderAdmin();
}

function handleContact(e) {
  e.preventDefault();
  const name = $('#cName').value.trim(), email = $('#cEmail').value.trim(), subject = $('#cSubject').value.trim(), message = $('#cMessage').value.trim();
  if (name.length < 2) return fail($('#cName'), 'Please enter your name.');
  if (!isEmail(email)) return fail($('#cEmail'), 'Please enter a valid email address.');
  if (!subject) return fail($('#cSubject'), 'Subject is required.');
  if (message.length < 10) return fail($('#cMessage'), 'Message must be at least 10 characters.');
  db.messages.push({ id: uid('c'), name, email, subject, message, date: new Date().toISOString() });
  save(KEYS.messages, db.messages);
  e.target.reset();
  toast('Message saved locally (demo). No email was sent.', 'success');
}
function prefillContact() {
  const u = currentUser();
  if (u && !$('#cName').value) { $('#cName').value = u.name; $('#cEmail').value = u.email; }
}

/* ---------- 14. Event wiring ---------- */
document.addEventListener('click', e => {
  // Navigation links / buttons
  const nav = e.target.closest('[data-page]');
  if (nav) { e.preventDefault(); navigate(nav.dataset.page); return; }

  // Close modal buttons
  const close = e.target.closest('[data-close]');
  if (close) { closeModal(close.dataset.close); return; }
  if (e.target.classList.contains('modal')) { e.target.hidden = true; return; }

  // Auth tabs
  const authTab = e.target.closest('[data-auth]');
  if (authTab) {
    const isLogin = authTab.dataset.auth === 'login';
    $$('[data-auth]').forEach(t => t.classList.toggle('active', t === authTab));
    $('#loginForm').hidden = !isLogin; $('#registerForm').hidden = isLogin;
    return;
  }

  // Admin tabs
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    $$('#adminTabs .tab').forEach(t => t.classList.toggle('active', t === tab));
    $$('.tab-pane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab.dataset.tab));
    return;
  }

  // Row / card actions
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  switch (btn.dataset.action) {
    case 'borrow': borrowBook(id); break;
    case 'edit-book': if (isAdmin()) openBookModal(id); break;
    case 'delete-book': if (isAdmin()) deleteBook(id); break;
    case 'return': if (isAdmin()) { const r = returnBook(id); toast(r.msg, r.ok ? 'success' : 'error'); renderAdmin(); } break;
    case 'pay': if (isAdmin()) { const rec = db.records.find(x => x.id === id); if (rec) { rec.finePaid = true; save(KEYS.records, db.records); renderAdmin(); toast('Fine marked as paid.', 'success'); } } break;
    case 'edit-material': if (isAdmin()) openMaterialModal(id); break;
    case 'delete-material':
      if (isAdmin()) askConfirm('Delete this study material?', () => {
        db.materials = db.materials.filter(m => m.id !== id); save(KEYS.materials, db.materials); renderAdmin(); toast('Material deleted.', 'success');
      });
      break;
    case 'delete-message':
      if (isAdmin()) { db.messages = db.messages.filter(m => m.id !== id); save(KEYS.messages, db.messages); renderAdmin(); }
      break;
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') $$('.modal').forEach(m => (m.hidden = true));
});

function init() {
  try { applyTheme(localStorage.getItem('lib_theme')); } catch (e) { /* ignore */ }
  loadDB();
  $('#themeToggle').addEventListener('click', toggleTheme);
  $('#heroSearch').addEventListener('submit', e => {
    e.preventDefault();
    $('#bookSearch').value = $('#heroQuery').value.trim();
    navigate('catalog');
  });
  $('#loginForm').addEventListener('submit', handleLogin);
  $('#registerForm').addEventListener('submit', handleRegister);
  $('#logoutBtn').addEventListener('click', logout);
  $('#profileForm').addEventListener('submit', handleProfile);
  $('#bookForm').addEventListener('submit', handleBookForm);
  $('#issueForm').addEventListener('submit', handleIssueForm);
  $('#rateForm').addEventListener('submit', handleRateForm);
  $('#materialForm').addEventListener('submit', handleMaterialForm);
  $('#contactForm').addEventListener('submit', handleContact);
  $('#addBookBtn').addEventListener('click', () => openBookModal(null));
  $('#addMaterialBtn').addEventListener('click', () => openMaterialModal(null));
  $('#menuToggle').addEventListener('click', () => $('#mainNav').classList.toggle('open'));
  $('#resetDataBtn').addEventListener('click', () => {
    askConfirm('Reset all demo data? Your changes will be lost.', () => {
      Object.values(KEYS).forEach(k => { try { if (k !== KEYS.session) localStorage.removeItem(k); } catch (e) { /* ignore */ } });
      loadDB(); updateNav(); navigate('admin'); toast('Demo data restored.', 'success');
    });
  });
  $('#confirmYes').addEventListener('click', () => { const fn = confirmAction; confirmAction = null; closeModal('confirmModal'); if (fn) fn(); });
  ['#bookSearch', '#bookCategory'].forEach(s => $(s).addEventListener('input', renderCatalog));
  ['#matSearch', '#matYear', '#matSem'].forEach(s => $(s).addEventListener('input', renderMaterials));
  updateNav();
  navigate('home');
}
document.addEventListener('DOMContentLoaded', init);
