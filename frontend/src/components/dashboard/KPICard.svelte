<script lang="ts">
  export let title: string;
  export let value: string | number;
  export let subtitle: string = "";
  export let icon: string = "";
  export let trend: "up" | "down" | "neutral" | undefined = undefined;
  export let trendValue: string | undefined = undefined;
  // color: "green" | "blue" | "amber" | "purple" | "red" | "teal"
  export let color: string = "green";

  const gradients: Record<string, string> = {
    green:  "var(--green-50)",
    blue:   "var(--blue-50)",
    amber:  "var(--amber-50)",
    purple: "var(--purple-50)",
    red:    "var(--red-50)",
    teal:   "var(--teal-50)",
    indigo: "var(--indigo-50)",
  };
  const accents: Record<string, string> = {
    green:  "var(--green-50)",
    blue:   "var(--blue-50)",
    amber:  "var(--amber-50)",
    purple: "var(--purple-50)",
    red:    "var(--red-50)",
    teal:   "var(--teal-50)",
    indigo: "var(--indigo-50)",
  };
  const textAccents: Record<string, string> = {
    green:  "var(--green-700)",
    blue:   "var(--blue-600)",
    amber:  "var(--amber-600)",
    purple: "var(--purple-600)",
    red:    "var(--red-600)",
    teal:   "var(--teal-600)",
    indigo: "var(--indigo-600)",
  };

  $: gradient = gradients[color] ?? gradients.green;
  $: accent = accents[color] ?? accents.green;
  $: textAccent = textAccents[color] ?? textAccents.green;
</script>

<div class="kpi-card" style="--accent: {accent}; --text-accent: {textAccent};">
  {#if icon}
    <div class="icon" style="background: {gradient};">
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
        class:neutral={trend === "neutral"}
      >
        {#if trend === "up"}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2L10 8H2L6 2Z" fill="currentColor" /></svg>
        {:else if trend === "down"}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 10L10 4H2L6 10Z" fill="currentColor" /></svg>
        {:else}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="5" width="8" height="2" fill="currentColor" rx="1"/></svg>
        {/if}
        {trendValue}
      </div>
    {/if}
  </div>
</div>

<style>
  .kpi-card {
    background: var(--surface);
    border-radius: var(--radius-md);
    padding: 10px 14px;
    box-shadow: none;
    border: 1px solid var(--border-light);
    border-top: 2px solid var(--text-accent);
    display: flex;
    gap: 10px;
    align-items: center;
    transition: box-shadow var(--transition), border-color var(--transition);
  }

  .kpi-card:hover {
    box-shadow: var(--shadow-sm);
    border-top-color: var(--text-accent);
  }

  .icon {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    background: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .icon :global(svg) {
    width: 15px;
    height: 15px;
    color: var(--text-accent);
    stroke: var(--text-accent);
  }

  .content {
    flex: 1;
    min-width: 0;
  }

  .title {
    font-size: var(--text-2xs);
    color: var(--text-muted);
    margin-bottom: 1px;
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .value {
    font-size: var(--text-lg);
    font-weight: var(--font-weight-bold);
    color: var(--slate-800);
    line-height: var(--leading-tight);
    letter-spacing: -0.01em;
  }

  .subtitle {
    font-size: var(--text-2xs);
    color: var(--text-muted);
    margin-top: 1px;
  }

  .trend {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: var(--text-2xs);
    font-weight: var(--font-weight-semibold);
    margin-top: 3px;
    padding: 1px 5px;
    border-radius: var(--radius-full);
  }

  .trend.up   { color: var(--green-700); background: var(--green-100); }
  .trend.down { color: var(--red-600);   background: var(--red-50); }
  .trend.neutral { color: var(--slate-500); background: var(--slate-100); }

  @media (max-width: 640px) {
    .kpi-card { padding: 8px 12px; }
    .icon { width: 28px; height: 28px; }
    .value { font-size: var(--text-base); }
  }
</style>
