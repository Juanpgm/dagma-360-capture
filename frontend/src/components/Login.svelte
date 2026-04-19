<script lang="ts">
  import { login, registerUser } from "../api/auth";
  import { GRUPOS_DAGMA } from "../lib/grupos";
  import { authStore } from "../stores/authStore";

  type AuthMode = "login" | "register";

  const grupos: string[] = [...GRUPOS_DAGMA];

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
    </form>
  </div>
</div>

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
</style>
