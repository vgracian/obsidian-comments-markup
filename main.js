var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => CommentsMarkupPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/settings/settings.ts
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  author: "",
  timezone: "system",
  dateFormat: "datetime",
  resolvedCollapsed: true,
  anchorStyle: "superscript"
};
var CommentsMarkupSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "CommentsMarkup" });
    new import_obsidian.Setting(containerEl).setName("Author name").setDesc("Your @author identifier for new comments").addText(
      (text) => text.setPlaceholder("e.g. alice").setValue(this.plugin.settings.author).onChange(async (value) => {
        this.plugin.settings.author = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Timezone").setDesc(
      'Override timezone offset for dates (e.g. +02:00, -05:00). Leave as "system" to use your system timezone.'
    ).addText(
      (text) => text.setPlaceholder("system").setValue(this.plugin.settings.timezone).onChange(async (value) => {
        this.plugin.settings.timezone = value || "system";
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Date format").setDesc("Format for dates in new comments").addDropdown(
      (dropdown) => dropdown.addOption("datetime", "Date + time with timezone").addOption("dateonly", "Date only").setValue(this.plugin.settings.dateFormat).onChange(async (value) => {
        this.plugin.settings.dateFormat = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Resolved threads").setDesc("Collapse resolved threads by default").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.resolvedCollapsed).onChange(async (value) => {
        this.plugin.settings.resolvedCollapsed = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Anchor style").setDesc("How anchors are displayed in the document").addDropdown(
      (dropdown) => dropdown.addOption("superscript", "Superscript number").addOption("icon", "Comment icon").addOption("highlight", "Highlight").setValue(this.plugin.settings.anchorStyle).onChange(async (value) => {
        this.plugin.settings.anchorStyle = value;
        await this.plugin.saveSettings();
      })
    );
  }
};

// src/reading/postprocessor.ts
var import_obsidian2 = require("obsidian");

// src/parser/parser.ts
var ANCHOR_RE = /\{\^([a-zA-Z0-9_-]+)\}/g;
var COMMENT_RE = /^\s*\{\^([a-zA-Z0-9_-]+)\s+\[([ x])\]\}\s+@([a-zA-Z0-9_-]+)\s+(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2}))?):\s+(.*)/;
var REPLY_RE = /^\s*\{\^([a-zA-Z0-9_-]+)\.(\d+)\}\s+@([a-zA-Z0-9_-]+)\s+(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2}))?):\s+(.*)/;
function parseDocument(source) {
  const lines = source.split("\n");
  const anchors = [];
  const comments = [];
  const replies = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const commentMatch = line.match(COMMENT_RE);
    if (commentMatch) {
      comments.push({
        id: commentMatch[1],
        state: commentMatch[2] === "x" ? "resolved" : "open",
        author: commentMatch[3],
        date: commentMatch[4],
        text: commentMatch[5],
        line: i,
        replies: []
      });
      continue;
    }
    const replyMatch = line.match(REPLY_RE);
    if (replyMatch) {
      replies.push({
        id: replyMatch[1],
        number: parseInt(replyMatch[2], 10),
        author: replyMatch[3],
        date: replyMatch[4],
        text: replyMatch[5],
        line: i
      });
      continue;
    }
    let match;
    ANCHOR_RE.lastIndex = 0;
    while ((match = ANCHOR_RE.exec(line)) !== null) {
      anchors.push({
        id: match[1],
        line: i,
        col: match.index,
        length: match[0].length
      });
    }
  }
  for (const reply of replies) {
    const parent = comments.find((c) => c.id === reply.id);
    if (parent) {
      parent.replies.push(reply);
    }
  }
  for (const comment of comments) {
    comment.replies.sort((a, b) => a.number - b.number);
  }
  return { anchors, comments };
}

// src/reading/postprocessor.ts
function createPostProcessor(plugin) {
  return (el, ctx) => {
    processAnchors(el, plugin);
    processCommentDefinitions(el, plugin, ctx);
  };
}
function processAnchors(el, plugin) {
  var _a;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const anchorRe = /\{\^([a-zA-Z0-9_-]+)\}/g;
  const nodesToReplace = [];
  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent || "";
    const matches = [];
    let match;
    anchorRe.lastIndex = 0;
    while ((match = anchorRe.exec(text)) !== null) {
      matches.push({ id: match[1], index: match.index, length: match[0].length });
    }
    if (matches.length > 0) {
      nodesToReplace.push({ node, matches });
    }
  }
  for (const { node: node2, matches } of nodesToReplace) {
    const text = node2.textContent || "";
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    for (const m of matches) {
      if (m.index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      }
      const marker = createAnchorMarker(m.id, plugin);
      fragment.appendChild(marker);
      lastIndex = m.index + m.length;
    }
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    (_a = node2.parentNode) == null ? void 0 : _a.replaceChild(fragment, node2);
  }
}
function createAnchorMarker(id, plugin) {
  const style = plugin.settings.anchorStyle;
  const marker = document.createElement("span");
  marker.addClass("cm-anchor-marker");
  marker.dataset.commentId = id;
  marker.setAttribute("title", `Comment: ${id}`);
  marker.setAttribute("aria-label", `Comment anchor ${id}`);
  if (style === "superscript") {
    const sup = document.createElement("sup");
    sup.addClass("cm-anchor-superscript");
    sup.textContent = id.replace(/^c/, "");
    marker.appendChild(sup);
  } else if (style === "icon") {
    marker.addClass("cm-anchor-icon");
    marker.textContent = "\u{1F4AC}";
  } else {
    marker.addClass("cm-anchor-highlight");
    marker.textContent = `[${id}]`;
  }
  marker.addEventListener("click", () => {
    const leaves = plugin.app.workspace.getLeavesOfType("comments-markup-sidebar");
    if (leaves.length > 0) {
      plugin.app.workspace.revealLeaf(leaves[0]);
    }
  });
  return marker;
}
function processCommentDefinitions(el, plugin, ctx) {
  const sectionInfo = ctx.getSectionInfo(el);
  if (!sectionInfo) return;
  const source = sectionInfo.text;
  const lineStart = sectionInfo.lineStart;
  const lineEnd = sectionInfo.lineEnd;
  const allLines = source.split("\n");
  const sectionLines = allLines.slice(lineStart, lineEnd + 1);
  const sectionText = sectionLines.join("\n");
  const parsed = parseDocument(sectionText);
  if (parsed.comments.length === 0) return;
  el.empty();
  el.addClass("cm-comments-section");
  for (const comment of parsed.comments) {
    const threadEl = renderThread(comment, plugin, ctx);
    el.appendChild(threadEl);
  }
}
function renderThread(comment, plugin, ctx) {
  const threadEl = document.createElement("div");
  threadEl.addClass("cm-comment-thread");
  if (comment.state === "resolved") {
    threadEl.addClass("cm-comment-resolved");
  }
  const rootEl = document.createElement("div");
  rootEl.addClass("cm-comment-root");
  const headerEl = document.createElement("div");
  headerEl.addClass("cm-comment-header");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = comment.state === "resolved";
  checkbox.addClass("cm-comment-checkbox");
  checkbox.addEventListener("click", (e) => {
    e.preventDefault();
    toggleCommentState(comment.id, plugin);
  });
  headerEl.appendChild(checkbox);
  const authorEl = document.createElement("span");
  authorEl.addClass("cm-comment-author");
  authorEl.textContent = `@${comment.author}`;
  headerEl.appendChild(authorEl);
  const dateEl = document.createElement("span");
  dateEl.addClass("cm-comment-date");
  dateEl.textContent = comment.date;
  headerEl.appendChild(dateEl);
  const idEl = document.createElement("span");
  idEl.addClass("cm-comment-id");
  idEl.textContent = comment.id;
  headerEl.appendChild(idEl);
  rootEl.appendChild(headerEl);
  const textEl = document.createElement("div");
  textEl.addClass("cm-comment-text");
  textEl.textContent = comment.text;
  rootEl.appendChild(textEl);
  threadEl.appendChild(rootEl);
  for (const reply of comment.replies) {
    const replyEl = document.createElement("div");
    replyEl.addClass("cm-comment-reply");
    const replyHeader = document.createElement("div");
    replyHeader.addClass("cm-comment-header");
    const replyAuthor = document.createElement("span");
    replyAuthor.addClass("cm-comment-author");
    replyAuthor.textContent = `@${reply.author}`;
    replyHeader.appendChild(replyAuthor);
    const replyDate = document.createElement("span");
    replyDate.addClass("cm-comment-date");
    replyDate.textContent = reply.date;
    replyHeader.appendChild(replyDate);
    replyEl.appendChild(replyHeader);
    const replyText = document.createElement("div");
    replyText.addClass("cm-comment-text");
    replyText.textContent = reply.text;
    replyEl.appendChild(replyText);
    threadEl.appendChild(replyEl);
  }
  return threadEl;
}
function toggleCommentState(commentId, plugin) {
  const view = plugin.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
  if (!view) return;
  const editor = view.editor;
  const source = editor.getValue();
  const lines = source.split("\n");
  const commentRe = new RegExp(
    `^(\\s*\\{\\^${escapeRegex(commentId)}\\s+\\[)([ x])(\\]\\}.*)$`
  );
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(commentRe);
    if (match) {
      const newState = match[2] === "x" ? " " : "x";
      const newLine = match[1] + newState + match[3];
      editor.replaceRange(
        newLine,
        { line: i, ch: 0 },
        { line: i, ch: lines[i].length }
      );
      break;
    }
  }
}
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// src/editor/decorations.ts
var import_view = require("@codemirror/view");
var import_state = require("@codemirror/state");
var ANCHOR_RE2 = /\{\^([a-zA-Z0-9_-]+)\}/g;
var COMMENT_RE2 = /^\s*\{\^[a-zA-Z0-9_-]+\s+\[[ x]\]\}\s+@[a-zA-Z0-9_-]+\s+\d{4}-\d{2}-\d{2}/;
var REPLY_RE2 = /^\s*\{\^[a-zA-Z0-9_-]+\.\d+\}\s+@[a-zA-Z0-9_-]+\s+\d{4}-\d{2}-\d{2}/;
var AnchorWidget = class extends import_view.WidgetType {
  constructor(id, style) {
    super();
    this.id = id;
    this.style = style;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-anchor-marker cm-anchor-inline";
    if (this.style === "superscript") {
      const sup = document.createElement("sup");
      sup.className = "cm-anchor-superscript";
      sup.textContent = this.id.replace(/^c/, "");
      span.appendChild(sup);
    } else if (this.style === "icon") {
      span.className += " cm-anchor-icon";
      span.textContent = "\u{1F4AC}";
    } else {
      span.className += " cm-anchor-highlight";
      span.textContent = `[${this.id}]`;
    }
    return span;
  }
  eq(other) {
    return this.id === other.id && this.style === other.style;
  }
};
function buildDecorations(view, settings) {
  const builder = new import_state.RangeSetBuilder();
  const doc = view.state.doc;
  const decorations = [];
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;
    if (COMMENT_RE2.test(text) || REPLY_RE2.test(text)) {
      decorations.push({
        from: line.from,
        to: line.from,
        decoration: import_view.Decoration.line({ class: "cm-comment-def-line" })
      });
      continue;
    }
    ANCHOR_RE2.lastIndex = 0;
    let match;
    while ((match = ANCHOR_RE2.exec(text)) !== null) {
      const from = line.from + match.index;
      const to = from + match[0].length;
      decorations.push({
        from,
        to,
        decoration: import_view.Decoration.replace({
          widget: new AnchorWidget(match[1], settings.anchorStyle)
        })
      });
    }
  }
  decorations.sort((a, b) => a.from - b.from || a.to - b.to);
  for (const d of decorations) {
    builder.add(d.from, d.to, d.decoration);
  }
  return builder.finish();
}
function createEditorExtensions(settingsGetter) {
  return import_view.ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = buildDecorations(view, settingsGetter());
      }
      update(update) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.view, settingsGetter());
        }
      }
    },
    {
      decorations: (v) => v.decorations
    }
  );
}

// src/editor/commands.ts
var import_obsidian3 = require("obsidian");

// src/utils.ts
function formatDate(dateFormat, timezone) {
  const now = /* @__PURE__ */ new Date();
  if (dateFormat === "dateonly") {
    const year2 = now.getFullYear();
    const month2 = String(now.getMonth() + 1).padStart(2, "0");
    const day2 = String(now.getDate()).padStart(2, "0");
    return `${year2}-${month2}-${day2}`;
  }
  let offsetMinutes;
  if (timezone && timezone !== "system") {
    const match = timezone.match(/^([+-])(\d{2}):(\d{2})$/);
    if (match) {
      const sign = match[1] === "+" ? 1 : -1;
      offsetMinutes = sign * (parseInt(match[2], 10) * 60 + parseInt(match[3], 10));
    } else {
      offsetMinutes = -now.getTimezoneOffset();
    }
  } else {
    offsetMinutes = -now.getTimezoneOffset();
  }
  const targetTime = new Date(now.getTime() + (offsetMinutes + now.getTimezoneOffset()) * 6e4);
  const year = targetTime.getFullYear();
  const month = String(targetTime.getMonth() + 1).padStart(2, "0");
  const day = String(targetTime.getDate()).padStart(2, "0");
  const hours = String(targetTime.getHours()).padStart(2, "0");
  const minutes = String(targetTime.getMinutes()).padStart(2, "0");
  const absOffset = Math.abs(offsetMinutes);
  const offSign = offsetMinutes >= 0 ? "+" : "-";
  const offH = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const offM = String(absOffset % 60).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}${offSign}${offH}:${offM}`;
}
function nextCommentId(parsed) {
  let max = 0;
  for (const comment of parsed.comments) {
    const match = comment.id.match(/^c(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return `c${max + 1}`;
}

// src/editor/commands.ts
function registerCommands(plugin) {
  plugin.addCommand({
    id: "insert-comment",
    name: "Insert comment",
    editorCallback: (editor, view) => {
      ensureAuthor(plugin, () => insertComment(editor, plugin));
    }
  });
  plugin.addCommand({
    id: "reply-to-comment",
    name: "Reply to comment",
    editorCallback: (editor, view) => {
      ensureAuthor(plugin, () => replyToComment(editor, plugin));
    }
  });
  plugin.addCommand({
    id: "toggle-resolve",
    name: "Toggle comment resolved",
    editorCallback: (editor, view) => {
      toggleResolve(editor);
    }
  });
  plugin.addCommand({
    id: "show-comments-panel",
    name: "Show comments panel",
    callback: () => {
      openSidebar(plugin);
    }
  });
}
function ensureAuthor(plugin, callback) {
  if (plugin.settings.author) {
    callback();
    return;
  }
  const modal = new AuthorPromptModal(plugin.app, async (author) => {
    plugin.settings.author = author;
    await plugin.saveSettings();
    callback();
  });
  modal.open();
}
var AuthorPromptModal = class extends import_obsidian3.Modal {
  constructor(app, onSubmit) {
    super(app);
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Set your author name" });
    contentEl.createEl("p", {
      text: "This will be used as your @author identifier in comments."
    });
    const input = contentEl.createEl("input", {
      type: "text",
      placeholder: "e.g. alice"
    });
    input.addClass("cm-author-input");
    input.focus();
    const submitBtn = contentEl.createEl("button", { text: "Save" });
    submitBtn.addClass("mod-cta");
    submitBtn.addEventListener("click", () => {
      const value = input.value.trim().replace(/\s+/g, "-");
      if (value) {
        this.onSubmit(value);
        this.close();
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        submitBtn.click();
      }
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
function insertComment(editor, plugin) {
  var _a;
  const source = editor.getValue();
  const parsed = parseDocument(source);
  const id = nextCommentId(parsed);
  const date = formatDate(
    plugin.settings.dateFormat,
    plugin.settings.timezone
  );
  const author = plugin.settings.author;
  const cursor = editor.getCursor();
  const anchorText = `{^${id}}`;
  editor.replaceRange(anchorText, cursor);
  const lines = editor.getValue().split("\n");
  let commentsSectionLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+Comments\s*$/.test(lines[i])) {
      commentsSectionLine = i;
      break;
    }
  }
  const commentDef = `{^${id} [ ]} @${author} ${date}: `;
  if (commentsSectionLine === -1) {
    const lastLine = editor.lastLine();
    const appendText = `

## Comments

${commentDef}`;
    editor.replaceRange(appendText, {
      line: lastLine,
      ch: lines[lastLine].length
    });
    const newLines = editor.getValue().split("\n");
    const defLine = newLines.length - 1;
    editor.setCursor({ line: defLine, ch: newLines[defLine].length });
  } else {
    let insertLine = commentsSectionLine + 1;
    for (let i = commentsSectionLine + 1; i < lines.length; i++) {
      if (lines[i].trim() !== "") {
        insertLine = i + 1;
      }
    }
    const insertText = `
${commentDef}`;
    editor.replaceRange(insertText, { line: insertLine, ch: 0 });
    const newLines = editor.getValue().split("\n");
    editor.setCursor({
      line: insertLine + 1,
      ch: ((_a = newLines[insertLine + 1]) == null ? void 0 : _a.length) || 0
    });
  }
}
function replyToComment(editor, plugin) {
  const source = editor.getValue();
  const parsed = parseDocument(source);
  const cursor = editor.getCursor();
  const currentLine = editor.getLine(cursor.line);
  const commentRe = /\{\^([a-zA-Z0-9_-]+)(?:\s+\[[ x]\]|\.\d+)\}/;
  const match = currentLine.match(commentRe);
  if (!match) {
    const anchorRe = /\{\^([a-zA-Z0-9_-]+)\}/;
    const anchorMatch = currentLine.match(anchorRe);
    if (anchorMatch) {
      addReply(editor, plugin, parsed, anchorMatch[1]);
      return;
    }
    new (require("obsidian")).Notice(
      "Place cursor on a comment, reply, or anchor to reply."
    );
    return;
  }
  addReply(editor, plugin, parsed, match[1]);
}
function addReply(editor, plugin, parsed, commentId) {
  var _a;
  const comment = parsed.comments.find((c) => c.id === commentId);
  if (!comment) return;
  const nextReplyNum = comment.replies.length > 0 ? Math.max(...comment.replies.map((r) => r.number)) + 1 : 1;
  const date = formatDate(
    plugin.settings.dateFormat,
    plugin.settings.timezone
  );
  const author = plugin.settings.author;
  const replyDef = `  {^${commentId}.${nextReplyNum}} @${author} ${date}: `;
  const lastLine = comment.replies.length > 0 ? comment.replies[comment.replies.length - 1].line : comment.line;
  const currentParsed = parseDocument(editor.getValue());
  const currentComment = currentParsed.comments.find(
    (c) => c.id === commentId
  );
  if (!currentComment) return;
  const insertAfterLine = currentComment.replies.length > 0 ? currentComment.replies[currentComment.replies.length - 1].line : currentComment.line;
  editor.replaceRange(`
${replyDef}`, {
    line: insertAfterLine,
    ch: editor.getLine(insertAfterLine).length
  });
  const newLines = editor.getValue().split("\n");
  editor.setCursor({
    line: insertAfterLine + 1,
    ch: ((_a = newLines[insertAfterLine + 1]) == null ? void 0 : _a.length) || 0
  });
}
function toggleResolve(editor) {
  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const commentRe = /^(\s*\{\^[a-zA-Z0-9_-]+\s+\[)([ x])(\]\}.*)$/;
  const match = line.match(commentRe);
  if (!match) return;
  const newState = match[2] === "x" ? " " : "x";
  const newLine = match[1] + newState + match[3];
  editor.replaceRange(
    newLine,
    { line: cursor.line, ch: 0 },
    { line: cursor.line, ch: line.length }
  );
}
function openSidebar(plugin) {
  const existing = plugin.app.workspace.getLeavesOfType(
    "comments-markup-sidebar"
  );
  if (existing.length > 0) {
    plugin.app.workspace.revealLeaf(existing[0]);
    return;
  }
  const leaf = plugin.app.workspace.getRightLeaf(false);
  if (leaf) {
    leaf.setViewState({
      type: "comments-markup-sidebar",
      active: true
    });
  }
}

// src/sidebar/sidebar-view.ts
var import_obsidian4 = require("obsidian");
var SIDEBAR_VIEW_TYPE = "comments-markup-sidebar";
var CommentsSidebarView = class extends import_obsidian4.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.parsed = null;
    this.showOpenOnly = false;
    this.plugin = plugin;
  }
  getViewType() {
    return SIDEBAR_VIEW_TYPE;
  }
  getDisplayText() {
    return "Comments";
  }
  getIcon() {
    return "message-square";
  }
  async onOpen() {
    this.registerEvent(
      this.app.workspace.on("file-open", () => this.refresh())
    );
    this.registerEvent(
      this.app.vault.on(
        "modify",
        (0, import_obsidian4.debounce)(
          (file) => {
            const activeFile = this.app.workspace.getActiveFile();
            if (activeFile && file.path === activeFile.path) {
              this.refresh();
            }
          },
          300,
          true
        )
      )
    );
    this.refresh();
  }
  async onClose() {
    this.contentEl.empty();
  }
  async refresh() {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      this.renderEmpty();
      return;
    }
    const source = await this.app.vault.read(file);
    this.parsed = parseDocument(source);
    this.render();
  }
  renderEmpty() {
    this.contentEl.empty();
    this.contentEl.createEl("div", {
      cls: "cm-sidebar-empty",
      text: "No active Markdown file."
    });
  }
  render() {
    if (!this.parsed) return;
    const { contentEl } = this;
    contentEl.empty();
    const toolbar = contentEl.createEl("div", { cls: "cm-sidebar-toolbar" });
    const filterBtn = toolbar.createEl("button", {
      cls: "cm-sidebar-filter-btn",
      text: this.showOpenOnly ? "Show all" : "Open only"
    });
    filterBtn.addEventListener("click", () => {
      this.showOpenOnly = !this.showOpenOnly;
      this.render();
    });
    const count = this.parsed.comments.length;
    const openCount = this.parsed.comments.filter(
      (c) => c.state === "open"
    ).length;
    toolbar.createEl("span", {
      cls: "cm-sidebar-count",
      text: `${openCount} open / ${count} total`
    });
    const list = contentEl.createEl("div", { cls: "cm-sidebar-list" });
    const comments = this.showOpenOnly ? this.parsed.comments.filter((c) => c.state === "open") : this.parsed.comments;
    if (comments.length === 0) {
      list.createEl("div", {
        cls: "cm-sidebar-empty",
        text: this.showOpenOnly ? "No open comments." : "No comments in this file."
      });
      return;
    }
    for (const comment of comments) {
      this.renderThread(list, comment);
    }
  }
  renderThread(container, comment) {
    const collapsed = comment.state === "resolved" && this.plugin.settings.resolvedCollapsed;
    const details = container.createEl("details", {
      cls: "cm-sidebar-thread"
    });
    if (!collapsed) {
      details.setAttribute("open", "");
    }
    if (comment.state === "resolved") {
      details.addClass("cm-sidebar-resolved");
    }
    const summary = details.createEl("summary", {
      cls: "cm-sidebar-summary"
    });
    const stateIcon = summary.createEl("span", {
      cls: "cm-sidebar-state",
      text: comment.state === "resolved" ? "\u2713" : "\u25CB",
      title: comment.state === "resolved" ? "Reopen" : "Resolve"
    });
    stateIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.toggleCommentState(comment.id);
    });
    summary.createEl("span", {
      cls: "cm-sidebar-thread-id",
      text: comment.id
    });
    summary.createEl("span", {
      cls: "cm-comment-author",
      text: `@${comment.author}`
    });
    summary.addEventListener("click", (e) => {
      if (e.target.closest(".cm-sidebar-state")) return;
      this.navigateToAnchor(comment.id);
    });
    const rootBody = details.createEl("div", { cls: "cm-sidebar-root-body" });
    rootBody.createEl("div", {
      cls: "cm-comment-date",
      text: comment.date
    });
    const rootTextEl = rootBody.createEl("div", {
      cls: "cm-sidebar-text",
      text: comment.text
    });
    if (comment.author === this.plugin.settings.author) {
      rootTextEl.addClass("cm-sidebar-editable");
      rootTextEl.addEventListener("click", () => {
        this.editInline(rootTextEl, comment.text, (newText) => {
          this.modifyFile((source) => {
            const lines = source.split("\n");
            const parsed = parseDocument(source);
            const c = parsed.comments.find((x) => x.id === comment.id);
            if (!c) return source;
            const line = lines[c.line];
            const colonIdx = line.indexOf(": ");
            if (colonIdx === -1) return source;
            lines[c.line] = line.substring(0, colonIdx + 2) + newText;
            return lines.join("\n");
          });
        });
      });
    }
    for (const reply of comment.replies) {
      const replyEl = details.createEl("div", {
        cls: "cm-sidebar-reply"
      });
      const replyHeader = replyEl.createEl("div", {
        cls: "cm-sidebar-reply-header"
      });
      replyHeader.createEl("span", {
        cls: "cm-comment-author",
        text: `@${reply.author}`
      });
      replyHeader.createEl("span", {
        cls: "cm-comment-date",
        text: reply.date
      });
      const replyTextEl = replyEl.createEl("div", {
        cls: "cm-sidebar-text",
        text: reply.text
      });
      if (reply.author === this.plugin.settings.author) {
        replyTextEl.addClass("cm-sidebar-editable");
        replyTextEl.addEventListener("click", () => {
          this.editInline(replyTextEl, reply.text, (newText) => {
            this.modifyFile((source) => {
              const lines = source.split("\n");
              const parsed = parseDocument(source);
              const c = parsed.comments.find((x) => x.id === comment.id);
              if (!c) return source;
              const r = c.replies.find((x) => x.number === reply.number);
              if (!r) return source;
              const line = lines[r.line];
              const colonIdx = line.indexOf(": ");
              if (colonIdx === -1) return source;
              lines[r.line] = line.substring(0, colonIdx + 2) + newText;
              return lines.join("\n");
            });
          });
        });
      }
    }
    const replyBtn = details.createEl("button", {
      cls: "cm-sidebar-reply-btn",
      text: "Reply"
    });
    replyBtn.addEventListener("click", () => {
      replyBtn.remove();
      const replyBox = details.createEl("div", { cls: "cm-sidebar-reply-box" });
      const input = replyBox.createEl("input", {
        type: "text",
        cls: "cm-sidebar-edit-input",
        placeholder: "Write a reply..."
      });
      input.focus();
      let submitted = false;
      const submit = () => {
        if (submitted) return;
        submitted = true;
        const text = input.value.trim();
        if (!text) {
          this.refresh();
          return;
        }
        this.modifyFile((source) => {
          const parsed = parseDocument(source);
          const c = parsed.comments.find((x) => x.id === comment.id);
          if (!c) return source;
          const nextNum = c.replies.length > 0 ? Math.max(...c.replies.map((r) => r.number)) + 1 : 1;
          const date = formatDate(
            this.plugin.settings.dateFormat,
            this.plugin.settings.timezone
          );
          const author = this.plugin.settings.author;
          const replyLine = `  {^${comment.id}.${nextNum}} @${author} ${date}: ${text}`;
          const lines = source.split("\n");
          const insertAfter = c.replies.length > 0 ? c.replies[c.replies.length - 1].line : c.line;
          lines.splice(insertAfter + 1, 0, replyLine);
          return lines.join("\n");
        });
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") {
          submitted = true;
          this.refresh();
        }
      });
      input.addEventListener("blur", () => {
        if (input.value.trim()) {
          submit();
        } else {
          this.refresh();
        }
      });
    });
  }
  editInline(el, currentText, onSave) {
    if (el.querySelector("input")) return;
    el.empty();
    const input = el.createEl("input", {
      type: "text",
      cls: "cm-sidebar-edit-input",
      value: currentText
    });
    input.focus();
    input.select();
    let saved = false;
    const save = () => {
      if (saved) return;
      saved = true;
      const newText = input.value.trim();
      if (newText && newText !== currentText) {
        onSave(newText);
      } else {
        this.refresh();
      }
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save();
      if (e.key === "Escape") {
        saved = true;
        this.refresh();
      }
    });
    input.addEventListener("blur", save);
  }
  async modifyFile(transform) {
    const file = this.app.workspace.getActiveFile();
    if (!file) return;
    await this.app.vault.process(file, transform);
  }
  async toggleCommentState(commentId) {
    await this.modifyFile((source) => {
      const lines = source.split("\n");
      const escapedId = commentId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(
        `^(\\s*\\{\\^${escapedId}\\s+\\[)([ x])(\\]\\}.*)$`
      );
      for (let i = 0; i < lines.length; i++) {
        const match = lines[i].match(re);
        if (match) {
          const newState = match[2] === "x" ? " " : "x";
          lines[i] = match[1] + newState + match[3];
          break;
        }
      }
      return lines.join("\n");
    });
  }
  navigateToAnchor(id) {
    var _a;
    const file = this.app.workspace.getActiveFile();
    if (!file || !this.parsed) return;
    const anchor = this.parsed.anchors.find((a) => a.id === id);
    if (!anchor) return;
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof import_obsidian4.MarkdownView && ((_a = view.file) == null ? void 0 : _a.path) === file.path) {
        const editor = view.editor;
        editor.setCursor({ line: anchor.line, ch: anchor.col });
        editor.scrollIntoView(
          {
            from: { line: anchor.line, ch: anchor.col },
            to: { line: anchor.line, ch: anchor.col + anchor.length }
          },
          true
        );
        this.app.workspace.revealLeaf(leaf);
        editor.focus();
        return;
      }
    }
  }
};

// src/main.ts
var CommentsMarkupPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new CommentsMarkupSettingTab(this.app, this));
    this.registerMarkdownPostProcessor(createPostProcessor(this));
    this.registerEditorExtension(
      createEditorExtensions(() => this.settings)
    );
    this.registerView(
      SIDEBAR_VIEW_TYPE,
      (leaf) => new CommentsSidebarView(leaf, this)
    );
    registerCommands(this);
    this.addRibbonIcon("message-square", "Open comments panel", () => {
      this.activateSidebar();
    });
  }
  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData()
    );
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async activateSidebar() {
    const existing = this.app.workspace.getLeavesOfType(SIDEBAR_VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: SIDEBAR_VIEW_TYPE,
        active: true
      });
      this.app.workspace.revealLeaf(leaf);
    }
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL3NldHRpbmdzL3NldHRpbmdzLnRzIiwgInNyYy9yZWFkaW5nL3Bvc3Rwcm9jZXNzb3IudHMiLCAic3JjL3BhcnNlci9wYXJzZXIudHMiLCAic3JjL2VkaXRvci9kZWNvcmF0aW9ucy50cyIsICJzcmMvZWRpdG9yL2NvbW1hbmRzLnRzIiwgInNyYy91dGlscy50cyIsICJzcmMvc2lkZWJhci9zaWRlYmFyLXZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IFBsdWdpbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHtcblx0Q29tbWVudHNNYXJrdXBTZXR0aW5ncyxcblx0REVGQVVMVF9TRVRUSU5HUyxcblx0Q29tbWVudHNNYXJrdXBTZXR0aW5nVGFiLFxufSBmcm9tIFwiLi9zZXR0aW5ncy9zZXR0aW5nc1wiO1xuaW1wb3J0IHsgY3JlYXRlUG9zdFByb2Nlc3NvciB9IGZyb20gXCIuL3JlYWRpbmcvcG9zdHByb2Nlc3NvclwiO1xuaW1wb3J0IHsgY3JlYXRlRWRpdG9yRXh0ZW5zaW9ucyB9IGZyb20gXCIuL2VkaXRvci9kZWNvcmF0aW9uc1wiO1xuaW1wb3J0IHsgcmVnaXN0ZXJDb21tYW5kcyB9IGZyb20gXCIuL2VkaXRvci9jb21tYW5kc1wiO1xuaW1wb3J0IHtcblx0U0lERUJBUl9WSUVXX1RZUEUsXG5cdENvbW1lbnRzU2lkZWJhclZpZXcsXG59IGZyb20gXCIuL3NpZGViYXIvc2lkZWJhci12aWV3XCI7XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIENvbW1lbnRzTWFya3VwUGx1Z2luIGV4dGVuZHMgUGx1Z2luIHtcblx0c2V0dGluZ3M6IENvbW1lbnRzTWFya3VwU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTO1xuXG5cdGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuXG5cdFx0Ly8gU2V0dGluZ3MgdGFiXG5cdFx0dGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBDb21tZW50c01hcmt1cFNldHRpbmdUYWIodGhpcy5hcHAsIHRoaXMpKTtcblxuXHRcdC8vIFJlYWRpbmcgbW9kZSBwb3N0LXByb2Nlc3NvclxuXHRcdHRoaXMucmVnaXN0ZXJNYXJrZG93blBvc3RQcm9jZXNzb3IoY3JlYXRlUG9zdFByb2Nlc3Nvcih0aGlzKSk7XG5cblx0XHQvLyBFZGl0b3IgbW9kZSBkZWNvcmF0aW9uc1xuXHRcdHRoaXMucmVnaXN0ZXJFZGl0b3JFeHRlbnNpb24oXG5cdFx0XHRjcmVhdGVFZGl0b3JFeHRlbnNpb25zKCgpID0+IHRoaXMuc2V0dGluZ3MpXG5cdFx0KTtcblxuXHRcdC8vIFNpZGViYXIgcGFuZWxcblx0XHR0aGlzLnJlZ2lzdGVyVmlldyhcblx0XHRcdFNJREVCQVJfVklFV19UWVBFLFxuXHRcdFx0KGxlYWYpID0+IG5ldyBDb21tZW50c1NpZGViYXJWaWV3KGxlYWYsIHRoaXMpXG5cdFx0KTtcblxuXHRcdC8vIENvbW1hbmRzXG5cdFx0cmVnaXN0ZXJDb21tYW5kcyh0aGlzKTtcblxuXHRcdC8vIFJpYmJvbiBpY29uIHRvIG9wZW4gc2lkZWJhclxuXHRcdHRoaXMuYWRkUmliYm9uSWNvbihcIm1lc3NhZ2Utc3F1YXJlXCIsIFwiT3BlbiBjb21tZW50cyBwYW5lbFwiLCAoKSA9PiB7XG5cdFx0XHR0aGlzLmFjdGl2YXRlU2lkZWJhcigpO1xuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgbG9hZFNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKFxuXHRcdFx0e30sXG5cdFx0XHRERUZBVUxUX1NFVFRJTkdTLFxuXHRcdFx0YXdhaXQgdGhpcy5sb2FkRGF0YSgpXG5cdFx0KTtcblx0fVxuXG5cdGFzeW5jIHNhdmVTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLnNhdmVEYXRhKHRoaXMuc2V0dGluZ3MpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBhY3RpdmF0ZVNpZGViYXIoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPVxuXHRcdFx0dGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShTSURFQkFSX1ZJRVdfVFlQRSk7XG5cdFx0aWYgKGV4aXN0aW5nLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGV4aXN0aW5nWzBdKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBsZWFmID0gdGhpcy5hcHAud29ya3NwYWNlLmdldFJpZ2h0TGVhZihmYWxzZSk7XG5cdFx0aWYgKGxlYWYpIHtcblx0XHRcdGF3YWl0IGxlYWYuc2V0Vmlld1N0YXRlKHtcblx0XHRcdFx0dHlwZTogU0lERUJBUl9WSUVXX1RZUEUsXG5cdFx0XHRcdGFjdGl2ZTogdHJ1ZSxcblx0XHRcdH0pO1xuXHRcdFx0dGhpcy5hcHAud29ya3NwYWNlLnJldmVhbExlYWYobGVhZik7XG5cdFx0fVxuXHR9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSBDb21tZW50c01hcmt1cFBsdWdpbiBmcm9tIFwiLi4vbWFpblwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbW1lbnRzTWFya3VwU2V0dGluZ3Mge1xuXHRhdXRob3I6IHN0cmluZztcblx0dGltZXpvbmU6IHN0cmluZztcblx0ZGF0ZUZvcm1hdDogXCJkYXRldGltZVwiIHwgXCJkYXRlb25seVwiO1xuXHRyZXNvbHZlZENvbGxhcHNlZDogYm9vbGVhbjtcblx0YW5jaG9yU3R5bGU6IFwic3VwZXJzY3JpcHRcIiB8IFwiaWNvblwiIHwgXCJoaWdobGlnaHRcIjtcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0VUVElOR1M6IENvbW1lbnRzTWFya3VwU2V0dGluZ3MgPSB7XG5cdGF1dGhvcjogXCJcIixcblx0dGltZXpvbmU6IFwic3lzdGVtXCIsXG5cdGRhdGVGb3JtYXQ6IFwiZGF0ZXRpbWVcIixcblx0cmVzb2x2ZWRDb2xsYXBzZWQ6IHRydWUsXG5cdGFuY2hvclN0eWxlOiBcInN1cGVyc2NyaXB0XCIsXG59O1xuXG5leHBvcnQgY2xhc3MgQ29tbWVudHNNYXJrdXBTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG5cdHBsdWdpbjogQ29tbWVudHNNYXJrdXBQbHVnaW47XG5cblx0Y29uc3RydWN0b3IoYXBwOiBBcHAsIHBsdWdpbjogQ29tbWVudHNNYXJrdXBQbHVnaW4pIHtcblx0XHRzdXBlcihhcHAsIHBsdWdpbik7XG5cdFx0dGhpcy5wbHVnaW4gPSBwbHVnaW47XG5cdH1cblxuXHRkaXNwbGF5KCk6IHZvaWQge1xuXHRcdGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG5cdFx0Y29udGFpbmVyRWwuZW1wdHkoKTtcblxuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIkNvbW1lbnRzTWFya3VwXCIgfSk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKFwiQXV0aG9yIG5hbWVcIilcblx0XHRcdC5zZXREZXNjKFwiWW91ciBAYXV0aG9yIGlkZW50aWZpZXIgZm9yIG5ldyBjb21tZW50c1wiKVxuXHRcdFx0LmFkZFRleHQoKHRleHQpID0+XG5cdFx0XHRcdHRleHRcblx0XHRcdFx0XHQuc2V0UGxhY2Vob2xkZXIoXCJlLmcuIGFsaWNlXCIpXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dGhvcilcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRob3IgPSB2YWx1ZTtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuXHRcdFx0XHRcdH0pXG5cdFx0XHQpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIlRpbWV6b25lXCIpXG5cdFx0XHQuc2V0RGVzYyhcblx0XHRcdFx0J092ZXJyaWRlIHRpbWV6b25lIG9mZnNldCBmb3IgZGF0ZXMgKGUuZy4gKzAyOjAwLCAtMDU6MDApLiBMZWF2ZSBhcyBcInN5c3RlbVwiIHRvIHVzZSB5b3VyIHN5c3RlbSB0aW1lem9uZS4nXG5cdFx0XHQpXG5cdFx0XHQuYWRkVGV4dCgodGV4dCkgPT5cblx0XHRcdFx0dGV4dFxuXHRcdFx0XHRcdC5zZXRQbGFjZWhvbGRlcihcInN5c3RlbVwiKVxuXHRcdFx0XHRcdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy50aW1lem9uZSlcblx0XHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy50aW1lem9uZSA9IHZhbHVlIHx8IFwic3lzdGVtXCI7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KVxuXHRcdFx0KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJEYXRlIGZvcm1hdFwiKVxuXHRcdFx0LnNldERlc2MoXCJGb3JtYXQgZm9yIGRhdGVzIGluIG5ldyBjb21tZW50c1wiKVxuXHRcdFx0LmFkZERyb3Bkb3duKChkcm9wZG93bikgPT5cblx0XHRcdFx0ZHJvcGRvd25cblx0XHRcdFx0XHQuYWRkT3B0aW9uKFwiZGF0ZXRpbWVcIiwgXCJEYXRlICsgdGltZSB3aXRoIHRpbWV6b25lXCIpXG5cdFx0XHRcdFx0LmFkZE9wdGlvbihcImRhdGVvbmx5XCIsIFwiRGF0ZSBvbmx5XCIpXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmRhdGVGb3JtYXQpXG5cdFx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MuZGF0ZUZvcm1hdCA9IHZhbHVlIGFzXG5cdFx0XHRcdFx0XHRcdHwgXCJkYXRldGltZVwiXG5cdFx0XHRcdFx0XHRcdHwgXCJkYXRlb25seVwiO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG5cdFx0XHRcdFx0fSlcblx0XHRcdCk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKFwiUmVzb2x2ZWQgdGhyZWFkc1wiKVxuXHRcdFx0LnNldERlc2MoXCJDb2xsYXBzZSByZXNvbHZlZCB0aHJlYWRzIGJ5IGRlZmF1bHRcIilcblx0XHRcdC5hZGRUb2dnbGUoKHRvZ2dsZSkgPT5cblx0XHRcdFx0dG9nZ2xlXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnJlc29sdmVkQ29sbGFwc2VkKVxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLnJlc29sdmVkQ29sbGFwc2VkID0gdmFsdWU7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KVxuXHRcdFx0KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJBbmNob3Igc3R5bGVcIilcblx0XHRcdC5zZXREZXNjKFwiSG93IGFuY2hvcnMgYXJlIGRpc3BsYXllZCBpbiB0aGUgZG9jdW1lbnRcIilcblx0XHRcdC5hZGREcm9wZG93bigoZHJvcGRvd24pID0+XG5cdFx0XHRcdGRyb3Bkb3duXG5cdFx0XHRcdFx0LmFkZE9wdGlvbihcInN1cGVyc2NyaXB0XCIsIFwiU3VwZXJzY3JpcHQgbnVtYmVyXCIpXG5cdFx0XHRcdFx0LmFkZE9wdGlvbihcImljb25cIiwgXCJDb21tZW50IGljb25cIilcblx0XHRcdFx0XHQuYWRkT3B0aW9uKFwiaGlnaGxpZ2h0XCIsIFwiSGlnaGxpZ2h0XCIpXG5cdFx0XHRcdFx0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmFuY2hvclN0eWxlKVxuXHRcdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMucGx1Z2luLnNldHRpbmdzLmFuY2hvclN0eWxlID0gdmFsdWUgYXNcblx0XHRcdFx0XHRcdFx0fCBcInN1cGVyc2NyaXB0XCJcblx0XHRcdFx0XHRcdFx0fCBcImljb25cIlxuXHRcdFx0XHRcdFx0XHR8IFwiaGlnaGxpZ2h0XCI7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRcdFx0XHR9KVxuXHRcdFx0KTtcblx0fVxufVxuIiwgImltcG9ydCB7IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsIE1hcmtkb3duVmlldyB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgQ29tbWVudHNNYXJrdXBQbHVnaW4gZnJvbSBcIi4uL21haW5cIjtcbmltcG9ydCB7IHBhcnNlRG9jdW1lbnQgfSBmcm9tIFwiLi4vcGFyc2VyL3BhcnNlclwiO1xuaW1wb3J0IHR5cGUgeyBDb21tZW50RW50cnkgfSBmcm9tIFwiLi4vcGFyc2VyL3R5cGVzXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVQb3N0UHJvY2Vzc29yKHBsdWdpbjogQ29tbWVudHNNYXJrdXBQbHVnaW4pIHtcblx0cmV0dXJuIChlbDogSFRNTEVsZW1lbnQsIGN0eDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCkgPT4ge1xuXHRcdHByb2Nlc3NBbmNob3JzKGVsLCBwbHVnaW4pO1xuXHRcdHByb2Nlc3NDb21tZW50RGVmaW5pdGlvbnMoZWwsIHBsdWdpbiwgY3R4KTtcblx0fTtcbn1cblxuZnVuY3Rpb24gcHJvY2Vzc0FuY2hvcnMoZWw6IEhUTUxFbGVtZW50LCBwbHVnaW46IENvbW1lbnRzTWFya3VwUGx1Z2luKSB7XG5cdGNvbnN0IHdhbGtlciA9IGRvY3VtZW50LmNyZWF0ZVRyZWVXYWxrZXIoZWwsIE5vZGVGaWx0ZXIuU0hPV19URVhUKTtcblx0Y29uc3QgYW5jaG9yUmUgPSAvXFx7XFxeKFthLXpBLVowLTlfLV0rKVxcfS9nO1xuXHRjb25zdCBub2Rlc1RvUmVwbGFjZTogeyBub2RlOiBUZXh0OyBtYXRjaGVzOiB7IGlkOiBzdHJpbmc7IGluZGV4OiBudW1iZXI7IGxlbmd0aDogbnVtYmVyIH1bXSB9W10gPSBbXTtcblxuXHRsZXQgbm9kZTogVGV4dCB8IG51bGw7XG5cdHdoaWxlICgobm9kZSA9IHdhbGtlci5uZXh0Tm9kZSgpIGFzIFRleHQgfCBudWxsKSkge1xuXHRcdGNvbnN0IHRleHQgPSBub2RlLnRleHRDb250ZW50IHx8IFwiXCI7XG5cdFx0Y29uc3QgbWF0Y2hlczogeyBpZDogc3RyaW5nOyBpbmRleDogbnVtYmVyOyBsZW5ndGg6IG51bWJlciB9W10gPSBbXTtcblx0XHRsZXQgbWF0Y2g6IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG5cdFx0YW5jaG9yUmUubGFzdEluZGV4ID0gMDtcblx0XHR3aGlsZSAoKG1hdGNoID0gYW5jaG9yUmUuZXhlYyh0ZXh0KSkgIT09IG51bGwpIHtcblx0XHRcdG1hdGNoZXMucHVzaCh7IGlkOiBtYXRjaFsxXSwgaW5kZXg6IG1hdGNoLmluZGV4LCBsZW5ndGg6IG1hdGNoWzBdLmxlbmd0aCB9KTtcblx0XHR9XG5cdFx0aWYgKG1hdGNoZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0bm9kZXNUb1JlcGxhY2UucHVzaCh7IG5vZGUsIG1hdGNoZXMgfSk7XG5cdFx0fVxuXHR9XG5cblx0Zm9yIChjb25zdCB7IG5vZGUsIG1hdGNoZXMgfSBvZiBub2Rlc1RvUmVwbGFjZSkge1xuXHRcdGNvbnN0IHRleHQgPSBub2RlLnRleHRDb250ZW50IHx8IFwiXCI7XG5cdFx0Y29uc3QgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG5cdFx0bGV0IGxhc3RJbmRleCA9IDA7XG5cblx0XHRmb3IgKGNvbnN0IG0gb2YgbWF0Y2hlcykge1xuXHRcdFx0aWYgKG0uaW5kZXggPiBsYXN0SW5kZXgpIHtcblx0XHRcdFx0ZnJhZ21lbnQuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGV4dC5zbGljZShsYXN0SW5kZXgsIG0uaW5kZXgpKSk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBtYXJrZXIgPSBjcmVhdGVBbmNob3JNYXJrZXIobS5pZCwgcGx1Z2luKTtcblx0XHRcdGZyYWdtZW50LmFwcGVuZENoaWxkKG1hcmtlcik7XG5cdFx0XHRsYXN0SW5kZXggPSBtLmluZGV4ICsgbS5sZW5ndGg7XG5cdFx0fVxuXG5cdFx0aWYgKGxhc3RJbmRleCA8IHRleHQubGVuZ3RoKSB7XG5cdFx0XHRmcmFnbWVudC5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh0ZXh0LnNsaWNlKGxhc3RJbmRleCkpKTtcblx0XHR9XG5cblx0XHRub2RlLnBhcmVudE5vZGU/LnJlcGxhY2VDaGlsZChmcmFnbWVudCwgbm9kZSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlQW5jaG9yTWFya2VyKGlkOiBzdHJpbmcsIHBsdWdpbjogQ29tbWVudHNNYXJrdXBQbHVnaW4pOiBIVE1MRWxlbWVudCB7XG5cdGNvbnN0IHN0eWxlID0gcGx1Z2luLnNldHRpbmdzLmFuY2hvclN0eWxlO1xuXHRjb25zdCBtYXJrZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcblx0bWFya2VyLmFkZENsYXNzKFwiY20tYW5jaG9yLW1hcmtlclwiKTtcblx0bWFya2VyLmRhdGFzZXQuY29tbWVudElkID0gaWQ7XG5cdG1hcmtlci5zZXRBdHRyaWJ1dGUoXCJ0aXRsZVwiLCBgQ29tbWVudDogJHtpZH1gKTtcblx0bWFya2VyLnNldEF0dHJpYnV0ZShcImFyaWEtbGFiZWxcIiwgYENvbW1lbnQgYW5jaG9yICR7aWR9YCk7XG5cblx0aWYgKHN0eWxlID09PSBcInN1cGVyc2NyaXB0XCIpIHtcblx0XHRjb25zdCBzdXAgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3VwXCIpO1xuXHRcdHN1cC5hZGRDbGFzcyhcImNtLWFuY2hvci1zdXBlcnNjcmlwdFwiKTtcblx0XHRzdXAudGV4dENvbnRlbnQgPSBpZC5yZXBsYWNlKC9eYy8sIFwiXCIpO1xuXHRcdG1hcmtlci5hcHBlbmRDaGlsZChzdXApO1xuXHR9IGVsc2UgaWYgKHN0eWxlID09PSBcImljb25cIikge1xuXHRcdG1hcmtlci5hZGRDbGFzcyhcImNtLWFuY2hvci1pY29uXCIpO1xuXHRcdG1hcmtlci50ZXh0Q29udGVudCA9IFwiXHVEODNEXHVEQ0FDXCI7XG5cdH0gZWxzZSB7XG5cdFx0bWFya2VyLmFkZENsYXNzKFwiY20tYW5jaG9yLWhpZ2hsaWdodFwiKTtcblx0XHRtYXJrZXIudGV4dENvbnRlbnQgPSBgWyR7aWR9XWA7XG5cdH1cblxuXHRtYXJrZXIuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcblx0XHQvLyBOYXZpZ2F0ZSB0byB0aGUgY29tbWVudCBpbiB0aGUgc2lkZWJhclxuXHRcdGNvbnN0IGxlYXZlcyA9IHBsdWdpbi5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShcImNvbW1lbnRzLW1hcmt1cC1zaWRlYmFyXCIpO1xuXHRcdGlmIChsZWF2ZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0cGx1Z2luLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihsZWF2ZXNbMF0pO1xuXHRcdH1cblx0fSk7XG5cblx0cmV0dXJuIG1hcmtlcjtcbn1cblxuZnVuY3Rpb24gcHJvY2Vzc0NvbW1lbnREZWZpbml0aW9ucyhcblx0ZWw6IEhUTUxFbGVtZW50LFxuXHRwbHVnaW46IENvbW1lbnRzTWFya3VwUGx1Z2luLFxuXHRjdHg6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHRcbikge1xuXHRjb25zdCBzZWN0aW9uSW5mbyA9IGN0eC5nZXRTZWN0aW9uSW5mbyhlbCk7XG5cdGlmICghc2VjdGlvbkluZm8pIHJldHVybjtcblxuXHRjb25zdCBzb3VyY2UgPSBzZWN0aW9uSW5mby50ZXh0O1xuXHRjb25zdCBsaW5lU3RhcnQgPSBzZWN0aW9uSW5mby5saW5lU3RhcnQ7XG5cdGNvbnN0IGxpbmVFbmQgPSBzZWN0aW9uSW5mby5saW5lRW5kO1xuXG5cdC8vIEV4dHJhY3QganVzdCB0aGlzIHNlY3Rpb24ncyBsaW5lc1xuXHRjb25zdCBhbGxMaW5lcyA9IHNvdXJjZS5zcGxpdChcIlxcblwiKTtcblx0Y29uc3Qgc2VjdGlvbkxpbmVzID0gYWxsTGluZXMuc2xpY2UobGluZVN0YXJ0LCBsaW5lRW5kICsgMSk7XG5cdGNvbnN0IHNlY3Rpb25UZXh0ID0gc2VjdGlvbkxpbmVzLmpvaW4oXCJcXG5cIik7XG5cblx0Ly8gUGFyc2UgdGhlIHNlY3Rpb24gZm9yIGNvbW1lbnQgZGVmaW5pdGlvbnNcblx0Y29uc3QgcGFyc2VkID0gcGFyc2VEb2N1bWVudChzZWN0aW9uVGV4dCk7XG5cdGlmIChwYXJzZWQuY29tbWVudHMubGVuZ3RoID09PSAwKSByZXR1cm47XG5cblx0Ly8gUmVwbGFjZSB0aGUgZW50aXJlIGVsZW1lbnQgY29udGVudCB3aXRoIHJlbmRlcmVkIGNvbW1lbnRzXG5cdGVsLmVtcHR5KCk7XG5cdGVsLmFkZENsYXNzKFwiY20tY29tbWVudHMtc2VjdGlvblwiKTtcblxuXHRmb3IgKGNvbnN0IGNvbW1lbnQgb2YgcGFyc2VkLmNvbW1lbnRzKSB7XG5cdFx0Y29uc3QgdGhyZWFkRWwgPSByZW5kZXJUaHJlYWQoY29tbWVudCwgcGx1Z2luLCBjdHgpO1xuXHRcdGVsLmFwcGVuZENoaWxkKHRocmVhZEVsKTtcblx0fVxufVxuXG5mdW5jdGlvbiByZW5kZXJUaHJlYWQoXG5cdGNvbW1lbnQ6IENvbW1lbnRFbnRyeSxcblx0cGx1Z2luOiBDb21tZW50c01hcmt1cFBsdWdpbixcblx0Y3R4OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0XG4pOiBIVE1MRWxlbWVudCB7XG5cdGNvbnN0IHRocmVhZEVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcblx0dGhyZWFkRWwuYWRkQ2xhc3MoXCJjbS1jb21tZW50LXRocmVhZFwiKTtcblx0aWYgKGNvbW1lbnQuc3RhdGUgPT09IFwicmVzb2x2ZWRcIikge1xuXHRcdHRocmVhZEVsLmFkZENsYXNzKFwiY20tY29tbWVudC1yZXNvbHZlZFwiKTtcblx0fVxuXG5cdC8vIFJvb3QgY29tbWVudFxuXHRjb25zdCByb290RWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRyb290RWwuYWRkQ2xhc3MoXCJjbS1jb21tZW50LXJvb3RcIik7XG5cblx0Y29uc3QgaGVhZGVyRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xuXHRoZWFkZXJFbC5hZGRDbGFzcyhcImNtLWNvbW1lbnQtaGVhZGVyXCIpO1xuXG5cdC8vIFN0YXRlIGNoZWNrYm94XG5cdGNvbnN0IGNoZWNrYm94ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImlucHV0XCIpO1xuXHRjaGVja2JveC50eXBlID0gXCJjaGVja2JveFwiO1xuXHRjaGVja2JveC5jaGVja2VkID0gY29tbWVudC5zdGF0ZSA9PT0gXCJyZXNvbHZlZFwiO1xuXHRjaGVja2JveC5hZGRDbGFzcyhcImNtLWNvbW1lbnQtY2hlY2tib3hcIik7XG5cdGNoZWNrYm94LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuXHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHR0b2dnbGVDb21tZW50U3RhdGUoY29tbWVudC5pZCwgcGx1Z2luKTtcblx0fSk7XG5cdGhlYWRlckVsLmFwcGVuZENoaWxkKGNoZWNrYm94KTtcblxuXHQvLyBBdXRob3Jcblx0Y29uc3QgYXV0aG9yRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcblx0YXV0aG9yRWwuYWRkQ2xhc3MoXCJjbS1jb21tZW50LWF1dGhvclwiKTtcblx0YXV0aG9yRWwudGV4dENvbnRlbnQgPSBgQCR7Y29tbWVudC5hdXRob3J9YDtcblx0aGVhZGVyRWwuYXBwZW5kQ2hpbGQoYXV0aG9yRWwpO1xuXG5cdC8vIERhdGVcblx0Y29uc3QgZGF0ZUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG5cdGRhdGVFbC5hZGRDbGFzcyhcImNtLWNvbW1lbnQtZGF0ZVwiKTtcblx0ZGF0ZUVsLnRleHRDb250ZW50ID0gY29tbWVudC5kYXRlO1xuXHRoZWFkZXJFbC5hcHBlbmRDaGlsZChkYXRlRWwpO1xuXG5cdC8vIElEIGJhZGdlXG5cdGNvbnN0IGlkRWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcblx0aWRFbC5hZGRDbGFzcyhcImNtLWNvbW1lbnQtaWRcIik7XG5cdGlkRWwudGV4dENvbnRlbnQgPSBjb21tZW50LmlkO1xuXHRoZWFkZXJFbC5hcHBlbmRDaGlsZChpZEVsKTtcblxuXHRyb290RWwuYXBwZW5kQ2hpbGQoaGVhZGVyRWwpO1xuXG5cdGNvbnN0IHRleHRFbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdHRleHRFbC5hZGRDbGFzcyhcImNtLWNvbW1lbnQtdGV4dFwiKTtcblx0dGV4dEVsLnRleHRDb250ZW50ID0gY29tbWVudC50ZXh0O1xuXHRyb290RWwuYXBwZW5kQ2hpbGQodGV4dEVsKTtcblxuXHR0aHJlYWRFbC5hcHBlbmRDaGlsZChyb290RWwpO1xuXG5cdC8vIFJlcGxpZXNcblx0Zm9yIChjb25zdCByZXBseSBvZiBjb21tZW50LnJlcGxpZXMpIHtcblx0XHRjb25zdCByZXBseUVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcblx0XHRyZXBseUVsLmFkZENsYXNzKFwiY20tY29tbWVudC1yZXBseVwiKTtcblxuXHRcdGNvbnN0IHJlcGx5SGVhZGVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcblx0XHRyZXBseUhlYWRlci5hZGRDbGFzcyhcImNtLWNvbW1lbnQtaGVhZGVyXCIpO1xuXG5cdFx0Y29uc3QgcmVwbHlBdXRob3IgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcblx0XHRyZXBseUF1dGhvci5hZGRDbGFzcyhcImNtLWNvbW1lbnQtYXV0aG9yXCIpO1xuXHRcdHJlcGx5QXV0aG9yLnRleHRDb250ZW50ID0gYEAke3JlcGx5LmF1dGhvcn1gO1xuXHRcdHJlcGx5SGVhZGVyLmFwcGVuZENoaWxkKHJlcGx5QXV0aG9yKTtcblxuXHRcdGNvbnN0IHJlcGx5RGF0ZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuXHRcdHJlcGx5RGF0ZS5hZGRDbGFzcyhcImNtLWNvbW1lbnQtZGF0ZVwiKTtcblx0XHRyZXBseURhdGUudGV4dENvbnRlbnQgPSByZXBseS5kYXRlO1xuXHRcdHJlcGx5SGVhZGVyLmFwcGVuZENoaWxkKHJlcGx5RGF0ZSk7XG5cblx0XHRyZXBseUVsLmFwcGVuZENoaWxkKHJlcGx5SGVhZGVyKTtcblxuXHRcdGNvbnN0IHJlcGx5VGV4dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG5cdFx0cmVwbHlUZXh0LmFkZENsYXNzKFwiY20tY29tbWVudC10ZXh0XCIpO1xuXHRcdHJlcGx5VGV4dC50ZXh0Q29udGVudCA9IHJlcGx5LnRleHQ7XG5cdFx0cmVwbHlFbC5hcHBlbmRDaGlsZChyZXBseVRleHQpO1xuXG5cdFx0dGhyZWFkRWwuYXBwZW5kQ2hpbGQocmVwbHlFbCk7XG5cdH1cblxuXHRyZXR1cm4gdGhyZWFkRWw7XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZUNvbW1lbnRTdGF0ZShjb21tZW50SWQ6IHN0cmluZywgcGx1Z2luOiBDb21tZW50c01hcmt1cFBsdWdpbikge1xuXHRjb25zdCB2aWV3ID0gcGx1Z2luLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xuXHRpZiAoIXZpZXcpIHJldHVybjtcblxuXHRjb25zdCBlZGl0b3IgPSB2aWV3LmVkaXRvcjtcblx0Y29uc3Qgc291cmNlID0gZWRpdG9yLmdldFZhbHVlKCk7XG5cdGNvbnN0IGxpbmVzID0gc291cmNlLnNwbGl0KFwiXFxuXCIpO1xuXG5cdC8vIEZpbmQgdGhlIGNvbW1lbnQgZGVmaW5pdGlvbiBsaW5lXG5cdGNvbnN0IGNvbW1lbnRSZSA9IG5ldyBSZWdFeHAoXG5cdFx0YF4oXFxcXHMqXFxcXHtcXFxcXiR7ZXNjYXBlUmVnZXgoY29tbWVudElkKX1cXFxccytcXFxcWykoWyB4XSkoXFxcXF1cXFxcfS4qKSRgXG5cdCk7XG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuXHRcdGNvbnN0IG1hdGNoID0gbGluZXNbaV0ubWF0Y2goY29tbWVudFJlKTtcblx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdGNvbnN0IG5ld1N0YXRlID0gbWF0Y2hbMl0gPT09IFwieFwiID8gXCIgXCIgOiBcInhcIjtcblx0XHRcdGNvbnN0IG5ld0xpbmUgPSBtYXRjaFsxXSArIG5ld1N0YXRlICsgbWF0Y2hbM107XG5cdFx0XHRlZGl0b3IucmVwbGFjZVJhbmdlKFxuXHRcdFx0XHRuZXdMaW5lLFxuXHRcdFx0XHR7IGxpbmU6IGksIGNoOiAwIH0sXG5cdFx0XHRcdHsgbGluZTogaSwgY2g6IGxpbmVzW2ldLmxlbmd0aCB9XG5cdFx0XHQpO1xuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIGVzY2FwZVJlZ2V4KHM6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiBzLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCBcIlxcXFwkJlwiKTtcbn1cbiIsICJpbXBvcnQgdHlwZSB7IEFuY2hvciwgQ29tbWVudEVudHJ5LCBSZXBseUVudHJ5LCBQYXJzZWREb2N1bWVudCB9IGZyb20gXCIuL3R5cGVzXCI7XG5cbmNvbnN0IEFOQ0hPUl9SRSA9IC9cXHtcXF4oW2EtekEtWjAtOV8tXSspXFx9L2c7XG5jb25zdCBDT01NRU5UX1JFID1cblx0L15cXHMqXFx7XFxeKFthLXpBLVowLTlfLV0rKVxccytcXFsoWyB4XSlcXF1cXH1cXHMrQChbYS16QS1aMC05Xy1dKylcXHMrKFxcZHs0fS1cXGR7Mn0tXFxkezJ9KD86VFxcZHsyfTpcXGR7Mn0oPzo6XFxkezJ9KT8oPzpafFsrLV1cXGR7Mn06XFxkezJ9KSk/KTpcXHMrKC4qKS87XG5jb25zdCBSRVBMWV9SRSA9XG5cdC9eXFxzKlxce1xcXihbYS16QS1aMC05Xy1dKylcXC4oXFxkKylcXH1cXHMrQChbYS16QS1aMC05Xy1dKylcXHMrKFxcZHs0fS1cXGR7Mn0tXFxkezJ9KD86VFxcZHsyfTpcXGR7Mn0oPzo6XFxkezJ9KT8oPzpafFsrLV1cXGR7Mn06XFxkezJ9KSk/KTpcXHMrKC4qKS87XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZURvY3VtZW50KHNvdXJjZTogc3RyaW5nKTogUGFyc2VkRG9jdW1lbnQge1xuXHRjb25zdCBsaW5lcyA9IHNvdXJjZS5zcGxpdChcIlxcblwiKTtcblx0Y29uc3QgYW5jaG9yczogQW5jaG9yW10gPSBbXTtcblx0Y29uc3QgY29tbWVudHM6IENvbW1lbnRFbnRyeVtdID0gW107XG5cdGNvbnN0IHJlcGxpZXM6IFJlcGx5RW50cnlbXSA9IFtdO1xuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbGluZXMubGVuZ3RoOyBpKyspIHtcblx0XHRjb25zdCBsaW5lID0gbGluZXNbaV07XG5cblx0XHQvLyBUcnkgY29tbWVudCBmaXJzdCAobW9zdCBzcGVjaWZpYylcblx0XHRjb25zdCBjb21tZW50TWF0Y2ggPSBsaW5lLm1hdGNoKENPTU1FTlRfUkUpO1xuXHRcdGlmIChjb21tZW50TWF0Y2gpIHtcblx0XHRcdGNvbW1lbnRzLnB1c2goe1xuXHRcdFx0XHRpZDogY29tbWVudE1hdGNoWzFdLFxuXHRcdFx0XHRzdGF0ZTogY29tbWVudE1hdGNoWzJdID09PSBcInhcIiA/IFwicmVzb2x2ZWRcIiA6IFwib3BlblwiLFxuXHRcdFx0XHRhdXRob3I6IGNvbW1lbnRNYXRjaFszXSxcblx0XHRcdFx0ZGF0ZTogY29tbWVudE1hdGNoWzRdLFxuXHRcdFx0XHR0ZXh0OiBjb21tZW50TWF0Y2hbNV0sXG5cdFx0XHRcdGxpbmU6IGksXG5cdFx0XHRcdHJlcGxpZXM6IFtdLFxuXHRcdFx0fSk7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cblx0XHQvLyBUcnkgcmVwbHlcblx0XHRjb25zdCByZXBseU1hdGNoID0gbGluZS5tYXRjaChSRVBMWV9SRSk7XG5cdFx0aWYgKHJlcGx5TWF0Y2gpIHtcblx0XHRcdHJlcGxpZXMucHVzaCh7XG5cdFx0XHRcdGlkOiByZXBseU1hdGNoWzFdLFxuXHRcdFx0XHRudW1iZXI6IHBhcnNlSW50KHJlcGx5TWF0Y2hbMl0sIDEwKSxcblx0XHRcdFx0YXV0aG9yOiByZXBseU1hdGNoWzNdLFxuXHRcdFx0XHRkYXRlOiByZXBseU1hdGNoWzRdLFxuXHRcdFx0XHR0ZXh0OiByZXBseU1hdGNoWzVdLFxuXHRcdFx0XHRsaW5lOiBpLFxuXHRcdFx0fSk7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cblx0XHQvLyBDb2xsZWN0IGFuY2hvcnMgZnJvbSBub24tY29tbWVudC9yZXBseSBsaW5lc1xuXHRcdGxldCBtYXRjaDogUmVnRXhwRXhlY0FycmF5IHwgbnVsbDtcblx0XHRBTkNIT1JfUkUubGFzdEluZGV4ID0gMDtcblx0XHR3aGlsZSAoKG1hdGNoID0gQU5DSE9SX1JFLmV4ZWMobGluZSkpICE9PSBudWxsKSB7XG5cdFx0XHRhbmNob3JzLnB1c2goe1xuXHRcdFx0XHRpZDogbWF0Y2hbMV0sXG5cdFx0XHRcdGxpbmU6IGksXG5cdFx0XHRcdGNvbDogbWF0Y2guaW5kZXgsXG5cdFx0XHRcdGxlbmd0aDogbWF0Y2hbMF0ubGVuZ3RoLFxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gR3JvdXAgcmVwbGllcyB1bmRlciB0aGVpciBwYXJlbnQgY29tbWVudHNcblx0Zm9yIChjb25zdCByZXBseSBvZiByZXBsaWVzKSB7XG5cdFx0Y29uc3QgcGFyZW50ID0gY29tbWVudHMuZmluZCgoYykgPT4gYy5pZCA9PT0gcmVwbHkuaWQpO1xuXHRcdGlmIChwYXJlbnQpIHtcblx0XHRcdHBhcmVudC5yZXBsaWVzLnB1c2gocmVwbHkpO1xuXHRcdH1cblx0fVxuXG5cdC8vIFNvcnQgcmVwbGllcyBieSBudW1iZXIgd2l0aGluIGVhY2ggY29tbWVudFxuXHRmb3IgKGNvbnN0IGNvbW1lbnQgb2YgY29tbWVudHMpIHtcblx0XHRjb21tZW50LnJlcGxpZXMuc29ydCgoYSwgYikgPT4gYS5udW1iZXIgLSBiLm51bWJlcik7XG5cdH1cblxuXHRyZXR1cm4geyBhbmNob3JzLCBjb21tZW50cyB9O1xufVxuIiwgImltcG9ydCB7XG5cdEVkaXRvclZpZXcsXG5cdERlY29yYXRpb24sXG5cdERlY29yYXRpb25TZXQsXG5cdFZpZXdQbHVnaW4sXG5cdFZpZXdVcGRhdGUsXG5cdFdpZGdldFR5cGUsXG59IGZyb20gXCJAY29kZW1pcnJvci92aWV3XCI7XG5pbXBvcnQgeyBSYW5nZVNldEJ1aWxkZXIgfSBmcm9tIFwiQGNvZGVtaXJyb3Ivc3RhdGVcIjtcbmltcG9ydCB0eXBlIHsgQ29tbWVudHNNYXJrdXBTZXR0aW5ncyB9IGZyb20gXCIuLi9zZXR0aW5ncy9zZXR0aW5nc1wiO1xuXG5jb25zdCBBTkNIT1JfUkUgPSAvXFx7XFxeKFthLXpBLVowLTlfLV0rKVxcfS9nO1xuY29uc3QgQ09NTUVOVF9SRSA9XG5cdC9eXFxzKlxce1xcXlthLXpBLVowLTlfLV0rXFxzK1xcW1sgeF1cXF1cXH1cXHMrQFthLXpBLVowLTlfLV0rXFxzK1xcZHs0fS1cXGR7Mn0tXFxkezJ9LztcbmNvbnN0IFJFUExZX1JFID1cblx0L15cXHMqXFx7XFxeW2EtekEtWjAtOV8tXStcXC5cXGQrXFx9XFxzK0BbYS16QS1aMC05Xy1dK1xccytcXGR7NH0tXFxkezJ9LVxcZHsyfS87XG5cbmNsYXNzIEFuY2hvcldpZGdldCBleHRlbmRzIFdpZGdldFR5cGUge1xuXHRjb25zdHJ1Y3RvcihyZWFkb25seSBpZDogc3RyaW5nLCByZWFkb25seSBzdHlsZTogc3RyaW5nKSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHRvRE9NKCk6IEhUTUxFbGVtZW50IHtcblx0XHRjb25zdCBzcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XG5cdFx0c3Bhbi5jbGFzc05hbWUgPSBcImNtLWFuY2hvci1tYXJrZXIgY20tYW5jaG9yLWlubGluZVwiO1xuXG5cdFx0aWYgKHRoaXMuc3R5bGUgPT09IFwic3VwZXJzY3JpcHRcIikge1xuXHRcdFx0Y29uc3Qgc3VwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInN1cFwiKTtcblx0XHRcdHN1cC5jbGFzc05hbWUgPSBcImNtLWFuY2hvci1zdXBlcnNjcmlwdFwiO1xuXHRcdFx0c3VwLnRleHRDb250ZW50ID0gdGhpcy5pZC5yZXBsYWNlKC9eYy8sIFwiXCIpO1xuXHRcdFx0c3Bhbi5hcHBlbmRDaGlsZChzdXApO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5zdHlsZSA9PT0gXCJpY29uXCIpIHtcblx0XHRcdHNwYW4uY2xhc3NOYW1lICs9IFwiIGNtLWFuY2hvci1pY29uXCI7XG5cdFx0XHRzcGFuLnRleHRDb250ZW50ID0gXCJcdUQ4M0RcdURDQUNcIjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c3Bhbi5jbGFzc05hbWUgKz0gXCIgY20tYW5jaG9yLWhpZ2hsaWdodFwiO1xuXHRcdFx0c3Bhbi50ZXh0Q29udGVudCA9IGBbJHt0aGlzLmlkfV1gO1xuXHRcdH1cblxuXHRcdHJldHVybiBzcGFuO1xuXHR9XG5cblx0ZXEob3RoZXI6IEFuY2hvcldpZGdldCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmlkID09PSBvdGhlci5pZCAmJiB0aGlzLnN0eWxlID09PSBvdGhlci5zdHlsZTtcblx0fVxufVxuXG5mdW5jdGlvbiBidWlsZERlY29yYXRpb25zKHZpZXc6IEVkaXRvclZpZXcsIHNldHRpbmdzOiBDb21tZW50c01hcmt1cFNldHRpbmdzKTogRGVjb3JhdGlvblNldCB7XG5cdGNvbnN0IGJ1aWxkZXIgPSBuZXcgUmFuZ2VTZXRCdWlsZGVyPERlY29yYXRpb24+KCk7XG5cdGNvbnN0IGRvYyA9IHZpZXcuc3RhdGUuZG9jO1xuXG5cdGNvbnN0IGRlY29yYXRpb25zOiB7IGZyb206IG51bWJlcjsgdG86IG51bWJlcjsgZGVjb3JhdGlvbjogRGVjb3JhdGlvbiB9W10gPSBbXTtcblxuXHRmb3IgKGxldCBpID0gMTsgaSA8PSBkb2MubGluZXM7IGkrKykge1xuXHRcdGNvbnN0IGxpbmUgPSBkb2MubGluZShpKTtcblx0XHRjb25zdCB0ZXh0ID0gbGluZS50ZXh0O1xuXG5cdFx0Ly8gU2tpcCBjb21tZW50L3JlcGx5IGRlZmluaXRpb24gbGluZXMgZm9yIGFuY2hvciByZXBsYWNlbWVudFxuXHRcdGlmIChDT01NRU5UX1JFLnRlc3QodGV4dCkgfHwgUkVQTFlfUkUudGVzdCh0ZXh0KSkge1xuXHRcdFx0Ly8gU3R5bGUgdGhlIHdob2xlIGxpbmUgYXMgYSBjb21tZW50IGRlZmluaXRpb25cblx0XHRcdGRlY29yYXRpb25zLnB1c2goe1xuXHRcdFx0XHRmcm9tOiBsaW5lLmZyb20sXG5cdFx0XHRcdHRvOiBsaW5lLmZyb20sXG5cdFx0XHRcdGRlY29yYXRpb246IERlY29yYXRpb24ubGluZSh7IGNsYXNzOiBcImNtLWNvbW1lbnQtZGVmLWxpbmVcIiB9KSxcblx0XHRcdH0pO1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0Ly8gRmluZCBhbmQgcmVwbGFjZSBhbmNob3JzIGlubGluZVxuXHRcdEFOQ0hPUl9SRS5sYXN0SW5kZXggPSAwO1xuXHRcdGxldCBtYXRjaDogUmVnRXhwRXhlY0FycmF5IHwgbnVsbDtcblx0XHR3aGlsZSAoKG1hdGNoID0gQU5DSE9SX1JFLmV4ZWModGV4dCkpICE9PSBudWxsKSB7XG5cdFx0XHRjb25zdCBmcm9tID0gbGluZS5mcm9tICsgbWF0Y2guaW5kZXg7XG5cdFx0XHRjb25zdCB0byA9IGZyb20gKyBtYXRjaFswXS5sZW5ndGg7XG5cdFx0XHRkZWNvcmF0aW9ucy5wdXNoKHtcblx0XHRcdFx0ZnJvbSxcblx0XHRcdFx0dG8sXG5cdFx0XHRcdGRlY29yYXRpb246IERlY29yYXRpb24ucmVwbGFjZSh7XG5cdFx0XHRcdFx0d2lkZ2V0OiBuZXcgQW5jaG9yV2lkZ2V0KG1hdGNoWzFdLCBzZXR0aW5ncy5hbmNob3JTdHlsZSksXG5cdFx0XHRcdH0pLFxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gU29ydCBieSBwb3NpdGlvbiAocmVxdWlyZWQgYnkgUmFuZ2VTZXRCdWlsZGVyKVxuXHRkZWNvcmF0aW9ucy5zb3J0KChhLCBiKSA9PiBhLmZyb20gLSBiLmZyb20gfHwgYS50byAtIGIudG8pO1xuXHRmb3IgKGNvbnN0IGQgb2YgZGVjb3JhdGlvbnMpIHtcblx0XHRidWlsZGVyLmFkZChkLmZyb20sIGQudG8sIGQuZGVjb3JhdGlvbik7XG5cdH1cblxuXHRyZXR1cm4gYnVpbGRlci5maW5pc2goKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUVkaXRvckV4dGVuc2lvbnMoc2V0dGluZ3NHZXR0ZXI6ICgpID0+IENvbW1lbnRzTWFya3VwU2V0dGluZ3MpIHtcblx0cmV0dXJuIFZpZXdQbHVnaW4uZnJvbUNsYXNzKFxuXHRcdGNsYXNzIHtcblx0XHRcdGRlY29yYXRpb25zOiBEZWNvcmF0aW9uU2V0O1xuXG5cdFx0XHRjb25zdHJ1Y3Rvcih2aWV3OiBFZGl0b3JWaWV3KSB7XG5cdFx0XHRcdHRoaXMuZGVjb3JhdGlvbnMgPSBidWlsZERlY29yYXRpb25zKHZpZXcsIHNldHRpbmdzR2V0dGVyKCkpO1xuXHRcdFx0fVxuXG5cdFx0XHR1cGRhdGUodXBkYXRlOiBWaWV3VXBkYXRlKSB7XG5cdFx0XHRcdGlmICh1cGRhdGUuZG9jQ2hhbmdlZCB8fCB1cGRhdGUudmlld3BvcnRDaGFuZ2VkKSB7XG5cdFx0XHRcdFx0dGhpcy5kZWNvcmF0aW9ucyA9IGJ1aWxkRGVjb3JhdGlvbnModXBkYXRlLnZpZXcsIHNldHRpbmdzR2V0dGVyKCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblx0XHR7XG5cdFx0XHRkZWNvcmF0aW9uczogKHYpID0+IHYuZGVjb3JhdGlvbnMsXG5cdFx0fVxuXHQpO1xufVxuIiwgImltcG9ydCB7IEVkaXRvciwgTWFya2Rvd25WaWV3LCBNb2RhbCwgQXBwIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSBDb21tZW50c01hcmt1cFBsdWdpbiBmcm9tIFwiLi4vbWFpblwiO1xuaW1wb3J0IHsgcGFyc2VEb2N1bWVudCB9IGZyb20gXCIuLi9wYXJzZXIvcGFyc2VyXCI7XG5pbXBvcnQgeyBmb3JtYXREYXRlLCBuZXh0Q29tbWVudElkIH0gZnJvbSBcIi4uL3V0aWxzXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckNvbW1hbmRzKHBsdWdpbjogQ29tbWVudHNNYXJrdXBQbHVnaW4pIHtcblx0cGx1Z2luLmFkZENvbW1hbmQoe1xuXHRcdGlkOiBcImluc2VydC1jb21tZW50XCIsXG5cdFx0bmFtZTogXCJJbnNlcnQgY29tbWVudFwiLFxuXHRcdGVkaXRvckNhbGxiYWNrOiAoZWRpdG9yOiBFZGl0b3IsIHZpZXc6IE1hcmtkb3duVmlldykgPT4ge1xuXHRcdFx0ZW5zdXJlQXV0aG9yKHBsdWdpbiwgKCkgPT4gaW5zZXJ0Q29tbWVudChlZGl0b3IsIHBsdWdpbikpO1xuXHRcdH0sXG5cdH0pO1xuXG5cdHBsdWdpbi5hZGRDb21tYW5kKHtcblx0XHRpZDogXCJyZXBseS10by1jb21tZW50XCIsXG5cdFx0bmFtZTogXCJSZXBseSB0byBjb21tZW50XCIsXG5cdFx0ZWRpdG9yQ2FsbGJhY2s6IChlZGl0b3I6IEVkaXRvciwgdmlldzogTWFya2Rvd25WaWV3KSA9PiB7XG5cdFx0XHRlbnN1cmVBdXRob3IocGx1Z2luLCAoKSA9PiByZXBseVRvQ29tbWVudChlZGl0b3IsIHBsdWdpbikpO1xuXHRcdH0sXG5cdH0pO1xuXG5cdHBsdWdpbi5hZGRDb21tYW5kKHtcblx0XHRpZDogXCJ0b2dnbGUtcmVzb2x2ZVwiLFxuXHRcdG5hbWU6IFwiVG9nZ2xlIGNvbW1lbnQgcmVzb2x2ZWRcIixcblx0XHRlZGl0b3JDYWxsYmFjazogKGVkaXRvcjogRWRpdG9yLCB2aWV3OiBNYXJrZG93blZpZXcpID0+IHtcblx0XHRcdHRvZ2dsZVJlc29sdmUoZWRpdG9yKTtcblx0XHR9LFxuXHR9KTtcblxuXHRwbHVnaW4uYWRkQ29tbWFuZCh7XG5cdFx0aWQ6IFwic2hvdy1jb21tZW50cy1wYW5lbFwiLFxuXHRcdG5hbWU6IFwiU2hvdyBjb21tZW50cyBwYW5lbFwiLFxuXHRcdGNhbGxiYWNrOiAoKSA9PiB7XG5cdFx0XHRvcGVuU2lkZWJhcihwbHVnaW4pO1xuXHRcdH0sXG5cdH0pO1xufVxuXG5mdW5jdGlvbiBlbnN1cmVBdXRob3IocGx1Z2luOiBDb21tZW50c01hcmt1cFBsdWdpbiwgY2FsbGJhY2s6ICgpID0+IHZvaWQpIHtcblx0aWYgKHBsdWdpbi5zZXR0aW5ncy5hdXRob3IpIHtcblx0XHRjYWxsYmFjaygpO1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IG1vZGFsID0gbmV3IEF1dGhvclByb21wdE1vZGFsKHBsdWdpbi5hcHAsIGFzeW5jIChhdXRob3IpID0+IHtcblx0XHRwbHVnaW4uc2V0dGluZ3MuYXV0aG9yID0gYXV0aG9yO1xuXHRcdGF3YWl0IHBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcblx0XHRjYWxsYmFjaygpO1xuXHR9KTtcblx0bW9kYWwub3BlbigpO1xufVxuXG5jbGFzcyBBdXRob3JQcm9tcHRNb2RhbCBleHRlbmRzIE1vZGFsIHtcblx0cHJpdmF0ZSBvblN1Ym1pdDogKGF1dGhvcjogc3RyaW5nKSA9PiB2b2lkO1xuXG5cdGNvbnN0cnVjdG9yKGFwcDogQXBwLCBvblN1Ym1pdDogKGF1dGhvcjogc3RyaW5nKSA9PiB2b2lkKSB7XG5cdFx0c3VwZXIoYXBwKTtcblx0XHR0aGlzLm9uU3VibWl0ID0gb25TdWJtaXQ7XG5cdH1cblxuXHRvbk9wZW4oKSB7XG5cdFx0Y29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG5cdFx0Y29udGVudEVsLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBcIlNldCB5b3VyIGF1dGhvciBuYW1lXCIgfSk7XG5cdFx0Y29udGVudEVsLmNyZWF0ZUVsKFwicFwiLCB7XG5cdFx0XHR0ZXh0OiBcIlRoaXMgd2lsbCBiZSB1c2VkIGFzIHlvdXIgQGF1dGhvciBpZGVudGlmaWVyIGluIGNvbW1lbnRzLlwiLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgaW5wdXQgPSBjb250ZW50RWwuY3JlYXRlRWwoXCJpbnB1dFwiLCB7XG5cdFx0XHR0eXBlOiBcInRleHRcIixcblx0XHRcdHBsYWNlaG9sZGVyOiBcImUuZy4gYWxpY2VcIixcblx0XHR9KTtcblx0XHRpbnB1dC5hZGRDbGFzcyhcImNtLWF1dGhvci1pbnB1dFwiKTtcblx0XHRpbnB1dC5mb2N1cygpO1xuXG5cdFx0Y29uc3Qgc3VibWl0QnRuID0gY29udGVudEVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJTYXZlXCIgfSk7XG5cdFx0c3VibWl0QnRuLmFkZENsYXNzKFwibW9kLWN0YVwiKTtcblx0XHRzdWJtaXRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcblx0XHRcdGNvbnN0IHZhbHVlID0gaW5wdXQudmFsdWUudHJpbSgpLnJlcGxhY2UoL1xccysvZywgXCItXCIpO1xuXHRcdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRcdHRoaXMub25TdWJtaXQodmFsdWUpO1xuXHRcdFx0XHR0aGlzLmNsb3NlKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZSkgPT4ge1xuXHRcdFx0aWYgKGUua2V5ID09PSBcIkVudGVyXCIpIHtcblx0XHRcdFx0c3VibWl0QnRuLmNsaWNrKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRvbkNsb3NlKCkge1xuXHRcdHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gaW5zZXJ0Q29tbWVudChlZGl0b3I6IEVkaXRvciwgcGx1Z2luOiBDb21tZW50c01hcmt1cFBsdWdpbikge1xuXHRjb25zdCBzb3VyY2UgPSBlZGl0b3IuZ2V0VmFsdWUoKTtcblx0Y29uc3QgcGFyc2VkID0gcGFyc2VEb2N1bWVudChzb3VyY2UpO1xuXHRjb25zdCBpZCA9IG5leHRDb21tZW50SWQocGFyc2VkKTtcblx0Y29uc3QgZGF0ZSA9IGZvcm1hdERhdGUoXG5cdFx0cGx1Z2luLnNldHRpbmdzLmRhdGVGb3JtYXQsXG5cdFx0cGx1Z2luLnNldHRpbmdzLnRpbWV6b25lXG5cdCk7XG5cdGNvbnN0IGF1dGhvciA9IHBsdWdpbi5zZXR0aW5ncy5hdXRob3I7XG5cdGNvbnN0IGN1cnNvciA9IGVkaXRvci5nZXRDdXJzb3IoKTtcblxuXHQvLyBJbnNlcnQgYW5jaG9yIGF0IGN1cnNvclxuXHRjb25zdCBhbmNob3JUZXh0ID0gYHteJHtpZH19YDtcblx0ZWRpdG9yLnJlcGxhY2VSYW5nZShhbmNob3JUZXh0LCBjdXJzb3IpO1xuXG5cdC8vIEZpbmQgb3IgY3JlYXRlIENvbW1lbnRzIHNlY3Rpb25cblx0Y29uc3QgbGluZXMgPSBlZGl0b3IuZ2V0VmFsdWUoKS5zcGxpdChcIlxcblwiKTtcblx0bGV0IGNvbW1lbnRzU2VjdGlvbkxpbmUgPSAtMTtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuXHRcdGlmICgvXiMjXFxzK0NvbW1lbnRzXFxzKiQvLnRlc3QobGluZXNbaV0pKSB7XG5cdFx0XHRjb21tZW50c1NlY3Rpb25MaW5lID0gaTtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IGNvbW1lbnREZWYgPSBge14ke2lkfSBbIF19IEAke2F1dGhvcn0gJHtkYXRlfTogYDtcblxuXHRpZiAoY29tbWVudHNTZWN0aW9uTGluZSA9PT0gLTEpIHtcblx0XHQvLyBBcHBlbmQgQ29tbWVudHMgc2VjdGlvbiBhdCB0aGUgZW5kXG5cdFx0Y29uc3QgbGFzdExpbmUgPSBlZGl0b3IubGFzdExpbmUoKTtcblx0XHRjb25zdCBhcHBlbmRUZXh0ID0gYFxcblxcbiMjIENvbW1lbnRzXFxuXFxuJHtjb21tZW50RGVmfWA7XG5cdFx0ZWRpdG9yLnJlcGxhY2VSYW5nZShhcHBlbmRUZXh0LCB7XG5cdFx0XHRsaW5lOiBsYXN0TGluZSxcblx0XHRcdGNoOiBsaW5lc1tsYXN0TGluZV0ubGVuZ3RoLFxuXHRcdH0pO1xuXHRcdC8vIFBsYWNlIGN1cnNvciBhdCBlbmQgb2YgY29tbWVudCBkZWZpbml0aW9uXG5cdFx0Y29uc3QgbmV3TGluZXMgPSBlZGl0b3IuZ2V0VmFsdWUoKS5zcGxpdChcIlxcblwiKTtcblx0XHRjb25zdCBkZWZMaW5lID0gbmV3TGluZXMubGVuZ3RoIC0gMTtcblx0XHRlZGl0b3Iuc2V0Q3Vyc29yKHsgbGluZTogZGVmTGluZSwgY2g6IG5ld0xpbmVzW2RlZkxpbmVdLmxlbmd0aCB9KTtcblx0fSBlbHNlIHtcblx0XHQvLyBGaW5kIHRoZSBsYXN0IGNvbW1lbnQvcmVwbHkgbGluZSBhZnRlciB0aGUgc2VjdGlvbiBoZWFkaW5nXG5cdFx0bGV0IGluc2VydExpbmUgPSBjb21tZW50c1NlY3Rpb25MaW5lICsgMTtcblx0XHRmb3IgKGxldCBpID0gY29tbWVudHNTZWN0aW9uTGluZSArIDE7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0aWYgKGxpbmVzW2ldLnRyaW0oKSAhPT0gXCJcIikge1xuXHRcdFx0XHRpbnNlcnRMaW5lID0gaSArIDE7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdC8vIEluc2VydCBhZnRlciB0aGUgbGFzdCBjb21tZW50LCB3aXRoIGEgYmxhbmsgbGluZSBzZXBhcmF0b3Jcblx0XHRjb25zdCBpbnNlcnRUZXh0ID0gYFxcbiR7Y29tbWVudERlZn1gO1xuXHRcdGVkaXRvci5yZXBsYWNlUmFuZ2UoaW5zZXJ0VGV4dCwgeyBsaW5lOiBpbnNlcnRMaW5lLCBjaDogMCB9KTtcblx0XHQvLyBQbGFjZSBjdXJzb3IgYXQgZW5kIG9mIGNvbW1lbnQgZGVmaW5pdGlvblxuXHRcdGNvbnN0IG5ld0xpbmVzID0gZWRpdG9yLmdldFZhbHVlKCkuc3BsaXQoXCJcXG5cIik7XG5cdFx0ZWRpdG9yLnNldEN1cnNvcih7XG5cdFx0XHRsaW5lOiBpbnNlcnRMaW5lICsgMSxcblx0XHRcdGNoOiBuZXdMaW5lc1tpbnNlcnRMaW5lICsgMV0/Lmxlbmd0aCB8fCAwLFxuXHRcdH0pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHJlcGx5VG9Db21tZW50KGVkaXRvcjogRWRpdG9yLCBwbHVnaW46IENvbW1lbnRzTWFya3VwUGx1Z2luKSB7XG5cdGNvbnN0IHNvdXJjZSA9IGVkaXRvci5nZXRWYWx1ZSgpO1xuXHRjb25zdCBwYXJzZWQgPSBwYXJzZURvY3VtZW50KHNvdXJjZSk7XG5cdGNvbnN0IGN1cnNvciA9IGVkaXRvci5nZXRDdXJzb3IoKTtcblx0Y29uc3QgY3VycmVudExpbmUgPSBlZGl0b3IuZ2V0TGluZShjdXJzb3IubGluZSk7XG5cblx0Ly8gVHJ5IHRvIGRldGVjdCB3aGljaCBjb21tZW50IHRoZSBjdXJzb3IgaXMgb25cblx0Y29uc3QgY29tbWVudFJlID0gL1xce1xcXihbYS16QS1aMC05Xy1dKykoPzpcXHMrXFxbWyB4XVxcXXxcXC5cXGQrKVxcfS87XG5cdGNvbnN0IG1hdGNoID0gY3VycmVudExpbmUubWF0Y2goY29tbWVudFJlKTtcblxuXHRpZiAoIW1hdGNoKSB7XG5cdFx0Ly8gVHJ5IHRvIGZpbmQgYSBuZWFyYnkgYW5jaG9yXG5cdFx0Y29uc3QgYW5jaG9yUmUgPSAvXFx7XFxeKFthLXpBLVowLTlfLV0rKVxcfS87XG5cdFx0Y29uc3QgYW5jaG9yTWF0Y2ggPSBjdXJyZW50TGluZS5tYXRjaChhbmNob3JSZSk7XG5cdFx0aWYgKGFuY2hvck1hdGNoKSB7XG5cdFx0XHRhZGRSZXBseShlZGl0b3IsIHBsdWdpbiwgcGFyc2VkLCBhbmNob3JNYXRjaFsxXSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIE5vIGNvbnRleHQgXHUyMDE0IHNob3cgbm90aWNlXG5cdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLW5ld1xuXHRcdG5ldyAocmVxdWlyZShcIm9ic2lkaWFuXCIpLk5vdGljZSkoXG5cdFx0XHRcIlBsYWNlIGN1cnNvciBvbiBhIGNvbW1lbnQsIHJlcGx5LCBvciBhbmNob3IgdG8gcmVwbHkuXCJcblx0XHQpO1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGFkZFJlcGx5KGVkaXRvciwgcGx1Z2luLCBwYXJzZWQsIG1hdGNoWzFdKTtcbn1cblxuZnVuY3Rpb24gYWRkUmVwbHkoXG5cdGVkaXRvcjogRWRpdG9yLFxuXHRwbHVnaW46IENvbW1lbnRzTWFya3VwUGx1Z2luLFxuXHRwYXJzZWQ6IFJldHVyblR5cGU8dHlwZW9mIHBhcnNlRG9jdW1lbnQ+LFxuXHRjb21tZW50SWQ6IHN0cmluZ1xuKSB7XG5cdGNvbnN0IGNvbW1lbnQgPSBwYXJzZWQuY29tbWVudHMuZmluZCgoYykgPT4gYy5pZCA9PT0gY29tbWVudElkKTtcblx0aWYgKCFjb21tZW50KSByZXR1cm47XG5cblx0Y29uc3QgbmV4dFJlcGx5TnVtID1cblx0XHRjb21tZW50LnJlcGxpZXMubGVuZ3RoID4gMFxuXHRcdFx0PyBNYXRoLm1heCguLi5jb21tZW50LnJlcGxpZXMubWFwKChyKSA9PiByLm51bWJlcikpICsgMVxuXHRcdFx0OiAxO1xuXG5cdGNvbnN0IGRhdGUgPSBmb3JtYXREYXRlKFxuXHRcdHBsdWdpbi5zZXR0aW5ncy5kYXRlRm9ybWF0LFxuXHRcdHBsdWdpbi5zZXR0aW5ncy50aW1lem9uZVxuXHQpO1xuXHRjb25zdCBhdXRob3IgPSBwbHVnaW4uc2V0dGluZ3MuYXV0aG9yO1xuXHRjb25zdCByZXBseURlZiA9IGAgIHteJHtjb21tZW50SWR9LiR7bmV4dFJlcGx5TnVtfX0gQCR7YXV0aG9yfSAke2RhdGV9OiBgO1xuXG5cdC8vIEluc2VydCBhZnRlciB0aGUgbGFzdCByZXBseSAob3IgdGhlIHJvb3QgY29tbWVudClcblx0Y29uc3QgbGFzdExpbmUgPVxuXHRcdGNvbW1lbnQucmVwbGllcy5sZW5ndGggPiAwXG5cdFx0XHQ/IGNvbW1lbnQucmVwbGllc1tjb21tZW50LnJlcGxpZXMubGVuZ3RoIC0gMV0ubGluZVxuXHRcdFx0OiBjb21tZW50LmxpbmU7XG5cblx0Ly8gV2UgbmVlZCB0byBmaW5kIHRoZSBhY3R1YWwgbGluZSBpbiB0aGUgY3VycmVudCBkb2N1bWVudFxuXHQvLyBSZS1wYXJzZSB0byBnZXQgYWNjdXJhdGUgbGluZSBudW1iZXJzXG5cdGNvbnN0IGN1cnJlbnRQYXJzZWQgPSBwYXJzZURvY3VtZW50KGVkaXRvci5nZXRWYWx1ZSgpKTtcblx0Y29uc3QgY3VycmVudENvbW1lbnQgPSBjdXJyZW50UGFyc2VkLmNvbW1lbnRzLmZpbmQoXG5cdFx0KGMpID0+IGMuaWQgPT09IGNvbW1lbnRJZFxuXHQpO1xuXHRpZiAoIWN1cnJlbnRDb21tZW50KSByZXR1cm47XG5cblx0Y29uc3QgaW5zZXJ0QWZ0ZXJMaW5lID1cblx0XHRjdXJyZW50Q29tbWVudC5yZXBsaWVzLmxlbmd0aCA+IDBcblx0XHRcdD8gY3VycmVudENvbW1lbnQucmVwbGllc1tjdXJyZW50Q29tbWVudC5yZXBsaWVzLmxlbmd0aCAtIDFdLmxpbmVcblx0XHRcdDogY3VycmVudENvbW1lbnQubGluZTtcblxuXHRlZGl0b3IucmVwbGFjZVJhbmdlKGBcXG4ke3JlcGx5RGVmfWAsIHtcblx0XHRsaW5lOiBpbnNlcnRBZnRlckxpbmUsXG5cdFx0Y2g6IGVkaXRvci5nZXRMaW5lKGluc2VydEFmdGVyTGluZSkubGVuZ3RoLFxuXHR9KTtcblxuXHRjb25zdCBuZXdMaW5lcyA9IGVkaXRvci5nZXRWYWx1ZSgpLnNwbGl0KFwiXFxuXCIpO1xuXHRlZGl0b3Iuc2V0Q3Vyc29yKHtcblx0XHRsaW5lOiBpbnNlcnRBZnRlckxpbmUgKyAxLFxuXHRcdGNoOiBuZXdMaW5lc1tpbnNlcnRBZnRlckxpbmUgKyAxXT8ubGVuZ3RoIHx8IDAsXG5cdH0pO1xufVxuXG5mdW5jdGlvbiB0b2dnbGVSZXNvbHZlKGVkaXRvcjogRWRpdG9yKSB7XG5cdGNvbnN0IGN1cnNvciA9IGVkaXRvci5nZXRDdXJzb3IoKTtcblx0Y29uc3QgbGluZSA9IGVkaXRvci5nZXRMaW5lKGN1cnNvci5saW5lKTtcblxuXHRjb25zdCBjb21tZW50UmUgPSAvXihcXHMqXFx7XFxeW2EtekEtWjAtOV8tXStcXHMrXFxbKShbIHhdKShcXF1cXH0uKikkLztcblx0Y29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKGNvbW1lbnRSZSk7XG5cdGlmICghbWF0Y2gpIHJldHVybjtcblxuXHRjb25zdCBuZXdTdGF0ZSA9IG1hdGNoWzJdID09PSBcInhcIiA/IFwiIFwiIDogXCJ4XCI7XG5cdGNvbnN0IG5ld0xpbmUgPSBtYXRjaFsxXSArIG5ld1N0YXRlICsgbWF0Y2hbM107XG5cdGVkaXRvci5yZXBsYWNlUmFuZ2UoXG5cdFx0bmV3TGluZSxcblx0XHR7IGxpbmU6IGN1cnNvci5saW5lLCBjaDogMCB9LFxuXHRcdHsgbGluZTogY3Vyc29yLmxpbmUsIGNoOiBsaW5lLmxlbmd0aCB9XG5cdCk7XG59XG5cbmZ1bmN0aW9uIG9wZW5TaWRlYmFyKHBsdWdpbjogQ29tbWVudHNNYXJrdXBQbHVnaW4pIHtcblx0Y29uc3QgZXhpc3RpbmcgPSBwbHVnaW4uYXBwLndvcmtzcGFjZS5nZXRMZWF2ZXNPZlR5cGUoXG5cdFx0XCJjb21tZW50cy1tYXJrdXAtc2lkZWJhclwiXG5cdCk7XG5cdGlmIChleGlzdGluZy5sZW5ndGggPiAwKSB7XG5cdFx0cGx1Z2luLmFwcC53b3Jrc3BhY2UucmV2ZWFsTGVhZihleGlzdGluZ1swXSk7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3QgbGVhZiA9IHBsdWdpbi5hcHAud29ya3NwYWNlLmdldFJpZ2h0TGVhZihmYWxzZSk7XG5cdGlmIChsZWFmKSB7XG5cdFx0bGVhZi5zZXRWaWV3U3RhdGUoe1xuXHRcdFx0dHlwZTogXCJjb21tZW50cy1tYXJrdXAtc2lkZWJhclwiLFxuXHRcdFx0YWN0aXZlOiB0cnVlLFxuXHRcdH0pO1xuXHR9XG59XG4iLCAiaW1wb3J0IHR5cGUgeyBQYXJzZWREb2N1bWVudCB9IGZyb20gXCIuL3BhcnNlci90eXBlc1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0RGF0ZShkYXRlRm9ybWF0OiBcImRhdGV0aW1lXCIgfCBcImRhdGVvbmx5XCIsIHRpbWV6b25lPzogc3RyaW5nKTogc3RyaW5nIHtcblx0Y29uc3Qgbm93ID0gbmV3IERhdGUoKTtcblxuXHRpZiAoZGF0ZUZvcm1hdCA9PT0gXCJkYXRlb25seVwiKSB7XG5cdFx0Y29uc3QgeWVhciA9IG5vdy5nZXRGdWxsWWVhcigpO1xuXHRcdGNvbnN0IG1vbnRoID0gU3RyaW5nKG5vdy5nZXRNb250aCgpICsgMSkucGFkU3RhcnQoMiwgXCIwXCIpO1xuXHRcdGNvbnN0IGRheSA9IFN0cmluZyhub3cuZ2V0RGF0ZSgpKS5wYWRTdGFydCgyLCBcIjBcIik7XG5cdFx0cmV0dXJuIGAke3llYXJ9LSR7bW9udGh9LSR7ZGF5fWA7XG5cdH1cblxuXHQvLyBkYXRldGltZSB3aXRoIHRpbWV6b25lIG9mZnNldFxuXHRsZXQgb2Zmc2V0TWludXRlczogbnVtYmVyO1xuXG5cdGlmICh0aW1lem9uZSAmJiB0aW1lem9uZSAhPT0gXCJzeXN0ZW1cIikge1xuXHRcdC8vIFBhcnNlIFx1MDBCMWhoOm1tIG9mZnNldCBzdHJpbmdcblx0XHRjb25zdCBtYXRjaCA9IHRpbWV6b25lLm1hdGNoKC9eKFsrLV0pKFxcZHsyfSk6KFxcZHsyfSkkLyk7XG5cdFx0aWYgKG1hdGNoKSB7XG5cdFx0XHRjb25zdCBzaWduID0gbWF0Y2hbMV0gPT09IFwiK1wiID8gMSA6IC0xO1xuXHRcdFx0b2Zmc2V0TWludXRlcyA9IHNpZ24gKiAocGFyc2VJbnQobWF0Y2hbMl0sIDEwKSAqIDYwICsgcGFyc2VJbnQobWF0Y2hbM10sIDEwKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG9mZnNldE1pbnV0ZXMgPSAtbm93LmdldFRpbWV6b25lT2Zmc2V0KCk7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdG9mZnNldE1pbnV0ZXMgPSAtbm93LmdldFRpbWV6b25lT2Zmc2V0KCk7XG5cdH1cblxuXHQvLyBCdWlsZCBkYXRlIGluIHRoZSB0YXJnZXQgb2Zmc2V0XG5cdGNvbnN0IHRhcmdldFRpbWUgPSBuZXcgRGF0ZShub3cuZ2V0VGltZSgpICsgKG9mZnNldE1pbnV0ZXMgKyBub3cuZ2V0VGltZXpvbmVPZmZzZXQoKSkgKiA2MDAwMCk7XG5cdGNvbnN0IHllYXIgPSB0YXJnZXRUaW1lLmdldEZ1bGxZZWFyKCk7XG5cdGNvbnN0IG1vbnRoID0gU3RyaW5nKHRhcmdldFRpbWUuZ2V0TW9udGgoKSArIDEpLnBhZFN0YXJ0KDIsIFwiMFwiKTtcblx0Y29uc3QgZGF5ID0gU3RyaW5nKHRhcmdldFRpbWUuZ2V0RGF0ZSgpKS5wYWRTdGFydCgyLCBcIjBcIik7XG5cdGNvbnN0IGhvdXJzID0gU3RyaW5nKHRhcmdldFRpbWUuZ2V0SG91cnMoKSkucGFkU3RhcnQoMiwgXCIwXCIpO1xuXHRjb25zdCBtaW51dGVzID0gU3RyaW5nKHRhcmdldFRpbWUuZ2V0TWludXRlcygpKS5wYWRTdGFydCgyLCBcIjBcIik7XG5cblx0Y29uc3QgYWJzT2Zmc2V0ID0gTWF0aC5hYnMob2Zmc2V0TWludXRlcyk7XG5cdGNvbnN0IG9mZlNpZ24gPSBvZmZzZXRNaW51dGVzID49IDAgPyBcIitcIiA6IFwiLVwiO1xuXHRjb25zdCBvZmZIID0gU3RyaW5nKE1hdGguZmxvb3IoYWJzT2Zmc2V0IC8gNjApKS5wYWRTdGFydCgyLCBcIjBcIik7XG5cdGNvbnN0IG9mZk0gPSBTdHJpbmcoYWJzT2Zmc2V0ICUgNjApLnBhZFN0YXJ0KDIsIFwiMFwiKTtcblxuXHRyZXR1cm4gYCR7eWVhcn0tJHttb250aH0tJHtkYXl9VCR7aG91cnN9OiR7bWludXRlc30ke29mZlNpZ259JHtvZmZIfToke29mZk19YDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG5leHRDb21tZW50SWQocGFyc2VkOiBQYXJzZWREb2N1bWVudCk6IHN0cmluZyB7XG5cdGxldCBtYXggPSAwO1xuXHRmb3IgKGNvbnN0IGNvbW1lbnQgb2YgcGFyc2VkLmNvbW1lbnRzKSB7XG5cdFx0Y29uc3QgbWF0Y2ggPSBjb21tZW50LmlkLm1hdGNoKC9eYyhcXGQrKSQvKTtcblx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdGNvbnN0IG4gPSBwYXJzZUludChtYXRjaFsxXSwgMTApO1xuXHRcdFx0aWYgKG4gPiBtYXgpIG1heCA9IG47XG5cdFx0fVxuXHR9XG5cdHJldHVybiBgYyR7bWF4ICsgMX1gO1xufVxuIiwgImltcG9ydCB7IEl0ZW1WaWV3LCBNYXJrZG93blZpZXcsIFdvcmtzcGFjZUxlYWYsIGRlYm91bmNlLCBURmlsZSB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgQ29tbWVudHNNYXJrdXBQbHVnaW4gZnJvbSBcIi4uL21haW5cIjtcbmltcG9ydCB7IHBhcnNlRG9jdW1lbnQgfSBmcm9tIFwiLi4vcGFyc2VyL3BhcnNlclwiO1xuaW1wb3J0IHR5cGUgeyBDb21tZW50RW50cnksIFBhcnNlZERvY3VtZW50IH0gZnJvbSBcIi4uL3BhcnNlci90eXBlc1wiO1xuaW1wb3J0IHsgZm9ybWF0RGF0ZSB9IGZyb20gXCIuLi91dGlsc1wiO1xuXG5leHBvcnQgY29uc3QgU0lERUJBUl9WSUVXX1RZUEUgPSBcImNvbW1lbnRzLW1hcmt1cC1zaWRlYmFyXCI7XG5cbmV4cG9ydCBjbGFzcyBDb21tZW50c1NpZGViYXJWaWV3IGV4dGVuZHMgSXRlbVZpZXcge1xuXHRwcml2YXRlIHBsdWdpbjogQ29tbWVudHNNYXJrdXBQbHVnaW47XG5cdHByaXZhdGUgcGFyc2VkOiBQYXJzZWREb2N1bWVudCB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHNob3dPcGVuT25seSA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYsIHBsdWdpbjogQ29tbWVudHNNYXJrdXBQbHVnaW4pIHtcblx0XHRzdXBlcihsZWFmKTtcblx0XHR0aGlzLnBsdWdpbiA9IHBsdWdpbjtcblx0fVxuXG5cdGdldFZpZXdUeXBlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIFNJREVCQVJfVklFV19UWVBFO1xuXHR9XG5cblx0Z2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gXCJDb21tZW50c1wiO1xuXHR9XG5cblx0Z2V0SWNvbigpOiBzdHJpbmcge1xuXHRcdHJldHVybiBcIm1lc3NhZ2Utc3F1YXJlXCI7XG5cdH1cblxuXHRhc3luYyBvbk9wZW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5yZWdpc3RlckV2ZW50KFxuXHRcdFx0dGhpcy5hcHAud29ya3NwYWNlLm9uKFwiZmlsZS1vcGVuXCIsICgpID0+IHRoaXMucmVmcmVzaCgpKVxuXHRcdCk7XG5cdFx0dGhpcy5yZWdpc3RlckV2ZW50KFxuXHRcdFx0dGhpcy5hcHAudmF1bHQub24oXG5cdFx0XHRcdFwibW9kaWZ5XCIsXG5cdFx0XHRcdGRlYm91bmNlKFxuXHRcdFx0XHRcdChmaWxlOiBURmlsZSkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgYWN0aXZlRmlsZSA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKCk7XG5cdFx0XHRcdFx0XHRpZiAoYWN0aXZlRmlsZSAmJiBmaWxlLnBhdGggPT09IGFjdGl2ZUZpbGUucGF0aCkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnJlZnJlc2goKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdDMwMCxcblx0XHRcdFx0XHR0cnVlXG5cdFx0XHRcdClcblx0XHRcdClcblx0XHQpO1xuXHRcdHRoaXMucmVmcmVzaCgpO1xuXHR9XG5cblx0YXN5bmMgb25DbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmNvbnRlbnRFbC5lbXB0eSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZWZyZXNoKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGZpbGUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXHRcdGlmICghZmlsZSB8fCBmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSB7XG5cdFx0XHR0aGlzLnJlbmRlckVtcHR5KCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc291cmNlID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcblx0XHR0aGlzLnBhcnNlZCA9IHBhcnNlRG9jdW1lbnQoc291cmNlKTtcblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJFbXB0eSgpOiB2b2lkIHtcblx0XHR0aGlzLmNvbnRlbnRFbC5lbXB0eSgpO1xuXHRcdHRoaXMuY29udGVudEVsLmNyZWF0ZUVsKFwiZGl2XCIsIHtcblx0XHRcdGNsczogXCJjbS1zaWRlYmFyLWVtcHR5XCIsXG5cdFx0XHR0ZXh0OiBcIk5vIGFjdGl2ZSBNYXJrZG93biBmaWxlLlwiLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXIoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLnBhcnNlZCkgcmV0dXJuO1xuXHRcdGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuXHRcdGNvbnRlbnRFbC5lbXB0eSgpO1xuXG5cdFx0Ly8gVG9vbGJhclxuXHRcdGNvbnN0IHRvb2xiYXIgPSBjb250ZW50RWwuY3JlYXRlRWwoXCJkaXZcIiwgeyBjbHM6IFwiY20tc2lkZWJhci10b29sYmFyXCIgfSk7XG5cblx0XHRjb25zdCBmaWx0ZXJCdG4gPSB0b29sYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdGNsczogXCJjbS1zaWRlYmFyLWZpbHRlci1idG5cIixcblx0XHRcdHRleHQ6IHRoaXMuc2hvd09wZW5Pbmx5ID8gXCJTaG93IGFsbFwiIDogXCJPcGVuIG9ubHlcIixcblx0XHR9KTtcblx0XHRmaWx0ZXJCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcblx0XHRcdHRoaXMuc2hvd09wZW5Pbmx5ID0gIXRoaXMuc2hvd09wZW5Pbmx5O1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGNvdW50ID0gdGhpcy5wYXJzZWQuY29tbWVudHMubGVuZ3RoO1xuXHRcdGNvbnN0IG9wZW5Db3VudCA9IHRoaXMucGFyc2VkLmNvbW1lbnRzLmZpbHRlcihcblx0XHRcdChjKSA9PiBjLnN0YXRlID09PSBcIm9wZW5cIlxuXHRcdCkubGVuZ3RoO1xuXHRcdHRvb2xiYXIuY3JlYXRlRWwoXCJzcGFuXCIsIHtcblx0XHRcdGNsczogXCJjbS1zaWRlYmFyLWNvdW50XCIsXG5cdFx0XHR0ZXh0OiBgJHtvcGVuQ291bnR9IG9wZW4gLyAke2NvdW50fSB0b3RhbGAsXG5cdFx0fSk7XG5cblx0XHQvLyBDb21tZW50IHRocmVhZHNcblx0XHRjb25zdCBsaXN0ID0gY29udGVudEVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcImNtLXNpZGViYXItbGlzdFwiIH0pO1xuXG5cdFx0Y29uc3QgY29tbWVudHMgPSB0aGlzLnNob3dPcGVuT25seVxuXHRcdFx0PyB0aGlzLnBhcnNlZC5jb21tZW50cy5maWx0ZXIoKGMpID0+IGMuc3RhdGUgPT09IFwib3BlblwiKVxuXHRcdFx0OiB0aGlzLnBhcnNlZC5jb21tZW50cztcblxuXHRcdGlmIChjb21tZW50cy5sZW5ndGggPT09IDApIHtcblx0XHRcdGxpc3QuY3JlYXRlRWwoXCJkaXZcIiwge1xuXHRcdFx0XHRjbHM6IFwiY20tc2lkZWJhci1lbXB0eVwiLFxuXHRcdFx0XHR0ZXh0OiB0aGlzLnNob3dPcGVuT25seSA/IFwiTm8gb3BlbiBjb21tZW50cy5cIiA6IFwiTm8gY29tbWVudHMgaW4gdGhpcyBmaWxlLlwiLFxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBjb21tZW50IG9mIGNvbW1lbnRzKSB7XG5cdFx0XHR0aGlzLnJlbmRlclRocmVhZChsaXN0LCBjb21tZW50KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclRocmVhZChjb250YWluZXI6IEhUTUxFbGVtZW50LCBjb21tZW50OiBDb21tZW50RW50cnkpOiB2b2lkIHtcblx0XHRjb25zdCBjb2xsYXBzZWQgPVxuXHRcdFx0Y29tbWVudC5zdGF0ZSA9PT0gXCJyZXNvbHZlZFwiICYmXG5cdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5yZXNvbHZlZENvbGxhcHNlZDtcblxuXHRcdGNvbnN0IGRldGFpbHMgPSBjb250YWluZXIuY3JlYXRlRWwoXCJkZXRhaWxzXCIsIHtcblx0XHRcdGNsczogXCJjbS1zaWRlYmFyLXRocmVhZFwiLFxuXHRcdH0pO1xuXHRcdGlmICghY29sbGFwc2VkKSB7XG5cdFx0XHRkZXRhaWxzLnNldEF0dHJpYnV0ZShcIm9wZW5cIiwgXCJcIik7XG5cdFx0fVxuXHRcdGlmIChjb21tZW50LnN0YXRlID09PSBcInJlc29sdmVkXCIpIHtcblx0XHRcdGRldGFpbHMuYWRkQ2xhc3MoXCJjbS1zaWRlYmFyLXJlc29sdmVkXCIpO1xuXHRcdH1cblxuXHRcdC8vIFN1bW1hcnkgKGNsaWNrYWJsZSBoZWFkZXIpXG5cdFx0Y29uc3Qgc3VtbWFyeSA9IGRldGFpbHMuY3JlYXRlRWwoXCJzdW1tYXJ5XCIsIHtcblx0XHRcdGNsczogXCJjbS1zaWRlYmFyLXN1bW1hcnlcIixcblx0XHR9KTtcblxuXHRcdGNvbnN0IHN0YXRlSWNvbiA9IHN1bW1hcnkuY3JlYXRlRWwoXCJzcGFuXCIsIHtcblx0XHRcdGNsczogXCJjbS1zaWRlYmFyLXN0YXRlXCIsXG5cdFx0XHR0ZXh0OiBjb21tZW50LnN0YXRlID09PSBcInJlc29sdmVkXCIgPyBcIlx1MjcxM1wiIDogXCJcdTI1Q0JcIixcblx0XHRcdHRpdGxlOiBjb21tZW50LnN0YXRlID09PSBcInJlc29sdmVkXCIgPyBcIlJlb3BlblwiIDogXCJSZXNvbHZlXCIsXG5cdFx0fSk7XG5cdFx0c3RhdGVJY29uLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdHRoaXMudG9nZ2xlQ29tbWVudFN0YXRlKGNvbW1lbnQuaWQpO1xuXHRcdH0pO1xuXG5cdFx0c3VtbWFyeS5jcmVhdGVFbChcInNwYW5cIiwge1xuXHRcdFx0Y2xzOiBcImNtLXNpZGViYXItdGhyZWFkLWlkXCIsXG5cdFx0XHR0ZXh0OiBjb21tZW50LmlkLFxuXHRcdH0pO1xuXHRcdHN1bW1hcnkuY3JlYXRlRWwoXCJzcGFuXCIsIHtcblx0XHRcdGNsczogXCJjbS1jb21tZW50LWF1dGhvclwiLFxuXHRcdFx0dGV4dDogYEAke2NvbW1lbnQuYXV0aG9yfWAsXG5cdFx0fSk7XG5cblx0XHQvLyBOYXZpZ2F0ZSBvbiBjbGljayAoYnV0IG5vdCBvbiB0aGUgc3RhdGUgdG9nZ2xlKVxuXHRcdHN1bW1hcnkuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG5cdFx0XHRpZiAoKGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50KS5jbG9zZXN0KFwiLmNtLXNpZGViYXItc3RhdGVcIikpIHJldHVybjtcblx0XHRcdHRoaXMubmF2aWdhdGVUb0FuY2hvcihjb21tZW50LmlkKTtcblx0XHR9KTtcblxuXHRcdC8vIFJvb3QgY29tbWVudCBib2R5XG5cdFx0Y29uc3Qgcm9vdEJvZHkgPSBkZXRhaWxzLmNyZWF0ZUVsKFwiZGl2XCIsIHsgY2xzOiBcImNtLXNpZGViYXItcm9vdC1ib2R5XCIgfSk7XG5cdFx0cm9vdEJvZHkuY3JlYXRlRWwoXCJkaXZcIiwge1xuXHRcdFx0Y2xzOiBcImNtLWNvbW1lbnQtZGF0ZVwiLFxuXHRcdFx0dGV4dDogY29tbWVudC5kYXRlLFxuXHRcdH0pO1xuXG5cdFx0Ly8gUm9vdCBjb21tZW50IHRleHQgKGVkaXRhYmxlIGlmIG93biBjb21tZW50KVxuXHRcdGNvbnN0IHJvb3RUZXh0RWwgPSByb290Qm9keS5jcmVhdGVFbChcImRpdlwiLCB7XG5cdFx0XHRjbHM6IFwiY20tc2lkZWJhci10ZXh0XCIsXG5cdFx0XHR0ZXh0OiBjb21tZW50LnRleHQsXG5cdFx0fSk7XG5cdFx0aWYgKGNvbW1lbnQuYXV0aG9yID09PSB0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRob3IpIHtcblx0XHRcdHJvb3RUZXh0RWwuYWRkQ2xhc3MoXCJjbS1zaWRlYmFyLWVkaXRhYmxlXCIpO1xuXHRcdFx0cm9vdFRleHRFbC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmVkaXRJbmxpbmUocm9vdFRleHRFbCwgY29tbWVudC50ZXh0LCAobmV3VGV4dCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMubW9kaWZ5RmlsZSgoc291cmNlKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBsaW5lcyA9IHNvdXJjZS5zcGxpdChcIlxcblwiKTtcblx0XHRcdFx0XHRcdGNvbnN0IHBhcnNlZCA9IHBhcnNlRG9jdW1lbnQoc291cmNlKTtcblx0XHRcdFx0XHRcdGNvbnN0IGMgPSBwYXJzZWQuY29tbWVudHMuZmluZCgoeCkgPT4geC5pZCA9PT0gY29tbWVudC5pZCk7XG5cdFx0XHRcdFx0XHRpZiAoIWMpIHJldHVybiBzb3VyY2U7XG5cdFx0XHRcdFx0XHRjb25zdCBsaW5lID0gbGluZXNbYy5saW5lXTtcblx0XHRcdFx0XHRcdGNvbnN0IGNvbG9uSWR4ID0gbGluZS5pbmRleE9mKFwiOiBcIik7XG5cdFx0XHRcdFx0XHRpZiAoY29sb25JZHggPT09IC0xKSByZXR1cm4gc291cmNlO1xuXHRcdFx0XHRcdFx0bGluZXNbYy5saW5lXSA9IGxpbmUuc3Vic3RyaW5nKDAsIGNvbG9uSWR4ICsgMikgKyBuZXdUZXh0O1xuXHRcdFx0XHRcdFx0cmV0dXJuIGxpbmVzLmpvaW4oXCJcXG5cIik7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gUmVwbGllc1xuXHRcdGZvciAoY29uc3QgcmVwbHkgb2YgY29tbWVudC5yZXBsaWVzKSB7XG5cdFx0XHRjb25zdCByZXBseUVsID0gZGV0YWlscy5jcmVhdGVFbChcImRpdlwiLCB7XG5cdFx0XHRcdGNsczogXCJjbS1zaWRlYmFyLXJlcGx5XCIsXG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcmVwbHlIZWFkZXIgPSByZXBseUVsLmNyZWF0ZUVsKFwiZGl2XCIsIHtcblx0XHRcdFx0Y2xzOiBcImNtLXNpZGViYXItcmVwbHktaGVhZGVyXCIsXG5cdFx0XHR9KTtcblx0XHRcdHJlcGx5SGVhZGVyLmNyZWF0ZUVsKFwic3BhblwiLCB7XG5cdFx0XHRcdGNsczogXCJjbS1jb21tZW50LWF1dGhvclwiLFxuXHRcdFx0XHR0ZXh0OiBgQCR7cmVwbHkuYXV0aG9yfWAsXG5cdFx0XHR9KTtcblx0XHRcdHJlcGx5SGVhZGVyLmNyZWF0ZUVsKFwic3BhblwiLCB7XG5cdFx0XHRcdGNsczogXCJjbS1jb21tZW50LWRhdGVcIixcblx0XHRcdFx0dGV4dDogcmVwbHkuZGF0ZSxcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCByZXBseVRleHRFbCA9IHJlcGx5RWwuY3JlYXRlRWwoXCJkaXZcIiwge1xuXHRcdFx0XHRjbHM6IFwiY20tc2lkZWJhci10ZXh0XCIsXG5cdFx0XHRcdHRleHQ6IHJlcGx5LnRleHQsXG5cdFx0XHR9KTtcblx0XHRcdGlmIChyZXBseS5hdXRob3IgPT09IHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dGhvcikge1xuXHRcdFx0XHRyZXBseVRleHRFbC5hZGRDbGFzcyhcImNtLXNpZGViYXItZWRpdGFibGVcIik7XG5cdFx0XHRcdHJlcGx5VGV4dEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5lZGl0SW5saW5lKHJlcGx5VGV4dEVsLCByZXBseS50ZXh0LCAobmV3VGV4dCkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5tb2RpZnlGaWxlKChzb3VyY2UpID0+IHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgbGluZXMgPSBzb3VyY2Uuc3BsaXQoXCJcXG5cIik7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHBhcnNlZCA9IHBhcnNlRG9jdW1lbnQoc291cmNlKTtcblx0XHRcdFx0XHRcdFx0Y29uc3QgYyA9IHBhcnNlZC5jb21tZW50cy5maW5kKCh4KSA9PiB4LmlkID09PSBjb21tZW50LmlkKTtcblx0XHRcdFx0XHRcdFx0aWYgKCFjKSByZXR1cm4gc291cmNlO1xuXHRcdFx0XHRcdFx0XHRjb25zdCByID0gYy5yZXBsaWVzLmZpbmQoKHgpID0+IHgubnVtYmVyID09PSByZXBseS5udW1iZXIpO1xuXHRcdFx0XHRcdFx0XHRpZiAoIXIpIHJldHVybiBzb3VyY2U7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGxpbmUgPSBsaW5lc1tyLmxpbmVdO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBjb2xvbklkeCA9IGxpbmUuaW5kZXhPZihcIjogXCIpO1xuXHRcdFx0XHRcdFx0XHRpZiAoY29sb25JZHggPT09IC0xKSByZXR1cm4gc291cmNlO1xuXHRcdFx0XHRcdFx0XHRsaW5lc1tyLmxpbmVdID0gbGluZS5zdWJzdHJpbmcoMCwgY29sb25JZHggKyAyKSArIG5ld1RleHQ7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFJlcGx5IGlucHV0XG5cdFx0Y29uc3QgcmVwbHlCdG4gPSBkZXRhaWxzLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHtcblx0XHRcdGNsczogXCJjbS1zaWRlYmFyLXJlcGx5LWJ0blwiLFxuXHRcdFx0dGV4dDogXCJSZXBseVwiLFxuXHRcdH0pO1xuXHRcdHJlcGx5QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG5cdFx0XHQvLyBSZXBsYWNlIGJ1dHRvbiB3aXRoIGlucHV0XG5cdFx0XHRyZXBseUJ0bi5yZW1vdmUoKTtcblx0XHRcdGNvbnN0IHJlcGx5Qm94ID0gZGV0YWlscy5jcmVhdGVFbChcImRpdlwiLCB7IGNsczogXCJjbS1zaWRlYmFyLXJlcGx5LWJveFwiIH0pO1xuXHRcdFx0Y29uc3QgaW5wdXQgPSByZXBseUJveC5jcmVhdGVFbChcImlucHV0XCIsIHtcblx0XHRcdFx0dHlwZTogXCJ0ZXh0XCIsXG5cdFx0XHRcdGNsczogXCJjbS1zaWRlYmFyLWVkaXQtaW5wdXRcIixcblx0XHRcdFx0cGxhY2Vob2xkZXI6IFwiV3JpdGUgYSByZXBseS4uLlwiLFxuXHRcdFx0fSk7XG5cdFx0XHRpbnB1dC5mb2N1cygpO1xuXG5cdFx0XHRsZXQgc3VibWl0dGVkID0gZmFsc2U7XG5cdFx0XHRjb25zdCBzdWJtaXQgPSAoKSA9PiB7XG5cdFx0XHRcdGlmIChzdWJtaXR0ZWQpIHJldHVybjtcblx0XHRcdFx0c3VibWl0dGVkID0gdHJ1ZTtcblx0XHRcdFx0Y29uc3QgdGV4dCA9IGlucHV0LnZhbHVlLnRyaW0oKTtcblx0XHRcdFx0aWYgKCF0ZXh0KSB7XG5cdFx0XHRcdFx0dGhpcy5yZWZyZXNoKCk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMubW9kaWZ5RmlsZSgoc291cmNlKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcGFyc2VkID0gcGFyc2VEb2N1bWVudChzb3VyY2UpO1xuXHRcdFx0XHRcdGNvbnN0IGMgPSBwYXJzZWQuY29tbWVudHMuZmluZCgoeCkgPT4geC5pZCA9PT0gY29tbWVudC5pZCk7XG5cdFx0XHRcdFx0aWYgKCFjKSByZXR1cm4gc291cmNlO1xuXG5cdFx0XHRcdFx0Y29uc3QgbmV4dE51bSA9IGMucmVwbGllcy5sZW5ndGggPiAwXG5cdFx0XHRcdFx0XHQ/IE1hdGgubWF4KC4uLmMucmVwbGllcy5tYXAoKHIpID0+IHIubnVtYmVyKSkgKyAxXG5cdFx0XHRcdFx0XHQ6IDE7XG5cdFx0XHRcdFx0Y29uc3QgZGF0ZSA9IGZvcm1hdERhdGUoXG5cdFx0XHRcdFx0XHR0aGlzLnBsdWdpbi5zZXR0aW5ncy5kYXRlRm9ybWF0LFxuXHRcdFx0XHRcdFx0dGhpcy5wbHVnaW4uc2V0dGluZ3MudGltZXpvbmVcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdGNvbnN0IGF1dGhvciA9IHRoaXMucGx1Z2luLnNldHRpbmdzLmF1dGhvcjtcblx0XHRcdFx0XHRjb25zdCByZXBseUxpbmUgPSBgICB7XiR7Y29tbWVudC5pZH0uJHtuZXh0TnVtfX0gQCR7YXV0aG9yfSAke2RhdGV9OiAke3RleHR9YDtcblxuXHRcdFx0XHRcdGNvbnN0IGxpbmVzID0gc291cmNlLnNwbGl0KFwiXFxuXCIpO1xuXHRcdFx0XHRcdGNvbnN0IGluc2VydEFmdGVyID0gYy5yZXBsaWVzLmxlbmd0aCA+IDBcblx0XHRcdFx0XHRcdD8gYy5yZXBsaWVzW2MucmVwbGllcy5sZW5ndGggLSAxXS5saW5lXG5cdFx0XHRcdFx0XHQ6IGMubGluZTtcblx0XHRcdFx0XHRsaW5lcy5zcGxpY2UoaW5zZXJ0QWZ0ZXIgKyAxLCAwLCByZXBseUxpbmUpO1xuXHRcdFx0XHRcdHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH07XG5cblx0XHRcdGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChlKSA9PiB7XG5cdFx0XHRcdGlmIChlLmtleSA9PT0gXCJFbnRlclwiKSBzdWJtaXQoKTtcblx0XHRcdFx0aWYgKGUua2V5ID09PSBcIkVzY2FwZVwiKSB7IHN1Ym1pdHRlZCA9IHRydWU7IHRoaXMucmVmcmVzaCgpOyB9XG5cdFx0XHR9KTtcblx0XHRcdGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJibHVyXCIsICgpID0+IHtcblx0XHRcdFx0aWYgKGlucHV0LnZhbHVlLnRyaW0oKSkge1xuXHRcdFx0XHRcdHN1Ym1pdCgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMucmVmcmVzaCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZWRpdElubGluZShcblx0XHRlbDogSFRNTEVsZW1lbnQsXG5cdFx0Y3VycmVudFRleHQ6IHN0cmluZyxcblx0XHRvblNhdmU6IChuZXdUZXh0OiBzdHJpbmcpID0+IHZvaWRcblx0KTogdm9pZCB7XG5cdFx0aWYgKGVsLnF1ZXJ5U2VsZWN0b3IoXCJpbnB1dFwiKSkgcmV0dXJuO1xuXG5cdFx0ZWwuZW1wdHkoKTtcblx0XHRjb25zdCBpbnB1dCA9IGVsLmNyZWF0ZUVsKFwiaW5wdXRcIiwge1xuXHRcdFx0dHlwZTogXCJ0ZXh0XCIsXG5cdFx0XHRjbHM6IFwiY20tc2lkZWJhci1lZGl0LWlucHV0XCIsXG5cdFx0XHR2YWx1ZTogY3VycmVudFRleHQsXG5cdFx0fSk7XG5cdFx0aW5wdXQuZm9jdXMoKTtcblx0XHRpbnB1dC5zZWxlY3QoKTtcblxuXHRcdGxldCBzYXZlZCA9IGZhbHNlO1xuXHRcdGNvbnN0IHNhdmUgPSAoKSA9PiB7XG5cdFx0XHRpZiAoc2F2ZWQpIHJldHVybjtcblx0XHRcdHNhdmVkID0gdHJ1ZTtcblx0XHRcdGNvbnN0IG5ld1RleHQgPSBpbnB1dC52YWx1ZS50cmltKCk7XG5cdFx0XHRpZiAobmV3VGV4dCAmJiBuZXdUZXh0ICE9PSBjdXJyZW50VGV4dCkge1xuXHRcdFx0XHRvblNhdmUobmV3VGV4dCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnJlZnJlc2goKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0aW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGUpID0+IHtcblx0XHRcdGlmIChlLmtleSA9PT0gXCJFbnRlclwiKSBzYXZlKCk7XG5cdFx0XHRpZiAoZS5rZXkgPT09IFwiRXNjYXBlXCIpIHsgc2F2ZWQgPSB0cnVlOyB0aGlzLnJlZnJlc2goKTsgfVxuXHRcdH0pO1xuXHRcdGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJibHVyXCIsIHNhdmUpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBtb2RpZnlGaWxlKHRyYW5zZm9ybTogKHNvdXJjZTogc3RyaW5nKSA9PiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcblx0XHRpZiAoIWZpbGUpIHJldHVybjtcblxuXHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0LnByb2Nlc3MoZmlsZSwgdHJhbnNmb3JtKTtcblx0XHQvLyByZWZyZXNoIGlzIHRyaWdnZXJlZCBieSB0aGUgdmF1bHQgbW9kaWZ5IGV2ZW50XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHRvZ2dsZUNvbW1lbnRTdGF0ZShjb21tZW50SWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMubW9kaWZ5RmlsZSgoc291cmNlKSA9PiB7XG5cdFx0XHRjb25zdCBsaW5lcyA9IHNvdXJjZS5zcGxpdChcIlxcblwiKTtcblx0XHRcdGNvbnN0IGVzY2FwZWRJZCA9IGNvbW1lbnRJZC5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIik7XG5cdFx0XHRjb25zdCByZSA9IG5ldyBSZWdFeHAoXG5cdFx0XHRcdGBeKFxcXFxzKlxcXFx7XFxcXF4ke2VzY2FwZWRJZH1cXFxccytcXFxcWykoWyB4XSkoXFxcXF1cXFxcfS4qKSRgXG5cdFx0XHQpO1xuXG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IG1hdGNoID0gbGluZXNbaV0ubWF0Y2gocmUpO1xuXHRcdFx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdFx0XHRjb25zdCBuZXdTdGF0ZSA9IG1hdGNoWzJdID09PSBcInhcIiA/IFwiIFwiIDogXCJ4XCI7XG5cdFx0XHRcdFx0bGluZXNbaV0gPSBtYXRjaFsxXSArIG5ld1N0YXRlICsgbWF0Y2hbM107XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBuYXZpZ2F0ZVRvQW5jaG9yKGlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBmaWxlID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZUZpbGUoKTtcblx0XHRpZiAoIWZpbGUgfHwgIXRoaXMucGFyc2VkKSByZXR1cm47XG5cblx0XHRjb25zdCBhbmNob3IgPSB0aGlzLnBhcnNlZC5hbmNob3JzLmZpbmQoKGEpID0+IGEuaWQgPT09IGlkKTtcblx0XHRpZiAoIWFuY2hvcikgcmV0dXJuO1xuXG5cdFx0Ly8gRmluZCB0aGUgTWFya2Rvd25WaWV3IHNob3dpbmcgdGhpcyBmaWxlXG5cdFx0Y29uc3QgbGVhdmVzID0gdGhpcy5hcHAud29ya3NwYWNlLmdldExlYXZlc09mVHlwZShcIm1hcmtkb3duXCIpO1xuXHRcdGZvciAoY29uc3QgbGVhZiBvZiBsZWF2ZXMpIHtcblx0XHRcdGNvbnN0IHZpZXcgPSBsZWFmLnZpZXc7XG5cdFx0XHRpZiAodmlldyBpbnN0YW5jZW9mIE1hcmtkb3duVmlldyAmJiB2aWV3LmZpbGU/LnBhdGggPT09IGZpbGUucGF0aCkge1xuXHRcdFx0XHRjb25zdCBlZGl0b3IgPSB2aWV3LmVkaXRvcjtcblx0XHRcdFx0ZWRpdG9yLnNldEN1cnNvcih7IGxpbmU6IGFuY2hvci5saW5lLCBjaDogYW5jaG9yLmNvbCB9KTtcblx0XHRcdFx0ZWRpdG9yLnNjcm9sbEludG9WaWV3KFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGZyb206IHsgbGluZTogYW5jaG9yLmxpbmUsIGNoOiBhbmNob3IuY29sIH0sXG5cdFx0XHRcdFx0XHR0bzogeyBsaW5lOiBhbmNob3IubGluZSwgY2g6IGFuY2hvci5jb2wgKyBhbmNob3IubGVuZ3RoIH0sXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR0cnVlXG5cdFx0XHRcdCk7XG5cdFx0XHRcdHRoaXMuYXBwLndvcmtzcGFjZS5yZXZlYWxMZWFmKGxlYWYpO1xuXHRcdFx0XHRlZGl0b3IuZm9jdXMoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1c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QSxVQUNBO0FBQUEsUUFDRDtBQUNBLGFBQUssSUFBSSxVQUFVLFdBQVcsSUFBSTtBQUNsQyxlQUFPLE1BQU07QUFDYjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUNEOzs7QVA5WEEsSUFBcUIsdUJBQXJCLGNBQWtELHdCQUFPO0FBQUEsRUFBekQ7QUFBQTtBQUNDLG9CQUFtQztBQUFBO0FBQUEsRUFFbkMsTUFBTSxTQUF3QjtBQUM3QixVQUFNLEtBQUssYUFBYTtBQUd4QixTQUFLLGNBQWMsSUFBSSx5QkFBeUIsS0FBSyxLQUFLLElBQUksQ0FBQztBQUcvRCxTQUFLLDhCQUE4QixvQkFBb0IsSUFBSSxDQUFDO0FBRzVELFNBQUs7QUFBQSxNQUNKLHVCQUF1QixNQUFNLEtBQUssUUFBUTtBQUFBLElBQzNDO0FBR0EsU0FBSztBQUFBLE1BQ0o7QUFBQSxNQUNBLENBQUMsU0FBUyxJQUFJLG9CQUFvQixNQUFNLElBQUk7QUFBQSxJQUM3QztBQUdBLHFCQUFpQixJQUFJO0FBR3JCLFNBQUssY0FBYyxrQkFBa0IsdUJBQXVCLE1BQU07QUFDakUsV0FBSyxnQkFBZ0I7QUFBQSxJQUN0QixDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBTSxlQUE4QjtBQUNuQyxTQUFLLFdBQVcsT0FBTztBQUFBLE1BQ3RCLENBQUM7QUFBQSxNQUNEO0FBQUEsTUFDQSxNQUFNLEtBQUssU0FBUztBQUFBLElBQ3JCO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBTSxlQUE4QjtBQUNuQyxVQUFNLEtBQUssU0FBUyxLQUFLLFFBQVE7QUFBQSxFQUNsQztBQUFBLEVBRUEsTUFBYyxrQkFBaUM7QUFDOUMsVUFBTSxXQUNMLEtBQUssSUFBSSxVQUFVLGdCQUFnQixpQkFBaUI7QUFDckQsUUFBSSxTQUFTLFNBQVMsR0FBRztBQUN4QixXQUFLLElBQUksVUFBVSxXQUFXLFNBQVMsQ0FBQyxDQUFDO0FBQ3pDO0FBQUEsSUFDRDtBQUVBLFVBQU0sT0FBTyxLQUFLLElBQUksVUFBVSxhQUFhLEtBQUs7QUFDbEQsUUFBSSxNQUFNO0FBQ1QsWUFBTSxLQUFLLGFBQWE7QUFBQSxRQUN2QixNQUFNO0FBQUEsUUFDTixRQUFRO0FBQUEsTUFDVCxDQUFDO0FBQ0QsV0FBSyxJQUFJLFVBQVUsV0FBVyxJQUFJO0FBQUEsSUFDbkM7QUFBQSxFQUNEO0FBQ0Q7IiwKICAibmFtZXMiOiBbImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAibm9kZSIsICJBTkNIT1JfUkUiLCAiQ09NTUVOVF9SRSIsICJSRVBMWV9SRSIsICJpbXBvcnRfb2JzaWRpYW4iLCAieWVhciIsICJtb250aCIsICJkYXkiLCAiaW1wb3J0X29ic2lkaWFuIl0KfQo=
