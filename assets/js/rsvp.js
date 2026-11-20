/* =====================================================================
   RSVP form: conditional questions, validation and sending to the
   Google Apps Script web app (RSVP_ENDPOINT in config.js).
   Question wording lives in index.html; travel options are just below.
   ===================================================================== */
(function () {
  "use strict";

  // ---- Travel options (arrival and departure share these) ----
  var TRAVEL = {
    modes: ["Flight", "Train", "Bus", "Own car", "Not sure yet"],
    terminals: ["DEL T1", "DEL T2", "DEL T3"],
    stations: ["New Delhi", "Old Delhi", "Hazrat Nizamuddin", "Anand Vihar", "Other"],
    isbts: ["Kashmere Gate", "Anand Vihar", "Sarai Kale Khan", "Other"],
  };
  var TRAVEL_TEXT = {
    arrival: {
      title: "Arrival in Delhi",
      mode: "How are you getting to Delhi?",
      terminal: "Which terminal do you land at?",
      station: "Which station do you arrive at?",
      isbt: "Which bus terminal (ISBT) do you arrive at?",
      time: "Arrival date and time",
      notSure: "No problem. Send us your tickets on WhatsApp once they're booked. If you'll need a room on the night of 11 December, tell us further down.",
    },
    departure: {
      title: "Departure from Delhi",
      mode: "How are you leaving Delhi?",
      terminal: "Which terminal do you fly out of?",
      station: "Which station do you leave from?",
      isbt: "Which bus terminal (ISBT) do you leave from?",
      time: "Departure date and time",
      notSure: "No problem. Let us know once you've decided.",
    },
  };

  // ---- Labels used in the success summary and the WhatsApp fallback ----
  var LABELS = [
    ["fullName", "Name"], ["phone", "Phone"], ["attending", "Attending"],
    ["guestCount", "Guests"], ["guestNames", "Guest names"], ["functions", "Functions"],
    ["arrivalMode", "Arrival"], ["arrivalPoint", "Arriving at"], ["arrivalNumber", "Arrival flight/train no."], ["arrivalTime", "Arrival time"],
    ["departureMode", "Departure"], ["departurePoint", "Leaving from"], ["departureNumber", "Departure flight/train no."], ["departureTime", "Departure time"],
    ["pickupDrop", "Pickup / drop"], ["accommodation", "Room needed"], ["stayNights", "Nights"], ["nightsCount", "Number of nights"], ["rooms", "Rooms"],
    ["food", "Food"], ["dietary", "Allergies / restrictions"], ["message", "Message"],
  ];

  var MAX_GUESTS = WEDDING.rsvp.maxGuests || 15;
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
  function checked(name) { return $all('input[name="' + name + '"]:checked', form).map(function (i) { return i.value; }); }

  /** A group of pill-style radios or checkboxes. */
  function choiceGroup(type, name, options, columns) {
    var wrap = el("div", "choices" + (columns ? " choices-2" : ""));
    options.forEach(function (opt) {
      var label = el("label", "choice");
      var input = el("input");
      input.type = type;
      input.name = name;
      input.value = opt;
      label.appendChild(input);
      label.appendChild(el("span", null, opt));
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
  // Build the dynamic parts of the form
  // ------------------------------------------------------------------
  // Functions (one checkbox per event; ticked already if there's only one)
  var fnBox = document.getElementById("function-choices");
  WEDDING.events.forEach(function (ev) {
    var g = choiceGroup("checkbox", "functions", [ev.name]);
    fnBox.appendChild(g.firstChild);
  });
  if (WEDDING.events.length === 1) $('input[name="functions"]', form).checked = true;

  // Stay nights
  var nightBox = document.getElementById("night-choices");
  WEDDING.rsvp.stayNights.forEach(function (n) {
    var g = choiceGroup("checkbox", "stayNights", [n.label]);
    nightBox.appendChild(g.firstChild);
  });

  // Arrival and departure blocks
  function buildTravel(kind) {
    var t = TRAVEL_TEXT[kind];
    var block = el("fieldset", "travel-block");
    block.appendChild(el("legend", null, t.title));

    block.appendChild(field(kind + "Mode", t.mode, choiceGroup("radio", kind + "Mode", TRAVEL.modes, true), true));

    var flight = el("div", "sub");
    flight.setAttribute("data-sub", kind + "-Flight");
    flight.appendChild(field(kind + "Terminal", t.terminal, choiceGroup("radio", kind + "Terminal", TRAVEL.terminals, true), true));
    flight.appendChild(field(kind + "FlightNo", "Flight number (if you know it)", textInput(kind + "FlightNo", "e.g. 6E 2134", 12)));
    block.appendChild(flight);

    var train = el("div", "sub");
    train.setAttribute("data-sub", kind + "-Train");
    train.appendChild(field(kind + "Station", t.station, choiceGroup("radio", kind + "Station", TRAVEL.stations, true), true));
    var stationOther = field(kind + "StationOther", "Which station?", textInput(kind + "StationOther", "Station name", 60));
    stationOther.setAttribute("data-other", kind + "Station");
    train.appendChild(stationOther);
    train.appendChild(field(kind + "TrainNo", "Train number (if you know it)", textInput(kind + "TrainNo", "e.g. 12951", 12)));
    block.appendChild(train);

    var bus = el("div", "sub");
    bus.setAttribute("data-sub", kind + "-Bus");
    bus.appendChild(field(kind + "Isbt", t.isbt, choiceGroup("radio", kind + "Isbt", TRAVEL.isbts, true), true));
    var isbtOther = field(kind + "IsbtOther", "Which bus stop?", textInput(kind + "IsbtOther", "Bus stop or area", 60));
    isbtOther.setAttribute("data-other", kind + "Isbt");
    bus.appendChild(isbtOther);
    block.appendChild(bus);

    var time = el("input");
    time.type = "datetime-local"; time.id = kind + "Time"; time.name = kind + "Time";
    time.min = "2026-11-01T00:00"; time.max = "2027-01-31T23:59";
    var timeField = field(kind + "Time", t.time + " (if you know it)", time);
    timeField.setAttribute("data-when", kind);
    block.appendChild(timeField);

    var note = el("p", "note", t.notSure);
    note.setAttribute("data-unsure", kind);
    block.appendChild(note);
    return block;
  }
  document.getElementById("travel-arrival").appendChild(buildTravel("arrival"));
  document.getElementById("travel-departure").appendChild(buildTravel("departure"));

  // Wire each error line to its inputs for screen readers
  $all(".field[data-field]", form).forEach(function (box) {
    var err = $(".error", box);
    if (!err) return;
    $all("input, textarea", box).forEach(function (i) { i.setAttribute("aria-describedby", err.id); });
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
      var input = textInput("guest" + (i + 1), "Guest " + (i + 1) + " full name", 120);
      input.setAttribute("aria-label", "Guest " + (i + 1) + " full name");
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
      show($('[data-when="' + kind + '"]', form), mode !== "" && mode !== "Not sure yet");
      show($('[data-unsure="' + kind + '"]', form), mode === "Not sure yet");
    });
    $all("[data-other]", form).forEach(function (box) {
      show(box, radio(box.getAttribute("data-other")) === "Other");
    });

    show(document.getElementById("stay-details"), radio("accommodation") === "Yes");
    show(document.getElementById("food-other"), radio("food") === "Other");
    updateNightsCount();
  }

  function updateNightsCount() {
    var n = checked("stayNights").length;
    document.getElementById("nights-count").textContent =
      n ? "That's " + n + " night" + (n > 1 ? "s" : "") + "." : "";
  }

  // When a guest first says they need a room, tick the default night(s)
  $all('input[name="accommodation"]', form).forEach(function (r) {
    r.addEventListener("change", function () {
      if (r.value === "Yes" && checked("stayNights").length === 0) {
        WEDDING.rsvp.stayNights.forEach(function (n) {
          if (n.default) $('input[name="stayNights"][value="' + n.label + '"]', form).checked = true;
        });
      }
    });
  });

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
    if (box) $all("input, textarea", box).forEach(function (i) { i.setAttribute("aria-invalid", "true"); });
  }
  function clearError(name) {
    var box = $('[data-field="' + name + '"]', form);
    var err = document.getElementById(name + "-error");
    if (box) {
      box.classList.remove("has-error");
      $all("input, textarea", box).forEach(function (i) { i.removeAttribute("aria-invalid"); });
    }
    if (err) err.textContent = "";
    var alert = document.getElementById("form-alert");
    if (!$(".has-error", form)) alert.hidden = true;
  }
  function clearAllErrors() {
    $all(".has-error", form).forEach(function (b) { clearError(b.getAttribute("data-field")); });
  }

  function validTravel(kind, errors) {
    var mode = radio(kind + "Mode");
    var word = kind === "arrival" ? "arriving" : "leaving";
    if (!mode) { errors.push([kind + "Mode", "Please choose how you're " + word + " (or \"Not sure yet\")."]); return; }
    if (mode === "Flight" && !radio(kind + "Terminal")) errors.push([kind + "Terminal", "Please choose a terminal."]);
    if (mode === "Train") {
      var st = radio(kind + "Station");
      if (!st) errors.push([kind + "Station", "Please choose a station."]);
      else if (st === "Other" && !val(kind + "StationOther")) errors.push([kind + "StationOther", "Please tell us the station name."]);
    }
    if (mode === "Bus") {
      var b = radio(kind + "Isbt");
      if (!b) errors.push([kind + "Isbt", "Please choose a bus terminal."]);
      else if (b === "Other" && !val(kind + "IsbtOther")) errors.push([kind + "IsbtOther", "Please tell us where your bus stops."]);
    }
  }

  function validate() {
    var errors = [];
    var name = val("fullName");
    if (name.length < 2) errors.push(["fullName", "Please tell us your name."]);

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

      if (checked("functions").length === 0) errors.push(["functions", "Please pick at least one function."]);

      validTravel("arrival", errors);
      validTravel("departure", errors);
      var a = radio("arrivalMode") !== "Not sure yet" ? val("arrivalTime") : "";
      var d = radio("departureMode") !== "Not sure yet" ? val("departureTime") : "";
      if (a && d && d <= a) errors.push(["departureTime", "Departure should be after your arrival."]);

      if (!radio("pickupDrop")) errors.push(["pickupDrop", "Please choose one option."]);

      var acc = radio("accommodation");
      if (!acc) errors.push(["accommodation", "Please let us know if you need a room."]);
      if (acc === "Yes") {
        if (checked("stayNights").length === 0) errors.push(["stayNights", "Please tick at least one night."]);
        var rooms = val("rooms");
        if (rooms && (!/^\d+$/.test(rooms) || +rooms < 1 || +rooms > 10)) errors.push(["rooms", "Please enter a number from 1 to 10, or leave it blank."]);
      }

      var food = radio("food");
      if (!food) errors.push(["food", "Please choose a food preference."]);
      else if (food === "Other" && !val("foodOther")) errors.push(["foodOther", "Please tell us your food preference."]);
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
    var focusable = first && $("input:not([type=hidden]), textarea", first);
    if (errors[0][0] === "guestNames") focusable = $all(".guest-name", guestList).filter(function (i) { return !i.value.trim(); })[0];
    if (first) first.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    if (focusable) setTimeout(function () { focusable.focus({ preventScroll: true }); }, 300);
  }

  // ------------------------------------------------------------------
  // Build the data sent to the sheet (only answers that apply)
  // ------------------------------------------------------------------
  function formatDateTime(v) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v || "");
    if (!m) return v || "";
    var days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var date = new Date(+m[1], +m[2] - 1, +m[3]);
    var h = +m[4];
    var ampm = h >= 12 ? "pm" : "am";
    h = h % 12 || 12;
    return days[date.getDay()] + " " + (+m[3]) + " " + months[+m[2] - 1] + " " + m[1] + ", " + h + ":" + m[5] + " " + ampm;
  }
  function withOther(choice, otherText) { return choice === "Other" ? "Other: " + otherText : choice; }

  function travelData(kind, data) {
    var mode = radio(kind + "Mode");
    var point = "", number = "", time = "";
    if (mode === "Flight") { point = radio(kind + "Terminal"); number = val(kind + "FlightNo"); }
    if (mode === "Train") { point = withOther(radio(kind + "Station"), val(kind + "StationOther")); number = val(kind + "TrainNo"); }
    if (mode === "Bus") { point = withOther(radio(kind + "Isbt"), val(kind + "IsbtOther")); }
    if (mode && mode !== "Not sure yet") time = formatDateTime(val(kind + "Time"));
    data[kind + "Mode"] = mode;
    data[kind + "Point"] = point;
    data[kind + "Number"] = number;
    data[kind + "Time"] = time;
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
    data.functions = checked("functions").join(", ");
    travelData("arrival", data);
    travelData("departure", data);
    data.pickupDrop = radio("pickupDrop");
    data.accommodation = radio("accommodation");
    if (data.accommodation === "Yes") {
      var nights = checked("stayNights");
      data.stayNights = nights.join(", ");
      data.nightsCount = nights.length;
      data.rooms = val("rooms") ? parseInt(val("rooms"), 10) : "";
    }
    data.food = withOther(radio("food"), val("foodOther"));
    data.dietary = val("dietary");
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
