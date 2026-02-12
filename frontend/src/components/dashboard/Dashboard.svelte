<script lang="ts">
    import { onMount } from "svelte";
    import Card from "../ui/Card.svelte";
    import Button from "../ui/Button.svelte";
    import { visitaStore } from "../../stores/visitaStore";

    // Event dispatchers para navegación
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();

    let stats = {
        visitasHoy: 0,
        visitasMes: 0,
    };

    $: recentActivity = $visitaStore.reportes || [];
    let isLoadingActivity = true;

    onMount(async () => {
        // Intentar cargar reportes reales
        try {
            await visitaStore.loadReportes();
            isLoadingActivity = false;
        } catch (e) {
            console.error("Error cargando actividad reciente", e);
            isLoadingActivity = false;
        }

        // Simulación de estadísticas (esto podría venir del backend también)
        setTimeout(() => {
            stats = { visitasHoy: 2, visitasMes: 15 };
        }, 500);
    });

    function goToNewVisit() {
        dispatch("navigate", "formulario");
    }

    function goToHistory() {
        dispatch("navigate", "historial");
    }

    function getGreeting() {
        const hour = new Date().getHours();
        if (hour < 12) return "Buenos días";
        if (hour < 18) return "Buenas tardes";
        return "Buenas noches";
    }
</script>

<div class="dashboard-container">
    <!-- Header Section -->
    <header class="dashboard-header">
        <div class="header-content">
            <h1 class="greeting">{getGreeting()}, Operador</h1>
            <p class="date">
                {new Date().toLocaleDateString("es-CO", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                })}
            </p>
        </div>
        <!-- User Avatar/Profile placeholder could go here -->
    </header>

    <!-- Stats Grid -->
    <section class="stats-grid">
        <div class="stat-card">
            <div class="stat-icon">📅</div>
            <div class="stat-info">
                <span class="stat-value">{stats.visitasHoy}</span>
                <span class="stat-label">Visitas Hoy</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-info">
                <span class="stat-value">{stats.visitasMes}</span>
                <span class="stat-label">Total Mes</span>
            </div>
        </div>
    </section>

    <!-- Main Actions -->
    <section class="actions-section">
        <h2 class="section-title">Acciones Rápidas</h2>
        <div class="actions-grid">
            <button class="action-btn primary" on:click={goToNewVisit}>
                <span class="action-icon">➕</span>
                <span class="action-text">Nueva Visita</span>
            </button>
            <button class="action-btn secondary" on:click={goToHistory}>
                <span class="action-icon">📂</span>
                <span class="action-text">Historial</span>
            </button>
        </div>
    </section>

    <!-- Recent Activity -->
    <section class="activity-section">
        <div class="section-header">
            <h2 class="section-title">Actividad Reciente</h2>
            <button class="link-btn" on:click={goToHistory}>Ver todo</button>
        </div>

        {#if isLoadingActivity}
            <div class="loading-state">Cargando actividad...</div>
        {:else if recentActivity.length > 0}
            <div class="activity-list">
                <!-- Iterar reportes aquí -->
            </div>
        {:else}
            <div class="empty-state">
                <p>No hay actividad reciente registrada.</p>
            </div>
        {/if}
    </section>
</div>

<style>
    .dashboard-container {
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 2rem;
        background: #f8fafc;
        min-height: 100vh;
    }

    .dashboard-header {
        margin-bottom: 0.5rem;
    }

    .greeting {
        font-size: 1.5rem;
        font-weight: 700;
        color: #1e293b;
        margin: 0;
    }

    .date {
        color: #64748b;
        margin: 0.25rem 0 0 0;
        text-transform: capitalize;
    }

    /* Stats */
    .stats-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
    }

    .stat-card {
        background: white;
        padding: 1.25rem;
        border-radius: 12px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        display: flex;
        align-items: center;
        gap: 1rem;
    }

    .stat-icon {
        font-size: 1.5rem;
        background: #eff6ff;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
    }

    .stat-info {
        display: flex;
        flex-direction: column;
    }

    .stat-value {
        font-size: 1.25rem;
        font-weight: 700;
        color: #1e293b;
    }

    .stat-label {
        font-size: 0.75rem;
        color: #64748b;
    }

    /* Actions */
    .section-title {
        font-size: 1.125rem;
        font-weight: 600;
        color: #334155;
        margin-bottom: 1rem;
    }

    .actions-grid {
        display: grid;
        grid-template-columns: 1fr; /* Full width on mobile */
        gap: 1rem;
    }

    .action-btn {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1.25rem;
        border: none;
        border-radius: 12px;
        cursor: pointer;
        transition: transform 0.2s;
        text-align: left;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

    .action-btn:active {
        transform: scale(0.98);
    }

    .action-btn.primary {
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
        color: white;
    }

    .action-btn.secondary {
        background: white;
        color: #1e293b;
        border: 1px solid #e2e8f0;
    }

    .action-icon {
        font-size: 1.5rem;
    }

    .action-text {
        font-size: 1.125rem;
        font-weight: 600;
    }

    /* Activity */
    .activity-section {
        background: white;
        padding: 1.25rem;
        border-radius: 16px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .section-header .section-title {
        margin: 0;
    }

    .link-btn {
        background: none;
        border: none;
        color: #2563eb;
        font-weight: 500;
        cursor: pointer;
        font-size: 0.875rem;
    }

    .empty-state {
        text-align: center;
        color: #94a3b8;
        padding: 2rem 0;
    }

    @media (min-width: 640px) {
        .actions-grid {
            grid-template-columns: 1fr 1fr;
        }
    }
</style>
