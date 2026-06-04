/* global d3, topojson */
(function () {
  const state = {
    data: null,
    speciesContext: null,
    filters: { species: "", region: "", weather: "" },
  };

  const tooltip = d3.select("#tooltip");

  async function loadJson(relativePath) {
    const url = new URL(relativePath, document.baseURI).href;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `No s'ha trobat ${relativePath} (${res.status}). URL: ${url}. ` +
          "Comprova que data/migration_enriched.json està al repositori GitHub."
      );
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      throw new Error(
        `JSON invàlid a ${relativePath}. Torna a executar: python scripts/prepare_data.py`
      );
    }
  }

  function pct(v) {
    return `${(v * 100).toFixed(1)}%`;
  }

  function showTooltip(html, event) {
    tooltip
      .html(html)
      .classed("visible", true)
      .style("left", `${event.clientX + 12}px`)
      .style("top", `${event.clientY + 12}px`);
  }

  function hideTooltip() {
    tooltip.classed("visible", false);
  }

  function filteredFlows() {
    return state.data.flows.filter((d) => {
      if (state.filters.species && d.Species !== state.filters.species) return false;
      if (state.filters.region && d.Region !== state.filters.region) return false;
      return true;
    });
  }

  function filteredRoutes() {
    return state.data.routes_sample.filter((d) => {
      if (state.filters.species && d.Species !== state.filters.species) return false;
      if (state.filters.region && d.Region !== state.filters.region) return false;
      if (state.filters.weather && d.Weather_Condition !== state.filters.weather) return false;
      return true;
    });
  }

  function updateKpis() {
    const routes = filteredRoutes();
    const n = routes.length;
    const success =
      n === 0 ? 0 : routes.filter((r) => r.Migration_Success === "Successful").length / n;
    const interrupted =
      n === 0 ? 0 : routes.filter((r) => r.Migration_Interrupted === "Yes").length / n;
    const avgDist =
      n === 0 ? 0 : d3.mean(routes, (r) => r.Flight_Distance_km);

    d3.select("#kpi-map").html(`
      <div class="kpi"><strong>${n}</strong><span>Trajectes (mostra)</span></div>
      <div class="kpi"><strong>${pct(success)}</strong><span>Èxit migratori</span></div>
      <div class="kpi"><strong>${pct(interrupted)}</strong><span>Interromputs</span></div>
      <div class="kpi"><strong>${avgDist ? Math.round(avgDist) : 0} km</strong><span>Distància mitjana</span></div>
    `);
  }

  function updateSpeciesContext() {
    const sp = state.filters.species;
    const panel = d3.select("#context-text");
    if (!sp || !state.speciesContext.species[sp]) {
      panel.text("Selecciona una espècie per veure estat IUCN i pressions climàtiques documentades.");
      d3.select("#context-species").attr("hidden", true);
      return;
    }
    const c = state.speciesContext.species[sp];
    const html = `
      <strong>${sp}</strong> (${c.scientific_group})<br/>
      IUCN representatiu: ${c.iucn_representative}<br/>
      Tendència poblacional: ${c.population_trend}<br/>
      CMS: Apèndix ${c.cms_appendix}<br/>
      Pressió climàtica: ${c.climate_pressure}<br/>
      <a href="${c.source_url}" target="_blank" rel="noopener">Font externa real</a>
    `;
    panel.html(html);
    d3.select("#context-species")
      .attr("hidden", null)
      .html(`<strong>Context de conservació (font real)</strong>${html}`);
  }

  async function renderMap() {
    const container = d3.select("#map-panel");
    container.selectAll("*").remove();
    const width = container.node().clientWidth || 700;
    const height = Math.max(360, width * 0.52);

    const svg = container
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img")
      .attr("aria-label", "Mapa de fluxos migratoris");

    const projection = d3
      .geoNaturalEarth1()
      .scale(width / 5.5)
      .translate([width / 2, height / 2]);
    const path = d3.geoPath(projection);

    const world = await d3.json(
      "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"
    );
    const countries = topojson.feature(world, world.objects.countries);

    svg
      .append("g")
      .selectAll("path")
      .data(countries.features)
      .join("path")
      .attr("d", path)
      .attr("fill", "#e8e4dc")
      .attr("stroke", "#c5bfb3");

    const flows = filteredFlows().slice(0, 80);
    const color = d3.scaleLinear().domain([0, 1]).range(["#c45c3e", "#3d7a5c"]);

    const linkGen = (d) => {
      const start = projection([d.start_lon, d.start_lat]);
      const end = projection([d.end_lon, d.end_lat]);
      if (!start || !end) return null;
      const mid = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2 - 40];
      return `M${start[0]},${start[1]} Q${mid[0]},${mid[1]} ${end[0]},${end[1]}`;
    };

    svg
      .append("g")
      .attr("aria-hidden", "true")
      .selectAll("path.arc")
      .data(flows)
      .join("path")
      .attr("class", "arc")
      .attr("d", (d) => linkGen(d))
      .attr("stroke", (d) => color(d.success_rate))
      .attr("stroke-width", (d) => Math.sqrt(d.count) * 0.35 + 0.5)
      .attr("stroke-opacity", 0.65)
      .attr("tabindex", 0)
      .on("mousemove", (event, d) => {
        showTooltip(
          `<strong>${d.Species}</strong> · ${d.Region}<br/>
          Trajectes: ${d.count}<br/>
          Èxit: ${pct(d.success_rate)}<br/>
          Interromputs: ${pct(d.interrupted_rate)}<br/>
          Distància mitjana: ${Math.round(d.avg_distance)} km`,
          event
        );
      })
      .on("mouseleave", hideTooltip)
      .on("focus", function (event, d) {
        showTooltip(`${d.Species}: ${pct(d.success_rate)} èxit`, event);
      })
      .on("blur", hideTooltip);

    const legend = svg.append("g").attr("transform", `translate(16,${height - 36})`);
    legend
      .append("text")
      .text("Color = taxa d'èxit")
      .attr("fill", "#1a2a33")
      .attr("font-size", 11);
    const grad = legend
      .append("defs")
      .append("linearGradient")
      .attr("id", "legend-grad")
      .attr("x1", "0%")
      .attr("x2", "100%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", color(0));
    grad.append("stop").attr("offset", "100%").attr("stop-color", color(1));
    legend
      .append("rect")
      .attr("y", 14)
      .attr("width", 120)
      .attr("height", 8)
      .attr("fill", "url(#legend-grad)");
  }

  function barChart(containerId, rows, { xKey, yKey, yLabel, colorKey }) {
    const container = d3.select(containerId);
    container.selectAll("*").remove();
    if (!rows.length) {
      container.append("p").text("Sense dades per als filtres seleccionats.");
      return;
    }

    const width = container.node().clientWidth || 600;
    const height = 280;
    const margin = { top: 20, right: 16, bottom: 70, left: 48 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = container
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "img");

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(rows.map((d) => d[xKey]))
      .range([0, innerW])
      .padding(0.2);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (d) => d[yKey]) * 1.1 || 1])
      .nice()
      .range([innerH, 0]);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-35)")
      .style("text-anchor", "end")
      .attr("font-size", 10);

    g.append("g").call(d3.axisLeft(y).ticks(5));
    g.append("text")
      .attr("x", -40)
      .attr("y", -6)
      .attr("font-size", 11)
      .text(yLabel);

    const colorFn =
      colorKey === "success_rate"
        ? (d) => (d.success_rate >= 0.5 ? "var(--success)" : "var(--risk)")
        : () => "var(--accent)";

    g.selectAll("rect")
      .data(rows)
      .join("rect")
      .attr("x", (d) => x(d[xKey]))
      .attr("y", (d) => y(d[yKey]))
      .attr("width", x.bandwidth())
      .attr("height", (d) => innerH - y(d[yKey]))
      .attr("fill", colorFn)
      .attr("rx", 3)
      .attr("tabindex", 0)
      .on("mousemove", (event, d) => {
        const extra = colorKey === "success_rate" ? `<br/>Èxit: ${pct(d.success_rate)}` : "";
        showTooltip(`<strong>${d[xKey]}</strong><br/>${yLabel}: ${d[yKey].toFixed?.(1) ?? d[yKey]}${extra}<br/>n=${d.n}`, event);
      })
      .on("mouseleave", hideTooltip);
  }

  function renderSpeciesChart() {
    let rows = state.data.by_species_region;
    if (state.filters.species) rows = rows.filter((d) => d.Species === state.filters.species);
    if (state.filters.region) rows = rows.filter((d) => d.Region === state.filters.region);
    rows = rows
      .slice()
      .sort((a, b) => b.avg_distance - a.avg_distance)
      .slice(0, 12)
      .map((d) => ({
        ...d,
        label: `${d.Species} · ${d.Region}`,
      }));
    barChart("#chart-species", rows, {
      xKey: "label",
      yKey: "avg_distance",
      yLabel: "Distància mitjana (km)",
      colorKey: "success_rate",
    });
  }

  function renderWeatherChart() {
    let rows = state.data.by_weather;
    if (state.filters.weather) rows = rows.filter((d) => d.Weather_Condition === state.filters.weather);
    rows = rows.map((d) => ({ ...d, label: d.Weather_Condition }));
    barChart("#chart-weather", rows, {
      xKey: "label",
      yKey: "interrupted_rate",
      yLabel: "Taxa interrupció",
      colorKey: "risk",
    });
  }

  function renderHabitatChart() {
    let rows = state.data.by_habitat_food.map((d) => ({
      ...d,
      label: `${d.Habitat} / ${d.Food_Supply_Level}`,
    }));
    rows = rows.sort((a, b) => b.nesting_rate - a.nesting_rate).slice(0, 10);
    barChart("#chart-habitat", rows, {
      xKey: "label",
      yKey: "nesting_rate",
      yLabel: "Èxit nidificació",
      colorKey: "success_rate",
    });
  }

  function renderFlockChart() {
    const rows = state.data.by_flock.map((d) => ({
      ...d,
      label: d.Migrated_in_Flock === "Yes" ? "En bandada" : "Solitària",
    }));
    barChart("#chart-flock", rows, {
      xKey: "label",
      yKey: "success_rate",
      yLabel: "Èxit migratori",
      colorKey: "success_rate",
    });
  }

  function renderAltitudeChart() {
    let rows = state.data.by_species_wind;
    if (state.filters.species) rows = rows.filter((d) => d.Species === state.filters.species);
    rows = rows
      .slice()
      .sort((a, b) => b.avg_altitude_range - a.avg_altitude_range)
      .slice(0, 14)
      .map((d) => ({ ...d, label: `${d.Species} · ${d.Weather_Condition}` }));
    barChart("#chart-altitude", rows, {
      xKey: "label",
      yKey: "avg_altitude_range",
      yLabel: "Rang altitud (m)",
      colorKey: "neutral",
    });
  }

  function renderTemporalChart() {
    const container = d3.select("#chart-temporal");
    container.selectAll("*").remove();
    let rows = state.data.temporal;
    if (state.filters.species) rows = rows.filter((d) => d.Species === state.filters.species);

    const species = [...new Set(rows.map((d) => d.Species))];
    const width = container.node().clientWidth || 600;
    const height = 300;
    const margin = { top: 24, right: 120, bottom: 40, left: 44 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = container.append("svg").attr("viewBox", `0 0 ${width} ${height}`);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scalePoint()
      .domain(state.data.month_order)
      .range([0, innerW]);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(rows, (d) => d.n) * 1.1 || 1])
      .nice()
      .range([innerH, 0]);

    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(species);

    const line = d3
      .line()
      .x((d) => x(d.Migration_Start_Month))
      .y((d) => y(d.n));

    const nested = d3.group(rows, (d) => d.Species);
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x));
    g.append("g").call(d3.axisLeft(y).ticks(5));
    g.append("text").attr("x", -36).attr("y", -8).attr("font-size", 11).text("Nombre migracions");

    nested.forEach((values, sp) => {
      g.append("path")
        .datum(values.sort((a, b) => a.month_order - b.month_order))
        .attr("fill", "none")
        .attr("stroke", color(sp))
        .attr("stroke-width", 2)
        .attr("d", line);
    });

    const legend = svg.append("g").attr("transform", `translate(${width - 110},${margin.top})`);
    species.forEach((sp, i) => {
      legend
        .append("rect")
        .attr("y", i * 18)
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", color(sp));
      legend
        .append("text")
        .attr("x", 18)
        .attr("y", i * 18 + 10)
        .attr("font-size", 10)
        .text(sp);
    });
  }

  function populateFilters() {
    const { summary } = state.data;
    const fill = (id, values) => {
      const sel = d3.select(id);
      values.forEach((v) => sel.append("option").attr("value", v).text(v));
    };
    fill("#filter-species", summary.species);
    fill("#filter-region", summary.regions);
    fill("#filter-weather", summary.weather);
  }

  function refresh() {
    updateKpis();
    updateSpeciesContext();
    renderMap();
    renderSpeciesChart();
    renderWeatherChart();
    renderHabitatChart();
    renderFlockChart();
    renderAltitudeChart();
    renderTemporalChart();
  }

  async function init() {
    const [data, speciesContext] = await Promise.all([
      loadJson("data/migration_enriched.json"),
      loadJson("data/species_context.json"),
    ]);
    if (!data || !data.summary) {
      throw new Error("migration_enriched.json no té el format esperat.");
    }
    state.data = data;
    state.speciesContext = speciesContext;
    populateFilters();

    ["#filter-species", "#filter-region", "#filter-weather"].forEach((sel) => {
      d3.select(sel).on("change", function () {
        const id = this.id;
        const key = id.replace("filter-", "");
        state.filters[key] = this.value;
        refresh();
      });
    });

    d3.select("#btn-contrast").on("click", function () {
      const on = !document.body.classList.toggle("high-contrast");
      this.setAttribute("aria-pressed", String(on));
      this.textContent = on ? "Mode alt contrast" : "Mode estàndard";
    });

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(refresh, 200);
    });

    refresh();
  }

  function showFatalError(err) {
    console.error(err);
    const msg =
      window.location.protocol === "file:"
        ? "Obre el projecte amb un servidor local (python -m http.server 8080 des de la carpeta PR2), no amb doble clic al fitxer HTML."
        : `Error carregant dades: ${err.message}`;
    d3.select("body")
      .insert("div", "header")
      .attr("role", "alert")
      .style("background", "#c45c3e")
      .style("color", "#fff")
      .style("padding", "1rem")
      .style("font-weight", "600")
      .text(msg);
  }

  if (window.location.protocol === "file:") {
    showFatalError(new Error("protocol file://"));
  } else if (typeof d3 === "undefined") {
    showFatalError(new Error("D3.js no s'ha carregat (comprova la connexió a internet)"));
  } else {
    init().catch(showFatalError);
  }
})();
