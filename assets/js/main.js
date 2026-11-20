/* =====================================================================
   Page rendering: fills the page from WEDDING (config.js) and runs the
   gentle scroll animations. You shouldn't need to edit this file to
   change text; edit config.js instead.
   ===================================================================== */
(function () {
  "use strict";

  /** Read "a.b.c" from the config object. */
  function get(path) {
    return path.split(".").reduce(function (obj, key) {
      return obj == null ? undefined : obj[key];
    }, WEDDING);
  }

  /** Create an element with optional class and text. */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  /** Phone numbers as tap-to-call links, joined with " or ". */
  function phoneLinks(container) {
    container.textContent = "";
    WEDDING.contact.phones.forEach(function (p, i) {
      if (i > 0) container.appendChild(document.createTextNode(" or "));
      var a = el("a", null, p.display);
      a.href = "tel:" + p.tel;
      container.appendChild(a);
    });
  }

  // 1. Simple text bindings: <span data-text="couple.first">
  document.querySelectorAll("[data-text]").forEach(function (node) {
    var value = get(node.getAttribute("data-text"));
    if (typeof value === "string") node.textContent = value;
  });

  // 2. Shloka, one line per row
  var shloka = document.getElementById("shloka");
  WEDDING.blessing.forEach(function (line) { shloka.appendChild(el("span", null, line)); });

  // 3. Events
  var eventList = document.getElementById("event-list");
  WEDDING.events.forEach(function (ev) {
    var card = el("article", "event-card reveal");
    card.appendChild(el("h3", "event-name", ev.name));
    var when = el("p", "event-when");
    when.appendChild(el("span", null, ev.date));
    when.appendChild(el("span", "event-time", ev.time));
    card.appendChild(when);
    if (ev.note) card.appendChild(el("p", "event-note", ev.note));
    eventList.appendChild(card);
  });

  // 4. Venue map link
  document.getElementById("maps-link").href = WEDDING.venue.mapsUrl;

  // 5. "Good to know" box
  var info = document.getElementById("good-to-know-card");
  var g = WEDDING.goodToKnow;
  var h = el("h3");
  h.appendChild(el("span", null, g.icon)).setAttribute("aria-hidden", "true");
  h.appendChild(document.createTextNode(g.title));
  info.appendChild(h);
  var ul = el("ul");
  g.points.forEach(function (p) { ul.appendChild(el("li", null, p)); });
  info.appendChild(ul);

  // 6. Phone numbers in the footer and error message
  phoneLinks(document.getElementById("footer-phones"));
  phoneLinks(document.getElementById("error-phones"));

  // 7. Scroll reveal. Skipped entirely for reduced-motion users.
  var reveals = document.querySelectorAll(".reveal");
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (n) { n.classList.add("is-visible"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
    reveals.forEach(function (n) { io.observe(n); });
  }
})();
