/* =====================================================================
   WEDDING SITE CONFIG: edit this file to change what the site says.
   ---------------------------------------------------------------------
   - Plain text only. Keep the quotes and commas as they are.
   - Anything in [SQUARE BRACKETS] is a placeholder still to be filled.
   - Don't use commas inside event names or stay-night labels: the
     Google Sheet joins multiple choices with ", ".
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
    kicker: "Together with their families",
    dateLong: "Friday, 11 December 2026",
    place: "Mosaic Sandoz, Delhi",
  },

  // Family lines, as printed on the invitation.
  families: {
    hosts: "Sh. Ashwini Aggarwal & Smt. Anju Aggarwal",
    invite: "cordially invite you to celebrate the wedding of their son",
    groom: "Raghav",
    groomLine: "Grandson of Smt. Laxmi Devi & Late Sh. Shyam Lal Aggarwal",
    bride: "Abhilasha",
    brideLine: "Daughter of Sh. Nirmal Garg & Smt. Poonam Garg",
    compliments: "With best compliments from the Aggarwal family, all relatives & friends",
  },

  story: {
    title: "Our story",
    paragraphs: [
      "[OUR STORY: two or three lines about how Raghav and Abhilasha met. Edit this in assets/js/config.js.]",
    ],
    // Drop photos into assets/photos with these names (or change the names).
    // Until a file exists, a "photo coming soon" frame is shown instead.
    photos: [
      { src: "assets/photos/photo-1.jpg", alt: "[PHOTO 1 DESCRIPTION]" },
      { src: "assets/photos/photo-2.jpg", alt: "[PHOTO 2 DESCRIPTION]" },
      { src: "assets/photos/photo-3.jpg", alt: "[PHOTO 3 DESCRIPTION]" },
    ],
  },

  // Each event appears in the schedule AND as a checkbox in the RSVP form.
  // To add Mehendi, Sangeet etc., copy a block and edit it.
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
    directionsUrl:
      "https://www.google.com/maps/dir/?api=1&destination=Mosaic%20Sandoz%20Banquet%20Hall%2C%20Wazirpur%20Industrial%20Area%2C%20Delhi%20110052&destination_place_id=ChIJKWz-LRgCDTkRIqiW3nQA8Mo",
    note: "Nearby metro stations include Shalimar Bagh (Pink Line) and Netaji Subhash Place (Red and Pink Lines). Take a short auto or cab ride from there.",
  },

  travel: [
    {
      title: "By air",
      icon: "✈",
      points: [
        "Indira Gandhi International Airport (DEL) has three terminals: T1, T2 and T3. Your ticket shows which one you land at.",
        "Prepaid taxis and app cabs (Uber, Ola) are available outside arrivals at every terminal.",
        "By road, plan for about an hour to the venue, and more in evening traffic.",
      ],
    },
    {
      title: "By train",
      icon: "🚆",
      points: [
        "Delhi's main stations are New Delhi (NDLS), Old Delhi (DLI), Hazrat Nizamuddin (NZM) and Anand Vihar Terminal (ANVT).",
        "Old Delhi and New Delhi are the closest of these to the venue.",
        "Use the official prepaid taxi booth or an app cab, not touts outside the station.",
      ],
    },
    {
      title: "By bus",
      icon: "🚌",
      points: [
        "Interstate buses arrive at ISBT Kashmere Gate, Anand Vihar or Sarai Kale Khan.",
        "Kashmere Gate is the closest to the venue and has its own metro station.",
      ],
    },
    {
      title: "Getting around",
      icon: "🚕",
      points: [
        "Delhi Metro is quick and cheap for daytime trips.",
        "Uber, Ola and Rapido work across Delhi, and autos are easy to find.",
      ],
    },
    {
      title: "Good to know",
      icon: "🧣",
      points: [
        "December evenings in Delhi are cold, often below 10 °C. Bring a warm layer.",
        "Winter fog can delay early-morning flights and trains, so keep some buffer in your plans.",
      ],
    },
  ],

  rsvp: {
    deadline: "[RSVP DEADLINE]",
    missYou: "We'll miss you! Sorry you can't make it. Thank you for letting us know.",
    // Nights a guest can ask for a room. The one marked default: true is
    // ticked automatically when a guest says they need a stay.
    stayNights: [
      { label: "Thu 10 Dec", default: false },
      { label: "Fri 11 Dec (wedding night)", default: true },
      { label: "Sat 12 Dec", default: false },
    ],
    maxGuests: 15,
  },

  // {deadline} and {phones} are filled in automatically from the settings above.
  faq: [
    { q: "When should I RSVP by?", a: "Please RSVP by {deadline}." },
    {
      q: "My travel plans aren't final yet. What should I do?",
      a: "RSVP anyway. Choose \"Not sure yet\" for travel and tell us if you need a room on the night of 11 December. Send us your tickets on WhatsApp once they're booked.",
    },
    {
      q: "Who should I include in my RSVP?",
      a: "Everyone travelling with you, so we can plan food, seating and rooms. You can add their names in the form.",
    },
    { q: "What should I wear?", a: "[DRESS CODE]" },
    { q: "Is there parking at the venue?", a: "[PARKING DETAILS]" },
    { q: "Can I change my RSVP later?", a: "Yes. Just message us on WhatsApp and we'll update it." },
    { q: "Who do I contact for help?", a: "Call or WhatsApp {phones}." },
  ],

  contact: {
    // Shown in the footer, the FAQ and the "something went wrong" message.
    phones: [
      { display: "98106 73728", tel: "+919810673728" },
      { display: "91680 81609", tel: "+919168081609" },
    ],
    // WhatsApp number in international format, digits only (91 = India).
    whatsapp: "919810673728",
  },
};
