<script lang="ts">
  /**
   * RichTextEditor — Editor WYSIWYG estilo Gmail/Outlook.
   *
   * - contenteditable + document.execCommand (universal, sin dependencias)
   * - Toolbar: formato, encabezados, listas, alineación, color, fuente,
   *   tamaño, link, imagen (file → base64), citar, undo/redo, limpiar.
   * - Soporta arrastrar y pegar imágenes (se convierten a data URI).
   * - Bind 2-way con `value` (HTML).
   * - Botón "Vista previa" para conmutar a un preview leyendo el HTML.
   */
  import { onMount, tick } from "svelte";

  export let value: string = "";
  export let placeholder: string = "Escribe tu anuncio…";
  export let minHeight: string = "260px";
  export let maxImageBytes: number = 1024 * 1024; // 1 MB por imagen

  let editorEl: HTMLDivElement | null = null;
  let fileInput: HTMLInputElement | null = null;
  let linkPopover = false;
  let linkUrl = "";
  let linkText = "";
  let savedRange: Range | null = null;
  let previewMode = false;
  let imageError = "";
  let currentColor = "#0f172a";
  let currentBg = "transparent";
  let currentFont = "default";
  let currentSize = "3"; // 1..7 (legacy execCommand)
  let currentBlock = "p";

  const FONTS: { label: string; value: string }[] = [
    { label: "Predeterminada", value: "default" },
    { label: "Sans-serif", value: "Arial, Helvetica, sans-serif" },
    { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
    { label: "Mono", value: "ui-monospace, 'SF Mono', Menlo, monospace" },
    { label: "Inter", value: "Inter, -apple-system, BlinkMacSystemFont, sans-serif" },
  ];
  const SIZES: { label: string; value: string }[] = [
    { label: "XS", value: "1" },
    { label: "S", value: "2" },
    { label: "Normal", value: "3" },
    { label: "L", value: "5" },
    { label: "XL", value: "6" },
    { label: "XXL", value: "7" },
  ];
  const BLOCKS: { label: string; value: string }[] = [
    { label: "Párrafo", value: "P" },
    { label: "Título 1", value: "H1" },
    { label: "Título 2", value: "H2" },
    { label: "Título 3", value: "H3" },
    { label: "Cita", value: "BLOCKQUOTE" },
    { label: "Código", value: "PRE" },
  ];

  onMount(() => {
    if (editorEl && value) editorEl.innerHTML = value;
  });

  // Sincronizar value desde el editor al cambiar el contenido.
  function syncValue() {
    if (editorEl) value = editorEl.innerHTML;
  }

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRange = sel.getRangeAt(0).cloneRange();
    }
  }
  function restoreSelection() {
    if (!savedRange) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(savedRange);
  }

  function focusEditor() {
    editorEl?.focus();
  }

  function exec(cmd: string, val?: string) {
    focusEditor();
    if (savedRange) restoreSelection();
    try {
      document.execCommand(cmd, false, val);
    } catch (_) {}
    syncValue();
  }

  function setBlock(tag: string) {
    exec("formatBlock", tag);
    currentBlock = tag.toLowerCase();
  }

  function setFont(font: string) {
    currentFont = font;
    if (font === "default") {
      // Remueve font-family aplicando span vacío no es trivial; usar removeFormat parcial.
      exec("removeFormat");
    } else {
      exec("fontName", font);
    }
  }

  function setSize(size: string) {
    currentSize = size;
    exec("fontSize", size);
  }

  function setColor(color: string) {
    currentColor = color;
    exec("foreColor", color);
  }

  function setBg(color: string) {
    currentBg = color;
    // hiliteColor es el estándar; backColor lo soporta Firefox legacy.
    exec("hiliteColor", color);
  }

  function clearFormat() {
    exec("removeFormat");
    exec("formatBlock", "P");
  }

  // ── Link ──────────────────────────────────────────────────────────
  function openLinkPopover() {
    saveSelection();
    const sel = window.getSelection();
    linkText = sel ? sel.toString() : "";
    linkUrl = "";
    linkPopover = true;
  }
  function closeLinkPopover() {
    linkPopover = false;
    linkUrl = "";
    linkText = "";
  }
  function applyLink() {
    if (!linkUrl.trim()) {
      closeLinkPopover();
      return;
    }
    const url = linkUrl.trim();
    const safeUrl = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
    focusEditor();
    restoreSelection();
    if (linkText && (!savedRange || savedRange.collapsed)) {
      // Insertar texto + link nuevo.
      const a = document.createElement("a");
      a.href = safeUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = linkText;
      const range = savedRange ?? window.getSelection()?.getRangeAt(0);
      if (range) {
        range.deleteContents();
        range.insertNode(a);
        range.setStartAfter(a);
        range.collapse(true);
      }
    } else {
      document.execCommand("createLink", false, safeUrl);
      // Marcar target=_blank en el último link creado.
      requestAnimationFrame(() => {
        if (!editorEl) return;
        editorEl.querySelectorAll('a:not([data-rte-checked])').forEach((a) => {
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noopener noreferrer");
          a.setAttribute("data-rte-checked", "1");
        });
      });
    }
    syncValue();
    closeLinkPopover();
  }

  function removeLink() {
    exec("unlink");
  }

  // ── Imagen ────────────────────────────────────────────────────────
  function pickImage() {
    saveSelection();
    fileInput?.click();
  }

  function readFileAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function insertImageFile(file: File) {
    imageError = "";
    if (!file.type.startsWith("image/")) {
      imageError = "El archivo debe ser una imagen.";
      return;
    }
    if (file.size > maxImageBytes) {
      imageError = `Imagen demasiado grande (máx ${(maxImageBytes / 1024 / 1024).toFixed(1)} MB).`;
      return;
    }
    try {
      const dataUrl = await readFileAsDataURL(file);
      focusEditor();
      restoreSelection();
      const html = `<img src="${dataUrl}" alt="" style="max-width:100%;height:auto;border-radius:6px;margin:4px 0;" />`;
      document.execCommand("insertHTML", false, html);
      syncValue();
    } catch (e) {
      imageError = "No se pudo leer la imagen.";
    }
  }

  async function onFilePicked(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) await insertImageFile(file);
    input.value = "";
  }

  function onPaste(ev: ClipboardEvent) {
    const cd = ev.clipboardData;
    if (!cd) return;
    const items = Array.from(cd.items || []);
    const imgItem = items.find((it) => it.kind === "file" && it.type.startsWith("image/"));
    if (imgItem) {
      ev.preventDefault();
      const f = imgItem.getAsFile();
      if (f) insertImageFile(f);
      return;
    }
    // Texto pegado: pegar como texto plano para evitar estilos hostiles.
    const text = cd.getData("text/html") || cd.getData("text/plain");
    if (text && !cd.getData("text/html")) {
      ev.preventDefault();
      document.execCommand("insertText", false, cd.getData("text/plain"));
    }
  }

  function onDrop(ev: DragEvent) {
    const files = ev.dataTransfer?.files;
    if (files && files.length && files[0].type.startsWith("image/")) {
      ev.preventDefault();
      insertImageFile(files[0]);
    }
  }

  function onKeyDown(ev: KeyboardEvent) {
    // Atajos estilo Gmail.
    if (!(ev.ctrlKey || ev.metaKey)) return;
    const k = ev.key.toLowerCase();
    if (k === "k") {
      ev.preventDefault();
      openLinkPopover();
    }
  }
</script>

<div class="rte-wrap" class:preview={previewMode}>
  <div class="rte-toolbar" role="toolbar" aria-label="Herramientas de formato">
    <!-- Bloque -->
    <select class="rte-select" aria-label="Bloque"
      on:change={(e) => setBlock(e.currentTarget.value)} disabled={previewMode}>
      {#each BLOCKS as b}
        <option value={b.value} selected={currentBlock === b.value.toLowerCase()}>{b.label}</option>
      {/each}
    </select>

    <!-- Fuente -->
    <select class="rte-select" aria-label="Fuente" bind:value={currentFont}
      on:change={(e) => setFont(e.currentTarget.value)} disabled={previewMode}>
      {#each FONTS as f}
        <option value={f.value}>{f.label}</option>
      {/each}
    </select>

    <!-- Tamaño -->
    <select class="rte-select" aria-label="Tamaño" bind:value={currentSize}
      on:change={(e) => setSize(e.currentTarget.value)} disabled={previewMode}>
      {#each SIZES as s}
        <option value={s.value}>{s.label}</option>
      {/each}
    </select>

    <span class="rte-divider"></span>

    <!-- Formato inline -->
    <button type="button" title="Negrita (Ctrl+B)" on:click={() => exec("bold")} disabled={previewMode}>
      <b>B</b>
    </button>
    <button type="button" title="Cursiva (Ctrl+I)" on:click={() => exec("italic")} disabled={previewMode}>
      <i>I</i>
    </button>
    <button type="button" title="Subrayado (Ctrl+U)" on:click={() => exec("underline")} disabled={previewMode}>
      <u>U</u>
    </button>
    <button type="button" title="Tachado" on:click={() => exec("strikeThrough")} disabled={previewMode}>
      <s>S</s>
    </button>

    <!-- Color texto -->
    <label class="rte-color" title="Color del texto">
      <span class="rte-color-swatch" style="background:{currentColor}"></span>
      <span class="rte-color-letter">A</span>
      <input type="color" bind:value={currentColor}
        on:input={() => setColor(currentColor)} disabled={previewMode} />
    </label>

    <!-- Color fondo / resaltado -->
    <label class="rte-color" title="Resaltar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
      <input type="color" bind:value={currentBg}
        on:input={() => setBg(currentBg)} disabled={previewMode} />
    </label>

    <span class="rte-divider"></span>

    <!-- Listas -->
    <button type="button" title="Lista con viñetas" on:click={() => exec("insertUnorderedList")} disabled={previewMode}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>
    </button>
    <button type="button" title="Lista numerada" on:click={() => exec("insertOrderedList")} disabled={previewMode}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
    </button>

    <!-- Alineación -->
    <button type="button" title="Alinear a la izquierda" on:click={() => exec("justifyLeft")} disabled={previewMode}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
    </button>
    <button type="button" title="Centrar" on:click={() => exec("justifyCenter")} disabled={previewMode}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="10" x2="6" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="18" y1="18" x2="6" y2="18"/></svg>
    </button>
    <button type="button" title="Alinear a la derecha" on:click={() => exec("justifyRight")} disabled={previewMode}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="7" y2="18"/></svg>
    </button>

    <span class="rte-divider"></span>

    <!-- Link / imagen -->
    <button type="button" title="Insertar enlace (Ctrl+K)" on:click={openLinkPopover} disabled={previewMode}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
    </button>
    <button type="button" title="Quitar enlace" on:click={removeLink} disabled={previewMode}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 6-12 12"/><path d="M10 13a5 5 0 0 0 7.54.54"/><path d="M14 11a5 5 0 0 0-7.54-.54"/></svg>
    </button>
    <button type="button" title="Insertar imagen" on:click={pickImage} disabled={previewMode}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
    </button>

    <span class="rte-divider"></span>

    <!-- Undo/Redo/Limpiar -->
    <button type="button" title="Deshacer (Ctrl+Z)" on:click={() => exec("undo")} disabled={previewMode}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 8"/></svg>
    </button>
    <button type="button" title="Rehacer (Ctrl+Y)" on:click={() => exec("redo")} disabled={previewMode}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 7v6h-6"/><path d="M21 13a9 9 0 1 1-3-7.7L21 8"/></svg>
    </button>
    <button type="button" title="Limpiar formato" on:click={clearFormat} disabled={previewMode}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7V4h16v3"/><line x1="5" y1="20" x2="19" y2="20"/><line x1="6" y1="4" x2="14" y2="20"/></svg>
    </button>

    <span class="rte-spacer"></span>

    <!-- Vista previa -->
    <button type="button" class="rte-preview-btn" class:active={previewMode}
      title="Vista previa" on:click={() => (previewMode = !previewMode)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      {previewMode ? "Editar" : "Vista previa"}
    </button>
  </div>

  {#if !previewMode}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      bind:this={editorEl}
      class="rte-content"
      contenteditable="true"
      role="textbox"
      aria-multiline="true"
      data-placeholder={placeholder}
      style="min-height: {minHeight}"
      on:input={syncValue}
      on:blur={syncValue}
      on:paste={onPaste}
      on:drop={onDrop}
      on:dragover|preventDefault
      on:keydown={onKeyDown}
    ></div>
  {:else}
    <div class="rte-preview" style="min-height: {minHeight}">
      {@html value || `<p style="color:#94a3b8">Nada para previsualizar.</p>`}
    </div>
  {/if}

  {#if imageError}
    <div class="rte-feedback err">{imageError}</div>
  {/if}

  <input type="file" accept="image/*" bind:this={fileInput}
    on:change={onFilePicked} style="display:none" />

  {#if linkPopover}
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="rte-link-overlay" on:click={closeLinkPopover}></div>
    <div class="rte-link-popover" role="dialog" aria-label="Insertar enlace">
      <div class="rte-link-row">
        <label>Texto</label>
        <input type="text" bind:value={linkText} placeholder="Texto del enlace" />
      </div>
      <div class="rte-link-row">
        <label>URL</label>
        <input type="url" bind:value={linkUrl} placeholder="https://…" autofocus />
      </div>
      <div class="rte-link-actions">
        <button type="button" class="ghost" on:click={closeLinkPopover}>Cancelar</button>
        <button type="button" class="primary" on:click={applyLink}>Aplicar</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .rte-wrap {
    border: 1px solid var(--border, #e2e8f0);
    border-radius: 10px;
    background: #fff;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .rte-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 2px;
    padding: 6px 8px;
    background: #f8fafc;
    border-bottom: 1px solid var(--border, #e2e8f0);
  }
  .rte-toolbar button,
  .rte-toolbar .rte-select {
    background: transparent;
    border: 1px solid transparent;
    color: #334155;
    padding: 4px 6px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.78rem;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 28px;
    transition: background 120ms, border-color 120ms;
  }
  .rte-toolbar button:hover:not(:disabled),
  .rte-toolbar .rte-select:hover:not(:disabled) {
    background: #e2e8f0;
    border-color: #cbd5e1;
  }
  .rte-toolbar button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .rte-toolbar .rte-select {
    padding: 4px 6px;
    appearance: auto;
    font-size: 0.78rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    min-width: 84px;
  }
  .rte-divider {
    width: 1px;
    height: 18px;
    background: #cbd5e1;
    margin: 0 4px;
  }
  .rte-spacer { flex: 1; }

  .rte-color {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    height: 28px;
    color: #334155;
  }
  .rte-color:hover { background: #e2e8f0; border-color: #cbd5e1; }
  .rte-color input[type="color"] {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    border: 0;
    padding: 0;
  }
  .rte-color-swatch {
    width: 14px;
    height: 4px;
    border-radius: 2px;
    background: #0f172a;
  }
  .rte-color-letter {
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1;
  }

  .rte-preview-btn {
    gap: 5px;
    padding: 4px 9px !important;
    color: var(--primary, #059669) !important;
    border: 1px solid #d1fae5 !important;
    background: #ecfdf5 !important;
  }
  .rte-preview-btn:hover { background: #d1fae5 !important; }
  .rte-preview-btn.active {
    background: var(--primary, #059669) !important;
    color: #fff !important;
    border-color: var(--primary, #059669) !important;
  }

  .rte-content {
    padding: 14px 16px;
    font-size: 0.95rem;
    line-height: 1.55;
    color: #0f172a;
    outline: none;
    overflow-y: auto;
    max-height: 60vh;
  }
  .rte-content:empty::before {
    content: attr(data-placeholder);
    color: #94a3b8;
    pointer-events: none;
  }
  .rte-content :global(p) { margin: 0 0 0.6em; }
  .rte-content :global(h1) { font-size: 1.5rem; margin: 0.4em 0 0.3em; }
  .rte-content :global(h2) { font-size: 1.25rem; margin: 0.4em 0 0.3em; }
  .rte-content :global(h3) { font-size: 1.1rem; margin: 0.4em 0 0.3em; }
  .rte-content :global(blockquote) {
    border-left: 3px solid #cbd5e1;
    margin: 0.6em 0;
    padding: 0.2em 0 0.2em 0.9em;
    color: #475569;
  }
  .rte-content :global(pre) {
    background: #f1f5f9;
    padding: 0.7em 0.9em;
    border-radius: 6px;
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: 0.85em;
    overflow-x: auto;
  }
  .rte-content :global(ul),
  .rte-content :global(ol) { margin: 0 0 0.6em 1.4em; padding: 0; }
  .rte-content :global(a) { color: var(--primary, #059669); text-decoration: underline; }
  .rte-content :global(img) { max-width: 100%; height: auto; }

  .rte-preview {
    padding: 14px 16px;
    overflow-y: auto;
    max-height: 60vh;
    background: #fff;
  }

  .rte-feedback.err {
    background: #fef2f2;
    color: #b91c1c;
    border-top: 1px solid #fecaca;
    padding: 6px 12px;
    font-size: 0.78rem;
  }

  /* Link popover */
  .rte-link-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15,23,42,0.35);
    z-index: 1200;
  }
  .rte-link-popover {
    position: fixed;
    z-index: 1201;
    left: 50%;
    top: 30%;
    transform: translateX(-50%);
    width: min(420px, 90vw);
    background: #fff;
    border-radius: 10px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 12px 32px rgba(0,0,0,0.18);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .rte-link-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .rte-link-row label {
    font-size: 0.74rem;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .rte-link-row input {
    padding: 8px 10px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 0.9rem;
    font-family: inherit;
  }
  .rte-link-row input:focus { outline: 2px solid var(--primary, #059669); outline-offset: 0; }
  .rte-link-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }
  .rte-link-actions .ghost {
    background: transparent;
    border: 1px solid #cbd5e1;
    color: #475569;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.84rem;
  }
  .rte-link-actions .primary {
    background: var(--primary, #059669);
    border: 1px solid var(--primary, #059669);
    color: #fff;
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.84rem;
    font-weight: 600;
  }
  .rte-link-actions .primary:hover { background: #047857; }
</style>
