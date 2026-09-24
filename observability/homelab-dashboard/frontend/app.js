/* ============================================================
   pve-01 · Homelab Inventory — dashboard data & render
   ============================================================ */

/* ---------- icons ---------- */
function icon(inner) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

const ICONS = {
  grid: icon('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>'),
  cpu: icon('<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="2" x2="9" y2="4"/><line x1="15" y1="2" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="22"/><line x1="15" y1="20" x2="15" y2="22"/><line x1="2" y1="9" x2="4" y2="9"/><line x1="2" y1="15" x2="4" y2="15"/><line x1="20" y1="9" x2="22" y2="9"/><line x1="20" y1="15" x2="22" y2="15"/>'),
  memory: icon('<rect x="3" y="6" width="18" height="12" rx="1.5"/><line x1="7" y1="9" x2="7" y2="15"/><line x1="10" y1="9" x2="10" y2="15"/><line x1="14" y1="9" x2="14" y2="15"/><line x1="17" y1="9" x2="17" y2="15"/>'),
  disk: icon('<line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="10.01" y2="16"/>'),
  network: icon('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
  terminal: icon('<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>'),
  shield: icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  alert: icon('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
  clock: icon('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
  thermo: icon('<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>'),
  server: icon('<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>'),
  info: icon('<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'),
  check: icon('<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'),
  wifi: icon('<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>'),
  chevron: icon('<polyline points="9 18 15 12 9 6"/>'),
  close: icon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
};

const K8S_LOGO =
  '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
  '<polygon points="24,4 39.64,11.53 43.5,28.45 32.68,42.02 15.32,42.02 4.5,28.45 8.36,11.53" fill="#326CE5"/>' +
  '<g stroke="#ffffff" stroke-width="1.8" stroke-linecap="round">' +
  '<line x1="24" y1="24" x2="24" y2="4"/><line x1="24" y1="24" x2="39.64" y2="11.53"/>' +
  '<line x1="24" y1="24" x2="43.5" y2="28.45"/><line x1="24" y1="24" x2="32.68" y2="42.02"/>' +
  '<line x1="24" y1="24" x2="15.32" y2="42.02"/><line x1="24" y1="24" x2="4.5" y2="28.45"/>' +
  '<line x1="24" y1="24" x2="8.36" y2="11.53"/></g>' +
  '<g fill="#ffffff">' +
  '<circle cx="24" cy="10" r="2.1"/><circle cx="34.95" cy="15.27" r="2.1"/><circle cx="37.65" cy="27.12" r="2.1"/>' +
  '<circle cx="30.07" cy="36.61" r="2.1"/><circle cx="17.93" cy="36.61" r="2.1"/><circle cx="10.35" cy="27.12" r="2.1"/>' +
  '<circle cx="13.05" cy="15.27" r="2.1"/></g>' +
  '<circle cx="24" cy="24" r="6" fill="#326CE5" stroke="#ffffff" stroke-width="2"/>' +
  '</svg>';

/* ---------- alerts ---------- */
const ALERTS = [
  { sev: 'warn', title: 'Firewall do Proxmox desativado', desc: 'O serviço pve-firewall está ativo, mas as regras estão desabilitadas (disabled/running). Nenhum cluster.fw ou host.fw foi definido.', src: 'Segurança', rec: 'Habilitar o firewall no Datacenter e criar regras para o nó pve-01.' },
  { sev: 'warn', title: 'CPU vulnerável — Gather Data Sampling', desc: 'GDS reporta "Vulnerable: No microcode". O microcode atual é 0xf0, considerado antigo.', src: 'CPU', rec: 'Atualizar o pacote intel-microcode e reiniciar o nó.' },
  { sev: 'warn', title: 'SMT exposto (MDS / MMIO / L1TF)', desc: 'Mitigações ativas, mas com SMT (hyperthreading) ligado o risco de vazamento de dados permanece.', src: 'CPU', rec: 'Manter as mitigações; considerar desativar SMT no BIOS se a carga permitir.' },
  { sev: 'warn', title: 'Firmware (BIOS) desatualizado', desc: 'Versão 8RCN47WW, datada de 2018-09-27 — cerca de 7 anos e 11 meses sem atualização.', src: 'Hardware', rec: 'Verificar BIOS mais recente no site da Lenovo para o ideapad 330-15IKB.' },
  { sev: 'info', title: 'Slot de memória vazio', desc: 'Apenas 4 GB instalados (ChannelA-DIMM0). O ChannelB-DIMM0 está vazio; a placa suporta até 32 GB.', src: 'Hardware', rec: 'Adicionar um pente DDR4 SODIMM para ampliar a RAM.' },
  { sev: 'info', title: 'Wi-Fi desativada', desc: 'A interface wlp2s0 (Intel Dual Band AC 3165) está DOWN.', src: 'Rede', rec: 'Habilitar a interface se houver necessidade de conexão sem fio.' },
  { sev: 'info', title: 'lm-sensors não instalado', desc: 'O pacote lm-sensors está ausente; as leituras de temperatura dependem de /sys/class/thermal.', src: 'Sistema', rec: 'Instalar com "apt install lm-sensors".' },
  { sev: 'info', title: 'SGX desabilitado no BIOS', desc: 'x86/cpu: SGX disabled or unsupported by BIOS.', src: 'CPU', rec: 'Habilitar SGX no BIOS caso necessário.' },
];

const SEV = { crit: { label: 'Crítico', icon: ICONS.alert, cls: 'sev-crit' }, warn: { label: 'Aviso', icon: ICONS.alert, cls: 'sev-warn' }, info: { label: 'Informação', icon: ICONS.info, cls: 'sev-info' } };

/* ---------- detail (modal) data ---------- */
const g = (title, rows) => ({ title, rows });
const t = (title, head, rows) => ({ title, table: { head, rows } });

const DETAILS = {
  cpu: {
    icon: ICONS.cpu, title: 'CPU', sub: 'Intel Core i3-6006U',
    groups: [
      g('Identificação', [
        ['Modelo', 'Intel(R) Core(TM) i3-6006U @ 2.00GHz'],
        ['Vendor / família', 'GenuineIntel · família 6, modelo 78'],
        ['Núcleos / threads', '2 núcleos físicos · 2 threads por núcleo'],
        ['CPUs lógicas', '4 (on-line 0–3)'],
        ['Virtualização', 'VT-x (VMX)'],
        ['Clock', 'máx 2.00 GHz · mín 400 MHz'],
      ]),
      g('Cache', [
        ['L1d / L1i', '64 KiB / 64 KiB (2 instâncias)'],
        ['L2', '512 KiB (2 instâncias)'],
        ['L3', '3 MiB (1 instância)'],
      ]),
      g('NUMA', [
        ['Nós NUMA', '1'],
        ['CPU do nó 0', '0–3'],
      ]),
      t('Vulnerabilidades', ['Vulnerabilidade', 'Status'], [
        ['Gather Data Sampling', '<span class="pill pill--crit">Vulnerable: No microcode</span>'],
        ['Meltdown', '<span class="pill pill--ok">Mitigation: PTI</span>'],
        ['Spectre v1', '<span class="pill pill--ok">Mitigation</span>'],
        ['Spectre v2', '<span class="pill pill--ok">Mitigation: IBRS</span>'],
        ['MDS', '<span class="pill pill--warn">Mitigation · SMT vulnerable</span>'],
        ['MMIO Stale Data', '<span class="pill pill--warn">Mitigation · SMT vulnerable</span>'],
        ['L1TF', '<span class="pill pill--warn">Mitigation · SMT vulnerable</span>'],
        ['Retbleed', '<span class="pill pill--ok">Mitigation: IBRS</span>'],
        ['SRBDS', '<span class="pill pill--ok">Mitigation: Microcode</span>'],
        ['VMScape', '<span class="pill pill--ok">Mitigation: IBPB</span>'],
      ]),
    ],
  },
  mem: {
    icon: ICONS.memory, title: 'Memória', sub: 'Uso e módulos físicos',
    groups: [
      g('Uso atual', [
        ['Total', '3,7 GiB'],
        ['Usada', '1,5 GiB'],
        ['Livre', '2,1 GiB'],
        ['Buff / cache', '369 MiB'],
        ['Disponível', '2,2 GiB'],
        ['Swap', '0 B usados de 4,0 GiB'],
      ]),
      t('Módulos físicos (SMBIOS)', ['Slot', 'Fabricante', 'Modelo', 'Capacidade', 'Velocidade'], [
        ['ChannelA-DIMM0', 'SK Hynix', 'HMA851S6CJR6N-VK', '4 GB', '2133 MT/s'],
        ['ChannelB-DIMM0', '—', '—', 'vazio', '—'],
      ]),
      g('Placa-mãe', [
        ['Capacidade máxima', '32 GB'],
        ['Fator de forma', 'SODIMM'],
        ['Tipo', 'DDR4 · unbuffered'],
        ['Tensão', '1,2 V (configurada)'],
      ]),
    ],
  },
  disk: {
    icon: ICONS.disk, title: 'Armazenamento', sub: 'Disco, partições e LVM',
    groups: [
      g('Disco físico (SMART)', [
        ['Dispositivo', 'sda · SSD P4-120'],
        ['Serial', '9110401D00542'],
        ['Capacidade', '120 GB (120.034.123.776 bytes)'],
        ['Firmware', 'SN07542'],
        ['Interface', 'SATA 3.2 · 6,0 Gb/s'],
        ['Saúde SMART', '<span class="pill pill--ok">PASSED</span>'],
        ['Temperatura', '35 °C (min 25 / máx 39)'],
        ['Power-on hours', '2.344 h'],
        ['Power cycles', '1.400'],
      ]),
      t('Partições', ['Partição', 'Tamanho', 'Tipo', 'Sistema de arquivos'], [
        ['sda1', '1007K', 'part', '—'],
        ['sda2', '1 GB', 'part', 'vfat (FAT32)'],
        ['sda3', '110 GB', 'part', 'LVM2 member'],
      ]),
      t('Volumes LVM', ['Volume', 'Tamanho', 'Sistema de arquivos', 'Ponto de montagem'], [
        ['pve-root', '38,5 GB', 'ext4', '/'],
        ['pve-swap', '4 GB', 'swap', '[SWAP]'],
        ['pve-data', '51,9 GB', 'thin pool', '—'],
      ]),
      g('Uso do sistema de arquivos', [
        ['/', '38 GB · 4,1 GB usados · 12%'],
        ['/etc/pve', 'fuse · 16 KB usados'],
      ]),
    ],
  },
  net: {
    icon: ICONS.network, title: 'Rede', sub: 'Interfaces, bridge e rotas',
    groups: [
      g('Bridge principal', [
        ['Interface', 'vmbr0'],
        ['Endereço', '192.168.15.200/24'],
        ['Gateway', '192.168.15.1'],
        ['Porta física', 'nic0 (RTL8111/8168, driver r8169)'],
        ['VLAN', '1 (PVID, egress untagged)'],
      ]),
      t('Interfaces', ['Interface', 'Estado', 'Endereço', 'Driver'], [
        ['lo', '<span class="pill pill--info">loopback</span>', '127.0.0.1/8', '—'],
        ['nic0', '<span class="pill pill--ok">UP</span>', '—', 'r8169'],
        ['wlp2s0', '<span class="pill pill--warn">DOWN</span>', '—', 'iwlwifi'],
        ['vmbr0', '<span class="pill pill--ok">UP</span>', '192.168.15.200/24', 'bridge'],
      ]),
      t('Rotas', ['Rede', 'Via', 'Dispositivo'], [
        ['default', '192.168.15.1', 'vmbr0'],
        ['192.168.15.0/24', '—', 'vmbr0'],
      ]),
      g('DNS', [
        ['Domínio de busca', 'home.arpa'],
        ['Nameserver', '192.168.15.1'],
        ['Hosts', 'pve-01.home.arpa → 192.168.15.200'],
      ]),
    ],
  },
  temp: {
    icon: ICONS.thermo, title: 'Temperatura', sub: 'Zonas térmicas',
    groups: [
      g('Leituras', [
        ['x86_pkg_temp', '40,0 °C'],
        ['pch_skylake', '36,5 °C'],
        ['iwlwifi_1', 'sem leitura disponível'],
      ]),
      g('Observações', [
        ['lm-sensors', 'não instalado'],
        ['Fonte', '/sys/class/thermal/thermal_zone*'],
        ['Disco (SMART)', '35 °C'],
      ]),
    ],
  },
  uptime: {
    icon: ICONS.clock, title: 'Uptime & carga', sub: 'Estado no momento do inventário',
    groups: [
      g('Sistema', [
        ['Uptime', '29 min'],
        ['Usuários logados', '1'],
        ['Load average', '0,73 / 0,75 / 0,68 (1/5/15 min)'],
      ]),
      g('Identidade', [
        ['Hostname', 'pve-01'],
        ['FQDN', 'pve-01.home.arpa'],
        ['Sistema', 'Debian GNU/Linux 13 (trixie)'],
        ['Kernel', 'Linux 7.0.2-6-pve'],
        ['Arquitetura', 'x86-64'],
      ]),
      g('Hardware', [
        ['Fabricante', 'Lenovo'],
        ['Modelo', 'ideapad 330-15IKB'],
        ['Chassis', 'laptop'],
        ['Serial', 'PE0425VB'],
        ['Firmware', '8RCN47WW (2018-09-27)'],
      ]),
    ],
  },
  proxmox: {
    icon: ICONS.server, title: 'Proxmox VE', sub: 'Stack e serviços',
    groups: [
      g('Versões', [
        ['proxmox-ve', '9.2.0 (kernel 7.0.2-6-pve)'],
        ['pve-manager', '9.2.2'],
        ['pve-kernel', '7.0.2-6'],
        ['qemu-server', '9.1.15'],
        ['pve-container', '6.1.10'],
        ['ceph-fuse', '19.2.3-pve4'],
        ['zfsutils-linux', '2.4.2-pve1'],
      ]),
      g('Serviços', [
        ['pveproxy (web)', 'ativo · porta 8006'],
        ['pvedaemon', 'ativo · porta 85'],
        ['spiceproxy', 'ativo · porta 3128'],
        ['pve-firewall', 'ativo · regras desabilitadas'],
      ]),
    ],
  },
  firmware: {
    icon: ICONS.info, title: 'Firmware & BIOS', sub: '8RCN47WW',
    groups: [
      g('Versão', [
        ['Versão', '8RCN47WW'],
        ['Data', '2018-09-27 (qui)'],
        ['Idade', '7 anos, 11 meses, 2 semanas e 3 dias'],
      ]),
      g('Boot', [
        ['Kernel cmdline', 'BOOT_IMAGE=/boot/vmlinuz-7.0.2-6-pve root=/dev/mapper/pve-root ro quiet'],
        ['GRUB', 'GRUB_DEFAULT=0 · timeout 0 · estilo hidden'],
      ]),
    ],
  },
  ssh: {
    icon: ICONS.terminal, title: 'SSH', sub: 'OpenBSD Secure Shell',
    groups: [
      g('Serviço', [
        ['Estado', '<span class="pill pill--ok">enabled · active</span>'],
        ['Porta', '22'],
        ['Listen address', '0.0.0.0 e [::]'],
      ]),
      g('Configuração efetiva', [
        ['PermitRootLogin', 'yes'],
        ['PasswordAuthentication', 'yes'],
        ['PubkeyAuthentication', 'yes'],
        ['KbdInteractiveAuthentication', 'no'],
        ['MaxAuthTries', '6'],
        ['LoginGraceTime', '120 s'],
        ['UsePAM', 'yes'],
      ]),
    ],
  },
  firewall: {
    icon: ICONS.shield, title: 'Firewall', sub: 'pve-firewall',
    groups: [
      g('Estado', [
        ['Status', '<span class="pill pill--warn">disabled/running</span>'],
        ['Serviço', 'pve-firewall.service · enabled · active'],
        ['cluster.fw', 'inexistente'],
        ['host.fw', 'inexistente'],
      ]),
      g('Recomendação', [
        ['Ação', 'Habilitar o firewall e definir regras no Datacenter e no nó.'],
      ]),
    ],
  },
  time: {
    icon: ICONS.clock, title: 'Data & NTP', sub: 'chrony',
    groups: [
      g('Horário', [
        ['Fuso', 'America/Sao_Paulo (-03, -0300)'],
        ['NTP', '<span class="pill pill--ok">active</span>'],
        ['Relógio sincronizado', 'sim'],
        ['RTC em TZ local', 'não'],
      ]),
      g('chrony', [
        ['Serviço', 'enabled · active'],
        ['Versão', '4.6.1'],
        ['Fontes', '2.debian.pool.ntp.org (200.160.7.193)'],
      ]),
    ],
  },
};

/* ---------- small helpers ---------- */
const m = (v) => `<span class="mono">${v}</span>`;
const pill = (text, cls) => `<span class="pill pill--${cls}">${text}</span>`;

function tableHTML(head, rows) {
  return `<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function cardHTML({ id, icon, title, value, unit = '', sub = '', status = '', accent = false, meter }) {
  const meterHTML = meter ? `<div class="meter"><div class="meter__fill ${meter.cls || ''}" style="width:${meter.pct}%"></div></div>` : '';
  return `<article class="card ${accent ? 'card--accent' : ''}" data-card="${id}" tabindex="0" role="button" aria-label="Ver detalhes de ${title}">
    ${status ? `<span class="card__status status-${status}"></span>` : ''}
    <div class="card__top"><span class="card__icon">${icon}</span><span class="card__title">${title}</span></div>
    <div class="card__value">${value}${unit ? ` <span class="card__unit">${unit}</span>` : ''}</div>
    ${sub ? `<div class="card__sub">${sub}</div>` : ''}
    ${meterHTML}
  </article>`;
}

/* ---------- layout ---------- */
const NAV = [
  { id: 'overview', label: 'Visão Geral', icon: ICONS.grid },
  { id: 'hardware', label: 'Hardware', icon: ICONS.cpu },
  { id: 'storage', label: 'Armazenamento', icon: ICONS.disk },
  { id: 'network', label: 'Rede', icon: ICONS.network },
  { id: 'system', label: 'Sistema', icon: ICONS.terminal },
  { id: 'security', label: 'Segurança', icon: ICONS.shield },
  { id: 'alerts', label: 'Alertas', icon: ICONS.alert, badge: ALERTS.length },
];

function sectionHead(id, title, hint = '') {
  return `<section class="section" id="${id}"><div class="section__head"><h2 class="section__title">${title}</h2>${hint ? `<span class="section__hint">${hint}</span>` : ''}</div>`;
}

function render() {
  const alertCounts = {
    crit: ALERTS.filter((a) => a.sev === 'crit').length,
    warn: ALERTS.filter((a) => a.sev === 'warn').length,
    info: ALERTS.filter((a) => a.sev === 'info').length,
  };

  const hero = `
    <section class="hero">
      <div class="hero__mark">${K8S_LOGO}</div>
      <div class="hero__body">
        <h2>pve-01</h2>
        <p class="hero__os">${m('pve-01.home.arpa')} · Debian GNU/Linux 13 (trixie) · ${m('7.0.2-6-pve')}</p>
        <p class="hero__os">Lenovo ideapad 330-15IKB · Proxmox VE 9.2.2</p>
      </div>
      <div class="hero__stats">
        <div class="hero__stat"><span class="num">29 min</span><span class="lbl">uptime</span></div>
        <div class="hero__stat"><span class="num">0,73</span><span class="lbl">load 1min</span></div>
        <div class="hero__stat"><span class="num">4,1 GiB</span><span class="lbl">disco usado</span></div>
        <div class="hero__stat"><span class="num">40 °C</span><span class="lbl">cpu package</span></div>
      </div>
    </section>`;

  const overviewCards = `
    <div class="grid">
      ${cardHTML({ id: 'cpu', icon: ICONS.cpu, title: 'CPU', value: '4', unit: 'vCPU', sub: `${m('i3-6006U')} · 2.00 GHz · VT-x`, status: 'ok', meter: { pct: 37, cls: 'meter__fill--ok' } })}
      ${cardHTML({ id: 'mem', icon: ICONS.memory, title: 'Memória', value: '1,5', unit: 'GiB usados', sub: `de 3,7 GiB · swap 0 / 4 GiB`, status: 'ok', meter: { pct: 41 } })}
      ${cardHTML({ id: 'disk', icon: ICONS.disk, title: 'Disco', value: '12%', unit: 'raiz', sub: `${m('/dev/sda')} SSD 120 GB · SMART OK`, status: 'ok', meter: { pct: 12, cls: 'meter__fill--ok' } })}
      ${cardHTML({ id: 'net', icon: ICONS.network, title: 'Rede', value: 'vmbr0', unit: '', sub: `${m('192.168.15.200')} · 2 interfaces up`, status: 'ok' })}
      ${cardHTML({ id: 'temp', icon: ICONS.thermo, title: 'Temperatura', value: '40', unit: '°C', sub: `package · 36,5 °C pch · 35 °C disco`, status: 'ok' })}
      ${cardHTML({ id: 'uptime', icon: ICONS.clock, title: 'Uptime', value: '29', unit: 'min', sub: 'load 0,73 · 1 usuário', status: 'ok' })}
    </div>`;

  const alertsStrip = `
    <div class="alerts__strip">
      <button class="alerts__chip alerts__chip--crit" data-scroll="alerts">${ICONS.alert} ${alertCounts.crit} críticos</button>
      <button class="alerts__chip alerts__chip--warn" data-scroll="alerts">${ICONS.alert} ${alertCounts.warn} avisos</button>
      <button class="alerts__chip alerts__chip--info" data-scroll="alerts">${ICONS.info} ${alertCounts.info} informativos</button>
    </div>`;

  const overview = `<section class="section" id="overview">${hero}<div style="margin-top:16px;display:flex;flex-direction:column;gap:16px">${overviewCards}${alertsStrip}</div></section>`;

  const hardware = `${sectionHead('hardware', 'Hardware')}
    <div class="grid">
      ${cardHTML({ id: 'cpu', icon: ICONS.cpu, title: 'CPU', value: 'Intel i3-6006U', sub: '2 núcleos · 4 threads · 2.00 GHz · VT-x', accent: true })}
      ${cardHTML({ id: 'mem', icon: ICONS.memory, title: 'Memória', value: '4 GB', unit: 'DDR4', sub: 'SK Hynix · 2133 MT/s · 1 slot livre', accent: true })}
      ${cardHTML({ id: 'firmware', icon: ICONS.info, title: 'Firmware', value: '8RCN47WW', sub: '2018-09-27 · 7 anos 11 meses', accent: true })}
      ${cardHTML({ id: 'temp', icon: ICONS.thermo, title: 'Térmicas', value: '40 °C', sub: 'package · 36,5 °C pch', accent: true })}
      ${cardHTML({ id: 'proxmox', icon: ICONS.server, title: 'Proxmox VE', value: '9.2.2', sub: 'kernel 7.0.2-6-pve', accent: true })}
    </div>
  </section>`;

  const storage = `${sectionHead('storage', 'Armazenamento', 'disco, partições, LVM e SMART')}
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="grid">
        ${cardHTML({ id: 'disk', icon: ICONS.disk, title: 'Disco sda', value: '120 GB', unit: 'SSD', sub: 'P4-120 · SATA 3.2 · SMART PASSED', accent: true })}
        ${cardHTML({ id: 'proxmox', icon: ICONS.server, title: 'Storage Proxmox', value: '2', unit: 'ativos', sub: 'local (dir) · local-lvm (lvmthin)', accent: true })}
      </div>
      ${tableHTML(['Volume', 'Tamanho', 'Tipo', 'Sistema de arquivos', 'Ponto de montagem'], [
        ['sda', '111,8 GB', 'disk', '—', '—'],
        ['├─ sda2', '1 GB', 'part', 'vfat', '—'],
        ['└─ sda3', '110 GB', 'part', 'LVM2_member', '—'],
        ['&nbsp;&nbsp;&nbsp;├─ pve-swap', '4 GB', 'lvm', 'swap', '[SWAP]'],
        ['&nbsp;&nbsp;&nbsp;├─ pve-root', '38,5 GB', 'lvm', 'ext4', '/'],
        ['&nbsp;&nbsp;&nbsp;└─ pve-data', '51,9 GB', 'lvm', 'thin pool', '—'],
      ])}
      ${tableHTML(['Storage Proxmox', 'Tipo', 'Status', 'Total', 'Usado', 'Disponível', 'Uso'], [
        ['local', 'dir', pill('active', 'ok'), '39,4 GiB', '4,2 GiB', '33,2 GiB', '10,65%'],
        ['local-lvm', 'lvmthin', pill('active', 'ok'), '54,4 GiB', '0', '54,4 GiB', '0,00%'],
      ])}
      ${tableHTML(['LVM', 'Tipo', 'Tamanho', 'Volume group'], [
        ['/dev/sda3', 'PV', '110 GB', 'pve'],
        ['data', 'LV (thin)', '51,87 GB', 'pve'],
        ['root', 'LV', '38,50 GB', 'pve'],
        ['swap', 'LV', '4,00 GB', 'pve'],
      ])}
    </div>
  </section>`;

  const network = `${sectionHead('network', 'Rede', 'interfaces, bridge, rotas e portas')}
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="grid">
        ${cardHTML({ id: 'net', icon: ICONS.network, title: 'vmbr0', value: '192.168.15.200', sub: 'bridge sobre nic0 · gateway 192.168.15.1', accent: true })}
        ${cardHTML({ id: 'ssh', icon: ICONS.terminal, title: 'SSH', value: '22', unit: 'porta', sub: 'ativo · PermitRootLogin yes', accent: true })}
      </div>
      ${tableHTML(['Interface', 'Estado', 'Endereço', 'Driver'], [
        ['lo', pill('loopback', 'info'), '127.0.0.1/8', '—'],
        ['nic0', pill('UP', 'ok'), '—', 'r8169'],
        ['wlp2s0', pill('DOWN', 'warn'), '—', 'iwlwifi'],
        ['vmbr0', pill('UP', 'ok'), '192.168.15.200/24', 'bridge'],
      ])}
      ${tableHTML(['Porta', 'Protocolo', 'Processo', 'Serviço'], [
        ['22', 'tcp', 'sshd', 'SSH'],
        ['8006', 'tcp', 'pveproxy', 'Proxmox web UI'],
        ['3128', 'tcp', 'spiceproxy', 'SPICE'],
        ['85', 'tcp', 'pvedaemon', 'API local'],
        ['111', 'tcp/udp', 'rpcbind', 'RPC'],
        ['25', 'tcp', 'master (postfix)', 'SMTP local'],
        ['323', 'udp', 'chronyd', 'NTP'],
      ])}
    </div>
  </section>`;

  const system = `${sectionHead('system', 'Sistema', 'SO, serviços, horário e repositórios')}
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="grid">
        ${cardHTML({ id: 'uptime', icon: ICONS.clock, title: 'Sistema operacional', value: 'Debian 13', sub: 'trixie · x86-64 · pt_BR.UTF-8', accent: true })}
        ${cardHTML({ id: 'time', icon: ICONS.clock, title: 'Horário', value: 'America/São_Paulo', sub: 'NTP ativo · chrony 4.6.1', accent: true })}
        ${cardHTML({ id: 'proxmox', icon: ICONS.server, title: 'Serviços', value: '3', unit: 'essenciais', sub: 'ssh · chrony · pve-firewall', accent: true })}
      </div>
      ${tableHTML(['Serviço', 'Estado', 'Observação'], [
        ['ssh', pill('enabled · active', 'ok'), 'porta 22'],
        ['chrony', pill('enabled · active', 'ok'), 'NTP sincronizado'],
        ['pve-firewall', pill('enabled · active', 'ok'), 'regras desabilitadas'],
      ])}
      ${tableHTML(['Repositório', 'Suíte', 'Componentes'], [
        ['enterprise.proxmox.com (pve)', 'trixie', 'pve-enterprise'],
        ['enterprise.proxmox.com (ceph-squid)', 'trixie', 'enterprise'],
        ['deb.debian.org', 'trixie, trixie-updates', 'main, contrib, non-free-firmware'],
        ['security.debian.org', 'trixie-security', 'main, contrib, non-free-firmware'],
      ])}
      ${tableHTML(['Configuração de energia', 'Valor'], [
        ['HandleLidSwitch', 'ignore (tampa do laptop)'],
        ['sleep / suspend / hibernate', 'masked'],
        ['Teclado interno', 'desabilitado via serio0/unbind'],
      ])}
    </div>
  </section>`;

  const security = `${sectionHead('security', 'Segurança', 'firewall, SSH e vulnerabilidades de CPU')}
    <div style="display:flex;flex-direction:column;gap:14px">
      <div class="grid">
        ${cardHTML({ id: 'firewall', icon: ICONS.shield, title: 'Firewall', value: 'disabled', sub: 'pve-firewall rodando, sem regras', accent: true, status: 'warn' })}
        ${cardHTML({ id: 'ssh', icon: ICONS.terminal, title: 'SSH', value: 'root', unit: 'permitido', sub: 'senha e chave habilitadas', accent: true, status: 'warn' })}
      </div>
      ${tableHTML(['Vulnerabilidade', 'Status', 'Nível'], [
        ['Gather Data Sampling', 'Vulnerable: No microcode', pill('crítico', 'crit')],
        ['Meltdown', 'Mitigation: PTI', pill('ok', 'ok')],
        ['Spectre v1 / v2', 'Mitigation', pill('ok', 'ok')],
        ['MDS', 'Mitigation · SMT vulnerable', pill('aviso', 'warn')],
        ['MMIO Stale Data', 'Mitigation · SMT vulnerable', pill('aviso', 'warn')],
        ['L1TF', 'Mitigation · SMT vulnerable', pill('aviso', 'warn')],
        ['Retbleed', 'Mitigation: IBRS', pill('ok', 'ok')],
      ])}
    </div>
  </section>`;

  const alertsList = `${sectionHead('alerts', 'Alertas', `${alertCounts.warn} avisos · ${alertCounts.info} informativos`)}
    <div class="alert-list">
      ${ALERTS.map((a, i) => {
        const s = SEV[a.sev];
        return `<article class="alert" data-alert="${i}" tabindex="0" role="button">
          <span class="alert__sev ${s.cls}">${s.icon}</span>
          <div class="alert__body">
            <div class="alert__title">${a.title}</div>
            <div class="alert__desc">${a.desc}</div>
            <div class="alert__meta"><span class="tag">${s.label}</span><span class="tag">${a.src}</span></div>
          </div>
          <span class="alert__arrow">${ICONS.chevron}</span>
        </article>`;
      }).join('')}
    </div>
  </section>`;

  document.getElementById('main').innerHTML = overview + hardware + storage + network + system + security + alertsList;
}

/* ---------- modal ---------- */
function modalGroupHTML(group) {
  if (group.table) {
    return `<div class="dgroup"><h3 class="dgroup__title">${group.title}</h3>${tableHTML(group.table.head, group.table.rows)}</div>`;
  }
  return `<div class="dgroup"><h3 class="dgroup__title">${group.title}</h3>
    <div class="kv">${group.rows.map(([k, v]) => `<div class="kv__row"><span class="kv__k">${k}</span><span class="kv__v">${v}</span></div>`).join('')}</div>
  </div>`;
}

function openDetail(id) {
  const d = DETAILS[id];
  if (!d) return;
  document.getElementById('modalPanel').innerHTML = `
    <div class="modal__head">
      <span class="modal__icon">${d.icon}</span>
      <div><h2 class="modal__title">${d.title}</h2><p class="modal__sub">${d.sub}</p></div>
      <button class="modal__close" id="modalClose" aria-label="Fechar">${ICONS.close}</button>
    </div>
    <div class="modal__body">${d.groups.map(modalGroupHTML).join('')}</div>`;
  openModal();
}

function openAlert(i) {
  const a = ALERTS[i];
  const s = SEV[a.sev];
  document.getElementById('modalPanel').innerHTML = `
    <div class="modal__head">
      <span class="modal__icon ${s.cls}" style="color:var(--${a.sev === 'info' ? 'info' : a.sev === 'warn' ? 'warn' : 'crit'});background:var(--${a.sev}-soft)">${s.icon}</span>
      <div><h2 class="modal__title">${a.title}</h2><p class="modal__sub">${a.src}</p></div>
      <button class="modal__close" id="modalClose" aria-label="Fechar">${ICONS.close}</button>
    </div>
    <div class="modal__body">
      <div class="dgroup"><h3 class="dgroup__title">Descrição</h3><p style="margin:0;font-size:14px">${a.desc}</p></div>
      <div class="dgroup"><h3 class="dgroup__title">Recomendação</h3><p style="margin:0;font-size:14px">${a.rec}</p></div>
    </div>`;
  openModal();
}

function openModal() {
  document.getElementById('modal').classList.add('is-open');
  document.getElementById('modal').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal').classList.remove('is-open');
  document.getElementById('modal').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

/* ---------- nav ---------- */
function renderNav() {
  document.getElementById('nav').innerHTML = NAV.map((n) =>
    `<button class="nav__item" data-nav="${n.id}">${n.icon}<span>${n.label}</span>${n.badge ? `<span class="nav__badge">${n.badge}</span>` : ''}</button>`
  ).join('');
}

function setActive(id) {
  document.querySelectorAll('.nav__item').forEach((el) => el.classList.toggle('is-active', el.dataset.nav === id));
}

/* ---------- events ---------- */
function bindEvents() {
  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-card]');
    if (card) { openDetail(card.dataset.card); return; }

    const alertEl = e.target.closest('[data-alert]');
    if (alertEl) { openAlert(alertEl.dataset.alert); return; }

    const chip = e.target.closest('[data-scroll]');
    if (chip) { document.getElementById(chip.dataset.scroll).scrollIntoView({ behavior: 'smooth' }); return; }

    const nav = e.target.closest('[data-nav]');
    if (nav) {
      document.getElementById(nav.dataset.nav).scrollIntoView({ behavior: 'smooth' });
      document.getElementById('sidebar').classList.remove('is-open');
      return;
    }

    if (e.target.closest('#modalClose') || e.target.id === 'modalBackdrop') { closeModal(); return; }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.card, .alert')) {
      e.preventDefault();
      e.target.click();
    }
  });

  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('is-open');
  });

  const sections = NAV.map((n) => document.getElementById(n.id));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.id); });
  }, { rootMargin: '-40% 0px -55% 0px' });
  sections.forEach((s) => s && io.observe(s));
}

/* ---------- clock ---------- */
function tick() {
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString('pt-BR', { hour12: false });
}

/* ---------- boot ---------- */
document.getElementById('brandMark').innerHTML = K8S_LOGO;
document.getElementById('crumbs').textContent = 'Visão Geral';
renderNav();
render();
bindEvents();
tick();
setInterval(tick, 1000);
