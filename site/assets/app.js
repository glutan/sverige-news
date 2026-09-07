(function () {
  "use strict";

  var DATA_URL = "data/news.json";
  var els = {
    status: document.getElementById("status"),
    sections: document.getElementById("sections"),
    updatedAt: document.getElementById("updated-at"),
    nav: document.getElementById("category-nav"),
    refreshBtn: document.getElementById("refresh-btn"),
  };

  var state = {
    data: null,
    activeCategory: "all",
  };

  function fmtRelativeTime(iso) {
    if (!iso) return "unknown time";
    var then = new Date(iso).getTime();
    var now = Date.now();
    var diffMin = Math.round((now - then) / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return diffMin + " min ago";
    var diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return diffHr + "h ago";
    var diffDay = Math.round(diffHr / 24);
    if (diffDay === 1) return "yesterday";
    if (diffDay < 7) return diffDay + " days ago";
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  }

  function fmtPublished(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) +
      " · " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (key) {
      if (key === "class") node.className = attrs[key];
      else if (key === "html") node.innerHTML = attrs[key];
      else if (key.indexOf("on") === 0 && typeof attrs[key] === "function") {
        node.addEventListener(key.slice(2), attrs[key]);
      } else {
        node.setAttribute(key, attrs[key]);
      }
    });
    (children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  function text(t) {
    return document.createTextNode(t);
  }

  function buildNav(categories) {
    els.nav.innerHTML = "";
    var totalCount = categories.reduce(function (sum, c) { return sum + c.count; }, 0);

    var allBtn = el("button", {
      class: "nav-btn" + (state.activeCategory === "all" ? " active" : ""),
      type: "button",
      onclick: function () { setActiveCategory("all"); },
    }, [text("All (" + totalCount + ")")]);
    els.nav.appendChild(allBtn);

    categories.forEach(function (cat) {
      var btn = el("button", {
        class: "nav-btn" + (state.activeCategory === cat.id ? " active" : ""),
        type: "button",
        onclick: function () { setActiveCategory(cat.id); },
      }, [text(cat.label + " (" + cat.count + ")")]);
      els.nav.appendChild(btn);
    });
  }

  function setActiveCategory(id) {
    state.activeCategory = id;
    render();
  }

  function buildCard(article) {
    var card = el("div", { class: "card" });

    var summaryId = "summary-" + article.id;
    var header = el("button", {
      class: "card-header",
      type: "button",
      "aria-expanded": "false",
      "aria-controls": summaryId,
      onclick: function () {
        var isOpen = card.classList.toggle("open");
        header.setAttribute("aria-expanded", isOpen ? "true" : "false");
      },
    }, [
      el("span", { class: "card-title" }, [
        text(article.title),
        el("span", { class: "card-meta" }, [
          text(article.source + " · " + fmtPublished(article.published)),
        ]),
      ]),
      el("span", { class: "chevron", "aria-hidden": "true", html: "&#9656;" }),
    ]);

    var body = el("div", { class: "card-body" }, [
      el("div", { class: "card-body-inner" }, [
        el("div", { class: "card-summary", id: summaryId }, [
          text(article.summary || "No summary available."),
          el("br"),
          el("a", {
            class: "card-link",
            href: article.link,
            target: "_blank",
            rel: "noopener noreferrer",
          }, [text("Read full article ↗")]),
        ]),
      ]),
    ]);

    card.appendChild(header);
    card.appendChild(body);
    return card;
  }

  function buildSection(category) {
    var section = el("section", { class: "section", id: "section-" + category.id });
    section.appendChild(
      el("h2", { class: "section-heading" }, [
        text(category.label),
        el("span", { class: "section-count" }, [text(category.count + " stories")]),
      ])
    );

    if (!category.articles.length) {
      section.appendChild(el("p", { class: "section-empty" }, [text("No stories right now — check back soon.")]));
      return section;
    }

    category.articles.forEach(function (article) {
      section.appendChild(buildCard(article));
    });
    return section;
  }

  function render() {
    if (!state.data) return;
    els.sections.innerHTML = "";
    var categories = state.data.categories || [];
    buildNav(categories);

    var toRender = state.activeCategory === "all"
      ? categories
      : categories.filter(function (c) { return c.id === state.activeCategory; });

    toRender.forEach(function (cat) {
      els.sections.appendChild(buildSection(cat));
    });

    var total = categories.reduce(function (sum, c) { return sum + c.count; }, 0);
    els.status.textContent = total === 0
      ? "No stories available right now."
      : "";
  }

  function load(isManualRefresh) {
    if (isManualRefresh) els.refreshBtn.classList.add("spinning");
    els.status.classList.remove("error");
    els.status.textContent = "Loading the latest stories…";

    fetch(DATA_URL + "?_=" + Date.now(), { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        state.data = data;
        els.updatedAt.textContent = data.generated_at
          ? "Updated " + fmtRelativeTime(data.generated_at)
          : "Not yet updated";
        render();
      })
      .catch(function (err) {
        els.status.classList.add("error");
        els.status.textContent = "Couldn't load news data (" + err.message + "). Try refreshing.";
      })
      .finally(function () {
        if (isManualRefresh) els.refreshBtn.classList.remove("spinning");
      });
  }

  els.refreshBtn.addEventListener("click", function () { load(true); });

  load(false);
})();
