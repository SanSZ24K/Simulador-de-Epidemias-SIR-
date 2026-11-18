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
const backToTopButton = document.querySelector("#back-to-top");
const canvas = document.querySelector("#sir-chart");
const chartContainer = document.querySelector(".chart-container");
const tooltip = document.querySelector("#chart-tooltip");
const tucumanMap = document.querySelector("#tucuman-map");
const mapVisual = document.querySelector(".map-visual");
const infectionCanvas = document.querySelector("#infection-canvas");
const mapStatus = document.querySelector("#map-status");
const mapDaySlider = document.querySelector("#map-day-slider");
const mapDayValue = document.querySelector("#map-day-value");
const mapDayEnd = document.querySelector("#map-day-end");
const context = canvas.getContext("2d");
const infectionContext = infectionCanvas.getContext("2d");
const MAP_DOT_COUNT = 8000;
const TUCUMAN_OUTLINE = [
  [30, 85.2], [31.9, 87.9], [31, 107.9], [49, 103.1], [79.2, 124.8],
  [72, 134.7], [69.3, 143.6], [75.3, 149.3], [75.3, 153.6], [67.4, 161.8],
  [66.9, 166.7], [60.2, 169.5], [56.7, 180.5], [47.4, 186.6], [44.2, 196.6],
  [39.5, 197.6], [35.3, 204.5], [59.2, 215.6], [59.3, 245], [67.2, 267.1],
  [72.8, 267.6], [74.2, 270.1], [79.4, 289.4], [78.9, 295], [80.5, 290.3],
  [84.3, 288.2], [83, 282.3], [90.5, 282.4], [97.3, 289.9], [97.7, 301],
  [101.7, 307.2], [102.2, 313.3], [109.2, 313.5], [115.2, 320], [125.8, 306.3],
  [137.3, 300.7], [145.6, 291.7], [172.5, 309.7], [171.4, 305], [174.2, 299],
  [181.6, 301.5], [191.2, 299.3], [195.6, 281.3], [193.3, 273.3], [198.3, 277],
  [192.5, 254.5], [202.9, 248.2], [194.9, 236], [206.2, 217.4], [217.2, 213.3],
  [223.4, 187.3], [225.2, 187.6], [232.1, 165.2], [230.5, 164.9], [231.6, 159.3],
  [237.6, 160.4], [243, 133.8], [250.1, 135.2], [254.7, 112.4], [266.8, 114.9],
  [262.6, 73.9], [264.3, 65.6], [270, 58.2], [267.8, 44.2], [251.3, 46.9],
  [250.1, 45.4], [244.5, 48.5], [226.3, 45.4], [218.5, 47.7], [214.6, 53.2],
  [203.6, 58.1], [200.4, 53.5], [191, 55.2], [191, 46.3], [157.7, 37.4],
  [154.5, 23.6], [147.5, 20.3], [144.7, 20.3], [135.6, 27.9], [130.8, 25.1],
  [118.6, 24.5], [109.9, 30], [106.1, 28.1], [99.3, 29.1], [96.2, 43.1],
  [97.2, 47.9], [94.2, 53.8], [96.6, 56.5], [94.4, 59], [95.1, 65.1],
  [41.1, 44.9], [41.3, 49.6], [38, 53.4], [38.4, 68.9], [32.8, 72.6],
  [33.4, 78.6],
];
const numberFormat = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 0,
});
const decimalFormat = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 2,
});

let currentSimulation = null;
let resizeObserver = null;
let mapRenderFrame = 0;
let pendingMapRender = null;

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

function isInsideTucuman(x, y) {
  let inside = false;
  for (let index = 0, previous = TUCUMAN_OUTLINE.length - 1; index < TUCUMAN_OUTLINE.length; previous = index, index += 1) {
    const [currentX, currentY] = TUCUMAN_OUTLINE[index];
    const [previousX, previousY] = TUCUMAN_OUTLINE[previous];
    const crosses = (currentY > y) !== (previousY > y) &&
      x < (previousX - currentX) * (y - currentY) / (previousY - currentY) + currentX;
    if (crosses) {
      inside = !inside;
    }
  }
  return inside;
}

function configureTucumanMap() {
  const pathData = `${TUCUMAN_OUTLINE.map(([x, y]) => `${x},${y}`).join(" ")} Z`;
  tucumanMap.querySelector(".province-shape").setAttribute("d", `M${pathData}`);
}

function createInfectionDots() {
  const dots = [];
  let attempts = 0;

  while (dots.length < MAP_DOT_COUNT && attempts < MAP_DOT_COUNT * 100) {
    attempts += 1;
    const x = 34 + Math.random() * (266 - 34);
    const y = 24 + Math.random() * (316 - 24);
    if (!isInsideTucuman(x, y)) {
      continue;
    }

    dots.push({ x, y, radius: 1.4 + Math.random() * 1.1 });
  }

  if (dots.length !== MAP_DOT_COUNT) {
    throw new Error(`No se pudieron crear los ${MAP_DOT_COUNT} puntos del mapa.`);
  }

  for (let index = dots.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [dots[index], dots[randomIndex]] = [dots[randomIndex], dots[index]];
  }

  return dots;
}

configureTucumanMap();
const mapDots = createInfectionDots();

function showMapSample(sample, result) {
  scheduleMapRender(sample, result);
  mapStatus.textContent =
    `${numberFormat.format(sample.infected)} infectados en este día`;
}

function scheduleMapRender(sample, result) {
  pendingMapRender = { sample, result };
  if (mapRenderFrame) {
    return;
  }

  mapRenderFrame = window.requestAnimationFrame(() => {
    mapRenderFrame = 0;
    const render = pendingMapRender;
    pendingMapRender = null;
    if (render) {
      drawInfectionMap(render.sample, render.result);
    }
  });
}

function drawInfectionMap(sample, result) {
  const activeDots = sample.infected > 0
    ? Math.max(1, Math.round(sample.infected / result.population * MAP_DOT_COUNT))
    : 0;
  const width = mapVisual.clientWidth;
  const height = mapVisual.clientHeight;
  if (!width || !height) {
    return;
  }

  const pixelRatio = window.devicePixelRatio || 1;
  const canvasWidth = Math.round(width * pixelRatio);
  const canvasHeight = Math.round(height * pixelRatio);
  if (infectionCanvas.width !== canvasWidth || infectionCanvas.height !== canvasHeight) {
    infectionCanvas.width = canvasWidth;
    infectionCanvas.height = canvasHeight;
  }

  infectionContext.setTransform(canvasWidth / 300, 0, 0, canvasHeight / 340, 0, 0);
  infectionContext.clearRect(0, 0, 300, 340);
  infectionContext.beginPath();
  TUCUMAN_OUTLINE.forEach(([x, y], index) => {
    if (index === 0) {
      infectionContext.moveTo(x, y);
    } else {
      infectionContext.lineTo(x, y);
    }
  });
  infectionContext.closePath();
  infectionContext.clip();
  infectionContext.beginPath();
  for (let index = 0; index < activeDots; index += 1) {
    const dot = mapDots[index];
    infectionContext.moveTo(dot.x + dot.radius, dot.y);
    infectionContext.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
  }
  infectionContext.fillStyle = "rgb(232 93 98 / 78%)";
  infectionContext.fill();
}

function updateMapForDay(day) {
  if (!currentSimulation) {
    return;
  }

  const sampleIndex = Math.round(
    day / currentSimulation.days * (currentSimulation.samples.length - 1)
  );
  const sample = currentSimulation.samples[sampleIndex];
  if (!sample) {
    throw new Error(`No hay una muestra de la simulación para el día ${day}.`);
  }

  mapDayValue.value = String(day);
  mapDaySlider.setAttribute("aria-valuetext", `Día ${day} de ${currentSimulation.days}`);
  showMapSample(sample, currentSimulation);
}

function updateMapForSimulation(result) {
  mapDaySlider.max = String(result.days);
  mapDaySlider.value = "0";
  mapDayEnd.textContent = `Día ${result.days}`;
  updateMapForDay(0);
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
  updateMapForSimulation(currentSimulation);
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
  updateMapForSimulation(currentSimulation);
});

fields.population.addEventListener("input", () => {
  fields.initialInfected.max = fields.population.value;
});

mapDaySlider.addEventListener("input", () => {
  updateMapForDay(Number(mapDaySlider.value));
});

function updateBackToTopVisibility() {
  backToTopButton.classList.toggle("is-visible", window.scrollY > 300);
}

window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });
backToTopButton.addEventListener("click", () => {
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
  window.scrollTo({ top: 0, behavior });
});
updateBackToTopVisibility();

canvas.addEventListener("pointermove", showTooltip);
canvas.addEventListener("pointerleave", () => {
  tooltip.hidden = true;
});

if ("ResizeObserver" in window) {
  resizeObserver = new ResizeObserver(() => {
    drawChart(currentSimulation);
    const selectedDay = Number(mapDaySlider.value);
    if (currentSimulation && selectedDay >= 0) {
      const sampleIndex = Math.round(
        selectedDay / currentSimulation.days * (currentSimulation.samples.length - 1)
      );
      const sample = currentSimulation.samples[sampleIndex];
      if (sample) {
        scheduleMapRender(sample, currentSimulation);
      }
    }
  });
  resizeObserver.observe(chartContainer);
  resizeObserver.observe(mapVisual);
} else {
  window.addEventListener("resize", () => {
    drawChart(currentSimulation);
    updateMapForDay(Number(mapDaySlider.value));
  });
}

currentSimulation = simulate(DEFAULTS);
updateMetrics(currentSimulation);
drawChart(currentSimulation);
updateMapForSimulation(currentSimulation);
