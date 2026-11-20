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

  /** "98106 73728 or 91680 81609" with tap-to-call links. */
  function phoneLinks(container, joiner) {
    container.textContent = "";
    WEDDING.contact.phones.forEach(function (p, i) {
      if (i > 0) container.appendChild(document.createTextNode(joiner || " or "));
      var a = el("a", null, p.display);
      a.href = "tel:" + p.tel;
      container.appendChild(a);
    });
  }

  /** Replace {deadline} and {phones} tokens used in FAQ answers. */
  function fillTokens(text) {
    var phones = WEDDING.contact.phones.map(function (p) { return p.display; }).join(" or ");
    return text.replace("{deadline}", WEDDING.rsvp.deadline).replace("{phones}", phones);
  }

  // 1. Simple text bindings: <span data-text="couple.first">
  document.querySelectorAll("[data-text]").forEach(function (node) {
    var value = get(node.getAttribute("data-text"));
    if (typeof value === "string") node.textContent = value;
  });

  // 2. Shloka, one line per row
  var shloka = document.getElementById("shloka");
  WEDDING.blessing.forEach(function (line) { shloka.appendChild(el("span", null, line)); });

  // 3. Story paragraphs and photos (placeholder frame until the photo exists)
  var storyText = document.getElementById("story-text");
  WEDDING.story.paragraphs.forEach(function (t) { storyText.appendChild(el("p", null, t)); });

  var grid = document.getElementById("photo-grid");
  WEDDING.story.photos.forEach(function (photo) {
    var frame = el("figure", "photo");
    frame.style.margin = "0";
    var img = el("img");
    img.src = photo.src;
    img.alt = photo.alt;
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 600;
    img.height = 800;
    img.addEventListener("error", function () {
      frame.textContent = "";
      frame.appendChild(el("div", "photo-placeholder", "Photo coming soon"));
    });
    frame.appendChild(img);
    grid.appendChild(frame);
  });

  // 4. Events
  var eventList = document.getElementById("event-list");
  WEDDING.events.forEach(function (ev) {
    var card = el("article", "event-card reveal");
    card.appendChild(el("h3", "event-name", ev.name));
    var when = el("p", "event-when");
    when.appendChild(el("span", null, ev.date));
    when.appendChild(el("span", "event-time", ev.time));
    card.appendChild(when);
    card.appendChild(el("p", "event-where", ev.venue + ", " + ev.address));
    if (ev.note) card.appendChild(el("p", "event-note", ev.note));
    eventList.appendChild(card);
  });

  // 5. Venue links
  document.getElementById("maps-link").href = WEDDING.venue.mapsUrl;
  document.getElementById("directions-link").href = WEDDING.venue.directionsUrl;

  // 6. Travel cards
  var travelGrid = document.getElementById("travel-grid");
  WEDDING.travel.forEach(function (block) {
    var card = el("article", "travel-card reveal");
    var h = el("h3");
    h.appendChild(el("span", null, block.icon)).setAttribute("aria-hidden", "true");
    h.appendChild(document.createTextNode(block.title));
    card.appendChild(h);
    var ul = el("ul");
    block.points.forEach(function (p) { ul.appendChild(el("li", null, p)); });
    card.appendChild(ul);
    travelGrid.appendChild(card);
  });

  // 7. FAQ
  var faq = document.getElementById("faq-list");
  WEDDING.faq.forEach(function (item) {
    var d = el("details", "faq-item reveal");
    d.appendChild(el("summary", null, item.q));
    d.appendChild(el("p", null, fillTokens(item.a)));
    faq.appendChild(d);
  });

  // 8. Phone numbers in the footer and error message
  phoneLinks(document.getElementById("footer-phones"));
  phoneLinks(document.getElementById("error-phones"));

  // 9. Scroll reveal. Skipped entirely for reduced-motion users.
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
