<script lang="ts">
  export let title: string;
  export let value: string | number;
  export let subtitle: string = "";
  export let icon: string = "";
  export let trend: "up" | "down" | "neutral" | undefined = undefined;
  export let trendValue: string | undefined = undefined;
</script>

<div class="kpi-card">
  {#if icon}
    <div class="icon">
      {@html icon}
    </div>
  {/if}
  <div class="content">
    <div class="title">{title}</div>
    <div class="value">{value}</div>
    {#if subtitle}
      <div class="subtitle">{subtitle}</div>
    {/if}
    {#if trend && trendValue}
      <div
        class="trend"
        class:up={trend === "up"}
        class:down={trend === "down"}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          {#if trend === "up"}
            <path d="M6 2L10 8H2L6 2Z" fill="currentColor" />
          {:else if trend === "down"}
            <path d="M6 10L10 4H2L6 10Z" fill="currentColor" />
          {/if}
        </svg>
        {trendValue}
      </div>
    {/if}
  </div>
</div>

<style>
  .kpi-card {
    background: white;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    transition: box-shadow 0.2s;
  }

  .kpi-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .icon {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    background: linear-gradient(135deg, #059669 0%, #10b981 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .icon :global(svg) {
    width: 24px;
    height: 24px;
    color: white;
  }

  .content {
    flex: 1;
    min-width: 0;
  }

  .title {
    font-size: 0.875rem;
    color: #64748b;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .value {
    font-size: 1.875rem;
    font-weight: 700;
    color: #1e293b;
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .subtitle {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .trend {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    margin-top: 0.5rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .trend.up {
    color: #059669;
    background: #d1fae5;
  }

  .trend.down {
    color: #dc2626;
    background: #fee2e2;
  }

  @media (max-width: 640px) {
    .kpi-card {
      padding: 1rem;
    }

    .icon {
      width: 40px;
      height: 40px;
    }

    .value {
      font-size: 1.5rem;
    }
  }
</style>
