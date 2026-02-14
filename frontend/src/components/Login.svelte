<script lang="ts">
  import { login, registerUser } from "../api/auth";
  import { authStore } from "../stores/authStore";

  type AuthMode = "login" | "register";

  const grupos = [
    "Reacción",
    "Acústica",
    "Residuos Sólidos",
    "Cuadrilla",
    "Fauna",
    "Vivero",
    "IEC-Gobernanza",
    "Ecourbanismo",
    "IVC",
    "Hídrico",
    "PSA",
    "Gestión del riesgo",
    "Cambio Climático",
  ];

  let mode: AuthMode = "login";
  let email = "";
  let password = "";
  let confirmPassword = "";
  let fullName = "";
  let cellphone = "";
  let grupo = "";
  let error = "";
  let success = "";
  let loading = false;

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

      await registerUser({
        email,
        password,
        full_name: fullName,
        cellphone,
        grupo,
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
      confirmPassword = "";
    }
  };
</script>

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
          <select id="grupo" bind:value={grupo} required disabled={loading}>
            <option value="">Selecciona un grupo</option>
            {#each grupos as item}
              <option value={item}>{item}</option>
            {/each}
          </select>
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

  input,
  select {
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    font-size: 0.95rem;
    transition: all 0.2s;
    background: white;
  }

  input:focus,
  select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(5, 150, 105, 0.12);
  }

  input:disabled,
  select:disabled {
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
