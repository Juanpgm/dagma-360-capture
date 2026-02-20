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
      <h1>DAGMA Parques</h1>
      <p>Verificación de Parques y Zonas Verdes</p>
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
    padding: 1rem;
    background: linear-gradient(135deg, #059669 0%, #047857 100%);
  }

  .login-card {
    background: white;
    border-radius: 1rem;
    padding: 2rem;
    width: 100%;
    max-width: 420px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .logo {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .logo h1 {
    color: var(--primary);
    font-size: 1.875rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
  }

  .logo p {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    overflow: hidden;
    margin-bottom: 1.5rem;
  }

  .tabs button {
    padding: 0.75rem 0.5rem;
    background: white;
    border: none;
    color: var(--text-secondary);
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tabs button.active {
    background: var(--surface);
    color: var(--primary-dark);
    border-bottom: 2px solid var(--primary);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  input {
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    font-size: 0.95rem;
    transition: all 0.2s;
    background: white;
  }

  .grupo-search {
    min-height: 40px;
    padding: 0.55rem 0.9rem;
    font-size: 0.875rem;
    background: var(--surface);
    border-color: var(--border);
  }

  .grupo-dropdown {
    position: relative;
  }

  .grupo-trigger {
    width: 100%;
    min-height: 44px;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: white;
    color: var(--text-primary);
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .grupo-trigger.placeholder {
    color: var(--text-secondary);
  }

  .grupo-trigger:disabled {
    background-color: var(--surface);
    cursor: not-allowed;
  }

  .grupo-trigger:focus,
  .grupo-trigger.is-open {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
  }

  .grupo-arrow {
    font-size: 0.9rem;
    color: var(--text-secondary);
    transition: transform 0.2s;
  }

  .grupo-arrow.rotate {
    transform: rotate(180deg);
  }

  .grupo-menu {
    position: absolute;
    z-index: 20;
    top: calc(100% + 0.4rem);
    left: 0;
    right: 0;
    border: 1px solid var(--border);
    border-radius: 0.6rem;
    background: white;
    box-shadow: 0 10px 24px rgba(5, 150, 105, 0.18);
    padding: 0.5rem;
  }

  .grupo-options {
    margin-top: 0.45rem;
    max-height: 180px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: white;
  }

  .grupo-option {
    width: 100%;
    text-align: left;
    background: white;
    border: none;
    padding: 0.55rem 0.75rem;
    color: var(--text-primary);
    font-size: 0.9rem;
    cursor: pointer;
  }

  .grupo-option:hover {
    background: var(--surface);
  }

  .grupo-option.selected {
    background: #dcfce7;
    color: var(--primary-dark);
    font-weight: 600;
  }

  .grupo-empty {
    padding: 0.7rem 0.75rem;
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
  }

  input:disabled {
    background-color: var(--surface);
    cursor: not-allowed;
  }

  .btn-primary {
    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
    color: white;
    padding: 0.9rem;
    border: none;
    border-radius: 0.6rem;
    font-weight: 700;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #047857 0%, #059669 100%);
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(5, 150, 105, 0.35);
  }

  .btn-primary:disabled {
    background-color: var(--secondary);
    cursor: not-allowed;
  }

  .error-message {
    background-color: #fee;
    color: var(--error);
    padding: 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    border: 1px solid var(--error);
  }

  .success-message {
    background-color: #ecfdf5;
    color: var(--primary-dark);
    padding: 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    border: 1px solid var(--border);
  }

  @media (max-width: 640px) {
    .login-card {
      padding: 1.5rem;
    }

    .logo h1 {
      font-size: 1.5rem;
    }
  }
</style>
