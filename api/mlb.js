export default async function handler(req, res) {
  const urls = [
    'https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=homeRuns&season=2026&sportId=1&limit=1000&statGroup=hitting',
    'https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=homeRuns&season=2026&sportId=1&limit=1000',
    'https://statsapi.mlb.com/api/v1/stats/leaders?leaderCategories=homeRuns&sportId=1&limit=1000',
  ];

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

  const hrMap = {};
  let lastError = '';

  try {
    // Step 1: bulk leaderboard
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        });
        if (!response.ok) { lastError = `HTTP ${response.status}`; continue; }
        const data = await response.json();
        const leaders = data.leagueLeaders?.[0]?.leaders || [];
        if (leaders.length === 0) { lastError = 'No leaders returned'; continue; }
        for (const l of leaders) {
          if (l.person?.fullName) hrMap[l.person.fullName] = parseInt(l.value) || 0;
        }
        break; // success
      } catch(e) { lastError = e.message; continue; }
    }

    // Step 2: individual lookups for pool players not in leaderboard
    const notFound = POOL_PLAYERS.filter(name => hrMap[name] === undefined);
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

        const statsRes = await fetch(
          `https://statsapi.mlb.com/api/v1/people/${person.id}/stats?stats=season&season=2026&group=hitting`,
          { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        if (!statsRes.ok) { hrMap[name] = 0; continue; }
        const statsData = await statsRes.json();
        const splits = statsData.stats?.[0]?.splits || [];
        hrMap[name] = splits.reduce((sum, s) => sum + (s.stat?.homeRuns || 0), 0);
      } catch(e) { hrMap[name] = 0; }
    }

    // Set 0 for any remaining
    for (const name of POOL_PLAYERS) {
      if (hrMap[name] === undefined) hrMap[name] = 0;
    }

    res.status(200).json(hrMap);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}
