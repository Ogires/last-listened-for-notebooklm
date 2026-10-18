// E2E de la extensión con Playwright: lanza el Chromium de Playwright
// (channel "chromium"; Chrome de marca ignora --load-extension desde la v137) con la extensión cargada (--load-extension),
// intercepta https://notebook.google.com/** y sirve un fixture que replica
// el DOM real (tarjetas + reproductor con jslog). La "reproducción" se
// simula avanzando el texto de tiempo y poniendo el botón en estado pausa.
//
// Ejecutar: npm run test:e2e   (HEADLESS=1 para sin ventana)
import { chromium } from 'playwright';
import { setTimeout as sleep } from 'node:timers/promises';
import process from 'node:process';
import { rmSync } from 'node:fs';

const EXT_PATH = process.cwd();
const PROFILE = '.e2e-profile';
// Perfil limpio en cada ejecución: si no, las escuchas de la anterior
// quedan en chrome.storage y los casos "sin escucha" fallan.
rmSync(PROFILE, { recursive: true, force: true });
const assert = (await import('node:assert')).strict;

function jslog(notebook, artifact) {
  return '267035;track:generic_click,impression;0:' +
    Buffer.from(JSON.stringify([[notebook, artifact]])).toString('base64');
}

const ART1 = 'e2e-art-1';
const ART2 = 'e2e-art-2';
const ART3 = 'e2e-art-3';
const QUIZ = 'e2e-quiz-1';
const NB = 'e2e-notebook';
// Idioma que declara la página (<html lang>); '' = sin declarar.
let pageLang = '';
// Simula un cambio de DOM de NotebookLM: tarjetas sin id ni jslog.
let brokenKeys = false;

// Fixture que replica la estructura verificada en vivo:
// artifact-library > artifact-library-item > .artifact-button-content >
//   nb-icon-button[mattooltip][jslog]   +   reproductor .playback-control-button
function fixtureHtml() {
  const card = (art, title, icon = 'audio_spark') => `
    <artifact-library-item>
      <div class="artifact-button-content">
        <mat-icon class="mat-icon artifact-icon">${icon}</mat-icon>
        <span class="artifact-primary-content">
          <span class="artifact-labels"${brokenKeys ? '' : ` id="artifact-labels-${art}"`}>
            <div class="title-container">${title}</div>
            <span class="artifact-details">19:07 · Deep Dive</span>
          </span>
        </span>
        ${brokenKeys ? '' : `<nb-icon-button mattooltip="Reproducir" jslog="${jslog(NB, art)}"></nb-icon-button>`}
      </div>
    </artifact-library-item>`;
  const langAttr = pageLang ? ` lang="${pageLang}"` : '';
  return `<!DOCTYPE html><html${langAttr}><head><meta charset="utf-8"></head><body>
    <artifact-library>${card(ART1, 'Resumen uno')}${card(ART2, 'Resumen dos')}${card(ART3, 'Resumen tres')}${card(QUIZ, 'Cuestionario', 'quiz')}</artifact-library>
    <div id="player"></div>
    <script>
      window.__sim = { open: false, playing: false, t: 0, pauseLabel: '', jslog: '' };
      function fmt(s) {
        s = Math.floor(s);
        return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      }
      setInterval(function () {
        if (window.__sim.playing) window.__sim.t += 0.5;
        var p = document.getElementById('player');
        if (window.__sim.open) {
          var label = window.__sim.playing ? window.__sim.pauseLabel : 'Play audio player';
          p.innerHTML =
            '<button class="playback-control-button" aria-label="' + label + '" ' +
            'jslog="' + window.__sim.jslog + '"></button>' +
            '<div class="playback-time-container">' + fmt(window.__sim.t) + ' / 19:07</div>';
        } else {
          p.innerHTML = '';
        }
      }, 500);
    </script>
  </body></html>`;
}

async function waitFor(fn, timeoutMs, label) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeoutMs) {
    last = await fn();
    if (last) return last;
    await sleep(300);
  }
  throw new Error('TIMEOUT esperando: ' + label + ' (último: ' + JSON.stringify(last) + ')');
}

async function labelOf(page, cardIndex) {
  return page.evaluate(
    (i) => {
      const el = document.querySelectorAll('artifact-library-item')[i]
        .querySelector('.nlm-last-played');
      return el ? el.textContent : null;
    },
    cardIndex
  );
}

async function simulateListening(page, { artifact, pauseLabel, seconds }) {
  await page.evaluate(
    ({ pauseLabel, jslogStr }) => {
      window.__sim = { open: true, playing: true, t: 0, pauseLabel, jslog: jslogStr };
    },
    { pauseLabel, jslogStr: jslog(NB, artifact) }
  );
  await sleep(seconds * 1000 + 2500); // umbral 5 s + margen de poll/refresco
}

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log('  ✓ ' + name);
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
    console.log('  × ' + name + '\n    ' + e.message.split('\n')[0]);
  }
}

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chromium',
  headless: process.env.HEADLESS === '1',
  locale: 'es-ES', // etiquetas de la extensión en español, determinista
  viewport: { width: 1280, height: 720 },
  args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
});
try {
  await ctx.route('https://notebook.google.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: fixtureHtml() })
  );
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto('https://notebook.google.com/notebook/' + NB);
  await page.waitForTimeout(1500);

  console.log('E2E Last listened for NotebookLM (Chromium + extensión cargada)\n');

  await test('la extensión se inyecta en las 3 tarjetas de audio, no en el cuestionario', async () => {
    const n = await page.evaluate(() => document.querySelectorAll('.nlm-last-played').length);
    assert.equal(n, 3, 'esperaba 3 contenedores, hay ' + n);
    const quiz = await labelOf(page, 3);
    assert.equal(quiz, null, 'el cuestionario no debe tener etiqueta');
  });

  await test('sin escucha no hay texto de etiqueta', async () => {
    const t = await labelOf(page, 0);
    assert.ok(!t, 'esperaba vacío, hay: ' + t);
  });

  await test('escucha ≥5 s con UI en INGLÉS ("Pause audio player") registra y etiqueta', async () => {
    await simulateListening(page, { artifact: ART1, pauseLabel: 'Pause audio player', seconds: 6 });
    const t = await waitFor(() => labelOf(page, 0).then((x) => (x ? x : null)), 8000, 'etiqueta tarjeta 1');
    assert.match(t, /^Última escucha: \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2} \((ahora|hace \d+ s)\)$/, t);
    const tooltip = await page.evaluate(
      () => document.querySelectorAll('artifact-library-item')[0].title
    );
    assert.equal(tooltip, t, 'el tooltip de la tarjeta debe replicar el texto');
  });

  await test('la otra tarjeta sigue sin fecha (atribución por artefacto)', async () => {
    await page.evaluate(() => { window.__sim.playing = false; window.__sim.open = false; });
    await page.waitForTimeout(1000);
    const t = await labelOf(page, 1);
    assert.ok(!t, 'tarjeta 2 no debería tener etiqueta: ' + t);
  });

  await test('escucha con UI en ESPAÑOL ("Pausar el reproductor de audio") también registra', async () => {
    await simulateListening(page, {
      artifact: ART2,
      pauseLabel: 'Pausar el reproductor de audio',
      seconds: 6,
    });
    const t = await waitFor(() => labelOf(page, 1).then((x) => (x ? x : null)), 8000, 'etiqueta tarjeta 2');
    assert.match(t, /^Última escucha: /, t);
  });

  await test('UI en JAPONÉS ("一時停止"): detecta por avance del tiempo', async () => {
    await page.evaluate(() => { window.__sim.playing = false; window.__sim.open = false; });
    await page.waitForTimeout(1000);
    await simulateListening(page, { artifact: ART3, pauseLabel: '一時停止', seconds: 7 });
    const t = await waitFor(() => labelOf(page, 2).then((x) => (x ? x : null)), 8000, 'etiqueta tarjeta 3');
    assert.match(t, /^Última escucha: /, t);
  });

  await test('los datos persisten tras recargar la página', async () => {
    await page.evaluate(() => { window.__sim.playing = false; window.__sim.open = false; });
    await page.reload();
    await page.waitForTimeout(2000);
    const t1 = await waitFor(() => labelOf(page, 0).then((x) => (x ? x : null)), 8000, 'etiqueta tras reload');
    assert.match(t1, /^Última escucha: /, t1);
  });

  await test('página con lang="en" → etiqueta en inglés (manda la página, no el navegador)', async () => {
    pageLang = 'en';
    await page.reload();
    await page.waitForTimeout(2000);
    const t = await waitFor(() => labelOf(page, 0).then((x) => (x ? x : null)), 8000, 'etiqueta en inglés');
    assert.match(t, /^Last listened: \d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}\s[AP]M \(/, t);
  });

  // Visto en vivo: lista → mismo cuaderno sin recargar dejaba las tarjetas sin
  // etiqueta, porque Angular recrea artifact-library y el renderer seguía
  // observando el viejo.
  await test('navegación SPA lista → mismo cuaderno: vuelven las etiquetas', async () => {
    await page.evaluate(() => {
      const lib = document.querySelector('artifact-library');
      const clone = lib.cloneNode(true);
      clone.querySelectorAll('.nlm-last-played').forEach((e) => e.remove());
      window.__libHtml = clone.outerHTML;
      history.pushState({}, '', '/');
      lib.remove();
    });
    await page.waitForTimeout(1500);
    await page.evaluate((nb) => {
      history.pushState({}, '', '/notebook/' + nb);
      document.body.insertAdjacentHTML('afterbegin', window.__libHtml);
    }, NB);
    const t = await waitFor(() => labelOf(page, 0).then((x) => (x ? x : null)), 5000, 'etiqueta tras SPA');
    assert.match(t, /^Last listened: /, t);
  });

  // Visto en vivo (2026-10-18): al generarse un artefacto nuevo, Angular
  // reutiliza los nodos de tarjeta; cambia el id pero deja el jslog viejo.
  await test('nodo reutilizado por Angular: cada fecha sigue a su resumen', async () => {
    const before = await Promise.all([0, 1].map((i) => labelOf(page, i)));
    assert.notEqual(before[0], before[1]);
    await page.evaluate((a1) => {
      const [c1, c2] = document.querySelectorAll('artifact-library-item');
      // c1 pasa a ser un artefacto generándose; c2 pasa a ser ART1 (jslog de ART2)
      c1.querySelector('[id^="artifact-labels-"]').id = 'artifact-labels-e2e-new';
      c1.querySelector('mat-icon.artifact-icon').textContent = 'progress_activity';
      c2.querySelector('[id^="artifact-labels-"]').id = 'artifact-labels-' + a1;
    }, ART1);
    await page.waitForTimeout(500);
    const after = await Promise.all([0, 1].map((i) => labelOf(page, i)));
    assert.equal(after[0], null, 'la tarjeta generándose no debe tener etiqueta: ' + after[0]);
    assert.equal(after[1], before[0], 'la tarjeta 2 debe mostrar la fecha de ART1');
  });

  const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
  const extId = new URL(sw.url()).host;
  const badge = () =>
    sw.evaluate(async () => {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      return chrome.action.getBadgeText({ tabId: tab.id });
    });

  await test('página de opciones: cuenta las escuchas y "Borrar historial" limpia las etiquetas', async () => {
    await page.reload();
    await page.waitForTimeout(1500);
    const opts = await ctx.newPage();
    await opts.goto(`chrome-extension://${extId}/src/options.html`);
    const count = await waitFor(() => opts.textContent('#count'), 3000, 'contador');
    assert.match(count, /: 3$/, count);
    opts.once('dialog', (d) => d.accept());
    await opts.click('#clear');
    await waitFor(async () => /: 0$/.test(await opts.textContent('#count')), 3000, 'contador a 0');
    await opts.close();
    await page.bringToFront();
    const t = await waitFor(
      () => labelOf(page, 0).then((x) => (x === '' ? 'vacía' : null)),
      5000,
      'etiqueta vacía tras borrar'
    );
    assert.equal(t, 'vacía');
  });

  await test('sin "!" en el icono cuando todo funciona', async () => {
    await page.waitForTimeout(1000);
    assert.equal(await badge(), '');
  });

  await test('DOM roto (tarjetas de audio sin identificador) → "!" en el icono', async () => {
    brokenKeys = true;
    await page.reload();
    const b = await waitFor(() => badge().then((x) => (x ? x : null)), 12000, 'badge');
    assert.equal(b, '!');
    brokenKeys = false;
    await page.reload();
    await waitFor(() => badge().then((x) => (x === '' ? 'ok' : null)), 5000, 'badge retirado');
  });
} finally {
  await ctx.close();
}

const failed = results.filter((r) => !r.ok);
console.log(
  '\n' + results.length + ' tests, ' + (results.length - failed.length) + ' ok, ' + failed.length + ' fallos'
);
process.exit(failed.length ? 1 : 0);
