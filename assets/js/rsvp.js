/* =====================================================================
   RSVP form: conditional questions, validation and sending to the
   Google Apps Script web app (RSVP_ENDPOINT in config.js).
   Question wording lives in index.html; travel options are just below.
   ===================================================================== */
(function () {
  "use strict";

  // ---- Travel options (arrival and departure share these) ----
  var TRAVEL = { modes: ["Flight", "Train", "Bus", "Own car"] };
  // Arriving or leaving by these means we arrange a pickup / drop.
  var NEEDS_TRANSFER = { Flight: true, Train: true, Bus: true };

  var TRAVEL_TEXT = {
    arrival: {
      title: "Arrival in Delhi",
      mode: "How are you getting to Delhi?",
      when: "Arrival date and time",
      word: "arrival",
      dates: WEDDING.rsvp.arrivalDates,
    },
    departure: {
      title: "Departure from Delhi",
      mode: "How are you leaving Delhi?",
      when: "Departure date and time",
      word: "departure",
      dates: WEDDING.rsvp.departureDates,
    },
  };

  // ---- What the guest sees in "See what you sent" and the WhatsApp fallback ----
  var LABELS = [
    ["fullName", "Name"], ["phone", "Phone"], ["attending", "Attending"],
    ["guestCount", "Guests"], ["guestNames", "Guest names"],
    ["arrivalMode", "Arrival"], ["arrivalPoint", "Arriving at"], ["arrivalNumber", "Arrival flight/train no."], ["arrivalTime", "Arrival time"],
    ["departureMode", "Departure"], ["departurePoint", "Leaving from"], ["departureNumber", "Departure flight/train no."], ["departureTime", "Departure time"],
    ["message", "Message"],
  ];

  var MAX_GUESTS = WEDDING.rsvp.maxGuests || 15;
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var form = document.getElementById("rsvp-form");
  if (!form) return;
  var submitBtn = document.getElementById("submit-btn");
  var submitting = false;

  // ------------------------------------------------------------------
  // Small helpers
  // ------------------------------------------------------------------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }
  function show(node, visible) { if (node) node.hidden = !visible; }
  function val(name) { var f = form.elements[name]; return f && f.value ? String(f.value).trim() : ""; }
  function radio(name) { var c = $('input[name="' + name + '"]:checked', form); return c ? c.value : ""; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }

  /** "2026-12-10" -> Date at midnight UTC (avoids time-zone surprises). */
  function parseDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  }
  function isoDate(d) { return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
  /** "2026-12-10" -> "Thu 10 Dec" */
  function shortDate(iso) {
    var d = parseDate(iso);
    return d ? DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] : iso;
  }
  /** "2026-12-10T19:00" -> "Thu 10 Dec 2026, 19:00" */
  function formatDateTime(v) {
    var m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(v || "");
    return m ? shortDate(m[1]) + " " + m[1].slice(0, 4) + ", " + m[2] : v || "";
  }
  /** "19", "05" -> "7:05 pm" */
  function twelveHour(h, m) {
    h = +h;
    return (h % 12 || 12) + ":" + m + " " + (h >= 12 ? "pm" : "am");
  }

  /** A group of pill-style radios. */
  function choiceGroup(name, options, extraClass) {
    var wrap = el("div", "choices choices-2" + (extraClass ? " " + extraClass : ""));
    options.forEach(function (opt) {
      var value = typeof opt === "string" ? opt : opt.value;
      var label = el("label", "choice");
      var input = el("input");
      input.type = "radio";
      input.name = name;
      input.value = value;
      label.appendChild(input);
      var face = el("span", null, typeof opt === "string" ? opt : (opt.label || null));
      if (opt.parts) { // calendar tile: "Wed" / "9" / "Dec"
        face.appendChild(el("small", null, opt.parts[0]));
        face.appendChild(el("strong", null, opt.parts[1]));
        face.appendChild(el("small", null, opt.parts[2]));
      }
      if (opt.className) label.classList.add(opt.className);
      label.appendChild(face);
      wrap.appendChild(label);
    });
    return wrap;
  }

  /** A question block with legend/label, control and an error line. */
  function field(name, labelText, control, isGroup) {
    var box = el(isGroup ? "fieldset" : "div", "field");
    box.setAttribute("data-field", name);
    var label = el(isGroup ? "legend" : "label", null, labelText);
    if (!isGroup) label.htmlFor = name;
    box.appendChild(label);
    box.appendChild(control);
    var err = el("p", "error");
    err.id = name + "-error";
    box.appendChild(err);
    return box;
  }
  function textInput(name, placeholder, maxLength) {
    var i = el("input");
    i.type = "text"; i.id = name; i.name = name; i.maxLength = maxLength || 60;
    if (placeholder) i.placeholder = placeholder;
    return i;
  }
  // ------------------------------------------------------------------
  // Scroll wheel (like the iPhone time picker). The first row, "--",
  // means "not set yet". The chosen value goes into a hidden input.
  // ------------------------------------------------------------------
  var ITEM_H = 40; // keep in sync with .wheel-item height in style.css
  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var wheels = [];

  function buildWheel(name, max, ariaLabel, onChange) {
    var values = [""];
    for (var i = 0; i <= max; i++) values.push(pad(i));

    var wheel = el("div", "wheel");
    wheel.tabIndex = 0;
    wheel.setAttribute("role", "spinbutton");
    wheel.setAttribute("aria-label", ariaLabel);
    wheel.setAttribute("aria-valuemin", "0");
    wheel.setAttribute("aria-valuemax", String(max));
    wheel.setAttribute("aria-valuetext", "not set");
    wheel.appendChild(el("div", "wheel-pad"));
    values.forEach(function (v) {
      var item = el("div", "wheel-item", v || "--");
      item.setAttribute("aria-hidden", "true");
      wheel.appendChild(item);
    });
    wheel.appendChild(el("div", "wheel-pad"));
    var items = $all(".wheel-item", wheel);

    var hidden = el("input");
    hidden.type = "hidden"; hidden.name = name; hidden.id = name;

    var current = 0, settleTimer = null, frame = null;

    // Tilt and fade rows away from the centre for the 3D drum look.
    function paint() {
      frame = null;
      var pos = wheel.scrollTop / ITEM_H;
      var lo = Math.max(0, Math.floor(pos) - 4), hi = Math.min(items.length - 1, Math.ceil(pos) + 4);
      for (var i = lo; i <= hi; i++) {
        var d = i - pos;
        items[i].style.transform = "rotateX(" + (-d * 22) + "deg)";
        items[i].style.opacity = String(Math.max(0.2, 1 - Math.abs(d) * 0.3));
      }
    }
    function setIndex(idx, scroll) {
      idx = Math.max(0, Math.min(values.length - 1, idx));
      var changed = idx !== current;
      current = idx;
      var v = values[idx];
      hidden.value = v;
      items.forEach(function (it, i) { it.classList.toggle("is-selected", i === idx); });
      if (v === "") wheel.removeAttribute("aria-valuenow");
      else wheel.setAttribute("aria-valuenow", String(+v));
      wheel.setAttribute("aria-valuetext", v === "" ? "not set" : v);
      if (scroll) wheel.scrollTo({ top: idx * ITEM_H, behavior: REDUCED ? "auto" : "smooth" });
      if (changed) {
        hidden.dispatchEvent(new Event("change", { bubbles: true }));
        if (onChange) onChange();
      }
    }

    wheel.addEventListener("scroll", function () {
      if (!frame) frame = requestAnimationFrame(paint);
      clearTimeout(settleTimer);
      settleTimer = setTimeout(function () { setIndex(Math.round(wheel.scrollTop / ITEM_H), false); }, 120);
    }, { passive: true });
    wheel.addEventListener("click", function (e) {
      var item = e.target.closest(".wheel-item");
      if (item) setIndex(items.indexOf(item), true);
    });
    wheel.addEventListener("keydown", function (e) {
      var step = { ArrowDown: 1, ArrowUp: -1, PageDown: 5, PageUp: -5 }[e.key];
      if (e.key === "Home") step = 1 - current;
      if (e.key === "End") step = values.length - 1 - current;
      if (step === undefined) return;
      e.preventDefault();
      setIndex(current + step, true);
    });

    items[0].classList.add("is-selected");
    wheels.push({ wheel: wheel, paint: paint });
    return { wheel: wheel, hidden: hidden };
  }

  // ------------------------------------------------------------------
  // Date and time picker: date tiles + hour and minute wheels (24-hour)
  // ------------------------------------------------------------------
  function buildWhen(kind) {
    var t = TRAVEL_TEXT[kind];
    var wrap = el("div", "when");

    wrap.appendChild(el("p", "mini-label", "Date"));
    var dateOptions = t.dates.map(function (iso) {
      return { value: iso, parts: shortDate(iso).split(" ") }; // ["Wed", "9", "Dec"]
    });
    dateOptions.push({ value: "other", parts: ["Another", "Other", "date"], className: "is-other" });
    wrap.appendChild(choiceGroup(kind + "Date", dateOptions, "date-chips"));

    var other = el("div", "other-date");
    other.setAttribute("data-other-date", kind);
    var otherLabel = el("label", "mini-label", "Which date?");
    otherLabel.htmlFor = kind + "OtherDate";
    var otherInput = el("input");
    otherInput.type = "date"; otherInput.id = kind + "OtherDate"; otherInput.name = kind + "OtherDate";
    otherInput.min = "2026-11-01"; otherInput.max = "2027-01-31";
    other.appendChild(otherLabel);
    other.appendChild(otherInput);
    wrap.appendChild(other);

    wrap.appendChild(el("p", "mini-label", "Time (24-hour)"));
    var readout = el("p", "time-readout", "Scroll to set the hour and minutes");
    readout.setAttribute("aria-live", "polite");
    function updateReadout() {
      var h = val(kind + "Hour"), m = val(kind + "Minute");
      readout.textContent = h && m ? h + ":" + m + " · " + twelveHour(h, m)
        : "Scroll to set the " + (h ? "minutes" : m ? "hour" : "hour and minutes");
    }
    var hour = buildWheel(kind + "Hour", 23, t.word + " hour, 00 to 23", updateReadout);
    var minute = buildWheel(kind + "Minute", 59, t.word + " minutes, 00 to 59", updateReadout);

    var heads = el("div", "wheel-heads");
    heads.setAttribute("aria-hidden", "true");
    heads.appendChild(el("span", null, "Hours"));
    heads.appendChild(el("span", null, "Minutes"));
    wrap.appendChild(heads);

    var picker = el("div", "wheel-picker");
    picker.appendChild(hour.wheel);
    picker.appendChild(el("span", "wheel-colon", ":"));
    picker.appendChild(minute.wheel);
    wrap.appendChild(picker);
    wrap.appendChild(hour.hidden);
    wrap.appendChild(minute.hidden);
    wrap.appendChild(readout);
    return wrap;
  }

  // ------------------------------------------------------------------
  // Arrival and departure blocks
  // ------------------------------------------------------------------
  function buildTravel(kind) {
    var t = TRAVEL_TEXT[kind];
    var block = el("fieldset", "travel-block");
    block.appendChild(el("legend", null, t.title));

    block.appendChild(field(kind + "Mode", t.mode, choiceGroup(kind + "Mode", TRAVEL.modes), true));

    var flight = el("div", "sub");
    flight.setAttribute("data-sub", kind + "-Flight");
    flight.appendChild(field(kind + "FlightNo", "Flight number (optional)", textInput(kind + "FlightNo", "e.g. 6E 2134", 12)));
    block.appendChild(flight);

    var train = el("div", "sub");
    train.setAttribute("data-sub", kind + "-Train");
    train.appendChild(field(kind + "TrainNo", "Train number (optional)", textInput(kind + "TrainNo", "e.g. 12951", 12)));
    block.appendChild(train);

    var bus = el("div", "sub");
    bus.setAttribute("data-sub", kind + "-Bus");
    bus.appendChild(field(kind + "BusTerminal", "Bus terminal name (optional)", textInput(kind + "BusTerminal", "e.g. Kashmere Gate ISBT", 60)));
    block.appendChild(bus);

    var when = field(kind + "When", t.when, buildWhen(kind), true);
    when.setAttribute("data-when", kind);
    block.appendChild(when);
    return block;
  }
  document.getElementById("travel-arrival").appendChild(buildTravel("arrival"));
  document.getElementById("travel-departure").appendChild(buildTravel("departure"));

  // Wire each error line to its inputs for screen readers
  $all(".field[data-field]", form).forEach(function (box) {
    var err = $(".error", box);
    if (!err) return;
    $all("input, textarea, select, .wheel", box).forEach(function (i) { i.setAttribute("aria-describedby", err.id); });
  });

  // ------------------------------------------------------------------
  // Guest names: one row per guest; row 1 is the person filling the form
  // ------------------------------------------------------------------
  var guestList = document.getElementById("guest-names");
  var guestCount = form.elements.guestCount;
  guestCount.max = MAX_GUESTS;

  function clampGuests(n) { n = parseInt(n, 10); if (isNaN(n)) return 1; return Math.max(1, Math.min(MAX_GUESTS, n)); }

  function renderGuestNames() {
    var count = clampGuests(guestCount.value);
    var typed = $all("input", guestList).map(function (i) { return i.value; });
    guestList.textContent = "";
    var self = el("li", "guest-self");
    self.appendChild(document.createTextNode((val("fullName") || "You") + " "));
    self.appendChild(el("em", null, "(you)"));
    guestList.appendChild(self);
    for (var i = 1; i < count; i++) {
      var li = el("li");
      var input = textInput("guest" + (i + 1), "Guest " + (i + 1) + " name", 120);
      input.setAttribute("aria-label", "Guest " + (i + 1) + " name");
      input.setAttribute("aria-describedby", "guestNames-error");
      input.className = "guest-name";
      input.value = typed[i - 1] || "";
      li.appendChild(input);
      guestList.appendChild(li);
    }
  }

  $all(".stepper-btn", form).forEach(function (btn) {
    btn.addEventListener("click", function () {
      guestCount.value = clampGuests((parseInt(guestCount.value, 10) || 1) + parseInt(btn.getAttribute("data-step"), 10));
      renderGuestNames();
      clearError("guestCount");
    });
  });
  guestCount.addEventListener("input", renderGuestNames);
  form.elements.fullName.addEventListener("input", function () {
    var self = $(".guest-self", guestList);
    if (self) self.firstChild.textContent = (val("fullName") || "You") + " ";
  });

  // ------------------------------------------------------------------
  // Show / hide questions based on answers
  // ------------------------------------------------------------------
  function updateVisibility() {
    var attending = radio("attending");
    show(document.getElementById("branch-no"), attending === "No");
    show(document.getElementById("branch-yes"), attending === "Yes");
    show(document.getElementById("submit-row"), attending !== "");

    ["arrival", "departure"].forEach(function (kind) {
      var mode = radio(kind + "Mode");
      $all('[data-sub^="' + kind + '-"]', form).forEach(function (sub) {
        show(sub, sub.getAttribute("data-sub") === kind + "-" + mode);
      });
      show($('[data-when="' + kind + '"]', form), mode !== "");
      show($('[data-other-date="' + kind + '"]', form), radio(kind + "Date") === "other");
    });
    // Wheels can only draw their tilt once they are on screen.
    wheels.forEach(function (w) { if (w.wheel.offsetParent) w.paint(); });
  }

  form.addEventListener("change", function (e) {
    updateVisibility();
    if (e.target && e.target.name) clearError(fieldNameFor(e.target));
  });
  form.addEventListener("input", function (e) {
    if (e.target && e.target.name) clearError(fieldNameFor(e.target));
  });

  // ------------------------------------------------------------------
  // Validation
  // ------------------------------------------------------------------
  function fieldNameFor(input) {
    if (input.classList.contains("guest-name")) return "guestNames";
    var box = input.closest("[data-field]");
    return box ? box.getAttribute("data-field") : input.name;
  }

  function setError(name, message) {
    var box = $('[data-field="' + name + '"]', form);
    var err = document.getElementById(name + "-error");
    if (box) box.classList.add("has-error");
    if (err) err.textContent = message;
    if (box) $all("input, textarea, select, .wheel", box).forEach(function (i) { i.setAttribute("aria-invalid", "true"); });
  }
  function clearError(name) {
    var box = $('[data-field="' + name + '"]', form);
    var err = document.getElementById(name + "-error");
    if (box) {
      box.classList.remove("has-error");
      $all("input, textarea, select, .wheel", box).forEach(function (i) { i.removeAttribute("aria-invalid"); });
    }
    if (err) err.textContent = "";
    if (!$(".has-error", form)) document.getElementById("form-alert").hidden = true;
  }
  function clearAllErrors() {
    $all(".has-error", form).forEach(function (b) { clearError(b.getAttribute("data-field")); });
  }

  /** {date: "2026-12-10", iso: "2026-12-10T19:00"} or null if incomplete. */
  function whenValue(kind) {
    var d = radio(kind + "Date");
    if (d === "other") d = val(kind + "OtherDate");
    var hr = val(kind + "Hour"), mi = val(kind + "Minute");
    if (!d || !hr || !mi) return null;
    return { date: d, iso: d + "T" + hr + ":" + mi };
  }

  function validTravel(kind, errors) {
    var t = TRAVEL_TEXT[kind];
    var mode = radio(kind + "Mode");
    var word = kind === "arrival" ? "getting to" : "leaving";
    if (!mode) { errors.push([kind + "Mode", "Please choose how you're " + word + " Delhi."]); return; }
    var d = radio(kind + "Date");
    var hasDate = d && (d !== "other" || val(kind + "OtherDate"));
    var hasTime = val(kind + "Hour") && val(kind + "Minute");
    if (!hasDate && !hasTime) errors.push([kind + "When", "Please choose your " + t.word + " date and time."]);
    else if (!hasDate) errors.push([kind + "When", "Please choose your " + t.word + " date."]);
    else if (!hasTime) errors.push([kind + "When", "Please set your " + t.word + " time: scroll the hours and the minutes."]);
  }

  function validate() {
    var errors = [];
    if (val("fullName").length < 2) errors.push(["fullName", "Please tell us your name."]);

    var phone = val("phone");
    var digits = phone.replace(/\D/g, "");
    if (!phone) errors.push(["phone", "Please add a phone or WhatsApp number."]);
    else if (!/^[+\d\s().-]+$/.test(phone) || digits.length < 10 || digits.length > 13)
      errors.push(["phone", "That number doesn't look right. Try something like 98100 00000."]);

    var attending = radio("attending");
    if (!attending) errors.push(["attending", "Please let us know if you can make it."]);

    if (attending === "Yes") {
      var n = parseInt(guestCount.value, 10);
      if (isNaN(n) || n < 1 || n > MAX_GUESTS) errors.push(["guestCount", "Please enter a number from 1 to " + MAX_GUESTS + "."]);
      else if ($all(".guest-name", guestList).some(function (i) { return !i.value.trim(); }))
        errors.push(["guestNames", "Please add a name for each guest."]);

      validTravel("arrival", errors);
      validTravel("departure", errors);
      var a = whenValue("arrival"), d = whenValue("departure");
      if (a && d && d.iso <= a.iso) errors.push(["departureWhen", "Departure should be after your arrival."]);
    }
    return errors;
  }

  function showErrors(errors) {
    errors.forEach(function (e) { setError(e[0], e[1]); });
    var alert = document.getElementById("form-alert");
    alert.textContent = errors.length === 1
      ? "Please check the highlighted answer below."
      : "Please check the " + errors.length + " highlighted answers below.";
    alert.hidden = false;
    var first = $('[data-field="' + errors[0][0] + '"]', form);
    var focusable = first && $("input:not([type=hidden]), textarea, select", first);
    if (errors[0][0] === "guestNames") focusable = $all(".guest-name", guestList).filter(function (i) { return !i.value.trim(); })[0];
    if (first) first.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    if (focusable) setTimeout(function () { focusable.focus({ preventScroll: true }); }, 300);
  }

  // ------------------------------------------------------------------
  // Build the data sent to the sheet
  // ------------------------------------------------------------------
  function travelData(kind, data) {
    var mode = radio(kind + "Mode");
    var point = "", number = "";
    if (mode === "Flight") number = val(kind + "FlightNo");
    if (mode === "Train") number = val(kind + "TrainNo");
    if (mode === "Bus") point = val(kind + "BusTerminal");
    var when = whenValue(kind);
    data[kind + "Mode"] = mode;
    data[kind + "Point"] = point;
    data[kind + "Number"] = number;
    data[kind + "Time"] = when ? formatDateTime(when.iso) : "";
    return when;
  }

  /** Nights from the arrival date up to the night before departure, always including the wedding night. */
  function stayNights(arrival, departure) {
    var nights = {};
    nights[WEDDING.rsvp.weddingNight] = true;
    var d = arrival && parseDate(arrival.date), end = departure && parseDate(departure.date);
    for (var i = 0; d && end && d < end && i < 31; i++) {
      nights[isoDate(d)] = true;
      d = new Date(d.getTime() + 86400000);
    }
    return Object.keys(nights).sort().map(shortDate);
  }

  function collect() {
    var data = {
      website: val("website"), // honeypot
      fullName: val("fullName"),
      phone: val("phone"),
      attending: radio("attending"),
    };
    if (data.attending === "No") {
      data.guestCount = 0;
      data.message = val("noteNo");
      return data;
    }
    var names = [data.fullName].concat($all(".guest-name", guestList).map(function (i) { return i.value.trim(); }));
    data.guestCount = clampGuests(guestCount.value);
    data.guestNames = names.join(", ");
    data.functions = WEDDING.events.map(function (e) { return e.name; }).join(", ");
    var arrival = travelData("arrival", data);
    var departure = travelData("departure", data);

    // Not asked on the form, recorded for planning:
    var pickup = NEEDS_TRANSFER[data.arrivalMode], drop = NEEDS_TRANSFER[data.departureMode];
    data.pickupDrop = pickup && drop ? "Pickup and drop" : pickup ? "Pickup" : drop ? "Drop" : "No (own car)";
    data.accommodation = "Yes";
    var nights = stayNights(arrival, departure);
    data.stayNights = nights.join(", ");
    data.nightsCount = nights.length;

    data.message = val("message");
    return data;
  }

  function summaryLines(data) {
    return LABELS.filter(function (l) {
      var v = data[l[0]];
      if (l[0] === "guestCount" && data.attending === "No") return false;
      return v !== undefined && v !== "" && v !== null;
    }).map(function (l) { return [l[1], String(data[l[0]])]; });
  }
  function whatsappLink(text) {
    return "https://wa.me/" + WEDDING.contact.whatsapp + "?text=" + encodeURIComponent(text);
  }
  function rsvpAsText(data) {
    return "Hi! Here is my RSVP for " + WEDDING.couple.first + " & " + WEDDING.couple.second + "'s wedding:\n" +
      summaryLines(data).map(function (l) { return l[0] + ": " + l[1]; }).join("\n");
  }

  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------
  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle("is-loading", on);
    submitBtn.textContent = on ? "Sending…" : "Try again";
    submitBtn.setAttribute("aria-busy", on ? "true" : "false");
  }

  function send(data) {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(RSVP_ENDPOINT)) {
      return Promise.reject(new Error("RSVP_ENDPOINT is not set in config.js"));
    }
    var controller = "AbortController" in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, 25000);
    return fetch(RSVP_ENDPOINT, {
      method: "POST",
      // text/plain keeps this a "simple" request, so the browser skips the
      // CORS preflight that Apps Script can't answer.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
      redirect: "follow",
      signal: controller ? controller.signal : undefined,
    }).then(function (res) {
      return res.text();
    }).then(function (text) {
      clearTimeout(timer);
      var json;
      try { json = JSON.parse(text); } catch (e) { throw new Error("Unexpected reply from the server"); }
      if (!json.ok) throw new Error(json.error || "The RSVP was not saved");
      return json;
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }

  function showSuccess(data) {
    var first = data.fullName.split(/\s+/)[0];
    document.getElementById("success-text").textContent = data.attending === "Yes"
      ? "We've got your RSVP, " + first + ". We can't wait to celebrate with you!"
      : "Thank you for letting us know, " + first + ". You'll be missed!";
    var dl = document.getElementById("success-summary");
    dl.textContent = "";
    summaryLines(data).forEach(function (l) {
      dl.appendChild(el("dt", null, l[0]));
      dl.appendChild(el("dd", null, l[1]));
    });
    document.getElementById("success-whatsapp").href =
      whatsappLink("Hi! I'd like to update my RSVP. My name is " + data.fullName + ".");
    form.hidden = true;
    document.getElementById("rsvp-error").hidden = true;
    var box = document.getElementById("rsvp-success");
    box.hidden = false;
    box.scrollIntoView({ block: "start" });
    box.focus({ preventScroll: true });
  }

  function showFailure(data) {
    document.getElementById("error-whatsapp").href = whatsappLink(rsvpAsText(data));
    var box = document.getElementById("rsvp-error");
    box.hidden = false;
    box.scrollIntoView({ block: "center" });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitting) return;
    clearAllErrors();
    var errors = validate();
    if (errors.length) { showErrors(errors); return; }

    var data = collect();
    submitting = true;
    setLoading(true);
    document.getElementById("rsvp-error").hidden = true;

    send(data).then(function () {
      // Button stays disabled after success so the RSVP can't be sent twice.
      showSuccess(data);
    }).catch(function (err) {
      if (window.console) console.error("RSVP failed:", err);
      submitting = false;
      setLoading(false);
      showFailure(data);
    });
  });

  // Initial state
  renderGuestNames();
  updateVisibility();
})();
