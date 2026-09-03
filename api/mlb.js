export default async function handler(req, res) {
  const POOL_PLAYERS = [
    "Pete Alonso","Elly De La Cruz","Roman Anthony","Corey Seager","Vladimir Guerrero Jr.",
    "Fernando Tatis Jr.","Bobby Witt Jr.","Jake Burger","Jorge Soler","Gunnar Henderson",
    "Coby Mayo","Jackson Merrill","Daylen Lile","Cam Smith","Luis Robert Jr.","Dominic Canzone",
    "Kyle Schwarber","Aaron Judge","Julio Rodríguez","Francisco Lindor","Josh Naylor","Bo Bichette",
    "Nolan Gorman","Christopher Morel","Jake Cronenworth","Tyler Soderstrom","José Ramírez",
    "Ronald Acuña Jr.","Dylan Crews","Oneil Cruz","Tyler O'Neill","Spencer Torkelson",
    "Freddie Freeman","Gavin Sheets","Luis Arráez","Austin Riley","Shohei Ohtani","Trea Turner",
    "Mike Trout","Andrew Vaughn","Ezequiel Tovar","Ketel Marte","Nick Kurtz","Noelvi Marté",
    "Francisco Alvarez","Kyle Tucker","Colson Montgomery","Daulton Varsho","Matt McLain",
    "Pete Crow-Armstrong","Iván Herrera","Giancarlo Stanton","Brent Rooker","Teoscar Hernández",
    "Josh Lowe","Adolis García","Jackson Chourio","James Wood","Ben Rice","Wyatt Langford",
    "Jeff McNeil","Mookie Betts","Jarren Duran","Jonathan Aranda","Juan Soto","Cody Bellinger",
    "Alex Bregman","Adley Rutschman","Jonathan India","Joc Pederson","Ozzie Albies",
    "Spencer Steer","Lars Nootbaar","Dansby Swanson","Bryan Reynolds","Alec Bohm","Austin Wells",
    "Jacob Wilson","Junior Caminero","Royce Lewis","Bryce Harper","Agustín Ramírez","Kyle Teel"
  ];

  function normalize(s) {
    return s.toLowerCase()
      .replace(/[áàâä]/g,'a').replace(/[éèêë]/g,'e').replace(/[íìîï]/g,'i')
      .replace(/[óòôö]/g,'o').replace(/[úùûü]/g,'u').replace(/[ñ]/g,'n')
      .replace(/[^a-z0-9 .]/g,'').trim();
  }

  const hrMap = {};

  try {
    // Use the totals endpoint which gives season totals consolidated across teams
    const urls = [
      'https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=homeRuns&season=2026&sportId=1&limit=1000&statGroup=hitting',
      'https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=homeRuns&season=2026&sportId=1&limit=1000',
    ];

    // Build a map of personId -> max HR value to deduplicate traded players
    const idToHR = {};
    const idToName = {};

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        });
        if (!response.ok) continue;
        const data = await response.json();
        const leaders = data.leagueLeaders?.[0]?.leaders || [];
        if (leaders.length === 0) continue;

        for (const l of leaders) {
          const name = l.person?.fullName;
          const id = l.person?.id;
          const hr = parseInt(l.value) || 0;
          if (!name || !id) continue;

          // Keep the highest HR count per player ID (handles traded players appearing twice)
          if (idToHR[id] === undefined || hr > idToHR[id]) {
            idToHR[id] = hr;
            idToName[id] = name;
          }
        }
        break;
      } catch(e) { continue; }
    }

    // Map deduplicated results to hrMap by name
    for (const [id, hr] of Object.entries(idToHR)) {
      hrMap[idToName[id]] = hr;
    }

    // Individual lookups for pool players not in leaderboard (0 HRs)
    const notFound = POOL_PLAYERS.filter(name => {
      if (hrMap[name] !== undefined) return false;
      // also check normalized name match
      const norm = normalize(name);
      return !Object.keys(hrMap).some(k => normalize(k) === norm);
    });

    for (const name of notFound) {
      try {
        const searchRes = await fetch(
          `https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(name)}&sportId=1`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        if (!searchRes.ok) { hrMap[name] = 0; continue; }
        const searchData = await searchRes.json();
        const person = searchData.people?.[0];
        if (!person?.id) { hrMap[name] = 0; continue; }

        // Use statsSingleSeason which gives one consolidated total row
        const statsRes = await fetch(
          `https://statsapi.mlb.com/api/v1/people/${person.id}/stats?stats=statsSingleSeason&season=2026&group=hitting`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        if (!statsRes.ok) { hrMap[name] = 0; continue; }
        const statsData = await statsRes.json();
        // statsSingleSeason returns one row with full season total
        const hr = statsData.stats?.[0]?.splits?.[0]?.stat?.homeRuns || 0;
        hrMap[name] = hr;
      } catch(e) { hrMap[name] = 0; }
    }

    // Normalize pool player names against hrMap for accented chars
    const finalMap = {};
    for (const player of POOL_PLAYERS) {
      if (hrMap[player] !== undefined) {
        finalMap[player] = hrMap[player];
        continue;
      }
      const norm = normalize(player);
      const match = Object.keys(hrMap).find(k => normalize(k) === norm);
      finalMap[player] = match ? hrMap[match] : 0;
    }

    res.status(200).json(finalMap);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}
