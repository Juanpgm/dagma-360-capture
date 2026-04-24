<script lang="ts">
  import { onMount } from "svelte";
  import { login, registerUser, loginWithGoogle, sendPasswordReset, NeedsProfileCompletionError, type PartialGoogleUser } from "../api/auth";
  import { getGruposNombres } from "../lib/grupos";
  import { authStore } from "../stores/authStore";
  import CompleteProfileModal from "./auth/CompleteProfileModal.svelte";

  type AuthMode = "login" | "register";

  let grupos: string[] = [];

  let mode: AuthMode = "login";
  let email = "";
  let password = "";
  let confirmPassword = "";
  let fullName = "";
  let cellphone = "";
  let grupo = "";
  let grupoSearch = "";
  let isGrupoOpen = false;
  let grupoDropdownRef: HTMLDivElement;
  let error = "";
  let success = "";
  let loading = false;
  let loadingGrupos = false;

  // Forgot password
  let showForgotPassword = false;
  let forgotEmail = "";
  let forgotLoading = false;
  let forgotError = "";
  let forgotSuccess = "";

  // Google profile completion
  let pendingGoogleUser: PartialGoogleUser | null = null;

  onMount(async () => {
    loadingGrupos = true;
    try {
      grupos = await getGruposNombres();
    } catch (err) {
      console.error("Error al cargar grupos:", err);
      grupos = [];
    } finally {
      loadingGrupos = false;
    }
  });

  const normalizeText = (value: string): string =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  $: filteredGrupos = grupos.filter((item) =>
    normalizeText(item).includes(normalizeText(grupoSearch.trim())),
  );
  $: visibleGrupos =
    grupo && !filteredGrupos.includes(grupo)
      ? [grupo, ...filteredGrupos]
      : filteredGrupos;

  $: selectedGrupoLabel = grupo || "Selecciona un grupo";

  const toggleGrupoDropdown = () => {
    if (loading) return;
    isGrupoOpen = !isGrupoOpen;
    if (isGrupoOpen) {
      grupoSearch = "";
    }
  };

  const selectGrupo = (value: string) => {
    grupo = value;
    isGrupoOpen = false;
    grupoSearch = "";
  };

  const closeGrupoDropdown = (event: MouseEvent) => {
    if (grupoDropdownRef && !grupoDropdownRef.contains(event.target as Node)) {
      isGrupoOpen = false;
    }
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    error = "";
    success = "";
    loading = true;

    try {
      if (mode === "login") {
        const response = await login({ username: email, password });
        authStore.login(response.access_token, response.user || { email });
        return;
      }

      if (password !== confirmPassword) {
        throw new Error("Las contraseñas no coinciden");
      }

      if (!grupo) {
        throw new Error("Debes seleccionar un grupo");
      }

      await registerUser({
        email,
        password,
        full_name: fullName,
        cellphone,
        grupo,
        rol: "Operador",
      });

      success = "Registro exitoso. Iniciando sesión...";
      const response = await login({ username: email, password });
      authStore.login(response.access_token, response.user || { email });
    } catch (err) {
      error = err instanceof Error ? err.message : "Error en autenticación";
    } finally {
      loading = false;
    }
  };

  const handleGoogleLogin = async () => {
    error = "";
    loading = true;
    try {
      const response = await loginWithGoogle();
      authStore.login(response.access_token, response.user || {});
    } catch (err) {
      if (err instanceof NeedsProfileCompletionError) {
        pendingGoogleUser = err.partialUser;
      } else {
        error = err instanceof Error ? err.message : "Error al iniciar sesión con Google";
      }
    } finally {
      loading = false;
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) {
      forgotError = "Ingresa tu correo electrónico";
      return;
    }
    forgotLoading = true;
    forgotError = "";
    forgotSuccess = "";
    try {
      await sendPasswordReset(forgotEmail.trim());
      forgotSuccess = "Correo de recuperación enviado. Revisa tu bandeja de entrada.";
    } catch (err) {
      forgotError = err instanceof Error ? err.message : "Error al enviar el correo";
    } finally {
      forgotLoading = false;
    }
  };

  const handleProfileCompleted = (e: CustomEvent) => {
    const response = e.detail;
    pendingGoogleUser = null;
    authStore.login(response.access_token, response.user || {});
  };

  const switchMode = (nextMode: AuthMode) => {
    mode = nextMode;
    error = "";
    success = "";
    if (nextMode === "login") {
      fullName = "";
      cellphone = "";
      grupo = "";
      grupoSearch = "";
      isGrupoOpen = false;
      confirmPassword = "";
    }
  };
</script>

<svelte:window on:click={closeGrupoDropdown} />

<div class="login-container">
  <div class="login-card">
    <div class="logo">
      <img src="/dagma_logo/dagma-seeklogo.png" alt="Logo oficial DAGMA" />
    </div>

    <div class="tabs">
      <button
        class:active={mode === "login"}
        type="button"
        on:click={() => switchMode("login")}
      >
        Iniciar sesión
      </button>
      <button
        class:active={mode === "register"}
        type="button"
        on:click={() => switchMode("register")}
      >
        Registrarse
      </button>
    </div>

    <form on:submit={handleSubmit}>
      {#if mode === "register"}
        <div class="form-group">
          <label for="fullName">Nombre completo</label>
          <input
            id="fullName"
            type="text"
            bind:value={fullName}
            placeholder="Tu nombre completo"
            required
            disabled={loading}
          />
        </div>

        <div class="form-group">
          <label for="cellphone">Teléfono celular</label>
          <input
            id="cellphone"
            type="tel"
            bind:value={cellphone}
            placeholder="3001234567"
            required
            disabled={loading}
          />
        </div>

        <div class="form-group">
          <label for="grupo">Grupo</label>
          <div class="grupo-dropdown" bind:this={grupoDropdownRef}>
            <button
              id="grupo"
              type="button"
              class="grupo-trigger"
              class:is-open={isGrupoOpen}
              class:placeholder={!grupo}
              disabled={loading}
              on:click|stopPropagation={toggleGrupoDropdown}
            >
              <span>{selectedGrupoLabel}</span>
              <span class="grupo-arrow" class:rotate={isGrupoOpen}>⌄</span>
            </button>

            {#if isGrupoOpen}
              <div class="grupo-menu">
                <input
                  id="grupoSearch"
                  type="search"
                  class="grupo-search"
                  bind:value={grupoSearch}
                  placeholder="Buscar grupo..."
                  disabled={loading}
                />

                <div class="grupo-options">
                  {#if visibleGrupos.length === 0}
                    <div class="grupo-empty">No hay grupos que coincidan</div>
                  {:else}
                    {#each visibleGrupos as item}
                      <button
                        type="button"
                        class="grupo-option"
                        class:selected={grupo === item}
                        on:click={() => selectGrupo(item)}
                      >
                        {item}
                      </button>
                    {/each}
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      <div class="form-group">
        <label for="email">Correo electrónico</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          placeholder="tu.email@cali.gov.co"
          required
          disabled={loading}
        />
      </div>

      <div class="form-group">
        <label for="password">Contraseña</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          placeholder="••••••••"
          required
          disabled={loading}
        />
      </div>

      {#if mode === "register"}
        <div class="form-group">
          <label for="confirmPassword">Confirmar contraseña</label>
          <input
            id="confirmPassword"
            type="password"
            bind:value={confirmPassword}
            placeholder="••••••••"
            required
            disabled={loading}
          />
        </div>
      {/if}

      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      {#if success}
        <div class="success-message">{success}</div>
      {/if}

      <button type="submit" class="btn-primary" disabled={loading}>
        {#if loading}
          {mode === "login" ? "Iniciando sesión..." : "Registrando..."}
        {:else}
          {mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
        {/if}
      </button>

      {#if mode === "login"}
        <!-- Separador -->
        <div class="divider"><span>o continúa con</span></div>

        <!-- Google -->
        <button type="button" class="btn-google" on:click={handleGoogleLogin} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuar con Google
        </button>

        <!-- Forgot password -->
        {#if !showForgotPassword}
          <button type="button" class="btn-forgot" on:click={() => { showForgotPassword = true; forgotEmail = email; forgotError = ''; forgotSuccess = ''; }}>
            ¿Olvidaste tu contraseña?
          </button>
        {:else}
          <div class="forgot-panel">
            <p class="forgot-title">Recuperar contraseña</p>
            <input
              class="forgot-input"
              type="email"
              bind:value={forgotEmail}
              placeholder="tu.email@cali.gov.co"
              disabled={forgotLoading}
            />
            {#if forgotError}<div class="forgot-error">{forgotError}</div>{/if}
            {#if forgotSuccess}<div class="forgot-success">{forgotSuccess}</div>{/if}
            <div class="forgot-actions">
              <button type="button" class="btn-forgot-cancel" on:click={() => (showForgotPassword = false)} disabled={forgotLoading}>
                Cancelar
              </button>
              <button type="button" class="btn-forgot-send" on:click={handleForgotPassword} disabled={forgotLoading}>
                {forgotLoading ? "Enviando..." : "Enviar correo"}
              </button>
            </div>
          </div>
        {/if}
      {/if}
    </form>
  </div>
</div>

<!-- Modal de completar perfil Google -->
{#if pendingGoogleUser}
  <CompleteProfileModal
    partialUser={pendingGoogleUser}
    on:completed={handleProfileCompleted}
    on:cancel={() => { pendingGoogleUser = null; }}
  />
{/if}

<style>
  .login-container {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    background: var(--background);
  }

  .login-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 2.5rem 2rem;
    width: 100%;
    max-width: 400px;
    box-shadow: var(--shadow-lg);
  }

  .logo {
    text-align: center;
    margin-bottom: 2rem;
  }

  .logo img {
    width: min(240px, 100%);
    height: auto;
    max-height: 72px;
    object-fit: contain;
  }

  .tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: var(--surface-alt);
    border-radius: var(--radius);
    padding: 3px;
    margin-bottom: 1.5rem;
  }

  .tabs button {
    padding: 0.625rem 0.5rem;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-weight: 500;
    font-size: 0.8125rem;
    cursor: pointer;
    border-radius: calc(var(--radius) - 2px);
    transition: all var(--transition);
  }

  .tabs button.active {
    background: var(--surface);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  label {
    font-weight: 500;
    color: var(--text-secondary);
    font-size: 0.8125rem;
  }

  input {
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 0.875rem;
    background: var(--surface);
    transition: all var(--transition);
  }

  .grupo-search {
    min-height: 40px;
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    background: var(--surface-alt);
    border-color: var(--border);
  }

  .grupo-dropdown {
    position: relative;
  }

  .grupo-trigger {
    width: 100%;
    min-height: 44px;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text-primary);
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    cursor: pointer;
    transition: all var(--transition);
  }

  .grupo-trigger.placeholder {
    color: var(--text-muted);
  }

  .grupo-trigger:disabled {
    background-color: var(--surface-alt);
    cursor: not-allowed;
  }

  .grupo-trigger:focus,
  .grupo-trigger.is-open {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
  }

  .grupo-arrow {
    font-size: 0.8rem;
    color: var(--text-muted);
    transition: transform var(--transition);
  }

  .grupo-arrow.rotate {
    transform: rotate(180deg);
  }

  .grupo-menu {
    position: absolute;
    z-index: 20;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-lg);
    padding: 0.375rem;
  }

  .grupo-options {
    margin-top: 0.375rem;
    max-height: 180px;
    overflow-y: auto;
    border-radius: calc(var(--radius) - 2px);
  }

  .grupo-option {
    width: 100%;
    text-align: left;
    background: transparent;
    border: none;
    padding: 0.5rem 0.625rem;
    color: var(--text-primary);
    font-size: 0.8125rem;
    cursor: pointer;
    border-radius: calc(var(--radius-sm) - 2px);
  }

  .grupo-option:hover {
    background: var(--surface-alt);
  }

  .grupo-option.selected {
    background: rgba(5, 150, 105, 0.08);
    color: var(--primary-dark);
    font-weight: 500;
  }

  .grupo-empty {
    padding: 0.625rem;
    color: var(--text-muted);
    font-size: 0.8125rem;
  }

  input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.1);
  }

  input:disabled {
    background-color: var(--surface-alt);
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--primary);
    color: white;
    padding: 0.75rem;
    border: none;
    border-radius: var(--radius);
    font-weight: 600;
    font-size: 0.875rem;
    transition: all var(--transition);
    margin-top: 0.25rem;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--primary-dark);
    box-shadow: var(--shadow-md);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-message {
    background-color: rgba(220, 38, 38, 0.04);
    color: var(--error);
    padding: 0.625rem 0.75rem;
    border-radius: var(--radius);
    font-size: 0.8125rem;
    border: 1px solid rgba(220, 38, 38, 0.15);
  }

  .success-message {
    background-color: rgba(5, 150, 105, 0.04);
    color: var(--primary-dark);
    padding: 0.625rem 0.75rem;
    border-radius: var(--radius);
    font-size: 0.8125rem;
    border: 1px solid rgba(5, 150, 105, 0.15);
  }

  @media (max-width: 640px) {
    .login-card {
      padding: 1.5rem;
      border: none;
      box-shadow: none;
      background: transparent;
    }
  }

  /* Google + Forgot password */
  .divider {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin: 0.875rem 0 0.625rem;
    color: var(--text-muted);
    font-size: 0.75rem;
  }

  .divider::before,
  .divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  .btn-google {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    padding: 0.625rem;
    border: 1.5px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
    cursor: pointer;
    transition: all var(--transition);
  }

  .btn-google:hover:not(:disabled) {
    background: var(--surface-alt);
    border-color: #aaa;
  }

  .btn-google:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-forgot {
    display: block;
    width: 100%;
    margin-top: 0.5rem;
    background: none;
    border: none;
    color: var(--primary);
    font-size: 0.8125rem;
    cursor: pointer;
    text-align: center;
    padding: 0.375rem;
    border-radius: var(--radius-sm);
    transition: color var(--transition);
  }

  .btn-forgot:hover { color: var(--primary-dark); text-decoration: underline; }

  .forgot-panel {
    margin-top: 0.75rem;
    padding: 0.875rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface-alt);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .forgot-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0;
  }

  .forgot-input {
    width: 100%;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 0.8125rem;
    background: var(--surface);
    color: var(--text-primary);
  }

  .forgot-error {
    font-size: 0.75rem;
    color: var(--error);
  }

  .forgot-success {
    font-size: 0.75rem;
    color: var(--primary-dark);
  }

  .forgot-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 0.25rem;
  }

  .btn-forgot-cancel {
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .btn-forgot-send {
    background: var(--primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    transition: background var(--transition);
  }

  .btn-forgot-send:hover:not(:disabled) { background: var(--primary-dark); }
  .btn-forgot-send:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
