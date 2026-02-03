// Deve esistere come variabile globale, usata da main.js
const DATA = {
  "nations": {
    "venice": {
      "name": "Repubblica di Venezia",
      "caption": "Questa è uan caption di esempio per venezia.",
      "color": [255, 215, 0],
      "flag": {"file": "imgs/venice.png", "ratio": 0.4738},
      "crono": [
        {
          "year": 1508,
          "events": [
            {"icon": {"nation": "france"}, "text": "La Francia viene a farci visita."},
            {"icon": {"nation": "ottomans"}, "text": "L'Impero Ottomano ci invia un'ambasciata."}
          ]
        }
      ]
    },
    "ottomans": {
      "name": "Impero Ottomano",
      "color": [0, 128, 0],
      "flag": {"file": "imgs/ottomans.png", "ratio": 0.6668},
      "crono": [
        {
          "year": 1508,
          "events": [
            {"icon": {"nation": "venice"}, "text": "L'Impero Ottomano ci invia un'ambasciata."}
          ]
        }
      ]
    },
    "france": {
      "name": "Regno di Francia",
      "color": [0, 0, 255],
      "flag": {"file": "imgs/france.png", "ratio": 0.6668},
      "crono": [
        {
          "year": null,
          "events": [
            {"icon": {"file": "imgs/cash.png"}, "text": "Mancano e ssordi."},
            {"text": "Il re è un po' un <b>dito in culo</b>."}
          ]
        },
        {
          "year": 1510,
          "span": 4,
          "events": [
            {"icon": {"file": "imgs/cash.png"}, "text": "Mancano e ssordi."}
          ]
        },
        {
          "year": 1508,
          "events": [
            {"icon": {"nation": "venice"}, "text": "La Francia va a Venezia."},
            {"icon": {"file": "imgs/cash.png"}, "text": "Soldi soldi soldi."}
          ]
        }
      ]
    }
  }
};
