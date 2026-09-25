import { loadDashboard } from "./data-provider.js";
import {
  value,
  number,
  bytes,
  percent,
  temperature,
  uptime,
  freshness,
  timestamp,
  numeric,
} from "./formatters.js";

const escape = (x) =>
  value(x).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const array = (x) => (Array.isArray(x) ? x : []);
const entries = (x) => (x && typeof x === "object" ? Object.entries(x) : []);
const health = (node) =>
  ["OK", "WARNING", "CRITICAL", "UNKNOWN"].includes(
    node.status.data?.health?.status,
  )
    ? node.status.data.health.status
    : "UNKNOWN";
const badge = (node) =>
  `<span class="badge ${health(node).toLowerCase()}">${{ OK: "✓", WARNING: "△", CRITICAL: "!", UNKNOWN: "?" }[health(node)]} ${health(node)}</span>`;
const name = (n) =>
  n.inventory.data?.host?.hostname || n.status.data?.host?.hostname || n.id;
const route = (n) => `#/hosts/${encodeURIComponent(n.id)}`;
const platform = (i) =>
  i?.platform?.proxmox
    ? `Proxmox VE · ${value(i.platform.proxmox.version)}`
    : i?.platform?.docker
      ? `Docker · ${value(i.platform.docker.engine_version)}`
      : "Linux / plataforma não informada";
const fact = (label, text) =>
  `<div><dt>${escape(label)}</dt><dd>${escape(text)}</dd></div>`;
const facts = (rows) =>
  `<dl class="facts">${rows.map((row) => fact(...row)).join("")}</dl>`;
function fresh(date) {
  const state = freshness(date);
  return `<span class="fresh ${state.stale ? "stale" : ""}" data-timestamp="${escape(date || "")}" title="${escape(timestamp(date))}">${escape(state.text)}</span>`;
}
const section = (id, title, content) =>
  `<section id="${id}" class="section"><h2>${title}</h2>${content}</section>`;
const notice = (text) => `<p class="notice">${escape(text)}</p>`;
function meter(label, amount, detail) {
  return `<div class="metric"><div><span>${escape(label)}</span><strong>${percent(amount)}</strong></div>${numeric(amount) ? `<progress max="100" value="${Math.max(0, Math.min(100, amount))}" aria-label="${escape(label)}">${percent(amount)}</progress>` : ""}<small>${escape(detail)}</small></div>`;
}
// Open objects in status.schema.json retain all fields, including unfamiliar producer keys.
const fieldLabels = {
  cpu_package_celsius: "CPU package",
  temperature_celsius: "Temperatura",
  status: "Estado",
  mountpoint: "Ponto de montagem",
  used_bytes: "Usado",
  total_bytes: "Total",
  available_bytes: "Disponível",
  used_percent: "Uso",
  available_percent: "Disponível",
};
function fieldValue(key, item, depth) {
  if (key.endsWith("_bytes")) return escape(bytes(item));
  if (key.endsWith("_percent")) return escape(percent(item));
  if (key.endsWith("_celsius")) return escape(temperature(item));
  return inspect(item, depth);
}
function inspect(data, depth = 0) {
  if (data == null) return '<p class="muted">Não informado</p>';
  if (typeof data !== "object") return `<span>${escape(data)}</span>`;
  if (!entries(data).length) return '<p class="muted">Nenhum registro</p>';
  if (depth > 5) return `<pre>${escape(data)}</pre>`;
  return `<dl class="records">${entries(data)
    .map(
      ([key, item]) =>
        `<div><dt>${escape(fieldLabels[key] || key)}</dt><dd>${fieldValue(key, item, depth + 1)}</dd></div>`,
    )
    .join("")}</dl>`;
}
function errors(node) {
  return ["inventory", "status", "guests"]
    .filter(
      (file) =>
        node[file].error &&
        (file !== "guests" ||
          node.role === "proxmox" ||
          node[file].error !== "Arquivo ausente"),
    )
    .map((file) =>
      notice(
        `${file}.json: ${node[file].error}.${file === "status" ? " Sem dados dinâmicos; não é possível determinar disponibilidade do host." : file === "guests" ? " A lista de guests não está disponível." : " A identidade pode estar incompleta."}`,
      ),
    )
    .join("");
}
let state = { nodes: [], error: null };
const main = document.querySelector("#main");
const refresh = document.querySelector("#refresh");
const indexURL = new URL(
  new URLSearchParams(location.search).get("index") ||
    "../examples/data/nodes.json",
  location.href,
);
function overview() {
  const attention = state.nodes.filter((n) =>
    ["WARNING", "CRITICAL"].includes(health(n)),
  ).length;
  return `<div class="page-head"><div><h1>Visão geral</h1><p>Máquinas, recursos e sinais de atenção.</p></div><span class="count">${state.nodes.length} hosts / ${attention} com alertas</span></div>
    <div class="legend"><span class="badge ok">✓ OK</span><span class="badge warning">△ WARNING</span><span class="badge critical">! CRITICAL</span><span class="badge unknown">? UNKNOWN</span><span>Saúde reportada pela fonte</span></div>
    ${state.error ? notice(`${state.error}. Confira o endereço do índice e tente Atualizar dados.`) : ""}
    ${!state.error && !state.nodes.length ? notice("Nenhum host cadastrado no índice.") : ""}
    <div class="host-list">${state.nodes
      .map((n) => {
        const i = n.inventory.data,
          s = n.status.data,
          memory = s?.resources?.memory;
        return `<article class="host-row ${health(n).toLowerCase()}"><div class="host-heading"><div><a class="host-link" href="${route(n)}">${escape(name(n))}</a><p>${escape(i?.host?.fqdn || s?.host?.fqdn)}</p></div>${badge(n)}</div>
        <p class="host-platform">${escape(i?.host?.role || n.role)} / ${escape(platform(i))}</p><p class="muted">${escape(i?.host?.os?.name)}</p>
        <div class="host-metrics">${facts([
          [
            "CPU",
            `${value(i?.hardware?.cpu?.cores)} cores/socket · ${value(i?.hardware?.cpu?.logical_cpus)} threads`,
          ],
          ["RAM física", bytes(i?.hardware?.memory?.total_bytes)],
          ["RAM disponível", percent(memory?.available_percent)],
          ["Filesystem /", percent(s?.storage?.root_filesystem?.used_percent)],
          ["Temperatura CPU", temperature(s?.thermal?.cpu_package_celsius)],
          ["Uptime", uptime(s?.host?.uptime_seconds)],
          ["Guests", n.guests.data?.summary?.total],
          ["Issues", s?.health?.issue_count],
        ])}</div>
        <footer>${fresh(s?.generated_at)}<a href="${route(n)}">Inspecionar host</a></footer>${errors(n)}</article>`;
      })
      .join("")}</div>`;
}
function hostView(n, guestId) {
  const i = n.inventory.data,
    s = n.status.data,
    g = n.guests.data;
  const h = i?.hardware,
    r = s?.resources,
    net = i?.network;
  const guests = array(g?.guests);
  const guest = guests.find((x) => String(x?.vmid) === guestId);
  const header = `<nav class="breadcrumb" aria-label="Localização"><a href="#/">Homelab</a><span>/</span>${guestId ? `<a href="${route(n)}">${escape(name(n))}</a><span>/</span><span>${escape(guest?.name || guestId)}</span>` : `<span aria-current="page">${escape(name(n))}</span>`}</nav>
    <div class="page-head"><div><h1>${escape(guestId ? guest?.name || "Guest não encontrado" : name(n))}</h1><p>${escape(i?.host?.fqdn || s?.host?.fqdn)} / ${escape(i?.host?.role || n.role)}</p></div>${badge(n)}</div>`;
  if (guestId)
    return (
      header +
      (guest
        ? section(
            "guest",
            `Guest ${escape(guest.vmid)} · ${escape(guest.type)}`,
            facts([
              ["Estado", guest.status],
              ["Template", guest.template ? "Sim" : "Não"],
              ["CPUs alocadas", guest.cpu?.allocated],
              [
                "CPU em uso",
                percent(
                  numeric(guest.cpu?.usage) ? guest.cpu.usage * 100 : null,
                ),
              ],
              ["RAM usada", bytes(guest.memory?.used_bytes)],
              ["RAM máxima", bytes(guest.memory?.max_bytes)],
              ["Storage usado", bytes(guest.storage?.used_bytes)],
              ["Storage máximo", bytes(guest.storage?.max_bytes)],
              ["Uptime", uptime(guest.uptime_seconds)],
            ]),
          ) + fresh(g.generated_at)
        : notice("Guest não encontrado neste nó."))
    );
  return (
    header +
    `<div class="host-summary"><span>${escape(s?.health?.issue_count)} issues</span><span>Uptime ${uptime(s?.host?.uptime_seconds)}</span>${fresh(s?.generated_at)}</div>${errors(n)}
    <nav class="section-nav" aria-label="Seções do host">${[["identity", "Identidade"], ["resources", "Recursos"], ["storage", "Storage"], ["network", "Rede"], ["health", "Saúde e segurança"], ...(g ? [["guests", "Guests"]] : [])].map(([id, label]) => `<a href="${route(n)}" data-section="${id}">${label}</a>`).join("")}</nav>
    <div class="detail-grid">
    ${section(
      "identity",
      "Identidade",
      facts([
        [
          "Fabricante / modelo",
          `${value(h?.manufacturer)} / ${value(h?.product_name)}`,
        ],
        ["Sistema operacional", i?.host?.os?.name],
        ["Kernel", i?.host?.kernel || s?.host?.kernel],
        ["Arquitetura", i?.host?.architecture || s?.host?.architecture],
        ["Plataforma", platform(i)],
        ["CPU", h?.cpu?.model],
        ["Sockets", h?.cpu?.sockets],
        ["Cores por socket", h?.cpu?.cores],
        ["Threads por core", h?.cpu?.threads_per_core],
        ["CPUs lógicas", h?.cpu?.logical_cpus],
        ["Virtualização", h?.cpu?.virtualization],
        ["RAM física", bytes(h?.memory?.total_bytes)],
        [
          "BIOS",
          `${value(h?.bios?.vendor)} / ${value(h?.bios?.version)} / ${value(h?.bios?.release_date)}`,
        ],
      ]) + fresh(i?.generated_at),
    )}
    ${section(
      "resources",
      "Recursos",
      facts([
        [
          "Load 1m / 5m / 15m",
          `${number(r?.load?.load1)} / ${number(r?.load?.load5)} / ${number(r?.load?.load15)}`,
        ],
        ["CPUs lógicas", h?.cpu?.logical_cpus],
      ]) +
        meter(
          "RAM usada",
          r?.memory?.used_percent,
          `${bytes(r?.memory?.used_bytes)} usados / ${bytes(r?.memory?.available_bytes)} disponíveis`,
        ) +
        meter(
          "Swap usada",
          r?.swap?.used_percent,
          `${bytes(r?.swap?.used_bytes)} de ${bytes(r?.swap?.total_bytes)}`,
        ) +
        meter(
          "Filesystem /",
          s?.storage?.root_filesystem?.used_percent,
          `${bytes(s?.storage?.root_filesystem?.used_bytes)} de ${bytes(s?.storage?.root_filesystem?.total_bytes)}`,
        ) +
        meter(
          "Inodes usados",
          s?.storage?.root_inodes?.used_percent,
          "Filesystem raiz",
        ) +
        `<h3>Temperaturas</h3>${inspect(s?.thermal)}<details><summary>Campos de recursos recebidos</summary>${inspect(r)}</details>`,
    )}
    ${section(
      "storage",
      "Storage",
      `<h3>Discos físicos</h3>${
        array(h?.disks).length
          ? array(h.disks)
              .map((d) =>
                facts([
                  ["Dispositivo", d?.name],
                  ["Modelo", d?.model],
                  ["Capacidade", bytes(d?.size_bytes)],
                  ["Transporte", d?.transport],
                ]),
              )
              .join("")
          : notice("Discos físicos não informados.")
      }<h3>SMART e temperatura de disco</h3>${inspect(s?.hardware_health?.smart)}<h3>Filesystem /</h3>${inspect(s?.storage?.root_filesystem)}<h3>Inodes</h3>${inspect(s?.storage?.root_inodes)}${(i?.host?.role || n.role) === "proxmox" ? `<h3>Storages Proxmox</h3>${inspect(s?.platform?.proxmox?.storage)}` : ""}`,
    )}
    ${section(
      "network",
      "Rede",
      facts([
        ["Gateway", net?.default_gateway],
        ["DNS", array(net?.dns_servers).join(", ") || null],
      ]) +
        `<h3>Interfaces</h3><div class="interfaces">${
          array(net?.interfaces)
            .map(
              (face) =>
                `<article><strong>${escape(face?.name)}</strong><span>${escape(array(face?.ipv4).join(", ") || "Sem endereço IPv4")}</span><small>MAC ${escape(face?.mac)}</small></article>`,
            )
            .join("") || notice("Interfaces não informadas.")
        }</div><p class="muted">O inventário não informa o tipo ou as portas das bridges.</p>`,
    )}
    ${section(
      "health",
      "Saúde e segurança",
      facts([
        ["Firewall", s?.security?.firewall?.status],
        [
          "Sincronização",
          `${value(s?.time_sync?.provider)} / ${value(s?.time_sync?.status)}`,
        ],
        ["Referência NTP", s?.time_sync?.reference],
        ["Stratum", s?.time_sync?.stratum],
        ["System time", s?.time_sync?.system_time],
        ["Journal", s?.system?.journal_usage],
      ]) +
        `<h3>Issues</h3>${inspect(s?.health?.issues)}<h3>Unidades com falha</h3>${inspect(s?.system?.failed_units)}<h3>Serviços monitorados</h3>${inspect(s?.services)}<details><summary>Thresholds de monitoramento</summary>${inspect(s?.monitoring?.thresholds)}</details><details><summary>Transições de saúde</summary>${inspect(s?.health?.transitions)}</details>`,
    )}
    ${
      g
        ? section(
            "guests",
            "Guests",
            fresh(g.generated_at) +
              facts([
                ["Total", g.summary?.total],
                ["Running", g.summary?.running],
                ["Stopped", g.summary?.stopped],
                ["QEMU", g.summary?.qemu],
                ["LXC", g.summary?.lxc],
              ]) +
              (Array.isArray(g.guests)
                ? guests.length
                  ? `<ul class="guest-list">${guests.map((guest) => `<li><a href="${route(n)}/guests/${encodeURIComponent(guest?.vmid)}">${escape(guest?.name)} <small>${escape(guest?.type)} / ${escape(guest?.vmid)}</small></a><span>${escape(guest?.status)}</span></li>`).join("")}</ul>`
                  : notice("Nenhuma VM ou container configurado neste nó.")
                : notice("guests.json: lista de guests ausente ou inválida.")),
          )
        : ""
    }
    </div>`
  );
}
function render(focus = false) {
  const parts = location.hash.slice(1).split("/").filter(Boolean);
  const node =
    parts[0] === "hosts" ? state.nodes.find((n) => n.id === parts[1]) : null;
  const valid =
    !parts.length ||
    (parts[0] === "hosts" &&
      node &&
      (parts.length === 2 || (parts.length === 4 && parts[2] === "guests")));
  main.innerHTML = state.error
    ? `<h1>Não foi possível carregar os hosts</h1>${notice(state.error + ". Confira o índice e tente Atualizar dados.")}`
    : valid
      ? node
        ? hostView(node, parts[3])
        : overview()
      : `<h1>Página não encontrada</h1><a href="#/">Voltar ao Homelab</a>`;
  if (state.example)
    main.insertAdjacentHTML(
      "afterbegin",
      '<p class="example-banner">Ambiente de demonstração · fixtures de desenvolvimento, sem telemetria ao vivo.</p>',
    );
  document.title = `${node ? name(node) : "Visão geral"} · Homelab`;
  document.querySelector("#nodes-nav").innerHTML =
    `<a href="#/" ${!parts.length ? 'aria-current="page"' : ""}>Visão geral</a>${state.nodes.map((n) => `<a href="${route(n)}" ${node?.id === n.id ? 'aria-current="page"' : ""}>${escape(name(n))}<span class="nav-health ${health(n).toLowerCase()}">${health(n)}</span></a>`).join("")}`;
  if (focus) {
    main.focus();
    window.scrollTo(0, 0);
  }
}
async function load() {
  refresh.disabled = true;
  refresh.textContent = "Carregando…";
  state = await loadDashboard(indexURL);
  render();
  refresh.disabled = false;
  refresh.textContent = "Atualizar dados";
  document.querySelector("#announcement").textContent =
    state.error || `${state.nodes.length} hosts carregados.`;
}
refresh.addEventListener("click", load);
window.addEventListener("hashchange", () => render(true));
main.addEventListener("click", (event) => {
  const link = event.target.closest("[data-section]");
  if (!link) return;
  event.preventDefault();
  const target = document.getElementById(link.dataset.section);
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: "instant", block: "start" });
});
setInterval(
  () =>
    document.querySelectorAll("[data-timestamp]").forEach((el) => {
      const next = freshness(el.dataset.timestamp);
      el.textContent = next.text;
      el.classList.toggle("stale", next.stale);
    }),
  30000,
);
load();
