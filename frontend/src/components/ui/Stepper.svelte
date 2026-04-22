<script lang="ts">
  import type { StepNumber } from "../../types/visitas";

  export let currentStep: StepNumber;
  export let steps: string[];
  export let completedSteps: Set<StepNumber>;
  export let onStepClick: ((step: StepNumber) => void) | undefined = undefined;

  // Convertir Set a Array para reactividad
  $: completedStepsArray = Array.from(completedSteps);

  // Debug logs
  $: console.log(
    "Stepper - currentStep:",
    currentStep,
    "completedSteps:",
    completedStepsArray,
  );

  // Precalcular estados de forma reactiva
  $: stepStatuses = steps.map((_, index) => {
    const stepNumber = (index + 1) as StepNumber;

    if (completedStepsArray.includes(stepNumber)) return "completed";
    if (stepNumber === currentStep) return "current";
    return "pending";
  });

  $: console.log("stepStatuses:", stepStatuses);

  function handleStepClick(stepNumber: number) {
    if (onStepClick && stepNumber <= currentStep) {
      onStepClick(stepNumber as StepNumber);
    }
  }
</script>

<div class="stepper-container">
  <!-- Progreso visual superior -->
  <div class="progress-bar">
    <div
      class="progress-fill"
      style="width: {steps.length > 1
        ? ((currentStep - 1) / (steps.length - 1)) * 100
        : 0}%"
    />
  </div>

  <!-- Steps -->
  <div class="steps-wrapper">
    {#each steps as step, index}
      {@const status = stepStatuses[index]}

      <button
        type="button"
        class="step-item"
        class:completed={status === "completed"}
        class:current={status === "current"}
        class:clickable={index + 1 <= currentStep}
        on:click={() => handleStepClick(index + 1)}
      >
        <div class="step-indicator">
          {#if status === "completed"}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          {:else}
            <span class="step-number">{index + 1}</span>
          {/if}
        </div>

        <span class="step-label">{step}</span>
      </button>

      {#if index < steps.length - 1}
        <div class="step-connector" class:active={index + 1 < currentStep} />
      {/if}
    {/each}
  </div>
</div>

<style>
  .stepper-container {
    width: 100%;
    max-width: 600px; /* Proporcional al formulario */
    margin: 0 auto;
    padding: 0.5rem 0;
  }

  /* Barra de progreso superior */
  .progress-bar {
    width: 100%;
    height: 6px; /* Un poco más visible */
    background: var(--border);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 1rem;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(
      90deg,
      var(--primary) 0%,
      var(--secondary) 100%
    );
    transition: width 0.3s ease;
    box-shadow: 0 0 8px var(--shadow);
  }

  /* Steps */
  .steps-wrapper {
    display: flex;
    align-items: center;
    justify-content: space-between;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    gap: 0.5rem;
    padding: 0.25rem;
    /* Ocultar scrollbar pero permitir scroll */
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
  }

  .steps-wrapper::-webkit-scrollbar {
    display: none; /* Chrome/Safari */
  }

  .step-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    background: none;
    border: none;
    cursor: default;
    flex-shrink: 0;
    min-width: 40px;
    padding: 0.125rem;
    transition: opacity 0.2s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .step-item.clickable {
    cursor: pointer;
  }

  .step-item.clickable:hover {
    opacity: 0.8;
  }

  .step-indicator {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--border);
    color: var(--text-secondary);
    font-weight: 700;
    font-size: 0.8125rem;
    transition: all 0.3s ease;
    border: 2px solid transparent;
  }

  .step-item.current .step-indicator {
    background: linear-gradient(
      135deg,
      var(--primary) 0%,
      var(--primary-dark) 100%
    );
    color: white;
    box-shadow: 0 0 0 2px var(--shadow);
    transform: scale(1.1);
    border-color: white;
  }

  .step-item.completed .step-indicator {
    background: var(--success);
    color: white;
    border-color: var(--primary-dark);
  }

  .step-label {
    font-size: 0.625rem;
    color: var(--text-secondary);
    font-weight: 500;
    text-align: center;
    max-width: 60px;
    line-height: 1.1;
  }

  .step-item.current .step-label {
    color: var(--primary);
    font-weight: 700;
  }

  .step-item.completed .step-label {
    color: var(--success);
    font-weight: 600;
  }

  .step-connector {
    flex: 1;
    height: 2px;
    background: var(--border);
    min-width: 10px;
    max-width: 20px;
    transition: background 0.3s ease;
    border-radius: 1px;
  }

  .step-connector.active {
    background: linear-gradient(
      90deg,
      var(--success) 0%,
      var(--primary-dark) 100%
    );
  }

  /* Responsive para móviles pequeños */
  @media (max-width: 640px) {
    .step-label {
      font-size: 0.5625rem;
      max-width: 50px;
    }

    .step-indicator {
      width: 24px;
      height: 24px;
      font-size: 0.75rem;
    }

  }

  /* Dark mode removed */
</style>
