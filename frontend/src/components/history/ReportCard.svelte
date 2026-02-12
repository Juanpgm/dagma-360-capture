<script lang="ts">
    import type { Reporte } from "../../types/visitas";

    export let reporte: Reporte;

    function formatDate(dateString: string) {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString("es-CO", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    }

    // Mapeo de iconos por tipo (puedes expandir esto)
    function getIcon(type: string) {
        if (type.includes("Mantenimiento")) return "🔧";
        if (type.includes("Limpieza")) return "🧹";
        if (type.includes("Poda")) return "🌳";
        return "📋";
    }
</script>

<div class="report-card">
    <div class="card-icon">
        {getIcon(reporte.tipo_intervencion)}
    </div>

    <div class="card-content">
        <div class="card-header">
            <h3 class="card-title">
                {reporte.nombre_parque || "Parque sin nombre"}
            </h3>
            <span class="card-date">{formatDate(reporte.fecha_registro)}</span>
        </div>

        <div class="card-details">
            <span class="badge-type">{reporte.tipo_intervencion}</span>
            <span class="location-text">📍 {reporte.direccion}</span>
        </div>

        <!-- Si quisieras mostrar 'estado' aquí, se podría agregar un badge -->
    </div>

    <div class="card-arrow">→</div>
</div>

<style>
    .report-card {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background: white;
        border: 1px solid #f1f5f9;
        border-radius: 12px;
        margin-bottom: 0.75rem;
        transition: all 0.2s ease;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
    }

    .report-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 12px rgba(0, 0, 0, 0.05);
        border-color: #cbd5e1;
    }

    .card-icon {
        width: 48px;
        height: 48px;
        background: #f8fafc;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        flex-shrink: 0;
    }

    .card-content {
        flex: 1;
        min-width: 0; /* Prevent text overflow */
    }

    .card-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 0.25rem;
    }

    .card-title {
        font-size: 1rem;
        font-weight: 600;
        color: #1e293b;
        margin: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .card-date {
        font-size: 0.75rem;
        color: #94a3b8;
        flex-shrink: 0;
    }

    .card-details {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-items: center;
    }

    .badge-type {
        background: #e0f2fe;
        color: #0369a1;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.125rem 0.5rem;
        border-radius: 4px;
    }

    .location-text {
        font-size: 0.8125rem;
        color: #64748b;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .card-arrow {
        color: #cbd5e1;
        font-size: 1.25rem;
    }
</style>
