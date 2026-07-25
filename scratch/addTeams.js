const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/data/teams.json');
let teams = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const newTeams = [
  {
    "id": 7,
    "name": "Astralis 2019",
    "major": "StarLadder Berlin 2019",
    "position": 1,
    "icon": "/logos/astralis.png",
    "players": [
      {"id": 40, "name": "device", "role": "AWPER", "aim": 95, "gamesense": 96, "positioning": 98, "utility": 93, "clutch": 95, "entry": 90, "aggression": 80, "composure": 96, "flex": true},
      {"id": 41, "name": "dupreeh", "role": "ENTRY", "aim": 92, "gamesense": 89, "positioning": 90, "utility": 91, "clutch": 88, "entry": 98, "aggression": 98, "composure": 89, "flex": true},
      {"id": 42, "name": "Xyp9x", "role": "SUPPORT", "aim": 88, "gamesense": 98, "positioning": 96, "utility": 99, "clutch": 99, "entry": 75, "aggression": 70, "composure": 99, "flex": true},
      {"id": 43, "name": "Magisk", "role": "RIFLER", "aim": 93, "gamesense": 92, "positioning": 94, "utility": 93, "clutch": 92, "entry": 89, "aggression": 88, "composure": 94, "flex": true},
      {"id": 44, "name": "gla1ve", "role": "IGL", "aim": 87, "gamesense": 99, "positioning": 94, "utility": 98, "clutch": 90, "entry": 85, "aggression": 88, "composure": 95, "flex": false}
    ]
  },
  {
    "id": 8,
    "name": "Natus Vincere 2021",
    "major": "PGL Stockholm 2021",
    "position": 1,
    "icon": "/logos/navi.png",
    "players": [
      {"id": 45, "name": "s1mple", "role": "AWPER", "aim": 99, "gamesense": 99, "positioning": 98, "utility": 92, "clutch": 98, "entry": 97, "aggression": 95, "composure": 97, "flex": true},
      {"id": 46, "name": "electronic", "role": "RIFLER", "aim": 96, "gamesense": 94, "positioning": 94, "utility": 90, "clutch": 94, "entry": 95, "aggression": 93, "composure": 93, "flex": true},
      {"id": 47, "name": "b1t", "role": "ENTRY", "aim": 98, "gamesense": 88, "positioning": 89, "utility": 85, "clutch": 88, "entry": 94, "aggression": 90, "composure": 94, "flex": false},
      {"id": 48, "name": "Perfecto", "role": "SUPPORT", "aim": 89, "gamesense": 93, "positioning": 92, "utility": 93, "clutch": 97, "entry": 75, "aggression": 70, "composure": 96, "flex": true},
      {"id": 49, "name": "Boombl4", "role": "IGL", "aim": 85, "gamesense": 88, "positioning": 84, "utility": 88, "clutch": 82, "entry": 90, "aggression": 94, "composure": 86, "flex": false}
    ]
  },
  {
    "id": 9,
    "name": "Cloud9 2018",
    "major": "ELEAGUE Boston 2018",
    "position": 1,
    "icon": "/logos/c9.png",
    "players": [
      {"id": 50, "name": "tarik", "role": "IGL", "aim": 90, "gamesense": 88, "positioning": 87, "utility": 86, "clutch": 87, "entry": 90, "aggression": 92, "composure": 89, "flex": true},
      {"id": 51, "name": "Stewie2K", "role": "ENTRY", "aim": 91, "gamesense": 87, "positioning": 86, "utility": 87, "clutch": 89, "entry": 96, "aggression": 97, "composure": 88, "flex": true},
      {"id": 52, "name": "Skadoodle", "role": "AWPER", "aim": 89, "gamesense": 88, "positioning": 89, "utility": 85, "clutch": 90, "entry": 80, "aggression": 70, "composure": 91, "flex": false},
      {"id": 53, "name": "RUSH", "role": "SUPPORT", "aim": 87, "gamesense": 85, "positioning": 86, "utility": 87, "clutch": 84, "entry": 88, "aggression": 85, "composure": 86, "flex": false},
      {"id": 54, "name": "autimatic", "role": "RIFLER", "aim": 93, "gamesense": 91, "positioning": 90, "utility": 88, "clutch": 93, "entry": 89, "aggression": 86, "composure": 94, "flex": true}
    ]
  },
  {
    "id": 10,
    "name": "Vitality 2023",
    "major": "BLAST Paris 2023",
    "position": 1,
    "icon": "/logos/vitality.png",
    "players": [
      {"id": 55, "name": "ZywOo", "role": "AWPER", "aim": 99, "gamesense": 99, "positioning": 98, "utility": 93, "clutch": 99, "entry": 94, "aggression": 88, "composure": 98, "flex": true},
      {"id": 56, "name": "Spinx", "role": "RIFLER", "aim": 96, "gamesense": 92, "positioning": 93, "utility": 88, "clutch": 93, "entry": 92, "aggression": 89, "composure": 92, "flex": true},
      {"id": 57, "name": "apEX", "role": "IGL", "aim": 85, "gamesense": 93, "positioning": 87, "utility": 91, "clutch": 84, "entry": 90, "aggression": 94, "composure": 88, "flex": false},
      {"id": 58, "name": "Magisk", "role": "SUPPORT", "aim": 92, "gamesense": 93, "positioning": 93, "utility": 94, "clutch": 93, "entry": 86, "aggression": 83, "composure": 95, "flex": true},
      {"id": 59, "name": "dupreeh", "role": "ENTRY", "aim": 90, "gamesense": 89, "positioning": 89, "utility": 88, "clutch": 89, "entry": 95, "aggression": 93, "composure": 90, "flex": true}
    ]
  },
  {
    "id": 11,
    "name": "Luminosity 2016",
    "major": "MLG Columbus 2016",
    "position": 1,
    "icon": "/logos/lg.png",
    "players": [
      {"id": 60, "name": "FalleN", "role": "IGL", "aim": 93, "gamesense": 96, "positioning": 95, "utility": 94, "clutch": 95, "entry": 85, "aggression": 80, "composure": 96, "flex": true},
      {"id": 61, "name": "coldzera", "role": "RIFLER", "aim": 97, "gamesense": 96, "positioning": 98, "utility": 92, "clutch": 98, "entry": 90, "aggression": 84, "composure": 98, "flex": true},
      {"id": 62, "name": "fer", "role": "ENTRY", "aim": 94, "gamesense": 92, "positioning": 89, "utility": 86, "clutch": 90, "entry": 99, "aggression": 99, "composure": 91, "flex": false},
      {"id": 63, "name": "fnx", "role": "SUPPORT", "aim": 92, "gamesense": 94, "positioning": 92, "utility": 91, "clutch": 95, "entry": 86, "aggression": 85, "composure": 95, "flex": true},
      {"id": 64, "name": "TACO", "role": "SUPPORT", "aim": 86, "gamesense": 87, "positioning": 88, "utility": 90, "clutch": 85, "entry": 89, "aggression": 92, "composure": 89, "flex": false}
    ]
  },
  {
    "id": 12,
    "name": "Virtus.pro 2014",
    "major": "EMS One Katowice 2014",
    "position": 1,
    "icon": "/logos/vp.png",
    "players": [
      {"id": 65, "name": "pashaBiceps", "role": "AWPER", "aim": 92, "gamesense": 88, "positioning": 90, "utility": 84, "clutch": 89, "entry": 90, "aggression": 88, "composure": 90, "flex": true},
      {"id": 66, "name": "Snax", "role": "RIFLER", "aim": 94, "gamesense": 97, "positioning": 96, "utility": 93, "clutch": 97, "entry": 92, "aggression": 90, "composure": 96, "flex": true},
      {"id": 67, "name": "byali", "role": "ENTRY", "aim": 93, "gamesense": 87, "positioning": 88, "utility": 85, "clutch": 87, "entry": 95, "aggression": 96, "composure": 88, "flex": false},
      {"id": 68, "name": "TaZ", "role": "IGL", "aim": 87, "gamesense": 92, "positioning": 90, "utility": 89, "clutch": 91, "entry": 85, "aggression": 86, "composure": 93, "flex": false},
      {"id": 69, "name": "NEO", "role": "SUPPORT", "aim": 89, "gamesense": 94, "positioning": 93, "utility": 92, "clutch": 94, "entry": 86, "aggression": 84, "composure": 95, "flex": true}
    ]
  }
];

teams = teams.concat(newTeams);
fs.writeFileSync(filePath, JSON.stringify(teams, null, 2));
console.log('Added 6 teams successfully!');
