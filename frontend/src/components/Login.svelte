<script lang="ts">
  import { login } from "../api/auth";
  import { authStore } from "../stores/authStore";

  let username = "";
  let password = "";
  let error = "";
  let loading = false;

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    error = "";
    loading = true;

    try {
      console.log("🔑 Starting login process for:", username);
      const response = await login({ username, password });
      console.log("✅ Login response received:", {
        hasToken: !!response.access_token,
        hasUser: !!response.user,
      });
      authStore.login(response.access_token, response.user || { username });
      console.log("✅ Login completed successfully");
    } catch (err) {
      console.error("❌ Login failed:", err);
      error = err instanceof Error ? err.message : "Error al iniciar sesión";

      // Si el error es de Firebase, dar más contexto
      if (error.includes("auth/")) {
        error = `Error de Firebase: ${error}. Verifica que tu usuario esté registrado.`;
      }
    } finally {
      loading = false;
    }
  };
</script>

<div class="login-container">
  <div class="login-card">
    <div class="logo">
      <h1>DAGMA Parques</h1>
      <p>Verificación de Parques y Zonas Verdes</p>
    </div>

    <form on:submit={handleSubmit}>
      <div class="form-group">
        <label for="username">Usuario</label>
        <input
          id="username"
          type="text"
          bind:value={username}
          placeholder="Ingresa tu usuario"
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
          placeholder="Ingresa tu contraseña"
          required
          disabled={loading}
        />
      </div>

      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <button type="submit" class="btn-primary" disabled={loading}>
        {loading ? "Iniciando sesión..." : "Iniciar sesión"}
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
    max-width: 400px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .logo {
    text-align: center;
    margin-bottom: 2rem;
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

  form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 0.875rem;
  }

  input {
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    font-size: 1rem;
    transition: all 0.2s;
  }

  input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
  }

  input:disabled {
    background-color: var(--surface);
    cursor: not-allowed;
  }

  .btn-primary {
    background-color: var(--primary);
    color: white;
    padding: 0.875rem;
    border: none;
    border-radius: 0.5rem;
    font-weight: 600;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--primary-dark);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
  }

  .btn-primary:active:not(:disabled) {
    transform: translateY(0);
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

  @media (max-width: 640px) {
    .login-card {
      padding: 1.5rem;
    }

    .logo h1 {
      font-size: 1.5rem;
    }
  }
</style>
