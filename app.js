"use strict";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const LANGUAGE_OPTIONS = [
  ["pt-BR", "Português (Brasil)"],
  ["en-US", "Inglês (Estados Unidos)"],
];
const LANGUAGE_FALLBACKS = {
  en: "en-US",
  "en-US": "en-US",
  "en-GB": "en-US",
  pt: "pt-BR",
  "pt-BR": "pt-BR",
  "pt-PT": "pt-BR",
};
const PORTUGUESE_HINTS = new Set([
  "a",
  "as",
  "ao",
  "aos",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
  "sem",
  "com",
  "analise",
  "avaliacao",
  "baseline",
  "comercial",
  "condicao",
  "contrato",
  "correcao",
  "data",
  "declinios",
  "empresas",
  "final",
  "fornecedor",
  "fornecedores",
  "gestor",
  "historico",
  "itens",
  "justificativa",
  "melhor",
  "monetaria",
  "motivo",
  "numero",
  "periodo",
  "processo",
  "proposta",
  "propostas",
  "quantidade",
  "requisicao",
  "respostas",
  "resultado",
  "resumo",
  "sumula",
  "tecnica",
  "tecnico",
  "valor",
  "vigencia",
]);
const state = {
  file: null,
  originalText: "",
  xml: null,
  fileNode: null,
  units: [],
  selected: new Set(),
  showLong: false,
  translator: null,
  translationAvailable: false,
  translationConfig: {
    sourceLanguage: "",
    targetLanguage: "",
    updateTargetLanguage: false,
  },
  newSequence: 0,
};
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const els = {
  uploadView: $("#uploadView"),
  appView: $("#appView"),
  fileInput: $("#fileInput"),
  dropZone: $("#dropZone"),
  uploadError: $("#uploadError"),
  fileName: $("#fileName"),
  fileSubline: $("#fileSubline"),
  statCards: $("#statCards"),
  fileAttributes: $("#fileAttributes"),
  qualityBars: $("#qualityBars"),
  headerSummary: $("#headerSummary"),
  headerTree: $("#headerTree"),
  fullTree: $("#fullTree"),
  translationsBody: $("#translationsBody"),
  resultCount: $("#resultCount"),
  emptyResults: $("#emptyResults"),
  searchInput: $("#searchInput"),
  statusFilter: $("#statusFilter"),
  tabCount: $("#tabCount"),
  detailDialog: $("#detailDialog"),
  dialogTitle: $("#dialogTitle"),
  dialogContent: $("#dialogContent"),
  sourceLanguage: $("#sourceLanguage"),
  targetLanguage: $("#targetLanguage"),
  translationSourceLanguage: $("#translationSourceLanguage"),
  translationTargetLanguage: $("#translationTargetLanguage"),
  updateTargetLanguage: $("#updateTargetLanguage"),
  targetLanguageExportNotice: $("#targetLanguageExportNotice"),
  translationAvailability: $("#translationAvailability"),
  selectedCount: $("#selectedCount"),
  translateBtn: $("#translateBtn"),
  selectAllVisible: $("#selectAllVisible"),
  addDialog: $("#addDialog"),
  newIdPrefix: $("#newIdPrefix"),
  newIdPreview: $("#newIdPreview"),
  newSource: $("#newSource"),
  newTarget: $("#newTarget"),
  newNote: $("#newNote"),
  translationProgress: $("#translationProgress"),
  translationProgressBar: $("#translationProgressBar"),
  translationProgressText: $("#translationProgressText"),
};

els.fileInput.addEventListener("change", (event) =>
  loadFile(event.target.files[0]),
);
["dragenter", "dragover"].forEach((type) =>
  els.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    els.dropZone.classList.add("dragging");
  }),
);
["dragleave", "drop"].forEach((type) =>
  els.dropZone.addEventListener(type, (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("dragging");
  }),
);
els.dropZone.addEventListener("drop", (event) =>
  loadFile(event.dataTransfer.files[0]),
);
$("#newFileBtn").addEventListener("click", resetApp);
$("#exportXlfBtn").addEventListener("click", exportXlf);
$("#exportCsvBtn").addEventListener("click", exportCsv);
$("#exportJsonBtn").addEventListener("click", exportJson);
$("#toggleLongValues").addEventListener("click", toggleLongValues);
$("#closeDialog").addEventListener("click", () => els.detailDialog.close());
$("#addUnitBtn").addEventListener("click", openAddDialog);
$("#selectSameBtn").addEventListener("click", selectSameUnits);
els.translateBtn.addEventListener("click", translateSelected);
els.selectAllVisible.addEventListener("change", selectAllVisible);
els.detailDialog.addEventListener("click", (event) => {
  if (event.target === els.detailDialog) els.detailDialog.close();
});
els.addDialog.addEventListener("click", (event) => {
  if (event.target === els.addDialog) els.addDialog.close();
});
$$(".close-add").forEach((button) =>
  button.addEventListener("click", () => els.addDialog.close()),
);
$("#addUnitForm").addEventListener("submit", addUnit);
[els.newIdPrefix, els.newSource].forEach((input) =>
  input.addEventListener("input", updateIdPreview),
);
els.searchInput.addEventListener("input", renderTranslations);
els.statusFilter.addEventListener("change", renderTranslations);
[els.translationSourceLanguage, els.translationTargetLanguage].forEach((input) =>
  input.addEventListener("change", updateTranslationConfig),
);
els.updateTargetLanguage.addEventListener("change", updateTranslationConfig);
$$(".tab").forEach((tab) =>
  tab.addEventListener("click", () => activateTab(tab.dataset.tab)),
);
setupLanguageSelects();

async function loadFile(file) {
  hideError();
  if (!file) return;
  if (!/\.(xlf|xliff)$/i.test(file.name))
    return showError("Selecione um arquivo com extensão .xlf ou .xliff.");
  if (file.size > MAX_FILE_SIZE)
    return showError("O arquivo ultrapassa o limite de 25 MB.");
  try {
    const text = await file.text();
    const xml = new DOMParser().parseFromString(text, "application/xml");
    const parserError = xml.querySelector("parsererror");
    if (parserError)
      throw new Error(
        "O XML está inválido: " + parserError.textContent.trim().split("\n")[0],
      );
    if (localName(xml.documentElement) !== "xliff")
      throw new Error("O documento não possui o elemento raiz <xliff>.");
    const fileNode = descendants(xml.documentElement, "file")[0];
    if (!fileNode)
      throw new Error("Nenhum elemento <file> foi encontrado no XLF.");

    const rawUnits = scanRawUnits(text);
    const parsedNodes = descendants(fileNode, "trans-unit");
    state.file = file;
    state.originalText = text;
    state.xml = xml;
    state.fileNode = fileNode;
    state.selected.clear();
    state.translator = null;
    state.newSequence = 0;
    initializeTranslationConfig();
    state.units = parsedNodes.map((node, index) =>
      parseUnit(node, index, rawUnits[index] || null),
    );
    renderAll();
    els.uploadView.hidden = true;
    els.appView.hidden = false;
    checkTranslationAvailability();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    showError(error.message || "Não foi possível ler este arquivo.");
  }
}

function scanRawUnits(text) {
  const regex =
    /<(?:[\w.-]+:)?trans-unit\b[\s\S]*?<\/(?:[\w.-]+:)?trans-unit\s*>/gi;
  const matches = [];
  let match;
  while ((match = regex.exec(text)))
    matches.push({ start: match.index, end: regex.lastIndex, raw: match[0] });
  return matches;
}

function parseUnit(node, index, rawInfo) {
  const source = firstChild(node, "source");
  const target = firstChild(node, "target");
  const sourceText = source?.textContent.trim() || "";
  const targetText = target?.textContent.trim() || "";
  return {
    key: `existing:${index}`,
    index,
    rawInfo,
    isNew: false,
    changed: false,
    id: node.getAttribute("id") || `sem-id-${index + 1}`,
    source: sourceText,
    target: targetText,
    originalTarget: targetText,
    notes: childElements(node, "note").map((item) => item.textContent.trim()),
    properties: descendants(node, "prop").map((prop) => ({
      type: prop.getAttribute("prop-type") || "—",
      value: prop.textContent.trim(),
      group: prop.parentElement?.getAttribute("name") || "—",
      attributes: attributesOf(prop),
    })),
    status: unitStatus(sourceText, targetText),
    attributes: attributesOf(node),
    sourceAttributes: attributesOf(source),
    targetAttributes: attributesOf(target),
    xml: new XMLSerializer().serializeToString(node),
  };
}

function renderAll() {
  const attrs = attributesOf(state.fileNode);
  const counts = qualityCounts();
  const duplicates = duplicateIds();
  els.fileName.textContent = state.file.name;
  els.fileSubline.textContent = `${formatBytes(state.file.size)} · XLIFF ${state.xml.documentElement.getAttribute("version") || "—"} · ${state.units.length} unidades`;
  els.sourceLanguage.textContent = attrs["source-language"] || "Não informado";
  els.targetLanguage.textContent = attrs["target-language"] || "Não informado";
  renderTranslationConfigSummary();
  els.tabCount.textContent = state.units.length;
  const stats = [
    [
      "Unidades",
      state.units.length,
      `${state.units.filter((unit) => unit.isNew).length} adicionadas`,
    ],
    [
      "Traduzidos",
      counts.translated,
      percentage(counts.translated, state.units.length) + "% do arquivo",
    ],
    ["Iguais", counts.same, "source = target"],
    [
      "Target vazio",
      counts.empty,
      duplicates.length
        ? `${duplicates.length} IDs repetidos`
        : "nenhum ID repetido",
    ],
  ];
  els.statCards.replaceChildren(
    ...stats.map(([label, value, hint]) =>
      elementFromHTML(
        `<article class="stat-card"><span>${escapeHtml(label)}</span><strong>${value}</strong><small>${escapeHtml(hint)}</small></article>`,
      ),
    ),
  );
  renderDetails(els.fileAttributes, {
    "Idioma atual (source)": attrs["source-language"] || "—",
    "Idioma da tradução (target)": attrs["target-language"] || "—",
    Datatype: attrs.datatype || "—",
    Original: attrs.original || "—",
    "Product name": attrs["product-name"] || "—",
    "Product version": attrs["product-version"] || "—",
    "XLIFF version": state.xml.documentElement.getAttribute("version") || "—",
    "Tamanho original": formatBytes(state.file.size),
    "IDs repetidos": duplicates.length ? duplicates.join(", ") : "Nenhum",
    ...Object.fromEntries(
      Object.entries(attrs).filter(
        ([key]) =>
          ![
            "source-language",
            "target-language",
            "datatype",
            "original",
            "product-name",
            "product-version",
          ].includes(key),
      ),
    ),
  });
  renderQuality(counts.translated, counts.same, counts.empty);
  renderHeader();
  renderTranslations();
  renderStructure();
  updateSelectionUi();
}

function initializeTranslationConfig() {
  const attrs = attributesOf(state.fileNode);
  state.translationConfig = {
    sourceLanguage: supportedLanguage(attrs["source-language"]) || "pt-BR",
    targetLanguage: supportedLanguage(attrs["target-language"]) || "en-US",
    updateTargetLanguage: false,
  };
  state.translator = null;
  syncTranslationConfigControls();
}

function setupLanguageSelects() {
  [els.translationSourceLanguage, els.translationTargetLanguage].forEach(
    (select) => {
      select.replaceChildren(
        ...LANGUAGE_OPTIONS.map(([value, label]) =>
          elementFromHTML(
            `<option value="${escapeHtml(value)}">${escapeHtml(label)} · ${escapeHtml(value)}</option>`,
          ),
        ),
      );
    },
  );
}

function syncTranslationConfigControls() {
  els.translationSourceLanguage.value = state.translationConfig.sourceLanguage;
  els.translationTargetLanguage.value = state.translationConfig.targetLanguage;
  els.updateTargetLanguage.checked = state.translationConfig.updateTargetLanguage;
  renderTranslationConfigSummary();
}

function updateTranslationConfig() {
  const nextTarget = els.translationTargetLanguage.value;
  state.translationConfig = {
    sourceLanguage: els.translationSourceLanguage.value.trim(),
    targetLanguage: nextTarget.trim(),
    updateTargetLanguage: els.updateTargetLanguage.checked,
  };
  state.translator = null;
  renderTranslationConfigSummary();
  checkTranslationAvailability();
  updateSelectionUi();
}

function renderTranslationConfigSummary() {
  const attrs = attributesOf(state.fileNode);
  const declaredTarget = attrs["target-language"] || "";
  const configuredTarget = state.translationConfig.targetLanguage;
  const configuredLabel = languageLabel(configuredTarget);
  if (!state.translationConfig.updateTargetLanguage) {
    els.targetLanguageExportNotice.textContent =
      "Não alterar target-language na exportação.";
    return;
  }
  els.targetLanguageExportNotice.textContent =
    declaredTarget && declaredTarget !== configuredTarget
      ? `Atualizar target-language de ${declaredTarget} para ${configuredLabel} ao exportar.`
      : `Atualizar target-language para ${configuredLabel} ao exportar.`;
}

function qualityCounts() {
  return {
    translated: state.units.filter((unit) => unit.status === "translated")
      .length,
    same: state.units.filter((unit) => unit.status === "same").length,
    empty: state.units.filter((unit) => unit.status === "empty").length,
  };
}

function renderQuality(translated, same, empty) {
  const total = state.units.length;
  const rows = [
    ["Traduzidos", translated, "#18875d"],
    ["Iguais ao source", same, "#d28222"],
    ["Target vazio", empty, "#c74634"],
  ];
  els.qualityBars.replaceChildren(
    ...rows.map(([label, count, color]) =>
      elementFromHTML(
        `<div class="quality-row"><label>${label}</label><div class="bar"><span style="width:${percentage(count, total)}%;background:${color}"></span></div><strong>${count}</strong></div>`,
      ),
    ),
  );
}

function renderHeader() {
  const header = firstChild(state.fileNode, "header");
  els.headerSummary.replaceChildren();
  els.headerTree.replaceChildren();
  if (!header) {
    renderDetails(els.headerSummary, {
      Status: "O arquivo não possui elemento <header>",
    });
    return;
  }
  const internal = descendants(header, "internal-file")[0];
  const props = descendants(header, "prop");
  renderDetails(els.headerSummary, {
    "Elementos diretos": childElements(header).length,
    "Internal file": internal
      ? `${internal.textContent.trim().length.toLocaleString("pt-BR")} caracteres · preservado na exportação`
      : "Não encontrado",
    Propriedades: props.length,
    ...Object.fromEntries(
      props.map((prop) => [
        prop.getAttribute("prop-type") || localName(prop),
        truncate(prop.textContent.trim(), 100),
      ]),
    ),
  });
  els.headerTree.append(createXmlTree(header, 0, true));
}

function filteredUnits() {
  const query = normalize(els.searchInput.value);
  const filter = els.statusFilter.value;
  return state.units.filter((unit) => {
    const haystack = normalize(
      [
        unit.id,
        unit.source,
        unit.target,
        ...unit.notes,
        ...unit.properties.flatMap((p) => [p.type, p.group, p.value]),
      ].join(" "),
    );
    return (
      (!query || haystack.includes(query)) &&
      (filter === "all" || unit.status === filter)
    );
  });
}

function renderTranslations() {
  const filtered = filteredUnits();
  els.resultCount.textContent = `${filtered.length} de ${state.units.length} unidades`;
  els.emptyResults.hidden = filtered.length > 0;
  els.translationsBody.replaceChildren(
    ...filtered.map((unit) => {
      const tr = document.createElement("tr");
      tr.tabIndex = 0;
      tr.innerHTML = `<td class="check-col"><input type="checkbox" aria-label="Selecionar ${escapeHtml(unit.id)}" ${state.selected.has(unit.key) ? "checked" : ""}></td><td><span class="id-code">${escapeHtml(unit.id)}</span>${unit.isNew ? '<span class="new-unit-label">NOVO</span>' : ""}</td><td>${escapeHtml(unit.source || "—")}</td><td class="${unit.changed ? "changed-target" : ""}">${escapeHtml(unit.target || "—")}</td><td class="cell-note">${escapeHtml(unit.notes.join(" · ") || "—")}</td><td>${statusBadge(unit.status)}</td><td class="chevron">›</td>`;
      const checkbox = $("input", tr);
      checkbox.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleSelection(unit.key, checkbox.checked);
      });
      tr.addEventListener("click", () => openUnit(unit));
      tr.addEventListener("keydown", (event) => {
        if (event.key === "Enter") openUnit(unit);
      });
      return tr;
    }),
  );
  syncSelectAllCheckbox(filtered);
  updateSelectionUi();
}

function renderStructure() {
  els.fullTree.replaceChildren(
    createXmlTree(state.xml.documentElement, 0, true),
  );
}

function createXmlTree(node, depth = 0, open = false) {
  const wrapper = document.createElement("div");
  wrapper.className = "xml-node";
  const details = document.createElement("details");
  details.open = open && depth < 2;
  const summary = document.createElement("summary");
  const attrText = Object.entries(attributesOf(node))
    .map(([k, v]) => `${k}="${v}"`)
    .join("  ");
  summary.innerHTML = `<span class="tag">&lt;${escapeHtml(localName(node))}&gt;</span>${attrText ? `<span class="attr">${escapeHtml(attrText)}</span>` : ""}`;
  details.append(summary);
  const children = childElements(node);
  const ownText = [...node.childNodes]
    .filter((item) => item.nodeType === Node.TEXT_NODE)
    .map((item) => item.nodeValue)
    .join("")
    .trim();
  if (ownText) {
    const value = document.createElement("div");
    value.className =
      "node-value" + (ownText.length > 350 ? " long-value" : "");
    value.textContent = state.showLong ? ownText : truncate(ownText, 1200);
    details.append(value);
  }
  children.forEach((child) =>
    details.append(createXmlTree(child, depth + 1, false)),
  );
  wrapper.append(details);
  return wrapper;
}

function openUnit(unit) {
  els.dialogTitle.textContent = unit.id;
  els.dialogContent.replaceChildren();
  addField("Status", statusLabel(unit.status), true);
  addField("Source", unit.source || "—");
  const targetBlock = document.createElement("div");
  targetBlock.className = "field-block";
  const targetLabel = document.createElement("label");
  targetLabel.textContent = "Target editável";
  const textarea = document.createElement("textarea");
  textarea.className = "edit-target";
  textarea.value = unit.target;
  targetBlock.append(targetLabel, textarea);
  els.dialogContent.append(targetBlock);
  addField("Note", unit.notes.join("\n") || "—");
  addField("Atributos de trans-unit", objectText(unit.attributes));
  if (Object.keys(unit.sourceAttributes).length)
    addField("Atributos de source", objectText(unit.sourceAttributes));
  if (Object.keys(unit.targetAttributes).length)
    addField("Atributos de target", objectText(unit.targetAttributes));
  if (unit.properties.length) {
    const block = document.createElement("div");
    block.className = "field-block";
    const label = document.createElement("label");
    label.textContent = `Propriedades preservadas (${unit.properties.length})`;
    block.append(label);
    unit.properties.forEach((prop) => {
      const card = document.createElement("div");
      card.className = "prop-card";
      card.innerHTML = `<strong>${escapeHtml(prop.type)}</strong> <span class="cell-note">· grupo ${escapeHtml(prop.group)}</span><div class="node-value">${escapeHtml(prop.value)}</div>`;
      block.append(card);
    });
    els.dialogContent.append(block);
  }
  if (!unit.isNew) addField("XML original da unidade", unit.xml);
  const actions = document.createElement("div");
  actions.className = "dialog-actions";
  const cancel = button("Cancelar", "secondary", () =>
    els.detailDialog.close(),
  );
  const save = button("Salvar target", "primary", () => {
    updateTarget(unit, textarea.value);
    els.detailDialog.close();
    renderAll();
    activateTab("translations");
  });
  actions.append(cancel, save);
  els.dialogContent.append(actions);
  els.detailDialog.showModal();
}

function updateTarget(unit, target) {
  unit.target = target;
  unit.status = unitStatus(unit.source, target);
  unit.changed = unit.isNew || target !== unit.originalTarget;
}

function openAddDialog() {
  els.newSource.value = "";
  els.newTarget.value = "";
  els.newNote.value = "";
  if (!els.newIdPrefix.value.trim()) els.newIdPrefix.value = "id349";
  updateIdPreview();
  els.addDialog.showModal();
  setTimeout(() => els.newSource.focus(), 0);
}

function updateIdPreview() {
  const prefix = slugId(els.newIdPrefix.value) || "id";
  const name = slugId(els.newSource.value) || "novo_campo";
  els.newIdPreview.value = uniqueId(`${prefix}_${name}`);
}

function addUnit(event) {
  event.preventDefault();
  const source = els.newSource.value.trim();
  if (!source) return;
  const id = uniqueId(els.newIdPreview.value || "id_novo_campo");
  const target = els.newTarget.value.trim();
  const note = els.newNote.value.trim();
  state.newSequence += 1;
  state.units.push({
    key: `new:${state.newSequence}`,
    index: state.units.length,
    rawInfo: null,
    isNew: true,
    changed: true,
    id,
    source,
    target,
    originalTarget: "",
    notes: note ? [note] : [],
    properties: [],
    status: unitStatus(source, target),
    attributes: { id },
    sourceAttributes: {},
    targetAttributes: {},
    xml: "",
  });
  els.addDialog.close();
  renderAll();
  activateTab("translations");
}

function selectSameUnits() {
  state.units
    .filter((unit) => unit.status === "same")
    .forEach((unit) => state.selected.add(unit.key));
  renderTranslations();
}

function selectAllVisible() {
  filteredUnits().forEach((unit) =>
    els.selectAllVisible.checked
      ? state.selected.add(unit.key)
      : state.selected.delete(unit.key),
  );
  renderTranslations();
}

function toggleSelection(key, selected) {
  selected ? state.selected.add(key) : state.selected.delete(key);
  updateSelectionUi();
  syncSelectAllCheckbox(filteredUnits());
}

function syncSelectAllCheckbox(units) {
  const selectedVisible = units.filter((unit) =>
    state.selected.has(unit.key),
  ).length;
  els.selectAllVisible.checked =
    units.length > 0 && selectedVisible === units.length;
  els.selectAllVisible.indeterminate =
    selectedVisible > 0 && selectedVisible < units.length;
}

function updateSelectionUi() {
  const count = state.selected.size;
  els.selectedCount.textContent = `${count} selecionado${count === 1 ? "" : "s"}`;
  els.translateBtn.disabled = count === 0 || !state.translationAvailable;
}

async function checkTranslationAvailability() {
  const { source, target } = languagePair();
  els.translationAvailability.className = "";
  if (!source || !target)
    return setTranslationAvailability(
      false,
      "Informe origem real e destino da tradução na configuração.",
    );
  if (source === target)
    return setTranslationAvailability(
      false,
      `Origem e destino configurados para o mesmo idioma do tradutor (${source}). Escolha idiomas diferentes.`,
    );
  if (!("Translator" in self))
    return setTranslationAvailability(
      false,
      "Tradutor local indisponível neste navegador. Use o Chrome desktop atualizado.",
    );
  try {
    const availability = await Translator.availability({
      sourceLanguage: source,
      targetLanguage: target,
    });
    if (availability === "unavailable")
      return setTranslationAvailability(
        false,
        `Tradução local ${source} → ${target} indisponível.`,
      );
    const message =
      availability === "available"
        ? "Tradução local pronta para uso."
        : "Pacote de idiomas será baixado na primeira tradução.";
    setTranslationAvailability(true, message);
  } catch (error) {
    setTranslationAvailability(
      false,
      "O Chrome não aceitou este par de idiomas para tradução local.",
    );
  }
}

function setTranslationAvailability(available, message) {
  state.translationAvailable = available;
  els.translationAvailability.textContent = message;
  els.translationAvailability.className = available
    ? "available"
    : "unavailable";
  updateSelectionUi();
}

async function translateSelected() {
  const units = state.units.filter(
    (unit) => state.selected.has(unit.key) && unit.source,
  );
  if (!units.length || !state.translationAvailable) return;
  els.translateBtn.disabled = true;
  els.translationProgress.hidden = false;
  const { source, target } = languagePair();
  let completed = 0;
  const errors = [];
  try {
    if (!state.translator) {
      els.translationProgressText.textContent = `Preparando o pacote ${source} → ${target}…`;
      state.translator = await Translator.create({
        sourceLanguage: source,
        targetLanguage: target,
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            els.translationProgressBar.style.width = `${Math.round(event.loaded * 100)}%`;
            els.translationProgressText.textContent = `Baixando pacote de idiomas: ${Math.round(event.loaded * 100)}%`;
          });
        },
      });
    }
    for (const unit of units) {
      els.translationProgressText.textContent = `Traduzindo ${completed + 1} de ${units.length}: ${unit.id}`;
      els.translationProgressBar.style.width = `${Math.round((completed / units.length) * 100)}%`;
      try {
        const restored = await translatePreservingTokens(
          state.translator,
          unit.source,
        );
        updateTarget(unit, alignTargetStyle(unit.source, restored));
      } catch (error) {
        errors.push(`${unit.id}: ${error.message}`);
      }
      completed += 1;
    }
    els.translationProgressBar.style.width = "100%";
    els.translationProgressText.textContent = errors.length
      ? `${completed - errors.length} traduzidos; ${errors.length} não foram alterados porque os tokens não puderam ser validados.`
      : `${completed} traduções concluídas. Revise os targets antes de exportar.`;
    renderAll();
    activateTab("translations");
  } catch (error) {
    state.translator = null;
    els.translationProgressText.textContent = `Não foi possível iniciar a tradução local: ${error.message}`;
  } finally {
    updateSelectionUi();
  }
}

function alignTargetStyle(source, target) {
  const sourceText = String(source || "");
  let targetText = String(target || "");
  if (!sourceText.trim() || !targetText.trim()) return targetText;
  if (isAllUpperText(sourceText))
    return preserveSourceAcronyms(
      sourceText,
      transformOutsideTokens(targetText, (text) => text.toLocaleUpperCase()),
    );
  if (isAllUpperText(targetText))
    targetText = transformOutsideTokens(targetText, (text) =>
      text.toLocaleLowerCase(),
    );
  if (isTitleLike(sourceText))
    return preserveSourceAcronyms(
      sourceText,
      transformOutsideTokens(targetText, (text) =>
        transformWords(text, (word) => capitalizeWord(word)),
      ),
    );
  const sourceFirstUpper = firstLetter(sourceText)?.isUpper;
  if (sourceFirstUpper === true)
    return preserveSourceAcronyms(
      sourceText,
      transformFirstLetterOutsideTokens(targetText, "upper"),
    );
  if (sourceFirstUpper === false)
    return preserveSourceAcronyms(
      sourceText,
      transformFirstLetterOutsideTokens(targetText, "lower"),
    );
  return preserveSourceAcronyms(sourceText, targetText);
}

function transformOutsideTokens(text, transform) {
  const parts = [];
  let cursor = 0;
  for (const match of String(text).matchAll(protectedTokenPattern())) {
    if (match.index > cursor) parts.push(transform(text.slice(cursor, match.index)));
    parts.push(match[0]);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push(transform(text.slice(cursor)));
  return parts.join("");
}

function transformFirstLetterOutsideTokens(text, mode) {
  let changed = false;
  return transformOutsideTokens(text, (segment) => {
    if (changed) return segment;
    const next = transformFirstLetter(segment, mode);
    changed = /\p{L}/u.test(segment);
    return next;
  });
}

function preserveSourceAcronyms(source, target) {
  const acronyms = acronymWords(source);
  if (!acronyms.length) return target;
  return transformOutsideTokens(target, (segment) => {
    let result = segment;
    acronyms.forEach((acronym) => {
      result = result.replace(
        new RegExp(`\\b${escapeRegExp(acronym)}\\b`, "gi"),
        acronym,
      );
    });
    return result;
  });
}

function acronymWords(text) {
  return [
    ...new Set(
      (stripProtectedTokens(text).match(/\b[A-Z0-9]{2,}\b/g) || []).filter(
        (word) => /[A-Z]/.test(word),
      ),
    ),
  ];
}

function isAllUpperText(text) {
  const letters = lettersOf(text);
  return (
    letters.length > 1 &&
    letters.some((letter) => hasCase(letter)) &&
    letters.every((letter) => !isLowerLetter(letter))
  );
}

function isTitleLike(text) {
  const words =
    stripProtectedTokens(text).match(/[^\s:[\]().,;!?/\\&]+/g) || [];
  if (
    words.some(
      (word) => word.length <= 3 && firstLetter(word)?.isUpper === false,
    )
  )
    return false;
  const significant = words.filter((word) => word.length > 2);
  if (!significant.length) return false;
  return significant.every((word) => {
    if (isAllUpperText(word)) return true;
    return firstLetter(word)?.isUpper === true;
  });
}

function stripProtectedTokens(text) {
  return String(text).replace(protectedTokenPattern(), " ");
}

function normalizedWords(text) {
  return (String(text).match(/\p{L}[\p{L}\p{M}]*/gu) || []).map((word) =>
    normalize(word),
  );
}

function transformWords(text, transform) {
  let index = 0;
  return String(text).replace(/\p{L}[\p{L}\p{M}]*/gu, (word) =>
    transform(word, index++),
  );
}

function capitalizeWord(word) {
  const match = /\p{L}/u.exec(word);
  if (!match) return word;
  const index = match.index;
  return (
    word.slice(0, index) +
    word[index].toLocaleUpperCase() +
    word.slice(index + 1).toLocaleLowerCase()
  );
}

function transformFirstLetter(text, mode) {
  const match = /\p{L}/u.exec(text);
  if (!match) return text;
  const index = match.index;
  const letter =
    mode === "upper"
      ? text[index].toLocaleUpperCase()
      : text[index].toLocaleLowerCase();
  return text.slice(0, index) + letter + text.slice(index + 1);
}

function firstLetter(text) {
  const match = /\p{L}/u.exec(text);
  if (!match) return null;
  return {
    value: match[0],
    isUpper: isUpperLetter(match[0]),
  };
}

function lettersOf(text) {
  return String(text).match(/\p{L}/gu) || [];
}

function hasCase(letter) {
  return isUpperLetter(letter) || isLowerLetter(letter);
}

function isUpperLetter(letter) {
  return (
    letter.toLocaleUpperCase() === letter &&
    letter.toLocaleLowerCase() !== letter
  );
}

function isLowerLetter(letter) {
  return (
    letter.toLocaleLowerCase() === letter &&
    letter.toLocaleUpperCase() !== letter
  );
}

function protectTokens(text) {
  const tokenPattern = protectedTokenPattern();
  const tokens = [];
  const protectedText = text.replace(tokenPattern, (token) => {
    const placeholder = `__XLF_TOKEN_${String(tokens.length).padStart(3, "0")}__`;
    tokens.push({ placeholder, token });
    return placeholder;
  });
  return { text: protectedText, tokens };
}

function protectedTokenPattern() {
  return /\[&[^\]\r\n]+\]|\{\{[\s\S]*?\}\}|\$\{[^}\r\n]+\}|%\{?[A-Za-z0-9_.-]+\}?%|https?:\/\/[^\s]+/g;
}

async function translatePreservingTokens(translator, source) {
  const parts = [];
  let cursor = 0;
  for (const match of source.matchAll(protectedTokenPattern())) {
    if (match.index > cursor)
      parts.push(
        await translateTextSegment(translator, source.slice(cursor, match.index)),
      );
    parts.push(match[0]);
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length)
    parts.push(await translateTextSegment(translator, source.slice(cursor)));
  if (!parts.length) return translateTextSegment(translator, source);
  const result = parts.join("");
  const expected = tokenSequence(source);
  const actual = tokenSequence(result);
  if (JSON.stringify(expected) !== JSON.stringify(actual))
    throw new Error("a validação final das variáveis falhou");
  return result;
}

async function translateTextSegment(translator, segment) {
  if (!segment.trim()) return segment;
  if (shouldKeepSegment(segment)) return segment;
  const leading = segment.match(/^\s*/)[0];
  const trailing = segment.match(/\s*$/)[0];
  const core = segment.slice(
    leading.length,
    segment.length - trailing.length || undefined,
  );
  return leading + (await translator.translate(core)) + trailing;
}

function shouldKeepSegment(segment) {
  const { source, target } = languagePair();
  if (source !== "pt" || target !== "en") return false;
  const text = stripProtectedTokens(segment).trim();
  if (!text || !/[A-Za-zÀ-ÿ]/.test(text)) return true;
  if (/[À-ÿ]/.test(text)) return false;
  const words = normalizedWords(text);
  if (!words.length) return true;
  return !words.some((word) => PORTUGUESE_HINTS.has(word));
}

function restoreTokens(translated, tokens) {
  let restored = translated;
  for (const { placeholder, token } of tokens) {
    if (!restored.includes(placeholder))
      throw new Error(
        `variável protegida ${token} foi modificada pelo tradutor`,
      );
    restored = restored.replaceAll(placeholder, token);
  }
  const sourceTokens = tokens.map((item) => item.token);
  const finalTokens = protectTokens(restored).tokens.map((item) => item.token);
  if (JSON.stringify(sourceTokens) !== JSON.stringify(finalTokens))
    throw new Error("a validação final das variáveis falhou");
  return restored;
}

function exportXlf() {
  const duplicates = duplicateIds();
  if (duplicates.length)
    return alert(
      `Não é possível exportar: existem IDs repetidos: ${duplicates.join(", ")}`,
    );
  const tokenErrors = exportTokenErrors();
  if (tokenErrors.length)
    return alert(
      "Não é possível exportar: as variáveis do source e do target não estão na mesma quantidade e ordem.\n\n" +
        tokenErrors.slice(0, 8).join("\n") +
        (tokenErrors.length > 8
          ? `\n... e mais ${tokenErrors.length - 8} unidade(s).`
          : ""),
    );
  try {
    const patches = [];
    const targetLanguagePatch = fileTargetLanguagePatch();
    if (targetLanguagePatch) patches.push(targetLanguagePatch);
    state.units
      .filter((unit) => !unit.isNew && unit.changed)
      .forEach((unit) => {
        if (!unit.rawInfo)
          throw new Error(
            `Não foi possível localizar o bloco original de ${unit.id}.`,
          );
        const patch = targetPatch(unit.rawInfo, unit.target);
        if (!patch)
          throw new Error(
            `Não foi possível localizar ou criar o <target> de ${unit.id}.`,
          );
        patches.push(patch);
      });
    let output = applyPatches(state.originalText, patches);
    const newUnits = state.units.filter((unit) => unit.isNew);
    if (newUnits.length) output = insertNewUnits(output, newUnits);
    download(
      output,
      baseName() + "-editado.xlf",
      "application/xliff+xml;charset=utf-8",
    );
  } catch (error) {
    alert(
      `Exportação interrompida para proteger o arquivo original. ${error.message}`,
    );
  }
}

function exportTokenErrors() {
  return state.units
    .filter((unit) => unit.changed || unit.isNew)
    .filter((unit) => !sameTokenSequence(unit.source, unit.target))
    .map((unit) => {
      const sourceTokens = tokenSequence(unit.source);
      const targetTokens = tokenSequence(unit.target);
      return `${unit.id}: source [${sourceTokens.join(", ")}] / target [${targetTokens.join(", ")}]`;
    });
}

function sameTokenSequence(source, target) {
  const sourceTokens = tokenSequence(source);
  const targetTokens = tokenSequence(target);
  return JSON.stringify(sourceTokens) === JSON.stringify(targetTokens);
}

function tokenSequence(text) {
  return protectTokens(text).tokens.map((item) => item.token);
}

function fileTargetLanguagePatch() {
  if (!state.translationConfig.updateTargetLanguage) return null;
  const targetLanguage = state.translationConfig.targetLanguage.trim();
  if (!targetLanguage)
    throw new Error(
      "Atualização de target-language marcada, mas nenhum destino foi informado.",
    );
  const fileTag = /<(?:[\w.-]+:)?file\b[^>]*>/i.exec(state.originalText);
  if (!fileTag) throw new Error("A tag <file> não foi encontrada.");
  const raw = fileTag[0];
  const attr = /\btarget-language\s*=\s*(["'])(.*?)\1/i.exec(raw);
  if (attr) {
    const valueOffset = attr[0].match(/^[\s\S]*?=\s*["']/)[0].length;
    return {
      start: fileTag.index + attr.index + valueOffset,
      end: fileTag.index + attr.index + valueOffset + attr[2].length,
      value: escapeXmlAttribute(targetLanguage),
    };
  }
  const insertAt = fileTag.index + raw.length - (raw.endsWith("/>") ? 2 : 1);
  return {
    start: insertAt,
    end: insertAt,
    value: ` target-language="${escapeXmlAttribute(targetLanguage)}"`,
  };
}

function targetPatch(rawInfo, target) {
  const raw = rawInfo.raw;
  const fullTarget =
    /(<(?:[\w.-]+:)?target\b[^>]*>)([\s\S]*?)(<\/(?:[\w.-]+:)?target\s*>)/i.exec(
      raw,
    );
  if (fullTarget) {
    return {
      start: rawInfo.start + fullTarget.index + fullTarget[1].length,
      end:
        rawInfo.start +
        fullTarget.index +
        fullTarget[1].length +
        fullTarget[2].length,
      value: escapeXmlText(target),
    };
  }
  const selfClosing = /<(?:[\w.-]+:)?target\b([^>]*)\/>/i.exec(raw);
  if (selfClosing) {
    const original = selfClosing[0];
    const tagName = original.match(/^<([^\s/>]+)/)[1];
    const attributes = selfClosing[1].trim();
    const replacement = `<${tagName}${attributes ? " " + attributes : ""}>${escapeXmlText(target)}</${tagName}>`;
    return {
      start: rawInfo.start + selfClosing.index,
      end: rawInfo.start + selfClosing.index + original.length,
      value: replacement,
    };
  }
  const sourceClose = /<\/(?:[\w.-]+:)?source\s*>/i.exec(raw);
  if (!sourceClose) return null;
  const indent = detectChildIndent(raw);
  const position = rawInfo.start + sourceClose.index + sourceClose[0].length;
  return {
    start: position,
    end: position,
    value: `\n${indent}<target>${escapeXmlText(target)}</target>`,
  };
}

function applyPatches(text, patches) {
  return patches
    .sort((a, b) => b.start - a.start)
    .reduce(
      (result, patch) =>
        result.slice(0, patch.start) + patch.value + result.slice(patch.end),
      text,
    );
}

function insertNewUnits(text, units) {
  const bodyCloseMatches = [...text.matchAll(/<\/(?:[\w.-]+:)?body\s*>/gi)];
  const close = bodyCloseMatches.at(-1);
  if (!close) throw new Error("O fechamento </body> não foi encontrado.");
  const beforeClose = text.slice(0, close.index);
  const closingLineStart = beforeClose.lastIndexOf("\n") + 1;
  const bodyIndent = beforeClose.slice(closingLineStart).match(/^\s*/)[0];
  const contentBeforeClose = beforeClose.slice(0, closingLineStart);
  const unitIndent = bodyIndent + detectIndentUnit(text);
  const childIndent = unitIndent + detectIndentUnit(text);
  const blocks = units
    .map((unit) => {
      const note = unit.notes[0]
        ? `\n${childIndent}<note>${escapeXmlText(unit.notes[0])}</note>`
        : "";
      return `${unitIndent}<trans-unit id="${escapeXmlAttribute(unit.id)}">\n${childIndent}<source>${escapeXmlText(unit.source)}</source>\n${childIndent}<target>${escapeXmlText(unit.target)}</target>${note}\n${unitIndent}</trans-unit>`;
    })
    .join("\n");
  const separator =
    !contentBeforeClose || contentBeforeClose.endsWith("\n") ? "" : "\n";
  return (
    contentBeforeClose +
    separator +
    blocks +
    "\n" +
    bodyIndent +
    text.slice(close.index)
  );
}

function exportCsv() {
  const rows = [
    [
      "id",
      "source",
      "target",
      "note",
      "status",
      "new",
      "changed",
      "properties",
    ],
    ...state.units.map((unit) => [
      unit.id,
      unit.source,
      unit.target,
      unit.notes.join(" | "),
      statusLabel(unit.status),
      unit.isNew ? "Y" : "N",
      unit.changed ? "Y" : "N",
      unit.properties
        .map((prop) => `${prop.group}/${prop.type}: ${prop.value}`)
        .join(" | "),
    ]),
  ];
  download(
    "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n"),
    baseName() + "-translations.csv",
    "text/csv;charset=utf-8",
  );
}

function exportJson() {
  const data = {
    filename: state.file.name,
    xliff: attributesOf(state.xml.documentElement),
    file: attributesOf(state.fileNode),
    translations: state.units.map(
      ({ xml, index, rawInfo, key, ...unit }) => unit,
    ),
  };
  download(
    JSON.stringify(data, null, 2),
    baseName() + "-analysis.json",
    "application/json",
  );
}

function addField(labelText, valueText, isStatus = false) {
  const block = document.createElement("div");
  block.className = "field-block";
  const label = document.createElement("label");
  label.textContent = labelText;
  const value = document.createElement("div");
  value.className = "field-value";
  if (isStatus)
    value.innerHTML = statusBadge(
      Object.keys(statusLabels).find(
        (key) => statusLabels[key] === valueText,
      ) || "same",
    );
  else value.textContent = valueText;
  block.append(label, value);
  els.dialogContent.append(block);
}

function activateTab(name) {
  $$(".tab").forEach((tab) =>
    tab.classList.toggle("active", tab.dataset.tab === name),
  );
  $$(".panel").forEach((panel) =>
    panel.classList.toggle("active", panel.dataset.panel === name),
  );
}

function toggleLongValues() {
  state.showLong = !state.showLong;
  $("#toggleLongValues").textContent = state.showLong
    ? "Resumir valores longos"
    : "Mostrar valores longos";
  els.headerTree.classList.toggle("show-long", state.showLong);
  renderHeader();
}

function resetApp() {
  state.file = state.xml = state.fileNode = state.translator = null;
  state.originalText = "";
  state.units = [];
  state.selected.clear();
  state.showLong = false;
  state.translationAvailable = false;
  els.fileInput.value = "";
  els.searchInput.value = "";
  els.statusFilter.value = "all";
  state.translationConfig = {
    sourceLanguage: "",
    targetLanguage: "",
    updateTargetLanguage: false,
  };
  syncTranslationConfigControls();
  els.appView.hidden = true;
  els.uploadView.hidden = false;
  els.translationProgress.hidden = true;
  activateTab("overview");
  hideError();
}

function renderDetails(container, object) {
  container.replaceChildren(
    ...Object.entries(object).map(([key, value]) => {
      const dl = document.createElement("dl");
      dl.className = "detail-item";
      const dt = document.createElement("dt");
      dt.textContent = key;
      const dd = document.createElement("dd");
      dd.textContent = String(value ?? "—");
      dl.append(dt, dd);
      return dl;
    }),
  );
}

function duplicateIds() {
  const seen = new Set(),
    duplicates = new Set();
  state.units.forEach((unit) =>
    seen.has(unit.id) ? duplicates.add(unit.id) : seen.add(unit.id),
  );
  return [...duplicates];
}

function uniqueId(candidate) {
  const ids = new Set(state.units.map((unit) => unit.id));
  const base = slugId(candidate) || "id_novo_campo";
  let value = base;
  let suffix = 2;
  while (ids.has(value)) value = `${base}_${suffix++}`;
  return value;
}

function slugId(value) {
  return normalize(value)
    .replace(/[^a-z0-9_.-]+/g, "_")
    .replace(/^[_\d.-]+/, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function languagePair() {
  return {
    source: translatorLanguage(state.translationConfig.sourceLanguage),
    target: translatorLanguage(state.translationConfig.targetLanguage),
  };
}

function supportedLanguage(code) {
  if (!code) return "";
  return LANGUAGE_FALLBACKS[code] || LANGUAGE_FALLBACKS[translatorLanguage(code)] || "";
}

function languageLabel(code) {
  const option = LANGUAGE_OPTIONS.find(([value]) => value === code);
  return option ? `${option[1]} · ${option[0]}` : code;
}

function translatorLanguage(code) {
  if (!code) return "";
  try {
    const locale = new Intl.Locale(code);
    return locale.language === "zh" && locale.script === "Hant"
      ? "zh-Hant"
      : locale.language;
  } catch (error) {
    return code.split("-")[0];
  }
}

function detectChildIndent(raw) {
  const match = raw.match(/\n([ \t]+)<(?:[\w.-]+:)?(?:source|target|note)\b/i);
  return match ? match[1] : "   ";
}

function detectIndentUnit(text) {
  const matches = [...text.matchAll(/\n([ \t]+)<(?:[\w.-]+:)?trans-unit\b/gi)];
  if (matches.length) {
    const indent = matches[0][1];
    const bodyMatch = text
      .slice(0, matches[0].index)
      .match(/\n([ \t]*)<(?:[\w.-]+:)?body\b[^>]*>\s*$/i);
    if (bodyMatch && indent.startsWith(bodyMatch[1]))
      return indent.slice(bodyMatch[1].length) || "   ";
  }
  return "   ";
}

const statusLabels = {
  translated: "Traduzido",
  same: "Igual ao source",
  empty: "Target vazio",
};
function statusLabel(status) {
  return statusLabels[status] || status;
}
function statusBadge(status) {
  return `<span class="status ${status}">${statusLabel(status)}</span>`;
}
function unitStatus(source, target) {
  return !target.trim()
    ? "empty"
    : source.trim() === target.trim()
      ? "same"
      : "translated";
}
function localName(node) {
  return node?.localName || node?.nodeName?.split(":").pop() || "";
}
function childElements(node, name) {
  return [...(node?.children || [])].filter(
    (child) => !name || localName(child) === name,
  );
}
function firstChild(node, name) {
  return childElements(node, name)[0] || null;
}
function descendants(node, name) {
  return [...(node?.getElementsByTagName("*") || [])].filter(
    (child) => localName(child) === name,
  );
}
function attributesOf(node) {
  return node
    ? Object.fromEntries(
        [...node.attributes].map((attr) => [attr.name, attr.value]),
      )
    : {};
}
function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
function percentage(value, total) {
  return total ? Math.round((value / total) * 100) : 0;
}
function truncate(value, size) {
  return value.length > size
    ? value.slice(0, size) +
        `… (${value.length.toLocaleString("pt-BR")} caracteres)`
    : value;
}
function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  return `${(bytes / 1024 ** i).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${units[i]}`;
}
function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value ?? "");
  return div.innerHTML;
}
function escapeXmlText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeXmlAttribute(value) {
  return escapeXmlText(value).replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function elementFromHTML(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}
function objectText(object) {
  return Object.keys(object).length
    ? Object.entries(object)
        .map(([key, value]) => `${key} = ${value}`)
        .join("\n")
    : "Nenhum atributo";
}
function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}
function baseName() {
  return state.file.name.replace(/\.(xlf|xliff)$/i, "");
}
function button(text, kind, action) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = `button ${kind}`;
  item.textContent = text;
  item.addEventListener("click", action);
  return item;
}
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
function showError(message) {
  els.uploadError.textContent = message;
  els.uploadError.hidden = false;
}
function hideError() {
  els.uploadError.hidden = true;
  els.uploadError.textContent = "";
}
