<script lang="ts">
  import SeguimientoReconocimientos from './SeguimientoReconocimientos.svelte';

  let scrollY = 0;
  $: showScrollTop = scrollY > 200;

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
</script>

<svelte:window bind:scrollY />

<div class="view">
  <div class="reconoc-container">
    <SeguimientoReconocimientos />
  </div>

  {#if showScrollTop}
    <button class="scroll-top-btn" on:click={scrollToTop} aria-label="Volver arriba">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="18 15 12 9 6 15"/>
      </svg>
    </button>
  {/if}
</div>

<style>
  .view {
    min-height: 100vh;
    background: #f1f5f9;
    display: flex;
    flex-direction: column;
  }

  .reconoc-container {
    flex: 1;
    max-width: 800px;
    width: 100%;
    margin: 0 auto;
    padding: 1.5rem 1rem 3rem;
  }

  .scroll-top-btn {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--primary, #059669);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-md, 0 4px 6px -1px rgba(0,0,0,0.1));
    z-index: 300;
    transition: background 150ms ease, transform 150ms ease;
  }

  .scroll-top-btn:hover {
    background: var(--primary-dark, #047857);
    transform: translateY(-2px);
  }

  .scroll-top-btn:active {
    transform: translateY(0);
  }
</style>