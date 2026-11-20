/* =====================================================================
   WEDDING SITE CONFIG: edit this file to change what the site says.
   ---------------------------------------------------------------------
   - Plain text only. Keep the quotes and commas as they are.
   - Anything in [SQUARE BRACKETS] is a placeholder still to be filled.
   - Don't use commas inside event names: the Google Sheet joins
     multiple values with ", ".
   - The WhatsApp/Facebook link preview is NOT read from here. Edit the
     <meta> tags at the top of index.html for that.
   ===================================================================== */

/* 1. BACKEND: the Google Apps Script web app that saves RSVPs.
      This is the only place the URL appears. It is public by design. */
const RSVP_ENDPOINT = "https://script.google.com/macros/s/AKfycbykznCgPCWNwBd8xhvhr5hz3EVRMPkIGV5XkYUlh40tZaWEtNBkl7Xk_4n20puRG9zwqQ/exec";

/* 2. CONTENT */
const WEDDING = {
  couple: {
    first: "Raghav",
    second: "Abhilasha",
    initials: "R & A",
  },

  // Ganesh shloka from the invitation card (shown above the names).
  blessing: [
    "वक्रतुण्ड महाकाय सूर्यकोटि समप्रभः",
    "निर्विघ्नं कुरु मे देव सर्वकार्येषु सर्वदा",
  ],

  hero: {
    kicker: "Together with their families",   // line above the names
    invite: "invite you & your family to their wedding", // line below the names
    dateLong: "Friday, 11 December 2026",
    place: "Mosaic Sandoz, Delhi",
  },

  // The event shown in the schedule. Every guest who says "Yes" is
  // recorded in the sheet as attending this.
  events: [
    {
      name: "Wedding",
      date: "Friday, 11 December 2026",
      time: "6:30 pm onwards",
      venue: "Mosaic Sandoz",
      address: "A2, Wazirpur Industrial Area, Delhi 110052",
      note: "",
    },
  ],

  venue: {
    name: "Mosaic Sandoz",
    address: "A2, Wazirpur Industrial Area, Delhi 110052",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Mosaic%20Sandoz%20Banquet%20Hall%2C%20Wazirpur%20Industrial%20Area%2C%20Delhi%20110052&query_place_id=ChIJKWz-LRgCDTkRIqiW3nQA8Mo",
  },

  // The "Good to know" box near the end of the page.
  goodToKnow: {
    title: "Good to know",
    icon: "🧣",
    points: [
      "December evenings in Delhi are cold, often below 10 °C. Bring a warm layer.",
      "Winter fog can delay early-morning flights and trains, so keep some buffer in your plans.",
    ],
  },

  rsvp: {
    deadline: "[RSVP DEADLINE]", // shown above the form as "Please reply by ..."
    missYou: "We'll miss you! Sorry you can't make it. Thank you for letting us know.",
    maxGuests: 15,
    // Quick-pick dates in the arrival / departure questions (YYYY-MM-DD).
    // Guests can still choose "Another date".
    arrivalDates: ["2026-12-09", "2026-12-10", "2026-12-11"],
    departureDates: ["2026-12-11", "2026-12-12", "2026-12-13"],
    // Everyone attending is recorded as needing a room on this night.
    weddingNight: "2026-12-11",
  },

  footer: {
    compliments: "With best compliments from the Aggarwal family, all relatives & friends",
  },

  contact: {
    // Shown in the footer and the "something went wrong" message.
    phones: [
      { display: "91680 81609", tel: "+919168081609" },
    ],
    // WhatsApp number in international format, digits only (91 = India).
    whatsapp: "919168081609",
  },
};
