const XLSX = require('xlsx');
const path = require('path');

// Create workbook
const wb = XLSX.utils.book_new();

// --- Sheet 1: Domande ---
const headers = ['tipo', 'domanda', 'opzione1', 'opzione2', 'opzione3', 'opzione4', 'risposta_corretta', 'punti'];

const rows = [
  headers,
  ['scelta_multipla', '¿Cómo se dice "casa" en español?', 'House', 'Home', 'Casa', 'Hogar', 'Casa', 1],
  ['vero_falso', '"Hola" significa "Ciao"', 'Vero', 'Falso', '', '', 'Vero', 1],
  ['riempi', 'Yo ___ estudiante (essere)', '', '', '', '', 'soy', 1],
  ['aperta', 'Scrivi una frase usando il verbo "gustar"', '', '', '', '', '', 2],
  ['scelta_multipla', '¿Cuál es la capital de España?', 'Barcellona', 'Madrid', 'Siviglia', 'Valencia', 'Madrid', 1],
  ['vero_falso', '"Gracias" significa "Per favore"', 'Vero', 'Falso', '', '', 'Falso', 1],
  ['riempi', 'Nosotros ___ en Italia (vivere)', '', '', '', '', 'vivimos', 1],
];

const wsDomande = XLSX.utils.aoa_to_sheet(rows);

// Set column widths for readability
wsDomande['!cols'] = [
  { wch: 18 },  // tipo
  { wch: 45 },  // domanda
  { wch: 14 },  // opzione1
  { wch: 14 },  // opzione2
  { wch: 14 },  // opzione3
  { wch: 14 },  // opzione4
  { wch: 18 },  // risposta_corretta
  { wch: 8 },   // punti
];

// Bold headers - xlsx community edition supports cell styling via the 's' property
// but full styling requires xlsx-style or similar. We'll set the headers as-is.
// The headers are clearly distinguishable as the first row.

XLSX.utils.book_append_sheet(wb, wsDomande, 'Domande');

// --- Sheet 2: Istruzioni ---
const istruzioni = [
  ['Come compilare il template'],
  [''],
  ['Tipi di domanda disponibili:'],
  ['scelta_multipla - Domanda a scelta multipla (compila opzione1-4 e risposta_corretta)'],
  ['vero_falso - Domanda Vero o Falso (opzione1=Vero, opzione2=Falso, risposta_corretta=Vero o Falso)'],
  ['riempi - Riempi gli spazi (usa ___ nella domanda per indicare lo spazio vuoto, risposta_corretta = la parola corretta)'],
  ['aperta - Risposta aperta (lo studente scrive liberamente, la correzione è manuale)'],
  [''],
  ['Note:'],
  ['- La colonna \'punti\' è opzionale (default: 1 punto)'],
  ['- Per \'riempi\': se ci sono più risposte accettabili, separale con virgola (es: soy,estoy)'],
  ['- Non modificare i nomi delle colonne nella riga 1'],
];

const wsIstruzioni = XLSX.utils.aoa_to_sheet(istruzioni);

// Set column width for instructions
wsIstruzioni['!cols'] = [
  { wch: 90 },
];

XLSX.utils.book_append_sheet(wb, wsIstruzioni, 'Istruzioni');

// Write file
const outputPath = path.join(__dirname, 'template_verifica.xlsx');
XLSX.writeFile(wb, outputPath);

console.log('Template created successfully at:', outputPath);
