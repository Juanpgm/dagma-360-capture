<script lang="ts">
    import { onMount } from "svelte";
    import { createEventDispatcher } from "svelte";
    import { obtenerReportes, type ReporteIntervencion } from "../../api/visitas";
    import { GRUPO_KEYS } from "../../lib/grupos";
    import ReportCard from "./ReportCard.svelte";
    import Button from "../ui/Button.svelte";

    const dispatch = createEventDispatcher();

    let reportes: ReporteIntervencion[] = [];
    let isLoading = true;
    let error: string | null = null;
    let searchTerm = "";

    onMount(async () => {
        await loadData();
    });

    async function loadData() {
        isLoading = true;
        error = null;
        try {
            const resultados = await Promise.allSettled(
                GRUPO_KEYS.map((key) => obtenerReportes(key))
            );
            const todos: ReporteIntervencion[] = [];
            resultados.forEach((r: PromiseSettledResult<any>) => {
                if (r.status === "fulfilled" && r.value?.data) {
                    todos.push(...r.value.data);
                }
            });
            reportes = todos;
            if (reportes.length === 0) {
                error = "No hay reportes disponibles.";
            }
        } catch (e) {
            error = "Error de conexión al cargar el historial.";
        } finally {
            isLoading = false;
        }
    }

    function handleBack() {
        dispatch("navigate", "dashboard");
    }

    $: filteredReportes = reportes.filter((r) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            (r.direccion && r.direccion.toLowerCase().includes(term)) ||
            (r.tipo_intervencion &&
                r.tipo_intervencion.toLowerCase().includes(term)) ||
            (r.descripcion_intervencion && r.descripcion_intervencion.toLowerCase().includes(term))
        );
    });
</script>

<div class="history-container">
    <!-- Header -->
    <div class="history-header">
        <button class="back-btn" on:click={handleBack}>←</button>
        <h2 class="header-title">Historial de Visitas</h2>
    </div>

    <!-- Search -->
    <div class="search-section">
        <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input
                type="text"
                placeholder="Buscar por parque, tipo o dirección..."
                bind:value={searchTerm}
                class="search-input"
            />
        </div>
    </div>

    <!-- Content -->
    <div class="history-content">
        {#if isLoading}
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando historial...</p>
            </div>
        {:else if error}
            <div class="error-state">
                <p>{error}</p>
                <Button size="sm" onClick={loadData}>Reintentar</Button>
            </div>
        {:else if filteredReportes.length === 0}
            <div class="empty-state">
                <p class="empty-icon">📂</p>
                {#if searchTerm}
                    <p>No se encontraron resultados para "{searchTerm}"</p>
                {:else}
                    <p>Aún no hay reportes registrados.</p>
                {/if}
            </div>
        {:else}
            <div class="list-container">
                {#each filteredReportes as reporte (reporte.id)}
                    <ReportCard {reporte} />
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .history-container {
        min-height: 100vh;
        background: #f8fafc;
        display: flex;
        flex-direction: column;
    }

    .history-header {
        background: white;
        padding: 1rem;
        display: flex;
        align-items: center;
        gap: 1rem;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        position: sticky;
        top: 0;
        z-index: 10;
    }

    .back-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #475569;
        padding: 0 0.5rem;
    }

    .header-title {
        margin: 0;
        font-size: 1.125rem;
        color: #1e293b;
        font-weight: 600;
    }

    .search-section {
        padding: 1rem;
        background: white;
        border-bottom: 1px solid #f1f5f9;
    }

    .search-input-wrapper {
        position: relative;
    }

    .search-icon {
        position: absolute;
        left: 1rem;
        top: 50%;
        transform: translateY(-50%);
        color: #94a3b8;
    }

    .search-input {
        width: 100%;
        padding: 0.75rem 1rem 0.75rem 2.5rem;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: #f8fafc;
        font-size: 0.9375rem;
    }

    .history-content {
        flex: 1;
        padding: 1rem;
    }

    .list-container {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .loading-state,
    .error-state,
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 3rem 1rem;
        color: #64748b;
        gap: 1rem;
        text-align: center;
    }

    .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #e2e8f0;
        border-top-color: #2563eb;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .empty-icon {
        font-size: 3rem;
        margin: 0;
        opacity: 0.5;
    }
</style>
