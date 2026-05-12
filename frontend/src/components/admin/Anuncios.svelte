<script lang="ts">
  import { onMount } from "svelte";
  import {
    broadcastAnnouncement,
    sendTestEmail,
    type AnnouncementPriority,
    type BroadcastResponse,
  } from "../../api/notifications";
  import NotificationsHealthBadge from "./NotificationsHealthBadge.svelte";

  type AudienceType = "all" | "lideres" | "grupo" | "emails";

  let subject = "";
  let messageHtml = "";
  let audienceType: AudienceType = "all";
  let grupoNombre = "";
  let emailsRaw = "";
  let priority: AnnouncementPriority = "info";
  let ctaUrl = "";
  let ctaLabel = "";

  let sending = false;
  let sendError = "";
  let lastResponse: BroadcastResponse | null = null;

  let testEmail = "";
  let testSending = false;
  let testFeedback = "";
  let testFeedbackType: "success" | "error" | "" = "";

  function buildAudienceString(): string {
    switch (audienceType) {
      case "all":
        return "all";
      case "lideres":
        return "lideres";
      case "grupo":
        return `grupo:${grupoNombre.trim()}`;
      case "emails": {
        const list = emailsRaw
          .split(/[\s,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        return `emails:${list.join(",")}`;
      }
    }
  }

  $: canSubmit =
    !sending &&
    subject.trim().length >= 3 &&
    subject.trim().length <= 200 &&
    messageHtml.trim().length > 0 &&
    (audienceType !== "grupo" || grupoNombre.trim().length > 0) &&
    (audienceType !== "emails" ||
      emailsRaw.split(/[\s,;]+/).filter((s) => s.trim()).length > 0);

  async function onSubmit() {
    sendError = "";
    lastResponse = null;
    sending = true;
    try {
      const payload = {
        subject: subject.trim(),
        message_html: messageHtml,
        audience: buildAudienceString(),
        priority,
        cta_url: ctaUrl.trim() || undefined,
        cta_label: ctaLabel.trim() || undefined,
      };
      lastResponse = await broadcastAnnouncement(payload);
    } catch (e: any) {
      sendError = e?.message || "Error al enviar el anuncio.";
    } finally {
      sending = false;
    }
  }

  async function onSendTest() {
    testFeedback = "";
    testFeedbackType = "";
    testSending = true;
    try {
      const res = await sendTestEmail(testEmail.trim() || undefined);
      testFeedback = res.sent
        ? `Email de prueba enviado a ${res.to}.`
        : `No se pudo enviar el email de prueba a ${res.to}.`;
      testFeedbackType = res.sent ? "success" : "error";
    } catch (e: any) {
      testFeedback = e?.message || "Error al enviar el email de prueba.";
      testFeedbackType = "error";
    } finally {
      testSending = false;
    }
  }
</script>

<div class="anuncios-page" data-testid="anuncios-page">
  <header class="page-header">
    <div>
      <h1>Anuncios</h1>
      <p class="subtitle">
        Envía notificaciones masivas a usuarios, líderes o grupos específicos.
      </p>
    </div>
    <NotificationsHealthBadge />
  </header>

  <section class="card">
    <h2>Email de prueba</h2>
    <p class="hint">
      Verifica que el canal de envío esté operativo. Si dejas el campo vacío, se
      envía al email del administrador autenticado.
    </p>
    <div class="row">
      <input
        type="email"
        bind:value={testEmail}
        placeholder="destinatario@dominio.com (opcional)"
        data-testid="anuncios-test-email-input"
      />
      <button
        type="button"
        class="btn-secondary"
        on:click={onSendTest}
        disabled={testSending}
        data-testid="anuncios-test-email-btn"
      >
        {testSending ? "Enviando…" : "Enviar prueba"}
      </button>
    </div>
    {#if testFeedback}
      <div class="feedback {testFeedbackType}" data-testid="anuncios-test-feedback">
        {testFeedback}
      </div>
    {/if}
  </section>

  <form class="card" on:submit|preventDefault={onSubmit} data-testid="anuncios-form">
    <h2>Nuevo anuncio</h2>

    <label>
      <span>Asunto *</span>
      <input
        type="text"
        bind:value={subject}
        minlength="3"
        maxlength="200"
        required
        placeholder="Asunto del anuncio"
        data-testid="anuncios-subject"
      />
    </label>

    <label>
      <span>Mensaje (HTML permitido) *</span>
      <textarea
        bind:value={messageHtml}
        rows="8"
        required
        placeholder="<p>Hola equipo...</p>"
        data-testid="anuncios-message"
      ></textarea>
    </label>

    <fieldset class="audience">
      <legend>Audiencia *</legend>
      <label class="radio">
        <input type="radio" bind:group={audienceType} value="all" />
        Todos los usuarios
      </label>
      <label class="radio">
        <input type="radio" bind:group={audienceType} value="lideres" />
        Solo líderes
      </label>
      <label class="radio">
        <input type="radio" bind:group={audienceType} value="grupo" />
        Por grupo:
        <input
          type="text"
          bind:value={grupoNombre}
          placeholder="nombre del grupo"
          disabled={audienceType !== "grupo"}
          data-testid="anuncios-grupo-nombre"
        />
      </label>
      <label class="radio">
        <input type="radio" bind:group={audienceType} value="emails" />
        Lista de emails (separados por coma):
      </label>
      {#if audienceType === "emails"}
        <textarea
          bind:value={emailsRaw}
          rows="3"
          placeholder="a@dominio.com, b@dominio.com"
          data-testid="anuncios-emails"
        ></textarea>
      {/if}
    </fieldset>

    <label>
      <span>Prioridad</span>
      <select bind:value={priority} data-testid="anuncios-priority">
        <option value="info">Información</option>
        <option value="warning">Advertencia</option>
        <option value="urgent">Urgente</option>
      </select>
    </label>

    <div class="row two-col">
      <label>
        <span>CTA URL (opcional)</span>
        <input type="url" bind:value={ctaUrl} placeholder="https://..." />
      </label>
      <label>
        <span>CTA Label (opcional)</span>
        <input type="text" bind:value={ctaLabel} placeholder="Ver detalles" />
      </label>
    </div>

    {#if sendError}
      <div class="feedback error" data-testid="anuncios-error">{sendError}</div>
    {/if}

    {#if lastResponse}
      <div class="feedback success" data-testid="anuncios-success">
        Anuncio encolado. Audiencia: <strong>{lastResponse.audience}</strong> ·
        Destinatarios: <strong>{lastResponse.recipients_count}</strong> · Estado:
        <strong>{lastResponse.status}</strong>
      </div>
    {/if}

    <div class="actions">
      <button
        type="submit"
        class="btn-primary"
        disabled={!canSubmit}
        data-testid="anuncios-submit"
      >
        {sending ? "Enviando…" : "Enviar anuncio"}
      </button>
    </div>
  </form>
</div>

<style>
  .anuncios-page {
    max-width: 880px;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .page-header h1 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-primary, #111827);
  }

  .subtitle {
    margin: 0.25rem 0 0;
    color: var(--text-muted, #6b7280);
    font-size: 0.95rem;
  }

  .card {
    background: var(--card-bg, #fff);
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .card h2 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text-primary, #111827);
  }

  .hint {
    margin: 0;
    color: var(--text-muted, #6b7280);
    font-size: 0.875rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.9rem;
    color: var(--text-primary, #111827);
  }

  label.radio {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    font-weight: 400;
  }

  input[type="text"],
  input[type="email"],
  input[type="url"],
  select,
  textarea {
    border: 1px solid var(--border, #d1d5db);
    border-radius: 8px;
    padding: 0.55rem 0.7rem;
    font-size: 0.95rem;
    font-family: inherit;
    background: #fff;
    color: var(--text-primary, #111827);
  }

  textarea {
    resize: vertical;
    min-height: 80px;
  }

  .row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .row > input,
  .row > select {
    flex: 1 1 220px;
  }

  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  @media (max-width: 560px) {
    .two-col {
      grid-template-columns: 1fr;
    }
  }

  fieldset.audience {
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 10px;
    padding: 0.75rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  fieldset.audience legend {
    padding: 0 0.4rem;
    font-size: 0.9rem;
    color: var(--text-primary, #111827);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  .btn-primary {
    background: var(--primary, #0d9488);
    color: #fff;
    border: 0;
    border-radius: 8px;
    padding: 0.6rem 1.1rem;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-primary:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: #fff;
    color: var(--primary, #0d9488);
    border: 1px solid var(--primary, #0d9488);
    border-radius: 8px;
    padding: 0.5rem 0.95rem;
    font-size: 0.9rem;
    cursor: pointer;
  }

  .btn-secondary:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .feedback {
    padding: 0.65rem 0.85rem;
    border-radius: 8px;
    font-size: 0.9rem;
  }

  .feedback.success {
    background: #ecfdf5;
    color: #065f46;
    border: 1px solid #a7f3d0;
  }

  .feedback.error {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }
</style>
