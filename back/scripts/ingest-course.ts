// Prépare un cours pour l'assistant : extrait le texte de chaque page d'un PDF et l'enregistre à côté du PDF.
//
// Usage :  npx tsx scripts/ingest-course.ts <fichier.pdf> <id> "<titre>" "<auteur>" [dossier]
// Exemple : npx tsx scripts/ingest-course.ts ~/Downloads/SGBDR_2023.pdf sgbdr "Bases de données relationnelles et SQL (S1)" "B. Kervella"
//
// Le dossier par défaut est ../data/cours (ignoré par git : un cours appartient à son auteur, il ne va pas dans le dépôt public).
// Résultat : <dossier>/<id>.pdf (copie) et <dossier>/<id>.json (titre, auteur, texte de chaque page).
import fs from 'node:fs';
import path from 'node:path';
import { extractText, getDocumentProxy } from 'unpdf';

const [file, id, title, author, dirArg] = process.argv.slice(2);
if (!file || !id || !title || !author) {
  console.error('Usage : npx tsx scripts/ingest-course.ts <fichier.pdf> <id> "<titre>" "<auteur>" [dossier]');
  process.exit(1);
}
if (!/^[a-z0-9-]+$/.test(id)) {
  console.error('L’identifiant ne doit contenir que des minuscules, chiffres et tirets.');
  process.exit(1);
}

const dir = path.resolve(dirArg ?? '../data/cours');
fs.mkdirSync(dir, { recursive: true });

const bytes = new Uint8Array(fs.readFileSync(file));
const pdf = await getDocumentProxy(bytes);
const { text } = await extractText(pdf, { mergePages: false });
const pages = (text as string[]).map((t) => t.replace(/\s+\n/g, '\n').trim());

fs.copyFileSync(file, path.join(dir, `${id}.pdf`));
fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({ id, title, author, pages }, null, 1), 'utf-8');

const empty = pages.map((t, i) => (t.length < 40 ? i + 1 : 0)).filter(Boolean);
console.log(`✔ ${pages.length} pages, ${pages.join('').length} caractères → ${dir}`);
if (empty.length) console.log(`  Pages presque sans texte (images ?) : ${empty.join(', ')}`);
