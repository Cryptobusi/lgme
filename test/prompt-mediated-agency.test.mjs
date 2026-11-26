import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path));
const text = (path) => read(path).toString('utf8');

const PDF_SHA256 = '2a3183d3b72729e12c48c5ba1c887731e9e55a9735e1351c7bd8f3bcdb1292e3';

test('the dissertation route, PDF, and reading links are present', () => {
  const page = text('prompt-mediated-agency.html');
  const home = text('index.html');
  const pdf = read('Prompt_Mediated_Agency.pdf');
  assert.equal(pdf.subarray(0, 5).toString('utf8'), '%PDF-');
  assert.equal(pdf.length, 280166);
  assert.equal(createHash('sha256').update(pdf).digest('hex'), PDF_SHA256);
  assert.equal(page.includes('href="/Prompt_Mediated_Agency.pdf"'), true);
  assert.equal(page.includes('type="application/pdf"'), true);
  assert.equal(page.includes('doctoral dissertation draft'), true);
  assert.equal(page.includes('Doctoral dissertation draft'), true);
  const navStart = home.indexOf('id="main-nav"');
  const nav = home.slice(navStart, home.indexOf('</nav>', navStart));
  const toolsStart = home.indexOf('class="tools"');
  const tools = home.slice(toolsStart, home.indexOf('class="view-switch"', toolsStart));
  assert.equal(nav.includes('href="/prompt-mediated-agency">Prompt-Mediated Agency</a>'), true);
  assert.equal(tools.includes('href="/prompt-mediated-agency">Prompt-Mediated Agency</a>'), true);
  assert.equal(text('js/site-nav.js').includes('href="/prompt-mediated-agency">Prompt-Mediated Agency</a>'), true);
  assert.equal(text('study.html').includes('href="/prompt-mediated-agency"'), true);
  assert.equal(text('study.html').includes('href="/Prompt_Mediated_Agency.pdf"'), true);
  assert.equal(text('whitepaper.html').includes('href="/prompt-mediated-agency"'), true);
  assert.equal(text('sitemap.xml').includes('https://lgme.app/prompt-mediated-agency'), true);
  const catalog = JSON.parse(text('data/page-index.json'));
  assert.equal(catalog.some((entry) => entry.href === '/prompt-mediated-agency' && entry.title === 'Prompt-Mediated Agency'), true);
  assert.equal(text('vercel.json').includes('"cleanUrls": true'), true);
  assert.equal(home.includes('id="menu-toggle"'), true);
  assert.equal(home.includes('class="view-switch"'), true);
  assert.equal(text('exchange.html').includes('prompt-mediated-agency'), false);
  assert.equal(text('campus.html').includes('prompt-mediated-agency'), false);
  assert.equal(text('mutual-credit.html').includes('prompt-mediated-agency'), false);
  assert.equal(text('middleware.js').includes('planVisit'), true);
  assert.equal(text('js/solana-pay.mjs').includes('export function buildTransferRequest'), true);
});

test('the HTML reproduces the draft wording, table, and citations', () => {
  const page = text('prompt-mediated-agency.html');
  const article = page.slice(page.indexOf('id="document"'), page.indexOf('</article>'));
  const phrases = [
    'DOCTORAL DISSERTATION DRAFT • HUMAN-COMPUTER INTERACTION',
    'Prompt-Mediated Agency: Individual Sovereignty and Self-Actualization in Generative Interfaces',
    'A Mixed-Methods Investigation of Cognitive Offloading, Metacognitive Scaffolding, and Provenance-Bound Interaction',
    'Generative artificial intelligence interfaces increasingly mediate human reasoning, decision-making, and long-term goal pursuit through natural-language prompts.',
    'sovereignty—defined here as epistemic and decisional autonomy—and self-actualization',
    'proposes Sovereign Prompting Interfaces that require explicit intent specification, counterfactual examination, and verifiable provenance separation before commitment.',
    'an effort–time dissociation and a speedup illusion',
    'revision Bastani et al. (2024); Kosmyna et al. (2025).',
    'Cognitive Offloading and Transfer Loss: Bypassing productive analytical struggle can weaken schema formation and reduce performance when individuals later work without model assistance Risko and Gilbert (2016); Bastani et al. (2024).',
    'Epistemic and Value Heteronomy: Model sycophancy, persuasive framing, and unexamined system defaults can subtly shift a user’s judgments and priorities toward model tendencies rather than self-authored criteria Perez et al. (2022); Sharma et al. (2024).',
    'Collapsed Provenance: Unstructured conversational histories often blend user intent, model inference, and unverified claims into a single stream, making auditability and independent verification difficult.',
    'how HCI can re-design prompt workflows and interface guardrails',
    '2.1 Self-Actualization and Self-Determination Theory',
    'purposeful growth Maslow (1943).',
    'Self-Determination Theory (SDT)',
    'and relatedness Ryan and Deci (2000).',
    'Cognitive offloading refers to the use of external tools or actions to reduce internal cognitive demand Risko and Gilbert (2016).',
    'closure Azevedo (2005).',
    'sycophantic alignment with user phrasing even when flawed Perez et al. (2022); Sharma et al. (2024), and persuasive fluency that can induce over-reliance.',
    'workflows Buneman et al. (2001).',
    'Individual Sovereignty (Cognitive and Epistemic): The user’s capacity to set independent evaluation criteria',
    'Self-Actualization (Processual Trajectory): Ongoing development of competence, self-endorsed decision-making',
    'Sovereign Prompting Interface: An interaction design pattern that requires users to declare intent, constraints, or verification rules before or alongside generation, separating drafting support from human commitment.',
    'Prompt Posture',
    'Interaction Pattern',
    'Primary Agency and Cognitive Profile',
    '1. Delegative',
    'Requests a finished answer, draft, or recommendation with minimal user constraints.',
    'High cognitive offloading; elevated risk of uncritical adoption, sycophancy effects, and lower unassisted transfer.',
    '2. Transactional',
    'Iterative back-and-forth edits aimed at quick output polish without explicit criteria.',
    'Moderate user steering; susceptible to incremental drift from original goals and local rather than global evaluation.',
    '3. Socratic / Adversarial',
    'Requires the model to surface assumptions, alternative framings, and counterarguments first.',
    'Promotes metacognitive monitoring and critical scrutiny at the cost of higher upfront interaction steps.',
    '4. Provenance-Bound',
    'Separates facts, inferences, and user commitments while requiring explicit human sign-off or refusal.',
    'Supports epistemic auditability, clear authorship boundaries, and deliberate decision ownership.',
    'RQ1 (Metacognition and Transfer): How do Socratic and Provenance-Bound prompt structures influence perceived workload, confidence calibration, and performance on subsequent unassisted tasks compared with Delegative prompting?',
    'RQ2 (Epistemic Vigilance): How do explicit pre-commitment constraints and provenance separation affect detection of planted inaccuracies, unsupported leaps, or framing bias in model outputs?',
    'RQ3 (Autonomy and Longitudinal Authorship): How do structured interface frictions—such as assumption checks and explicit refusal or edit gates—shape perceived autonomy, competence, and authorship over multi-week use?',
    'Study 1 (Controlled Within-Subjects Experiment): Participants complete analytical synthesis and decision-tradeoff tasks across three counterbalanced conditions—Delegative Baseline, Socratic Scaffold, and Provenance-Bound Workspace—followed by an unassisted transfer probe.',
    'subjective workload (NASA-TLX) Hart and Staveland (1988), confidence calibration accuracy, error/bias detection rates, and transfer task scores.',
    'Study 2 (Longitudinal Field Study): Participants use an instrumented prompting workspace across real writing, analysis, or design tasks over several weeks.',
    'This work aims to contribute (1) a conceptual bridge between SDT, metacognitive scaffolding, and prompt interface design; (2) empirical evidence on the trade-offs between frictionless generation, epistemic vigilance, and skill retention; and (3) open interface patterns for provenance-aware prompting.',
    'Azevedo, R. (2005). Computer environments as metacognitive tools for enhancing learning. Educational Psychologist, 40(4), 193–197.',
    'Bastani, H., Bastani, O., Sungu, A., et al. (2024). Generative AI can harm learning. The Wharton School Research Paper.',
    'Buneman, P., Khanna, S., &amp; Tan, W. C. (2001). Why and where: A characterization of data provenance. In Database Theory — ICDT 2001 (pp. 316–330). Springer.',
    'Hart, S. G., &amp; Staveland, L. E. (1988). Development of NASA-TLX (Task Load Index): Results of empirical and theoretical research. Advances in Psychology, 52, 139–183.',
    'Kosmyna, N., Hauptmann, E., Yuan, Y. T., et al. (2025). Your brain on ChatGPT: Accumulation of cognitive debt when using an AI assistant for essay writing task. arXiv preprint.',
    'Maslow, A. H. (1943). A theory of human motivation. Psychological Review, 50(4), 370–396.',
    'Perez, E., Ringer, S., Lukošiūtė, K., et al. (2022). Discovering language model behaviors with model-written evaluations. arXiv preprint.',
    'Risko, E. F., &amp; Gilbert, S. J. (2016). Cognitive offloading. Trends in Cognitive Sciences, 20(9), 676–688.',
    'Ryan, R. M., &amp; Deci, E. L. (2000). Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being. American Psychologist, 55(1), 68–78.',
    'Sharma, M., Tong, M., Korbak, T., et al. (2024). Towards understanding sycophancy in language models. In International Conference on Learning Representations (ICLR).'
  ];
  let cursor = 0;
  for (const phrase of phrases) {
    const at = article.indexOf(phrase, cursor);
    assert.ok(at >= cursor, phrase);
    cursor = at + phrase.length;
  }
  assert.equal(article.includes('<img'), false);
  assert.equal(article.includes('<svg'), false);
  assert.equal(article.includes('$Trust'), false);
  assert.equal(page.includes('$Trust'), false);
  assert.equal(page.includes('<table>'), true);
  assert.equal((article.match(/<li>/g) || []).length, 19);
});
