const object = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
export async function readJSON(url, fetcher = fetch) {
  try {
    const response = await fetcher(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      return {
        data: null,
        error:
          response.status === 404
            ? "Arquivo ausente"
            : `Falha HTTP ${response.status}`,
      };
    let data;
    try {
      data = await response.json();
    } catch {
      return { data: null, error: "JSON inválido" };
    }
    if (!object(data)) return { data: null, error: "Esperado um objeto JSON" };
    if (data.schema_version !== 1)
      return {
        data: null,
        error: "schema_version ausente ou não suportado (esperado 1)",
      };
    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error:
        error.name === "TimeoutError"
          ? "Tempo de carregamento excedido"
          : "Falha de rede ao carregar arquivo",
    };
  }
}
export async function loadDashboard(indexURL, fetcher = fetch) {
  const index = await readJSON(indexURL, fetcher);
  if (index.error) return { nodes: [], error: `nodes.json: ${index.error}` };
  if (!Array.isArray(index.data.nodes))
    return { nodes: [], error: "nodes.json: lista nodes inválida" };
  const ids = new Set();
  for (const node of index.data.nodes) {
    if (
      !object(node) ||
      typeof node.id !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(node.id) ||
      ids.has(node.id) ||
      typeof node.data_path !== "string"
    ) {
      return {
        nodes: [],
        error: "nodes.json: nó inválido ou identificador duplicado",
      };
    }
    ids.add(node.id);
    try {
      const path = new URL(`${node.data_path.replace(/\/$/, "")}/`, indexURL);
      if (
        path.origin !== new URL(indexURL).origin ||
        !["http:", "https:"].includes(path.protocol) ||
        path.search ||
        path.hash
      )
        throw new Error();
    } catch {
      return {
        nodes: [],
        error:
          "nodes.json: data_path inválido; use um diretório HTTP na mesma origem",
      };
    }
  }
  const nodes = await Promise.all(
    index.data.nodes.map(async (entry) => {
      const base = new URL(`${entry.data_path.replace(/\/$/, "")}/`, indexURL);
      const files = ["inventory", "status", "guests"];
      const results = await Promise.all(
        files.map((file) => readJSON(new URL(`${file}.json`, base), fetcher)),
      );
      return {
        ...entry,
        ...Object.fromEntries(files.map((file, i) => [file, results[i]])),
      };
    }),
  );
  return { nodes, error: null, example: index.data.example === true };
}
