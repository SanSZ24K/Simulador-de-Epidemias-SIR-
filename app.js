"use strict";

const DEFAULTS = {
  population: 1000,
  initialInfected: 10,
  beta: 0.3,
  gamma: 0.1,
  days: 160,
};

const form = document.querySelector("#simulation-form");
const fields = {
  population: document.querySelector("#population"),
  initialInfected: document.querySelector("#initial-infected"),
  beta: document.querySelector("#beta"),
  gamma: document.querySelector("#gamma"),
  days: document.querySelector("#days"),
};
const errorMessage = document.querySelector("#form-error");
const canvas = document.querySelector("#sir-chart");
const chartContainer = document.querySelector(".chart-container");
const tooltip = document.querySelector("#chart-tooltip");
const context = canvas.getContext("2d");
const numberFormat = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0,
});
const decimalFormat = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 2,
});

let currentSimulation = null;
let resizeObserver = null;

function readParameters() {
  return {
    population: Number(fields.population.value),
    initialInfected: Number(fields.initialInfected.value),
    beta: Number(fields.beta.value),
    gamma: Number(fields.gamma.value),
    days: Number(fields.days.value),
  };
}

function validateParameters(parameters) {
  if (!Number.isInteger(parameters.population) || parameters.population < 10 || parameters.population > 1_000_000) {
    return "La población debe ser un número entero entre 10 y 1.000.000.";
  }
  if (!Number.isInteger(parameters.initialInfected) || parameters.initialInfected < 1 || parameters.initialInfected > parameters.population) {
    return "Los infectados iniciales deben ser al menos 1 y no superar la población.";
  }
  if (!Number.isFinite(parameters.beta) || parameters.beta < 0 || parameters.beta > 2) {
    return "La tasa de contagio debe estar entre 0 y 2.";
  }
  if (!Number.isFinite(parameters.gamma) || parameters.gamma < 0 || parameters.gamma > 1) {
    return "La tasa de recuperación debe estar entre 0 y 1.";
  }
  if (!Number.isInteger(parameters.days) || parameters.days < 1 || parameters.days > 365) {
    return "La duración debe ser un número entero entre 1 y 365 días.";
  }
  return "";
}

function simulate({ population, initialInfected, beta, gamma, days }) {
  let susceptible = population - initialInfected;
  let infected = initialInfected;
  let recovered = 0;
  let time = 0;
  const step = 0.1;
  const samples = [{ time, susceptible, infected, recovered }];

  while (time < days) {
    const delta = Math.min(step, days - time);
    const newCases = Math.min(beta * susceptible * infected / population * delta, susceptible);
    const newRecoveries = Math.min(gamma * infected * delta, infected);

    susceptible -= newCases;
    infected += newCases - newRecoveries;
    recovered += newRecoveries;
    time = Math.min(days, time + delta);
    samples.push({ time, susceptible, infected, recovered });
  }

  const peak = samples.reduce((highest, sample) =>
    sample.infected > highest.infected ? sample : highest
  );
  const finalSample = samples[samples.length - 1];

  return { samples, peak, finalSample, population, beta, gamma, days };
}

function updateMetrics(result) {
  document.querySelector("#peak-value").textContent = numberFormat.format(result.peak.infected);
  document.querySelector("#peak-day").textContent =
    `${numberFormat.format(result.peak.time)} ${result.peak.time === 1 ? "día" : "días"} · punto máximo`;
  document.querySelector("#recovered-value").textContent =
    numberFormat.format(result.finalSample.recovered);
  document.querySelector("#recovered-share").textContent =
    `${decimalFormat.format(result.finalSample.recovered / result.population * 100)}% de la población`;

  let r0 = "—";
  if (result.gamma === 0 && result.beta > 0) {
    r0 = "∞";
  } else if (result.gamma > 0) {
    r0 = decimalFormat.format(result.beta / result.gamma);
  }
  document.querySelector("#r0-value").textContent = r0;
}

function drawChart(result) {
  if (!result || !chartContainer.clientWidth || !chartContainer.clientHeight) {
    return;
  }

  const bounds = chartContainer.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = bounds.width;
  const height = bounds.height;
  const padding = { top: 14, right: 13, bottom: 34, left: 52 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxPopulation = result.population;
  const x = (time) => padding.left + time / result.days * plotWidth;
  const y = (count) => padding.top + plotHeight - count / maxPopulation * plotHeight;

  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, width, height);

  context.font = "10px 'DM Sans', 'Segoe UI', sans-serif";
  context.lineWidth = 1;
  context.textBaseline = "middle";

  for (let tick = 0; tick <= 4; tick += 1) {
    const value = maxPopulation * tick / 4;
    const yPosition = y(value);
    context.beginPath();
    context.strokeStyle = "#edf0f5";
    context.moveTo(padding.left, yPosition);
    context.lineTo(width - padding.right, yPosition);
    context.stroke();
    context.fillStyle = "#8b96a8";
    context.textAlign = "right";
    context.fillText(numberFormat.format(value), padding.left - 9, yPosition);
  }

  const dayTickCount = Math.min(4, result.days);
  for (let tick = 0; tick <= dayTickCount; tick += 1) {
    const day = result.days * tick / dayTickCount;
    const xPosition = x(day);
    context.fillStyle = "#8b96a8";
    context.textAlign = tick === 0 ? "left" : tick === dayTickCount ? "right" : "center";
    context.fillText(numberFormat.format(day), xPosition, height - 12);
  }

  const series = [
    { key: "susceptible", color: "#4778e8" },
    { key: "infected", color: "#ef6c72" },
    { key: "recovered", color: "#39b98b" },
  ];

  for (const { key, color } of series) {
    context.beginPath();
    result.samples.forEach((sample, index) => {
      const pointX = x(sample.time);
      const pointY = y(sample[key]);
      if (index === 0) {
        context.moveTo(pointX, pointY);
      } else {
        context.lineTo(pointX, pointY);
      }
    });
    context.strokeStyle = color;
    context.lineWidth = 2.5;
    context.lineJoin = "round";
    context.lineCap = "round";
    context.stroke();
  }

  canvas.dataset.plotLeft = String(padding.left);
  canvas.dataset.plotRight = String(width - padding.right);
  canvas.dataset.plotTop = String(padding.top);
  canvas.dataset.plotBottom = String(height - padding.bottom);
}

function formatTooltip(sample) {
  return `<div class="tooltip-day">Día ${decimalFormat.format(sample.time)}</div>
    <div><span style="color:#4778e8">●</span> Susceptibles: ${numberFormat.format(sample.susceptible)}</div>
    <div><span style="color:#ef6c72">●</span> Infectados: ${numberFormat.format(sample.infected)}</div>
    <div><span style="color:#39b98b">●</span> Recuperados: ${numberFormat.format(sample.recovered)}</div>`;
}

function showTooltip(event) {
  if (!currentSimulation) {
    return;
  }

  const bounds = canvas.getBoundingClientRect();
  const plotLeft = Number(canvas.dataset.plotLeft);
  const plotRight = Number(canvas.dataset.plotRight);
  const pointerX = event.clientX - bounds.left;
  const ratio = Math.max(0, Math.min(1, (pointerX - plotLeft) / (plotRight - plotLeft)));
  const time = ratio * currentSimulation.days;
  const sampleIndex = Math.round(time / currentSimulation.days * (currentSimulation.samples.length - 1));
  const sample = currentSimulation.samples[sampleIndex];
  if (!sample) {
    return;
  }

  tooltip.innerHTML = formatTooltip(sample);
  tooltip.hidden = false;
  const left = Math.max(4, Math.min(event.clientX - bounds.left + 12, bounds.width - tooltip.offsetWidth - 4));
  const top = Math.max(4, Math.min(event.clientY - bounds.top - tooltip.offsetHeight - 10, bounds.height - tooltip.offsetHeight - 4));
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const parameters = readParameters();
  const validationError = validateParameters(parameters);

  if (validationError) {
    errorMessage.textContent = validationError;
    errorMessage.hidden = false;
    return;
  }

  errorMessage.hidden = true;
  currentSimulation = simulate(parameters);
  updateMetrics(currentSimulation);
  drawChart(currentSimulation);
});

document.querySelector("#reset-button").addEventListener("click", () => {
  fields.population.value = DEFAULTS.population;
  fields.initialInfected.value = DEFAULTS.initialInfected;
  fields.beta.value = DEFAULTS.beta.toFixed(2);
  fields.gamma.value = DEFAULTS.gamma.toFixed(2);
  fields.days.value = DEFAULTS.days;
  errorMessage.hidden = true;
  currentSimulation = simulate(DEFAULTS);
  updateMetrics(currentSimulation);
  drawChart(currentSimulation);
});

fields.population.addEventListener("input", () => {
  fields.initialInfected.max = fields.population.value;
});

canvas.addEventListener("pointermove", showTooltip);
canvas.addEventListener("pointerleave", () => {
  tooltip.hidden = true;
});

if ("ResizeObserver" in window) {
  resizeObserver = new ResizeObserver(() => drawChart(currentSimulation));
  resizeObserver.observe(chartContainer);
} else {
  window.addEventListener("resize", () => drawChart(currentSimulation));
}

currentSimulation = simulate(DEFAULTS);
updateMetrics(currentSimulation);
drawChart(currentSimulation);
