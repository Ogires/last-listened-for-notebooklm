# Chrome Web Store — borrador de ficha y privacidad

Textos listos para pegar en el panel de desarrollador
(<https://chrome.google.com/webstore/devconsole>). El paquete se genera con
`npm run pack` → `dist/last-listened-for-notebooklm-<versión>.zip`.

## Pendiente de decidir antes de publicar

- ~~**Nombre.**~~ Decidido: **"Last listened for NotebookLM"**, localizado en
  `_locales/*/messages.json` (`extName`, ≤ 45 caracteres). El "for" deja claro
  que no es una extensión oficial de Google (política de marcas).
- **Capturas** (obligatoria al menos una, 1280×800 o 640×400): una tarjeta
  del panel Studio con la etiqueta visible. Ojo: que no salgan títulos de
  cuadernos privados.
- **Visibilidad inicial:** *No listada* (solo con enlace) unas semanas, y
  después *Pública*.

## Descripción corta

Es la `extDescription` de `_locales/<idioma>/messages.json`; la tienda la toma
del manifest. No hay que pegarla.

## Descripción detallada (una por idioma)

### en

```text
See when you last listened to each Audio Overview in NotebookLM.

The extension adds a small line under every Audio Overview card in the Studio
panel: "Last listened: 10/16/2026, 12:17 PM (2 hr. ago)". A listen counts after
5 seconds of actual playback; seeking doesn't count.

• Works with NotebookLM in any interface language.
• Dates follow your language's format; labels in English, Spanish, French,
  German, Portuguese and Italian.
• Private by design: your history is stored only in your browser
  (chrome.storage.local). Nothing is sent anywhere, no account, no analytics.

Not affiliated with or endorsed by Google.
```

### es

```text
Consulta cuándo escuchaste por última vez cada resumen de audio de NotebookLM.

La extensión añade una línea bajo cada tarjeta de resumen de audio del panel
Studio: "Última escucha: 16/10/2026, 12:17 (hace 2 h)". Una escucha cuenta tras
5 segundos de reproducción real; los saltos en la barra no cuentan.

• Funciona con NotebookLM en cualquier idioma de la interfaz.
• Las fechas siguen el formato de tu idioma; textos en español, inglés,
  francés, alemán, portugués e italiano.
• Privada por diseño: tu historial se guarda solo en tu navegador
  (chrome.storage.local). No se envía nada a ningún sitio: sin cuentas ni
  analítica.

Sin relación con Google ni respaldo por su parte.
```

### fr

```text
Voyez quand vous avez écouté pour la dernière fois chaque résumé audio de NotebookLM.

L'extension ajoute une ligne sous chaque fiche de résumé audio du panneau
Studio : « Dernière écoute: 16/10/2026 12:17 (il y a 2 h) ». Une écoute est
comptée après 5 secondes de lecture réelle ; les sauts dans la barre ne
comptent pas.

• Fonctionne avec NotebookLM quelle que soit la langue de l'interface.
• Les dates suivent le format de votre langue ; textes en français, anglais,
  espagnol, allemand, portugais et italien.
• Confidentielle par conception : votre historique reste uniquement dans votre
  navigateur (chrome.storage.local). Rien n'est envoyé, ni compte ni analyse.

Sans lien avec Google et non approuvée par Google.
```

### de

```text
Sieh auf einen Blick, wann du jede Audio-Zusammenfassung in NotebookLM zuletzt gehört hast.

Die Erweiterung fügt unter jeder Audio-Zusammenfassung im Studio-Bereich eine
Zeile hinzu: „Zuletzt gehört: 16.10.2026, 12:17 (vor 2 Std.)“. Gezählt wird nach
5 Sekunden tatsächlicher Wiedergabe; Springen in der Zeitleiste zählt nicht.

• Funktioniert mit NotebookLM in jeder Oberflächensprache.
• Datumsangaben im Format deiner Sprache; Texte auf Deutsch, Englisch,
  Spanisch, Französisch, Portugiesisch und Italienisch.
• Privat by Design: Dein Verlauf wird nur in deinem Browser gespeichert
  (chrome.storage.local). Es wird nichts gesendet – kein Konto, keine Analyse.

Nicht mit Google verbunden oder von Google unterstützt.
```

### pt

```text
Veja quando você ouviu pela última vez cada resumo em áudio do NotebookLM.

A extensão adiciona uma linha abaixo de cada cartão de resumo em áudio no
painel Studio: "Última audição: 16/10/2026, 12:17 (há 2 h)". Uma audição conta
após 5 segundos de reprodução real; saltos na barra não contam.

• Funciona com o NotebookLM em qualquer idioma da interface.
• As datas seguem o formato do seu idioma; textos em português, inglês,
  espanhol, francês, alemão e italiano.
• Privada por padrão: seu histórico fica apenas no seu navegador
  (chrome.storage.local). Nada é enviado: sem conta e sem análises.

Sem vínculo com o Google e sem endosso do Google.
```

### it

```text
Scopri quando hai ascoltato per l'ultima volta ogni riepilogo audio di NotebookLM.

L'estensione aggiunge una riga sotto ogni scheda di riepilogo audio nel
pannello Studio: "Ultimo ascolto: 16/10/2026, 12:17 (2 h fa)". Un ascolto viene
contato dopo 5 secondi di riproduzione effettiva; i salti nella barra non
contano.

• Funziona con NotebookLM in qualsiasi lingua dell'interfaccia.
• Le date seguono il formato della tua lingua; testi in italiano, inglese,
  spagnolo, francese, tedesco e portoghese.
• Privata per progettazione: la cronologia resta solo nel tuo browser
  (chrome.storage.local). Non viene inviato nulla: nessun account, nessuna
  analisi.

Non affiliata né approvata da Google.
```

## Pestaña "Prácticas de privacidad"

El formulario se rellena una sola vez, en inglés.

**Single purpose**

```text
Shows, on each NotebookLM Audio Overview card, the date and time the user last
listened to it.
```

**Permission justification — `storage`**

```text
Stores, locally in chrome.storage.local, the timestamp of the last time each
Audio Overview was played, so it can be shown on its card. Nothing else is stored.
```

**Host permission justification — `notebook.google.com`, `notebooklm.google.com`**

```text
The content script must run on NotebookLM to detect when an Audio Overview is
playing and to add the "last listened" line to its card. It only reads the
audio player's state and the cards' identifiers; it does not read notebook
contents, sources or chats.
```

**Remote code:** No, I am not using remote code.

**Data usage:** no marcar ninguna categoría (no se recopilan datos de usuario:
la marca de tiempo nunca sale del navegador) y marcar las tres
certificaciones:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** no es obligatoria si no se recopilan datos, pero
conviene tenerla. Basta con publicar [`PRIVACY.md`](../../PRIVACY.md) (por
ejemplo en GitHub) y pegar su URL.
